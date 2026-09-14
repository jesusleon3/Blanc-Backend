import { Module } from '@nestjs/common';
import { UsuariosController } from './infrastructure/http/usuarios.controller';
import { USUARIO_REPOSITORY } from './domain/ports/usuario.repository';
import { IDENTIDAD_EXTERNA_PORT } from './domain/ports/identidad-externa.port';
import { PERMISOS_USUARIO_PORT } from '../../shared/auth/permisos-usuario.port';
import { DrizzleUsuarioRepository } from './infrastructure/persistence/drizzle-usuario.repository';
import { SupabaseAdminIdentidadExternaAdapter } from './infrastructure/external/supabase-admin-identidad-externa.adapter';
import { CrearUsuarioUseCase } from './application/use-cases/crear-usuario.use-case';
import { EditarUsuarioCambiarRolUseCase } from './application/use-cases/editar-usuario-cambiar-rol.use-case';
import { AsignarUsuarioASucursalUseCase } from './application/use-cases/asignar-usuario-a-sucursal.use-case';
import { RemoverUsuarioDeSucursalUseCase } from './application/use-cases/remover-usuario-de-sucursal.use-case';
import { DesactivarUsuarioUseCase } from './application/use-cases/desactivar-usuario.use-case';
import { ProvisionarUsuarioUseCase } from './application/use-cases/provisionar-usuario.use-case';
import { resolverSupabaseUrl } from '../../shared/auth/supabase-url';
import { resolverSupabaseServiceRoleKey } from '../../shared/auth/supabase-service-role-key';

/**
 * Módulo NestJS del Bounded Context "Identidad y Accesos" (ADR-001, ADR-002) — frontera
 * explícita, expone únicamente sus casos de uso vía HTTP.
 *
 * Alcance actual (FL-SEG-01/03/04/05/06): alta, edición, asignación/remoción de sucursal,
 * desactivación del registro administrativo y provisionamiento de la identidad externa.
 * Deliberadamente sin: MFA (`FL-SEG-07`), reactivación, `permisos` dinámicos ni `refresh_tokens`
 * (ambos, `ADR-024`, no implementados), y sin la capa de autorización de `DEC-029` (C2), que
 * todavía no se implementa.
 *
 * `IDENTIDAD_EXTERNA_PORT` se resuelve aquí y no en un módulo compartido porque hoy solo este
 * contexto provisiona identidades; extraerlo antes de tener un segundo consumidor sería
 * abstracción prematura.
 */
@Module({
  controllers: [UsuariosController],
  providers: [
    { provide: USUARIO_REPOSITORY, useClass: DrizzleUsuarioRepository },
    // `DEC-029` (C2): el repositorio de este contexto satisface el puerto que la capa de
    // autorización transversal necesita. `useExisting` — misma instancia, no una copia.
    { provide: PERMISOS_USUARIO_PORT, useExisting: USUARIO_REPOSITORY },
    {
      provide: IDENTIDAD_EXTERNA_PORT,
      useFactory: () => new SupabaseAdminIdentidadExternaAdapter(resolverSupabaseUrl(), resolverSupabaseServiceRoleKey()),
    },
    CrearUsuarioUseCase,
    EditarUsuarioCambiarRolUseCase,
    AsignarUsuarioASucursalUseCase,
    RemoverUsuarioDeSucursalUseCase,
    DesactivarUsuarioUseCase,
    ProvisionarUsuarioUseCase,
  ],
  // `AuthModule` lo importa para cablear su guard de autorización (`DEC-029`).
  exports: [PERMISOS_USUARIO_PORT],
})
export class IdentidadYAccesosModule {}
