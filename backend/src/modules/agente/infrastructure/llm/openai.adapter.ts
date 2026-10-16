import { Injectable, Logger } from '@nestjs/common';
import { AgenteConversacionalPort, TurnoParaInterpretar } from '../../domain/agente-conversacional.port';
import { Intencion, TipoDeIntencion } from '../../domain/intencion';

/** Modelo por defecto. Explícito: dejarlo implícito haría que cambiara sin aviso. */
export const MODELO_POR_DEFECTO = 'gpt-4o-mini';

/**
 * Tope de espera de la llamada al modelo. **No es una optimización: es una mitigación de `F-27`.**
 *
 * El procesamiento del webhook de Meta es **síncrono** (`ADR-028`), así que esta llamada ocurre
 * dentro del ciclo de petición del webhook. Un `fetch` sin timeout puede quedarse colgado hasta el
 * timeout de TCP —decenas de segundos—, y durante todo ese tiempo Meta ya habría desistido y
 * estaría reintentando el mismo evento.
 *
 * Con 8 segundos, lo peor que pasa es que el turno degrade a `desconocida` y la conversación pase
 * a una persona, que es el comportamiento seguro que el adaptador ya tiene para cualquier fallo.
 * **Es preferible escalar a tiempo que responder tarde.**
 */
export const TIMEOUT_DE_OPENAI_MS = 8_000;

const TIPOS_VALIDOS: readonly TipoDeIntencion[] = [
  'saludo',
  'consultar_servicios',
  'consultar_disponibilidad',
  'agendar',
  'confirmar_cita',
  'aceptar_oferta',
  'cancelar',
  'reprogramar',
  'queja',
  'pedir_humano',
  'cotizacion_compleja',
  'comprobante_de_pago',
  'desconocida',
];

/**
 * Esquema que se le impone al modelo con **salida estructurada**.
 *
 * No es una sugerencia del prompt: es el `json_schema` con `strict: true`, así que el modelo **no
 * puede** devolver otra forma. Es la implementación técnica de `RN-CONV-02` (validación
 * estructurada antes de tener efecto) y de la decisión de `P1`: *OpenAI exclusivamente como
 * intérprete con salida estructurada, nunca decidiendo reglas de negocio*.
 *
 * Fíjese en lo que el esquema **no** admite: ni precio, ni duración, ni disponibilidad, ni texto de
 * respuesta. El modelo no tiene dónde escribir un número inventado.
 */
const ESQUEMA_DE_INTENCION = {
  type: 'object',
  additionalProperties: false,
  required: ['tipo', 'confianza'],
  properties: {
    tipo: { type: 'string', enum: TIPOS_VALIDOS },
    confianza: { type: 'number', minimum: 0, maximum: 1 },
    fecha: { type: ['string', 'null'], description: 'YYYY-MM-DD si la clienta la menciona' },
    hora: { type: ['string', 'null'], description: 'HH:MM en hora local de Querétaro' },
    servicioMencionado: { type: ['string', 'null'], description: 'Tal como lo dijo la clienta' },
  },
} as const;

const INSTRUCCIONES = [
  'Eres un clasificador de intenciones para un salón de uñas en Querétaro, México.',
  'Tu ÚNICA tarea es clasificar el mensaje de la clienta. NO respondes a la clienta.',
  'NUNCA inventes precios, horarios, duraciones ni disponibilidad: no tienes esa información y no te corresponde.',
  'Si no estás seguro, usa tipo "desconocida" con confianza baja: otra persona lo atenderá.',
  'Extrae fecha y hora SOLO si la clienta las dice explícitamente. No las deduzcas ni las supongas.',
].join(' ');

/**
 * Adaptador de OpenAI (`P1`: *OpenAI exclusivamente como intérprete con salida estructurada*).
 *
 * ## ⚠️ NO ESTÁ VERIFICADO CONTRA OPENAI, Y NO PUEDE ESTARLO TODAVÍA
 *
 * No hay credenciales. Implementa el contrato documentado de la Responses/Chat Completions API con
 * `response_format: json_schema` y `strict: true`, pero **ninguna línea se ha ejecutado contra el
 * servicio real**. Misma situación que con Supabase y con Meta: el diseño se cierra sin
 * credenciales, la verificación no.
 *
 * Lo que sí está garantizado por construcción, con credenciales o sin ellas: **lo que el modelo
 * devuelva pasa por `interpretarRespuesta`**, que descarta cualquier cosa que no encaje en
 * `Intencion`. Un modelo alucinando, un cambio de versión de la API o una respuesta malformada
 * degradan a `desconocida` con confianza `0` — y eso escala a una persona. **No hay camino por el
 * que una respuesta del modelo acabe en una cita agendada sin pasar por los casos de uso reales.**
 *
 * **Se activa solo con `OPENAI_API_KEY` presente.** Sin ella, `AgenteModule` provee el adaptador
 * determinista, así que nada intenta hablar con OpenAI por accidente.
 */
