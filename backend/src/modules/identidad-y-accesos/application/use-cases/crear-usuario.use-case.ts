import { Inject, Injectable } from '@nestjs/common';
import { Usuario } from '../../domain/entities/usuario.entity';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../domain/ports/usuario.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { AsignacionDeRolNoPermitidaError, ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, puedeAsignarRol, Rol } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface CrearUsuarioInput {
  email: string;
  nombre: string;
  rol: Rol;
}

/**
 * Caso de uso — FL-SEG-01 (alcance mínimo, pre-arranque de Identidad 2026-08-22). Crea
 * únicamente el registro administrativo en `identidad_accesos.usuarios`. No integra, invita ni
 * sincroniza con Supabase Auth — eso es `FL-SEG-06`, deliberadamente fuera de este caso de uso
 * (ver `ADR-024` y el reporte de cierre de esta iteración). No acepta sucursales — esa relación
 * es `FL-SEG-04`, también fuera de alcance.
 */
@Injectable()
export class CrearUsuarioUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarioRepository: UsuarioRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: CrearUsuarioInput, actor: ClaimsUsuario): Promise<Usuario> {
    if (!puedeAsignarRol(actor, false, null, input.rol)) {
      throw new AsignacionDeRolNoPermitidaError('Solo un Super Admin puede asignar el rol Super Admin.');
    }

    const existente = await this.usuarioRepository.buscarPorEmail(input.email.trim());
    if (existente) {
      throw new ConflictoDeNegocioError('USUARIO_EMAIL_DUPLICADO', `Ya existe un usuario con el email "${input.email}".`, {
        email: input.email,
      });
    }

    const usuario = Usuario.crear(input);

    await this.unitOfWork.ejecutar(async () => {
      await this.usuarioRepository.guardar(usuario);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'usuario',
        entidadAfectadaId: usuario.id,
        // RN-AUD-01 + minimización de datos personales: nunca el email en `detalle`, ver
        // reporte de cierre de esta iteración (punto G) — el email se resuelve por consulta a
        // `usuarios`, no se duplica en el log de auditoría de retención indefinida.
        detalle: { accion: 'alta_usuario', rol: usuario.rol },
      });
    });

    return usuario;
  }
}
