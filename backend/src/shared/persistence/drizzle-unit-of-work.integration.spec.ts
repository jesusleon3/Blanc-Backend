import { eq } from 'drizzle-orm';
import { crearBaseDeDatosDePrueba } from '../../database/test-utils/pg-mem-database';
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
 * Integración real contra pg-mem — cubre el camino de código (`db.transaction()` + contexto de
 * `AsyncLocalStorage`), no un mock del `UnitOfWork`.
 *
 * **Limitación documentada, verificada empíricamente en este hardening (2026-08-11):** pg-mem
 * acepta `BEGIN`/`ROLLBACK` sin error, pero no revierte de verdad las filas insertadas — un
 * `INSERT` seguido de `ROLLBACK` deja la fila visible igual. Esto se confirmó tanto vía el driver
 * `pg` crudo como vía `db.transaction()` de Drizzle antes de escribir esta prueba. Por eso el
 * segundo test de este archivo documenta el comportamiento REAL de pg-mem (no revierte) en vez de
 * afirmar el comportamiento que un Postgres real garantizaría — afirmar lo segundo aquí sería una
 * prueba verde que miente. La verificación de reversión real contra Postgres queda pendiente
 * (Tarea 8 del reporte de cierre: sin `DATABASE_URL` real disponible en este entorno).
 */
describe('DrizzleUnitOfWork (integración, pg-mem) — RN-AUD-01', () => {
  it('propaga el error de `trabajo` sin envolverlo ni silenciarlo', async () => {
    const db = crearBaseDeDatosDePrueba();
    const unitOfWork = new DrizzleUnitOfWork(db);

    await expect(
      unitOfWork.ejecutar(async () => {
        throw new Error('fallo de negocio simulado');
      }),
    ).rejects.toThrow('fallo de negocio simulado');
  });

  it('resuelve con el valor de `trabajo` cuando no hay error (camino feliz)', async () => {
    const db = crearBaseDeDatosDePrueba();
    const unitOfWork = new DrizzleUnitOfWork(db);

    const resultado = await unitOfWork.ejecutar(async () => 'listo');
    expect(resultado).toBe('listo');
  });

  it(
    'LIMITACIÓN CONOCIDA DE PG-MEM: un INSERT dentro de `ejecutar()` que luego falla NO se revierte en pg-mem ' +
      '(a diferencia de Postgres real) — ver comentario superior; no interpretar este test como validación de atomicidad real',
    async () => {
      const db = crearBaseDeDatosDePrueba();
      const repo = new DrizzleSucursalRepository(db);
      const unitOfWork = new DrizzleUnitOfWork(db);
      const sucursal = Sucursal.crear({ nombre: 'Blanc Prueba Atomicidad', horarioSemanal: HORARIO });

      await expect(
        unitOfWork.ejecutar(async () => {
          await repo.guardar(sucursal);
          throw new Error('fallo después del INSERT');
        }),
      ).rejects.toThrow('fallo después del INSERT');

      // Comportamiento real de pg-mem hoy: la fila QUEDA insertada pese al error posterior.
      // Un Postgres real, bajo el mismo código, la revertiría — eso es lo que este hardening deja
      // como pendiente de verificación (no se puede probar aquí, ver comentario superior del archivo).
      const filas = await db.select().from(sucursales).where(eq(sucursales.id, sucursal.id));
      expect(filas).toHaveLength(1);
    },
  );
});
