import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Database, DATABASE_CONNECTION } from '../../../../database/connection';
import { EstadoCita, RangoHorario } from '../../../../database/schema';
import { exigirRangoValido, filasDe } from '../../../../shared/reportes/rango-de-reporte';

/** `<= 60 min` del inicio: es el criterio de `RN-CRM-06` para incidente tardío. */
export const MINUTOS_DE_CANCELACION_TARDIA = 60;

export interface ReporteDeAgenda {
  porEstado: Record<EstadoCita, number>;
  total: number;
  /** Canceladas a `<= 60 min` del inicio (`RN-CRM-06`). */
  cancelacionesTardias: number;
  atendidasPorSucursal: { sucursalId: string; completadas: number; noShow: number }[];
  /**
   * `manicuristaId` `null` agrupa las que se completaron sin asignar a nadie.
   *
   * ⚠️ **`completadas` incluye las reposiciones de garantía**, que son trabajo real pero **no
   * vendido**. Ver `garantiasCompletadas`: el total de reposiciones del periodo viaja aparte
   * precisamente para que este desglose se pueda leer sabiendo que las contiene.
   */
  atendidasPorManicurista: { manicuristaId: string | null; completadas: number }[];
  /**
   * Suma de `cotizacion_snapshot.totalCentavos` de las citas `completada`.
   *
   * **Es un estimado y el contrato lo dice.** Ver la nota de `ingresoEstimadoCentavos` abajo.
   */
  ingresoEstimadoCentavos: number;
  /** Cuántas `completada` no tienen total (cotización manual, `DEC-033`): quedan fuera de la suma. */
  completadasSinCotizar: number;
  /**
   * Cuántas de las `completada` fueron **reposiciones de garantía** (`RN-GAR-01..06`).
   *
   * ## POR QUÉ ESTE CAMPO EXISTE (auditoría 2026-10-17)
   *
   * Una garantía es una `Cita` con `totalCentavos: 0`. En el ingreso eso es correcto —suma cero, no
   * lo infla— pero en los conteos era **invisible**: entraba en `porEstado.completada` y en
   * `atendidasPorManicurista` como una cita cualquiera.
   *
   * Las dos consecuencias, y la segunda es la que obliga a nombrarlo:
   *
   * 1. *"20 completadas, $9.000"* sin saber que tres fueron gratis da un promedio por cita bajo
   *    sin explicación visible.
   * 2. **El desglose por manicurista es una medida de su trabajo**, y una reposición suele ser la
   *    corrección de su propio trabajo. Contarla igual que una cita vendida hacía que rehacer uñas
   *    despegadas **subiera** su cifra.
   *
   * **No se excluyen del conteo**: la silla se ocupó y hubo trabajo real, así que para ocupación y
   * capacidad cuentan. Lo que faltaba era poder distinguirlas.
   */
  garantiasCompletadas: number;
  listaDeEspera: {
    inscritas: number;
    notificadas: number;
    aceptadas: number;
    expiradas: number;
  };
}

/**
 * Agregados de **Agenda, y solo de Agenda**.
 *
 * ## POR QUÉ ESTE CASO DE USO VIVE AQUÍ Y NO EN UN MÓDULO DE ANALÍTICA
 *
 * `ADR-005` prohíbe que un contexto haga `JOIN` contra las tablas de otro, y `CLAUDE.md` lo dice
 * literal: *"si necesita ese dato, lo pide a través del caso de uso público de ese contexto"*. Un
 * módulo de Analítica con SQL propio cruzando `agenda`, `anticipos`, `conversaciones` y `crm`
 * sería el `JOIN` entre esquemas que la decisión existe para impedir — y el día que uno de esos
 * contextos se extraiga a su propio servicio, el reporte dejaría de compilar.
 *
 * Así que cada Bounded Context agrega **lo suyo** y `AnaliticaModule` compone. La consecuencia que
 * importa: todo el SQL de este archivo toca **únicamente el esquema `agenda`**.
 *
 * ## POR QUÉ SQL AGREGADO Y NO LOS REPOSITORIOS EXISTENTES
 *
 * `listarParaConsulta` está pensado para pintar la agenda del día: paginado, acotado a 31 días y a
 * una sucursal. Un reporte anual con él serían cientos de peticiones y el conteo se haría en Node
 * sobre decenas de miles de filas. Un `COUNT(*) GROUP BY` es la herramienta correcta, y el
 * repositorio no es el sitio para ella: estas consultas no reconstruyen entidades.
 */
@Injectable()
export class ReporteDeAgendaUseCase {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async ejecutar(input: { rango: RangoHorario; sucursalId?: string }): Promise<ReporteDeAgenda> {
    exigirRangoValido(input.rango);

    const { inicio, fin } = input.rango;
    // El filtro de sucursal se interpola como condición parametrizada; `sql` de Drizzle escapa el
    // valor, así que no hay concatenación de texto con datos del cliente.
    const deLaSucursal = input.sucursalId ? sql`AND c.sucursal_id = ${input.sucursalId}` : sql``;

    /**
     * El rango se compara contra `lower(rango_horario)`, **el inicio de la cita**.
     *
     * Es la pregunta que el negocio hace —*"¿cuántas citas hubo en marzo?"*— y no *"¿cuántas
     * solapaban marzo?"*. Con citas de una o dos horas la diferencia solo aparece en el borde del
     * día, pero hay que elegir una y decirlo: una cita que empieza el 31 a las 23:00 cuenta en
     * marzo, no en abril.
     */
    const enElRango = sql`lower(c.rango_horario) >= ${inicio.toISOString()} AND lower(c.rango_horario) < ${fin.toISOString()}`;

