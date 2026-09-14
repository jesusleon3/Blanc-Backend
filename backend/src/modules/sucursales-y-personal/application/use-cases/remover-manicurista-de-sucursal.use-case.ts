import { Inject, Injectable } from '@nestjs/common';
import { MANICURISTA_REPOSITORY, ManicuristaRepository } from '../../domain/ports/manicurista.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface RemoverManicuristaDeSucursalInput {
  manicuristaId: string;
  sucursalId: string;
}

/** Caso de uso — FL-SUC-03. */
@Injectable()
export class RemoverManicuristaDeSucursalUseCase {
  constructor(
    @Inject(MANICURISTA_REPOSITORY) private readonly manicuristaRepository: ManicuristaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: RemoverManicuristaDeSucursalInput, actor: ClaimsUsuario): Promise<void> {
    await this.unitOfWork.ejecutar(async () => {
      await this.manicuristaRepository.removerDeSucursal(input.manicuristaId, input.sucursalId);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: input.sucursalId,
        entidadAfectadaTipo: 'manicurista_sucursal',
        entidadAfectadaId: input.manicuristaId,
        detalle: { accion: 'remover_manicurista_de_sucursal', sucursalId: input.sucursalId },
      });
    });
  }
}
