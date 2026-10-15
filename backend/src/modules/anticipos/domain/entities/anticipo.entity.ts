import { randomUUID } from 'crypto';
import { EstadoAnticipo } from '../../../../database/schema';
import { ConflictoDeNegocioError, DomainError } from '../../../../shared/errors/domain-error';

/**
 * Porcentaje del valor del servicio que se pide como anticipo.
 *
 * **40%, dicho por la Dueña** (`DISCOVERY_CHECKLIST.md` 1.13, 2026-08-04: *"se pide el 40% del
 * servicio como anticipo"*), y registrado en las Notas de `RN-ANT-01` como *"dato crítico que no
 * existía en ningún documento previo"*.
 *
 * Es **parametrizable** —`GenerarAnticipoUseCase` acepta otro porcentaje— porque el día que
 * cambie no debería exigir un despliegue para una cita suelta. Pero el valor por defecto es el
 * que ella fijó, no un número de relleno: poner otro sería sustituir en silencio una decisión de
 * negocio ya tomada.
 */
export const PORCENTAJE_DE_ANTICIPO_POR_DEFECTO = 40;

/**
 * Transiciones legales. Mismo patrón que `Cita` y `SolicitudListaEspera`: la máquina es un dato y
 * la entidad su única autoridad.
 *
 * `pagado → retenido` es `RN-ANT-04` (no hay reembolso). **No existe `pagado → pendiente`** ni
 * nada que devuelva el dinero: esa ausencia *es* la regla.
 */
export const TRANSICIONES_ANTICIPO: Readonly<Record<EstadoAnticipo, readonly EstadoAnticipo[]>> = {
  pendiente: ['pagado', 'expirado'],
  pagado: ['retenido'],
  expirado: [],
  retenido: [],
};

export interface AnticipoProps {
  id: string;
  citaId: string;
  clientaId: string;
  montoCentavos: number;
  porcentajeAplicado: number | null;
  estado: EstadoAnticipo;
  referenciaPago: string | null;
  confirmadoPor: string | null;
  confirmadoEn: Date | null;
  creadoEn: Date;
}

/**
 * `Anticipo` — aggregate raíz del Bounded Context de Anticipos (`RN-ANT-01` a `RN-ANT-04`).
 *
 * ## LO QUE ESTA ENTIDAD *NO* HACE, Y ES LO MÁS IMPORTANTE
 *
 * **No retiene ningún horario.** `RN-ANT-03` fue corregida por la Dueña: *"Hasta que se dé el
 * anticipo se agenda, si no el espacio sigue libre"*. No hay ventana de gracia, porque nunca hubo
 * retención que liberar. Mientras el anticipo está `pendiente`, la cita vive en `en_espera_pago`,
 * que **libera** silla y manicurista, y cualquier otra clienta puede tomar el hueco.
 *
 * El texto de `RN-ANT-02` todavía dice *"con el horario retenido temporalmente"*: está **superado
 * por `RN-ANT-03`**, que es posterior y más explícita. La contradicción ya se resolvió a favor de
 * `RN-ANT-03` en la migración `0007`, y se repite aquí para que nadie la reabra leyendo solo
 * `RN-ANT-02`.
 *
 * **Consecuencia práctica, y es el corazón de esta parte:** la carrera por el hueco **no se
 * resuelve aquí sino al confirmar el pago**, cuando la cita intenta pasar a `agendada` y se topa
 * con la restricción `EXCLUDE` de PostgreSQL. Quien confirma primero se queda con el cupo.
 */
export class Anticipo {
  private constructor(private props: AnticipoProps) {}

  /**
   * Genera el anticipo de una cita.
   *
   * `montoCentavos` explícito tiene prioridad sobre el cálculo por porcentaje, y existe para el
   * caso de `DEC-033`: un servicio cuyo precio lo fija una persona no tiene base sobre la que
   * aplicar un 40%, así que el monto lo dice quien cotizó.
   */
  static generar(input: {
    citaId: string;
    clientaId: string;
    /** Base de cálculo: el total del `cotizacion_snapshot`. `null` si el servicio es manual. */
    baseCentavos: number | null;
    montoCentavos?: number;
    porcentaje?: number;
  }): Anticipo {
    const { montoCentavos, porcentajeAplicado } = Anticipo.calcularMonto(input);

    return new Anticipo({
      id: randomUUID(),
      citaId: input.citaId,
      clientaId: input.clientaId,
      montoCentavos,
      porcentajeAplicado,
      estado: 'pendiente',
      referenciaPago: null,
      confirmadoPor: null,
      confirmadoEn: null,
      creadoEn: new Date(),
    });
  }

