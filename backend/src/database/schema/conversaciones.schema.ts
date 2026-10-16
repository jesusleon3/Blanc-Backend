import { sql } from 'drizzle-orm';
import { index, integer, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const conversacionesSchema = pgSchema('conversaciones');

/**
 * Quién lleva la conversación (`DEC-037`/`RN-ESC-03`).
 *
 * ⚠️ **DEL MODO `humano` NO SE SALE SOLO.** Una vez escalada, el bot **jamás** retoma el control
 * por inactividad ni por tiempo: permanece en `humano` hasta que una persona autorizada la
 * devuelva explícitamente. `RN-ESC-03` lo exige (*"retorno de control siempre explícito"*), y la
 * razón es concreta: una clienta que pidió hablar con alguien y recibe de nuevo al bot a los diez
 * minutos concluye, con razón, que nadie la escuchó.
 *
 * Por eso **no hay columna de expiración de modo**. Esa ausencia *es* la regla.
 */
export const MODOS_CONVERSACION = ['bot', 'humano'] as const;
export type ModoConversacion = (typeof MODOS_CONVERSACION)[number];

/**
 * Por qué se escaló a una persona.
 *
 * Se guarda la **categoría**, no solo el hecho: la Dueña necesita poder distinguir *"me escalan
 * mucho por quejas"* de *"me escalan mucho por cotizaciones complejas"*, porque la primera es un
 * problema de servicio y la segunda de catálogo. Un booleano `escalada` no permitiría esa lectura.
 */
export const MOTIVOS_DE_ESCALAMIENTO = [
  'clienta_bloqueada',
  'solicitud_humana',
  'queja_o_reclamo',
  'cotizacion_compleja',
  'cancelacion_solicitada',
  'intervencion_manual',
  'baja_confianza_ia',
  'fuera_de_alcance',
  /**
   * La clienta mandó audio, documento o un medio que el bot no puede leer (`RN-CONV-06`).
   *
   * Añadido en Fase 4 Parte 3: antes esos mensajes dejaban la conversación **en silencio** — se
   * guardaban en la bandeja y nadie respondía ni escalaba, así que la clienta se quedaba
   * esperando a un bot que no podía oírla.
   */
  'medio_no_soportado',
] as const;
export type MotivoDeEscalamiento = (typeof MOTIVOS_DE_ESCALAMIENTO)[number];

/** Dirección de un mensaje respecto al salón. */
export const DIRECCIONES_MENSAJE = ['entrante', 'saliente'] as const;
export type DireccionMensaje = (typeof DIRECCIONES_MENSAJE)[number];

/**
 * Quién emitió un mensaje saliente. `clienta` solo aplica a los entrantes.
 *
 * Distinguir `bot` de `humano` importa para `RN-CONV-04` (trazabilidad de toda decisión de IA) y
 * para que la bandeja pueda mostrar quién respondió qué.
 */
export const EMISORES_MENSAJE = ['clienta', 'bot', 'humano', 'sistema'] as const;
export type EmisorMensaje = (typeof EMISORES_MENSAJE)[number];

/** Tipo de contenido. `plantilla` es el único permitido con la ventana de 24 h cerrada. */
export const TIPOS_MENSAJE = ['texto', 'plantilla', 'no_soportado'] as const;
export type TipoMensaje = (typeof TIPOS_MENSAJE)[number];

/**
 * Estados de entrega que reporta Meta por webhook. `pendiente` es el estado local previo a que
 * Meta confirme nada.
 */
export const ESTADOS_ENTREGA = ['pendiente', 'sent', 'delivered', 'read', 'failed'] as const;
export type EstadoEntrega = (typeof ESTADOS_ENTREGA)[number];

/**
 * `conversaciones.numeros_de_sucursal` — mapa `phone_number_id` de Meta → `sucursal_id`.
 *
 * POR QUÉ ES UNA TABLA Y NO CONFIGURACIÓN EN CÓDIGO. Cada sucursal tiene **su propio número**
 * (`DEC-043`), y el webhook de Meta llega con el `phone_number_id` del número **receptor**: es el
 * único dato que dice a qué sucursal pertenece el mensaje. Con tres sucursales (pronto cuatro) y
 * números que se dan de alta en momentos distintos, una constante en código obligaría a desplegar
 * para añadir una sucursal — y el alta de un número en Meta es un trámite, no un cambio de
 * software.
 *
 * Sin FK a `sucursales`: otro Bounded Context (`ADR-005`).
 */
export const numerosDeSucursal = conversacionesSchema.table(
  'numeros_de_sucursal',
  {
    /** `phone_number_id` de Meta Cloud API. Es la clave: un número, una sucursal. */
    phoneNumberId: text('phone_number_id').primaryKey(),
    sucursalId: uuid('sucursal_id').notNull(),
    /** El número en formato legible, solo para que un humano lo reconozca en el panel. */
    telefonoVisible: text('telefono_visible').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => ({
    porSucursal: index('numeros_sucursal_idx').on(tabla.sucursalId),
  }),
);

/**
 * `conversaciones.conversaciones` — un hilo de WhatsApp.
 *
 * ## IDENTIDAD: `(sucursal_id, telefono_clienta)`, NO `clienta_id`
 *
 * La conversación la define **el número que escribe y el número al que escribe**, porque eso es
 * lo único que el webhook de Meta trae. `clienta_id` es **opcional y posterior**: un teléfono
 * puede corresponder a **dos clientas distintas** (mamá e hija comparten número, `RN-CRM-01`
 * corregido en Fase 3), así que vincular la conversación a *una* clienta es una decisión que a
 * veces no se puede tomar y que nunca define el hilo.
 *
 * Consecuencia práctica, y es deliberada: mamá e hija **comparten la conversación** aunque sean
 * dos expedientes de CRM. Es lo que ocurre en la realidad — hay un solo chat de WhatsApp.
 */
export const conversaciones = conversacionesSchema.table(
  'conversaciones',
  {
    id: uuid('id').primaryKey(),
    sucursalId: uuid('sucursal_id').notNull(),
    /** Teléfono de la clienta, normalizado a 10 dígitos igual que en CRM. */
    telefonoClienta: text('telefono_clienta').notNull(),
    /** Opcional: ver la nota de identidad. Sin FK, `crm` es otro Bounded Context. */
    clientaId: uuid('clienta_id'),
    modo: text('modo').notNull().default('bot'),
    /** `NULL` mientras el modo es `bot`. Lo impone un `CHECK`. */
    motivoDeEscalamiento: text('motivo_de_escalamiento'),
    escaladaEn: timestamp('escalada_en', { withTimezone: true }),
    /**
     * **Última vez que la CLIENTA escribió.** Es el reloj de la ventana de 24 h de Meta
     * (`N-14`, `ADR-008`): pasadas 24 horas desde este instante, el salón **no puede escribir
     * texto libre**, solo una plantilla preaprobada.
     *
     * `NULL` cuando la conversación la inició el salón y la clienta nunca respondió: entonces la
     * ventana **nunca estuvo abierta**, que es distinto de "se cerró".
     */
    ultimaInteraccionEntranteEn: timestamp('ultima_interaccion_entrante_en', { withTimezone: true }),
    /** Para ordenar la bandeja por actividad, entrante o saliente. */
    ultimoMensajeEn: timestamp('ultimo_mensaje_en', { withTimezone: true }),
    /**
     * Mensajes entrantes sin respuesta del salón. Lo usa el filtro *"pendientes de responder"* de
     * la bandeja, que es la pantalla con la que se trabaja: se pone a 0 al responder.
     */
    mensajesSinResponder: integer('mensajes_sin_responder').notNull().default(0),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => ({
    /**
     * **Una conversación por sucursal y teléfono.** Sin esto, dos webhooks simultáneos de la misma
     * clienta crearían dos hilos y el historial quedaría partido — y la bandeja mostraría la
     * conversación duplicada, con la mitad de los mensajes en cada una.
     */
    unaPorSucursalYTelefono: uniqueIndex('conversaciones_sucursal_telefono_unq').on(tabla.sucursalId, tabla.telefonoClienta),
    // La consulta caliente de la bandeja: por sucursal y modo, lo más reciente primero.
    porBandeja: index('conversaciones_bandeja_idx').on(tabla.sucursalId, tabla.modo, tabla.ultimoMensajeEn),
    porClienta: index('conversaciones_clienta_idx').on(tabla.clientaId),
  }),
);

/**
 * `conversaciones.mensajes` — cada mensaje del hilo.
 *
 * ## IDEMPOTENCIA POR `wamid`
 *
 * `wamid` es el identificador que asigna Meta a cada mensaje. **Meta reintenta los webhooks**
 * —ante un timeout, un 500, o simplemente porque su política de reintentos lo decide— así que el
 * mismo mensaje puede llegar varias veces. Sin deduplicación, cada reintento duplicaría el
 * mensaje en el hilo, incrementaría el contador de pendientes y **volvería a disparar los efectos
 * secundarios** (actualizar la ventana de 24 h, escalar una clienta bloqueada, y en la Parte 3,
 * invocar a la IA y posiblemente agendar dos veces).
 *
 * El índice único sobre `wamid` lo impide **en la base**, no en el código: dos reintentos
 * simultáneos pasarían los dos cualquier comprobación previa en memoria.
 */
export const mensajes = conversacionesSchema.table(
  'mensajes',
  {
    id: uuid('id').primaryKey(),
    conversacionId: uuid('conversacion_id')
      .notNull()
      // FK dentro del MISMO esquema, por tanto legítima (`ADR-005` solo prohíbe las cruzadas).
      .references(() => conversaciones.id),
    /**
     * Id de Meta. `NULL` solo mientras un saliente está en vuelo y Meta no ha devuelto el suyo;
     * el `CHECK` exige que los entrantes siempre lo traigan.
     */
    wamid: text('wamid'),
    direccion: text('direccion').notNull(),
    emisor: text('emisor').notNull(),
    tipo: text('tipo').notNull().default('texto'),
    /**
     * Texto del mensaje, o nombre de la plantilla si `tipo = 'plantilla'`.
     *
     * ⚠️ **Contiene lo que la clienta escribió, así que es PII.** No debe aparecer en auditoría ni
     * en logs (`RN-AUD-01`): la auditoría registra que hubo un mensaje, no su contenido.
     */
    contenido: text('contenido'),
    /** Variables de la plantilla, cuando aplica. */
    parametrosPlantilla: text('parametros_plantilla'),
    estadoEntrega: text('estado_entrega').notNull().default('pendiente'),
    /** Código de error de Meta cuando `estado_entrega = 'failed'`. */
    errorDeEnvio: text('error_de_envio'),
    /** Cuándo ocurrió según Meta, no cuándo se guardó. */
    ocurridoEn: timestamp('ocurrido_en', { withTimezone: true }).notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => ({
    /**
     * **Deduplicación de reintentos de Meta.** Ver la nota de la tabla.
     *
     * Único **parcial** (`WHERE wamid IS NOT NULL`): un saliente en vuelo todavía no tiene
     * `wamid`, y sin el `WHERE` dos salientes simultáneos colisionarían entre sí por ser los dos
     * `NULL`... en PostgreSQL no colisionarían (`NULL` nunca iguala a `NULL`), pero el `WHERE`
     * deja explícito que la restricción es sobre mensajes identificados por Meta.
     */
    wamidUnico: uniqueIndex('mensajes_wamid_unq').on(tabla.wamid).where(sql`wamid IS NOT NULL`),
    // El hilo: todos los mensajes de una conversación en orden cronológico.
    porConversacion: index('mensajes_conversacion_idx').on(tabla.conversacionId, tabla.ocurridoEn),
  }),
);
