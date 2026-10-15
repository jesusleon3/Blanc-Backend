import { Inject, Injectable } from '@nestjs/common';
import { SolicitudListaEspera } from '../../domain/entities/solicitud-lista-espera.entity';
import { LISTA_ESPERA_REPOSITORY, ListaEsperaRepository } from '../../domain/ports/lista-espera.repository';
import {
  NOTIFICACION_LISTA_ESPERA_PORT,
  NotificacionListaEsperaPort,
} from '../../domain/ports/notificacion-lista-espera.port';
import { VERIFICAR_CLIENTA_PORT, VerificarClientaPort } from '../../domain/ports/verificar-clienta.port';
import { MotorDisponibilidad } from '../../domain/services/motor-disponibilidad';
import { ResolutorDeServicio } from '../../domain/services/resolutor-de-servicio';
import { AgendarCitaUseCase } from './agendar-cita.use-case';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, DomainError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { fechaLocal } from '../../../../shared/tiempo/zona-horaria-negocio';
import { Cita } from '../../domain/entities/cita.entity';

/**
 * Umbral de `DEC-039` regla 2.3: una cancelación a menos de media hora del inicio deja un hueco
 * que **no se puede aprovechar** por la fila automática.
 *
 * ⚠️ **NO CONFUNDIR CON `MINUTOS_DE_INCIDENTE_TARDIO = 60`** de `CancelarCitaUseCase`. Son dos
 * umbrales de cosas distintas que conviven a propósito:
 * - **60 min** (`RN-CRM-06`): *"esto sugiere lista roja"* — mide el comportamiento de la clienta.
 * - **30 min** (`DEC-039`): *"este hueco ya no se puede revender"* — mide la utilidad del hueco.
 *
 * Unificarlos por parecer redundantes sería un error: una cancelación a los 45 minutos es
 * incidente para la clienta **y** hueco aprovechable para la fila, las dos cosas a la vez.
 */
export const MINUTOS_MINIMOS_PARA_AVISO = 30;

export interface ResultadoHuecoLiberado {
  /**
   * `true` si el hueco se liberó a `<= 30 min` del inicio. **No se avisa a nadie** y queda como
   * alerta para la Dueña: es capacidad que se perdió y conviene que alguien la vea.
   */
  huecoPerdidoCortoPlazo: boolean;
  /** La solicitud a la que se le ofreció, si alguna cupo. */
  ofrecida: SolicitudListaEspera | null;
  /** Cuántas solicitudes de la fila se saltaron porque su servicio no cabía en el hueco. */
  descartadasPorNoCaber: number;
}

