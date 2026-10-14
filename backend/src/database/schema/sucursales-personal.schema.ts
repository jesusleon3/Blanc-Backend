/**
 * Esquema Drizzle — Bounded Context "Sucursales y Personal" (`sucursales_personal`).
 * Fuente: 04-data-model.md §5.7, §4.6 (convenciones de tipos), ADR-005 (esquema propio, sin FKs cruzadas).
 */
import { boolean, date, index, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tstzrange } from './tipos-rango';
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

/**
 * Tipos de excepción al horario base de una manicurista (`DEC-036`).
 *
 * El horario base NO se modela: la Dueña confirmó que **todas trabajan al mismo tiempo**, el
 * horario de su sucursal. Modelar un horario por persona sería inventar flexibilidad que el
 * negocio no tiene. Lo que sí hay que capturar es la **excepción** de cada día.
 */
export const TIPOS_EXCEPCION_PERSONAL = ['ausencia', 'cobertura'] as const;
export type TipoExcepcionPersonal = (typeof TIPOS_EXCEPCION_PERSONAL)[number];

/**
 * `sucursales_personal.excepciones_personal` — lo que `DEC-035` necesitaba y no tenía: la fuente
 * de datos de `manicuristas_activas`.
 *
 * DOS TIPOS, UNA TABLA:
 * - **`ausencia`**: la manicurista no está disponible en ningún sitio durante el rango (faltó,
 *   se fue temprano). `sucursal_id` es `NULL`: no se ausenta "de una sucursal", se ausenta.
 * - **`cobertura`**: trabaja en `sucursal_id` durante el rango. Es un movimiento, no una suma:
 *   **resta capacidad en su sucursal base y la suma en la de destino**. Un solo registro cambia
 *   la capacidad de DOS sucursales, que es justo lo que hacía imposible resolverlo con un
 *   booleano de ausencia.
 *
 * El rango es `tstzrange`, no una fecha: la Dueña pidió poder registrar también **salidas
 * anticipadas**, que son media jornada.
 *
 * `manicurista_id` lleva FK real porque `manicuristas` vive en este mismo esquema. `sucursal_id`
 * también, por lo mismo.
 */
export const excepcionesPersonal = sucursalesPersonalSchema.table(
  'excepciones_personal',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    manicuristaId: uuid('manicurista_id')
      .notNull()
      .references(() => manicuristas.id, { onDelete: 'cascade' }),
    tipo: text('tipo').notNull(),
    /** Solo para `cobertura`: la sucursal donde trabaja ese día. `NULL` en una `ausencia`. */
    sucursalId: uuid('sucursal_id').references(() => sucursales.id),
    rango: tstzrange('rango').notNull(),
    motivo: text('motivo'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => ({
    porManicurista: index('excepciones_personal_manicurista_idx').on(tabla.manicuristaId),
    porSucursal: index('excepciones_personal_sucursal_idx').on(tabla.sucursalId),
  }),
);
