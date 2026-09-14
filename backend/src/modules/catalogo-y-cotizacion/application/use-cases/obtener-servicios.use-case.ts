import { Inject, Injectable } from '@nestjs/common';
import { Servicio } from '../../domain/entities/servicio.entity';
import { SERVICIO_REPOSITORY, ServicioRepository } from '../../domain/ports/servicio.repository';

/**
 * Lectura pura del catálogo — sin transacción ni auditoría: `RN-AUD-01` audita cambios de
 * configuración, no consultas.
 *
 * **Devuelve activos e inactivos a propósito.** Un servicio dado de baja sigue apareciendo en las
 * citas ya cotizadas, así que el administrador necesita verlo. Filtrar por disponibilidad para
 * agendar es una decisión de `FL-COT-02`/`FL-COT-03`, pospuestos, y no se anticipa aquí.
 */
@Injectable()
export class ObtenerServiciosUseCase {
  constructor(@Inject(SERVICIO_REPOSITORY) private readonly servicioRepository: ServicioRepository) {}

  async ejecutar(): Promise<Servicio[]> {
    return this.servicioRepository.listar();
  }
}
