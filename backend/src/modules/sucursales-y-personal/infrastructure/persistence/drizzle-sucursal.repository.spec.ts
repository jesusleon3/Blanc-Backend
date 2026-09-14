import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/pg-mem-database';
import { DrizzleSucursalRepository } from './drizzle-sucursal.repository';
import { Sucursal } from '../../domain/entities/sucursal.entity';
import { DiaFestivo } from '../../domain/entities/dia-festivo.entity';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';

const HORARIO = {
  lunes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  martes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  miercoles: [{ horaInicio: '09:00', horaFin: '18:00' }],
  jueves: [{ horaInicio: '09:00', horaFin: '18:00' }],
  viernes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  sabado: [{ horaInicio: '09:00', horaFin: '15:00' }],
  domingo: [],
};

/** Integración real contra Postgres (pg-mem) — no un mock del repositorio. */
describe('DrizzleSucursalRepository (integración)', () => {
  it('buscarPorId devuelve null si no existe', async () => {
    const repo = new DrizzleSucursalRepository(crearBaseDeDatosDePrueba());
    expect(await repo.buscarPorId('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('buscarPorNombre encuentra una sucursal ya guardada', async () => {
    const repo = new DrizzleSucursalRepository(crearBaseDeDatosDePrueba());
    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    await repo.guardar(sucursal);

    const encontrada = await repo.buscarPorNombre('Blanc Polanco');
    expect(encontrada?.id).toBe(sucursal.id);
  });

  it('la restricción UNIQUE de nombre se traduce a ConflictoDeNegocioError (409), no un error crudo de Postgres (Tarea 5, hardening)', async () => {
    const db = crearBaseDeDatosDePrueba();
    const repo = new DrizzleSucursalRepository(db);
    await repo.guardar(Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO }));

    // Dos entidades de dominio distintas (IDs distintos) con el mismo nombre — el
    // caso de uso ya lo evita en la capa de aplicación (ver crear-sucursal.use-case.spec.ts);
    // esta prueba confirma que la base de datos también lo protege como backstop (ADR-021),
    // y que el 23505 crudo del driver nunca llega a Application/HTTP como error inesperado.
    const intento = repo.guardar(Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO }));
    await expect(intento).rejects.toThrow(ConflictoDeNegocioError);
    await expect(intento).rejects.toMatchObject({ code: 'SUCURSAL_NOMBRE_DUPLICADO', httpStatus: 409 });
  });

  it('agrega y lista días festivos de una sucursal', async () => {
    const repo = new DrizzleSucursalRepository(crearBaseDeDatosDePrueba());
    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    await repo.guardar(sucursal);

    await repo.agregarDiaFestivo(DiaFestivo.crear({ sucursalId: sucursal.id, fecha: '2026-12-25', descripcion: 'Navidad' }));
    await repo.agregarDiaFestivo(DiaFestivo.crear({ sucursalId: sucursal.id, fecha: '2027-01-01', descripcion: 'Año Nuevo' }));

    const festivos = await repo.listarDiasFestivos(sucursal.id);
    expect(festivos).toHaveLength(2);
  });

  it('elimina un día festivo por id (cascada al eliminar la sucursal, ADR-005 mismo esquema)', async () => {
    const repo = new DrizzleSucursalRepository(crearBaseDeDatosDePrueba());
    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    await repo.guardar(sucursal);
    const diaFestivo = DiaFestivo.crear({ sucursalId: sucursal.id, fecha: '2026-12-25' });
    await repo.agregarDiaFestivo(diaFestivo);

    await repo.eliminarDiaFestivo(diaFestivo.id);

    expect(await repo.buscarDiaFestivoPorId(diaFestivo.id)).toBeNull();
  });

  it('listar devuelve todas las sucursales guardadas', async () => {
    const repo = new DrizzleSucursalRepository(crearBaseDeDatosDePrueba());
    await repo.guardar(Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO }));
    await repo.guardar(Sucursal.crear({ nombre: 'Blanc Condesa', horarioSemanal: HORARIO }));

    const todas = await repo.listar();
    expect(todas.map((s) => s.nombre).sort()).toEqual(['Blanc Condesa', 'Blanc Polanco']);
  });
});
