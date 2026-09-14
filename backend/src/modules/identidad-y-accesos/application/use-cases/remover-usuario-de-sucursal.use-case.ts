import { Inject, Injectable } from '@nestjs/common';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../domain/ports/usuario.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { AccesoFueraDeAlcanceError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, tieneAlcanceSucursal } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface RemoverUsuarioDeSucursalInput {
  usuarioId: string;
  sucursalId: string;
}

/**
 * Caso de uso — FL-SEG-04. Nivel 2 de RBAC sobre la sucursal objetivo, mismo criterio que
 * `AsignarUsuarioASucursalUseCase`. Sin verificación de existencia de usuario/asignación previa
 * — mismo precedente exacto que `RemoverManicuristaDeSucursalUseCase`: un `DELETE` sobre un par
 * inexistente no es un error, es un no-op (ver reporte de cierre de esta iteración).
 */
@Injectable()
export class RemoverUsuarioDeSucursalUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarioRepository: UsuarioRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: RemoverUsuarioDeSucursalInput, actor: ClaimsUsuario): Promise<void> {
    if (!tieneAlcanceSucursal(actor, input.sucursalId)) {
      throw new AccesoFueraDeAlcanceError();
    }

    await this.unitOfWork.ejecutar(async () => {
      await this.usuarioRepository.removerDeSucursal(input.usuarioId, input.sucursalId);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: input.sucursalId,
        entidadAfectadaTipo: 'usuario_sucursal',
        entidadAfectadaId: input.usuarioId,
        detalle: { accion: 'remover_usuario_de_sucursal', sucursalId: input.sucursalId },
      });
    });
  }
}
