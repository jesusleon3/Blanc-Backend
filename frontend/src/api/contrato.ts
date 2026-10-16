/**
 * Tipos del contrato de la API de Blanc (`/v1`, `ADR-014`).
 *
 * ## ⚠️ ESTÁN ESCRITOS A MANO, Y ESO ES DEUDA RECONOCIDA
 *
 * Son la contrapartida de los *presenters* del backend. Hoy se escriben a mano porque `P8`
 * (`05-api-design.md`) está **abierto** y no existe especificación OpenAPI de la que generarlos.
 * El riesgo es deriva silenciosa; lo que lo mitiga parcialmente es que las pruebas usan **MSW** y
 * obligan a escribir las respuestas con su forma real. **Cuando `P8` cierre, hay que generarlos.**
 *
 * Las uniones de literales se repiten aquí a propósito, igual que hace el backend entre Bounded
 * Contexts: **esa copia es el contrato publicado**, y si el backend añade un valor, lo que falla
 * es un `switch` exhaustivo y no un `any` silencioso.
 */

// ---------------------------------------------------------------------------
// Identidad
// ---------------------------------------------------------------------------

/** Los 7 roles de `RN-SEG-01`. Catálogo **cerrado** (`ADR-024`, `DEC-044`). */
export type Rol = 'SUPER_ADMIN' | 'ADMINISTRADOR' | 'GERENTE' | 'RECEPCIONISTA' | 'MANICURISTA' | 'ANALISTA' | 'SOLO_LECTURA';

/** `'GLOBAL'` o la lista de ids de sucursal a las que alcanza. */
export type AlcanceSucursales = 'GLOBAL' | string[];

export interface PerfilUsuario {
  sub: string;
  rol: Rol;
  sucursales: AlcanceSucursales;
  /** `P9` — id del registro de personal cuando la usuaria ES manicurista. `null` en otros roles. */
  manicuristaId: string | null;
}

// ---------------------------------------------------------------------------
// Conversaciones
// ---------------------------------------------------------------------------

export type ModoConversacion = 'bot' | 'humano';

/** Los 9 motivos del `CHECK` de `conversaciones.motivo_de_escalamiento`. */
export type MotivoDeEscalamiento =
  | 'clienta_bloqueada'
  | 'solicitud_humana'
  | 'queja_o_reclamo'
  | 'cotizacion_compleja'
  | 'cancelacion_solicitada'
  | 'intervencion_manual'
  | 'baja_confianza_ia'
  | 'fuera_de_alcance'
  | 'medio_no_soportado';

/**
 * Los tres estados de la ventana de Meta (`N-14`).
 *
 * **Lo calcula el backend y viaja en la respuesta** — el cliente NO lo deduce de las marcas de
 * tiempo. Es la regla 2 de `ADR-027`: hay una sola autoridad sobre las reglas de negocio.
 */
export type EstadoDeVentana = 'abierta' | 'cerrada' | 'nunca_abierta';

export type DireccionMensaje = 'entrante' | 'saliente';
export type EmisorMensaje = 'clienta' | 'bot' | 'humano' | 'sistema';
export type TipoMensaje = 'texto' | 'plantilla' | 'no_soportado';
export type EstadoEntrega = 'pendiente' | 'enviado' | 'entregado' | 'leido' | 'fallido';

export interface Conversacion {
  id: string;
  sucursalId: string;
  telefonoClienta: string;
  clientaId: string | null;
  modo: ModoConversacion;
  motivoDeEscalamiento: MotivoDeEscalamiento | null;
  escaladaEn: string | null;
  ultimaInteraccionEntranteEn: string | null;
  ultimoMensajeEn: string | null;
  mensajesSinResponder: number;
  creadoEn: string;
}

export interface Mensaje {
  id: string;
  wamid: string | null;
  direccion: DireccionMensaje;
  emisor: EmisorMensaje;
  tipo: TipoMensaje;
  contenido: string | null;
  estadoEntrega: EstadoEntrega;
  errorDeEnvio: string | null;
  ocurridoEn: string;
}

export interface PaginaDeBandeja {
  conversaciones: Conversacion[];
  hayMas: boolean;
}

