import { UnitOfWork } from '../unit-of-work.port';

/** Doble de prueba — ejecuta `trabajo` directamente, sin transacción real. Sirve para pruebas
 * unitarias de casos de uso que no necesitan verificar atomicidad (eso lo cubre un doble aparte). */
export function crearUnitOfWorkFalso(): jest.Mocked<UnitOfWork> {
  return {
    ejecutar: jest.fn((trabajo: () => Promise<unknown>) => trabajo()),
  } as unknown as jest.Mocked<UnitOfWork>;
}