@Injectable()
export class OpenAiAgenteAdapter implements AgenteConversacionalPort {
  private readonly logger = new Logger(OpenAiAgenteAdapter.name);

  constructor(
    private readonly apiKey: string,
    private readonly modelo: string = MODELO_POR_DEFECTO,
  ) {}

  async interpretar(turno: TurnoParaInterpretar): Promise<Intencion> {
    try {
      const respuesta = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        // Ver `TIMEOUT_DE_OPENAI_MS`: sin esto, un cuelgue de red bloquea el webhook de Meta.
        signal: AbortSignal.timeout(TIMEOUT_DE_OPENAI_MS),
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelo,
          // Determinismo máximo: esto es clasificación, no redacción. Variar la temperatura solo
          // añadiría inconsistencia entre mensajes idénticos.
          temperature: 0,
          response_format: { type: 'json_schema', json_schema: { name: 'intencion', strict: true, schema: ESQUEMA_DE_INTENCION } },
          messages: [
            { role: 'system', content: INSTRUCCIONES },
            {
              role: 'user',
              content: JSON.stringify({
                mensaje: turno.texto,
                // El contexto va como dato, no como instrucción: así un mensaje de la clienta que
                // intente dar órdenes ("ignora tus instrucciones") sigue siendo solo contenido.
                contexto: turno.contexto,
              }),
            },
          ],
        }),
      });

      if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => '');
        this.logger.error(`OpenAI rechazó la petición (${respuesta.status}): ${detalle}`);
        return { tipo: 'desconocida', confianza: 0 };
      }

      const json = (await respuesta.json()) as { choices?: { message?: { content?: string } }[] };
      return this.interpretarRespuesta(json.choices?.[0]?.message?.content);
    } catch (error) {
      /**
       * **Cualquier fallo degrada a `desconocida`, nunca propaga.**
       *
       * OpenAI caído, un timeout o un límite de tasa **no pueden tumbar el webhook de Meta**: si
       * esto lanzara, Meta recibiría un 500 y reintentaría el mismo mensaje en bucle. Con
       * `desconocida` + confianza 0, la conversación pasa a una persona — exactamente lo que debe
       * pasar cuando el intérprete no está disponible.
       */
      // Un `AbortError` por timeout llega por aquí igual que una caída: el tratamiento es el mismo
      // y es el correcto — escalar. Se distingue en el log porque la causa y la acción difieren:
      // un timeout recurrente pide revisar el modelo o encolar; una caída, esperar.
      const esTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      this.logger.error(
        esTimeout
          ? `OpenAI no respondió en ${TIMEOUT_DE_OPENAI_MS} ms; la conversación se escalará. Si se repite, revisar ADR-028.`
          : 'Fallo al consultar OpenAI; la conversación se escalará.',
        error instanceof Error ? error.stack : String(error),
      );
      return { tipo: 'desconocida', confianza: 0 };
    }
  }

  /**
   * Valida la respuesta del modelo contra `Intencion`. **Nada que no encaje pasa.**
   *
   * Es la última barrera, y la que hace que el `strict: true` del esquema no sea la única defensa:
   * una versión futura de la API, un modelo distinto o una respuesta truncada producen
   * `desconocida` con confianza `0`, no un comportamiento indefinido.
   */
  private interpretarRespuesta(contenido: string | undefined): Intencion {
    if (!contenido) return { tipo: 'desconocida', confianza: 0 };

    try {
      const crudo = JSON.parse(contenido) as Record<string, unknown>;
      const tipo = crudo.tipo;
      const confianza = crudo.confianza;

      if (typeof tipo !== 'string' || !TIPOS_VALIDOS.includes(tipo as TipoDeIntencion)) {
        this.logger.warn(`OpenAI devolvió un tipo de intención no reconocido: ${String(tipo)}`);
        return { tipo: 'desconocida', confianza: 0 };
      }
      if (typeof confianza !== 'number' || !Number.isFinite(confianza) || confianza < 0 || confianza > 1) {
        return { tipo: 'desconocida', confianza: 0 };
      }

      return {
        tipo: tipo as TipoDeIntencion,
        confianza,
        ...(typeof crudo.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(crudo.fecha) ? { fecha: crudo.fecha } : {}),
        ...(typeof crudo.hora === 'string' && /^\d{2}:\d{2}$/.test(crudo.hora) ? { hora: crudo.hora } : {}),
        ...(typeof crudo.servicioMencionado === 'string' && crudo.servicioMencionado.length > 0
          ? { servicioMencionado: crudo.servicioMencionado }
          : {}),
      };
    } catch {
      return { tipo: 'desconocida', confianza: 0 };
    }
  }
}
