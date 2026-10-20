/**
 * Lo que el LLM puede concluir de un mensaje. **Nada más que esto.**
 *
 * ## ESTE TIPO *ES* LA FRONTERA DETERMINISTA
 *
 * `RN-CONV-01` es tajante: *la IA interpreta, nunca decide*. Y la forma de hacerlo cumplir no es
 * un comentario ni una instrucción en el prompt —de la que no hay garantía— sino **el tipo de
 * dato que el LLM puede devolver**.
 *
 * Fíjese en lo que NO hay aquí: no hay precio, no hay duración, no hay hueco, no hay "está
 * disponible". El LLM solo puede decir **qué quiere la clienta** y, como mucho, qué fecha o
 * servicio mencionó. Todo lo demás —si hay cupo, cuánto cuesta, si cabe, si puede agendar— lo
 * responden los casos de uso reales del backend con los datos de PostgreSQL.
 *
 * Si mañana se cambia el modelo, o se le mete un prompt malicioso, lo peor que puede hacer es
 * clasificar mal la intención. **No puede inventar un precio porque no tiene dónde escribirlo.**
 */
export type TipoDeIntencion =
  | 'saludo'
  | 'consultar_servicios'
  | 'consultar_disponibilidad'
  | 'agendar'
  | 'confirmar_cita'
  | 'aceptar_oferta'
  | 'cancelar'
  | 'reprogramar'
  | 'queja'
  | 'pedir_humano'
  | 'cotizacion_compleja'
  | 'comprobante_de_pago'
  | 'desconocida';

export interface Intencion {
  tipo: TipoDeIntencion;
  /** Fecha mencionada, como fecha de pared `YYYY-MM-DD`. El LLM la extrae, no la valida. */
  fecha?: string;
  /** Hora mencionada `HH:MM`, en hora de pared del negocio. */
  hora?: string;
  /**
   * ## AQUÍ HABÍA UN `servicioMencionado`, Y QUITARLO ES LA MEJORA (2026-10-19)
   *
   * El modelo devolvía el nombre del servicio *"tal como lo dijo la clienta"* y el backend buscaba
   * en el catálogo una fila cuyo nombre lo contuviera. Con la matriz oficial de la Dueña ese camino
   * resultó **peligroso**: *"extensiones con rubber"* es una combinación que la tabla no junta, y
   * la palabra `extensiones` aparece dentro de `Retiro de acrílico o rubber + extensiones o baño de
   * acrílico` — el respaldo agendaba **tres horas** para quien pidió dos servicios de una.
   *
   * Hoy el servicio lo resuelve `resolverCombinacion` sobre el **texto literal** de la clienta,
   * contra la matriz. El modelo ya no participa en esa decisión, así que el campo desapareció: **la
   * frontera determinista es más estrecha que antes**, que es exactamente lo que `ADR-026` busca.
   *
   * Lo que queda de este tipo sigue sin poder transportar una decisión de negocio: no hay dónde
   * escribir un precio, una duración, un hueco ni el texto de la respuesta.
   */
  /**
   * Confianza del modelo, 0 a 1. **Por debajo del umbral se escala** (`RN-CONV-05`, degradación a
   * humano ante baja confianza). El adaptador determinista devuelve 1 cuando acierta un patrón y
   * 0 cuando no reconoce nada.
   */
  confianza: number;
}

/** `RN-CONV-05` — por debajo de esto, lo ve una persona en vez de arriesgar una respuesta mala. */
export const CONFIANZA_MINIMA = 0.6;
