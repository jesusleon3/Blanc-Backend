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
