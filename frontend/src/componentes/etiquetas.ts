import type {
  ClaseDeAfectacion,
  EmisorMensaje,
  EstadoAnticipo,
  EstadoCita,
  EstadoDeRiesgo,
  EstadoDeVentana,
  EstadoSolicitud,
  MotivoDeEscalamiento,
  Rol,
  TipoExcepcion,
} from '../api/contrato';

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

/**
 * Texto para un total que **puede estar sin cotizar**.
 *
 * `null` no es cero: es la negativa explícita del sistema a inventar un precio que debe fijar una
 * persona (`DEC-033`). Pasarlo por `pesos()` daría **$0.00** — un precio falso en pantalla que
 * alguien podría decirle a la clienta. Era un defecto real de la Fase 5.
 */
export function pesosOSinCotizar(centavos: number | null | undefined): string {
  return centavos === null || centavos === undefined ? 'Precio por confirmar' : pesos(centavos);
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

// ---------------------------------------------------------------------------
// Agenda (Fase 5 Parte 2)
// ---------------------------------------------------------------------------

export const ETIQUETA_DE_ESTADO_CITA: Record<EstadoCita, string> = {
  en_espera_pago: 'Espera anticipo',
  agendada: 'Agendada',
  pendiente_confirmacion: 'Por confirmar',
  confirmada: 'Confirmada',
  completada: 'Atendida',
  no_show: 'No llegó',
  cancelada: 'Cancelada',
  reprogramada: 'Reprogramada',
  expirada: 'Expirada',
};

/**
 * Tono por estado. Lo que ordena la atención, igual que la severidad de los motivos en la Bandeja.
 *
 * `en_espera_pago` va en **aviso** porque es el único estado que **no ocupa el horario**: la cita
 * existe pero el lugar sigue vendible hasta que el anticipo se confirme (`RN-ANT-03`). Pintarla
 * igual que una `agendada` haría creer que el hueco está tomado.
 */
export const TONO_DE_ESTADO_CITA: Record<EstadoCita, 'neutro' | 'exito' | 'aviso' | 'peligro' | 'info' | 'acento'> = {
  en_espera_pago: 'aviso',
  agendada: 'info',
  pendiente_confirmacion: 'aviso',
  confirmada: 'exito',
  completada: 'neutro',
  no_show: 'peligro',
  cancelada: 'neutro',
  reprogramada: 'neutro',
  expirada: 'neutro',
};

export const ETIQUETA_DE_TIPO_EXCEPCION: Record<TipoExcepcion, string> = {
  ausencia: 'Ausencia',
  cobertura: 'Cobertura',
};

export const ETIQUETA_DE_AFECTACION: Record<ClaseDeAfectacion, string> = {
  cita_asignada: 'Cita asignada a esta manicurista',
  sobrecupo_en_sucursal: 'La sucursal queda sin suficiente personal',
};

export const ETIQUETA_DE_ESTADO_SOLICITUD: Record<EstadoSolicitud, string> = {
  en_espera: 'En espera',
  notificada: 'Avisada, esperando respuesta',
  aceptada: 'Aceptó y se agendó',
  expirada: 'Se le pasó el turno',
  cancelada: 'Cancelada',
};

/** Fecha de pared `YYYY-MM-DD` en Querétaro. Es lo que los endpoints de fecha esperan. */
export function fechaLocalDeHoy(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/**
 * `YYYY-MM-DD` + `HH:MM` de pared de Querétaro → instante ISO.
 *
 * ## EL DESFASE FIJO ES DELIBERADO, Y ES EL ERROR MÁS PROBABLE DE TODO EL FRONTEND
 *
 * `-06:00` es el desfase de México desde que abolió el horario de verano en 2022. Construir la
 * fecha con `new Date('2026-12-07T10:00')` la interpretaría en **la zona del navegador**, así que
 * una Encargada con el portátil en otra zona —o un servidor en UTC corriendo las pruebas— agendaría
 * la cita a otra hora sin que nada avisara. Es el mismo criterio que usa el backend en
 * `HerramientasDelBot.rangoDe`, y por la misma razón.
 */
export function instanteDesdeHoraLocal(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}:00-06:00`).toISOString();
}

/** Límites del día de pared, para consultar la agenda de una fecha. */
export function rangoDelDia(fecha: string): { inicio: string; fin: string } {
  return {
    inicio: new Date(`${fecha}T00:00:00-06:00`).toISOString(),
    fin: new Date(`${fecha}T23:59:59-06:00`).toISOString(),
  };
}

/** Cuánto falta para que venza algo. Negativo = ya venció. */
export function minutosHasta(iso: string, ahora = new Date()): number {
  return Math.round((new Date(iso).getTime() - ahora.getTime()) / 60_000);
}
