import { Manicurista } from '../entities/manicurista.entity';

export const MANICURISTA_REPOSITORY = 'MANICURISTA_REPOSITORY';

export interface ManicuristaRepository {
  guardar(manicurista: Manicurista): Promise<void>;
  buscarPorId(id: string): Promise<Manicurista | null>;
  listar(): Promise<Manicurista[]>;

  asignarASucursal(manicuristaId: string, sucursalId: string): Promise<void>;
  removerDeSucursal(manicuristaId: string, sucursalId: string): Promise<void>;
  listarSucursalesDeManicurista(manicuristaId: string): Promise<string[]>;
  estaAsignadaASucursal(manicuristaId: string, sucursalId: string): Promise<boolean>;
}
