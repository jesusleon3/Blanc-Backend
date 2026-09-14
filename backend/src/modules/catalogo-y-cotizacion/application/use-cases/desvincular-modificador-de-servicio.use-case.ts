import { Inject, Injectable } from '@nestjs/common';
import { SERVICIO_REPOSITORY, ServicioRepository } from '../../domain/ports/servicio.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface DesvincularModificadorDeServicioInput {
  servicioId: string;
  modificadorId: string;
}

/**
 * Caso de uso — `FL-COT-01` (deshabilitar un modificador para un servicio).
 *
 * ASIMETRÍA DELIBERADA CON `VincularModificadorAServicioUseCase`:
 *
 * - **No exige que los dos lados estén activos.** Retirar un vínculo de un servicio dado de baja
 *   es exactamente el tipo de limpieza que debe poder hacerse; exigir `activo` aquí dejaría
 *   vínculos imposibles de borrar tras una baja.
 * - **No verifica que el modificador exista.** Si su id no existe, tampoco existe el vínculo, y el
 *   resultado deseado ya se cumple. Sí se verifica el **servicio**, porque es el recurso de la URL:
 *   un `DELETE` sobre `/servicios/{id-falso}/...` debe responder `404`, no un `204` engañoso.
 * - **Idempotente:** desvincular algo no vinculado no falla (`DELETE` sin filas afectadas), mismo
 *   criterio que `RemoverManicuristaDeSucursalUseCase`.
 */
@Injectable()
export class DesvincularModificadorDeServicioUseCase {
  constructor(
    @Inject(SERVICIO_REPOSITORY) private readonly servicioRepository: ServicioRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: DesvincularModificadorDeServicioInput, actor: ClaimsUsuario): Promise<void> {
    const servicio = await this.servicioRepository.buscarPorId(input.servicioId);
    if (!servicio) throw new RecursoNoEncontradoError('Servicio', input.servicioId);

    await this.unitOfWork.ejecutar(async () => {
      await this.servicioRepository.desvincularModificador(input.servicioId, input.modificadorId);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'servicio_modificador',
        entidadAfectadaId: servicio.id,
        detalle: { accion: 'desvincular_modificador_de_servicio', modificadorId: input.modificadorId },
      });
    });
  }
}
