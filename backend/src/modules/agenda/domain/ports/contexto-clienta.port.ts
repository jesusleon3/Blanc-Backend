export const CONTEXTO_CLIENTA_PORT = 'CONTEXTO_CLIENTA_PORT';

/**
 * Lo que **Agenda** necesita saber de una clienta para decidir si puede reservar y cómo.
 *
 * El literal se repite aquí en vez de importar `EstadoDeRiesgo` de CRM: ningún Bounded Context
 * importa a otro, ni sus tipos. Esta unión **es** el contrato publicado, y que sea una copia
 * deliberada es lo que permite que CRM añada un estado interno (`vip`, por ejemplo) sin que
 * Agenda se entere ni tenga que recompilarse.
 */
export interface ContextoClienta {
  id: string;
  estadoDeRiesgo: 'normal' | 'lista_roja' | 'bloqueada';
}

/**
 * Lo que **Agenda pregunta a CRM / Clientas**.
 *
 * SUSTITUYE A `VerificarClientaPort`, que solo respondía `existe(): boolean` con un adaptador
 * provisional que aceptaba cualquier uuid. Ya no basta un booleano, y por eso el puerto cambió de
 * forma en vez de ganar métodos: Agenda necesita **tres respuestas distintas** del mismo dato.
 *
 * - No existe → `404`. Antes se agendaba igual para una clienta inventada.
 * - `bloqueada` → `409` (`RN-CRM-04`), para que el caso se escale a una persona.
 * - `lista_roja` → la cita **nace en `en_espera_pago`** (`RN-ANT-01`), no en `agendada`.
 *
 * El método se llama `obtener` y no `puedeAgendar` a propósito: **la decisión es de Agenda**, no
 * de CRM. CRM dice en qué estado está la clienta; qué hacer con eso lo decide la regla de Agenda.
 * Un `puedeAgendar(): boolean` habría metido la política de reservas dentro de CRM y habría hecho
 * imposible distinguir "bloqueada" de "lista roja", que llevan a resultados opuestos.
 */
export interface ContextoClientaPort {
  obtener(clientaId: string): Promise<ContextoClienta | null>;

  /**
   * Varias de golpe, para la consulta de agenda.
   *
   * Existe para evitar el N+1: pintar la agenda del día con el indicador de lista roja exigiría
   * una consulta por cita. Devuelve solo las encontradas — una clienta ausente simplemente no
   * aparece en el mapa.
   */
  obtenerVarias(clientaIds: string[]): Promise<Map<string, ContextoClienta>>;
}
