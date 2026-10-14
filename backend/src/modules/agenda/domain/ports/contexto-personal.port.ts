import { RangoHorario } from '../../../../database/schema';
import { HorarioSemanalData } from '../../../sucursales-y-personal/domain/value-objects/horario-semanal.vo';

export const CONTEXTO_PERSONAL_PORT = 'CONTEXTO_PERSONAL_PORT';

/**
 * Lo que **Agenda necesita saber** de *Sucursales y Personal* para calcular disponibilidad.
 *
 * La interfaz la define el **consumidor** (Agenda), igual que `VerificarCitasFuturasPort` en el
 * sentido contrario y que `PERMISOS_USUARIO_PORT` (`DEC-029`). Agenda no conoce las tablas de
 * Personal: pide respuestas, no datos (`ADR-005`, `ADR-002`).
 *
 * ⚠️ **Las dos dependencias cruzadas van en sentidos opuestos** —Personal necesita saber de citas
 * futuras, Agenda necesita saber de personal— y si cada módulo importara al otro habría un ciclo.
 * Por eso **ninguno de los dos importa al otro**: los adaptadores viven en `IntegracionModule`.
 */
export interface ContextoPersonalPort {
  /**
   * Horario semanal configurado de la sucursal, para validar `RN-AGE-10` (dentro de bloques, sin
   * cruzar el corte) y `RN-AGE-12` (domingo cerrado — que no es una regla en código, es un día
   * con cero bloques en la configuración).
   */
  horarioSemanalDe(sucursalId: string): Promise<HorarioSemanalData | null>;

  /**
   * Ids de las manicuristas que **efectivamente** pueden atender en esa sucursal durante el rango.
   *
   * Resuelve, en este orden: asignadas de base + coberturas entrantes − ausencias − coberturas
   * salientes. **No descuenta las que ya tienen cita**: de eso se ocupa `MotorDisponibilidad`,
   * que es quien conoce la agenda.
   */
  manicuristasOperativasEn(sucursalId: string, rango: RangoHorario): Promise<string[]>;
}
