export const CONTEXTO_CLIENTA_DE_CONVERSACION_PORT = 'CONTEXTO_CLIENTA_DE_CONVERSACION_PORT';

export interface ClientaDeConversacion {
  id: string;
  estadoDeRiesgo: 'normal' | 'lista_roja' | 'bloqueada';
}

/**
 * Lo que **Conversaciones pregunta a CRM**: quién escribe desde este teléfono.
 *
 * Devuelve una **lista**, y eso no es un detalle: un teléfono puede corresponder a **dos clientas**
 * (mamá e hija, `RN-CRM-01` corregido en Fase 3). La conversación no puede decidir por su cuenta a
 * cuál se refiere el mensaje — lo decide quien atiende, o la IA en la Parte 3 preguntándolo.
 *
 * El literal del estado se repite aquí en vez de importar el de CRM: ningún Bounded Context
 * importa a otro ni sus tipos. Esta unión **es** el contrato publicado.
 */
export interface ContextoClientaDeConversacionPort {
  buscarPorTelefono(telefono: string): Promise<ClientaDeConversacion[]>;
}
