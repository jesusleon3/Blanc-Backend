/**
 * Catálogo de plantillas de WhatsApp. **Fuente única de verdad.**
 *
 * ## ⚠️ ESTOS NOMBRES SON PROVISIONALES: `N-14` SIGUE ABIERTO
 *
 * El inventario y la redacción de las plantillas **los aprueba Meta** tras revisión, y la Dueña
 * todavía no los ha definido. Lo que hay aquí son los dos avisos que el sistema necesita hoy, con
 * los nombres que el adaptador ya usaba. Cuando `N-14` se cierre, hay que alinear estas constantes
 * con las plantillas realmente aprobadas: **un nombre que Meta no reconoce produce un rechazo del
 * envío**, no un mensaje raro.
 *
 * ## POR QUÉ VIVE EN EL DOMINIO DE CONVERSACIONES Y NO EN EL ADAPTADOR
 *
 * Estaba en `integracion/notificaciones-whatsapp.adapter.ts`, que es quien las envía. Pero ahora
 * hay un **segundo** consumidor: el panel web necesita listarlas para que la Encargada elija una
 * cuando la ventana de 24 h está cerrada. Duplicar la lista en el frontend garantizaría que un día
 * divergieran, y el síntoma sería un envío rechazado por Meta sin causa aparente.
 *
 * La dirección de la dependencia es la permitida (`P5`): `integracion/` importa de los Bounded
 * Contexts, nunca al revés.
 */

export interface DescriptorDePlantilla {
  /** Nombre exacto registrado en Meta. Es lo que viaja en la petición. */
  nombre: string;
  /** Para qué sirve, en lenguaje de la Encargada. Es lo que lee en el selector. */
  descripcion: string;
  /**
   * Qué espera cada parámetro posicional, en orden.
   *
   * Meta sustituye `{{1}}`, `{{2}}`… por lo que se le mande, **sin validar nada**. Si el orden se
   * equivoca, la clienta recibe un mensaje con la hora donde va la fecha y Meta lo entrega
   * igualmente. Que el selector muestre qué va en cada hueco es la única defensa práctica.
   */
  parametros: readonly string[];
}

export const PLANTILLAS_DE_WHATSAPP: readonly DescriptorDePlantilla[] = [
  {
    nombre: 'recordatorio_cita_24h',
    descripcion: 'Recordatorio de cita con petición de confirmación. La clienta puede responder "sí" y el bot la confirma.',
    parametros: ['Hora de la cita (ej. 10:00 a.m.)'],
  },
  {
    nombre: 'oferta_hueco_lista_espera',
    descripcion: 'Aviso de que se liberó un lugar para quien está en lista de espera. La oferta NO retiene el lugar (RN-AGE-13).',
    parametros: ['Fecha del hueco (ej. 2026-12-07)', 'Hora del hueco (ej. 05:00 p.m.)'],
  },
  {
    nombre: 'reapertura_conversacion',
    descripcion: 'Para retomar el contacto cuando la ventana de 24 h está cerrada y no hay recordatorio ni oferta de por medio.',
    parametros: ['Nombre de la clienta'],
  },
];

/** Atajo con los nombres, para quien solo necesita la constante. */
export const PLANTILLAS = {
  recordatorioDeCita: 'recordatorio_cita_24h',
  ofertaDeHueco: 'oferta_hueco_lista_espera',
  reaperturaDeConversacion: 'reapertura_conversacion',
} as const;
