import { crearBaseDeDatosDePrueba } from './pg-mem-database';
import { sucursales } from '../schema';

describe('pg-mem — forma real del error de violación de unicidad (smoke, sin asserts de negocio)', () => {
  it('expone .code === "23505" en un INSERT duplicado, igual que postgres-js', async () => {
    const db = crearBaseDeDatosDePrueba();
    const fila = {
      nombre: 'Duplicado',
      horarioSemanal: {},
      descansos: null,
      enMantenimiento: false,
    };
    await db.insert(sucursales).values(fila);

    let errorCapturado: unknown;
    try {
      await db.insert(sucursales).values(fila);
    } catch (error) {
      errorCapturado = error;
    }

    expect(errorCapturado).toBeDefined();
    expect((errorCapturado as { code?: string }).code).toBe('23505');
  });
});
