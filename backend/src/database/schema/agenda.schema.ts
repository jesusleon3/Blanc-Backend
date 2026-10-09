import { boolean, customType, index, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const agendaSchema = pgSchema('agenda');

/**
 * Rango horario de una cita, como `tstzrange` nativo de PostgreSQL.
 *
 * POR QUÉ UN RANGO Y NO DOS COLUMNAS `inicio`/`fin`: la restricción `EXCLUDE USING gist` opera
 * sobre el operador de solapamiento `&&`, que solo existe para tipos de rango. Con dos columnas
 * sueltas el invariante anti-doble-booking tendría que vivir en la aplicación, que es
 * exactamente lo que `04-data-model.md` §5.1 descarta.
 *
 * POR QUÉ `tstzrange` Y NO `tsrange`: todo el resto del esquema usa `timestamp with time zone`
 * (`creado_en`, `actualizado_en`, …) y `DEC-031` lo fija así. Mezclar un rango sin zona obligaría
 * a castear en cada comparación y abriría la puerta a comparar una hora "de pared" con un
 * instante absoluto — el tipo de error que no falla en pruebas y sí en producción.
 */
export interface RangoHorario {
  inicio: Date;
  fin: Date;
}

export const tstzrange = customType<{ data: RangoHorario; driverData: string }>({
  dataType() {
    return 'tstzrange';
  },
  /** `[inicio, fin)` — inicio inclusivo, fin EXCLUSIVO: una cita que acaba a las 11:00 y otra que
   * empieza a las 11:00 **no** se solapan. Con `]` serían un conflicto y el salón no podría
   * encadenar citas consecutivas. */
  toDriver(valor: RangoHorario): string {
    return `[${valor.inicio.toISOString()},${valor.fin.toISOString()})`;
  },
  fromDriver(valor: string): RangoHorario {
    const partes = /^[[(]"?([^",]+)"?,"?([^",]+)"?[\])]$/.exec(valor);
    if (!partes) {
      throw new Error(`No se pudo interpretar el rango horario devuelto por PostgreSQL: ${valor}`);
    }
    return { inicio: new Date(partes[1]), fin: new Date(partes[2]) };
  },
});

/**
 * `agenda.sillas` — la **estación de trabajo física** (`DEC-031`, patrón de Sillas Virtuales).
 *
 * El número de filas por sucursal **ES** la capacidad de esa sucursal: Zibatá 5, Lomas 3,
 * Álamos 1. No hay ninguna constante en código con esos números; añadir una silla es insertar
 * una fila.
 *
 * `sucursal_id` **sin clave foránea**: `sucursales` vive en el esquema `sucursales_personal` y
 * `ADR-005` prohíbe las FK entre esquemas. Mismo criterio que `usuarios_sucursales`.
 */
export const sillas = agendaSchema.table(
  'sillas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sucursalId: uuid('sucursal_id').notNull(),
    /** Etiqueta interna ("Lomas 1"). **Nunca visible a la clienta**: las sillas son un mecanismo
     * de capacidad, no un producto. Nada en WhatsApp dice "silla 2". */
    nombre: text('nombre').notNull(),
    activa: boolean('activa').notNull().default(true),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => ({
    porSucursal: index('sillas_sucursal_idx').on(tabla.sucursalId),
  }),
);

/**
 * Estados de `Cita` creados en este incremento.
 *
 * ⚠️ **LISTA INCOMPLETA RESPECTO A `DEC-034`, A PROPÓSITO.** La orden de trabajo fijó estos seis.
 * La lista aprobada en `DEC-034` tiene ocho: faltan `no_show` —que `RN-CRM-06` necesita para
 * disparar la sugerencia de lista roja— y el par `pendiente_confirmacion`/`confirmada`, que
 * `RN-CONV-11` exige por ser la confirmación interactiva. Ver el handoff de `PROJECT_STATUS.md`.
 *
 * Por eso la columna es `text` + `CHECK` y **no** un `enum` de PostgreSQL: añadir un valor a un
 * `enum` requiere `ALTER TYPE … ADD VALUE`, que no puede ejecutarse dentro de la transacción en
 * la que Drizzle envuelve cada migración. Con `CHECK` es un `DROP`/`ADD CONSTRAINT` trivial.
 */
export const ESTADOS_CITA = ['agendada', 'en_espera_pago', 'completada', 'cancelada', 'expirada', 'reprogramada'] as const;
export type EstadoCita = (typeof ESTADOS_CITA)[number];

/**
 * Estados que **liberan** el horario (`DEC-034`). Todo lo demás lo **ocupa**.
 *
 * Se formula por la negativa a propósito: un estado nuevo que alguien añada en el futuro ocupará
 * por defecto, que es el lado seguro del error. Esta lista es la que alimenta el `WHERE` de las
 * dos restricciones de exclusión, y `VerificarCitasFuturasPort` (`DEC-032`) debe reutilizarla en
 * vez de escribir una segunda definición que pueda divergir (pendiente `N-04`).
 */
export const ESTADOS_QUE_LIBERAN_HORARIO = ['cancelada', 'expirada', 'reprogramada'] as const satisfies readonly EstadoCita[];

/**
 * `agenda.citas` — el aggregate central de la Fase 2.
 *
 * **Toda cita ocupa exactamente una silla, siempre** (`silla_id` es `NOT NULL`); la manicurista
 * es opcional. Esa inversión es lo que hace que la capacidad de la sucursal sea una consecuencia
 * aritmética del esquema y no una regla que la aplicación deba recordar — y lo que evita que
 * `NULL = NULL` desactive silenciosamente la restricción de exclusión (`DEC-031` §2.1).
 *
 * **Claves foráneas:** solo `silla_id`, porque `sillas` vive en este mismo esquema. `sucursal_id`,
 * `manicurista_id`, `clienta_id` y `servicio_id` apuntan a otros Bounded Contexts y van **sin FK**
 * (`ADR-005`). `clienta_id` además apunta a un contexto que **todavía no existe** (CRM, Fase 3).
 *
 * **Las dos restricciones `EXCLUDE USING gist` no se declaran aquí**: Drizzle no sabe expresarlas.
 * Viven en la migración `0005`, escritas a mano. Ver la deuda técnica registrada en el handoff.
 */
export const citas = agendaSchema.table(
  'citas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sucursalId: uuid('sucursal_id').notNull(),
    sillaId: uuid('silla_id')
      .notNull()
      .references(() => sillas.id),
    /** `NULL` = la clienta no eligió manicurista. La Encargada la asigna cuando la clienta llega
     * (`DEC-031` §2.4); ese `UPDATE` lo valida sola la segunda restricción de exclusión. */
    manicuristaId: uuid('manicurista_id'),
    /** Sin FK y **sin tabla destino todavía**: el Bounded Context de Clientas (CRM) es Fase 3. */
    clientaId: uuid('clienta_id').notNull(),
    servicioId: uuid('servicio_id').notNull(),
    rangoHorario: tstzrange('rango_horario').notNull(),
    estado: text('estado').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => ({
    porSucursal: index('citas_sucursal_idx').on(tabla.sucursalId),
    porManicurista: index('citas_manicurista_idx').on(tabla.manicuristaId),
    porClienta: index('citas_clienta_idx').on(tabla.clientaId),
  }),
);
