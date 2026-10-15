import { randomUUID } from 'crypto';
import { EstadoDeRiesgo, TipoDeIncidente } from '../../../../database/schema';
import { ConflictoDeNegocioError, DomainError } from '../../../../shared/errors/domain-error';

export interface ClientaProps {
  id: string;
  nombre: string;
  telefono: string;
  telefonoAnterior: string | null;
  estadoDeRiesgo: EstadoDeRiesgo;
  sugeridaListaRoja: boolean;
  cancelacionesOrdinarias: number;
  creadoEn: Date;
}

/**
 * `Clienta` — aggregate raíz de CRM (`RN-CRM-01` a `RN-CRM-07`).
 *
 * ## LA DISTINCIÓN CENTRAL DE ESTA ENTIDAD: SUGERIR NO ES MARCAR
 *
 * `RN-CRM-06` dice que un incidente —no-show, cancelación o reagendo a 60 minutos o menos—
 * *"activa la sugerencia"*. `RN-CRM-05` dice que la asignación *"es manual... el sistema solo
 * sugiere, nunca decide por sí mismo"*, y `DEC-042` reserva esa decisión **a la Dueña**.
 *
 * **No se contradicen: hablan de dos cosas distintas**, y por eso aquí son dos campos separados:
 *
 * - `sugeridaListaRoja` — la enciende el sistema, sola, ante cualquier incidente. Es una alerta.
 * - `estadoDeRiesgo` — solo lo cambia una persona, y el RBAC la restringe a la Dueña.
 *
 * Fusionarlos en un solo campo *sería* la asignación automática que `RN-CRM-05` prohíbe. Tener
 * dos es lo que permite que el sistema avise sin decidir.
 *
 * ## NO RETROACTIVIDAD (`RN-CRM-07`)
 *
 * Marcar lista roja **no toca las citas ya confirmadas**: *"si ya tenía una cita hecha no es lista
 * roja, pero si es para volver a agendar... se pide anticipo"*. Por eso esta entidad no conoce
 * ninguna cita: el estado se consulta **al agendar**, y lo ya agendado no se revisa. Mismo
 * principio que `RN-AGE-08` con el snapshot de cotización.
 */
export class Clienta {
  private constructor(private props: ClientaProps) {}

  static registrar(input: { nombre: string; telefono: string }): Clienta {
    const nombre = input.nombre.trim();
    const telefono = normalizarTelefono(input.telefono);

    if (nombre.length === 0) {
      throw new DomainError('CLIENTA_NOMBRE_REQUERIDO', 'El nombre de la clienta no puede estar vacío.', 400);
    }

    return new Clienta({
      id: randomUUID(),
      nombre,
      telefono,
      telefonoAnterior: null,
      estadoDeRiesgo: 'normal',
      sugeridaListaRoja: false,
      cancelacionesOrdinarias: 0,
      creadoEn: new Date(),
    });
  }

  static reconstruir(props: ClientaProps): Clienta {
    return new Clienta(props);
  }

  /**
   * Cambio de número, conservando el anterior para poder reencontrarla.
   *
   * **Solo se guarda un nivel de historia**, y es una decisión, no un descuido: dos cambios
   * seguidos pierden el número más viejo. Con una cadena completa haría falta otra tabla, y el
   * caso real que esto resuelve es *"cambié de número y te escribo desde el nuevo"*, donde el
   * dato útil es el inmediatamente anterior. Si aparece la necesidad de la cadena, es aditivo.
   */
  cambiarTelefono(nuevoTelefono: string): void {
    const nuevo = normalizarTelefono(nuevoTelefono);
    if (nuevo === this.props.telefono) {
      throw new ConflictoDeNegocioError('CLIENTA_TELEFONO_SIN_CAMBIO', 'El teléfono nuevo es igual al actual.', {
        clientaId: this.props.id,
      });
    }

    this.props.telefonoAnterior = this.props.telefono;
    this.props.telefono = nuevo;
  }

  /**
   * Registra un incidente y **enciende la sugerencia** (`RN-CRM-06`).
   *
   * No cambia `estadoDeRiesgo`: eso es de la Dueña. Si la clienta ya está `bloqueada` la
   * sugerencia no se enciende — bloqueada es más severo que lista roja, y dejar pendiente un
   * "márcala lista roja" sobre alguien ya bloqueada invita a rebajarle la severidad al atender la
   * alerta. El `CHECK` de la migración impide además que esa combinación exista.
   */
  registrarIncidente(_tipo: TipoDeIncidente): void {
    if (this.props.estadoDeRiesgo === 'bloqueada') return;
    this.props.sugeridaListaRoja = true;
  }

  /**
   * Cancelación con más de 60 minutos de antelación: **se cuenta, pero NO sugiere nada**.
   *
   * `RN-CRM-06` es explícita en que el disparador *"no es un umbral acumulado (no se cuentan N
   * cancelaciones en una ventana de días)"*. El contador existe porque `RN-CRM-05` dice que se
   * sugiere *"con base en historial de cancelaciones"* y la Dueña necesita ese contexto al decidir
   * — pero encender la sugerencia con él convertiría la regla en el umbral acumulado que fue
   * descartado expresamente.
   */
  registrarCancelacionOrdinaria(): void {
    this.props.cancelacionesOrdinarias += 1;
  }

