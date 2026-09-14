import { Inject, Injectable } from '@nestjs/common';
import { DiaFestivo } from '../../domain/entities/dia-festivo.entity';
import { SUCURSAL_REPOSITORY, SucursalRepository } from '../../domain/ports/sucursal.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { AccesoFueraDeAlcanceError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, tieneAlcanceSucursal } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface AgregarDiaFestivoInput {
  sucursalId: string;
  fecha: string;
  descripcion?: string;
}

/** Caso de uso — FL-SUC-01 (RN-SUC-01, RN-AGE-10 consume estos datos desde Fase 2). */
@Injectable()
export class AgregarDiaFestivoUseCase {
  constructor(
    @Inject(SUCURSAL_REPOSITORY) private readonly sucursalRepository: SucursalRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: AgregarDiaFestivoInput, actor: ClaimsUsuario): Promise<DiaFestivo> {
    const sucursal = await this.sucursalRepository.buscarPorId(input.sucursalId);
    if (!sucursal) throw new RecursoNoEncontradoError('Sucursal', input.sucursalId);

    if (!tieneAlcanceSucursal(actor, sucursal.id)) {
      throw new AccesoFueraDeAlcanceError();
    }

    const diaFestivo = DiaFestivo.crear(input);

    await this.unitOfWork.ejecutar(async () => {
      await this.sucursalRepository.agregarDiaFestivo(diaFestivo);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: sucursal.id,
        entidadAfectadaTipo: 'dia_festivo',
        entidadAfectadaId: diaFestivo.id,
        detalle: { accion: 'agregar_dia_festivo', fecha: diaFestivo.fecha },
      });
    });

    return diaFestivo;
  }
}
