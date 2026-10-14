import { boolean, index, integer, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { RangoHorario, tstzrange } from './tipos-rango';

export { RangoHorario, tstzrange };

export const agendaSchema = pgSchema('agenda');


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
 * Estados de `Cita`, alineados con `DEC-034` (migración `0006`, 2026-10-14).
 *
 * La columna es `text` + `CHECK` y **no** un `enum` de PostgreSQL: añadir un valor a un `enum`
 * requiere `ALTER TYPE … ADD VALUE`, que no corre dentro de la transacción en la que Drizzle
 * envuelve cada migración. Esta ampliación —de 6 a 9 valores— es exactamente el caso que
 * justificó esa decisión, y se resolvió con un `DROP`/`ADD CONSTRAINT`.
 *
 * ⚠️ **AL AÑADIR O QUITAR UN ESTADO HAY QUE TOCAR DOS SITIOS:** este arreglo y el `CHECK` de la
 * migración correspondiente. Drizzle no conoce el `CHECK` (no está en su snapshot), así que nada
 * lo obliga salvo esta nota y las pruebas de `restricciones-agenda.spec.ts`.
 *
 * SOBRE LA SEMÁNTICA DE LOS TRES PRIMEROS — **propuesta, no decidida.** La máquina de estados
 * formal sigue abierta (`P3`). La lectura coherente con lo aprobado es:
 * `agendada` (creada, aún no se le pide confirmar) → `pendiente_confirmacion` (recordatorio
 * enviado, esperando respuesta, `RN-CONV-11`) → `confirmada` (la clienta respondió que sí).
 * Las transiciones LEGALES entre ellos no están fijadas todavía.
 */
export const ESTADOS_CITA = [
  'agendada',
  'pendiente_confirmacion',
  'confirmada',
  'en_espera_pago',
  'completada',
  'no_show',
  'cancelada',
  'expirada',
  'reprogramada',
] as const;
export type EstadoCita = (typeof ESTADOS_CITA)[number];

/**
 * Estados que **liberan** el horario (`DEC-034`). Todo lo demás lo **ocupa**.
 *
 * Se formula por la negativa a propósito: un estado nuevo que alguien añada en el futuro ocupará
 * por defecto, que es el lado seguro del error. **Eso ya se cobró su primer dividendo**: la
 * ampliación de 6 a 9 estados (`0006`) **no requirió tocar el `WHERE` de ninguna de las dos
 * restricciones de exclusión** — `no_show`, `pendiente_confirmacion` y `confirmada` pasaron a
 * ocupar horario automáticamente, que es lo que `DEC-034` exige.
 *
 * `VerificarCitasFuturasPort` (`DEC-032`) reutiliza esta misma lista en vez de escribir una
 * segunda definición que pueda divergir — así se resolvió el pendiente `N-04`.
 */
export const ESTADOS_QUE_LIBERAN_HORARIO = [
  'cancelada',
  'expirada',
  'reprogramada',
  // `en_espera_pago` LIBERA — corregido en la migración `0007` (2026-10-14). `DEC-034` lo había
  // listado como ocupante ("mientras el anticipo no expire, el espacio es suyo"), lo que
  // CONTRADECÍA a `RN-ANT-03`, aprobada: "no existe una retención temporal real del horario…
  // el horario permanece disponible para cualquier otra clienta — el primero en pagar se queda
  // con el cupo". Ganó la regla de negocio. Consecuencia buscada: dos clientas de lista roja
  // pueden tener una cita pendiente de pago sobre el MISMO hueco, y la carrera se resuelve al
  // confirmar el pago, cuando la cita pasa a un estado que sí ocupa y la restricción decide.
  'en_espera_pago',
] as const satisfies readonly EstadoCita[];

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
    /**
     * Cita de la que esta procede al reprogramar. FK **al mismo esquema**, así que es legítima
     * (`ADR-005` solo prohíbe las cruzadas). Da la trazabilidad de la cadena completa.
     */
    citaOrigenId: uuid('cita_origen_id'),
    /**
     * Cuántas veces se ha reprogramado esta cadena. Se guarda en vez de recorrer la cadena en
     * cada comprobación: el tope son **3** (`DEC-042`) y recorrer N citas por cada intento sería
     * una consulta por eslabón para responder una pregunta que cabe en un entero.
     */
    numeroDeReprogramaciones: integer('numero_de_reprogramaciones').notNull().default(0),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => ({
    porSucursal: index('citas_sucursal_idx').on(tabla.sucursalId),
    porManicurista: index('citas_manicurista_idx').on(tabla.manicuristaId),
    porClienta: index('citas_clienta_idx').on(tabla.clientaId),
  }),
);
