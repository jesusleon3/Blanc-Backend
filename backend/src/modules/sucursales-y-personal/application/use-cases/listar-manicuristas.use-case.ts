import { Inject, Injectable } from '@nestjs/common';
import { Manicurista } from '../../domain/entities/manicurista.entity';
import { MANICURISTA_REPOSITORY, ManicuristaRepository } from '../../domain/ports/manicurista.repository';

/**
 * Lectura pura — disponible a cualquier rol autenticado.
 *
 * **Sin alcance de sucursal a propósito** — ver la nota equivalente en `ConsultarSucursalUseCase`;
 * decisión de negocio pendiente, `OWNER_DECISION_LOG.md` Pregunta 11.
 */
@Injectable()
export class ListarManicuristasUseCase {
  constructor(@Inject(MANICURISTA_REPOSITORY) private readonly manicuristaRepository: ManicuristaRepository) {}

  async ejecutar(): Promise<Manicurista[]> {
    return this.manicuristaRepository.listar();
  }
}
