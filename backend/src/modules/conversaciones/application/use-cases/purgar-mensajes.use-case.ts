import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Database, DATABASE_CONNECTION } from '../../../../database/connection';
import { filasDe } from '../../../../shared/reportes/rango-de-reporte';

/**
 * `0` o sin definir = **no purga nada**. Ver la nota del caso de uso.
 */
export function diasDeRetencionConfigurados(): number {
  const crudo = process.env.RETENCION_MENSAJES_DIAS;
  if (crudo === undefined || crudo.trim() === '') return 0;

  const dias = Number(crudo);
  // Un valor inválido se trata como "no configurado", no como `NaN`: un typo en la variable no
  // debe acabar borrando con un umbral absurdo, ni desactivar la purga en silencio creyéndola
  // activa. Quien lo configure mal verá que no purga, que es el lado seguro.
  return Number.isInteger(dias) && dias > 0 ? dias : 0;
}

/** Tope de filas por ejecución. Ver la nota sobre por qué la purga va por lotes. */
export const MAXIMO_POR_EJECUCION = 5_000;

export interface ResumenDePurga {
  /** `0` cuando la retención no está configurada. */
  diasDeRetencion: number;
  mensajesPurgados: number;
  /** `true` si quedaron más por purgar: el siguiente barrido sigue donde este lo dejó. */
  quedanMas: boolean;
}

/**
 * Purga de contenido conversacional antiguo — **la ejecución de `ADR-029`**.
 *
 * ## QUÉ BORRA, Y QUÉ NO TOCA JAMÁS
 *
 * Borra filas de `conversaciones.mensajes` más antiguas que N días. **No toca `auditoria`**, y eso
 * no es una precaución: es la razón por la que `ADR-029` resolvió la contradicción entre `ADR-007`
 * (trazabilidad total de IA) y `ADR-017`/`ADR-022` (minimización de datos personales).
 *
 * Las dos capas viven en **tablas distintas**: los metadatos de cada decisión del bot —intención,
 * confianza, fuente— están en `auditoria` y **nunca contuvieron el texto** (`RN-AUD-01`). Así que
 * aplicar la retención es borrar filas de una tabla, y la trazabilidad de `ADR-007` queda intacta
 * **por construcción**, no porque la purga haya acertado a conservarla.
 *
 * Tampoco borra conversaciones: la `Conversacion` es la identidad persistente de la clienta en ese
 * número (`DISCOVERY_CHECKLIST` 1.22) y su `modo` es un estado operativo vigente. Lo que caduca es
 * el contenido, no el hilo.
 *
 * ## POR QUÉ `0` POR DEFECTO, Y POR QUÉ ESO NO ES UN DESCUIDO
 *
 * **`ADR-029` cerró la estructura pero NO el valor de retención**, porque depende de la Pregunta
 * Abierta #12 (marco legal de datos personales aplicable), sin confirmar. Inventar un número aquí
 * parecería una decisión informada sobre obligaciones legales cuando sería una suposición.
 *
 * Así que sin `RETENCION_MENSAJES_DIAS` **no se borra nada**. Es el lado seguro: un borrado es
 * irreversible y no hay forma de recuperar un mensaje purgado por un valor por defecto que nadie
 * eligió. Cuando el número se fije, activarlo es poner la variable.
 *
 * ## POR QUÉ POR LOTES
 *
 * Un `DELETE` sin tope sobre un año de mensajes bloquearía la tabla el tiempo que tarde, y la
 * Bandeja Compartida lee de ella en caliente: la primera purga podría dejar al equipo sin poder
 * atender. Con 5.000 por ejecución y un barrido cada hora, la purga se escalona sola y el resumen
 * dice si quedan más.
 */
@Injectable()
export class PurgarMensajesUseCase {
  private readonly logger = new Logger(PurgarMensajesUseCase.name);

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async ejecutar(ahora = new Date(), diasExplicitos?: number): Promise<ResumenDePurga> {
    const dias = diasExplicitos ?? diasDeRetencionConfigurados();

    if (dias <= 0) {
      // Silencio deliberado: no es un error ni una advertencia, es el estado por defecto mientras
      // la Pregunta Abierta #12 siga sin confirmar. Un `warn` por hora sería ruido permanente.
      return { diasDeRetencion: 0, mensajesPurgados: 0, quedanMas: false };
    }

    const limite = new Date(ahora.getTime() - dias * 86_400_000);

    /**
     * El `DELETE` acotado con una subconsulta `LIMIT`, no con `DELETE … LIMIT` (que PostgreSQL no
     * admite). `ctid` es el identificador físico de fila y es la forma estándar de hacerlo: no
     * hace falta un índice extra ni un orden estable, porque qué 5.000 filas se borran primero da
     * igual — todas cumplen el criterio.
     */
    const borradas = filasDe<{ id: string }>(
      await this.db.execute(sql`
        DELETE FROM conversaciones.mensajes
        WHERE ctid IN (
          SELECT ctid FROM conversaciones.mensajes
          WHERE ocurrido_en < ${limite.toISOString()}
          LIMIT ${MAXIMO_POR_EJECUCION}
        )
        RETURNING id
      `),
    );

    const purgados = borradas.length;
    const quedanMas = purgados === MAXIMO_POR_EJECUCION;

    if (purgados > 0) {
      // Se registra el **número**, nunca el contenido ni a quién pertenecía: sería reintroducir la
      // PII que la purga existe para eliminar, y en el log, que es el sitio donde menos se controla.
      this.logger.log(
        `Retención (${dias} días): ${purgados} mensaje(s) purgado(s)${quedanMas ? ', quedan más para el siguiente barrido' : ''}.`,
      );
    }

    return { diasDeRetencion: dias, mensajesPurgados: purgados, quedanMas };
  }
}
