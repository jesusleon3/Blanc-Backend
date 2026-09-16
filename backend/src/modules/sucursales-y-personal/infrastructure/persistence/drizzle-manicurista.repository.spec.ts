import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';
import { DrizzleSucursalRepository } from './drizzle-sucursal.repository';
import { DrizzleManicuristaRepository } from './drizzle-manicurista.repository';
import { Sucursal } from '../../domain/entities/sucursal.entity';
import { Manicurista } from '../../domain/entities/manicurista.entity';
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

describe('DrizzleManicuristaRepository (integración) — 01-domain-discovery.md §5.7', () => {
  it('asigna una manicurista a varias sucursales (relación muchos-a-muchos)', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const sucursalRepo = new DrizzleSucursalRepository(db);
    const manicuristaRepo = new DrizzleManicuristaRepository(db);

    const polanco = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    const condesa = Sucursal.crear({ nombre: 'Blanc Condesa', horarioSemanal: HORARIO });
    await sucursalRepo.guardar(polanco);
    await sucursalRepo.guardar(condesa);

    const manicurista = Manicurista.crear({ nombre: 'Karla Espinoza' });
    await manicuristaRepo.guardar(manicurista);

    await manicuristaRepo.asignarASucursal(manicurista.id, polanco.id);
    await manicuristaRepo.asignarASucursal(manicurista.id, condesa.id);

    const sucursalesAsignadas = await manicuristaRepo.listarSucursalesDeManicurista(manicurista.id);
    expect(sucursalesAsignadas.sort()).toEqual([polanco.id, condesa.id].sort());
  });

  it('estaAsignadaASucursal refleja correctamente el estado del par', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const sucursalRepo = new DrizzleSucursalRepository(db);
    const manicuristaRepo = new DrizzleManicuristaRepository(db);

    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    await sucursalRepo.guardar(sucursal);
    const manicurista = Manicurista.crear({ nombre: 'Karla Espinoza' });
    await manicuristaRepo.guardar(manicurista);

    expect(await manicuristaRepo.estaAsignadaASucursal(manicurista.id, sucursal.id)).toBe(false);
    await manicuristaRepo.asignarASucursal(manicurista.id, sucursal.id);
    expect(await manicuristaRepo.estaAsignadaASucursal(manicurista.id, sucursal.id)).toBe(true);
  });

  it('removerDeSucursal elimina únicamente el par indicado', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const sucursalRepo = new DrizzleSucursalRepository(db);
    const manicuristaRepo = new DrizzleManicuristaRepository(db);

    const polanco = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    const condesa = Sucursal.crear({ nombre: 'Blanc Condesa', horarioSemanal: HORARIO });
    await sucursalRepo.guardar(polanco);
    await sucursalRepo.guardar(condesa);
    const manicurista = Manicurista.crear({ nombre: 'Karla Espinoza' });
    await manicuristaRepo.guardar(manicurista);
    await manicuristaRepo.asignarASucursal(manicurista.id, polanco.id);
    await manicuristaRepo.asignarASucursal(manicurista.id, condesa.id);

    await manicuristaRepo.removerDeSucursal(manicurista.id, polanco.id);

    const restantes = await manicuristaRepo.listarSucursalesDeManicurista(manicurista.id);
    expect(restantes).toEqual([condesa.id]);
  });

  it('actualiza el estado activa/inactiva vía guardar (upsert)', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const manicuristaRepo = new DrizzleManicuristaRepository(db);
    const manicurista = Manicurista.crear({ nombre: 'Karla Espinoza' });
    await manicuristaRepo.guardar(manicurista);

    manicurista.desactivar();
    await manicuristaRepo.guardar(manicurista);

    const recargada = await manicuristaRepo.buscarPorId(manicurista.id);
    expect(recargada?.activa).toBe(false);
  });

  it('la restricción UNIQUE(manicurista_id, sucursal_id) se traduce a ConflictoDeNegocioError (409), no un error crudo (Tarea 5, hardening)', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const sucursalRepo = new DrizzleSucursalRepository(db);
    const manicuristaRepo = new DrizzleManicuristaRepository(db);

    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    await sucursalRepo.guardar(sucursal);
    const manicurista = Manicurista.crear({ nombre: 'Karla Espinoza' });
    await manicuristaRepo.guardar(manicurista);
    await manicuristaRepo.asignarASucursal(manicurista.id, sucursal.id);

    // El caso de uso ya evita esto con `estaAsignadaASucursal` (ver
    // asignar-manicurista-a-sucursal.use-case.spec.ts); esta prueba confirma el backstop de base
    // de datos ante la misma condición de carrera (TOCTOU), sin exponer el 23505 crudo.
    const intento = manicuristaRepo.asignarASucursal(manicurista.id, sucursal.id);
    await expect(intento).rejects.toThrow(ConflictoDeNegocioError);
    await expect(intento).rejects.toMatchObject({ code: 'MANICURISTA_YA_ASIGNADA', httpStatus: 409 });
  });
});
