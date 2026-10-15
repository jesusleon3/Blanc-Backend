import { Inject, Injectable } from '@nestjs/common';
import { Anticipo } from '../../domain/entities/anticipo.entity';
import { ANTICIPO_REPOSITORY, AnticipoRepository, ListadoDeAnticipos } from '../../domain/ports/anticipo.repository';
import { TRANSICION_DE_CITA_PORT, TransicionDeCitaPort } from '../../domain/ports/transicion-de-cita.port';
import { EstadoAnticipo } from '../../../../database/schema';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

/**
 * Genera el anticipo de una cita que nació en `en_espera_pago`.
 *
 * `RN-ANT-01` — **solo clientas en lista roja**. Esa exclusividad no se comprueba aquí mirando el
 * CRM: se comprueba **por construcción**. `AgendarCitaUseCase` hace nacer la cita en
 * `en_espera_pago` únicamente cuando la clienta está en `lista_roja`, y este caso de uso exige
 * ese estado. Preguntarle otra vez a CRM sería una segunda fuente de verdad que podría discrepar
 * de la primera — y la que manda es el estado en que la cita ya nació (`RN-CRM-07`, no
 * retroactividad: si la clienta se rehabilitó *después* de agendar, su cita sigue necesitando el
 * anticipo que se le pidió).
 */
@Injectable()
export class GenerarAnticipoUseCase {
  constructor(
    @Inject(ANTICIPO_REPOSITORY) private readonly anticipos: AnticipoRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(
    input: { citaId: string; clientaId: string; baseCentavos: number | null; montoCentavos?: number; porcentaje?: number },
    actor: ClaimsUsuario,
  ): Promise<Anticipo> {
    const anticipo = Anticipo.generar(input);

    await this.unitOfWork.ejecutar(async () => {
      await this.anticipos.guardar(anticipo);
      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'anticipo',
        entidadAfectadaId: anticipo.id,
        detalle: {
          accion: 'generar_anticipo',
          citaId: anticipo.citaId,
          montoCentavos: anticipo.montoCentavos,
          porcentajeAplicado: anticipo.porcentajeAplicado,
        },
      });
    });

    return anticipo;
  }
}

export interface ResultadoDeConfirmacion {
  anticipo: Anticipo;
}

/**
 * Una persona confirma que vio la transferencia. **Cero pasarela de pagos**: el dinero se mueve
 * fuera de la plataforma y aquí solo se registra que alguien lo verificó.
 *
 * ## TODO EN UNA SOLA TRANSACCIÓN, Y ESO ES LO ESENCIAL
 *
 * Confirmar el pago y activar la cita (`en_espera_pago` → `agendada`) ocurren en la **misma**
 * transacción, porque `DrizzleUnitOfWork` se une a la que ya esté abierta. Si la cita no se puede
 * activar —otra clienta tomó el último hueco mientras llegaba la transferencia—, la confirmación
 * **se deshace entera** y el anticipo vuelve a quedar `pendiente`.
 *
 * La alternativa era confirmar primero y activar después: eso dejaría **dinero registrado contra
 * una cita que no existe en firme**, que es exactamente el "anticipo confirmado huérfano" que hay
 * que evitar.
 *
 * ⚠️ **CONSECUENCIA REAL QUE CONVIENE CONOCER:** en ese caso la transferencia **ya se hizo** en el
 * banco, pero el sistema no la deja registrar. No es un agujero, es la secuencia correcta: la
 * Encargada tiene que **reprogramar la cita** a un horario libre y volver a confirmar. El dinero
 * no se pierde ni se devuelve (`RN-ANT-04`), sigue siendo válido para la cita reprogramada. El
 * mensaje de error lo dice explícitamente.
 */
@Injectable()
export class ConfirmarPagoAnticipoUseCase {
  constructor(
    @Inject(ANTICIPO_REPOSITORY) private readonly anticipos: AnticipoRepository,
    @Inject(TRANSICION_DE_CITA_PORT) private readonly citas: TransicionDeCitaPort,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(
    input: { anticipoId: string; referenciaPago: string },
    actor: ClaimsUsuario,
    ahora = new Date(),
  ): Promise<ResultadoDeConfirmacion> {
    const anticipo = await this.anticipos.buscarPorId(input.anticipoId);
    if (!anticipo) throw new RecursoNoEncontradoError('Anticipo', input.anticipoId);

    anticipo.confirmarPago({ referenciaPago: input.referenciaPago, confirmadoPor: actor.sub }, ahora);

    await this.unitOfWork.ejecutar(async () => {
      await this.anticipos.guardar(anticipo);

      // Si esto lanza `HORARIO_NO_DISPONIBLE` o `SILLA_OCUPADA`, la transacción entera se deshace
      // y el anticipo sigue `pendiente`. Es el orden correcto: primero se registra el dinero,
      // luego se intenta comprometer el horario, y si el horario falla nada queda escrito.
      await this.citas.activarPorPagoConfirmado(anticipo.citaId);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'anticipo',
        entidadAfectadaId: anticipo.id,
        detalle: {
          accion: 'confirmar_pago_anticipo',
          citaId: anticipo.citaId,
          montoCentavos: anticipo.montoCentavos,
          // La referencia SÍ va al detalle: no es PII de la clienta, es el dato con el que se
          // reconstruye la conciliación bancaria si alguien reclama.
          referenciaPago: anticipo.referenciaPago,
        },
      });
    });

