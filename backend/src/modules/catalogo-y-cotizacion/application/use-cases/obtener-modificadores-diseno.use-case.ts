import { Inject, Injectable } from '@nestjs/common';
import { ModificadorDiseno } from '../../domain/entities/modificador-diseno.entity';
import { MODIFICADOR_DISENO_REPOSITORY, ModificadorDisenoRepository } from '../../domain/ports/modificador-diseno.repository';

/**
 * Lectura pura del catálogo de modificadores — sin transacción ni auditoría, mismo criterio que
 * `ObtenerServiciosUseCase`.
 *
 * Lista **todos** los modificadores, no los aplicables a un servicio concreto: esa consulta
 * requiere la tabla de unión, fuera del alcance de esta iteración.
 */
@Injectable()
export class ObtenerModificadoresDisenoUseCase {
  constructor(@Inject(MODIFICADOR_DISENO_REPOSITORY) private readonly modificadorRepository: ModificadorDisenoRepository) {}

  async ejecutar(): Promise<ModificadorDiseno[]> {
    return this.modificadorRepository.listar();
  }
}
