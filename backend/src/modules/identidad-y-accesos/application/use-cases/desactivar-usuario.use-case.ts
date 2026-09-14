import { Inject, Injectable } from '@nestjs/common';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../domain/ports/usuario.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { DesactivacionNoPermitidaError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface DesactivarUsuarioInput {
  usuarioId: string;
}

/**
 * Caso de uso — FL-SEG-05, alcance mínimo (2026-08-23). Revoca únicamente el registro
 * administrativo de Blanc (`usuarios.activa = false`) — **no** invalida sesiones ni tokens ya
 * emitidos, no toca Supabase Auth (`FL-SEG-06`), no toca `usuarios_sucursales` (se conserva el
 * historial de asignación intacto). La autorización de nivel 2 por sucursal
 * (`tieneAlcanceSucursal`) no aplica: esta acción no opera sobre ninguna sucursal específica.
 *
 * Dos restricciones de autorización, confirmadas explícitamente para esta iteración (no
 * inferidas): nadie puede desactivarse a sí mismo (previene bloqueo administrativo accidental,
 * no es una medida anti-escalamiento); un actor no-Super-Admin no puede desactivar a un usuario
 * cuyo rol actual es Super Admin (mismo criterio de protección jerárquica ya confirmado en
 * `FL-SEG-03`, aplicado aquí sin una función compartida — solo hay un llamador hoy, extraerla
 * sería abstracción prematura).
 */
@Injectable()
export class DesactivarUsuarioUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarioRepository: UsuarioRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: DesactivarUsuarioInput, actor: ClaimsUsuario): Promise<void> {
    const usuario = await this.usuarioRepository.buscarPorId(input.usuarioId);
    if (!usuario) throw new RecursoNoEncontradoError('Usuario', input.usuarioId);

    if (actor.sub === usuario.id) {
      throw new DesactivacionNoPermitidaError('No puedes desactivar tu propia cuenta.');
    }

    if (usuario.rol === Rol.SUPER_ADMIN && actor.rol !== Rol.SUPER_ADMIN) {
      throw new DesactivacionNoPermitidaError('Solo un Super Admin puede desactivar a otro Super Admin.');
    }

    // Idempotente: ya estaba desactivado — no-op exitoso, sin volver a escribir ni auditar.
    if (!usuario.activa) return;

    usuario.desactivar();

    await this.unitOfWork.ejecutar(async () => {
      await this.usuarioRepository.guardar(usuario);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'usuario',
        entidadAfectadaId: usuario.id,
        detalle: { accion: 'desactivar_usuario' },
      });
    });
  }
}
