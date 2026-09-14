import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { Database } from '../../../../database/connection';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { usuarios, usuariosSucursales } from '../../../../database/schema';
import { Usuario } from '../../domain/entities/usuario.entity';
import { UsuarioRepository } from '../../domain/ports/usuario.repository';
import { Rol } from '../../../../shared/auth/rol';
import { PermisosUsuario } from '../../../../shared/auth/permisos-usuario.port';
import { resolverAlcanceSucursales } from '../../domain/alcance-por-defecto';
import { TransactionContext } from '../../../../shared/persistence/transaction-context';
import { esViolacionDeUnicidad } from '../../../../shared/errors/postgres-error';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';

@Injectable()
export class DrizzleUsuarioRepository implements UsuarioRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly dbPorDefecto: Database) {}

  private get db(): Database {
    return TransactionContext.obtenerConexionActiva() ?? this.dbPorDefecto;
  }

  async guardar(usuario: Usuario): Promise<void> {
    try {
      await this.db
        .insert(usuarios)
        .values({
          id: usuario.id,
          email: usuario.email,
          nombre: usuario.nombre,
          rol: usuario.rol,
          activa: usuario.activa,
          actualizadoEn: new Date(),
        })
        .onConflictDoUpdate({
          target: usuarios.id,
          set: {
            email: usuario.email,
            nombre: usuario.nombre,
            rol: usuario.rol,
            activa: usuario.activa,
            actualizadoEn: new Date(),
          },
        });
    } catch (error) {
      // `onConflictDoUpdate` solo cubre conflictos en `id` (upsert) — un choque en la restricción
      // UNIQUE de `email` (otro usuario con el mismo email) sigue llegando aquí crudo. El caso de
      // uso ya valida esto antes (`CrearUsuarioUseCase.buscarPorEmail`); este catch es el
      // backstop de base de datos contra la misma condición de carrera (TOCTOU).
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictoDeNegocioError('USUARIO_EMAIL_DUPLICADO', `Ya existe un usuario con el email "${usuario.email}".`, {
          email: usuario.email,
        });
      }
      throw error;
    }
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    const filas = await this.db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
    if (filas.length === 0) return null;
    return this.aEntidad(filas[0]);
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const filas = await this.db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
    if (filas.length === 0) return null;
    return this.aEntidad(filas[0]);
  }

  async asignarASucursal(usuarioId: string, sucursalId: string): Promise<void> {
    try {
      await this.db.insert(usuariosSucursales).values({ usuarioId, sucursalId });
    } catch (error) {
      // Backstop de base de datos contra la condición de carrera (TOCTOU) — la restricción
      // UNIQUE es la única autoridad contra duplicados en este flujo (ver reporte de cierre).
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictoDeNegocioError('USUARIO_YA_ASIGNADO', 'El usuario ya está asignado a esta sucursal.', { usuarioId, sucursalId });
      }
      throw error;
    }
  }

  /** Mismo comportamiento que `DrizzleManicuristaRepository.removerDeSucursal()`: un `DELETE`
   * sobre un par inexistente no falla, simplemente no afecta ninguna fila (idempotente por
   * naturaleza del SQL, sin necesidad de una verificación previa). */
  async removerDeSucursal(usuarioId: string, sucursalId: string): Promise<void> {
    await this.db
      .delete(usuariosSucursales)
      .where(and(eq(usuariosSucursales.usuarioId, usuarioId), eq(usuariosSucursales.sucursalId, sucursalId)));
  }

  /**
   * FL-SEG-06 (`DEC-028`) — guardia de concurrencia en la propia sentencia: `AND supabase_user_id
   * IS NULL`. Si dos administradores provisionan a la vez, solo uno afecta filas; el otro recibe
   * `false` y el caso de uso decide qué hacer. `returning()` permite contar las filas afectadas
   * sin una consulta previa, que sería susceptible a la misma carrera (TOCTOU).
   *
   * Alcance de esta protección: cubre el lado de Blanc. **No evita** que el perdedor haya dejado
   * una cuenta huérfana en Supabase — eso es inherente a la ausencia de atomicidad cross-system
   * y su recuperación depende de la política de adopción, todavía `PENDING` (`DEC-028`).
   */
  async vincularCuentaExterna(usuarioId: string, supabaseUserId: string): Promise<boolean> {
    const filas = await this.db
      .update(usuarios)
      .set({ supabaseUserId, actualizadoEn: new Date() })
      .where(and(eq(usuarios.id, usuarioId), isNull(usuarios.supabaseUserId)))
      .returning({ id: usuarios.id });

    return filas.length > 0;
  }

  /**
   * `DEC-029` (C2) — lectura de autorización, en el camino caliente de cada petición.
   *
   * Dos consultas simples e indexadas (`supabase_user_id` es UNIQUE; el par de
   * `usuarios_sucursales` también). Se resuelve una vez por petición: el guard escribe el
   * resultado en `request.usuario` y todo lo posterior lee de memoria. No hay cache — sería
   * infraestructura especulativa (`IMPLEMENTATION_MASTER_PLAN.md`, principio 1); el punto de
   * inserción, si algún día hiciera falta, es el guard, no aquí.
   *
   * La traducción de filas a alcance vive en `resolverAlcanceSucursales()`, única función que
   * decide ese valor (`IDENTIDAD_PRE_ARRANQUE.md` §4, Pregunta 11 todavía abierta).
   */
  async obtenerPermisosPorSupabaseUserId(supabaseUserId: string): Promise<PermisosUsuario | null> {
    const filas = await this.db
      .select({ id: usuarios.id, rol: usuarios.rol, activa: usuarios.activa })
      .from(usuarios)
      .where(eq(usuarios.supabaseUserId, supabaseUserId))
      .limit(1);

    if (filas.length === 0) return null;
    const usuario = filas[0];

    const asignadas = await this.db
      .select({ sucursalId: usuariosSucursales.sucursalId })
      .from(usuariosSucursales)
      .where(eq(usuariosSucursales.usuarioId, usuario.id));

    const rol = usuario.rol as Rol;
    return {
      rol,
      activa: usuario.activa,
      sucursales: resolverAlcanceSucursales(
        rol,
        asignadas.map((fila) => fila.sucursalId),
      ),
    };
  }

  private aEntidad(fila: typeof usuarios.$inferSelect): Usuario {
    return Usuario.reconstruir({
      id: fila.id,
      email: fila.email,
      nombre: fila.nombre,
      rol: fila.rol as Rol,
      activa: fila.activa,
      supabaseUserId: fila.supabaseUserId,
    });
  }
}
