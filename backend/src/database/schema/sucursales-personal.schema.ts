/**
 * Esquema Drizzle — Bounded Context "Sucursales y Personal" (`sucursales_personal`).
 * Fuente: 04-data-model.md §5.7, §4.6 (convenciones de tipos), ADR-005 (esquema propio, sin FKs cruzadas).
 */
import { boolean, date, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const sucursalesPersonalSchema = pgSchema('sucursales_personal');

/**
 * `sucursales` — aggregate raíz `Sucursal` (01-domain-discovery.md §5.7).
 * `numero_whatsapp_alias`: solo un alias de referencia — el secreto real vive en el gestor
 * de secretos (03-technical-architecture.md §5.5, principio 12.3), nunca en esta tabla.
 * `descansos`: columna ya prevista por 04-data-model.md §5.7; ninguna fuente detalla su forma
 * interna — se persiste como JSON opaco, sin estructura ni validación de dominio impuesta
 * (ver reporte de cierre del módulo, "decisiones tomadas durante la implementación").
 */
export const sucursales = sucursalesPersonalSchema.table(
  'sucursales',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nombre: text('nombre').notNull(),
    numeroWhatsappAlias: text('numero_whatsapp_alias'),
    horarioSemanal: jsonb('horario_semanal').notNull(),
    descansos: jsonb('descansos'),
    // RN-SUC-02: no modelada explícitamente en 04-data-model.md §5.7 — columna aditiva,
    // justificada directamente por una regla ya Aprobada (RN-SUC-02), ver reporte de cierre.
    enMantenimiento: boolean('en_mantenimiento').notNull().default(false),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nombreUnico: uniqueIndex('sucursales_nombre_unico').on(table.nombre),
  }),
);

/**
 * `dias_festivos` — entidad hija de `Sucursal` (04-data-model.md §5.7).
 * FK real: vive en el mismo esquema que `sucursales` (ADR-005 permite FK dentro del contexto).
 */
export const diasFestivos = sucursalesPersonalSchema.table('dias_festivos', {
  id: uuid('id').primaryKey().defaultRandom(),
  sucursalId: uuid('sucursal_id')
    .notNull()
    .references(() => sucursales.id, { onDelete: 'cascade' }),
  fecha: date('fecha').notNull(),
  descripcion: text('descripcion'),
});

/**
 * `manicuristas` — registro administrativo, aggregate raíz independiente (04-data-model.md §5.7).
 * Intencionalmente distinta de `agenda.manicuristas_recurso` (no existe todavía — Agenda es
 * Fase 2). Referencia entre ambas: ID simple opcional, nunca FK cruzada (ADR-005) — ese campo
 * vivirá en el lado de `agenda` cuando ese módulo se construya, no aquí.
 */
export const manicuristas = sucursalesPersonalSchema.table('manicuristas', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  activa: boolean('activa').notNull().default(true),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * `manicuristas_sucursales` — relación muchos-a-muchos, FK real (mismo esquema, 04-data-model.md §5.7).
 */
export const manicuristasSucursales = sucursalesPersonalSchema.table(
  'manicuristas_sucursales',
  {
    manicuristaId: uuid('manicurista_id')
      .notNull()
      .references(() => manicuristas.id, { onDelete: 'cascade' }),
    sucursalId: uuid('sucursal_id')
      .notNull()
      .references(() => sucursales.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    parUnico: uniqueIndex('manicuristas_sucursales_par_unico').on(table.manicuristaId, table.sucursalId),
  }),
);

export const sucursalesRelations = relations(sucursales, ({ many }) => ({
  diasFestivos: many(diasFestivos),
  manicuristasSucursales: many(manicuristasSucursales),
}));

export const manicuristasRelations = relations(manicuristas, ({ many }) => ({
  manicuristasSucursales: many(manicuristasSucursales),
}));
