import { Inject, Injectable } from '@nestjs/common';
import { Sucursal } from '../../domain/entities/sucursal.entity';
import { SUCURSAL_REPOSITORY, SucursalRepository } from '../../domain/ports/sucursal.repository';
import { HorarioSemanalData } from '../../domain/value-objects/horario-semanal.vo';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface CrearSucursalInput {
  nombre: string;
  numeroWhatsappAlias?: string;
  horarioSemanal: HorarioSemanalData;
  descansos?: unknown;
}

/** Caso de uso — FL-SUC-01 (Configurar Horario y Festivos de Sucursal, RN-SUC-01). */
@Injectable()
export class CrearSucursalUseCase {
  constructor(
    @Inject(SUCURSAL_REPOSITORY) private readonly sucursalRepository: SucursalRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: CrearSucursalInput, actor: ClaimsUsuario): Promise<Sucursal> {
    const existente = await this.sucursalRepository.buscarPorNombre(input.nombre.trim());
    if (existente) {
      throw new ConflictoDeNegocioError('SUCURSAL_NOMBRE_DUPLICADO', `Ya existe una sucursal con el nombre "${input.nombre}".`, { nombre: input.nombre });
    }

    const sucursal = Sucursal.crear(input);

    await this.unitOfWork.ejecutar(async () => {
      await this.sucursalRepository.guardar(sucursal);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: sucursal.id,
        entidadAfectadaTipo: 'sucursal',
        entidadAfectadaId: sucursal.id,
        detalle: { accion: 'crear_sucursal', nombre: sucursal.nombre },
      });
    });

    return sucursal;
  }
}
