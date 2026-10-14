import { ExcepcionPersonal } from '../entities/excepcion-personal.entity';
import { RangoHorario } from '../../../../database/schema';

export const EXCEPCION_PERSONAL_REPOSITORY = 'EXCEPCION_PERSONAL_REPOSITORY';

export interface ExcepcionPersonalRepository {
  guardar(excepcion: ExcepcionPersonal): Promise<void>;
  eliminar(id: string): Promise<void>;
  buscarPorId(id: string): Promise<ExcepcionPersonal | null>;
  /** Todas las excepciones que se solapan con el rango, de cualquier tipo y manicurista. */
  listarQueSolapan(rango: RangoHorario): Promise<ExcepcionPersonal[]>;
}
