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

/**
 * `23P01` (`exclusion_violation`) — lo emiten las restricciones `EXCLUDE USING gist` de
 * `agenda.citas` (migración `0005`). Es el invariante anti-doble-booking saltando: alguien
 * intentó ocupar una silla o una manicurista que ya estaban comprometidas en ese rango.
 *
 * Es un conflicto de negocio **esperado**, no un fallo: la condición de carrera que esta
 * restricción existe para atrapar ocurre cuando dos reservas llegan a la vez y ambas pasaron la
 * comprobación previa de disponibilidad. Por eso se traduce a `ConflictoDeNegocioError` (409) y
 * nunca sale el SQLSTATE crudo.
 */
export function esViolacionDeExclusion(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23P01';
}

/** Distingue cuál de las dos restricciones de exclusión saltó, para dar un error accionable. */
export function nombreDeRestriccion(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const nombre = (error as { constraint_name?: unknown; constraint?: unknown }).constraint_name ?? (error as { constraint?: unknown }).constraint;
  return typeof nombre === 'string' ? nombre : undefined;
}
