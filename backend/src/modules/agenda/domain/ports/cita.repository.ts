import { Cita } from '../entities/cita.entity';
import { RangoHorario } from '../../../../database/schema/agenda.schema';

export const CITA_REPOSITORY = 'CITA_REPOSITORY';

/**
 * Puerto de persistencia de `Cita` (ADR-002).
 *
 * **Lo que NO está aquí, a propósito:** nada de búsqueda de huecos libres ni de cálculo de
 * disponibilidad. Eso es `MotorDisponibilidad` (`DEC-035`), un servicio de dominio que todavía no
 * existe; meterlo en el repositorio mezclaría persistencia con la regla de capacidad.
 */
export interface CitaRepository {
  /**
   * Persiste la cita.
   *
   * **Puede lanzar `ConflictoDeNegocioError` (409)** si alguna de las dos restricciones de
   * exclusión salta: `SILLA_OCUPADA` o `MANICURISTA_OCUPADA`. No es un fallo del sistema sino la
   * condición de carrera que esas restricciones existen para atrapar — dos reservas simultáneas
   * que pasaron la comprobación previa de disponibilidad.
   */
  guardar(cita: Cita): Promise<void>;
  buscarPorId(id: string): Promise<Cita | null>;
  /** Citas que **ocupan** horario en el rango dado (`DEC-034`); las canceladas/expiradas/reprogramadas no salen. */
  listarQueOcupanEnRango(sucursalId: string, rango: RangoHorario): Promise<Cita[]>;
  /** Alimenta `VerificarCitasFuturasPort` (`DEC-032`) cuando Agenda lo implemente. Pendiente `N-04`. */
  tieneCitasFuturasQueOcupan(manicuristaId: string, desde: Date): Promise<boolean>;
}