    const [porEstado, tardias, porSucursal, porManicurista, ingresos, espera] = await Promise.all([
      this.db.execute(sql`
        SELECT c.estado, COUNT(*)::int AS total
        FROM agenda.citas c
        WHERE ${enElRango} ${deLaSucursal}
        GROUP BY c.estado
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM agenda.citas c
        WHERE c.estado = 'cancelada' AND ${enElRango} ${deLaSucursal}
          -- actualizado_en es cuando se cancelo: la transicion es la ultima escritura de la fila.
          -- Es una aproximacion y conviene saberlo: si la cita se tocara despues de cancelarse,
          -- este numero se desviaria. Hoy nada la toca tras cancelar (no admite mas transiciones).
          AND lower(c.rango_horario) - c.actualizado_en <= ${`${MINUTOS_DE_CANCELACION_TARDIA} minutes`}::interval
      `),
      this.db.execute(sql`
        SELECT c.sucursal_id,
               COUNT(*) FILTER (WHERE c.estado = 'completada')::int AS completadas,
               COUNT(*) FILTER (WHERE c.estado = 'no_show')::int AS no_show
        FROM agenda.citas c
        WHERE ${enElRango} ${deLaSucursal}
        GROUP BY c.sucursal_id
        ORDER BY completadas DESC
      `),
      this.db.execute(sql`
        SELECT c.manicurista_id, COUNT(*)::int AS completadas
        FROM agenda.citas c
        WHERE c.estado = 'completada' AND ${enElRango} ${deLaSucursal}
        GROUP BY c.manicurista_id
        ORDER BY completadas DESC
      `),
      this.db.execute(sql`
        SELECT
          -- El operador ->> da texto; el cast explicito evita que PostgreSQL sume como texto.
          COALESCE(SUM((c.cotizacion_snapshot->>'totalCentavos')::bigint), 0)::bigint AS centavos,
          COUNT(*) FILTER (WHERE c.cotizacion_snapshot->>'totalCentavos' IS NULL)::int AS sin_cotizar,
          -- Las reposiciones de garantia: trabajo real, ingreso cero. Se cuentan en la MISMA
          -- consulta que el ingreso porque comparten el filtro exacto (completada, en el rango), y
          -- separarlas seria una quinta consulta con el mismo WHERE.
          -- SIN BACKTICKS EN ESTE COMENTARIO: cerrarian el template literal de sql.
          COUNT(*) FILTER (WHERE c.es_garantia)::int AS garantias
        FROM agenda.citas c
        WHERE c.estado = 'completada' AND ${enElRango} ${deLaSucursal}
      `),
      this.db.execute(sql`
        SELECT le.estado, COUNT(*)::int AS total
        FROM agenda.lista_espera le
        WHERE le.creado_en >= ${inicio.toISOString()} AND le.creado_en < ${fin.toISOString()}
          ${input.sucursalId ? sql`AND le.sucursal_id = ${input.sucursalId}` : sql``}
        GROUP BY le.estado
      `),
    ]);

    const conteos = filasDe<{ estado: EstadoCita; total: number }>(porEstado);
    const porEstadoCompleto = inicializarEstados();
    for (const fila of conteos) porEstadoCompleto[fila.estado] = Number(fila.total);

    const esperaPorEstado = new Map(
      filasDe<{ estado: string; total: number }>(espera).map((fila) => [fila.estado, Number(fila.total)]),
    );
    const sumaDeEspera = [...esperaPorEstado.values()].reduce((suma, valor) => suma + valor, 0);
    const [filaDeIngresos] = filasDe<{ centavos: string | number; sin_cotizar: number; garantias: number }>(ingresos);

    return {
      porEstado: porEstadoCompleto,
      total: Object.values(porEstadoCompleto).reduce((suma, valor) => suma + valor, 0),
      cancelacionesTardias: Number(filasDe<{ total: number }>(tardias)[0]?.total ?? 0),
      atendidasPorSucursal: filasDe<{ sucursal_id: string; completadas: number; no_show: number }>(porSucursal).map((fila) => ({
        sucursalId: fila.sucursal_id,
        completadas: Number(fila.completadas),
        noShow: Number(fila.no_show),
      })),
      atendidasPorManicurista: filasDe<{ manicurista_id: string | null; completadas: number }>(porManicurista).map((fila) => ({
        manicuristaId: fila.manicurista_id,
        completadas: Number(fila.completadas),
      })),
      // `bigint` llega como texto en `postgres-js`: `Number` explícito, no concatenación.
      ingresoEstimadoCentavos: Number(filaDeIngresos?.centavos ?? 0),
      completadasSinCotizar: Number(filaDeIngresos?.sin_cotizar ?? 0),
      garantiasCompletadas: Number(filaDeIngresos?.garantias ?? 0),
      listaDeEspera: {
        // "Inscritas" es el total de solicitudes creadas en el periodo, en cualquier estado: es la
        // demanda que no cupo, que es lo que el indicador quiere medir.
        inscritas: sumaDeEspera,
        notificadas: esperaPorEstado.get('notificada') ?? 0,
        aceptadas: esperaPorEstado.get('aceptada') ?? 0,
        expiradas: esperaPorEstado.get('expirada') ?? 0,
      },
    };
  }
}

/**
 * Todos los estados en 0, para que la respuesta tenga **siempre las mismas claves**.
 *
 * Sin esto, un estado sin citas no aparecería y el cliente tendría que tratar `undefined` como 0
 * en cada punto donde lo lea — que es exactamente la clase de detalle que se olvida una vez.
 */
function inicializarEstados(): Record<EstadoCita, number> {
  return {
    en_espera_pago: 0,
    agendada: 0,
    pendiente_confirmacion: 0,
    confirmada: 0,
    completada: 0,
    no_show: 0,
    cancelada: 0,
    reprogramada: 0,
    expirada: 0,
  };
}
