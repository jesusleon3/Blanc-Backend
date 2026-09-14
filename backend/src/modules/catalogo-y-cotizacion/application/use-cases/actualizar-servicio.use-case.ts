import { Inject, Injectable } from '@nestjs/common';
import { Servicio } from '../../domain/entities/servicio.entity';
import { SERVICIO_REPOSITORY, ServicioRepository } from '../../domain/ports/servicio.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface ActualizarServicioInput {
  servicioId: string;
  nombre?: string;
  categoria?: string;
  duracionBaseMinutos?: number;
  precioBaseCentavos?: number;
}

/**
 * Caso de uso — `FL-COT-01` (edición del catálogo). Actualización **parcial**: solo se aplican los
 * campos presentes en el input.
 *
 * La revalidación no se repite aquí: `Servicio.actualizarDatos()` vuelve a pasar cada campo
 * provisto por `validarImporteEnCentavos()` y `validarDuracionEnMinutos()`, exactamente los mismos
 * validadores que usa `crear()`. Un precio no puede entrar por la puerta de la edición evitando la
 * regla que se le exige al alta (`RN-COT-07`).
 *
 * La auditoría registra **qué campos** cambiaron y el estado resultante de los campos sensibles:
 * en un catálogo del que salen los cobros, "alguien cambió el precio" sin decir a cuánto es un
 * registro inútil.
 */
@Injectable()
export class ActualizarServicioUseCase {
  constructor(
    @Inject(SERVICIO_REPOSITORY) private readonly servicioRepository: ServicioRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: ActualizarServicioInput, actor: ClaimsUsuario): Promise<Servicio> {
    const servicio = await this.servicioRepository.buscarPorId(input.servicioId);
    if (!servicio) throw new RecursoNoEncontradoError('Servicio', input.servicioId);

    const camposSolicitados = Object.keys(input).filter((campo) => campo !== 'servicioId');

    // Si algún campo es inválido, esto lanza ANTES de abrir la transacción — y la entidad en
    // memoria se descarta sin haber tocado la base.
    servicio.actualizarDatos(input);

    await this.unitOfWork.ejecutar(async () => {
      await this.servicioRepository.guardar(servicio);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'servicio',
        entidadAfectadaId: servicio.id,
        detalle: {
          accion: 'actualizar_servicio',
          campos: camposSolicitados,
          precioBaseCentavos: servicio.precioBaseCentavos,
          duracionBaseMinutos: servicio.duracionBaseMinutos,
        },
      });
    });

    return servicio;
  }
}
