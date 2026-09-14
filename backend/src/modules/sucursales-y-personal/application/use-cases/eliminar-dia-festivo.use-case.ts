import { Inject, Injectable } from '@nestjs/common';
import { SUCURSAL_REPOSITORY, SucursalRepository } from '../../domain/ports/sucursal.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { AccesoFueraDeAlcanceError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, tieneAlcanceSucursal } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface EliminarDiaFestivoInput {
  id: string;
}

/** Caso de uso — FL-SUC-01 (RN-SUC-01). */
@Injectable()
export class EliminarDiaFestivoUseCase {
  constructor(
    @Inject(SUCURSAL_REPOSITORY) private readonly sucursalRepository: SucursalRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: EliminarDiaFestivoInput, actor: ClaimsUsuario): Promise<void> {
    const diaFestivo = await this.sucursalRepository.buscarDiaFestivoPorId(input.id);
    if (!diaFestivo) throw new RecursoNoEncontradoError('DiaFestivo', input.id);

    if (!tieneAlcanceSucursal(actor, diaFestivo.sucursalId)) {
      throw new AccesoFueraDeAlcanceError();
    }

    await this.unitOfWork.ejecutar(async () => {
      await this.sucursalRepository.eliminarDiaFestivo(input.id);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: diaFestivo.sucursalId,
        entidadAfectadaTipo: 'dia_festivo',
        entidadAfectadaId: input.id,
        detalle: { accion: 'eliminar_dia_festivo' },
      });
    });
  }
}
