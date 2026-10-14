import { randomUUID } from 'crypto';
import { DomainError } from '../../../../shared/errors/domain-error';
import { ESTADOS_CITA, ESTADOS_QUE_LIBERAN_HORARIO, EstadoCita, RangoHorario } from '../../../../database/schema/agenda.schema';

export interface CitaProps {
  id: string;
  sucursalId: string;
  sillaId: string;
  manicuristaId: string | null;
  clientaId: string;
  servicioId: string;
  rangoHorario: RangoHorario;
  estado: EstadoCita;
  citaOrigenId: string | null;
  numeroDeReprogramaciones: number;
}

/**
 * Máquina de estados formal de `Cita` — **cierre de `P3`** (2026-10-14).
 *
 * `04-data-model.md` dejó constancia de que sin esta tabla "cualquier lógica de transición no
 * puede implementarse". Aquí está, y es la **única** autoridad sobre qué movimiento es legal:
 * los casos de uso no repiten estas reglas, las invocan.
 *
 * ```
 *   [en_espera_pago] ──pago confirmado──► agendada ──► pendiente_confirmacion ──► confirmada
 *          │                                 │                  │                     │
 *          └──expira──► expirada             └──────────────┬───┴─────────────────────┘
 *                                                           ▼
 *                                              completada  │  no_show
 *
 *   Desde cualquier estado activo pre-ejecución ──► cancelada | reprogramada
 * ```
 *
 * DECISIONES QUE CONVIENE CONOCER:
 *
 * - **`agendada`/`pendiente_confirmacion` pueden ir DIRECTO a `completada`/`no_show`.** Llegó la
 *   hora y la clienta vino (o no) sin haber contestado el recordatorio. Es el caso corriente, no
 *   la excepción: exigir pasar por `confirmada` dejaría citas atrapadas.
 * - **`agendada → confirmada` NO es legal.** La confirmación es interactiva (`RN-CONV-11`) y
 *   responde a un recordatorio; sin haberlo pedido no hay nada que confirmar. Si el negocio
 *   necesita confirmar sin recordatorio previo, es una transición a añadir conscientemente.
 * - **`agendada → en_espera_pago` NO es legal.** El anticipo se exige al agendar, no después:
 *   `RN-CRM-07` dice que la lista roja no aplica retroactivamente a citas ya confirmadas.
 * - **`completada → no_show` SÍ es legal**, y es la única salida de un estado de cierre: es una
 *   corrección administrativa, no un flujo normal. Ver `N-02`.
 * - **Los otros cuatro terminales no tienen salida.** Incluido `reprogramada`: la cita nueva es
 *   otra fila, enlazada por `citaOrigenId`.
 */
export const TRANSICIONES_LEGALES: Readonly<Record<EstadoCita, readonly EstadoCita[]>> = {
  agendada: ['pendiente_confirmacion', 'completada', 'no_show', 'cancelada', 'reprogramada'],
  pendiente_confirmacion: ['confirmada', 'completada', 'no_show', 'cancelada', 'reprogramada'],
  confirmada: ['completada', 'no_show', 'cancelada', 'reprogramada'],
  en_espera_pago: ['agendada', 'confirmada', 'expirada', 'cancelada', 'reprogramada'],
  // `N-02` CERRADO (2026-10-14): corrección administrativa. `completada` la pone un job por el
  // paso del tiempo (`DEC-030`), mientras que `no_show` es manual y la Encargada puede
  // descubrirlo horas después. Sin esta transición, un no-show detectado a la mañana siguiente
  // sería incorregible — y `RN-CRM-06` perdería casos reales de sugerencia de lista roja.
  // No altera los predicados `EXCLUDE`: ambos estados ocupan horario.
  completada: ['no_show'],
  no_show: [],
  cancelada: [],
  expirada: [],
  reprogramada: [],
};

/** Estados con los que una cita puede NACER: el normal y el de lista roja (`RN-ANT-01`). */
export const ESTADOS_INICIALES = ['agendada', 'en_espera_pago'] as const satisfies readonly EstadoCita[];

/**
 * `Cita` — aggregate raíz de la Agenda.
 *
 * **ALCANCE DE ESTE INCREMENTO:** es deliberadamente anémica. La orden de trabajo del kick-off de
 * Fase 2 cubre esquema, migraciones y repositorios base — **no** casos de uso. Las transiciones de
 * estado (confirmar, cancelar, reprogramar, no-show) y las validaciones de negocio (horario de la
 * sucursal, corte de mediodía `RN-AGE-10`, duración según catálogo) **no se implementan aquí** y
 * son el siguiente incremento. Esta clase existe para que los repositorios tengan algo que mapear,
 * no para modelar todavía el ciclo de vida completo.
 *
 * **Lo que sí garantiza:** que un rango sea coherente, que el estado pertenezca a la lista válida,
 * y que `silla_id` nunca sea nulo — el invariante del patrón de Sillas Virtuales.
 */
export class Cita {
  private constructor(private props: CitaProps) {}

