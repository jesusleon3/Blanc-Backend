import { Injectable } from '@nestjs/common';
import { AgenteConversacionalPort, TurnoParaInterpretar } from '../../domain/agente-conversacional.port';
import { Intencion, TipoDeIntencion } from '../../domain/intencion';
import { normalizarTexto } from '../../domain/deteccion-de-escalamiento';

/**
 * Patrones por intención. Es un dato, así que ampliarlo no toca código de decisión.
 *
 * ## EL ORDEN IMPORTA, Y `saludo` VA AL FINAL
 *
 * Se recorre en orden y gana el primero que acierte. `saludo` es la señal **más débil** —casi
 * todo el mundo empieza con "hola"— así que mirarlo primero convertiría *"Hola, ¿qué precios
 * tienen?"* en un saludo y el bot contestaría *"¿qué servicio te interesa?"* a quien acaba de
 * preguntar por los precios. Es el fallo que destapó la prueba de precios: no es teórico, es
 * cómo escribe literalmente todo el mundo en WhatsApp.
 *
 * Por eso el saludo es el **último recurso**: solo gana cuando no hay ninguna petición concreta.
 */
const PATRONES: Readonly<Record<string, readonly string[]>> = {
  consultar_servicios: ['que servicios', 'servicios tienen', 'precios', 'cuanto cuesta', 'cuanto sale', 'lista de precios', 'catalogo'],
  consultar_disponibilidad: ['tienes lugar', 'hay lugar', 'tienen espacio', 'disponibilidad', 'estaria disponible', 'hay cupo'],
  agendar: ['agendar', 'quiero una cita', 'apartar', 'reservar', 'me das cita', 'quiero cita'],
  confirmar_cita: ['si confirmo', 'confirmo', 'si voy', 'ahi estare', 'ahi estaré', 'si, confirmo', 'confirmada'],
  aceptar_oferta: ['si lo quiero', 'me lo quedo', 'si acepto', 'lo tomo', 'si me sirve'],
  // Último: ver la nota de arriba.
  saludo: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'que tal', 'hey'],
};

/**
 * Adaptador **determinista** del agente: clasifica por patrones, sin LLM.
 *
 * ## POR QUÉ ES EL ADAPTADOR POR DEFECTO Y NO UN SIMULACRO DE PRUEBAS
 *
 * Tres razones, y la tercera es la importante:
 *
 * 1. **No hay credenciales de OpenAI** y el proyecto no inventa secretos. Igual que con Meta y
 *    Supabase, el diseño se cierra sin ellas; la verificación no.
 * 2. **Las pruebas no pueden depender de un modelo probabilístico.** Un flujo conversacional
 *    probado contra un LLM real daría resultados distintos entre corridas, que es exactamente la
 *    clase de intermitencia que la Parte 1 de esta fase acabó de erradicar del arnés.
 * 3. **Es un modo de operación legítimo, no un relleno.** Con este adaptador el bot atiende
 *    saludos, consultas de precios y disponibilidad, y escala todo lo demás — un comportamiento
 *    conservador y perfectamente desplegable. Si el LLM resulta caro, impreciso o inaceptable para
 *    la Dueña, **apagarlo no deja el sistema sin bot**: lo deja con este.
 *
 * ## LA CONFIANZA ES BINARIA A PROPÓSITO
 *
 * `1` si acierta un patrón, `0` si no reconoce nada. No se inventa un 0,7: un número intermedio
 * fingiría una incertidumbre que este adaptador no tiene. El `0` activa la degradación de
 * `RN-CONV-05` y la conversación pasa a una persona, que es el lado seguro.
 */
@Injectable()
export class AgenteDeterministicoAdapter implements AgenteConversacionalPort {
  async interpretar(turno: TurnoParaInterpretar): Promise<Intencion> {
    const texto = normalizarTexto(turno.texto);

    /**
     * Un "sí" a secas **solo** significa confirmar o aceptar si hay algo que confirmar o aceptar.
     *
     * Es la razón de que el contexto entre en el puerto. Sin él, un "sí" se interpretaría como
     * confirmación de una cita que no existe — y el bot respondería *"¡listo, confirmada!"* a una
     * clienta que estaba contestando a otra cosa.
     */
    if (this.esAfirmacionCorta(texto)) {
      if (turno.contexto.tieneOfertaDeHuecoAbierta) return { tipo: 'aceptar_oferta', confianza: 1 };
      if (turno.contexto.tieneCitaPendienteDeConfirmar) return { tipo: 'confirmar_cita', confianza: 1 };
      // Sin contexto, un "sí" no significa nada accionable.
      return { tipo: 'desconocida', confianza: 0 };
    }

    for (const [tipo, patrones] of Object.entries(PATRONES)) {
      if (patrones.some((patron) => texto.includes(normalizarTexto(patron)))) {
        return this.conDatos(tipo as TipoDeIntencion, turno.texto);
      }
    }

    return { tipo: 'desconocida', confianza: 0 };
  }

  private esAfirmacionCorta(texto: string): boolean {
    // Corto y afirmativo: "si", "sí", "ok", "va", "claro". Se exige brevedad para no capturar
    // frases largas que contengan un "si" incidental ("si no te molesta, cancela mi cita").
    return texto.trim().length <= 12 && /^(si|sí|ok|va|claro|dale|perfecto|sale)\b/.test(texto.trim());
  }

  /** Extrae fecha y hora si el mensaje las trae en formato reconocible. */
  private conDatos(tipo: TipoDeIntencion, textoOriginal: string): Intencion {
    const fecha = /\b(\d{4}-\d{2}-\d{2})\b/.exec(textoOriginal)?.[1];
    // `HH:MM` o `H:MM`, con o sin `hrs`. Deliberadamente estricto: adivinar "mañana por la tarde"
    // sería inventar una hora, y una cita a una hora inventada es peor que un escalamiento.
    const hora = /\b(\d{1,2}:\d{2})\b/.exec(textoOriginal)?.[1];

    /**
     * El servicio mencionado se toma tal cual: resolverlo contra el catálogo es del backend.
     *
     * La lista es de **palabras que suelen nombrar un servicio**, no del catálogo: este adaptador
     * no conoce el catálogo, y meterlo aquí duplicaría una fuente de verdad que vive en
     * PostgreSQL. Si la palabra no resuelve a un servicio activo, `resolverServicio` devuelve
     * `null` y el turno escala — que es el lado seguro.
     */
    const servicio = /\b(gelish|acrilico|acrílico|diseño|diseno|retiro|pedicure|manicure|uñas|unas)\b/i.exec(textoOriginal)?.[1];

    return {
      tipo,
      confianza: 1,
      ...(fecha ? { fecha } : {}),
      ...(hora ? { hora: hora.padStart(5, '0') } : {}),
      ...(servicio ? { servicioMencionado: servicio } : {}),
    };
  }
}
