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
  ],
  queja_o_reclamo: [
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

/** Motivo si alguna frase coincide, o `null`. Determinista y sin modelo. */
export function detectarEscalamientoPorTexto(texto: string): MotivoDeEscalamiento | null {
  const normalizado = normalizarTexto(texto);

  for (const [motivo, frases] of Object.entries(FRASES_DE_ESCALAMIENTO)) {
    if (frases.some((frase) => normalizado.includes(normalizarTexto(frase)))) {
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