/** Alta en la fila. */
@Injectable()
export class InscribirEnListaEsperaUseCase {
  constructor(
    @Inject(LISTA_ESPERA_REPOSITORY) private readonly listaEspera: ListaEsperaRepository,
    private readonly resolutorDeServicio: ResolutorDeServicio,
    @Inject(VERIFICAR_CLIENTA_PORT) private readonly clientas: VerificarClientaPort,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(
    input: { sucursalId: string; clientaId: string; servicioId: string; fecha: string },
    actor: ClaimsUsuario,
    ahora = new Date(),
  ): Promise<SolicitudListaEspera> {
    // Se exige el servicio **activo**: apuntarse a la espera de algo que ya no se vende sería
    // una espera que no puede terminar nunca. Es una venta nueva, no mover algo ya vendido.
    const servicio = await this.resolutorDeServicio.resolver(input.servicioId);

    if (!(await this.clientas.existe(input.clientaId))) {
      throw new RecursoNoEncontradoError('Clienta', input.clientaId);
    }

    const solicitud = SolicitudListaEspera.inscribir(input);

    // Una fila para un día que ya pasó no puede recibir ninguna oferta: nunca se va a liberar un
    // hueco en el pasado. Se compara en fecha de pared del negocio, no en UTC.
    if (solicitud.fecha < fechaLocal(ahora)) {
      throw new ConflictoDeNegocioError('LISTA_ESPERA_FECHA_PASADA', 'No se puede entrar en la lista de espera de un día que ya pasó.', {
        fecha: solicitud.fecha,
      });
    }

    await this.unitOfWork.ejecutar(async () => {
      await this.listaEspera.guardar(solicitud);
      await this.auditoria.registrar({
        tipoAccion: 'agendamiento',
        actor: actor.sub,
        sucursalRelacionada: solicitud.sucursalId,
        entidadAfectadaTipo: 'solicitud_lista_espera',
        entidadAfectadaId: solicitud.id,
        detalle: { accion: 'inscribir_lista_espera', fecha: solicitud.fecha, servicioId: servicio.id },
      });
    });

    return solicitud;
  }
}

/**
 * Procesa un hueco liberado y, si alguien de la fila cabe, le abre su turno (`DEC-039`).
 *
 * Lo invocan `CancelarCitaUseCase` y `ReprogramarCitaUseCase`. **Reprogramar también libera un
 * hueco**, no solo cancelar: es fácil de olvidar porque la regla habla de cancelaciones, pero la
 * cita original pasa a `reprogramada` y libera su horario igual.
 *
 * **La oferta NO retiene el hueco** (`RN-AGE-13`): la ventana solo decide a quién se avisa
 * primero. Si otra clienta agenda mientras la oferta está abierta, gana quien agende primero.
 */
@Injectable()
export class ProcesarListaEsperaUseCase {
  constructor(
    @Inject(LISTA_ESPERA_REPOSITORY) private readonly listaEspera: ListaEsperaRepository,
    private readonly motorDisponibilidad: MotorDisponibilidad,
    private readonly resolutorDeServicio: ResolutorDeServicio,
    @Inject(NOTIFICACION_LISTA_ESPERA_PORT) private readonly notificacion: NotificacionListaEsperaPort,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async procesarHuecoLiberado(
    input: { sucursalId: string; inicioLiberado: Date; minutosDeVentana?: number },
    actor: ClaimsUsuario,
    ahora = new Date(),
  ): Promise<ResultadoHuecoLiberado> {
    const minutosDeAntelacion = (input.inicioLiberado.getTime() - ahora.getTime()) / 60_000;

    if (minutosDeAntelacion <= MINUTOS_MINIMOS_PARA_AVISO) {
      // Regla 2.3: el hueco se asume perdido para la fila automática. No se avisa a nadie —
      // escribir a una clienta para un hueco de dentro de 20 minutos es ofrecerle algo a lo que
      // no puede llegar. Queda la bandera para la Dueña.
      await this.auditoria.registrar({
        tipoAccion: 'agendamiento',
        actor: actor.sub,
        sucursalRelacionada: input.sucursalId,
        entidadAfectadaTipo: 'lista_espera',
        entidadAfectadaId: input.sucursalId,
        detalle: {
          accion: 'hueco_perdido_corto_plazo',
          inicioLiberado: input.inicioLiberado.toISOString(),
          minutosDeAntelacion: Math.round(minutosDeAntelacion),
        },
      });
      return { huecoPerdidoCortoPlazo: true, ofrecida: null, descartadasPorNoCaber: 0 };
    }

    const resultado = await this.ofrecerAlPrimeroQueQuepa(input, actor, ahora);
    return { huecoPerdidoCortoPlazo: false, ...resultado };
  }

  /**
   * Recorre la fila en orden FIFO y se detiene en la primera solicitud cuyo servicio **cabe** en
   * el hueco real.
   *
   * El salto no es un detalle de implementación, es la regla 2.2: si se libera una hora y la
   * primera de la fila quería un servicio de dos, **no es candidata** y se pasa a la siguiente.
   * Saltarla no la penaliza — conserva su lugar para el próximo hueco que sí le sirva.
   */
  private async ofrecerAlPrimeroQueQuepa(
    input: { sucursalId: string; inicioLiberado: Date; minutosDeVentana?: number },
    actor: ClaimsUsuario,
    ahora: Date,
  ): Promise<{ ofrecida: SolicitudListaEspera | null; descartadasPorNoCaber: number }> {
    const fecha = fechaLocal(input.inicioLiberado);

    // Si ya hay una oferta abierta en esta fila, no se abre otra: se avisa a una sola clienta a
    // la vez (`DEC-039`). La base lo impone además por índice único parcial.
    if (await this.listaEspera.buscarOfertaAbierta(input.sucursalId, fecha)) {
      return { ofrecida: null, descartadasPorNoCaber: 0 };
    }

    const fila = (await this.listaEspera.listarFila(input.sucursalId, fecha)).filter((s) => s.estado === 'en_espera');
    let descartadasPorNoCaber = 0;

    for (const solicitud of fila) {
      const servicio = await this.servicioDe(solicitud);
      if (!servicio) continue;

      const cabe = await this.motorDisponibilidad.cabeUnServicio(input.sucursalId, input.inicioLiberado, servicio.duracionMinutos);
      if (!cabe) {
        descartadasPorNoCaber += 1;
        continue;
      }

      solicitud.ofrecer(input.inicioLiberado, ahora, input.minutosDeVentana);
      const hueco = { inicio: input.inicioLiberado, fin: new Date(input.inicioLiberado.getTime() + servicio.duracionMinutos * 60_000) };

      await this.unitOfWork.ejecutar(async () => {
        await this.listaEspera.guardar(solicitud);
        await this.auditoria.registrar({
          tipoAccion: 'agendamiento',
          actor: actor.sub,
          sucursalRelacionada: solicitud.sucursalId,
          entidadAfectadaTipo: 'solicitud_lista_espera',
          entidadAfectadaId: solicitud.id,
          detalle: {
            accion: 'ofrecer_hueco_lista_espera',
            inicioLiberado: input.inicioLiberado.toISOString(),
            expiraEn: solicitud.expiraEn?.toISOString(),
            descartadasPorNoCaber,
          },
        });
      });

      // FUERA de la transacción: ver la nota del puerto. Un envío no se deshace con `ROLLBACK`.
      await this.notificacion.ofertaDeHueco(solicitud, hueco);

      return { ofrecida: solicitud, descartadasPorNoCaber };
    }

    return { ofrecida: null, descartadasPorNoCaber };
  }

  /**
   * `null` si el servicio ya no existe o no es agendable. Se **salta** la solicitud en vez de
   * fallar: una fila entera no puede quedarse bloqueada porque alguien borró un servicio del
   * catálogo, y tratarlo como error dejaría a las demás sin su turno.
   */
  private async servicioDe(solicitud: SolicitudListaEspera) {
    try {
      return await this.resolutorDeServicio.resolver(solicitud.servicioId);
    } catch (error) {
      if (error instanceof DomainError) return null;
      throw error;
    }
  }
}

/**
 * Cierra los turnos vencidos y pasa el hueco a la siguiente de la fila (`DEC-039`).
 *
 * POR QUÉ ES UN CASO DE USO Y NO UN DAEMON. Blanc no tiene todavía planificador —ni cron, ni
 * worker, ni `@nestjs/schedule`— y esta es la primera funcionalidad que lo necesitaría. Montar
 * esa infraestructura es una decisión de arquitectura con su propia ADR, no un detalle de esta
 * entrega. Exponerlo como caso de uso invocable por HTTP lo deja **operable hoy** (la Encargada
 * lo dispara, o un job runner externo lo llama cada pocos minutos) y **sin reescribir nada**
 * cuando el planificador exista: solo cambia quién llama.
 */
@Injectable()
export class AvanzarTurnoListaEsperaUseCase {
  constructor(
    @Inject(LISTA_ESPERA_REPOSITORY) private readonly listaEspera: ListaEsperaRepository,
    private readonly procesarListaEspera: ProcesarListaEsperaUseCase,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(
    input: { minutosDeVentana?: number } = {},
    actor: ClaimsUsuario,
    ahora = new Date(),
  ): Promise<{ expiradas: SolicitudListaEspera[]; nuevasOfertas: SolicitudListaEspera[] }> {
    const vencidas = await this.listaEspera.listarTurnosVencidos(ahora);
    const expiradas: SolicitudListaEspera[] = [];
    const nuevasOfertas: SolicitudListaEspera[] = [];

    for (const solicitud of vencidas) {
      // Releída y revalidada: entre el listado y aquí alguien pudo aceptarla.
      if (!solicitud.turnoVencido(ahora)) continue;

      solicitud.expirar();
      await this.unitOfWork.ejecutar(async () => {
        await this.listaEspera.guardar(solicitud);
        await this.auditoria.registrar({
          tipoAccion: 'agendamiento',
          actor: actor.sub,
          sucursalRelacionada: solicitud.sucursalId,
          entidadAfectadaTipo: 'solicitud_lista_espera',
          entidadAfectadaId: solicitud.id,
          detalle: { accion: 'expirar_turno_lista_espera', fecha: solicitud.fecha },
        });
      });
      expiradas.push(solicitud);

      // El hueco que tenía ofrecido sigue libre: la oferta nunca lo retuvo. Se vuelve a ofrecer
      // ese MISMO hueco a la siguiente de la fila que quepa en él.
      const siguiente = await this.reofrecer(solicitud, input.minutosDeVentana, actor, ahora);
      if (siguiente) nuevasOfertas.push(siguiente);
    }

    return { expiradas, nuevasOfertas };
  }

  /**
   * Reofrece a la siguiente de la fila **el mismo hueco** que la oferta vencida tenía abierto.
   *
   * El hueco sale de `huecoInicio`, no de `notificadaEn`: uno es qué se ofreció y el otro cuándo
   * se avisó. Confundirlos hacía que se reevaluara un horario del pasado y que el turno **nunca**
   * pasara a la siguiente — el avance FIFO quedaba roto en silencio.
   *
   * `procesarHuecoLiberado` revalida que el hueco siga libre y vuelva a caber, así que si alguien
   * lo tomó mientras la oferta estaba abierta, simplemente no se ofrece a nadie. Eso es correcto:
   * la oferta nunca retuvo nada (`RN-AGE-13`).
   */
  private async reofrecer(
    vencida: SolicitudListaEspera,
    minutosDeVentana: number | undefined,
    actor: ClaimsUsuario,
    ahora: Date,
  ): Promise<SolicitudListaEspera | null> {
    if (!vencida.huecoInicio) return null;

    const resultado = await this.procesarListaEspera.procesarHuecoLiberado(
      { sucursalId: vencida.sucursalId, inicioLiberado: vencida.huecoInicio, minutosDeVentana },
      actor,
      ahora,
    );
    return resultado.ofrecida;
  }
}

/**
 * La clienta acepta la oferta y **se agenda la cita de verdad**.
 *
 * REUTILIZA `AgendarCitaUseCase` en vez de duplicar su lógica, y eso es lo que hace que la
 * aceptación respete todo lo que una reserva normal respeta: elección de silla, capacidad
 * `MIN(sillas, manicuristas)`, horario de la sucursal, las restricciones `EXCLUDE` y el
 * `cotizacion_snapshot` congelado desde el catálogo. Una implementación propia habría acabado
 * divergiendo.
 *
 * **Aquí es donde se resuelve la carrera** (`RN-AGE-13`): si otra clienta tomó el horario mientras
 * la oferta estaba abierta, este caso de uso falla con `409 HORARIO_NO_DISPONIBLE` y la solicitud
 * **se queda `notificada`** — no se da por aceptada ni se expira. La clienta sigue en su turno y
 * puede aceptar otro hueco.
 */
@Injectable()
export class AceptarOfertaListaEsperaUseCase {
  constructor(
    @Inject(LISTA_ESPERA_REPOSITORY) private readonly listaEspera: ListaEsperaRepository,
    private readonly agendarCita: AgendarCitaUseCase,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(
    input: { solicitudId: string; inicio: Date; manicuristaId?: string | null },
    actor: ClaimsUsuario,
    ahora = new Date(),
  ): Promise<{ solicitud: SolicitudListaEspera; cita: Cita }> {
    const solicitud = await this.listaEspera.buscarPorId(input.solicitudId);
    if (!solicitud) throw new RecursoNoEncontradoError('SolicitudListaEspera', input.solicitudId);

    if (solicitud.turnoVencido(ahora)) {
      // No se expira aquí: eso es trabajo de `AvanzarTurnoListaEsperaUseCase`, que además avisa a
      // la siguiente. Mezclarlo haría que aceptar tarde moviera la fila como efecto colateral.
      throw new ConflictoDeNegocioError('LISTA_ESPERA_TURNO_VENCIDO', 'El turno de esta solicitud ya expiró.', {
        solicitudId: solicitud.id,
        expiraEn: solicitud.expiraEn?.toISOString(),
      });
    }

    // Una sola transacción para la cita y la solicitud: `DrizzleUnitOfWork` se une a la que abra
    // el caso de uso externo, así que si la aceptación falla no queda una cita huérfana.
    return this.unitOfWork.ejecutar(async () => {
      const cita = await this.agendarCita.ejecutar(
        {
          sucursalId: solicitud.sucursalId,
          servicioId: solicitud.servicioId,
          clientaId: solicitud.clientaId,
          inicio: input.inicio,
          manicuristaId: input.manicuristaId ?? null,
        },
        actor,
      );

      solicitud.aceptar(cita.id);
      await this.listaEspera.guardar(solicitud);

      await this.auditoria.registrar({
        tipoAccion: 'agendamiento',
        actor: actor.sub,
        sucursalRelacionada: solicitud.sucursalId,
        entidadAfectadaTipo: 'solicitud_lista_espera',
        entidadAfectadaId: solicitud.id,
        detalle: { accion: 'aceptar_oferta_lista_espera', citaId: cita.id, inicio: input.inicio.toISOString() },
      });

      return { solicitud, cita };
    });
  }
}

/** Baja voluntaria de la fila, o la Encargada limpiando una solicitud que ya no aplica. */
@Injectable()
export class CancelarSolicitudListaEsperaUseCase {
  constructor(
    @Inject(LISTA_ESPERA_REPOSITORY) private readonly listaEspera: ListaEsperaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: { solicitudId: string }, actor: ClaimsUsuario): Promise<SolicitudListaEspera> {
    const solicitud = await this.listaEspera.buscarPorId(input.solicitudId);
    if (!solicitud) throw new RecursoNoEncontradoError('SolicitudListaEspera', input.solicitudId);

    solicitud.cancelar();

    await this.unitOfWork.ejecutar(async () => {
      await this.listaEspera.guardar(solicitud);
      await this.auditoria.registrar({
        tipoAccion: 'agendamiento',
        actor: actor.sub,
        sucursalRelacionada: solicitud.sucursalId,
        entidadAfectadaTipo: 'solicitud_lista_espera',
        entidadAfectadaId: solicitud.id,
        detalle: { accion: 'cancelar_solicitud_lista_espera', fecha: solicitud.fecha },
      });
    });

    return solicitud;
  }
}

/** Lectura de la fila para la Encargada: hoy es la única forma de saber a quién avisar. */
@Injectable()
export class ConsultarListaEsperaUseCase {
  constructor(@Inject(LISTA_ESPERA_REPOSITORY) private readonly listaEspera: ListaEsperaRepository) {}

  ejecutar(input: { sucursalId: string; fecha: string }): Promise<SolicitudListaEspera[]> {
    return this.listaEspera.listarFila(input.sucursalId, input.fecha);
  }
}