export interface HiloDeConversacion {
  conversacion: Conversacion;
  estadoDeVentana: EstadoDeVentana;
  ventanaAbierta: boolean;
  mensajes: Mensaje[];
}

export interface EscaladasPendientes {
  total: number;
  porSucursal: { sucursalId: string; total: number }[];
  masAntiguaEn: string | null;
}

export interface DescriptorDePlantilla {
  nombre: string;
  descripcion: string;
  parametros: string[];
}

export interface CatalogoDePlantillas {
  plantillas: DescriptorDePlantilla[];
  /** `true` mientras `N-14` siga abierto: estos nombres aún no están aprobados por Meta. */
  provisional: boolean;
  pendiente: string;
}

// ---------------------------------------------------------------------------
// Anticipos
// ---------------------------------------------------------------------------

export type EstadoAnticipo = 'pendiente' | 'pagado' | 'expirado' | 'retenido';

export interface Anticipo {
  id: string;
  citaId: string;
  clientaId: string;
  montoCentavos: number;
  porcentajeAplicado: number;
  estado: EstadoAnticipo;
  referenciaPago: string | null;
  confirmadoPor: string | null;
  confirmadoEn: string | null;
  creadoEn: string;
}

export interface PaginaDeAnticipos {
  anticipos: Anticipo[];
  limite: number;
  desplazamiento: number;
  hayMas: boolean;
}

// ---------------------------------------------------------------------------
// CRM / Clientas
// ---------------------------------------------------------------------------

export type EstadoDeRiesgo = 'normal' | 'lista_roja' | 'bloqueada';
export type TipoDeIncidente = 'no_show' | 'cancelacion_tardia' | 'cancelacion_ordinaria';

export interface Clienta {
  id: string;
  nombre: string;
  telefono: string;
  telefonoAnterior: string | null;
  estadoDeRiesgo: EstadoDeRiesgo;
  /** `RN-CRM-06` — la sugerencia es automática; **el estado solo lo cambia una persona**. */
  sugeridaListaRoja: boolean;
  cancelacionesOrdinarias: number;
  creadoEn: string;
}

export interface Incidente {
  id: string;
  citaId: string | null;
  tipo: TipoDeIncidente;
  ocurridoEn: string;
  minutosDeAntelacion: number | null;
}

export interface DetalleDeClienta {
  clienta: Clienta;
  incidentes: Incidente[];
}

export type AccionDeRiesgo = 'marcar_lista_roja' | 'marcar_bloqueada' | 'rehabilitar';

// ---------------------------------------------------------------------------
// Sucursales
// ---------------------------------------------------------------------------

/** Solo los campos que este frontend usa; el presenter del backend devuelve más. */
export interface Sucursal {
  id: string;
  nombre: string;
  enMantenimiento: boolean;
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

/** Los 9 estados de `TRANSICIONES_LEGALES` (`P3`, máquina de `Cita` cerrada 2026-10-14). */
export type EstadoCita =
  | 'en_espera_pago'
  | 'agendada'
  | 'pendiente_confirmacion'
  | 'confirmada'
  | 'completada'
  | 'no_show'
  | 'cancelada'
  | 'reprogramada'
  | 'expirada';

/**
 * Precio congelado al agendar. El backend lo calcula; el cliente **nunca**.
 *
 * ## ESTA FORMA ESTUVO MAL DESDE LA FASE 5, Y EL DEFECTO ERA VISIBLE
 *
 * La primera versión declaraba `precioBaseCentavos`, un `totalCentavos` no nulo y un arreglo de
 * `modificadores`, **ninguno de los cuales existe en el backend**, más un `[clave: string]:
 * unknown` que hacía que `tsc` lo aceptara todo. Las consecuencias eran dos y la segunda es grave:
 *
 * - `precioBaseCentavos` llegaba `undefined` y la vista de iPad mostraba **`NaN`**.
 * - `totalCentavos` es `number | null`, y `null` **no es cero**: es la negativa explícita del
 *   sistema a inventar un precio que debe fijar una persona (`DEC-033`). Tratándolo como número,
 *   un servicio de cotización manual se mostraba como **$0.00** — un precio falso en pantalla, que
 *   alguien podría decirle a la clienta.
 *
 * Lo destapó el cruce de datos de Analítica, no el verificador de contrato de `P8`: ese comparaba
 * solo las claves de primer nivel. Ahora cubre también las formas anidadas, y `cotizacion-snapshot`
 * es la primera que vigila.
 */
export interface CotizacionSnapshot {
  /** Versión del formato. Permite leer snapshots viejos sin adivinar su estructura. */
  version: number;
  congeladoEn: string;
  servicio: {
    id: string;
    nombre: string;
    categoria: string;
    duracionMinutos: number;
    precioCentavos: number;
  };
  /** **`null` cuando el servicio exige cotización manual.** No es cero: nadie lo ha cotizado. */
  totalCentavos: number | null;
  requiereCotizacionManual: boolean;
  /** Siempre `false` por ahora (`FL-COT-03` pospuesto). Explícito para que nadie lo suponga. */
  incluyeModificadores: boolean;
}

/**
 * Una cita **como la ve quien pregunta**.
 *
 * Los cuatro últimos campos son `undefined` para una `MANICURISTA`: el presenter del backend sale
 * antes de añadirlos (`DEC-040`). **No es que lleguen vacíos: no llegan.** Por eso son opcionales
 * en el tipo y no `| null` — el tipo refleja la asimetría real en vez de ocultarla.
 */
export interface Cita {
  id: string;
  sucursalId: string;
  sillaId: string | null;
  manicuristaId: string | null;
  servicioId: string;
  inicio: string;
  fin: string;
  estado: EstadoCita;
  cotizacionSnapshot: CotizacionSnapshot | null;
  /** Presente para todos los roles, incluida la Manicurista: va a atender a esa persona. */
  clientaNombre?: string;

