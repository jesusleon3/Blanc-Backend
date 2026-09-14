import { Inject, Injectable } from '@nestjs/common';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../domain/ports/usuario.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { AccesoFueraDeAlcanceError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, tieneAlcanceSucursal } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface AsignarUsuarioASucursalInput {
  usuarioId: string;
  sucursalId: string;
}

/**
 * Caso de uso — FL-SEG-04. Nivel 2 de RBAC (ADR-010): revalida alcance de sucursal sobre la
 * sucursal objetivo — cubre también la auto-asignación (`actor` y usuario objetivo pueden
 * coincidir, `tieneAlcanceSucursal` no distingue). No verifica que `sucursalId` exista: es un
 * identificador simple sin FK cruzada (ADR-005) — `sucursales_personal` es otro Bounded Context
 * y este módulo no depende de su repositorio (ver reporte de cierre de esta iteración).
 */
@Injectable()
export class AsignarUsuarioASucursalUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarioRepository: UsuarioRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: AsignarUsuarioASucursalInput, actor: ClaimsUsuario): Promise<void> {
    const usuario = await this.usuarioRepository.buscarPorId(input.usuarioId);
    if (!usuario) throw new RecursoNoEncontradoError('Usuario', input.usuarioId);

    if (!tieneAlcanceSucursal(actor, input.sucursalId)) {
      throw new AccesoFueraDeAlcanceError();
    }

    await this.unitOfWork.ejecutar(async () => {
      await this.usuarioRepository.asignarASucursal(input.usuarioId, input.sucursalId);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: input.sucursalId,
        entidadAfectadaTipo: 'usuario_sucursal',
        entidadAfectadaId: input.usuarioId,
        detalle: { accion: 'asignar_usuario_a_sucursal', sucursalId: input.sucursalId },
      });
    });
  }
}
