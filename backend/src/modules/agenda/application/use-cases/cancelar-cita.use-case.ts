import { Inject, Injectable } from '@nestjs/common';
import { Cita } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { aplicarTransicion } from './transicion-cita.base';
import { ProcesarListaEsperaUseCase, ResultadoHuecoLiberado } from './lista-espera.use-cases';
import { Logger } from '@nestjs/common';

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
  /**
   * Qué pasó con la Lista de Espera al liberarse el hueco (`DEC-039`).
   *
   * `null` significa **"la fila no se pudo procesar"**, no "no había nadie": la cancelación ya
   * está confirmada y el fallo quedó en el log. `AvanzarTurnoListaEsperaUseCase` recoge esa fila
   * la próxima vez que se invoque, así que no se pierde nada; simplemente nadie fue avisado en
   * ese instante. Se distingue de `{ ofrecida: null }`, que sí significa "no había candidata".
   */
  listaEspera: ResultadoHuecoLiberado | null;
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
    private readonly procesarListaEspera: ProcesarListaEsperaUseCase,
  ) {}

  private readonly logger = new Logger(CancelarCitaUseCase.name);

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

    // DESPUÉS de que la cancelación esté confirmada, y en su propia transacción. Dos motivos:
    //
    // 1. El hueco solo está libre una vez persistido el estado `cancelada` — `MotorDisponibilidad`
    //    lee la base, así que preguntarle antes daría la capacidad de un mundo que ya cambió.
    // 2. **La cancelación no puede depender de la fila.** Si se hiciera todo en una transacción,
    //    un fallo al buscar candidatas desharía la cancelación — y la clienta que llamó para
    //    cancelar seguiría con su cita. Además el aviso es una llamada de red, y una transacción
    //    abierta esperando a un tercero mantiene bloqueos sobre la agenda.
    const listaEspera = await this.procesarFila(cita, actor, ahora);

    return { cita, incidenteTardio, listaEspera };
  }

  /**
   * Nunca propaga: cancelar es lo que pidió la clienta y ya está hecho.
   *
   * Un fallo aquí devolvería un 500 sobre una cancelación **ya confirmada**, y quien lo viera
   * reintentaría para recibir un 409 de transición inválida — ruido sobre una operación que salió
   * bien. Se registra en el log y `AvanzarTurnoListaEsperaUseCase` recoge la fila más tarde.
   */
  private async procesarFila(cita: Cita, actor: ClaimsUsuario, ahora: Date): Promise<ResultadoHuecoLiberado | null> {
    try {
      return await this.procesarListaEspera.procesarHuecoLiberado(
        { sucursalId: cita.sucursalId, inicioLiberado: cita.rangoHorario.inicio },
        actor,
        ahora,
      );
    } catch (error) {
      this.logger.error(
        `La cita ${cita.id} se canceló correctamente, pero no se pudo procesar la lista de espera. ` +
          'Nadie fue avisado de este hueco; se recuperará al avanzar turno.',
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
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
