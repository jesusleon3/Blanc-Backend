import { Inject, Injectable } from '@nestjs/common';
import { Cita } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface AsignarManicuristaEnSucursalInput {
  citaId: string;
  manicuristaId: string;
}

/**
 * Caso de uso — la Encargada asigna (o cambia) la manicurista de una cita **cuando la clienta
 * llega a la sucursal** (`DEC-031` §2.4, `DEC-039`).
 *
 * Es el punto donde el patrón de Sillas Virtuales se conecta con la directriz de Sistema Híbrido:
 * el bot pudo reservar el hueco solo, sin comprometer a nadie, y **una persona decide** quién
 * atiende, con la información del momento.
 *
 * **La validación de solapamiento NO está aquí.** Si esa manicurista ya tiene otra cita a esa
 * hora, lo rechaza la restricción `citas_manicurista_sin_solapamiento` en la base de datos, y el
 * repositorio lo traduce a `MANICURISTA_OCUPADA`. Duplicar la comprobación en memoria daría una
 * falsa sensación de seguridad y podría divergir de la restricción real, que es la autoridad.
 *
 * **La silla no cambia:** el espacio físico ya estaba apartado desde la reserva.
 */
@Injectable()
export class AsignarManicuristaEnSucursalUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: AsignarManicuristaEnSucursalInput, actor: ClaimsUsuario): Promise<Cita> {
    const cita = await this.citaRepository.buscarPorId(input.citaId);
    if (!cita) throw new RecursoNoEncontradoError('Cita', input.citaId);

    // Una cita cancelada, expirada o reprogramada ya no ocupa su horario: asignarle manicurista
    // no significaría nada y, peor, bloquearía a esa persona para una cita que sí existe.
    if (!cita.ocupaHorario) {
      throw new ConflictoDeNegocioError('CITA_SIN_HORARIO_ACTIVO', 'No se puede asignar manicurista a una cita que ya no ocupa su horario.', {
        citaId: cita.id,
        estado: cita.estado,
      });
    }

    const anterior = cita.manicuristaId;
    cita.asignarManicurista(input.manicuristaId);

    await this.unitOfWork.ejecutar(async () => {
      await this.citaRepository.guardar(cita);

      await this.auditoria.registrar({
        tipoAccion: 'agendamiento',
        actor: actor.sub,
        sucursalRelacionada: cita.sucursalId,
        entidadAfectadaTipo: 'cita',
        entidadAfectadaId: cita.id,
        // Se registra el valor anterior: un cambio de manicurista en mostrador es justo el dato
        // que alguien va a querer reconstruir si después hay una queja.
        detalle: { accion: 'asignar_manicurista_en_sucursal', manicuristaAnterior: anterior, manicuristaNueva: input.manicuristaId },
      });
    });

    return cita;
  }
}
