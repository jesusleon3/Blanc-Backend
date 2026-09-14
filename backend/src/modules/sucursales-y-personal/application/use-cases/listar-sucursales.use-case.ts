import { Inject, Injectable } from '@nestjs/common';
import { Sucursal } from '../../domain/entities/sucursal.entity';
import { SUCURSAL_REPOSITORY, SucursalRepository } from '../../domain/ports/sucursal.repository';

/**
 * Lectura pura — sin efecto, disponible a cualquier rol autenticado (functional-scope.md §2).
 *
 * **Sin alcance de sucursal a propósito** — ver la nota equivalente en `ConsultarSucursalUseCase`;
 * decisión de negocio pendiente, `OWNER_DECISION_LOG.md` Pregunta 11.
 */
@Injectable()
export class ListarSucursalesUseCase {
  constructor(@Inject(SUCURSAL_REPOSITORY) private readonly sucursalRepository: SucursalRepository) {}

  async ejecutar(): Promise<Sucursal[]> {
    return this.sucursalRepository.listar();
  }
}
