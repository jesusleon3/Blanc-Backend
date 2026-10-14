import { Inject, Injectable } from '@nestjs/common';
import { Cita } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { aplicarTransicion } from './transicion-cita.base';

/** Ventana de `RN-CRM-06`: cancelar dentro de la hora previa es un incidente, no una cancelación normal. */
export const MINUTOS_DE_INCIDENTE_TARDIO = 60;

export interface ResultadoCancelacion {
  cita: Cita;
  /**
   * `true` si se canceló dentro de los 60 minutos previos al inicio (o después de empezar).
   * **No marca lista roja**: solo informa. `RN-CRM-06` dice que esto *sugiere* la lista roja, y
   * `DEC-042` que **solo la Dueña** la aplica. Convertir esta señal en una marca automática le
   * quitaría a ella una decisión que es suya.
   */
  incidenteTardio: boolean;
}

/**
 * Caso de uso — cancelar una cita. **Siempre lo ejecuta una persona** (`DEC-042`): ninguna clienta
 * cancela sola, tampoco las que no están en lista roja.
 *
 * Cancelar **libera la silla y la manicurista de inmediato** en PostgreSQL, porque `cancelada` es
 * uno de los estados que no ocupan horario (`DEC-034`). No hace falta ningún paso extra: el hueco
 * queda disponible en cuanto se persiste.
 *
 * **Cancelar no es reprogramar** (`DEC-042`). Son acciones distintas: al cancelar se le pregunta a
 * la clienta si quiere reagendar, y si dice que sí, eso es `ReprogramarCitaUseCase`. Aquí la cita
 * muere.
 */
@Injectable()
export class CancelarCitaUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: { citaId: string; motivo?: string }, actor: ClaimsUsuario, ahora = new Date()): Promise<ResultadoCancelacion> {
    const previa = await this.citaRepository.buscarPorId(input.citaId);
    // Se calcula ANTES de mover el estado: después, el dato sigue siendo el mismo, pero leerlo de
    // la cita ya cancelada invita a pensar que depende del estado, y no es así.
    const incidenteTardio = previa ? this.esTardia(previa, ahora) : false;

    const cita = await aplicarTransicion(
      { citaRepository: this.citaRepository, auditoria: this.auditoria, unitOfWork: this.unitOfWork },
      {
        citaId: input.citaId,
        nuevoEstado: 'cancelada',
        accion: 'cancelar_cita',
        actor,
        detalleExtra: { incidenteTardio, motivo: input.motivo },
      },
    );

    return { cita, incidenteTardio };
  }

  /**
   * `RN-CRM-06` — la ventana son los 60 minutos previos al inicio. Una cancelación **después** de
   * que la cita empezó también cuenta: si cancelar a falta de 59 minutos es un incidente, hacerlo
   * cuando la clienta ya debería estar sentada lo es más.
   */
  private esTardia(cita: Cita, ahora: Date): boolean {
    const minutosRestantes = (cita.rangoHorario.inicio.getTime() - ahora.getTime()) / 60000;
    return minutosRestantes <= MINUTOS_DE_INCIDENTE_TARDIO;
  }
}
