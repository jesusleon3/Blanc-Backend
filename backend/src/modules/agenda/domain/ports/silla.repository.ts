import { Silla } from '../entities/silla.entity';

export const SILLA_REPOSITORY = 'SILLA_REPOSITORY';

/**
 * Puerto de persistencia de `Silla` (ADR-002).
 *
 * `listarPorSucursal` devuelve activas e inactivas; filtrar por `activa` es decisión de quien
 * consuma, porque una silla dada de baja sigue apareciendo en las citas históricas.
 * `contarActivasPorSucursal` existe porque es **el dato que `MotorDisponibilidad` necesita**
 * (`DEC-035`): la mitad izquierda de `MIN(sillas_libres, manicuristas_activas)`.
 */
export interface SillaRepository {
  guardar(silla: Silla): Promise<void>;
  buscarPorId(id: string): Promise<Silla | null>;
  listarPorSucursal(sucursalId: string): Promise<Silla[]>;
  contarActivasPorSucursal(sucursalId: string): Promise<number>;
}
