import { Conversacion } from '../entities/conversacion.entity';
import { DireccionMensaje, EmisorMensaje, EstadoEntrega, ModoConversacion, TipoMensaje } from '../../../../database/schema';

export const CONVERSACION_REPOSITORY = 'CONVERSACION_REPOSITORY';

export interface MensajeRegistrado {
  id: string;
  wamid: string | null;
  direccion: DireccionMensaje;
  emisor: EmisorMensaje;
  tipo: TipoMensaje;
  contenido: string | null;
  estadoEntrega: EstadoEntrega;
  errorDeEnvio: string | null;
  ocurridoEn: Date;
}

export interface NuevoMensaje {
  conversacionId: string;
  wamid: string | null;
  direccion: DireccionMensaje;
  emisor: EmisorMensaje;
  tipo: TipoMensaje;
  contenido: string | null;
  parametrosPlantilla?: string | null;
  estadoEntrega?: EstadoEntrega;
  ocurridoEn: Date;
}

export interface PaginaDeConversaciones {
  conversaciones: Conversacion[];
  hayMas: boolean;
}

export interface ConversacionRepository {
  guardar(conversacion: Conversacion): Promise<void>;
  buscarPorId(id: string): Promise<Conversacion | null>;
  buscarPorSucursalYTelefono(sucursalId: string, telefonoClienta: string): Promise<Conversacion | null>;

  /**
   * La bandeja. Filtros opcionales por sucursal, modo y pendientes de responder.
   *
   * Orden por `ultimoMensajeEn` descendente: la bandeja es una cola de trabajo, y lo que acaba de
   * llegar es lo que hay que atender.
   */
  listarParaBandeja(filtros: {
    sucursalId?: string;
    modo?: ModoConversacion;
    soloPendientes?: boolean;
    limite: number;
    desplazamiento: number;
  }): Promise<PaginaDeConversaciones>;

  /** El hilo completo, en orden cronológico. */
  listarMensajes(conversacionId: string, opciones: { limite: number; desplazamiento: number }): Promise<MensajeRegistrado[]>;

  /**
   * **Devuelve `false` si el `wamid` ya existía** — la deduplicación de reintentos de Meta.
   *
   * No lanza: un reintento **no es un error**, es el comportamiento normal y documentado de Meta.
   * Tratarlo como excepción obligaría a cada llamante a distinguir "duplicado benigno" de "fallo
   * real" con un `catch` por código, y el día que alguien lo olvide el webhook devolvería 500 a
   * Meta — que reintentaría otra vez, en bucle.
   */
  registrarMensaje(mensaje: NuevoMensaje): Promise<boolean>;

  /** Actualiza el estado de entrega que reporta Meta. `false` si ese `wamid` no es nuestro. */
  actualizarEstadoDeEntrega(wamid: string, estado: EstadoEntrega, errorDeEnvio?: string | null): Promise<boolean>;

  /** `phone_number_id` de Meta → `sucursal_id`. `null` si el número no está dado de alta. */
  buscarSucursalDeNumero(phoneNumberId: string): Promise<string | null>;
  registrarNumeroDeSucursal(input: { phoneNumberId: string; sucursalId: string; telefonoVisible: string }): Promise<void>;
  /** El `phone_number_id` con el que escribirle a esa sucursal. `null` si no tiene número. */
  buscarNumeroDeSucursal(sucursalId: string): Promise<string | null>;
}
