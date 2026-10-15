import { Inject, Injectable, Logger } from '@nestjs/common';
import { Database, DATABASE_CONNECTION } from '../../database/connection';

/**
 * Claves de cerrojo. Son enteros porque `pg_try_advisory_lock` los exige; se enumeran aquí para
 * que no se repitan por accidente — dos barridos con la misma clave se excluirían entre sí sin
 * motivo, y el síntoma sería que uno de los dos "no corre nunca" de forma aparentemente aleatoria.
 */
export const CERROJOS = {
  avanceListaEspera: 8_401_001,
  expiracionAnticipos: 8_401_002,
  cierreDeCitas: 8_401_003,
  recordatorios: 8_401_004,
} as const;

/**
 * Exclusión mutua entre instancias con `pg_try_advisory_lock` (`ADR-025`).
 *
 * POR QUÉ HACE FALTA. El cron corre **en proceso**, así que si Railway escala a dos instancias,
 * las dos disparan el mismo barrido a la misma hora. Dos instancias avanzando la Lista de Espera
 * simultáneamente podrían ofrecer el mismo hueco a dos clientas distintas.
 *
 * POR QUÉ `try` Y NO BLOQUEANTE. Si otra instancia tiene el cerrojo, esta **se salta el ciclo**.
 * Un barrido que se salta se repite en el siguiente tick, minutos después; uno que espera acumula
 * ejecuciones encoladas y, con un barrido lento, las apila hasta agotar el pool.
 *
 * POR QUÉ UN CERROJO DE POSTGRESQL Y NO UNA TABLA PROPIA. Vive en la **sesión**: si el proceso
 * muere a mitad del barrido, PostgreSQL lo libera solo. Una tabla de cerrojos tendría que resolver
 * ese caso con tiempos de expiración y relojes, que es justo el problema que se está evitando.
 *
 * ## ⚠️ LA SESIÓN SE RESERVA, Y ESO NO ES UN DETALLE
 *
 * Los advisory locks de PostgreSQL son **por sesión (conexión)**, y `postgres-js` trabaja con un
 * **pool**: `db.execute()` puede usar cualquier conexión libre. La primera versión de esta clase
 * pedía el cerrojo por el pool, y eso tenía un defecto serio — el `pg_try_advisory_lock` podía
 * ejecutarse en la conexión A y el `pg_advisory_unlock` del `finally` en la B. Resultado: el
 * cerrojo de A **queda tomado para siempre** (hasta que el proceso muera) y el barrido deja de
 * correr en silencio; mientras, el `unlock` sobre B devuelve `false` con un aviso que nadie mira.
 *
 * Con `reserve()` se toma una conexión **dedicada** para toda la vida del cerrojo, así que lock y
 * unlock ocurren necesariamente en la misma sesión. Se devuelve al pool en el `finally`.
 *
 * No se usa `pg_advisory_xact_lock` (versión transaccional, que se liberaría sola) porque un
 * barrido abre y cierra **una transacción por elemento** para aislar fallos: el cerrojo se
 * liberaría en la primera y perdería todo su sentido.
 */
@Injectable()
export class CerrojoDeBarrido {
  private readonly logger = new Logger(CerrojoDeBarrido.name);

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  /**
   * Ejecuta `trabajo` solo si consigue el cerrojo. Devuelve `null` si no lo consiguió.
   *
   * `null` es un resultado legítimo, no un error: significa *"otra instancia lo está haciendo"*.
   */
  async conCerrojo<T>(clave: number, nombre: string, trabajo: () => Promise<T>): Promise<T | null> {
    // Conexión dedicada: ver la nota de la cabecera sobre por qué el pool no sirve aquí.
    const sesion = await this.db.$client.reserve();

    try {
      const [{ tomado }] = await sesion<{ tomado: boolean }[]>`SELECT pg_try_advisory_lock(${clave}) AS tomado`;

      if (!tomado) {
        this.logger.log(`Barrido "${nombre}" omitido: otra instancia tiene el cerrojo.`);
        return null;
      }

      try {
        return await trabajo();
      } finally {
        // En `finally`: si el barrido lanza, el cerrojo se libera igual. Sin esto, un fallo lo
        // dejaría tomado y el barrido no volvería a correr nunca.
        await sesion`SELECT pg_advisory_unlock(${clave})`;
      }
    } finally {
      // Siempre se devuelve la conexión al pool, incluso si no se consiguió el cerrojo.
      sesion.release();
    }
  }
}
