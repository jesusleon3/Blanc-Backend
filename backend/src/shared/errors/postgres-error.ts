/**
 * Traducción PostgreSQL → dominio (ADR-013, categoría 1: error de dominio esperado). Vive en
 * Infrastructure — Domain/Application nunca importan esto ni conocen códigos SQLSTATE; solo ven
 * `ConflictoDeNegocioError` (`shared/errors/domain-error.ts`).
 *
 * Únicamente `23505` (`unique_violation`) se traduce aquí: es la única violación de constraint
 * que este módulo puede producir hoy (`sucursales.nombre`, `manicuristas_sucursales` UNIQUE) y
 * que representa un conflicto de negocio ya conocido, no un error inesperado. Cualquier otro
 * código Postgres se re-lanza sin tocar — cae en la categoría 3 de ADR-013 (inesperado) por
 * defecto en `HttpExceptionFilter`, que es el comportamiento correcto para algo no anticipado.
 */
export function esViolacionDeUnicidad(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';
}
