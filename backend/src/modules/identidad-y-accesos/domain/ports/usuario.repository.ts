import { Usuario } from '../entities/usuario.entity';
import { PermisosUsuario } from '../../../../shared/auth/permisos-usuario.port';

export const USUARIO_REPOSITORY = 'USUARIO_REPOSITORY';

/** Puerto de dominio (ADR-002, Hexagonal) — la infraestructura Drizzle lo implementa. */
export interface UsuarioRepository {
  guardar(usuario: Usuario): Promise<void>;
  buscarPorId(id: string): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;

  /** FL-SEG-04 — sin método de consulta de duplicado: la restricción UNIQUE de la tabla es la
   * única autoridad contra asignaciones repetidas (ver reporte de cierre de esta iteración). */
  asignarASucursal(usuarioId: string, sucursalId: string): Promise<void>;
  removerDeSucursal(usuarioId: string, sucursalId: string): Promise<void>;

  /**
   * FL-SEG-06 — persiste el vínculo con la cuenta de Supabase, con guardia de concurrencia
   * (`DEC-028`): el `UPDATE` solo afecta la fila si `supabase_user_id` sigue siendo `NULL`.
   *
   * Devuelve `true` si el vínculo quedó escrito por esta llamada, `false` si otra ejecución ganó
   * la carrera y la fila ya tenía vínculo. Es deliberadamente un booleano y no `void`: el caso de
   * uso necesita distinguir ambos desenlaces, y esa distinción no puede inferirse de otra forma.
   *
   * No es un método de escritura genérico (`guardar` no sirve aquí): `guardar` haría un upsert
   * incondicional y machacaría el vínculo de quien ganara la carrera.
   */
  vincularCuentaExterna(usuarioId: string, supabaseUserId: string): Promise<boolean>;

  /**
   * `DEC-029` (C2) — resuelve `JWT.sub` → permisos vigentes. Devuelve `null` si ninguna fila
   * referencia esa cuenta de Supabase (usuario autenticado pero no provisionado en Blanc).
   *
   * Implementa `PermisosUsuarioPort` (`shared/auth/permisos-usuario.port.ts`): el guard de
   * autorización consume esa interfaz, no este repositorio.
   */
  obtenerPermisosPorSupabaseUserId(supabaseUserId: string): Promise<PermisosUsuario | null>;
}
