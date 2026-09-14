import { Inject, Injectable } from '@nestjs/common';
import { Usuario } from '../../domain/entities/usuario.entity';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../domain/ports/usuario.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { AsignacionDeRolNoPermitidaError, ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, puedeAsignarRol, Rol } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface EditarUsuarioCambiarRolInput {
  usuarioId: string;
  email?: string;
  nombre?: string;
  rol?: Rol;
}

/**
 * Caso de uso — FL-SEG-03 (alcance mínimo, pre-arranque de Identidad 2026-08-22). Edita datos
 * administrativos y/o el rol de un usuario ya existente. No toca sucursales (`FL-SEG-04`), no
 * toca Supabase (`FL-SEG-06`), no valida el invariante "al menos un Super Admin activo"
 * (evaluado y dejado fuera de esta iteración — ver `OWNER_DECISION_LOG.md`).
 */
@Injectable()
export class EditarUsuarioCambiarRolUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarioRepository: UsuarioRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: EditarUsuarioCambiarRolInput, actor: ClaimsUsuario): Promise<Usuario> {
    const usuario = await this.usuarioRepository.buscarPorId(input.usuarioId);
    if (!usuario) throw new RecursoNoEncontradoError('Usuario', input.usuarioId);

    const camposEditados: string[] = [];
    const rolAnterior = usuario.rol;

    if (input.rol !== undefined && input.rol !== usuario.rol) {
      const actorEsElObjetivo = actor.sub === usuario.id;
      if (!puedeAsignarRol(actor, actorEsElObjetivo, usuario.rol, input.rol)) {
        throw new AsignacionDeRolNoPermitidaError();
      }
      usuario.cambiarRol(input.rol);
      camposEditados.push('rol');
    }

    if (input.email !== undefined && input.email.trim() !== usuario.email) {
      const existente = await this.usuarioRepository.buscarPorEmail(input.email.trim());
      if (existente && existente.id !== usuario.id) {
        throw new ConflictoDeNegocioError('USUARIO_EMAIL_DUPLICADO', `Ya existe un usuario con el email "${input.email}".`, {
          email: input.email,
        });
      }
      camposEditados.push('email');
    }

    if (input.nombre !== undefined && input.nombre.trim() !== usuario.nombre) {
      camposEditados.push('nombre');
    }

    usuario.actualizarDatos({ email: input.email, nombre: input.nombre });

    if (camposEditados.length === 0) return usuario;

    await this.unitOfWork.ejecutar(async () => {
      await this.usuarioRepository.guardar(usuario);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'usuario',
        entidadAfectadaId: usuario.id,
        // Sin email en texto plano (punto G) — solo qué campos cambiaron y, si aplica, el rol.
        detalle: {
          accion: 'editar_usuario',
          camposEditados,
          ...(camposEditados.includes('rol') ? { rolAnterior, rolNuevo: usuario.rol } : {}),
        },
      });
    });

    return usuario;
  }
}
