import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';
import { DrizzleModificadorDisenoRepository } from './drizzle-modificador-diseno.repository';
import { ModificadorDiseno } from '../../domain/entities/modificador-diseno.entity';

const MODIFICADOR_VALIDO = { nombre: 'Diseño francés', minutosAdicionales: 15, precioAdicionalCentavos: 8000 };

describe('DrizzleModificadorDisenoRepository (integración) — FL-COT-01', () => {
  it('guarda y recupera un modificador con todos sus campos intactos', async () => {
    const repo = new DrizzleModificadorDisenoRepository(await crearBaseDeDatosDePrueba());
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);

    await repo.guardar(modificador);
    const recuperado = await repo.buscarPorId(modificador.id);

    expect(recuperado?.id).toBe(modificador.id);
    expect(recuperado?.nombre).toBe('Diseño francés');
    expect(recuperado?.minutosAdicionales).toBe(15);
    expect(recuperado?.activo).toBe(true);
  });

  it('la baja lógica sobrevive el viaje de ida y vuelta (columna `activo`, migración 0003)', async () => {
    const repo = new DrizzleModificadorDisenoRepository(await crearBaseDeDatosDePrueba());
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
    await repo.guardar(modificador);

    modificador.desactivar();
    await repo.guardar(modificador);

    const recuperado = await repo.buscarPorId(modificador.id);
    expect(recuperado?.activo).toBe(false);
    // Sigue existiendo: la baja es lógica, no un DELETE.
    expect(await repo.listar()).toHaveLength(1);
  });

  it('devuelve null cuando el id no existe', async () => {
    const repo = new DrizzleModificadorDisenoRepository(await crearBaseDeDatosDePrueba());
    await expect(repo.buscarPorId('00000000-0000-0000-0000-000000000000')).resolves.toBeNull();
  });

  describe('RN-COT-07 — el importe adicional sobrevive como entero', () => {
    it.each([
      ['un extra corriente', 8000],
      ['cero (modificador solo estético, sin costo)', 0],
      ['un extra que en pesos tendría decimales: $80.50', 8050],
    ])('%s se persiste y se lee como el MISMO entero', async (_caso, precioAdicionalCentavos) => {
      const repo = new DrizzleModificadorDisenoRepository(await crearBaseDeDatosDePrueba());
      const modificador = ModificadorDiseno.crear({ ...MODIFICADOR_VALIDO, precioAdicionalCentavos });

      await repo.guardar(modificador);
      const recuperado = await repo.buscarPorId(modificador.id);

      expect(recuperado?.precioAdicionalCentavos).toBe(precioAdicionalCentavos);
      expect(typeof recuperado?.precioAdicionalCentavos).toBe('number');
      expect(Number.isInteger(recuperado?.precioAdicionalCentavos)).toBe(true);
    });
  });

  it('guardar es un upsert: actualizar no duplica la fila', async () => {
    const repo = new DrizzleModificadorDisenoRepository(await crearBaseDeDatosDePrueba());
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
    await repo.guardar(modificador);

    modificador.actualizarDatos({ precioAdicionalCentavos: 9500, minutosAdicionales: 20 });
    await repo.guardar(modificador);

    const todos = await repo.listar();
    expect(todos).toHaveLength(1);
    expect(todos[0].precioAdicionalCentavos).toBe(9500);
    expect(todos[0].minutosAdicionales).toBe(20);
  });

  it('listar devuelve todo el catálogo de modificadores', async () => {
    const repo = new DrizzleModificadorDisenoRepository(await crearBaseDeDatosDePrueba());
    await repo.guardar(ModificadorDiseno.crear({ ...MODIFICADOR_VALIDO, nombre: 'Francés' }));
    await repo.guardar(ModificadorDiseno.crear({ ...MODIFICADOR_VALIDO, nombre: 'Pedrería' }));

    const nombres = (await repo.listar()).map((modificador) => modificador.nombre).sort();
    expect(nombres).toEqual(['Francés', 'Pedrería']);
  });

  it('listar sobre un catálogo vacío devuelve un arreglo vacío, no null', async () => {
    const repo = new DrizzleModificadorDisenoRepository(await crearBaseDeDatosDePrueba());
    await expect(repo.listar()).resolves.toEqual([]);
  });
});
