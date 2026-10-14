import { crearBaseDeDatosDePrueba } from '../../database/test-utils/postgres-de-prueba';
import { ContextoPersonalAdapter } from './contexto-personal.adapter';
import { DrizzleManicuristaRepository } from '../sucursales-y-personal/infrastructure/persistence/drizzle-manicurista.repository';
import { DrizzleSucursalRepository } from '../sucursales-y-personal/infrastructure/persistence/drizzle-sucursal.repository';
import { DrizzleExcepcionPersonalRepository } from '../sucursales-y-personal/infrastructure/persistence/drizzle-excepcion-personal.repository';
import { Manicurista } from '../sucursales-y-personal/domain/entities/manicurista.entity';
import { Sucursal } from '../sucursales-y-personal/domain/entities/sucursal.entity';
import { ExcepcionPersonal } from '../sucursales-y-personal/domain/entities/excepcion-personal.entity';
import { horarioRealDeBlanc } from '../agenda/test-utils/contexto-personal-falso';

const local = (iso: string) => new Date(`${iso}-06:00`);
const LUNES_10_11 = { inicio: local('2027-03-08T10:00:00'), fin: local('2027-03-08T11:00:00') };
const LUNES_COMPLETO = { inicio: local('2027-03-08T00:00:00'), fin: local('2027-03-09T00:00:00') };
const MARTES_10_11 = { inicio: local('2027-03-09T10:00:00'), fin: local('2027-03-09T11:00:00') };

async function preparar() {
  const db = await crearBaseDeDatosDePrueba();
  const manicuristaRepo = new DrizzleManicuristaRepository(db);
  const sucursalRepo = new DrizzleSucursalRepository(db);
  const excepcionRepo = new DrizzleExcepcionPersonalRepository(db);

  const zibata = Sucursal.crear({ nombre: 'Blanc Zibatá', horarioSemanal: horarioRealDeBlanc() });
  const lomas = Sucursal.crear({ nombre: 'Blanc Lomas', horarioSemanal: horarioRealDeBlanc() });
  await sucursalRepo.guardar(zibata);
  await sucursalRepo.guardar(lomas);

  const ana = Manicurista.crear({ nombre: 'Ana' });
  const bea = Manicurista.crear({ nombre: 'Bea' });
  for (const m of [ana, bea]) await manicuristaRepo.guardar(m);
  await manicuristaRepo.asignarASucursal(ana.id, zibata.id);
  await manicuristaRepo.asignarASucursal(bea.id, zibata.id);

  return {
    adaptador: new ContextoPersonalAdapter(manicuristaRepo, sucursalRepo, excepcionRepo),
    excepcionRepo,
    manicuristaRepo,
    zibata,
    lomas,
    ana,
    bea,
  };
}

