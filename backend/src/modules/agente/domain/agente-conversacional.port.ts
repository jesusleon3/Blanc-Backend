import { Intencion } from './intencion';

export const AGENTE_CONVERSACIONAL_PORT = 'AGENTE_CONVERSACIONAL_PORT';

export interface TurnoParaInterpretar {
  texto: string;
  /**
   * Contexto mínimo y **de solo lectura** que se le da al modelo.
   *
   * Se le dice si hay una cita pendiente de confirmar o una oferta abierta porque eso cambia el
   * significado de un "sí" a secas. **No se le dan precios ni horarios libres**: no los necesita
   * para clasificar, y dárselos le permitiría repetirlos — que es exactamente lo que
   * `RN-CONV-01` prohíbe.
   */
  contexto: {
    tieneCitaPendienteDeConfirmar: boolean;
    tieneOfertaDeHuecoAbierta: boolean;
  };
}

/**
 * Puerto hacia el modelo de lenguaje.
 *
 * ## LO ÚNICO QUE EL MODELO PUEDE HACER ES CLASIFICAR
 *
 * Devuelve una `Intencion` y nada más. No redacta la respuesta final, no consulta datos, no
 * ejecuta nada. `RN-CONV-02` exige validación estructurada antes de que algo tenga efecto, y aquí
 * la validación es el propio tipo: lo que no cabe en `Intencion` no puede cruzar esta frontera.
 *
 * **El adaptador por defecto NO usa OpenAI.** Es determinista, basado en patrones, y es el que
 * corre en las pruebas y mientras no haya credenciales — igual que el canal de WhatsApp. El
 * adaptador de OpenAI se activa por entorno y **no está verificado contra el servicio real**.
 */
export interface AgenteConversacionalPort {
  interpretar(turno: TurnoParaInterpretar): Promise<Intencion>;
}
