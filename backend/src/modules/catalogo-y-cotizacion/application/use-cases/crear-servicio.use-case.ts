import { Inject, Injectable } from '@nestjs/common';
import { Servicio } from '../../domain/entities/servicio.entity';
import { SERVICIO_REPOSITORY, ServicioRepository } from '../../domain/ports/servicio.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface CrearServicioInput {
  nombre: string;
  categoria: string;
  duracionBaseMinutos: number;
  /** Importe en **centavos** enteros (`RN-COT-07`); la entidad lo valida. */
  precioBaseCentavos: number;
}

/**
 * Caso de uso — `FL-COT-01` (alta en el catálogo de servicios).
 *
 * La escritura y su registro de auditoría van en la **misma transacción** (`RN-AUD-01`): un
 * servicio nuevo sin rastro de quién lo dio de alta, o un rastro de un alta que nunca ocurrió,
 * serían igualmente inaceptables para un catálogo del que dependen los precios cobrados.
 */
@Injectable()
export class CrearServicioUseCase {
  constructor(
    @Inject(SERVICIO_REPOSITORY) private readonly servicioRepository: ServicioRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: CrearServicioInput, actor: ClaimsUsuario): Promise<Servicio> {
    const servicio = Servicio.crear(input);

    await this.unitOfWork.ejecutar(async () => {
      await this.servicioRepository.guardar(servicio);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'servicio',
        entidadAfectadaId: servicio.id,
        detalle: {
          accion: 'alta_servicio',
          nombre: servicio.nombre,
          categoria: servicio.categoria,
          duracionBaseMinutos: servicio.duracionBaseMinutos,
          precioBaseCentavos: servicio.precioBaseCentavos,
        },
      });
    });

    return servicio;
  }
}
