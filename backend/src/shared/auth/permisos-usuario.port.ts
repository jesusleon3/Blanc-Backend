import { AlcanceSucursales, Rol } from './rol';

export const PERMISOS_USUARIO_PORT = 'PERMISOS_USUARIO_PORT';

/** Estado de autorización de un usuario, leído de la fuente de verdad (`DEC-024`). */
export interface PermisosUsuario {
  rol: Rol;
  activa: boolean;
  sucursales: AlcanceSucursales;
}

/**
 * Puerto que la capa de autorización (`DEC-029`, C2) necesita para resolver
 * `JWT.sub` → permisos reales de Blanc.
 *
 * Vive en `shared/auth` porque es el consumidor quien define lo que necesita (inversión de
 * dependencias, ADR-002): el guard no conoce al módulo de Identidad ni a Drizzle, solo esta
 * interfaz. El binding concreto lo aporta `IdentidadYAccesosModule`, dueño de esos datos.
 */
export interface PermisosUsuarioPort {
  /**
   * Devuelve los permisos del usuario vinculado a esa cuenta de Supabase, o `null` si ninguna
   * fila de `identidad_accesos.usuarios` la referencia — es decir, si el usuario autenticado no
   * está provisionado en Blanc (`FL-SEG-06`).
   */
  obtenerPermisosPorSupabaseUserId(supabaseUserId: string): Promise<PermisosUsuario | null>;
}
