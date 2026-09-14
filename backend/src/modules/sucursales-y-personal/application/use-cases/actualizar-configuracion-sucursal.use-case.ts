import { Inject, Injectable } from '@nestjs/common';
import { SUCURSAL_REPOSITORY, SucursalRepository } from '../../domain/ports/sucursal.repository';
import { HorarioSemanalData } from '../../domain/value-objects/horario-semanal.vo';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { AccesoFueraDeAlcanceError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, tieneAlcanceSucursal } from '../../../../shared/auth/rol';
import { Sucursal } from '../../domain/entities/sucursal.entity';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface ActualizarConfiguracionSucursalInput {
  sucursalId: string;
  nombre?: string;
  numeroWhatsappAlias?: string | null;
  horarioSemanal?: HorarioSemanalData;
  descansos?: unknown;
}

/** Caso de uso — FL-SUC-01 (RN-SUC-01). Nivel 2 de RBAC (ADR-010): revalida alcance de sucursal. */
@Injectable()
export class ActualizarConfiguracionSucursalUseCase {
  constructor(
    @Inject(SUCURSAL_REPOSITORY) private readonly sucursalRepository: SucursalRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: ActualizarConfiguracionSucursalInput, actor: ClaimsUsuario): Promise<Sucursal> {
    const sucursal = await this.sucursalRepository.buscarPorId(input.sucursalId);
    if (!sucursal) throw new RecursoNoEncontradoError('Sucursal', input.sucursalId);

    if (!tieneAlcanceSucursal(actor, sucursal.id)) {
      throw new AccesoFueraDeAlcanceError();
    }

    sucursal.actualizarConfiguracion(input);

    await this.unitOfWork.ejecutar(async () => {
      await this.sucursalRepository.guardar(sucursal);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: sucursal.id,
        entidadAfectadaTipo: 'sucursal',
        entidadAfectadaId: sucursal.id,
        detalle: { accion: 'actualizar_configuracion_sucursal', campos: Object.keys(input).filter((k) => k !== 'sucursalId') },
      });
    });

    return sucursal;
  }
}
