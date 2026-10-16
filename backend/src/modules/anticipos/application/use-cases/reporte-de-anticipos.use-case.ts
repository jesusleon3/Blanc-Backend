import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Database, DATABASE_CONNECTION } from '../../../../database/connection';
import { EstadoAnticipo, RangoHorario } from '../../../../database/schema';
import { exigirRangoValido, filasDe } from '../../../../shared/reportes/rango-de-reporte';

export interface ReporteDeAnticipos {
  /** Cuántos y cuánto, por estado. Siempre los cuatro estados, aunque alguno esté en cero. */
  porEstado: Record<EstadoAnticipo, { cantidad: number; centavos: number }>;
  /**
   * `pagado` + `retenido` — **dinero que el salón efectivamente tiene**.
   *
   * Los dos cuentan: un anticipo retenido por cancelación tardía o `no_show` **no se reembolsa**
   * (`RN-ANT-04`), así que es ingreso igual que uno pagado. Es `ESTADOS_ANTICIPO_COBRADOS` del
   * esquema, y es la razón de que esa constante exista.
   */
  cobradoCentavos: number;
}

/**
 * Agregados de **Anticipos, y solo de Anticipos** — todo el SQL toca el esquema `anticipos`.
 *
 * El mismo criterio que `ReporteDeAgendaUseCase`: `ADR-005` prohíbe el `JOIN` entre esquemas, así
 * que cada contexto agrega lo suyo y `AnaliticaModule` compone.
 *
 * ## OJO CON EL FILTRO DE SUCURSAL: ESTE REPORTE NO LO TIENE
 *
 * `anticipos.anticipos` guarda `cita_id` y `clienta_id`, **no `sucursal_id`** — la sucursal es un
 * dato de la cita, que vive en otro esquema. Filtrar por sucursal exigiría el `JOIN` que `ADR-005`
 * prohíbe, o traerse los ids de cita de Agenda y pasarlos aquí, que con un año de datos es una
 * lista de miles de uuids en una cláusula `IN`.
 *
 * **Así que los anticipos se reportan globales, y el contrato lo dice.** Es información útil tal
 * cual —el dinero de anticipos es del salón, no de una sucursal— y fingir un desglose por sucursal
 * que no se puede calcular bien sería peor que no darlo.
 */
@Injectable()
export class ReporteDeAnticiposUseCase {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async ejecutar(input: { rango: RangoHorario }): Promise<ReporteDeAnticipos> {
    exigirRangoValido(input.rango);

    const filas = filasDe<{ estado: EstadoAnticipo; cantidad: number; centavos: string | number }>(
      await this.db.execute(sql`
        SELECT a.estado,
               COUNT(*)::int AS cantidad,
               COALESCE(SUM(a.monto_centavos), 0)::bigint AS centavos
        FROM anticipos.anticipos a
        WHERE a.creado_en >= ${input.rango.inicio.toISOString()} AND a.creado_en < ${input.rango.fin.toISOString()}
        GROUP BY a.estado
      `),
    );

    const porEstado: Record<EstadoAnticipo, { cantidad: number; centavos: number }> = {
      pendiente: { cantidad: 0, centavos: 0 },
      pagado: { cantidad: 0, centavos: 0 },
      expirado: { cantidad: 0, centavos: 0 },
      retenido: { cantidad: 0, centavos: 0 },
    };

    for (const fila of filas) {
      porEstado[fila.estado] = { cantidad: Number(fila.cantidad), centavos: Number(fila.centavos) };
    }

    return {
      porEstado,
      cobradoCentavos: porEstado.pagado.centavos + porEstado.retenido.centavos,
    };
  }
}
