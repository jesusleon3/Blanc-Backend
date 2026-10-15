import { crearBaseDeDatosDePrueba } from '../../database/test-utils/postgres-de-prueba';
import { DrizzleUnitOfWork } from './drizzle-unit-of-work';
import { TransactionContext } from './transaction-context';
import { DrizzleSucursalRepository } from '../../modules/sucursales-y-personal/infrastructure/persistence/drizzle-sucursal.repository';
import { Sucursal } from '../../modules/sucursales-y-personal/domain/entities/sucursal.entity';
import { horarioAbiertoSiempre } from '../../modules/agenda/test-utils/contexto-personal-falso';

/**
 * Anidamiento de `UnitOfWork` (integración, PostgreSQL real).
 *
 * Importa porque desde la Lista de Espera un caso de uso invoca a otro (`AceptarOferta` llama a
 * `AgendarCita`), y cada uno declara su propia unidad de trabajo.
 */
describe('DrizzleUnitOfWork — anidamiento', () => {
  it('UNA SOLA TRANSACCIÓN: la interna se une a la externa en vez de abrir otra', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const unitOfWork = new DrizzleUnitOfWork(db);

    let conexionExterna: unknown;
    let conexionInterna: unknown;

    await unitOfWork.ejecutar(async () => {
      conexionExterna = TransactionContext.obtenerConexionActiva();
      await unitOfWork.ejecutar(async () => {
        conexionInterna = TransactionContext.obtenerConexionActiva();
      });
    });

    expect(conexionExterna).toBeDefined();
    // La misma conexión, no dos: si fueran distintas serían dos transacciones independientes.
    expect(conexionInterna).toBe(conexionExterna);
  });

  it('EL ROLLBACK EXTERNO DESHACE LO ESCRITO POR LA INTERNA', async () => {
    // Este es el fallo concreto que el anidamiento ingenuo producía: la transacción interna hacía
    // commit por su cuenta, así que si la externa fallaba después quedaba escrito a medias. Un
    // rollback parcial es peor que no tener transacciones.
    const db = await crearBaseDeDatosDePrueba();
    const unitOfWork = new DrizzleUnitOfWork(db);
    const repo = new DrizzleSucursalRepository(db);
    const sucursal = Sucursal.crear({ nombre: 'Lomas', horarioSemanal: horarioAbiertoSiempre() });

    await expect(
      unitOfWork.ejecutar(async () => {
        await unitOfWork.ejecutar(async () => {
          await repo.guardar(sucursal);
        });
        throw new Error('fallo posterior en el caso de uso externo');
      }),
    ).rejects.toThrow('fallo posterior');

    await expect(repo.buscarPorId(sucursal.id)).resolves.toBeNull();
  });

  it('lo escrito dentro de la anidada es visible para la externa antes del commit', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const unitOfWork = new DrizzleUnitOfWork(db);
    const repo = new DrizzleSucursalRepository(db);
    const sucursal = Sucursal.crear({ nombre: 'Zibatá', horarioSemanal: horarioAbiertoSiempre() });

    await unitOfWork.ejecutar(async () => {
      await unitOfWork.ejecutar(async () => {
        await repo.guardar(sucursal);
      });
      // Con dos transacciones separadas esto habría devuelto `null`: la externa no vería lo que
      // la interna escribió hasta que esta hiciera commit.
      await expect(repo.buscarPorId(sucursal.id)).resolves.not.toBeNull();
    });

    await expect(repo.buscarPorId(sucursal.id)).resolves.not.toBeNull();
  });

  it('sin transacción previa abre una de verdad y la confirma', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const unitOfWork = new DrizzleUnitOfWork(db);
    const repo = new DrizzleSucursalRepository(db);
    const sucursal = Sucursal.crear({ nombre: 'Álamos', horarioSemanal: horarioAbiertoSiempre() });

    expect(TransactionContext.obtenerConexionActiva()).toBeUndefined();
    await unitOfWork.ejecutar(async () => {
      await repo.guardar(sucursal);
    });

    await expect(repo.buscarPorId(sucursal.id)).resolves.not.toBeNull();
  });
});
