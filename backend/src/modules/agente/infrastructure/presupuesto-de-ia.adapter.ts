import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Database, DATABASE_CONNECTION } from '../../../database/connection';
import { fechaLocal } from '../../../shared/tiempo/zona-horaria-negocio';
import { filasDe } from '../../../shared/reportes/rango-de-reporte';
import type { PresupuestoDeIaPort } from '../domain/presupuesto-de-ia.port';

/**
 * Tope diario por defecto, si no se configura `OPENAI_MAX_LLAMADAS_DIA`.
 *
 * ## POR QUÉ 500 Y POR QUÉ NO ES ILIMITADO
 *
 * El número es una **cota de seguridad, no una estimación de demanda**. Tres sucursales con una
 * decena de conversaciones diarias cada una no se acercan: el bot solo invoca al modelo cuando el
 * filtro determinista no acierta, así que las llamadas son una fracción de los mensajes. 500 deja
 * margen de sobra para un día excepcional y **corta mucho antes de que un bucle se vuelva caro**.
 *
 * Lo importante es que el valor por defecto **existe y es finito**: uno ilimitado dejaría sin
 * protección justo a quien no configure la variable, que es quien más la necesita.
 *
 * ⚠️ **No está calibrado contra coste real**: nadie ha medido el precio por llamada ni el volumen
 * (`Pregunta 8` / `N-13`, abiertas). Es un tope de cordura, no un presupuesto en pesos.
 */
export const TOPE_DIARIO_POR_DEFECTO = 500;

/**
 * El cortacircuitos de `F-07`, con la cuenta en PostgreSQL.
 *
 * Ver `PresupuestoDeIaPort` para el *por qué* y `agente.consumo_de_ia` para el *por qué una tabla*.
 */
@Injectable()
export class PresupuestoDeIaEnPostgres implements PresupuestoDeIaPort {
  private readonly logger = new Logger(PresupuestoDeIaEnPostgres.name);
  private readonly tope: number;
  /** Para no llenar el log con una línea por mensaje cuando el tope ya se alcanzó. */
  private ultimoDiaAvisado: string | null = null;

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database, tope?: number) {
    this.tope = tope ?? TOPE_DIARIO_POR_DEFECTO;
  }

  async intentarConsumir(ahora = new Date()): Promise<boolean> {
    const fecha = fechaLocal(ahora);

    /**
     * El apagado total se comprueba **antes de tocar la base**, y la primera versión no lo hacía.
     *
     * Con tope 0, el `INSERT ... VALUES (fecha, 1)` se ejecuta igual —el `WHERE` del `DO UPDATE`
     * solo gobierna el conflicto, no la inserción inicial— así que la primera llamada del día
     * dejaba la fila en 1 y, peor, **devolvía fila**: el apagado no apagaba. Lo destapó la prueba
     * de tope 0.
     */
    if (this.tope <= 0) {
      this.avisarUnaVezAlDia(fecha, 0);
      return false;
    }

    /**
     * **Consultar e incrementar en una sola sentencia**, y de ahí viene toda la garantía.
     *
     * El `WHERE consumo_de_ia.llamadas < tope` del `DO UPDATE` hace que PostgreSQL decida con la
     * fila bloqueada: si dos peticiones llegan juntas, la segunda ve el valor ya incrementado por
     * la primera. Con dos métodos separados (`¿puedo?` + `registra`), las dos pasarían la
     * comprobación antes de que ninguna incrementara — y el tope no serviría justo en el escenario
     * de ráfaga que `F-07` quiere atajar.
     *
     * `RETURNING` solo devuelve fila si el `INSERT` o el `UPDATE` ocurrieron, así que la presencia
     * de resultado **es** la respuesta: no hay que volver a leer.
     */
    const filas = filasDe<{ llamadas: number }>(
      await this.db.execute(sql`
        INSERT INTO agente.consumo_de_ia (fecha, llamadas)
        VALUES (${fecha}, 1)
        ON CONFLICT (fecha) DO UPDATE
          SET llamadas = agente.consumo_de_ia.llamadas + 1
          WHERE agente.consumo_de_ia.llamadas < ${this.tope}
        RETURNING llamadas
      `),
    );

    const permitido = filas.length > 0;

    if (!permitido) {
      this.avisarUnaVezAlDia(fecha, this.tope);
    } else if (filas[0]!.llamadas === this.tope) {
      this.logger.warn(
        `Presupuesto de IA agotado para ${fecha} (${this.tope} llamadas). El bot seguirá atendiendo con el intérprete determinista.`,
      );
    }

    return permitido;
  }

  async consumoDeHoy(ahora = new Date()): Promise<{ llamadas: number; tope: number }> {
    const filas = filasDe<{ llamadas: number }>(
      await this.db.execute(sql`SELECT llamadas FROM agente.consumo_de_ia WHERE fecha = ${fechaLocal(ahora)}`),
    );
    return { llamadas: Number(filas[0]?.llamadas ?? 0), tope: this.tope };
  }

  /**
   * Un aviso por día, no uno por mensaje.
   *
   * Con el tope alcanzado y una ráfaga en curso, un `warn` por intento llenaría el log de miles de
   * líneas idénticas y **enterraría cualquier otro error** justo cuando algo va mal. Que el estado
   * sea de instancia es aceptable: lo peor que pasa tras un reinicio es un aviso de más.
   */
  private avisarUnaVezAlDia(fecha: string, tope: number): void {
    if (this.ultimoDiaAvisado === fecha) return;
    this.ultimoDiaAvisado = fecha;
    this.logger.warn(
      tope === 0
        ? `OPENAI_MAX_LLAMADAS_DIA=0: el modelo está apagado. El bot atiende con el intérprete determinista.`
        : `Presupuesto de IA agotado para ${fecha}. Las siguientes conversaciones se atienden con el intérprete determinista.`,
    );
  }
}
