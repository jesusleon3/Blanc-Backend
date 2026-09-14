import { ModificadorDiseno } from '../entities/modificador-diseno.entity';

export const MODIFICADOR_DISENO_REPOSITORY = 'MODIFICADOR_DISENO_REPOSITORY';

/**
 * Puerto de persistencia del aggregate `ModificadorDiseno` (ADR-002).
 *
 * Es un puerto **separado** del de `Servicio` a propósito: son dos aggregates raíz independientes
 * (01-domain-discovery.md §5.2). La tabla de unión `servicio_modificadores_aplicables` la escribe
 * `ServicioRepository`, que es el lado desde el que la relación se administra; este puerto solo
 * hidrata los modificadores cuyos ids esa tabla devuelve.
 */
export interface ModificadorDisenoRepository {
  guardar(modificador: ModificadorDiseno): Promise<void>;
  buscarPorId(id: string): Promise<ModificadorDiseno | null>;
  listar(): Promise<ModificadorDiseno[]>;

  /**
   * Hidrata un conjunto de modificadores por id, en una sola consulta — evita el N+1 que saldría
   * de llamar `buscarPorId` en bucle al resolver los modificadores de un servicio.
   *
   * Con una lista vacía devuelve `[]` sin consultar la base. No garantiza orden ni que todos los
   * ids existan: devuelve los que encuentre.
   */
  listarPorIds(ids: string[]): Promise<ModificadorDiseno[]>;
}
