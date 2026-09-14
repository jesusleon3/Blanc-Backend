import { Sucursal } from '../entities/sucursal.entity';
import { DiaFestivo } from '../entities/dia-festivo.entity';

export const SUCURSAL_REPOSITORY = 'SUCURSAL_REPOSITORY';

/** Puerto de dominio (ADR-002, Hexagonal) — la infraestructura Drizzle lo implementa. */
export interface SucursalRepository {
  guardar(sucursal: Sucursal): Promise<void>;
  buscarPorId(id: string): Promise<Sucursal | null>;
  buscarPorNombre(nombre: string): Promise<Sucursal | null>;
  listar(): Promise<Sucursal[]>;

  agregarDiaFestivo(diaFestivo: DiaFestivo): Promise<void>;
  listarDiasFestivos(sucursalId: string): Promise<DiaFestivo[]>;
  buscarDiaFestivoPorId(id: string): Promise<DiaFestivo | null>;
  eliminarDiaFestivo(id: string): Promise<void>;
}
