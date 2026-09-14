/**
 * Error de dominio con código de negocio identificable (05-api-design.md §2/§9) — nunca un
 * error genérico. Cada módulo define sus propios códigos al implementar sus casos de uso.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class RecursoNoEncontradoError extends DomainError {
  constructor(recurso: string, id: string) {
    super('RECURSO_NO_ENCONTRADO', `${recurso} con id "${id}" no existe.`, 404, { recurso, id });
  }
}

export class ConflictoDeNegocioError extends DomainError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, 409, details);
  }
}

/** Nivel 2 de RBAC (ADR-010): el actor está autenticado y tiene un rol válido, pero no alcance sobre el recurso solicitado. */
export class AccesoFueraDeAlcanceError extends DomainError {
  constructor(mensaje = 'No tienes alcance sobre este recurso.', details?: Record<string, unknown>) {
    super('FUERA_DE_ALCANCE_DE_SUCURSAL', mensaje, 403, details);
  }
}

/** Nivel 2 de RBAC (ADR-010): la asignación de rol viola `puedeAsignarRol()` (FL-SEG-01/03) — auto-edición o jerarquía de Super Admin. */
export class AsignacionDeRolNoPermitidaError extends DomainError {
  constructor(mensaje = 'No tienes permiso para asignar ese rol.', details?: Record<string, unknown>) {
    super('ASIGNACION_DE_ROL_NO_PERMITIDA', mensaje, 403, details);
  }
}

/** Nivel 2 de RBAC (ADR-010, FL-SEG-05): auto-desactivación o jerarquía de Super Admin. */
export class DesactivacionNoPermitidaError extends DomainError {
  constructor(mensaje = 'No tienes permiso para desactivar este usuario.', details?: Record<string, unknown>) {
    super('DESACTIVACION_NO_PERMITIDA', mensaje, 403, details);
  }
}
