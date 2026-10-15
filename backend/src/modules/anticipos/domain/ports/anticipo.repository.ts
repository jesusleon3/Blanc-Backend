import { Anticipo } from '../entities/anticipo.entity';
import { EstadoAnticipo } from '../../../../database/schema';

export const ANTICIPO_REPOSITORY = 'ANTICIPO_REPOSITORY';

export interface ListadoDeAnticipos {
  anticipos: Anticipo[];
  hayMas: boolean;
}

export interface AnticipoRepository {
  /** **Puede lanzar 409 `ANTICIPO_YA_EXISTE`**: un índice único impone uno por cita. */
  guardar(anticipo: Anticipo): Promise<void>;
  buscarPorId(id: string): Promise<Anticipo | null>;
  /** El anticipo de una cita, si tiene. Es la consulta que alimenta `RN-ANT-04`. */
  buscarPorCita(citaId: string): Promise<Anticipo | null>;

  /**
   * Por estado, paginado y en orden de antigüedad.
   *
   * Es la pantalla de conciliación: *"qué transferencias estoy esperando"*. El orden más antiguo
   * primero no es estético — es la lista de llamadas pendientes, y la de hace tres días urge más
   * que la de hace una hora.
   */
  listarPorEstado(estado: EstadoAnticipo, opciones: { limite: number; desplazamiento: number }): Promise<ListadoDeAnticipos>;
}
