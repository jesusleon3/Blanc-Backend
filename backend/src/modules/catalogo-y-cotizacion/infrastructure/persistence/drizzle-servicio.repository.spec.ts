import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';
import { DrizzleServicioRepository } from './drizzle-servicio.repository';
import { DrizzleModificadorDisenoRepository } from './drizzle-modificador-diseno.repository';
import { Servicio } from '../../domain/entities/servicio.entity';
import { ModificadorDiseno } from '../../domain/entities/modificador-diseno.entity';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';

const SERVICIO_VALIDO = { nombre: 'Gelish', categoria: 'aplicacion', duracionBaseMinutos: 60, precioBaseCentavos: 45000 };

describe('DrizzleServicioRepository (integración) — FL-COT-01', () => {
  it('guarda y recupera un servicio con todos sus campos intactos', async () => {
    const repo = new DrizzleServicioRepository(await crearBaseDeDatosDePrueba());
    const servicio = Servicio.crear(SERVICIO_VALIDO);

    await repo.guardar(servicio);
    const recuperado = await repo.buscarPorId(servicio.id);

    expect(recuperado).not.toBeNull();
    expect(recuperado?.id).toBe(servicio.id);
    expect(recuperado?.nombre).toBe('Gelish');
    expect(recuperado?.categoria).toBe('aplicacion');
    expect(recuperado?.duracionBaseMinutos).toBe(60);
    expect(recuperado?.activo).toBe(true);
  });

  it('devuelve null cuando el id no existe', async () => {
    const repo = new DrizzleServicioRepository(await crearBaseDeDatosDePrueba());
    await expect(repo.buscarPorId('00000000-0000-0000-0000-000000000000')).resolves.toBeNull();
  });

  describe('RN-COT-07 — el dinero sobrevive el viaje de ida y vuelta como entero', () => {
    it.each([
      ['un precio corriente', 45000],
      ['cero (servicio gratuito)', 0],
      ['un precio que en pesos tendría decimales: $450.75', 45075],
      ['un importe grande, más allá del rango de un smallint', 250000],
    ])('%s se persiste y se lee como el MISMO entero', async (_caso, precioBaseCentavos) => {
      const repo = new DrizzleServicioRepository(await crearBaseDeDatosDePrueba());
      const servicio = Servicio.crear({ ...SERVICIO_VALIDO, precioBaseCentavos });

      await repo.guardar(servicio);
      const recuperado = await repo.buscarPorId(servicio.id);

      expect(recuperado?.precioBaseCentavos).toBe(precioBaseCentavos);
      // El tipo importa tanto como el valor: un `numeric` devolvería la cadena '45000'.
      expect(typeof recuperado?.precioBaseCentavos).toBe('number');
      expect(Number.isInteger(recuperado?.precioBaseCentavos)).toBe(true);
    });

    it('la columna no introduce error de punto flotante en una suma de importes leídos', async () => {
      const repo = new DrizzleServicioRepository(await crearBaseDeDatosDePrueba());
      // 0.1 + 0.2 !== 0.3 en float; en centavos enteros, 10 + 20 === 30 siempre.
      await repo.guardar(Servicio.crear({ ...SERVICIO_VALIDO, nombre: 'A', precioBaseCentavos: 10 }));
      await repo.guardar(Servicio.crear({ ...SERVICIO_VALIDO, nombre: 'B', precioBaseCentavos: 20 }));

      const total = (await repo.listar()).reduce((suma, servicio) => suma + servicio.precioBaseCentavos, 0);

      expect(total).toBe(30);
    });
  });

  it('guardar es un upsert: actualizar un servicio existente no duplica la fila', async () => {
    const repo = new DrizzleServicioRepository(await crearBaseDeDatosDePrueba());
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    await repo.guardar(servicio);

    servicio.actualizarDatos({ precioBaseCentavos: 52000, nombre: 'Gelish premium' });
    servicio.desactivar();
    await repo.guardar(servicio);

    const todos = await repo.listar();
    expect(todos).toHaveLength(1);
    expect(todos[0].precioBaseCentavos).toBe(52000);
    expect(todos[0].nombre).toBe('Gelish premium');
    expect(todos[0].activo).toBe(false);
  });

  it('listar devuelve activos e inactivos por igual', async () => {
    const repo = new DrizzleServicioRepository(await crearBaseDeDatosDePrueba());
    const activo = Servicio.crear({ ...SERVICIO_VALIDO, nombre: 'Vigente' });
    const inactivo = Servicio.crear({ ...SERVICIO_VALIDO, nombre: 'Descontinuado' });
    inactivo.desactivar();
    await repo.guardar(activo);
    await repo.guardar(inactivo);

    const nombres = (await repo.listar()).map((servicio) => servicio.nombre).sort();
    expect(nombres).toEqual(['Descontinuado', 'Vigente']);
  });

  it('listar sobre un catálogo vacío devuelve un arreglo vacío, no null', async () => {
    const repo = new DrizzleServicioRepository(await crearBaseDeDatosDePrueba());
    await expect(repo.listar()).resolves.toEqual([]);
  });

  it('`requiereCotizacionManual` sobrevive el viaje de ida y vuelta (columna de la migración 0004)', async () => {
    const repo = new DrizzleServicioRepository(await crearBaseDeDatosDePrueba());
    const normal = Servicio.crear({ ...SERVICIO_VALIDO, nombre: 'Cotizable' });
    const especial = Servicio.crear({ ...SERVICIO_VALIDO, nombre: 'Diseño Especial', requiereCotizacionManual: true });

    await repo.guardar(normal);
    await repo.guardar(especial);

    expect((await repo.buscarPorId(normal.id))?.requiereCotizacionManual).toBe(false);
    expect((await repo.buscarPorId(especial.id))?.requiereCotizacionManual).toBe(true);
  });

  describe('vínculo N:M con modificadores (servicio_modificadores_aplicables)', () => {
    async function prepararEscenario() {
      const db = await crearBaseDeDatosDePrueba();
      const servicioRepo = new DrizzleServicioRepository(db);
      const modificadorRepo = new DrizzleModificadorDisenoRepository(db);

      const gelish = Servicio.crear(SERVICIO_VALIDO);
      const acrilico = Servicio.crear({ ...SERVICIO_VALIDO, nombre: 'Acrílico' });
      await servicioRepo.guardar(gelish);
      await servicioRepo.guardar(acrilico);

      const frances = ModificadorDiseno.crear({ nombre: 'Diseño francés', minutosAdicionales: 15, precioAdicionalCentavos: 8000 });
      const pedreria = ModificadorDiseno.crear({ nombre: 'Pedrería', minutosAdicionales: 20, precioAdicionalCentavos: 12000 });
      await modificadorRepo.guardar(frances);
      await modificadorRepo.guardar(pedreria);

      return { servicioRepo, modificadorRepo, gelish, acrilico, frances, pedreria };
    }

    it('un modificador se reutiliza entre servicios distintos (es la razón de ser de la tabla)', async () => {
      const { servicioRepo, gelish, acrilico, frances } = await prepararEscenario();

      await servicioRepo.vincularModificador(gelish.id, frances.id);
      await servicioRepo.vincularModificador(acrilico.id, frances.id);

      expect(await servicioRepo.listarModificadoresDeServicio(gelish.id)).toEqual([frances.id]);
      expect(await servicioRepo.listarModificadoresDeServicio(acrilico.id)).toEqual([frances.id]);
    });

    it('estaModificadorVinculado refleja el estado del par', async () => {
      const { servicioRepo, gelish, frances } = await prepararEscenario();

      expect(await servicioRepo.estaModificadorVinculado(gelish.id, frances.id)).toBe(false);
      await servicioRepo.vincularModificador(gelish.id, frances.id);
      expect(await servicioRepo.estaModificadorVinculado(gelish.id, frances.id)).toBe(true);
    });

    it('desvincular elimina únicamente el par indicado', async () => {
      const { servicioRepo, gelish, frances, pedreria } = await prepararEscenario();
      await servicioRepo.vincularModificador(gelish.id, frances.id);
      await servicioRepo.vincularModificador(gelish.id, pedreria.id);

      await servicioRepo.desvincularModificador(gelish.id, frances.id);

      expect(await servicioRepo.listarModificadoresDeServicio(gelish.id)).toEqual([pedreria.id]);
    });

    it('desvincular un par inexistente no falla (no-op)', async () => {
      const { servicioRepo, gelish, frances } = await prepararEscenario();
      await expect(servicioRepo.desvincularModificador(gelish.id, frances.id)).resolves.toBeUndefined();
    });

    it('la restricción UNIQUE(servicio_id, modificador_id) sale como ConflictoDeNegocioError (409), nunca como 23505 crudo', async () => {
      const { servicioRepo, gelish, frances } = await prepararEscenario();
      await servicioRepo.vincularModificador(gelish.id, frances.id);

      // El caso de uso ya lo evita con `estaModificadorVinculado`; esta prueba confirma el
      // backstop de base de datos ante la condición de carrera (TOCTOU) entre chequeo e INSERT.
      const intento = servicioRepo.vincularModificador(gelish.id, frances.id);
      await expect(intento).rejects.toThrow(ConflictoDeNegocioError);
      await expect(intento).rejects.toMatchObject({ code: 'MODIFICADOR_YA_VINCULADO', httpStatus: 409 });
    });

    it('listarPorIds hidrata el conjunto vinculado en una sola consulta', async () => {
      const { servicioRepo, modificadorRepo, gelish, frances, pedreria } = await prepararEscenario();
      await servicioRepo.vincularModificador(gelish.id, frances.id);
      await servicioRepo.vincularModificador(gelish.id, pedreria.id);

      const ids = await servicioRepo.listarModificadoresDeServicio(gelish.id);
      const hidratados = await modificadorRepo.listarPorIds(ids);

      expect(hidratados.map((modificador) => modificador.nombre).sort()).toEqual(['Diseño francés', 'Pedrería']);
    });

    it('listarPorIds con lista vacía devuelve [] sin tocar la base', async () => {
      const { modificadorRepo } = await prepararEscenario();
      await expect(modificadorRepo.listarPorIds([])).resolves.toEqual([]);
    });
  });
});
