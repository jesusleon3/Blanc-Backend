import { Inject, Injectable } from '@nestjs/common';
import { MANICURISTA_REPOSITORY, ManicuristaRepository } from '../../domain/ports/manicurista.repository';
import { SUCURSAL_REPOSITORY, SucursalRepository } from '../../domain/ports/sucursal.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface AsignarManicuristaASucursalInput {
  manicuristaId: string;
  sucursalId: string;
}

/**
 * Caso de uso — FL-SUC-03. `01-domain-discovery.md` usa explícitamente "sucursal(es)" en
 * plural para esta entidad: una manicurista puede pertenecer a más de una sucursal.
 */
@Injectable()
export class AsignarManicuristaASucursalUseCase {
  constructor(
    @Inject(MANICURISTA_REPOSITORY) private readonly manicuristaRepository: ManicuristaRepository,
    @Inject(SUCURSAL_REPOSITORY) private readonly sucursalRepository: SucursalRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: AsignarManicuristaASucursalInput, actor: ClaimsUsuario): Promise<void> {
    const manicurista = await this.manicuristaRepository.buscarPorId(input.manicuristaId);
    if (!manicurista) throw new RecursoNoEncontradoError('Manicurista', input.manicuristaId);

    const sucursal = await this.sucursalRepository.buscarPorId(input.sucursalId);
    if (!sucursal) throw new RecursoNoEncontradoError('Sucursal', input.sucursalId);

    const yaAsignada = await this.manicuristaRepository.estaAsignadaASucursal(input.manicuristaId, input.sucursalId);
    if (yaAsignada) {
      throw new ConflictoDeNegocioError('MANICURISTA_YA_ASIGNADA', 'La manicurista ya está asignada a esta sucursal.', { ...input });
    }

    await this.unitOfWork.ejecutar(async () => {
      await this.manicuristaRepository.asignarASucursal(input.manicuristaId, input.sucursalId);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: sucursal.id,
        entidadAfectadaTipo: 'manicurista_sucursal',
        entidadAfectadaId: manicurista.id,
        detalle: { accion: 'asignar_manicurista_a_sucursal', sucursalId: sucursal.id },
      });
    });
  }
}
