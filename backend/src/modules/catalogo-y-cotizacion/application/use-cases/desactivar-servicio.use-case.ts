import { Inject, Injectable } from '@nestjs/common';
import { SERVICIO_REPOSITORY, ServicioRepository } from '../../domain/ports/servicio.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface DesactivarServicioInput {
  servicioId: string;
}

/**
 * Caso de uso — `FL-COT-01` (baja del catálogo).
 *
 * **Baja lógica, nunca borrado.** Un servicio retirado sigue apareciendo en las citas que ya se
 * cotizaron con él; borrarlo falsearía el historial y dejaría cotizaciones apuntando a la nada.
 *
 * **Idempotente** (mismo criterio que `DesactivarUsuarioUseCase`): desactivar un servicio ya
 * inactivo no falla — el resultado deseado por el llamador ya se cumple. Sí se audita de nuevo,
 * porque el registro de auditoría documenta *intentos de cambio de configuración*, no solo
 * transiciones efectivas.
 *
 * **No se verifica si el servicio está en uso.** No hay nada contra qué verificar: Agenda es
 * Fase 2 y no existe ninguna cita todavía. Cuando exista, ese módulo decidirá cómo reacciona a
 * esta baja — no se diseña ni se asume aquí.
 */
@Injectable()
export class DesactivarServicioUseCase {
  constructor(
    @Inject(SERVICIO_REPOSITORY) private readonly servicioRepository: ServicioRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: DesactivarServicioInput, actor: ClaimsUsuario): Promise<void> {
    const servicio = await this.servicioRepository.buscarPorId(input.servicioId);
    if (!servicio) throw new RecursoNoEncontradoError('Servicio', input.servicioId);

    servicio.desactivar();

    await this.unitOfWork.ejecutar(async () => {
      await this.servicioRepository.guardar(servicio);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'servicio',
        entidadAfectadaId: servicio.id,
        detalle: { accion: 'baja_servicio' },
      });
    });
  }
}