    return { anticipo };
  }
}

/**
 * La transferencia nunca llegó: el anticipo se marca `expirado` y la cita pasa a `expirada`.
 *
 * ⚠️ **NO ES LA "LIBERACIÓN AUTOMÁTICA" DE `RN-ANT-03`.** Esa regla dice que no hay nada que
 * liberar, porque el horario nunca estuvo retenido. Esto es **limpieza de una solicitud muerta**:
 * sin ella la cita se quedaría en `en_espera_pago` indefinidamente, apareciendo en la agenda del
 * día como un cobro pendiente que nadie va a pagar.
 *
 * **Es explícito, no un temporizador**, por la misma razón que `avanzar-turno` de la Lista de
 * Espera: Blanc no tiene planificador. Lo dispara una persona o un job runner externo. Fingir una
 * caducidad automática que nada dispara sería peor que no tenerla.
 */
@Injectable()
export class ExpirarAnticipoUseCase {
  constructor(
    @Inject(ANTICIPO_REPOSITORY) private readonly anticipos: AnticipoRepository,
    @Inject(TRANSICION_DE_CITA_PORT) private readonly citas: TransicionDeCitaPort,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: { anticipoId: string; motivo?: string }, actor: ClaimsUsuario): Promise<Anticipo> {
    const anticipo = await this.anticipos.buscarPorId(input.anticipoId);
    if (!anticipo) throw new RecursoNoEncontradoError('Anticipo', input.anticipoId);

    anticipo.expirar();

    await this.unitOfWork.ejecutar(async () => {
      await this.anticipos.guardar(anticipo);
      await this.citas.expirarPorAnticipoNoPagado(anticipo.citaId);
      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'anticipo',
        entidadAfectadaId: anticipo.id,
        detalle: { accion: 'expirar_anticipo', citaId: anticipo.citaId, motivo: input.motivo },
      });
    });

    return anticipo;
  }
}

/**
 * La cita murió con el anticipo pagado: **el dinero se queda** (`RN-ANT-04`).
 *
 * Lo invoca `IntegracionModule` desde `CancelarCitaUseCase` y `MarcarNoShowUseCase`. Devuelve
 * `null` cuando no hay anticipo o no estaba pagado: **no es un error**, es el caso normal de la
 * inmensa mayoría de las citas, que no llevan anticipo porque su clienta no está en lista roja.
 */
@Injectable()
export class RetenerAnticipoUseCase {
  constructor(
    @Inject(ANTICIPO_REPOSITORY) private readonly anticipos: AnticipoRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: { citaId: string; motivo: 'cancelada' | 'no_show' }, actor: ClaimsUsuario): Promise<Anticipo | null> {
    const anticipo = await this.anticipos.buscarPorCita(input.citaId);
    if (!anticipo || !anticipo.estaPagado) return null;

    anticipo.retener();

    await this.unitOfWork.ejecutar(async () => {
      await this.anticipos.guardar(anticipo);
      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'anticipo',
        entidadAfectadaId: anticipo.id,
        detalle: {
          accion: 'retener_anticipo',
          citaId: anticipo.citaId,
          motivo: input.motivo,
          montoCentavos: anticipo.montoCentavos,
          // Explícito en la auditoría: es la decisión que la clienta podría reclamar.
          sinReembolso: true,
        },
      });
    });

    return anticipo;
  }
}

/** Pantalla de conciliación: *"qué transferencias estoy esperando"*. */
@Injectable()
export class ConsultarAnticiposUseCase {
  constructor(@Inject(ANTICIPO_REPOSITORY) private readonly anticipos: AnticipoRepository) {}

  listarPorEstado(input: { estado: EstadoAnticipo; limite: number; desplazamiento: number }): Promise<ListadoDeAnticipos> {
    return this.anticipos.listarPorEstado(input.estado, { limite: input.limite, desplazamiento: input.desplazamiento });
  }

  async deCita(input: { citaId: string }): Promise<Anticipo> {
    const anticipo = await this.anticipos.buscarPorCita(input.citaId);
    if (!anticipo) throw new RecursoNoEncontradoError('Anticipo de la cita', input.citaId);
    return anticipo;
  }

  /** `null` sin lanzar: lo usa el adaptador hacia Agenda, donde "no hay anticipo" es normal. */
  buscarDeCita(citaId: string): Promise<Anticipo | null> {
    return this.anticipos.buscarPorCita(citaId);
  }
}