  /** La Dueña acepta la sugerencia, o marca por su cuenta. El RBAC restringe quién llega aquí. */
  marcarListaRoja(): void {
    if (this.props.estadoDeRiesgo === 'lista_roja') {
      throw new ConflictoDeNegocioError('CLIENTA_YA_EN_LISTA_ROJA', 'La clienta ya está en lista roja.', { clientaId: this.props.id });
    }
    this.props.estadoDeRiesgo = 'lista_roja';
    // La sugerencia se apaga: ya se atendió. Dejarla encendida haría que la alerta reapareciera
    // para siempre sobre una decisión ya tomada.
    this.props.sugeridaListaRoja = false;
  }

  marcarBloqueada(): void {
    if (this.props.estadoDeRiesgo === 'bloqueada') {
      throw new ConflictoDeNegocioError('CLIENTA_YA_BLOQUEADA', 'La clienta ya está bloqueada.', { clientaId: this.props.id });
    }
    this.props.estadoDeRiesgo = 'bloqueada';
    this.props.sugeridaListaRoja = false;
  }

  /**
   * Vuelve a `normal`. Es la "salida manual" que la Dueña controla.
   *
   * **No borra los incidentes ni el contador**: rehabilitar es una decisión sobre el presente, no
   * una amnesia. Si vuelve a fallar, la Dueña tiene que poder ver que ya había pasado antes.
   */
  rehabilitar(): void {
    if (this.props.estadoDeRiesgo === 'normal') {
      throw new ConflictoDeNegocioError('CLIENTA_YA_NORMAL', 'La clienta no está en lista roja ni bloqueada.', {
        clientaId: this.props.id,
      });
    }
    this.props.estadoDeRiesgo = 'normal';
    this.props.sugeridaListaRoja = false;
  }

  /** `RN-CRM-04`: no puede agendar en absoluto. */
  get estaBloqueada(): boolean {
    return this.props.estadoDeRiesgo === 'bloqueada';
  }

  /** `RN-CRM-03`/`RN-ANT-01`: puede agendar, pero su cita nace pendiente de anticipo. */
  get estaEnListaRoja(): boolean {
    return this.props.estadoDeRiesgo === 'lista_roja';
  }

  get id(): string {
    return this.props.id;
  }
  get nombre(): string {
    return this.props.nombre;
  }
  get telefono(): string {
    return this.props.telefono;
  }
  get telefonoAnterior(): string | null {
    return this.props.telefonoAnterior;
  }
  get estadoDeRiesgo(): EstadoDeRiesgo {
    return this.props.estadoDeRiesgo;
  }
  get sugeridaListaRoja(): boolean {
    return this.props.sugeridaListaRoja;
  }
  get cancelacionesOrdinarias(): number {
    return this.props.cancelacionesOrdinarias;
  }
  get creadoEn(): Date {
    return this.props.creadoEn;
  }
}

/** Dígitos que se conservan: el número nacional mexicano. */
export const DIGITOS_DE_TELEFONO_NACIONAL = 10;

/**
 * Deja el teléfono en **los 10 dígitos nacionales**.
 *
 * POR QUÉ SE NORMALIZA. El mismo número llega escrito de cinco formas —`442 123 4567`,
 * `(442) 1234567`, `+52 442 123 4567`— y sin normalizar, buscar fallaría según cómo lo tecleó
 * quien dio el alta. Peor: la restricción de duplicados (nombre + teléfono) no vería que son la
 * misma persona, y la clienta acabaría con dos expedientes y **dos historiales de incidentes
 * partidos por la mitad** — que es justo el dato del que depende si se le pide anticipo.
 *
 * POR QUÉ SE RECORTAN LOS DÍGITOS SOBRANTES Y NO SOLO LOS SÍMBOLOS. Quitar solo los símbolos no
 * basta, y esto no es hipotético: **WhatsApp entrega siempre formato internacional** (`52442…`, y
 * durante años `521442…` para móviles), mientras recepción teclea los 10 de siempre. Con solo
 * quitar símbolos, `+52 442 111 2233` y `442 111 2233` serían números distintos y la misma
 * clienta tendría dos expedientes: uno creado por el bot y otro por el mostrador.
 *
 * Se conservan los **últimos 10** dígitos, que es el número nacional. Eso absorbe el `52` de país
 * y el `1` heredado de los móviles sin tener que enumerar prefijos.
 *
 * ⚠️ **LIMITACIÓN ASUMIDA:** un número extranjero de más de 10 dígitos nacionales se truncaría.
 * Blanc es un salón de Querétaro y sus clientas tienen números mexicanos; si algún día atiende a
 * alguien del extranjero, esto necesita un E.164 completo con código de país guardado aparte.
 */
export function normalizarTelefono(telefono: string): string {
  const soloDigitos = telefono.replace(/\D/g, '');
  if (soloDigitos.length < DIGITOS_DE_TELEFONO_NACIONAL) {
    throw new DomainError('CLIENTA_TELEFONO_INVALIDO', `El teléfono debe tener al menos ${DIGITOS_DE_TELEFONO_NACIONAL} dígitos.`, 400, {
      telefono,
    });
  }
  return soloDigitos.slice(-DIGITOS_DE_TELEFONO_NACIONAL);
}