  static crear(input: {
    sucursalId: string;
    sillaId: string;
    clientaId: string;
    servicioId: string;
    rangoHorario: RangoHorario;
    manicuristaId?: string | null;
    estado?: EstadoCita;
    citaOrigenId?: string | null;
    numeroDeReprogramaciones?: number;
  }): Cita {
    validarRangoHorario(input.rangoHorario);

    const estado = input.estado ?? 'agendada';
    if (!(ESTADOS_INICIALES as readonly string[]).includes(estado)) {
      throw new DomainError(
        'CITA_ESTADO_INICIAL_INVALIDO',
        `Una cita no puede nacer en estado "${estado}". Solo ${ESTADOS_INICIALES.join(' o ')}.`,
        400,
        { estado },
      );
    }

    return new Cita({
      id: randomUUID(),
      sucursalId: input.sucursalId,
      sillaId: input.sillaId,
      // `null` = sin preferencia de manicurista. La Encargada la asigna cuando la clienta llega
      // (`DEC-031` §2.4). NO es un dato que falte: es una decisión aplazada a propósito.
      manicuristaId: input.manicuristaId ?? null,
      clientaId: input.clientaId,
      servicioId: input.servicioId,
      rangoHorario: input.rangoHorario,
      estado,
      citaOrigenId: input.citaOrigenId ?? null,
      numeroDeReprogramaciones: input.numeroDeReprogramaciones ?? 0,
    });
  }

  static reconstruir(props: CitaProps): Cita {
    return new Cita(props);
  }

  /**
   * Asignación de manicurista en mostrador (`DEC-031` §2.4).
   *
   * Aquí **no** se comprueba si esa manicurista ya está ocupada: lo garantiza la restricción
   * `citas_manicurista_sin_solapamiento` en la base de datos, que es no evadible. Duplicar la
   * comprobación en memoria daría una falsa sensación de seguridad y podría divergir.
   */
  asignarManicurista(manicuristaId: string): void {
    this.props.manicuristaId = manicuristaId;
  }

  /**
   * Única puerta para mover el estado. Valida contra `TRANSICIONES_LEGALES`; **los casos de uso no
   * repiten estas reglas**, las invocan — si estuvieran en dos sitios acabarían divergiendo.
   */
  cambiarEstado(estado: EstadoCita): void {
    if (!ESTADOS_CITA.includes(estado)) {
      throw new DomainError('CITA_ESTADO_INVALIDO', `"${estado}" no es un estado de cita válido.`, 400, { estado });
    }

    const permitidos = TRANSICIONES_LEGALES[this.props.estado];
    if (!permitidos.includes(estado)) {
      throw new DomainError(
        'TRANSICION_ESTADO_INVALIDA',
        permitidos.length === 0
          ? `"${this.props.estado}" es un estado terminal: una cita ahí ya no se mueve.`
          : `No se puede pasar de "${this.props.estado}" a "${estado}". Desde ahí solo: ${permitidos.join(', ')}.`,
        409,
        { desde: this.props.estado, hacia: estado, permitidos },
      );
    }

    this.props.estado = estado;
  }

  /** ¿Es terminal? Útil para que un caso de uso falle pronto con un mensaje mejor. */
  get esTerminal(): boolean {
    return TRANSICIONES_LEGALES[this.props.estado].length === 0;
  }

  /** ¿Esta cita ocupa su horario? (`DEC-034`) — liberan `cancelada`, `expirada` y `reprogramada`. */
  get ocupaHorario(): boolean {
    return !(ESTADOS_QUE_LIBERAN_HORARIO as readonly string[]).includes(this.props.estado);
  }

  get id(): string {
    return this.props.id;
  }
  get sucursalId(): string {
    return this.props.sucursalId;
  }
  get sillaId(): string {
    return this.props.sillaId;
  }
  get manicuristaId(): string | null {
    return this.props.manicuristaId;
  }
  get clientaId(): string {
    return this.props.clientaId;
  }
  get servicioId(): string {
    return this.props.servicioId;
  }
  get rangoHorario(): RangoHorario {
    return this.props.rangoHorario;
  }
  get estado(): EstadoCita {
    return this.props.estado;
  }
  get citaOrigenId(): string | null {
    return this.props.citaOrigenId;
  }
  get numeroDeReprogramaciones(): number {
    return this.props.numeroDeReprogramaciones;
  }
}

/**
 * Validación del rango, exportada para que un caso de uso pueda ejecutarla **antes** de consultar
 * la base: un `tstzrange` invertido hace que PostgreSQL lance un error crudo ("range lower bound
 * must be less than or equal to range upper bound") en lugar de un error de dominio legible.
 */
export function validarRangoHorario(rango: RangoHorario): void {
  if (Number.isNaN(rango.inicio.getTime()) || Number.isNaN(rango.fin.getTime())) {
    throw new DomainError('CITA_RANGO_INVALIDO', 'El rango horario contiene una fecha inválida.', 400);
  }
  if (rango.fin.getTime() <= rango.inicio.getTime()) {
    throw new DomainError('CITA_RANGO_INVALIDO', 'El fin de la cita debe ser posterior a su inicio.', 400, {
      inicio: rango.inicio.toISOString(),
      fin: rango.fin.toISOString(),
    });
  }
}
