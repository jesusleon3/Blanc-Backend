export const VERIFICAR_CLIENTA_PORT = 'VERIFICAR_CLIENTA_PORT';

/**
 * Lo que **Agenda pregunta a CRM/Clientas** antes de reservar.
 *
 * ⚠️ **EL BOUNDED CONTEXT DE CLIENTAS NO EXISTE TODAVÍA** (Fase 3). Este puerto se define ahora,
 * vacío de implementación real, para que al construir Fase 3 **solo haya que sustituir el
 * adaptador** y no tocar `AgendarCitaUseCase` ni `ReprogramarCitaUseCase`.
 *
 * **Lo que hoy NO protege, dicho sin rodeos:** el adaptador provisional
 * (`CrmNoConstruidoVerificarClientaAdapter`) acepta cualquier uuid. Se puede agendar una cita
 * para una clienta inexistente. Eso **no** es un descuido escondido detrás de una abstracción: es
 * el estado real del sistema, y esta costura existe precisamente para que el día que se cierre no
 * haya que abrir los casos de uso.
 *
 * Mismo patrón, y misma lección, que `VerificarCitasFuturasPort`: aquel vivió un tiempo con un
 * adaptador que respondía siempre `false` y por tanto no protegía nada. La diferencia es que aquí
 * está escrito en el puerto, no solo en una nota de handoff.
 */
export interface VerificarClientaPort {
  /**
   * `true` si la clienta existe y puede recibir citas.
   *
   * Cuando exista CRM, este método es también el punto natural donde se consultará la **lista
   * roja** (`RN-CRM-06`, `DEC-042`): una clienta en lista roja no deja de existir, pero su
   * reserva exige anticipo. Esa distinción pertenece a Fase 3 — hoy el método solo responde por
   * la existencia, y por eso se llama `existe` y no `puedeAgendar`.
   */
  existe(clientaId: string): Promise<boolean>;
}
