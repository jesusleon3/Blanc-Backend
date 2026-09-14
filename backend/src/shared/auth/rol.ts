/**
 * Los 7 roles de RN-SEG-01 (10-identidad-seguridad.md), catálogo cerrado (functional-scope.md §2).
 */
export enum Rol {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMINISTRADOR = 'ADMINISTRADOR',
  GERENTE = 'GERENTE',
  RECEPCIONISTA = 'RECEPCIONISTA',
  MANICURISTA = 'MANICURISTA',
  ANALISTA = 'ANALISTA',
  SOLO_LECTURA = 'SOLO_LECTURA',
}

/** Alcance de sucursales de un usuario — forma del claim (05-api-design.md §6). */
export type AlcanceSucursales = 'GLOBAL' | string[];

/**
 * Identidad autenticada: lo único que `JwtAuthGuard` puede afirmar tras verificar la firma
 * (`DEC-029`). Responde "quién eres", no "qué puedes hacer" — un JWT legítimo de Supabase no
 * trae rol ni sucursales, y eso no lo hace menos válido.
 */
export interface IdentidadAutenticada {
  sub: string;
}

/**
 * Identidad **autorizada**: la anterior, enriquecida por `AuthorizationGuard` con los permisos
 * leídos de PostgreSQL, la fuente de verdad (`DEC-024`). Es lo que consumen `RolesGuard` y los
 * casos de uso.
 */
export interface ClaimsUsuario extends IdentidadAutenticada {
  rol: Rol;
  sucursales: AlcanceSucursales;
}

/** Un usuario con alcance GLOBAL, o con la sucursal solicitada en su lista, tiene acceso. */
export function tieneAlcanceSucursal(claims: ClaimsUsuario, sucursalId: string): boolean {
  if (claims.rol === Rol.SUPER_ADMIN) return true;
  if (claims.sucursales === 'GLOBAL') return true;
  return claims.sucursales.includes(sucursalId);
}

/**
 * Nivel 2 de RBAC para asignación de rol (ADR-010) — evita escalamiento de privilegios al dar de
 * alta o editar un usuario (FL-SEG-01/03, pre-arranque de Identidad 2026-08-22). Tres reglas,
 * sin excepción, sin matriz de permisos dinámica:
 * 1. Nadie cambia su propio rol (ni siquiera Super Admin).
 * 2. Solo Super Admin puede asignar el rol Super Admin.
 * 3. Un actor no-Super-Admin no puede cambiar el rol de un usuario que hoy es Super Admin.
 *
 * `rolActualDelObjetivo` es `null` en alta (no hay usuario existente todavía). No cubre "al menos
 * un Super Admin debe permanecer activo" ni "Administrador no puede editar ningún otro dato de un
 * Super Admin" — ambos evaluados y dejados fuera de esta iteración, ver `OWNER_DECISION_LOG.md`
 * y el reporte de cierre de esta iteración.
 */
export function puedeAsignarRol(
  actor: ClaimsUsuario,
  actorEsElObjetivo: boolean,
  rolActualDelObjetivo: Rol | null,
  rolNuevo: Rol,
): boolean {
  if (actorEsElObjetivo) return false;
  if (rolNuevo === Rol.SUPER_ADMIN && actor.rol !== Rol.SUPER_ADMIN) return false;
  if (rolActualDelObjetivo === Rol.SUPER_ADMIN && actor.rol !== Rol.SUPER_ADMIN) return false;
  return true;
}
