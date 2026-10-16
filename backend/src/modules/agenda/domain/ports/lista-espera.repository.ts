import { SolicitudListaEspera } from '../entities/solicitud-lista-espera.entity';

export const LISTA_ESPERA_REPOSITORY = 'LISTA_ESPERA_REPOSITORY';

export interface ListaEsperaRepository {
  /**
   * **Puede lanzar `ConflictoDeNegocioError` (409)**: la base impone por índice único parcial que
   * haya **una sola solicitud `notificada`** por sucursal y fecha
   * (`LISTA_ESPERA_YA_HAY_OFERTA_ABIERTA`), y que una clienta no se apunte dos veces al mismo
   * servicio, sucursal y fecha mientras su solicitud siga viva (`LISTA_ESPERA_DUPLICADA`).
   */
  guardar(solicitud: SolicitudListaEspera): Promise<void>;
  buscarPorId(id: string): Promise<SolicitudListaEspera | null>;

  /**
   * La fila viva de una sucursal en una fecha, **en orden de llegada** (`creado_en`).
   *
   * El orden es el FIFO de `DEC-039` y sale de la base, no de ordenar en memoria: es la misma
   * razón por la que no hay columna `posicion`. Devuelve `en_espera` y `notificada` — las
   * terminadas no cuentan para la fila.
   */
  listarFila(sucursalId: string, fecha: string): Promise<SolicitudListaEspera[]>;

  /** La solicitud con oferta abierta de esa fila, si hay alguna. A lo sumo una (índice único). */
  buscarOfertaAbierta(sucursalId: string, fecha: string): Promise<SolicitudListaEspera | null>;

  /**
   * La oferta abierta **de una clienta concreta**, en cualquier fecha de esa sucursal.
   *
   * ## POR QUÉ NO BASTA `buscarOfertaAbierta`
   *
   * Esa consulta pide la fecha, y **quien pregunta aquí no la sabe**: el bot recibe un *"sí, lo
   * quiero"* y tiene que averiguar a qué se refiere. Buscar solo en la fila de hoy fallaría en el
   * caso normal — se cancela una cita del jueves y se ofrece el hueco el martes.
   *
   * Se consulta por `clienta_id` y estado `notificada` en la base, no filtrando en memoria sobre
   * la fila del día: una clienta puede estar en varias filas y la oferta viva es una sola.
   */
  buscarOfertaAbiertaDeClienta(sucursalId: string, clientaId: string): Promise<SolicitudListaEspera | null>;

  /**
   * Todas las solicitudes `notificada` cuyo turno ya venció, de cualquier sucursal y fecha.
   *
   * Alimenta a `AvanzarTurnoListaEsperaUseCase` cuando se invoca sin acotar: es lo que un job
   * runner llamaría periódicamente, y tiene que poder barrer todas las filas de una pasada.
   */
  listarTurnosVencidos(ahora: Date): Promise<SolicitudListaEspera[]>;
}
