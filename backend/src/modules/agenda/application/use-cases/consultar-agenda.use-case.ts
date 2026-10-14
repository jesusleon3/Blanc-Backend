import { Inject, Injectable } from '@nestjs/common';
import { Cita } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { RangoHorario } from '../../../../database/schema';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { DomainError } from '../../../../shared/errors/domain-error';

/**
 * Lectura de la agenda de una sucursal en un rango.
 *
 * **El filtrado de la vista de iPad vive aquí, no en el controlador.** Si una `MANICURISTA`
 * pregunta, solo salen sus citas — y el id por el que se filtra sale de **sus permisos resueltos
 * contra PostgreSQL** (`P9`), nunca de la petición. Tomarlo de la query dejaría que cualquiera
 * leyera la agenda ajena cambiando un uuid.
 *
 * Que esté en el caso de uso y no en el controlador importa: el día que esta agenda se consulte
 * desde otro adaptador (el bot, un job, una consola), el filtro viaja con ella.
 */
@Injectable()
export class ConsultarAgendaUseCase {
  constructor(@Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository) {}

  async ejecutar(input: { sucursalId: string; rangoHorario: RangoHorario }, actor: ClaimsUsuario): Promise<Cita[]> {
    if (Number.isNaN(input.rangoHorario.inicio.getTime()) || Number.isNaN(input.rangoHorario.fin.getTime())) {
      throw new DomainError('RANGO_INVALIDO', 'El rango de consulta contiene una fecha inválida.', 400);
    }

    const citas = await this.citaRepository.listarQueOcupanEnRango(input.sucursalId, input.rangoHorario);

    if (actor.rol !== Rol.MANICURISTA) return citas;

    // Una usuaria con rol MANICURISTA sin `manicuristaId` vinculado (`P9`) no puede ver NADA. Es
    // el lado seguro del error: devolver todo sería exponer la agenda completa por un dato mal
    // capturado en el alta del usuario.
    if (!actor.manicuristaId) return [];

    return citas.filter((cita) => cita.manicuristaId === actor.manicuristaId);
  }
}
