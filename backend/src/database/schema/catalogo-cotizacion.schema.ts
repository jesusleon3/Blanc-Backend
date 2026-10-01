/**
 * Esquema Drizzle — Bounded Context "Catálogo y Cotización" (`catalogo_cotizacion`).
 * Fuente: 04-data-model.md §5.2, 01-domain-discovery.md §5.2.
 *
 * Alcance de este incremento: solo la persistencia que `FL-COT-01` (gestión administrativa del
 * catálogo) necesita. Los micro-flows de cálculo `FL-COT-02`/`FL-COT-03` quedan deliberadamente
 * fuera — sus únicos consumidores son flujos de Agenda, que no existe, y `RN-COT-04` sigue
 * parcialmente bloqueada por la Pregunta 3 de `OWNER_DECISION_LOG.md`.
 *
 * NO EXISTE aquí una tabla `cotizaciones` ni `composiciones_por_una`, y no debe crearse:
 * `CotizacionServicio` y `ComposicionPorUña` son Value Objects que **no se persisten como
 * entidad propia** — se congelan dentro de `agenda.citas.cotizacion_snapshot` al confirmarse la
 * cita (`04-data-model.md` §5.2, nota de alcance: crearla "sería una redundancia contraria al
 * diseño ya congelado").
 *
 * Dinero: todos los importes son enteros en centavos (`RN-COT-07`), nunca decimales ni flotantes.
 */
import { boolean, integer, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const catalogoCotizacionSchema = pgSchema('catalogo_cotizacion');

/** `servicios` — aggregate raíz `Servicio` (01-domain-discovery.md §5.2). */
export const servicios = catalogoCotizacionSchema.table('servicios', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  /** Incluye `retiro` como categoría propia (`RN-COT-02`), no como variante de una aplicación. */
  categoria: text('categoria').notNull(),
  duracionBaseMinutos: integer('duracion_base_minutos').notNull(),
  /** Entero en centavos (`RN-COT-07`). Nunca `numeric`, nunca `real`. */
  precioBaseCentavos: integer('precio_base_centavos').notNull(),
  activo: boolean('activo').notNull().default(true),
  /**
   * `DEC-033` — el servicio no se puede cotizar automáticamente y exige que un humano fije precio
   * y duración. La automatización se detiene al encontrarlo (directriz de Sistema Híbrido).
   */
  requiereCotizacionManual: boolean('requiere_cotizacion_manual').notNull().default(false),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * `modificadores_diseno` — aggregate raíz **independiente** `ModificadorDeDiseño`, no un hijo de
 * `Servicio`. El Domain Discovery lo justifica explícitamente: un modificador es reutilizable
 * entre servicios ("diseño francés aplica a Gelish y Acrílico por igual"), así que tiene ciclo de
 * vida propio.
 */
export const modificadoresDiseno = catalogoCotizacionSchema.table('modificadores_diseno', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  minutosAdicionales: integer('minutos_adicionales').notNull(),
  /** Entero en centavos (`RN-COT-07`). */
  precioAdicionalCentavos: integer('precio_adicional_centavos').notNull(),
  /** Baja lógica, igual que `servicios.activo`: un modificador descontinuado debe sobrevivir en
   * las citas ya cotizadas con él. Nunca se borra físicamente. */
  activo: boolean('activo').notNull().default(true),
  /** `DEC-033` — mismo criterio que `servicios.requiere_cotizacion_manual`; el caso típico es
   * "Diseño Especial", cuyo tiempo depende del diseño concreto y no se parametriza. */
  requiereCotizacionManual: boolean('requiere_cotizacion_manual').notNull().default(false),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * `servicio_modificadores_aplicables` — relación N:M explícita entre dos aggregates raíz del
 * MISMO Bounded Context, por lo que aquí sí hay FK real (ADR-005 solo prohíbe FKs cruzadas entre
 * esquemas).
 *
 * Existe porque el Domain Discovery dice que `Servicio` "incluye referencia a modificadores
 * aplicables": NO es cierto que cualquier modificador aplique a cualquier servicio. Sin esta
 * tabla, esa restricción de negocio se perdería.
 *
 * `ON DELETE CASCADE` en ambos lados: borrar un servicio o un modificador retira sus vínculos,
 * nunca deja filas colgando. Sin `id` propio ni timestamps — mismo patrón que
 * `manicuristas_sucursales` y `usuarios_sucursales`, sin agregar nada por simetría no requerida.
 */
export const servicioModificadoresAplicables = catalogoCotizacionSchema.table(
  'servicio_modificadores_aplicables',
  {
    servicioId: uuid('servicio_id')
      .notNull()
      .references(() => servicios.id, { onDelete: 'cascade' }),
    modificadorId: uuid('modificador_id')
      .notNull()
      .references(() => modificadoresDiseno.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    parUnico: uniqueIndex('servicio_modificadores_par_unico').on(table.servicioId, table.modificadorId),
  }),
);

/**
 * `servicio_sucursal_override` — **modelada deliberadamente sin uso.**
 *
 * `RN-COT-06` y `RN-COT-08` confirman (`DISCOVERY_CHECKLIST.md` 1.11, 2026-08-04) que el catálogo
 * es global: precios y duraciones son idénticos en las 3 (4) sucursales, sin override. `RN-COT-08`
 * queda catalogada literalmente como "Confirmada sin uso".
 *
 * Se modela igualmente porque `04-data-model.md` §5.2 lo decidió así: es una tabla aditiva, de
 * costo nulo mientras no se pueble, que evitaría un rediseño si la decisión se revirtiera. **No
 * debe leerse ni escribirse por ningún caso de uso** — hacerlo sería implementar una regla que el
 * negocio descartó.
 *
 * Las tres columnas de override son nullable a propósito: `NULL` significa "hereda el valor
 * global de `servicios`". `sucursal_id` es un identificador simple sin FK cruzada —
 * `sucursales_personal` es otro Bounded Context (ADR-005).
 */
export const servicioSucursalOverride = catalogoCotizacionSchema.table(
  'servicio_sucursal_override',
  {
    servicioId: uuid('servicio_id')
      .notNull()
      .references(() => servicios.id, { onDelete: 'cascade' }),
    sucursalId: uuid('sucursal_id').notNull(),
    precioOverrideCentavos: integer('precio_override_centavos'),
    duracionOverrideMinutos: integer('duracion_override_minutos'),
    activoOverride: boolean('activo_override'),
  },
  (table) => ({
    parUnico: uniqueIndex('servicio_sucursal_override_par_unico').on(table.servicioId, table.sucursalId),
  }),
);

export const serviciosRelations = relations(servicios, ({ many }) => ({
  modificadoresAplicables: many(servicioModificadoresAplicables),
  overridesPorSucursal: many(servicioSucursalOverride),
}));

export const modificadoresDisenoRelations = relations(modificadoresDiseno, ({ many }) => ({
  serviciosAplicables: many(servicioModificadoresAplicables),
}));
