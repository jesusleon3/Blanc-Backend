import type { EmisorMensaje, EstadoAnticipo, EstadoDeRiesgo, EstadoDeVentana, MotivoDeEscalamiento, Rol } from '../api/contrato';

/**
 * Traducciones de los valores del dominio a lenguaje de quien opera.
 *
 * ## POR QUÉ ESTÁN TODAS AQUÍ Y NO EN CADA COMPONENTE
 *
 * Son los mismos valores en varias pantallas (lista de la Bandeja, cabecera del hilo, panel de
 * Anticipos) y el riesgo real es que divergieran: que un motivo se llamara *"Pide cancelar"* en la
 * lista y *"Cancelación"* en el detalle. Quien opera lee las dos cosas en la misma sesión.
 *
 * Los registros son **completos por tipo** (`Record<Union, …>`, sin `Partial`), así que **añadir un
 * valor en el backend rompe la compilación aquí**. Es deliberado: un motivo nuevo sin traducir
 * aparecería en pantalla como `medio_no_soportado` si esto fuera un objeto laxo con un fallback.
 */

export const ETIQUETA_DE_MOTIVO: Record<MotivoDeEscalamiento, string> = {
  clienta_bloqueada: 'Clienta bloqueada',
  solicitud_humana: 'Pidió hablar con una persona',
  queja_o_reclamo: 'Queja o reclamo',
  cotizacion_compleja: 'Diseño por cotizar',
  cancelacion_solicitada: 'Pide cancelar',
  intervencion_manual: 'Requiere intervención',
  baja_confianza_ia: 'El bot no entendió',
  fuera_de_alcance: 'Fuera del alcance del bot',
  medio_no_soportado: 'Mandó audio o archivo',
};

/**
 * Severidad visual por motivo. **No es decorativa: ordena la atención.**
 *
 * `clienta_bloqueada`, `queja_o_reclamo` y `cancelacion_solicitada` son los tres que cuestan dinero
 * o relación si se quedan esperando, así que van en rojo. Que *"el bot no entendió"* sea neutro es
 * igual de intencionado: es el caso más frecuente y pintarlo de rojo haría que el rojo dejara de
 * significar nada.
 */
export const SEVERIDAD_DE_MOTIVO: Record<MotivoDeEscalamiento, 'alta' | 'media' | 'neutra'> = {
  clienta_bloqueada: 'alta',
  queja_o_reclamo: 'alta',
  cancelacion_solicitada: 'alta',
  cotizacion_compleja: 'media',
  intervencion_manual: 'media',
  solicitud_humana: 'media',
  medio_no_soportado: 'media',
  baja_confianza_ia: 'neutra',
  fuera_de_alcance: 'neutra',
};

export const ETIQUETA_DE_EMISOR: Record<EmisorMensaje, string> = {
  clienta: 'Clienta',
  bot: 'Bot',
  humano: 'Tú / el equipo',
  sistema: 'Automático',
};

export const ETIQUETA_DE_VENTANA: Record<EstadoDeVentana, string> = {
  abierta: 'Ventana abierta',
  cerrada: 'Ventana cerrada',
  nunca_abierta: 'Nunca te ha escrito',
};

/**
 * La explicación de la regla de Meta, en los términos de quien opera.
 *
 * Es texto largo a propósito: la primera vez que a alguien se le bloquea la caja de texto, la
 * pregunta es *"¿por qué no puedo escribirle?"*, y la respuesta tiene que estar ahí mismo. Dejarla
 * en un *tooltip* garantizaría una llamada a soporte.
 */
export const EXPLICACION_DE_VENTANA: Record<EstadoDeVentana, string> = {
  abierta: 'La clienta escribió hace menos de 24 horas, así que puedes responderle con texto libre.',
  cerrada:
    'Pasaron más de 24 horas desde el último mensaje de la clienta. Meta solo permite texto libre dentro de esa ventana, así que para escribirle hay que usar una plantilla aprobada. Si ella responde, la ventana se abre otra vez.',
  nunca_abierta:
    'Esta clienta nunca te ha escrito por WhatsApp, así que no hay ventana abierta. Meta exige una plantilla aprobada para iniciar la conversación.',
};

export const ETIQUETA_DE_ESTADO_ANTICIPO: Record<EstadoAnticipo, string> = {
  pendiente: 'Esperando transferencia',
  pagado: 'Pagado',
  expirado: 'Expirado',
  retenido: 'Retenido',
};

export const ETIQUETA_DE_RIESGO: Record<EstadoDeRiesgo, string> = {
  normal: 'Normal',
  lista_roja: 'Lista roja',
  bloqueada: 'Bloqueada',
};

export const ETIQUETA_DE_ROL: Record<Rol, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMINISTRADOR: 'Dueña',
  GERENTE: 'Encargada',
  RECEPCIONISTA: 'Recepción',
  MANICURISTA: 'Manicurista',
  ANALISTA: 'Analista',
  SOLO_LECTURA: 'Solo lectura',
};

/** Centavos a pesos. `RN-COT-07`: el dinero son centavos enteros, nunca coma flotante. */
export function pesos(centavos: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(centavos / 100);
}

const ZONA = 'America/Mexico_City';

/** Hora de pared de Querétaro, no UTC: es lo que quien opera tiene en la pared. */
export function horaLocal(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(iso));
}

export function fechaYHoraLocal(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: ZONA,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

/**
 * *"hace 2 h"*. Para la antigüedad de lo que espera sin atender.
 *
 * `DEC-046`: **cuántas conversaciones esperan importa menos que cuánto llevan esperando** — tres de
 * hace dos minutos son una mañana normal, una de hace dos horas es un fallo de atención.
 */
export function haceCuanto(iso: string, ahora = new Date()): string {
  const minutos = Math.floor((ahora.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'ahora mismo';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}
