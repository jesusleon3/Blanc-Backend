import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';
import { AgendaVerificarCitasFuturasAdapter } from './agenda-verificar-citas-futuras.adapter';
import { DrizzleCitaRepository } from '../../../agenda/infrastructure/persistence/drizzle-cita.repository';
import { DrizzleSillaRepository } from '../../../agenda/infrastructure/persistence/drizzle-silla.repository';
import { DrizzleManicuristaRepository } from '../persistence/drizzle-manicurista.repository';
import { Cita } from '../../../agenda/domain/entities/cita.entity';
import { Silla } from '../../../agenda/domain/entities/silla.entity';
import { Manicurista } from '../../domain/entities/manicurista.entity';
import { DesactivarManicuristaUseCase } from '../../application/use-cases/desactivar-manicurista.use-case';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';
import { EstadoCita } from '../../../../database/schema';

const ACTOR: ClaimsUsuario = { sub: 'duena-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };
const SUCURSAL = '11111111-1111-1111-1111-111111111111';
const CLIENTA = '22222222-2222-2222-2222-222222222222';
const SERVICIO = '33333333-3333-3333-3333-333333333333';

const EN_UNA_SEMANA = { inicio: new Date(Date.now() + 7 * 86400000), fin: new Date(Date.now() + 7 * 86400000 + 3600000) };
const HACE_UNA_SEMANA = { inicio: new Date(Date.now() - 7 * 86400000), fin: new Date(Date.now() - 7 * 86400000 + 3600000) };

async function preparar() {
  const db = await crearBaseDeDatosDePrueba();
  const citaRepo = new DrizzleCitaRepository(db);
  const sillaRepo = new DrizzleSillaRepository(db);
  const manicuristaRepo = new DrizzleManicuristaRepository(db);

  const silla = Silla.crear({ sucursalId: SUCURSAL, nombre: 'Lomas 1' });
  await sillaRepo.guardar(silla);

  const karla = Manicurista.crear({ nombre: 'Karla Espinoza' });
  await manicuristaRepo.guardar(karla);

  const adaptador = new AgendaVerificarCitasFuturasAdapter(citaRepo);
  const useCase = new DesactivarManicuristaUseCase(manicuristaRepo, adaptador, { registrar: jest.fn() }, crearUnitOfWorkFalso());

  // Se usa `reconstruir` y no `cambiarEstado` porque estas pruebas necesitan una cita YA en un
  // estado concreto, no recorrer el camino legal hasta él. `reconstruir` es la puerta de la
  // persistencia y, por diseño, no valida transiciones: es exactamente lo que hace falta aquí.
  const agendarPara = async (rango: typeof EN_UNA_SEMANA, estado: EstadoCita = 'agendada') => {
    const base = Cita.crear({
      sucursalId: SUCURSAL,
      sillaId: silla.id,
      clientaId: CLIENTA,
      servicioId: SERVICIO,
      rangoHorario: rango,
      manicuristaId: karla.id,
    });
    const cita = Cita.reconstruir({
      id: base.id,
      sucursalId: base.sucursalId,
      sillaId: base.sillaId,
      manicuristaId: base.manicuristaId,
      clientaId: base.clientaId,
      servicioId: base.servicioId,
      rangoHorario: base.rangoHorario,
      estado,
      citaOrigenId: null,
      numeroDeReprogramaciones: 0,
    });
    await citaRepo.guardar(cita);
    return cita;
  };

  return { adaptador, useCase, karla, manicuristaRepo, agendarPara };
}

/**
 * Cierra la deuda de Fase 1.5: hasta hoy el puerto lo satisfacía un sustituto que respondía
 * siempre `false`, de modo que el bloqueo duro de `DEC-032` **no protegía nada**. Estas pruebas
 * recorren el camino completo y real — caso de uso → puerto → repositorio de Agenda → PostgreSQL.
 */
describe('Bloqueo de baja de manicurista con citas futuras reales (DEC-032, cierre de deuda)', () => {
  it('RECHAZA la baja si la manicurista tiene una cita futura que ocupa horario', async () => {
    const { useCase, karla, manicuristaRepo, agendarPara } = await preparar();
    await agendarPara(EN_UNA_SEMANA);

    const intento = useCase.ejecutar({ id: karla.id }, ACTOR);

    await expect(intento).rejects.toThrow(ConflictoDeNegocioError);
    await expect(intento).rejects.toMatchObject({ code: 'MANICURISTA_CON_CITAS_ACTIVAS', httpStatus: 409 });

    // Y no la desactivó a medias.
    expect((await manicuristaRepo.buscarPorId(karla.id))?.activa).toBe(true);
  });

  it('PERMITE la baja cuando no tiene ninguna cita', async () => {
    const { useCase, karla, manicuristaRepo } = await preparar();

    await expect(useCase.ejecutar({ id: karla.id }, ACTOR)).resolves.toBeUndefined();
    expect((await manicuristaRepo.buscarPorId(karla.id))?.activa).toBe(false);
  });

  it('PERMITE la baja si su única cita futura está cancelada — no hay nada que reasignar', async () => {
    const { useCase, karla, manicuristaRepo, agendarPara } = await preparar();
    await agendarPara(EN_UNA_SEMANA, 'cancelada');

    await expect(useCase.ejecutar({ id: karla.id }, ACTOR)).resolves.toBeUndefined();
    expect((await manicuristaRepo.buscarPorId(karla.id))?.activa).toBe(false);
  });

  it('PERMITE la baja si sus citas ya pasaron', async () => {
    const { useCase, karla, agendarPara } = await preparar();
    await agendarPara(HACE_UNA_SEMANA);

    await expect(useCase.ejecutar({ id: karla.id }, ACTOR)).resolves.toBeUndefined();
  });

  describe('N-04 resuelto: "cita futura" reutiliza la lista de estados que OCUPAN horario', () => {
    it.each(['agendada', 'pendiente_confirmacion', 'confirmada', 'no_show'] as const)(
      'una cita futura en estado `%s` BLOQUEA la baja',
      async (estado) => {
        const { useCase, karla, agendarPara } = await preparar();
        await agendarPara(EN_UNA_SEMANA, estado);

        await expect(useCase.ejecutar({ id: karla.id }, ACTOR)).rejects.toMatchObject({ code: 'MANICURISTA_CON_CITAS_ACTIVAS' });
      },
    );

    it.each(['cancelada', 'expirada', 'reprogramada', 'en_espera_pago'] as const)(
      'una cita futura en estado `%s` NO bloquea la baja',
      async (estado) => {
        const { useCase, karla, agendarPara } = await preparar();
        await agendarPara(EN_UNA_SEMANA, estado);

        await expect(useCase.ejecutar({ id: karla.id }, ACTOR)).resolves.toBeUndefined();
      },
    );

    it('`en_espera_pago` NO bloquea porque NO ocupa el horario (RN-ANT-03): no hay nada que reasignar', async () => {
      const { useCase, karla, agendarPara } = await preparar();
      await agendarPara(EN_UNA_SEMANA, 'en_espera_pago');

      // El hueco nunca fue suyo mientras el anticipo estuviera pendiente.
      await expect(useCase.ejecutar({ id: karla.id }, ACTOR)).resolves.toBeUndefined();
    });
  });

  it('el adaptador distingue entre manicuristas: la cita de una no bloquea a otra', async () => {
    const { adaptador, karla, agendarPara } = await preparar();
    await agendarPara(EN_UNA_SEMANA);

    expect(await adaptador.tieneCitasFuturas(karla.id)).toBe(true);
    expect(await adaptador.tieneCitasFuturas('99999999-9999-9999-9999-999999999999')).toBe(false);
  });
});
