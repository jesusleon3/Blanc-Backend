import { randomUUID } from 'crypto';
import { EstadoListaEspera } from '../../../../database/schema';
import { ConflictoDeNegocioError, DomainError } from '../../../../shared/errors/domain-error';

/** Ventana por defecto del turno (`DEC-039`). Parametrizable: ver `ofrecer()`. */
export const MINUTOS_DE_VENTANA_POR_DEFECTO = 60;

/**
 * Transiciones legales (`DEC-039`). Mismo patrón que `Cita.TRANSICIONES_LEGALES`: la máquina es
 * un dato, no una cadena de `if`, y la entidad es su única autoridad.
 */
export const TRANSICIONES_LISTA_ESPERA: Readonly<Record<EstadoListaEspera, readonly EstadoListaEspera[]>> = {
  en_espera: ['notificada', 'cancelada'],
  notificada: ['aceptada', 'expirada', 'cancelada'],
  aceptada: [],
  expirada: [],
  cancelada: [],
};

export interface SolicitudListaEsperaProps {
  id: string;
  sucursalId: string;
  clientaId: string;
  servicioId: string;
  /** Fecha de pared `YYYY-MM-DD` en la zona del negocio. */
  fecha: string;
  estado: EstadoListaEspera;
  notificadaEn: Date | null;
  expiraEn: Date | null;
  /** Inicio del hueco ofrecido. Es lo que permite pasar el turno a la siguiente al expirar. */
  huecoInicio: Date | null;
  citaId: string | null;
  creadoEn: Date;
}

/**
 * Solicitud de Lista de Espera (`DEC-039`, reglas 2.2/2.3).
 *
 * **LA OFERTA NO RETIENE EL HUECO.** Notificar a una clienta no bloquea ninguna silla en
 * `agenda.citas`: la ventana de una hora solo gobierna *a quién se avisa primero*, para no
 * escribir a diez personas del mismo horario. Si otra clienta agenda mientras la oferta está
 * abierta, **gana quien agende primero** (`RN-AGE-13`), igual que `RN-ANT-03` resolvió la carrera
 * de los anticipos sin retención real. La alternativa —reservar el hueco durante la ventana—
 * restaría capacidad vendible una hora por cada aviso, y a cambio de nada cuando la clienta no
 * contesta.
 *
 * ⚠️ **`expirada` ES TERMINAL, y eso tiene una consecuencia de negocio que conviene conocer.**
 * Quien deja pasar su turno **pierde su lugar en la fila para esa fecha**: no vuelve al final, se
 * queda fuera. Es la mecánica que fija la orden de trabajo. Si la intención era que solo perdiera
 * *ese hueco concreto* y siguiera esperando otro del mismo día, la transición tendría que volver
 * a `en_espera` — un cambio de una línea en `TRANSICIONES_LISTA_ESPERA` más la decisión de dónde
 * la recoloca el FIFO. **Queda señalado como pregunta para la Dueña**, no resuelto por cuenta
 * propia.
 */
export class SolicitudListaEspera {
  private constructor(private props: SolicitudListaEsperaProps) {}

  static inscribir(input: { sucursalId: string; clientaId: string; servicioId: string; fecha: string }): SolicitudListaEspera {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
      throw new DomainError('LISTA_ESPERA_FECHA_INVALIDA', 'La fecha debe venir como YYYY-MM-DD.', 400, { fecha: input.fecha });
    }

    return new SolicitudListaEspera({
      id: randomUUID(),
      sucursalId: input.sucursalId,
      clientaId: input.clientaId,
      servicioId: input.servicioId,
      fecha: input.fecha,
      estado: 'en_espera',
      notificadaEn: null,
      expiraEn: null,
      huecoInicio: null,
      citaId: null,
      creadoEn: new Date(),
    });
  }

  static reconstruir(props: SolicitudListaEsperaProps): SolicitudListaEspera {
    return new SolicitudListaEspera(props);
  }

  /**
   * Se le ofrece el hueco: empieza a correr su turno.
   *
   * `huecoInicio` es obligatorio y no es lo mismo que `ahora`: uno es **qué** se ofrece y el otro
   * **cuándo** se avisó. Sin guardar el primero, al expirar el turno no se sabría qué hueco pasar
   * a la siguiente de la fila.
   */
  ofrecer(huecoInicio: Date, ahora = new Date(), minutosDeVentana = MINUTOS_DE_VENTANA_POR_DEFECTO): void {
    if (minutosDeVentana <= 0) {
      throw new DomainError('LISTA_ESPERA_VENTANA_INVALIDA', 'La ventana del turno debe ser de al menos un minuto.', 400, {
        minutosDeVentana,
      });
    }

    this.exigirTransicion('notificada');
    this.props.estado = 'notificada';
    this.props.notificadaEn = ahora;
    this.props.expiraEn = new Date(ahora.getTime() + minutosDeVentana * 60_000);
    this.props.huecoInicio = huecoInicio;
  }

  /** Aceptó y la cita ya existe. El id es obligatorio: una aceptación sin cita no agendó nada. */
  aceptar(citaId: string): void {
    this.exigirTransicion('aceptada');
    this.props.estado = 'aceptada';
    this.props.citaId = citaId;
  }

  /** Se le pasó el turno. Ver la advertencia de la cabecera: es terminal. */
  expirar(): void {
    this.exigirTransicion('expirada');
    this.props.estado = 'expirada';
  }

  cancelar(): void {
    this.exigirTransicion('cancelada');
    this.props.estado = 'cancelada';
    // Se limpia la ventana: una fila cancelada con `expira_en` invitaría a creer que su turno
    // sigue corriendo, y el `CHECK` de la migración la admite precisamente porque ya no corre.
    this.props.notificadaEn = null;
    this.props.expiraEn = null;
    this.props.huecoInicio = null;
  }

  /** `true` si su turno ya venció. Para una solicitud que no está `notificada`, siempre `false`. */
  turnoVencido(ahora = new Date()): boolean {
    return this.props.estado === 'notificada' && this.props.expiraEn !== null && this.props.expiraEn.getTime() <= ahora.getTime();
  }

  get sigueEnLaFila(): boolean {
    return this.props.estado === 'en_espera' || this.props.estado === 'notificada';
  }

  private exigirTransicion(destino: EstadoListaEspera): void {
    if (!TRANSICIONES_LISTA_ESPERA[this.props.estado].includes(destino)) {
      throw new ConflictoDeNegocioError(
        'LISTA_ESPERA_TRANSICION_INVALIDA',
        `Una solicitud en "${this.props.estado}" no puede pasar a "${destino}".`,
        { solicitudId: this.props.id, estadoActual: this.props.estado, estadoDestino: destino },
      );
    }
  }

  get id(): string {
    return this.props.id;
  }
  get sucursalId(): string {
    return this.props.sucursalId;
  }
  get clientaId(): string {
    return this.props.clientaId;
  }
  get servicioId(): string {
    return this.props.servicioId;
  }
  get fecha(): string {
    return this.props.fecha;
  }
  get estado(): EstadoListaEspera {
    return this.props.estado;
  }
  get notificadaEn(): Date | null {
    return this.props.notificadaEn;
  }
  get expiraEn(): Date | null {
    return this.props.expiraEn;
  }
  get huecoInicio(): Date | null {
    return this.props.huecoInicio;
  }
  get citaId(): string | null {
    return this.props.citaId;
  }
  get creadoEn(): Date {
    return this.props.creadoEn;
  }
}
