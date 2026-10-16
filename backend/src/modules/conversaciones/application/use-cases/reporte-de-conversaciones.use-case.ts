import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Database, DATABASE_CONNECTION } from '../../../../database/connection';
import { MotivoDeEscalamiento, RangoHorario } from '../../../../database/schema';
import { exigirRangoValido, filasDe } from '../../../../shared/reportes/rango-de-reporte';

export interface ReporteDeConversaciones {
  /** Conversaciones con al menos un mensaje en el periodo. */
  activas: number;
  /**
   * Cuántas se resolvieron **sin que interviniera ninguna persona**.
   *
   * Ver la nota de `atendidasSoloPorElBot` en el caso de uso: se deriva de los **mensajes**, no del
   * `modo` actual, y la diferencia importa.
   */
  soloBot: number;
  conIntervencionHumana: number;
  /** `soloBot / activas`, redondeado a un decimal. `null` si no hubo conversaciones. */
  porcentajeResueltoPorElBot: number | null;
  /** Escalamientos vivos por motivo, de los nueve del catálogo. Siempre los nueve. */
  escalamientosPorMotivo: Record<MotivoDeEscalamiento, number>;
}

/**
 * Agregados de **Conversaciones, y solo de Conversaciones** — todo el SQL toca ese esquema.
 *
 * ## LA REGLA 80/20: CÓMO SE MIDE "SE QUEDÓ EN EL BOT", Y POR QUÉ NO POR EL `modo`
 *
 * La forma obvia sería contar las que tienen `modo = 'bot'`. **Es incorrecta**, y el error es
 * silencioso: `devolverAlBot` limpia `motivo_de_escalamiento` y `escalada_en` (`RN-ESC-03`), así
 * que una conversación escalada, atendida por una persona y devuelta al bot **queda
 * indistinguible** de una que nunca se escaló. El indicador de resolución autónoma saldría
 * inflado, y justo en los casos en que una persona trabajó.
 *
 * Se deriva de los **mensajes**: una conversación se atendió sola si **ningún mensaje del periodo
 * tiene `emisor = 'humano'`**. Eso es un hecho registrado y no se borra al devolver el control.
 *
 * `emisor = 'sistema'` (recordatorios, ofertas de hueco) **no cuenta como intervención humana**: lo
 * manda el Planificador, no una persona.
 */
@Injectable()
export class ReporteDeConversacionesUseCase {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async ejecutar(input: { rango: RangoHorario; sucursalId?: string }): Promise<ReporteDeConversaciones> {
    exigirRangoValido(input.rango);

    const desde = input.rango.inicio.toISOString();
    const hasta = input.rango.fin.toISOString();
    const deLaSucursal = input.sucursalId ? sql`AND c.sucursal_id = ${input.sucursalId}` : sql``;

    const [actividad, motivos] = await Promise.all([
      this.db.execute(sql`
        WITH actividad AS (
          SELECT m.conversacion_id,
                 -- TRUE si alguna persona escribio en el periodo. 'sistema' no cuenta: lo manda
                 -- el planificador, no una persona.
                 BOOL_OR(m.emisor = 'humano') AS hubo_humano
          FROM conversaciones.mensajes m
          JOIN conversaciones.conversaciones c ON c.id = m.conversacion_id
          WHERE m.ocurrido_en >= ${desde} AND m.ocurrido_en < ${hasta} ${deLaSucursal}
          GROUP BY m.conversacion_id
        )
        SELECT COUNT(*)::int AS activas,
               COUNT(*) FILTER (WHERE NOT hubo_humano)::int AS solo_bot
        FROM actividad
      `),
      this.db.execute(sql`
        SELECT c.motivo_de_escalamiento AS motivo, COUNT(*)::int AS total
        FROM conversaciones.conversaciones c
        WHERE c.motivo_de_escalamiento IS NOT NULL
          AND c.escalada_en >= ${desde} AND c.escalada_en < ${hasta}
          ${deLaSucursal}
        GROUP BY c.motivo_de_escalamiento
      `),
    ]);

    const [resumen] = filasDe<{ activas: number; solo_bot: number }>(actividad);
    const activas = Number(resumen?.activas ?? 0);
    const soloBot = Number(resumen?.solo_bot ?? 0);

    const escalamientosPorMotivo = inicializarMotivos();
    for (const fila of filasDe<{ motivo: MotivoDeEscalamiento; total: number }>(motivos)) {
      escalamientosPorMotivo[fila.motivo] = Number(fila.total);
    }

    return {
      activas,
      soloBot,
      conIntervencionHumana: activas - soloBot,
      // `null` y no `0` cuando no hubo conversaciones: "el bot resolvió el 0%" y "no hubo nada que
      // resolver" son cosas distintas, y un 0% en el panel haría pensar que el bot no funciona.
      porcentajeResueltoPorElBot: activas === 0 ? null : Math.round((soloBot / activas) * 1000) / 10,
      escalamientosPorMotivo,
    };
  }
}

/** Los nueve motivos en 0, para que la respuesta tenga siempre las mismas claves. */
function inicializarMotivos(): Record<MotivoDeEscalamiento, number> {
  return {
    clienta_bloqueada: 0,
    solicitud_humana: 0,
    queja_o_reclamo: 0,
    cotizacion_compleja: 0,
    cancelacion_solicitada: 0,
    intervencion_manual: 0,
    baja_confianza_ia: 0,
    fuera_de_alcance: 0,
    medio_no_soportado: 0,
  };
}