describe('ContextoPersonalAdapter — aritmética de DEC-036', () => {
  it('sin excepciones, cuenta a las asignadas de base', async () => {
    const { adaptador, zibata, ana, bea } = await preparar();

    const operativas = await adaptador.manicuristasOperativasEn(zibata.id, LUNES_10_11);
    expect(operativas.sort()).toEqual([ana.id, bea.id].sort());
  });

  it('devuelve el horario configurado de la sucursal', async () => {
    const { adaptador, zibata } = await preparar();

    const horario = await adaptador.horarioSemanalDe(zibata.id);
    expect(horario?.domingo).toEqual([]);
    expect(horario?.lunes).toHaveLength(2);
  });

  it('una sucursal inexistente devuelve null, no un horario vacío que parezca cerrado', async () => {
    const { adaptador } = await preparar();
    expect(await adaptador.horarioSemanalDe('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  describe('ausencias', () => {
    it('una manicurista ausente NO cuenta', async () => {
      const { adaptador, excepcionRepo, zibata, ana, bea } = await preparar();
      await excepcionRepo.guardar(ExcepcionPersonal.ausencia({ manicuristaId: ana.id, rango: LUNES_COMPLETO, motivo: 'enferma' }));

      expect(await adaptador.manicuristasOperativasEn(zibata.id, LUNES_10_11)).toEqual([bea.id]);
    });

    it('la ausencia solo aplica a SU rango: el martes vuelve a contar', async () => {
      const { adaptador, excepcionRepo, zibata, ana, bea } = await preparar();
      await excepcionRepo.guardar(ExcepcionPersonal.ausencia({ manicuristaId: ana.id, rango: LUNES_COMPLETO }));

      expect((await adaptador.manicuristasOperativasEn(zibata.id, MARTES_10_11)).sort()).toEqual([ana.id, bea.id].sort());
    });

    it('una salida anticipada es una ausencia parcial: cuenta por la mañana, no por la tarde', async () => {
      const { adaptador, excepcionRepo, zibata, ana, bea } = await preparar();
      const tarde = { inicio: local('2027-03-08T15:00:00'), fin: local('2027-03-09T00:00:00') };
      await excepcionRepo.guardar(ExcepcionPersonal.ausencia({ manicuristaId: ana.id, rango: tarde, motivo: 'salió temprano' }));

      expect((await adaptador.manicuristasOperativasEn(zibata.id, LUNES_10_11)).sort()).toEqual([ana.id, bea.id].sort());
      const porLaTarde = { inicio: local('2027-03-08T16:00:00'), fin: local('2027-03-08T17:00:00') };
      expect(await adaptador.manicuristasOperativasEn(zibata.id, porLaTarde)).toEqual([bea.id]);
    });
  });

  describe('coberturas — un registro cambia la capacidad de DOS sucursales', () => {
    it('RESTA en la sucursal base', async () => {
      const { adaptador, excepcionRepo, zibata, lomas, ana, bea } = await preparar();
      await excepcionRepo.guardar(ExcepcionPersonal.cobertura({ manicuristaId: ana.id, sucursalId: lomas.id, rango: LUNES_COMPLETO }));

      expect(await adaptador.manicuristasOperativasEn(zibata.id, LUNES_10_11)).toEqual([bea.id]);
    });

    it('SUMA en la sucursal de destino, aunque no esté asignada de base ahí', async () => {
      const { adaptador, excepcionRepo, lomas, ana } = await preparar();
      // Lomas no tiene manicuristas asignadas de base en este escenario.
      expect(await adaptador.manicuristasOperativasEn(lomas.id, LUNES_10_11)).toEqual([]);

      await excepcionRepo.guardar(ExcepcionPersonal.cobertura({ manicuristaId: ana.id, sucursalId: lomas.id, rango: LUNES_COMPLETO }));
      expect(await adaptador.manicuristasOperativasEn(lomas.id, LUNES_10_11)).toEqual([ana.id]);
    });

    it('una ausencia gana sobre una cobertura: si faltó, no cubre en ningún sitio', async () => {
      const { adaptador, excepcionRepo, lomas, ana } = await preparar();
      await excepcionRepo.guardar(ExcepcionPersonal.cobertura({ manicuristaId: ana.id, sucursalId: lomas.id, rango: LUNES_COMPLETO }));
      await excepcionRepo.guardar(ExcepcionPersonal.ausencia({ manicuristaId: ana.id, rango: LUNES_COMPLETO }));

      expect(await adaptador.manicuristasOperativasEn(lomas.id, LUNES_10_11)).toEqual([]);
    });
  });

  it('una manicurista dada de baja no cuenta aunque esté asignada', async () => {
    const { adaptador, manicuristaRepo, zibata, ana, bea } = await preparar();
    ana.desactivar();
    await manicuristaRepo.guardar(ana);

    expect(await adaptador.manicuristasOperativasEn(zibata.id, LUNES_10_11)).toEqual([bea.id]);
  });

  describe('invariantes del esquema (CHECK de la migración 0008)', () => {
    it('la base rechaza una cobertura sin sucursal de destino', async () => {
      const { excepcionRepo, ana } = await preparar();
      const invalida = ExcepcionPersonal.reconstruir({
        id: '99999999-9999-9999-9999-999999999999',
        manicuristaId: ana.id,
        tipo: 'cobertura',
        sucursalId: null, // capacidad que se evaporaría: resta en la base y no suma en ningún lado
        rango: LUNES_10_11,
        motivo: null,
      });

      await expect(excepcionRepo.guardar(invalida)).rejects.toThrow(/excepciones_personal_tipo_valido|check constraint/i);
    });

    it('la base rechaza una ausencia CON sucursal: no se ausenta uno "de una sucursal"', async () => {
      const { excepcionRepo, ana, zibata } = await preparar();
      const invalida = ExcepcionPersonal.reconstruir({
        id: '88888888-8888-8888-8888-888888888888',
        manicuristaId: ana.id,
        tipo: 'ausencia',
        sucursalId: zibata.id,
        rango: LUNES_10_11,
        motivo: null,
      });

      await expect(excepcionRepo.guardar(invalida)).rejects.toThrow(/excepciones_personal_tipo_valido|check constraint/i);
    });
  });
});
