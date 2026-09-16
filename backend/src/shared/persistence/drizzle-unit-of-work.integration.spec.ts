import { eq } from 'drizzle-orm';
import { crearBaseDeDatosDePrueba } from '../../database/test-utils/postgres-de-prueba';
import { sucursales } from '../../database/schema';
import { DrizzleUnitOfWork } from './drizzle-unit-of-work';
import { Sucursal } from '../../modules/sucursales-y-personal/domain/entities/sucursal.entity';
import { DrizzleSucursalRepository } from '../../modules/sucursales-y-personal/infrastructure/persistence/drizzle-sucursal.repository';

const HORARIO = {
  lunes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  martes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  miercoles: [{ horaInicio: '09:00', horaFin: '18:00' }],
  jueves: [{ horaInicio: '09:00', horaFin: '18:00' }],
  viernes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  sabado: [{ horaInicio: '09:00', horaFin: '15:00' }],
  domingo: [],
};

/**
 * Integración contra **PostgreSQL real** (Testcontainers) — cubre el camino de código
 * (`db.transaction()` + contexto de `AsyncLocalStorage`), no un mock del `UnitOfWork`.
 *
 * **RIESGO ACEPTADO CERRADO (2026-09-15).** Hasta esta fecha estas pruebas corrían contra pg-mem,
 * que acepta `BEGIN`/`ROLLBACK` sin error pero **no revierte de verdad** las filas insertadas. El
 * archivo documentaba esa limitación y afirmaba el comportamiento equivocado a propósito —
 * afirmar la reversión sobre pg-mem habría sido una prueba verde que miente. Con PostgreSQL real
 * ya se puede verificar la atomicidad de verdad, que es lo que `RN-AUD-01` exige: la auditoría de
 * una operación no puede quedar huérfana si la operación falla, ni al revés.
 */
describe('DrizzleUnitOfWork (integración, PostgreSQL real) — RN-AUD-01', () => {
  it('propaga el error de `trabajo` sin envolverlo ni silenciarlo', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const unitOfWork = new DrizzleUnitOfWork(db);

    await expect(
      unitOfWork.ejecutar(async () => {
        throw new Error('fallo de negocio simulado');
      }),
    ).rejects.toThrow('fallo de negocio simulado');
  });

  it('resuelve con el valor de `trabajo` cuando no hay error (camino feliz)', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const unitOfWork = new DrizzleUnitOfWork(db);

    const resultado = await unitOfWork.ejecutar(async () => 'listo');
    expect(resultado).toBe('listo');
  });

  it('ATOMICIDAD REAL: un INSERT dentro de `ejecutar()` que luego falla SÍ se revierte', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const repo = new DrizzleSucursalRepository(db);
    const unitOfWork = new DrizzleUnitOfWork(db);
    const sucursal = Sucursal.crear({ nombre: 'Blanc Prueba Atomicidad', horarioSemanal: HORARIO });

    await expect(
      unitOfWork.ejecutar(async () => {
        await repo.guardar(sucursal);
        throw new Error('fallo después del INSERT');
      }),
    ).rejects.toThrow('fallo después del INSERT');

    // Esta es la aserción que pg-mem hacía imposible: la fila NO debe existir.
    const filas = await db.select().from(sucursales).where(eq(sucursales.id, sucursal.id));
    expect(filas).toHaveLength(0);
  });

  it('el camino feliz SÍ confirma: lo escrito dentro de `ejecutar()` persiste tras terminar', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const repo = new DrizzleSucursalRepository(db);
    const unitOfWork = new DrizzleUnitOfWork(db);
    const sucursal = Sucursal.crear({ nombre: 'Blanc Commit Confirmado', horarioSemanal: HORARIO });

    await unitOfWork.ejecutar(async () => {
      await repo.guardar(sucursal);
    });

    // Sin esta prueba, la anterior podría pasar simplemente porque nada se escribe nunca.
    const filas = await db.select().from(sucursales).where(eq(sucursales.id, sucursal.id));
    expect(filas).toHaveLength(1);
  });

  it('la reversión alcanza a TODAS las escrituras de la transacción, no solo a la última', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const repo = new DrizzleSucursalRepository(db);
    const unitOfWork = new DrizzleUnitOfWork(db);
    const primera = Sucursal.crear({ nombre: 'Blanc Primera', horarioSemanal: HORARIO });
    const segunda = Sucursal.crear({ nombre: 'Blanc Segunda', horarioSemanal: HORARIO });

    await expect(
      unitOfWork.ejecutar(async () => {
        await repo.guardar(primera);
        await repo.guardar(segunda);
        throw new Error('fallo tras dos INSERT');
      }),
    ).rejects.toThrow('fallo tras dos INSERT');

    expect(await db.select().from(sucursales)).toHaveLength(0);
  });
});
