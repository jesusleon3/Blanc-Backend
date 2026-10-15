import { Inject, Injectable } from '@nestjs/common';
import { Cita } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { aplicarTransicion } from './transicion-cita.base';
import { ProcesarListaEsperaUseCase, ResultadoHuecoLiberado } from './lista-espera.use-cases';
import { REGISTRO_DE_INCIDENTES_PORT, RegistroDeIncidentesPort } from '../../domain/ports/registro-de-incidentes.port';
import { ANTICIPO_PORT, AnticipoPort } from '../../domain/ports/anticipo.port';
import { CONTEXTO_CLIENTA_PORT, ContextoClientaPort } from '../../domain/ports/contexto-clienta.port';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';
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
   * `true` si había un anticipo pagado que **queda retenido** (`RN-ANT-04`). Se devuelve para que
   * quien canceló pueda decírselo a la clienta en ese mismo momento.
   */
  anticipoRetenido: boolean;
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
    @Inject(REGISTRO_DE_INCIDENTES_PORT) private readonly incidentes: RegistroDeIncidentesPort,
    @Inject(ANTICIPO_PORT) private readonly anticipos: AnticipoPort,
    @Inject(CONTEXTO_CLIENTA_PORT) private readonly clientas: ContextoClientaPort,
  ) {}

  private readonly logger = new Logger(CancelarCitaUseCase.name);

  async ejecutar(
    input: { citaId: string; motivo?: string; confirmacionDeEmpleado?: boolean },
    actor: ClaimsUsuario,
    ahora = new Date(),
  ): Promise<ResultadoCancelacion> {
    const previa = await this.citaRepository.buscarPorId(input.citaId);
    if (previa) await this.exigirConfirmacionSiAplica(previa, input.confirmacionDeEmpleado);
    // Se calcula ANTES de mover el estado: después, el dato sigue siendo el mismo, pero leerlo de
    // la cita ya cancelada invita a pensar que depende del estado, y no es así.
    const incidenteTardio = previa ? this.esTardia(previa, ahora) : false;

    // El cambio de estado y la anotación en CRM van en la MISMA transacción: la unidad de trabajo
    // se une a la que ya esté abierta, así que `aplicarTransicion` no abre una segunda.
    const cita = await this.unitOfWork.ejecutar(async () => {
      const cancelada = await aplicarTransicion(
        { citaRepository: this.citaRepository, auditoria: this.auditoria, unitOfWork: this.unitOfWork },
        {
          citaId: input.citaId,
          nuevoEstado: 'cancelada',
          accion: 'cancelar_cita',
          actor,
          detalleExtra: { incidenteTardio, motivo: input.motivo },
        },
      );

      await this.anotarEnCrm(cancelada, incidenteTardio, ahora);
      // `RN-ANT-04`: el dinero se queda. En la misma transacción — perder esta retención dejaría
      // un anticipo `pagado` apuntando a una cita cancelada, es decir un cobro pendiente de un
      // servicio que no se va a dar.
      await this.anticipos.retenerPorCitaTerminada(cancelada.id, 'cancelada');
      return cancelada;
    });

    const anticipoRetenido = (await this.anticipos.estadoDe(cita.id)) === 'retenido';

    // DESPUÉS de que la cancelación esté confirmada, y en su propia transacción. Dos motivos:
    //
    // 1. El hueco solo está libre una vez persistido el estado `cancelada` — `MotorDisponibilidad`
    //    lee la base, así que preguntarle antes daría la capacidad de un mundo que ya cambió.
    // 2. **La cancelación no puede depender de la fila.** Si se hiciera todo en una transacción,
    //    un fallo al buscar candidatas desharía la cancelación — y la clienta que llamó para
    //    cancelar seguiría con su cita. Además el aviso es una llamada de red, y una transacción
    //    abierta esperando a un tercero mantiene bloqueos sobre la agenda.
    const listaEspera = await this.procesarFila(cita, actor, ahora);

    return { cita, incidenteTardio, anticipoRetenido, listaEspera };
  }

  /**
   * `RN-CRM-03` + `RN-ANT-04` — **la confirmación explícita del empleado**.
   *
   * ## CÓMO QUEDA CUBIERTA `RN-CRM-03`
   *
   * La regla dice que *"cualquier cancelación de una clienta en lista roja requiere aprobación de
   * un empleado, no se ejecuta directamente"*. Nació pensando en un bot que cancelara solo: el
   * ejemplo del mockup es una clienta escribiendo *"quiero cancelar"* y el bot escalando.
   *
   * En la plataforma construida, **ninguna clienta puede cancelar nada**: no hay interfaz de
   * clienta (cero links), y `POST /:id/cancelar` exige un JWT con rol `SUPER_ADMIN`,
   * `ADMINISTRADOR` o `GERENTE` (`DEC-042`). Así que la parte de *"la ejecuta un empleado"* está
   * cubierta estructuralmente.
   *
   * Lo que **faltaba** era la *aprobación consciente*: que el empleado no cancele de corrido sin
   * saber que esa clienta es de riesgo o que hay dinero que no se devuelve. Eso es lo que añade
   * este método: la primera llamada sin `confirmacionDeEmpleado` recibe un **409 que describe la
   * consecuencia**, y hay que reintentar confirmando. No es fricción decorativa — es la
   * diferencia entre haber aprobado algo y haberlo pulsado.
   *
   * Solo se exige cuando hay algo que advertir: clienta en lista roja, o anticipo pagado. Pedirlo
   * en toda cancelación habría convertido la advertencia en un trámite que nadie lee.
   */
  private async exigirConfirmacionSiAplica(cita: Cita, confirmado: boolean | undefined): Promise<void> {
    if (confirmado) return;

    const [clienta, estadoDelAnticipo] = await Promise.all([
      this.clientas.obtener(cita.clientaId),
      this.anticipos.estadoDe(cita.id),
    ]);

    const enListaRoja = clienta?.estadoDeRiesgo === 'lista_roja';
    const conAnticipoPagado = estadoDelAnticipo === 'pagado';
    if (!enListaRoja && !conAnticipoPagado) return;

    throw new ConflictoDeNegocioError(
      'CANCELACION_REQUIERE_CONFIRMACION',
      conAnticipoPagado
        ? 'Esta cita tiene un anticipo pagado que NO se devuelve (RN-ANT-04). Confirma explícitamente para cancelar.'
        : 'Esta clienta está en lista roja; su cancelación requiere aprobación explícita de un empleado (RN-CRM-03).',
      { citaId: cita.id, enListaRoja, conAnticipoPagado, requiereConfirmacionDeEmpleado: true },
    );
  }

  /**
   * Lleva el hecho a CRM (`RN-CRM-06`), distinguiendo las dos vías.
   *
   * **Tardía (`<= 60 min`) → incidente**, que enciende la sugerencia de lista roja.
   * **Ordinaria (`> 60 min`) → solo contador**, porque `RN-CRM-06` descartó expresamente el
   * umbral acumulado: *"no se cuentan N cancelaciones en una ventana de días"*. El contador existe
   * como contexto para la Dueña (`RN-CRM-05` sugiere *"con base en historial de cancelaciones"*),
   * no como disparador.
   *
   * En ninguno de los dos casos se marca lista roja: eso es de la Dueña (`DEC-042`).
   */
  private async anotarEnCrm(cita: Cita, incidenteTardio: boolean, ahora: Date): Promise<void> {
    const minutosDeAntelacion = Math.round((cita.rangoHorario.inicio.getTime() - ahora.getTime()) / 60_000);

    if (incidenteTardio) {
      await this.incidentes.registrarIncidente({
        clientaId: cita.clientaId,
        citaId: cita.id,
        tipo: 'cancelacion_tardia',
        ocurridoEn: ahora,
        minutosDeAntelacion,
      });
      return;
    }

    await this.incidentes.registrarCancelacionOrdinaria({ clientaId: cita.clientaId, citaId: cita.id });
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
