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
  /** `true` si es la reposición de un servicio bajo garantía (`RN-GAR-01..06`). */
  esGarantia: boolean;
  /** La cita `completada` que se honra. Inseparable de `esGarantia` (`CHECK` en la base). */
  citaGarantizadaId: string | null;
  /** Cotización congelada al agendar (`04-data-model.md` §5.2). `null` hasta que exista `FL-COT-03`. */
  cotizacionSnapshot: unknown;
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
    esGarantia?: boolean;
    citaGarantizadaId?: string | null;
    cotizacionSnapshot?: unknown;
  }): Cita {
    validarRangoHorario(input.rangoHorario);

    /**
     * **`esGarantia` y `citaGarantizadaId` son inseparables** (`RN-GAR-01..06`).
     *
     * La autoridad es el `CHECK citas_garantia_coherente` de la migración `0016`; esto no lo
     * reemplaza, impide **construir** el estado ilegal. Importa porque su SQLSTATE es `23514` y
     * `HttpExceptionFilter` solo traduce `23505` y `23P01`: sin esta guarda, el descuido de crear
     * una garantía sin la cita que honra —o de apuntar a una sin marcar la bandera— salía como un
     * `500 ERROR_INESPERADO` que no decía qué faltaba.
     *
     * Se valida en `crear` y **no en `reconstruir`**: el camino de vuelta desde la base lee filas
     * que ese `CHECK` ya aprobó, y volver a validarlas convertiría un dato histórico inesperado en
     * una excepción al *leer* la agenda — el peor momento para fallar.
     */
    const esGarantia = input.esGarantia ?? false;
    const citaGarantizadaId = input.citaGarantizadaId ?? null;
    if (esGarantia !== (citaGarantizadaId !== null)) {
      throw new DomainError(
        'CITA_GARANTIA_INCOHERENTE',
        'Una cita de garantía necesita la cita completada que honra, y solo una garantía puede apuntar a una.',
        400,
        { esGarantia, citaGarantizadaId },
      );
    }

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
      esGarantia,
      citaGarantizadaId,
      cotizacionSnapshot: input.cotizacionSnapshot ?? null,
    });
  }

  /**
   * Mueve la cita a otra silla.
   *
   * Legítimo porque **la clienta nunca eligió silla** (`DEC-031`): la elige el sistema y para ella
   * es invisible. Lo usa `ActivarCitaPorAnticipoUseCase` cuando, al confirmarse el pago, la silla
   * que tenía asignada ya fue tomada por otra cita — mejor moverla que rechazar una transferencia
   * ya hecha teniendo la silla de al lado vacía.
   *
   * No valida que la silla esté libre: eso es del caso de uso, y la autoridad final es la
   * restricción `EXCLUDE` al persistir.
   */
  reasignarSilla(sillaId: string): void {
    if (this.esTerminal) {
      throw new DomainError('CITA_TERMINAL_NO_SE_MUEVE', `Una cita en "${this.props.estado}" ya no cambia de silla.`, 409, {
        citaId: this.props.id,
        estado: this.props.estado,
      });
    }
    this.props.sillaId = sillaId;
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
  get esGarantia(): boolean {
    return this.props.esGarantia;
  }

  get citaGarantizadaId(): string | null {
    return this.props.citaGarantizadaId;
  }

  get citaOrigenId(): string | null {
    return this.props.citaOrigenId;
  }
  get numeroDeReprogramaciones(): number {
    return this.props.numeroDeReprogramaciones;
  }
  get cotizacionSnapshot(): unknown {
    return this.props.cotizacionSnapshot;
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
