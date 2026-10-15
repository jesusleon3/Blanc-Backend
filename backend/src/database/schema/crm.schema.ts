import { boolean, index, integer, pgSchema, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const crmSchema = pgSchema('crm');

/**
 * Estados de **riesgo** de una clienta (`RN-CRM-02`, `RN-CRM-03`, `RN-CRM-04`).
 *
 * ⚠️ **`RN-CRM-02` define CUATRO valores: `normal`, `vip`, `lista_roja` y `bloqueada`.** Aquí se
 * modelan solo los tres de riesgo, que es el alcance pedido. `vip` **no se construye todavía** y
 * no por olvido: es una clasificación de *beneficio*, ortogonal al riesgo, y meterla en el mismo
 * campo obligaría a decidir qué significa una clienta que sería VIP y además acumula incidentes.
 * Queda señalado en §16 como pendiente de Fase 3 Parte 2.
 */
export const ESTADOS_DE_RIESGO = ['normal', 'lista_roja', 'bloqueada'] as const;
export type EstadoDeRiesgo = (typeof ESTADOS_DE_RIESGO)[number];

/** Tipos de incidente que **disparan la sugerencia** de lista roja (`RN-CRM-06`). */
export const TIPOS_DE_INCIDENTE = ['no_show', 'cancelacion_tardia', 'reprogramacion_tardia'] as const;
export type TipoDeIncidente = (typeof TIPOS_DE_INCIDENTE)[number];

/**
 * `crm.clientas` — aggregate raíz del Bounded Context de CRM / Clientas.
 *
 * IDENTIDAD GLOBAL, NO POR SUCURSAL (`RN-CRM-01`): una clienta es la misma en Zibatá, Lomas y
 * Álamos, y su historial las cruza todas. No hay `sucursal_id` aquí a propósito.
 *
 * ⚠️ **EL TELÉFONO NO ES CLAVE ÚNICA, y esto corrige un supuesto previo.** `RN-CRM-01` decía *"el
 * número de teléfono es la clave única de identidad"*, pero estaba marcada como *supuesto de
 * trabajo* y la realidad del salón la contradice: **mamá e hija son dos clientas distintas que
 * comparten el teléfono de contacto**. Si el teléfono fuera único, la segunda no podría existir, o
 * peor, se fusionarían sus dos historiales de incidentes — y una lista roja de la hija caería
 * sobre la madre. Lo único que sí se impide es el duplicado real: **mismo nombre y mismo
 * teléfono**.
 */
export const clientas = crmSchema.table(
  'clientas',
  {
    id: uuid('id').primaryKey(),
    nombre: text('nombre').notNull(),
    telefono: text('telefono').notNull(),
    /**
     * Teléfono anterior, tras un cambio de número.
     *
     * POR QUÉ SE GUARDA. Cuando una clienta cambia de número, escribe desde uno desconocido y su
     * historial queda inalcanzable por teléfono. Conservando el anterior se la puede reencontrar
     * por **nombre + número viejo**, que es lo que recepción tiene a mano en esa conversación.
     * Sin esto, el camino real sería crear una clienta nueva y perder su historial — incluido el
     * de incidentes, que es justo el que no debe perderse.
     */
    telefonoAnterior: text('telefono_anterior'),
    /** `text` + `CHECK`, no `pgEnum`: `ALTER TYPE … ADD VALUE` no corre en una transacción. */
    estadoDeRiesgo: text('estado_de_riesgo').notNull().default('normal'),
    /**
     * **Sugerencia**, no decisión (`RN-CRM-05` + `RN-CRM-06`).
     *
     * La enciende el sistema ante un incidente; **solo la Dueña** puede convertirla en
     * `estado_de_riesgo = lista_roja`. Son dos campos distintos a propósito: fusionarlos sería
     * exactamente la asignación automática que `RN-CRM-05` prohíbe.
     */
    sugeridaListaRoja: boolean('sugerida_lista_roja').notNull().default(false),
    /**
     * Cancelaciones **ordinarias** (con más de 60 minutos de antelación).
     *
     * Se cuentan como contexto para la Dueña —`RN-CRM-05` habla de sugerir *"con base en historial
     * de cancelaciones"*— pero **no encienden la sugerencia por sí solas**: `RN-CRM-06` es
     * explícita en que el disparador *"no es un umbral acumulado"*. Ver la nota de
     * `RegistrarIncidenteClientaUseCase`.
     */
    cancelacionesOrdinarias: integer('cancelaciones_ordinarias').notNull().default(0),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => ({
    // La búsqueda caliente: recepción tiene un número y quiere saber quién llama.
    porTelefono: index('clientas_telefono_idx').on(tabla.telefono),
    // Permite reencontrar a quien cambió de número.
    porTelefonoAnterior: index('clientas_telefono_anterior_idx').on(tabla.telefonoAnterior),
    /**
     * Duplicado real = mismo nombre Y mismo teléfono. Mamá e hija comparten teléfono pero no
     * nombre, así que esta restricción las deja convivir e impide dar de alta dos veces a la misma.
     */
    sinDuplicados: uniqueIndex('clientas_nombre_telefono_unq').on(tabla.nombre, tabla.telefono),
  }),
);

/**
 * `crm.incidentes_clienta` — bitácora de lo que dispara la sugerencia de lista roja (`RN-CRM-06`).
 *
 * POR QUÉ UNA TABLA Y NO UN CONTADOR. `RN-CRM-05` exige que la sugerencia sea revisable por la
 * Dueña: *"el sistema solo sugiere"*. Un contador diría "3" sin decir qué pasó, y la Dueña no
 * podría juzgar si marcar a alguien que canceló tres veces con aviso vale lo mismo que a quien
 * no se presentó tres veces. Cada fila guarda qué, cuándo y con cuánta antelación.
 */
export const incidentesClienta = crmSchema.table(
  'incidentes_clienta',
  {
    id: uuid('id').primaryKey(),
    /** FK **dentro del mismo esquema**, por tanto legítima (`ADR-005` solo prohíbe las cruzadas). */
    clientaId: uuid('clienta_id')
      .notNull()
      .references(() => clientas.id),
    /** Sin FK: `agenda` es otro Bounded Context (`ADR-005`). */
    citaId: uuid('cita_id').notNull(),
    tipo: text('tipo').notNull(),
    /** Cuándo ocurrió el incidente, no cuándo se registró. */
    ocurridoEn: timestamp('ocurrido_en', { withTimezone: true }).notNull(),
    /**
     * Minutos entre el incidente y el inicio de la cita. Negativo si ocurrió ya empezada.
     *
     * Se guarda el dato y no solo la clasificación: "canceló a 2 minutos" y "canceló a 58" caen
     * las dos en `cancelacion_tardia`, y la Dueña puede querer distinguirlas.
     */
    minutosDeAntelacion: integer('minutos_de_antelacion').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => ({
    porClienta: index('incidentes_clienta_idx').on(tabla.clientaId, tabla.ocurridoEn),
    /**
     * Un mismo incidente no se registra dos veces: si alguien reintenta marcar un `no_show` o la
     * red duplica la petición, el historial no debe inflarse — es la base de una decisión que
     * perjudica a la clienta.
     */
    sinDuplicados: uniqueIndex('incidentes_cita_tipo_unq').on(tabla.citaId, tabla.tipo),
  }),
);
