import { MotivoDeEscalamiento } from '../../../database/schema';
import { Intencion, TipoDeIntencion } from './intencion';

/**
 * Palabras y frases que **obligan** a escalar, antes de consultar al modelo.
 *
 * ## POR QUÉ UN FILTRO DETERMINISTA *ANTES* DEL LLM
 *
 * Son los casos en los que equivocarse es caro y no se puede delegar a un clasificador
 * probabilístico:
 *
 * - **Cancelar** (`DEC-040`): *ninguna clienta cancela sola con el bot*. Si el modelo clasificara
 *   mal un "ya no voy a poder ir", el bot seguiría la conversación como si nada y la clienta
 *   creería que canceló.
 * - **Pedir una persona**: si alguien escribe *"quiero hablar con una persona"* y el bot insiste
 *   en atenderla, el daño a la relación ya está hecho. Esto cierra el pendiente de las palabras de
 *   activación.
 * - **Queja**: lo mismo, con más motivo.
 *
 * El filtro corre **primero** y, si acierta, **el modelo no se invoca**. Luego el modelo puede
 * además devolver una intención de escalamiento, y también se respeta: son dos capas, no una
 * alternativa. Defensa en profundidad, el mismo criterio con el que el no-doble-booking confía en
 * PostgreSQL y no solo en el motor de disponibilidad.
 *
 * ## LA LISTA ES CONFIGURABLE, PERO LAS CATEGORÍAS NO
 *
 * Las frases se pueden ampliar sin tocar código de decisión (es un dato). Lo que no se puede
 * cambiar sin modificar una regla de negocio es **qué categorías escalan**: eso lo fijan `DEC-040`
 * y `RN-ESC-01`.
 */
export const FRASES_DE_ESCALAMIENTO: Readonly<Record<string, readonly string[]>> = {
  cancelacion_solicitada: [
    'cancelar',
    'cancela',
    'cancelo',
    'ya no quiero',
    'ya no voy',
    'ya no podre',
    'ya no podré',
    'no voy a poder ir',
    'dar de baja mi cita',
  ],
  solicitud_humana: [
    'hablar con una persona',
    'hablar con alguien',
    'hablar con la encargada',
    'hablar con la dueña',
    'hablar con un humano',
    'me pasas con',
    'quiero hablar con',
    'atencion humana',
    'atención humana',
    'persona real',

    /**
     * --- SOLICITUD EXPLÍCITA DE UNA PERSONA, por el cargo ---
     *
     * Las frases de arriba exigen que la clienta construya la petición completa (*"quiero hablar
     * con…"*). En la práctica escribe el cargo a secas: *"la encargada"*, *"con la dueña"*. Esas
     * palabras sueltas son señal suficiente, y el coste del falso positivo es un escalamiento de
     * más — mientras el del falso negativo es insistir con un bot a alguien que acaba de pedir
     * que no lo haga.
     *
     * `humana`, `humano` y `persona` van sin contexto por lo mismo: en una conversación de salón
     * de uñas no aparecen por otro motivo.
     */
    'humana',
    'humano',
    'persona',
    'encargada',
    'gerente',
    'duena',
    'dueña',
    'asesora',
    'recepcion',
    'recepción',
  ],
  queja_o_reclamo: [
    // --- Queja genérica ---
    'queja',
    'reclamo',
    'reclamacion',
    'reclamación',
    'pesimo',
    'pésimo',
    'horrible',
    'muy mal',
    'me quejo',
    'inaceptable',
    'estoy molesta',
    'estoy enojada',
    'mal servicio',

    /**
     * --- RIESGO LEGAL, REGULATORIO O FINANCIERO ---
     *
     * **El grupo más importante de toda esta lista, y el que menos tolera un falso negativo.**
     *
     * Una clienta que escribe *"los voy a acusar con PROFECO"* ya no está en una conversación de
     * agendamiento: está a un paso de una denuncia ante el regulador de consumo mexicano. Que un
     * clasificador probabilístico decida si eso es «una queja» es exactamente el riesgo que no se
     * puede delegar — y el coste de equivocarse no es una respuesta rara, es un expediente.
     *
     * Por eso van aquí y no como intenciones del modelo: **el filtro corre ANTES del LLM**, así
     * que ni se consulta ni se gasta presupuesto, y la conversación pasa a una persona en el mismo
     * turno.
     */
    'profeco',
    'demanda',
    'demandar',
    'denuncia',
    'denunciar',
    'abogado',
    'abogada',
    'fraude',
    'robo',
    'robaron',
    'estafa',
    'estafaron',
    'reembolso',
    'devolucion',
    'devolución',
    'devuelvan',
    'me devuelvan',

    /**
     * --- INCIDENTE SANITARIO O DAÑO FÍSICO ---
     *
     * Una infección, un corte o una quemadura **no son una queja de calidad**: son un posible daño
     * a una persona, con implicaciones sanitarias y de responsabilidad. El bot no tiene nada que
     * decir aquí, y una respuesta automática —incluso correcta— leída por alguien a quien acaban
     * de lastimar se percibe como desprecio.
     *
     * `dolor` entra aunque sea ambiguo (*"me dolió un poco"*): el falso positivo cuesta un
     * escalamiento de más; el falso negativo, una clienta herida hablando con un bot.
     */
    'infeccion',
    'infección',
    'infectado',
    'infectada',
    'sangre',
    'sangro',
    'sangró',
    'sangrando',
    'lastimaron',
    'lastimo',
    'lastimó',
    'cortaron',
    'me corto',
    'me cortó',
    'quemaron',
    'quemadura',
    'hongo',
    'hongos',
    'alergia',
    'alergica',
    'alérgica',
    'dolor',
    'me duele',

    /**
     * --- SOLICITUD DE GARANTÍA (`RN-GAR-01..06`) ---
     *
     * Una garantía **nunca se aprueba automáticamente** (`RN-GAR-03`) y su beneficio lo decide una
     * persona caso por caso (`RN-GAR-04`). El bot, por tanto, no tiene ninguna decisión que tomar:
     * lo único correcto es pasarla a quien puede resolverla.
     *
     * Se clasifica como `queja_o_reclamo` y no con un motivo propio a propósito: el catálogo de
     * motivos es cerrado (`CHECK` en la base) y añadir `garantia` exigiría una migración y una
     * decisión de negocio sobre si la Dueña quiere verlas separadas en su desglose. Mientras no lo
     * pida, una garantía **es** un reclamo sobre un servicio.
     */
    'garantia',
    'garantía',
    'se cayo',
    'se cayó',
    'se me cayo',
    'se me cayó',
    'se desprendio',
    'se desprendió',
    'se levanto',
    'se levantó',
    'se rompio',
    'se rompió',
    'se despego',
    'se despegó',
  ],
  cotizacion_compleja: ['diseño personalizado', 'diseno personalizado', 'algo asi como la foto', 'como la imagen', 'presupuesto especial'],
  comprobante_de_pago: ['ya transferi', 'ya transferí', 'ya pague', 'ya pagué', 'aqui esta mi comprobante', 'aquí está mi comprobante', 'le mande el deposito', 'le mandé el depósito'],
};