  private static calcularMonto(input: { baseCentavos: number | null; montoCentavos?: number; porcentaje?: number }): {
    montoCentavos: number;
    porcentajeAplicado: number | null;
  } {
    if (input.montoCentavos !== undefined) {
      if (!Number.isInteger(input.montoCentavos) || input.montoCentavos <= 0) {
        throw new DomainError('ANTICIPO_MONTO_INVALIDO', 'El monto del anticipo debe ser un entero de centavos mayor que cero.', 400, {
          montoCentavos: input.montoCentavos,
        });
      }
      // Sin porcentaje: lo fijó una persona, y un `0` mentiría sobre cómo se calculó.
      return { montoCentavos: input.montoCentavos, porcentajeAplicado: null };
    }

    const porcentaje = input.porcentaje ?? PORCENTAJE_DE_ANTICIPO_POR_DEFECTO;
    if (!Number.isInteger(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
      throw new DomainError('ANTICIPO_PORCENTAJE_INVALIDO', 'El porcentaje del anticipo debe ser un entero entre 1 y 100.', 400, {
        porcentaje,
      });
    }

    if (input.baseCentavos === null) {
      // `DEC-033`: el sistema NO inventa un precio. Es el mismo principio que hace que
      // `cotizacion_snapshot.totalCentavos` sea `null` en vez de `0` para estos servicios.
      throw new ConflictoDeNegocioError(
        'ANTICIPO_SIN_BASE_DE_CALCULO',
        'Este servicio requiere cotización manual, así que el monto del anticipo tiene que indicarse explícitamente.',
        { porcentajeQueNoSePudoAplicar: porcentaje },
      );
    }

    if (!Number.isInteger(input.baseCentavos) || input.baseCentavos <= 0) {
      throw new ConflictoDeNegocioError(
        'ANTICIPO_SIN_BASE_DE_CALCULO',
        'La cita no tiene un precio del que calcular el anticipo; indícalo explícitamente.',
        { baseCentavos: input.baseCentavos },
      );
    }

    // `Math.round` y no truncar: truncar regalaría hasta un centavo en cada anticipo, y redondear
    // siempre hacia arriba cobraría de más. El resultado tiene que ser entero (`RN-COT-07`).
    const montoCentavos = Math.round((input.baseCentavos * porcentaje) / 100);
    if (montoCentavos <= 0) {
      throw new ConflictoDeNegocioError('ANTICIPO_MONTO_INVALIDO', 'El anticipo calculado sería de cero; revisa el precio del servicio.', {
        baseCentavos: input.baseCentavos,
        porcentaje,
      });
    }

    return { montoCentavos, porcentajeAplicado: porcentaje };
  }

  static reconstruir(props: AnticipoProps): Anticipo {
    return new Anticipo(props);
  }

  /**
   * Una persona vio el comprobante de la transferencia.
   *
   * La referencia es **obligatoria**: sin ella, un anticipo "pagado" no se puede verificar después,
   * y es justo el dato que hace falta cuando la clienta afirme que sí pagó. El `CHECK` de la
   * migración lo impone también en la base.
   */
  confirmarPago(input: { referenciaPago: string; confirmadoPor: string }, ahora = new Date()): void {
    const referencia = input.referenciaPago.trim();
    if (referencia.length === 0) {
      throw new DomainError('ANTICIPO_REFERENCIA_REQUERIDA', 'Hay que registrar la referencia de la transferencia.', 400);
    }

    this.exigirTransicion('pagado');
    this.props.estado = 'pagado';
    this.props.referenciaPago = referencia;
    this.props.confirmadoPor = input.confirmadoPor;
    this.props.confirmadoEn = ahora;
  }

  /**
   * Nunca llegó la transferencia.
   *
   * ⚠️ **ESTO NO ES LA "LIBERACIÓN AUTOMÁTICA" DE `RN-ANT-03`**, y conviene no confundirlos: esa
   * regla dice que *no hay nada que liberar* porque el horario nunca estuvo retenido. Expirar es
   * **limpieza de una solicitud muerta**: sin ella, la cita se quedaría en `en_espera_pago` para
   * siempre, apareciendo en la agenda del día como algo pendiente de cobrar que nadie va a pagar.
   *
   * Y por eso **es explícito, no un temporizador**: lo dispara una persona o un job runner. Blanc
   * no tiene planificador (ver la deuda de Fase 2 sobre `avanzar-turno`), y fingir una expiración
   * automática que nada dispara sería peor que no tenerla.
   */
  expirar(): void {
    this.exigirTransicion('expirado');
    this.props.estado = 'expirado';
  }

  /**
   * La cita murió (cancelada o no-show) con el anticipo ya pagado: **el dinero se queda**.
   *
   * `RN-ANT-04`: *"Ningún anticipo pagado se reembolsa, bajo ninguna circunstancia... Si la
   * clienta no se presenta habiendo pagado, tampoco se devuelve."*
   */
  retener(): void {
    this.exigirTransicion('retenido');
    this.props.estado = 'retenido';
  }

  /** `true` si el dinero está en poder del salón. Es lo que `RN-ANT-04` consulta. */
  get estaPagado(): boolean {
    return this.props.estado === 'pagado';
  }

  private exigirTransicion(destino: EstadoAnticipo): void {
    if (!TRANSICIONES_ANTICIPO[this.props.estado].includes(destino)) {
      throw new ConflictoDeNegocioError(
        'ANTICIPO_TRANSICION_INVALIDA',
        `Un anticipo en "${this.props.estado}" no puede pasar a "${destino}".`,
        { anticipoId: this.props.id, estadoActual: this.props.estado, estadoDestino: destino },
      );
    }
  }

  get id(): string {
    return this.props.id;
  }
  get citaId(): string {
    return this.props.citaId;
  }
  get clientaId(): string {
    return this.props.clientaId;
  }
  get montoCentavos(): number {
    return this.props.montoCentavos;
  }
  get porcentajeAplicado(): number | null {
    return this.props.porcentajeAplicado;
  }
  get estado(): EstadoAnticipo {
    return this.props.estado;
  }
  get referenciaPago(): string | null {
    return this.props.referenciaPago;
  }
  get confirmadoPor(): string | null {
    return this.props.confirmadoPor;
  }
  get confirmadoEn(): Date | null {
    return this.props.confirmadoEn;
  }
  get creadoEn(): Date {
    return this.props.creadoEn;
  }
}
