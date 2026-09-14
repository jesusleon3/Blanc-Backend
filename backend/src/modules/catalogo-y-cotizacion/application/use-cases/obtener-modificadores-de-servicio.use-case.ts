import { Inject, Injectable } from '@nestjs/common';
import { ModificadorDiseno } from '../../domain/entities/modificador-diseno.entity';
import { SERVICIO_REPOSITORY, ServicioRepository } from '../../domain/ports/servicio.repository';
import { MODIFICADOR_DISENO_REPOSITORY, ModificadorDisenoRepository } from '../../domain/ports/modificador-diseno.repository';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';

export interface ObtenerModificadoresDeServicioInput {
  servicioId: string;
}

/**
 * Lectura pura — qué modificadores tiene habilitados un servicio concreto. Sin transacción ni
 * auditoría: `RN-AUD-01` audita cambios de configuración, no consultas.
 *
 * DOS CONSULTAS, NO UN JOIN, A PROPÓSITO: la tabla de unión la lee `ServicioRepository` (ids) y
 * las entidades las hidrata `ModificadorDisenoRepository` (su dueño). Un join en un solo adaptador
 * obligaría al repositorio de servicios a construir entidades de otro aggregate. `listarPorIds`
 * evita el N+1 que saldría de iterar `buscarPorId`.
 *
 * **Devuelve activos e inactivos.** Un modificador dado de baja que quedó vinculado sigue siendo
 * parte de la configuración real del servicio, y ocultarlo aquí haría que el administrador no
 * pudiera verlo para desvincularlo. Filtrar por disponibilidad al cotizar es decisión de
 * `FL-COT-03`, que no se anticipa aquí.
 */
@Injectable()
export class ObtenerModificadoresDeServicioUseCase {
  constructor(
    @Inject(SERVICIO_REPOSITORY) private readonly servicioRepository: ServicioRepository,
    @Inject(MODIFICADOR_DISENO_REPOSITORY) private readonly modificadorRepository: ModificadorDisenoRepository,
  ) {}

  async ejecutar(input: ObtenerModificadoresDeServicioInput): Promise<ModificadorDiseno[]> {
    const servicio = await this.servicioRepository.buscarPorId(input.servicioId);
    if (!servicio) throw new RecursoNoEncontradoError('Servicio', input.servicioId);

    const ids = await this.servicioRepository.listarModificadoresDeServicio(input.servicioId);
    return this.modificadorRepository.listarPorIds(ids);
  }
}
