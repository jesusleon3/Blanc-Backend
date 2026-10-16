import { Inject, Injectable } from '@nestjs/common';
import { Manicurista } from '../../domain/entities/manicurista.entity';
import { MANICURISTA_REPOSITORY, ManicuristaRepository } from '../../domain/ports/manicurista.repository';

/**
 * Lectura pura — disponible a cualquier rol autenticado.
 *
 * **El alcance de sucursal del USUARIO sigue sin aplicarse a propósito** (decisión de negocio
 * pendiente, `OWNER_DECISION_LOG.md` Pregunta 11). Lo que sí se añadió es un **filtro explícito**
 * por sucursal, que es otra cosa: no restringe quién puede ver qué, sino que responde la pregunta
 * *"¿quién trabaja en esta sucursal?"*.
 *
 * Hacía falta para el panel: al asignar una manicurista a una cita, ofrecer a las de las otras
 * dos sucursales garantiza un `409` —el caso de uso valida la asignación— y hace que quien opera
 * tenga que recordar de memoria quién trabaja dónde. El filtro **no sustituye esa validación**: es
 * la lista correcta por adelantado.
 */
@Injectable()
export class ListarManicuristasUseCase {
  constructor(@Inject(MANICURISTA_REPOSITORY) private readonly manicuristaRepository: ManicuristaRepository) {}

  async ejecutar(filtros: { sucursalId?: string } = {}): Promise<Manicurista[]> {
    const todas = await this.manicuristaRepository.listar();
    if (!filtros.sucursalId) return todas;

    const sucursalId = filtros.sucursalId;
    // Una consulta por manicurista. Con tres o cuatro sucursales y una decena de manicuristas es
    // irrelevante; si el equipo creciera, el sitio para arreglarlo es el repositorio con un `JOIN`
    // sobre `manicuristas_sucursales`, no este caso de uso.
    const asignaciones = await Promise.all(
      todas.map(async (manicurista) => ({
        manicurista,
        sucursales: await this.manicuristaRepository.listarSucursalesDeManicurista(manicurista.id),
      })),
    );

    return asignaciones.filter((fila) => fila.sucursales.includes(sucursalId)).map((fila) => fila.manicurista);
  }
}
