/**
 * Esquema Drizzle — Bounded Context "Identidad y Accesos" (`identidad_accesos`).
 * Fuente: 04-data-model.md §5.10, ADR-024.
 *
 * Alcance deliberadamente mínimo: `usuarios` (`FL-SEG-01/03/05`) y `usuarios_sucursales`
 * (`FL-SEG-04`) — solo las columnas que esos flujos realmente usan. `mfa_habilitado`
 * (`FL-SEG-07`) se agrega en la migración del caso de uso que lo necesite, no antes — mismo
 * principio ya aplicado en todo el proyecto (`IMPLEMENTATION_MASTER_PLAN.md` §9).
 * `supabase_user_id` sí se incorpora ya (2026-09-14): la necesitan tanto `FL-SEG-06` para
 * persistir el vínculo como la capa de autorización de `DEC-029` (C2) para resolver
 * `JWT.sub` → usuario de Blanc. `roles`/`permisos` no existen como tabla — `ADR-024` confirma
 * el `Rol` enum estático (`shared/auth/rol.ts`).
 */
import { boolean, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const identidadAccesosSchema = pgSchema('identidad_accesos');

/** `usuarios` — aggregate raíz `Usuario` (01-domain-discovery.md §5.8). */
export const usuarios = identidadAccesosSchema.table(
  'usuarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    nombre: text('nombre').notNull(),
    rol: text('rol').notNull(),
    // `boolean`, no `estado` de texto — mismo patrón que `sucursales_personal.manicuristas.activa`
    // (FL-SEG-05, 2026-08-23): ningún documento fija más de dos valores para este atributo.
    activa: boolean('activa').notNull().default(true),
    // Correlación con `auth.users.id` de Supabase (`DEC-021`). UNIQUE: impide que dos usuarios de
    // Blanc apunten a la misma cuenta de Supabase. NULLABLE: todo usuario nace sin cuenta —
    // `FL-SEG-01` no toca Supabase, la vinculación es posterior (`FL-SEG-06`); la ausencia es el
    // estado esperado, no un error. Sin FK: `auth.users` vive en otro sistema (ADR-005 ya prohíbe
    // FKs cruzadas incluso entre esquemas, aquí el cruce es aún más fuerte).
    supabaseUserId: uuid('supabase_user_id'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnico: uniqueIndex('usuarios_email_unico').on(table.email),
    supabaseUserIdUnico: uniqueIndex('usuarios_supabase_user_id_unico').on(table.supabaseUserId),
  }),
);

/**
 * `usuarios_sucursales` — relación muchos-a-muchos (`FL-SEG-04`, `01-domain-discovery.md` línea
 * 37: "posible lista de sucursales asignadas, aplicable a todos los roles salvo Super Admin").
 * `sucursal_id` es un identificador simple, sin FK cruzada (ADR-005) — `sucursales_personal` es
 * otro Bounded Context. Sin `id` propio, sin timestamps, sin soft delete — mismo patrón exacto
 * que `sucursales_personal.manicuristas_sucursales`, sin agregar nada por simetría no requerida.
 */
export const usuariosSucursales = identidadAccesosSchema.table(
  'usuarios_sucursales',
  {
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    sucursalId: uuid('sucursal_id').notNull(),
  },
  (table) => ({
    parUnico: uniqueIndex('usuarios_sucursales_par_unico').on(table.usuarioId, table.sucursalId),
  }),
);
