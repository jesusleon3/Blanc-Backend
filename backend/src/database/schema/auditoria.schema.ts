/**
 * Esquema Drizzle — esquema transversal `auditoria` (04-data-model.md §3, §4.3).
 * Sin Bounded Context dueño — registra acciones de todos los contextos (ADR-010, RN-AUD-01).
 */
import { jsonb, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const auditoriaSchema = pgSchema('auditoria');

/**
 * `log_auditoria` — de solo-anexado (RN-AUD-01): la aplicación nunca emite UPDATE/DELETE
 * contra esta tabla, solo INSERT (reforzado en el repositorio, Sección Infrastructure).
 * `entidadAfectada`: referencia simple (tipo + id), nunca FK — puede apuntar a cualquier esquema.
 */
export const logAuditoria = auditoriaSchema.table('log_auditoria', {
  id: uuid('id').primaryKey().defaultRandom(),
  tipoAccion: text('tipo_accion').notNull(),
  actor: text('actor').notNull(),
  sucursalRelacionada: uuid('sucursal_relacionada'),
  entidadAfectadaTipo: text('entidad_afectada_tipo').notNull(),
  entidadAfectadaId: uuid('entidad_afectada_id').notNull(),
  detalle: jsonb('detalle'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
});
