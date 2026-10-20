import { boolean, date, index, integer, jsonb, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { RangoHorario, tstzrange } from './tipos-rango';

export { RangoHorario, tstzrange };

export const agendaSchema = pgSchema('agenda');


/**
 * `agenda.sillas` — la **estación de trabajo física** (`DEC-031`, patrón de Sillas Virtuales).
 *
 * El número de filas por sucursal **ES** la capacidad de esa sucursal: Zibatá 5, Lomas 3,
 * Álamos 1. No hay ninguna constante en código con esos números; añadir una silla es insertar
 * una fila.
 *
 * `sucursal_id` **sin clave foránea**: `sucursales` vive en el esquema `sucursales_personal` y
 * `ADR-005` prohíbe las FK entre esquemas. Mismo criterio que `usuarios_sucursales`.
 */
export const sillas = agendaSchema.table(
  'sillas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sucursalId: uuid('sucursal_id').notNull(),
    /** Etiqueta interna ("Lomas 1"). **Nunca visible a la clienta**: las sillas son un mecanismo
     * de capacidad, no un producto. Nada en WhatsApp dice "silla 2". */
    nombre: text('nombre').notNull(),
    activa: boolean('activa').notNull().default(true),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => ({
    porSucursal: index('sillas_sucursal_idx').on(tabla.sucursalId),
  }),
);

/**
 * Estados de `Cita`, alineados con `DEC-034` (migración `0006`, 2026-10-14).
 *
 * La columna es `text` + `CHECK` y **no** un `enum` de PostgreSQL: añadir un valor a un `enum`
 * requiere `ALTER TYPE … ADD VALUE`, que no corre dentro de la transacción en la que Drizzle
 * envuelve cada migración. Esta ampliación —de 6 a 9 valores— es exactamente el caso que
 * justificó esa decisión, y se resolvió con un `DROP`/`ADD CONSTRAINT`.
 *
 * ⚠️ **AL AÑADIR O QUITAR UN ESTADO HAY QUE TOCAR DOS SITIOS:** este arreglo y el `CHECK` de la
 * migración correspondiente. Drizzle no conoce el `CHECK` (no está en su snapshot), así que nada
 * lo obliga salvo esta nota y las pruebas de `restricciones-agenda.spec.ts`.
 *
 * SOBRE LA SEMÁNTICA DE LOS TRES PRIMEROS — **propuesta, no decidida.** La máquina de estados
 * formal sigue abierta (`P3`). La lectura coherente con lo aprobado es:
 * `agendada` (creada, aún no se le pide confirmar) → `pendiente_confirmacion` (recordatorio
 * enviado, esperando respuesta, `RN-CONV-11`) → `confirmada` (la clienta respondió que sí).
 * Las transiciones LEGALES entre ellos no están fijadas todavía.
 */
export const ESTADOS_CITA = [
  'agendada',
  'pendiente_confirmacion',
  'confirmada',
  'en_espera_pago',
  'completada',
  'no_show',
  'cancelada',
  'expirada',
  'reprogramada',
] as const;
export type EstadoCita = (typeof ESTADOS_CITA)[number];

/**
 * Estados que **liberan** el horario (`DEC-034`). Todo lo demás lo **ocupa**.
 *
 * Se formula por la negativa a propósito: un estado nuevo que alguien añada en el futuro ocupará
 * por defecto, que es el lado seguro del error. **Eso ya se cobró su primer dividendo**: la
 * ampliación de 6 a 9 estados (`0006`) **no requirió tocar el `WHERE` de ninguna de las dos
 * restricciones de exclusión** — `no_show`, `pendiente_confirmacion` y `confirmada` pasaron a
 * ocupar horario automáticamente, que es lo que `DEC-034` exige.
 *
 * `VerificarCitasFuturasPort` (`DEC-032`) reutiliza esta misma lista en vez de escribir una
 * segunda definición que pueda divergir — así se resolvió el pendiente `N-04`.
 */
export const ESTADOS_QUE_LIBERAN_HORARIO = [
  'cancelada',
  'expirada',
  'reprogramada',
  // `en_espera_pago` LIBERA — corregido en la migración `0007` (2026-10-14). `DEC-034` lo había
  // listado como ocupante ("mientras el anticipo no expire, el espacio es suyo"), lo que
  // CONTRADECÍA a `RN-ANT-03`, aprobada: "no existe una retención temporal real del horario…
  // el horario permanece disponible para cualquier otra clienta — el primero en pagar se queda
  // con el cupo". Ganó la regla de negocio. Consecuencia buscada: dos clientas de lista roja
  // pueden tener una cita pendiente de pago sobre el MISMO hueco, y la carrera se resuelve al
  // confirmar el pago, cuando la cita pasa a un estado que sí ocupa y la restricción decide.
  'en_espera_pago',
] as const satisfies readonly EstadoCita[];

/**
 * Estados en los que una cita de garantía **deja de consumir el derecho** de la clienta.
 *
 * ## LA REGLA, Y POR QUÉ NO ES SIMÉTRICA (decisión de la Dueña, 2026-10-19)
 *
 * Un servicio completado se honra con **una** reposición. La pregunta que esto responde es cuándo
 * una reposición agendada *"gasta"* ese derecho, y la respuesta depende de **quién falló**:
 *
 * - **`cancelada`** y **`expirada`**: la reposición no se hizo, y la causa habitual es del salón —
 *   una manicurista que falta, un cierre imprevisto. La clienta **conserva su derecho**: el trabajo
 *   sigue mal hecho y nadie se lo ha arreglado.
 * - **`reprogramada`**: no es un final, es la misma garantía movida de hora (`DEC-042` crea una
 *   fila nueva en lugar de mover la existente). La fila nueva es la que cuenta.
 * - **`no_show`** y **`completada`** NO están aquí, y es el centro de la regla: en el primer caso el
 *   salón apartó la silla y la clienta no vino; en el segundo, ya se repuso. En los dos cumplió.
 *
 * ## POR QUÉ NO SE REUTILIZA `ESTADOS_QUE_LIBERAN_HORARIO`
 *
 * Coincide casi del todo, y aun así son dos preguntas distintas: *"¿esta cita consume capacidad?"*
 * y *"¿esta cita gasta la garantía?"*. La prueba de que no son la misma es `en_espera_pago`, que
 * libera horario y que una garantía nunca llega a tener (nace `agendada`, porque el 40 % de cero es
 * cero). Compartir el array ataría dos decisiones de negocio independientes: el día que una cambie,
 * la otra cambiaría con ella en silencio.
 *
 * ⚠️ **Es el `WHERE` del índice único parcial `citas_garantia_unica_por_origen`** (migración
 * `0018`), que Drizzle no sabe expresar y no tiene en su snapshot. Cambiar este array obliga a
 * escribir la migración que recrea el índice; lo vigila `deriva-restricciones-agenda.spec.ts`.
 */
export const ESTADOS_QUE_NO_CONSUMEN_LA_GARANTIA = ['reprogramada', 'cancelada', 'expirada'] as const satisfies readonly EstadoCita[];

/**
 * `agenda.citas` — el aggregate central de la Fase 2.
 *
 * **Toda cita ocupa exactamente una silla, siempre** (`silla_id` es `NOT NULL`); la manicurista
 * es opcional. Esa inversión es lo que hace que la capacidad de la sucursal sea una consecuencia
 * aritmética del esquema y no una regla que la aplicación deba recordar — y lo que evita que
 * `NULL = NULL` desactive silenciosamente la restricción de exclusión (`DEC-031` §2.1).
 *
 * **Claves foráneas:** solo `silla_id`, porque `sillas` vive en este mismo esquema. `sucursal_id`,
 * `manicurista_id`, `clienta_id` y `servicio_id` apuntan a otros Bounded Contexts y van **sin FK**
 * (`ADR-005`). `clienta_id` además apunta a un contexto que **todavía no existe** (CRM, Fase 3).
 *
 * **Las dos restricciones `EXCLUDE USING gist` no se declaran aquí**: Drizzle no sabe expresarlas.
 * Viven en la migración `0005`, escritas a mano. Ver la deuda técnica registrada en el handoff.
 */
export const citas = agendaSchema.table(
  'citas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sucursalId: uuid('sucursal_id').notNull(),
    sillaId: uuid('silla_id')
      .notNull()
      .references(() => sillas.id),
    /** `NULL` = la clienta no eligió manicurista. La Encargada la asigna cuando la clienta llega
     * (`DEC-031` §2.4); ese `UPDATE` lo valida sola la segunda restricción de exclusión. */
    manicuristaId: uuid('manicurista_id'),
    /** Sin FK y **sin tabla destino todavía**: el Bounded Context de Clientas (CRM) es Fase 3. */
    clientaId: uuid('clienta_id').notNull(),
    servicioId: uuid('servicio_id').notNull(),
    rangoHorario: tstzrange('rango_horario').notNull(),
    estado: text('estado').notNull(),
    /**
     * Cita de la que esta procede al reprogramar. FK **al mismo esquema**, así que es legítima
     * (`ADR-005` solo prohíbe las cruzadas). Da la trazabilidad de la cadena completa.
     */
    citaOrigenId: uuid('cita_origen_id'),
    /**
     * `true` si esta cita es la **reposición de un servicio bajo garantía** (`RN-GAR-01..06`).
     *
     * ## POR QUÉ NO SE REUTILIZA `cita_origen_id`
     *
     * Ese campo ya significa *"esta cita viene de aquella por una reprogramación"*, y de él depende
     * `numero_de_reprogramaciones` y el tope de 3 (`DEC-042`). Darle un segundo significado haría
     * que una garantía contara como reprogramación: una clienta con un servicio mal hecho se
     * quedaría sin poder mover su cita de reposición. Son dos relaciones distintas entre citas y
     * necesitan dos columnas.
     */
    esGarantia: boolean('es_garantia').notNull().default(false),
    /**
     * La cita `completada` que se está honrando. **Inseparable de `es_garantia`** por un `CHECK`:
     * una garantía sin cita de origen no se podría verificar contra la ventana de 7 días, y una
     * cita normal con origen de garantía sería un dato sin sentido que alguien interpretaría mal.
     */
    citaGarantizadaId: uuid('cita_garantizada_id'),
    /**
     * Cuántas veces se ha reprogramado esta cadena. Se guarda en vez de recorrer la cadena en
     * cada comprobación: el tope son **3** (`DEC-042`) y recorrer N citas por cada intento sería
     * una consulta por eslabón para responder una pregunta que cabe en un entero.
     */
    numeroDeReprogramaciones: integer('numero_de_reprogramaciones').notNull().default(0),
    /**
     * Cotización **congelada** en el momento de agendar (`04-data-model.md` §5.2): precio y
     * duración tal como estaban, no una referencia viva al catálogo. Si mañana sube el precio del
     * gelish, esta cita conserva lo que se le dijo a la clienta.
     *
     * `NULL` mientras el motor de cotización (`FL-COT-03`) no exista: hoy se acepta por parámetro
     * y nadie lo rellena automáticamente. **No se crean tablas `cotizaciones` ni
     * `composiciones_por_una`** — son Value Objects que viven aquí dentro.
     */
    cotizacionSnapshot: jsonb('cotizacion_snapshot'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => ({
    porSucursal: index('citas_sucursal_idx').on(tabla.sucursalId),
    porManicurista: index('citas_manicurista_idx').on(tabla.manicuristaId),
    porClienta: index('citas_clienta_idx').on(tabla.clientaId),
  }),
);

/**
 * Estados de una solicitud de Lista de Espera (`DEC-039`, reglas 2.2/2.3).
 *
 * `en_espera` → `notificada` (con `expira_en`) → `aceptada` | `expirada` | `cancelada`.
 *
 * **`expirada` es terminal**: quien deja pasar su turno pierde su lugar en la fila, no vuelve al
 * final. Es la mecánica que fija la orden de trabajo, y tiene una consecuencia de negocio que
 * conviene conocer — ver la nota en `SolicitudListaEspera`.
 */
export const ESTADOS_LISTA_ESPERA = ['en_espera', 'notificada', 'aceptada', 'expirada', 'cancelada'] as const;
export type EstadoListaEspera = (typeof ESTADOS_LISTA_ESPERA)[number];

/**
 * Estados que **se ven en la agenda del día**, distintos de los que ocupan horario.
 *
 * POR QUÉ NO SE REUTILIZA `ESTADOS_QUE_LIBERAN_HORARIO` NEGADO. Son dos preguntas diferentes:
 * "¿esta cita consume capacidad?" y "¿esta cita tiene que aparecer en la pantalla?".
 *
 * El caso que lo destapó: una cita de clienta en lista roja nace en `en_espera_pago`, que
 * **libera horario** (`RN-ANT-03`) pero **existe y hay que perseguirla** para cobrar el anticipo.
 * Filtrando la vista por ocupación, esas citas eran invisibles — justo las que más atención
 * necesitan. Se excluyen solo las que están anuladas o sustituidas por otra fila.
 */
export const ESTADOS_VISIBLES_EN_AGENDA = [
  'agendada',
  'pendiente_confirmacion',
  'confirmada',
  'en_espera_pago',
  'completada',
  'no_show',
] as const satisfies readonly EstadoCita[];

/** Estados en los que la solicitud **sigue viva** en la fila y cuenta para el FIFO. */
export const ESTADOS_LISTA_ESPERA_ACTIVOS = ['en_espera', 'notificada'] as const satisfies readonly EstadoListaEspera[];

/**
 * Lista de Espera (`DEC-039`) — demanda que no cupo.
 *
 * POR QUÉ VIVE EN `agenda` Y NO EN UN CONTEXTO PROPIO. Habla de huecos y de citas: para decidir
 * si una solicitud es candidata hay que cruzar el hueco liberado contra la capacidad real de la
 * sucursal (`MotorDisponibilidad`), y aceptar una oferta **es** agendar una cita. Un contexto
 * aparte tendría que preguntarle a Agenda en cada paso.
 *
 * NO LLEVA COLUMNA `posicion`. El orden FIFO es `creado_en`: una columna de posición habría que
 * recalcularla en cada alta, baja y expiración, y cualquier fallo a medio camino dejaría la fila
 * con dos personas en el mismo puesto. El reloj no se desordena.
 *
 * NO COPIA LA DURACIÓN DEL SERVICIO. Se resuelve por `ContextoCatalogoPort` al evaluar. Copiarla
 * crearía un segundo lugar donde vive la verdad del catálogo — el mismo error que esta fase
 * acabó de corregir en `citas`, donde el cliente podía mandar la duración que quisiera.
 */
export const listaEspera = agendaSchema.table(
  'lista_espera',
  {
    id: uuid('id').primaryKey(),
    /** Sin FK: `sucursales_personal` es otro Bounded Context (`ADR-005`). */
    sucursalId: uuid('sucursal_id').notNull(),
    /** Sin FK y sin tabla destino todavía: Clientas (CRM) es Fase 3. */
    clientaId: uuid('clienta_id').notNull(),
    servicioId: uuid('servicio_id').notNull(),
    /**
     * Día que la clienta quiere, como **fecha de pared** (`date`, no `timestamptz`).
     *
     * Pide "el jueves", no un instante. Guardarlo como `timestamptz` obligaría a inventar una
     * hora y a desplazarla por zona en cada comparación; un hueco que se libera a las 23:30 de
     * Querétaro acabaría en la fila del viernes.
     */
    fecha: date('fecha').notNull(),
    estado: text('estado').notNull(),
    /** Cuándo se le ofreció el hueco y cuándo caduca su turno. `NULL` mientras está `en_espera`. */
    notificadaEn: timestamp('notificada_en', { withTimezone: true }),
    expiraEn: timestamp('expira_en', { withTimezone: true }),
    /**
     * **Hora de inicio del hueco que se le ofreció.**
     *
     * Es imprescindible y no redundante con `notificada_en`: esa dice *cuándo se avisó*, no *qué
     * se ofreció*. Sin esta columna, al expirar un turno no se puede saber qué hueco había que
     * pasar a la siguiente de la fila, y el avance FIFO —el corazón de `DEC-039`— no funciona.
     */
    huecoInicio: timestamp('hueco_inicio', { withTimezone: true }),
    /** La cita que nació al aceptar. FK **al mismo esquema**, por tanto legítima (`ADR-005`). */
    citaId: uuid('cita_id').references(() => citas.id),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => ({
    // La consulta caliente es "la fila de esta sucursal para esta fecha, en orden de llegada".
    porFila: index('lista_espera_fila_idx').on(tabla.sucursalId, tabla.fecha, tabla.estado, tabla.creadoEn),
    porClienta: index('lista_espera_clienta_idx').on(tabla.clientaId),
  }),
);
