export const IDENTIDAD_EXTERNA_PORT = 'IDENTIDAD_EXTERNA_PORT';

export interface CuentaExternaCreada {
  /** `auth.users.id` de Supabase — el mismo identificador que viajará como `sub` en sus JWT. */
  id: string;
}

/**
 * Puerto de dominio (ADR-002, Hexagonal) hacia el proveedor externo de identidad. La
 * implementación vive en `infrastructure/external/`.
 *
 * Alcance deliberadamente mínimo (`DEC-025`: "Solo Provisionar"): una sola operación, crear la
 * cuenta. No expone login, ni invitación, ni revocación, ni búsqueda — nada de eso pertenece a
 * `FL-SEG-06`. El puerto se llama "identidad externa" y no "Supabase" a propósito: el dominio no
 * debe conocer al proveedor concreto.
 */
export interface IdentidadExternaPort {
  /**
   * Crea una cuenta de acceso para el email dado y devuelve su identificador.
   *
   * Sin contraseña (`DEC-028`): la persona no queda autenticable con esta operación, solo
   * provisionada. Establecer credenciales es un flujo posterior, fuera de `FL-SEG-06`.
   */
  crearCuenta(input: { email: string }): Promise<CuentaExternaCreada>;
}
