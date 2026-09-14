import { Servicio } from '../entities/servicio.entity';

export const SERVICIO_REPOSITORY = 'SERVICIO_REPOSITORY';

/**
 * Puerto de persistencia del aggregate `Servicio` (ADR-002 — Application depende de esta
 * interfaz, nunca de Drizzle).
 *
 * `listar()` devuelve el catálogo **completo**, activos e inactivos: quien lo consume decide qué
 * hacer con un servicio dado de baja. El filtrado por disponibilidad para agendar no se resuelve
 * aquí — pertenece a `FL-COT-02`/`FL-COT-03`, pospuestos.
 */
export interface ServicioRepository {
  guardar(servicio: Servicio): Promise<void>;
  buscarPorId(id: string): Promise<Servicio | null>;
  listar(): Promise<Servicio[]>;

  /**
   * Vínculo N:M con `ModificadorDiseno` (`servicio_modificadores_aplicables`).
   *
   * Vive en este puerto y no dentro de la entidad `Servicio` porque `ModificadorDiseno` es otro
   * aggregate raíz: un aggregate no contiene a otro, así que la relación se maneja por id, nunca
   * cargando el objeto ajeno dentro del propio. Mismo criterio y misma forma que
   * `ManicuristaRepository.asignarASucursal()` y compañía.
   *
   * `listarModificadoresDeServicio` devuelve **ids**, no entidades: hidratarlas es tarea del
   * repositorio de modificadores, que es su dueño.
   */
  vincularModificador(servicioId: string, modificadorId: string): Promise<void>;
  desvincularModificador(servicioId: string, modificadorId: string): Promise<void>;
  listarModificadoresDeServicio(servicioId: string): Promise<string[]>;
  estaModificadorVinculado(servicioId: string, modificadorId: string): Promise<boolean>;
}