/**
 * Normaliza para comparar: minúsculas y sin acentos.
 *
 * Sin esto, *"PÉSIMO"* y *"pesimo"* serían frases distintas y la lista tendría que enumerar todas
 * las variantes de tildes y mayúsculas — que es como se cuela un caso sin cubrir.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * ¿Aparece este gatillo en el texto? **Por PALABRA, no por subcadena.**
 *
 * ## POR QUÉ NO BASTA `includes`
 *
 * Era lo que hacía la primera versión, y con frases largas funcionaba. Al ampliar las listas con
 * gatillos de **una sola palabra** (`persona`, `robo`, `dolor`, `garantia`) empezó a producir
 * falsos positivos reales, verificados:
 *
 * - *"quiero un diseño **persona**lizado"* → escalaba como `solicitud_humana` en vez de
 *   `cotizacion_compleja`. **El motivo equivocado**, que es justo lo que la Dueña mira para saber
 *   qué se le escapa al bot.
 * - *"eres un **robo**t?"* → escalaba como `queja_o_reclamo`.
 *
 * Así que un gatillo de una palabra se compara con límites de palabra, admitiendo el plural
 * español (`garantia` → `garantias`, `hongo` → `hongos`) pero no un prefijo arbitrario. Los
 * gatillos de varias palabras siguen por subcadena: ya son distintivos por sí mismos.
 */
function apareceEnElTexto(normalizado: string, gatillo: string): boolean {
  const limpio = normalizarTexto(gatillo);

  // Varias palabras: la frase completa ya es distintiva, y exigirle límites no aporta nada.
  if (limpio.includes(' ')) return normalizado.includes(limpio);

  // `\b` no sirve con los caracteres que deja `normalizarTexto` (quita acentos pero puede dejar
  // la `ñ`), así que el límite se expresa como "no una letra": es lo que hace que `robo` no
  // encuentre `robot` ni `persona` encuentre `personalizado`.
  const escapado = limpio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-zñ])${escapado}(s|es)?($|[^a-zñ])`, 'i').test(normalizado);
}

/** Motivo si algún gatillo coincide, o `null`. Determinista y sin modelo. */
export function detectarEscalamientoPorTexto(texto: string): MotivoDeEscalamiento | null {
  const normalizado = normalizarTexto(texto);

  for (const [motivo, frases] of Object.entries(FRASES_DE_ESCALAMIENTO)) {
    if (frases.some((frase) => apareceEnElTexto(normalizado, frase))) {
      // `comprobante_de_pago` no es un motivo del enum: es una cotización que un humano valida.
      return (motivo === 'comprobante_de_pago' ? 'intervencion_manual' : motivo) as MotivoDeEscalamiento;
    }
  }

  return null;
}

/** Intenciones que, vengan del modelo o del filtro, exigen a una persona. */
const MOTIVO_POR_INTENCION: Partial<Record<TipoDeIntencion, MotivoDeEscalamiento>> = {
  cancelar: 'cancelacion_solicitada',
  queja: 'queja_o_reclamo',
  pedir_humano: 'solicitud_humana',
  cotizacion_compleja: 'cotizacion_compleja',
  comprobante_de_pago: 'intervencion_manual',
  // `reprogramar` escala siempre: `RN-ANT-04` exige validar la ventana de 48 h con anticipo
  // pagado y `DEC-042` el tope de 3 reprogramaciones. El bot no evalúa reglas, así que lo pasa.
  reprogramar: 'intervencion_manual',
  desconocida: 'fuera_de_alcance',
};

/**
 * Motivo de escalamiento de una intención ya interpretada, o `null` si el bot puede atenderla.
 *
 * Incluye la **degradación por baja confianza** (`RN-CONV-05`): si el modelo no está seguro, lo ve
 * una persona en vez de arriesgar una respuesta mala. Es más caro en atención y mucho más barato
 * en confianza de la clienta.
 */
export function motivoDeEscalamientoDe(intencion: Intencion): MotivoDeEscalamiento | null {
  const porTipo = MOTIVO_POR_INTENCION[intencion.tipo];
  if (porTipo) return porTipo;

  return null;
}