  clientaId?: string;
  citaOrigenId?: string | null;
  numeroDeReprogramaciones?: number;
  /** `undefined` cuando no se resolvió, que es distinto de `false`. */
  enListaRoja?: boolean;
}

export interface PaginaDeAgenda {
  citas: Cita[];
  limite: number;
  desplazamiento: number;
  hayMas: boolean;
}

export interface Disponibilidad {
  sillasLibres: number;
  manicuristasDisponibles: number;
  capacidad: number;
  /** Sin acotar a 0: es lo que permite detectar sobrecupo real. */
  deficitDePersonal: number;
  hayLugar: boolean;
  motivo?: string;
}

export interface Silla {
  id: string;
  sucursalId: string;
  nombre: string;
  activa: boolean;
}

/** Qué pasó con el hueco al cancelar (`DEC-039`). `null` = la fila no se pudo procesar. */
export interface ResultadoDeHueco {
  /** Se liberó a `<= 30 min`: **no se avisó a nadie**, es capacidad perdida. */
  huecoPerdidoCortoPlazo: boolean;
  ofrecidaA: { id: string; clientaId: string } | null;
  descartadasPorNoCaber: number;
}

export interface ResultadoDeCancelacion {
  cita: Cita;
  /** Canceló a `<= 60 min` del inicio. **Sugiere** lista roja; no la aplica (`RN-CRM-06`). */
  incidenteTardio: boolean;
  /** Había anticipo pagado y **queda retenido** (`RN-ANT-04`). No se reembolsa. */
  anticipoRetenido: boolean;
  listaEspera: ResultadoDeHueco | null;
}

export interface ResultadoDeReprogramacion {
  original: Cita;
  nueva: Cita;
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export interface Servicio {
  id: string;
  nombre: string;
  categoria: string;
  duracionBaseMinutos: number;
  precioBaseCentavos: number;
  activo: boolean;
  requiereCotizacionManual: boolean;
}

// ---------------------------------------------------------------------------
// Personal y excepciones (`DEC-036`)
// ---------------------------------------------------------------------------

export interface Manicurista {
  id: string;
  nombre: string;
  activa: boolean;
}

export type TipoExcepcion = 'ausencia' | 'cobertura';

export interface ExcepcionPersonal {
  id: string;
  manicuristaId: string;
  tipo: TipoExcepcion;
  /** `null` en una ausencia (la manicurista no está, punto); el destino en una cobertura. */
  sucursalId: string | null;
  inicio: string;
  fin: string;
  motivo: string | null;
}

/** Clase del daño que una excepción provoca. */
export type ClaseDeAfectacion = 'cita_asignada' | 'sobrecupo_en_sucursal';

export interface CitaAfectada {
  citaId: string;
  clase: ClaseDeAfectacion;
  inicio: string;
  fin: string;
  manicuristaId: string | null;
  deficitDePersonal?: number;
}

export interface ResultadoDeExcepcion {
  excepcion: ExcepcionPersonal;
  /** Siempre presente, aunque vacía: así "no vino" nunca significa "no se calculó". */
  citasAfectadas: CitaAfectada[];
}

// ---------------------------------------------------------------------------
// Lista de espera (`DEC-039`)
// ---------------------------------------------------------------------------

export type EstadoSolicitud = 'en_espera' | 'notificada' | 'aceptada' | 'expirada' | 'cancelada';

export interface SolicitudListaEspera {
  id: string;
  sucursalId: string;
  clientaId: string;
  servicioId: string;
  /** Fecha de pared `YYYY-MM-DD`, no un instante. */
  fecha: string;
  estado: EstadoSolicitud;
  notificadaEn: string | null;
  /** Cuándo vence su turno. La oferta **no retiene el lugar** (`RN-AGE-13`). */
  expiraEn: string | null;
  citaId: string | null;
  creadoEn: string;
}

export interface ResultadoDeAvance {
  expiradas: SolicitudListaEspera[];
  nuevasOfertas: SolicitudListaEspera[];
}

// ---------------------------------------------------------------------------
// Analítica (Fase 6)
// ---------------------------------------------------------------------------

export interface ReporteDeAgenda {
  porEstado: Record<EstadoCita, number>;
  total: number;
  /** Canceladas a `<= 60 min` del inicio (`RN-CRM-06`). */
  cancelacionesTardias: number;
  atendidasPorSucursal: { sucursalId: string; completadas: number; noShow: number }[];
  /** `manicuristaId` `null` agrupa las completadas sin nadie asignado (`DEC-031`). */
  atendidasPorManicurista: { manicuristaId: string | null; completadas: number }[];
  /** **Estimado**: sale de lo cotizado al agendar, no de lo cobrado. */
  ingresoEstimadoCentavos: number;
  /** Completadas sin precio en plataforma (cotización manual): quedan FUERA de la suma. */
  completadasSinCotizar: number;
  listaDeEspera: { inscritas: number; notificadas: number; aceptadas: number; expiradas: number };
}

export interface ReporteDeAnticipos {
  porEstado: Record<EstadoAnticipo, { cantidad: number; centavos: number }>;
  /** `pagado` + `retenido`: dinero que el salón tiene. Un retenido no se reembolsa (`RN-ANT-04`). */
  cobradoCentavos: number;
}

export interface ReporteDeConversaciones {
  activas: number;
  /** Se derivan de los MENSAJES, no del `modo` actual. Ver la pantalla de Analítica. */
  soloBot: number;
  conIntervencionHumana: number;
  /** `null` —no 0— si no hubo conversaciones. */
  porcentajeResueltoPorElBot: number | null;
  escalamientosPorMotivo: Record<MotivoDeEscalamiento, number>;
}

export interface ResumenAnalitico {
  rango: { desde: string; hasta: string };
  sucursalId: string | null;
  citas: ReporteDeAgenda;
  anticipos: ReporteDeAnticipos;
  conversaciones: ReporteDeConversaciones;
  indicadores: {
    /** `no_show / (completada + no_show)`. `null` si no hubo citas atendibles. */
    tasaDeNoShow: number | null;
    efectividadDeListaDeEspera: number | null;
    porcentajeResueltoPorElBot: number | null;
    ingresoTotalEstimadoCentavos: number;
  };
  /** **Viajan en la respuesta a propósito**: quien lee un número debe saber qué no incluye. */
  advertencias: string[];
}

// ---------------------------------------------------------------------------
// Errores (`ADR-013`)
// ---------------------------------------------------------------------------

export type CategoriaDeError = 'domain' | 'integration' | 'unexpected';

export interface CuerpoDeError {
  error: {
    category: CategoriaDeError;
    code: string;
    message: string;
    correlationId?: string;
    details?: Record<string, unknown>;
  };
}
