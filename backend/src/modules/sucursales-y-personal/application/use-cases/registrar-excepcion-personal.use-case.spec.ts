import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';
import { RegistrarExcepcionPersonalUseCase } from './registrar-excepcion-personal.use-case';
import { DrizzleExcepcionPersonalRepository } from '../../infrastructure/persistence/drizzle-excepcion-personal.repository';
import { DrizzleManicuristaRepository } from '../../infrastructure/persistence/drizzle-manicurista.repository';
import { DrizzleSucursalRepository } from '../../infrastructure/persistence/drizzle-sucursal.repository';
import { Manicurista } from '../../domain/entities/manicurista.entity';
import { Sucursal } from '../../domain/entities/sucursal.entity';
import { ConsultaAgendaAdapter } from '../../../integracion/consulta-agenda.adapter';
import { ContextoPersonalAdapter } from '../../../integracion/contexto-personal.adapter';
import { DrizzleCitaRepository } from '../../../agenda/infrastructure/persistence/drizzle-cita.repository';
import { DrizzleSillaRepository } from '../../../agenda/infrastructure/persistence/drizzle-silla.repository';
import { MotorDisponibilidad } from '../../../agenda/domain/services/motor-disponibilidad';
import { horarioAbiertoSiempre, horarioRealDeBlanc } from '../../../agenda/test-utils/contexto-personal-falso';
import { Silla } from '../../../agenda/domain/entities/silla.entity';
import { Cita } from '../../../agenda/domain/entities/cita.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

const ACTOR: ClaimsUsuario = { sub: 'encargada-1', rol: Rol.GERENTE, sucursales: 'GLOBAL', manicuristaId: null };
const CLIENTA = '22222222-2222-2222-2222-222222222222';
const SERVICIO = '33333333-3333-3333-3333-333333333333';

const rango = (i: string, f: string) => ({ inicio: new Date(i), fin: new Date(f) });
const DIEZ_A_ONCE = rango('2026-12-07T10:00:00Z', '2026-12-07T11:00:00Z');
const TODO_EL_DIA = rango('2026-12-07T00:00:00Z', '2026-12-08T00:00:00Z');

/**
 * Monta el ciclo completo de `DEC-036` contra PostgreSQL real **con los adaptadores de verdad**.
 *
 * Deliberadamente no se dobla `ConsultaAgendaPort`: lo que se está probando es precisamente que
 * registrar una ausencia en *Personal* se traduzca en daño observable en *Agenda*. Con un doble,
 * la prueba pasaría aunque el cálculo de sobrecupo estuviera roto — y lo estuvo.
 */
async function preparar(opciones: { manicuristas?: number; sillas?: number } = {}) {
  const db = await crearBaseDeDatosDePrueba();
  const excepcionRepo = new DrizzleExcepcionPersonalRepository(db);
  const manicuristaRepo = new DrizzleManicuristaRepository(db);
  const sucursalRepo = new DrizzleSucursalRepository(db);
  const citaRepo = new DrizzleCitaRepository(db);
  const sillaRepo = new DrizzleSillaRepository(db);
  const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };

  const sucursal = Sucursal.crear({ nombre: 'Lomas', horarioSemanal: horarioAbiertoSiempre() });
  await sucursalRepo.guardar(sucursal);

  const manicuristas: Manicurista[] = [];
  for (let i = 0; i < (opciones.manicuristas ?? 2); i += 1) {
    const manicurista = Manicurista.crear({ nombre: `Manicurista ${i + 1}` });
    await manicuristaRepo.guardar(manicurista);
    await manicuristaRepo.asignarASucursal(manicurista.id, sucursal.id);
    manicuristas.push(manicurista);
  }

  const sillas: Silla[] = [];
  for (let i = 0; i < (opciones.sillas ?? 2); i += 1) {
    const silla = Silla.crear({ sucursalId: sucursal.id, nombre: `Lomas ${i + 1}` });
    await sillaRepo.guardar(silla);
    sillas.push(silla);
  }

  const contextoPersonal = new ContextoPersonalAdapter(manicuristaRepo, sucursalRepo, excepcionRepo);
  const motor = new MotorDisponibilidad(citaRepo, sillaRepo, contextoPersonal);
  const consultaAgenda = new ConsultaAgendaAdapter(citaRepo, manicuristaRepo, motor);

  const agendar = async (sillaIndex: number, manicuristaId: string | null, rangoHorario = DIEZ_A_ONCE) => {
    const cita = Cita.crear({
      sucursalId: sucursal.id,
      sillaId: sillas[sillaIndex].id,
      manicuristaId,
      clientaId: CLIENTA,
      servicioId: SERVICIO,
      rangoHorario,
    });
    await citaRepo.guardar(cita);
    return cita;
  };

  const crearOtraSucursal = async (horarioSemanal = horarioAbiertoSiempre()) => {
    const otra = Sucursal.crear({ nombre: 'Juriquilla', horarioSemanal });
    await sucursalRepo.guardar(otra);
    return otra;
  };

  return {
    sucursal,
    crearOtraSucursal,
    manicuristas,
    sillas,
    excepcionRepo,
    auditoria,
    motor,
    agendar,
    useCase: new RegistrarExcepcionPersonalUseCase(
      excepcionRepo,
      manicuristaRepo,
      sucursalRepo,
      consultaAgenda,
      auditoria,
      crearUnitOfWorkFalso(),
    ),
  };
}

describe('RegistrarExcepcionPersonalUseCase — DEC-036 (integración, PostgreSQL real)', () => {
  it('registra la ausencia y la deja consultable', async () => {
    const { useCase, manicuristas, excepcionRepo } = await preparar();

    const { excepcion } = await useCase.registrarAusencia(
      { manicuristaId: manicuristas[0].id, rango: TODO_EL_DIA, motivo: 'Cita médica' },
      ACTOR,
    );

    expect(excepcion.tipo).toBe('ausencia');
    expect(excepcion.sucursalId).toBeNull();
    await expect(excepcionRepo.buscarPorId(excepcion.id)).resolves.not.toBeNull();
  });

  it('lanza 404 si la manicurista no existe, antes de escribir nada', async () => {
    const { useCase, excepcionRepo } = await preparar();

    await expect(
      useCase.registrarAusencia({ manicuristaId: '99999999-9999-9999-9999-999999999999', rango: TODO_EL_DIA }, ACTOR),
    ).rejects.toThrow(RecursoNoEncontradoError);

    await expect(excepcionRepo.listarQueSolapan(TODO_EL_DIA)).resolves.toHaveLength(0);
  });

  it('una cobertura mueve la capacidad: resta en la base y suma en el destino', async () => {
    const { useCase, manicuristas, sucursal, motor, crearOtraSucursal } = await preparar({ manicuristas: 2, sillas: 2 });
    const otraSucursal = (await crearOtraSucursal()).id;

    const antes = await motor.calcularCapacidad(sucursal.id, DIEZ_A_ONCE);
    expect(antes.manicuristasDisponibles).toBe(2);

    await useCase.registrarCobertura(
      { manicuristaId: manicuristas[0].id, sucursalId: otraSucursal, rango: TODO_EL_DIA },
      ACTOR,
    );

    const despues = await motor.calcularCapacidad(sucursal.id, DIEZ_A_ONCE);
    expect(despues.manicuristasDisponibles).toBe(1);
  });

  it('lanza 404 si la sucursal de destino de una cobertura no existe, no un 500 por clave foránea', async () => {
    const { useCase, manicuristas } = await preparar();

    await expect(
      useCase.registrarCobertura(
        { manicuristaId: manicuristas[0].id, sucursalId: '88888888-8888-8888-8888-888888888888', rango: TODO_EL_DIA },
        ACTOR,
      ),
    ).rejects.toMatchObject({ httpStatus: 404 });
  });

  describe('NUNCA BLOQUEA, pero devuelve el daño', () => {
    it('la ausencia se registra aunque la manicurista tenga citas asignadas, y las reporta', async () => {
      const { useCase, manicuristas, agendar, excepcionRepo } = await preparar();
      const cita = await agendar(0, manicuristas[0].id);

      const { excepcion, citasAfectadas } = await useCase.registrarAusencia(
        { manicuristaId: manicuristas[0].id, rango: TODO_EL_DIA },
        ACTOR,
      );

      // La manicurista no falta porque el sistema se lo permita: se anota igual.
      await expect(excepcionRepo.buscarPorId(excepcion.id)).resolves.not.toBeNull();
      expect(citasAfectadas).toEqual([expect.objectContaining({ id: cita.id, motivo: 'manicurista_ausente' })]);
    });

    it('DETECTA SOBRECUPO: con 2 citas sin asignar y 2 manicuristas, quitar a una compromete la agenda', async () => {
      // Este es el caso que el aviso existe para atrapar: NINGUNA cita lleva el nombre de la
      // manicurista ausente, así que una detección ingenua diría "cero citas afectadas" — y a las
      // 10:00 habría dos clientas y una sola persona para atenderlas.
      const { useCase, manicuristas, agendar } = await preparar({ manicuristas: 2, sillas: 2 });
      const primera = await agendar(0, null);
      const segunda = await agendar(1, null);

      const { citasAfectadas } = await useCase.registrarAusencia(
        { manicuristaId: manicuristas[0].id, rango: TODO_EL_DIA },
        ACTOR,
      );

      expect(citasAfectadas.map((c) => c.id).sort()).toEqual([primera.id, segunda.id].sort());
      expect(citasAfectadas.every((c) => c.motivo === 'sobrecupo_en_sucursal')).toBe(true);
    });

    it('EL DÉFICIT SE MIDE POR FRANJA, no sobre el día entero de la ausencia', async () => {
      // Dos citas sin asignar a las 10:00 (sobrecupo real con una sola manicurista) y una a las
      // 16:00, sola y perfectamente atendible. La ausencia cubre todo el día.
      //
      // Midiendo sobre el rango completo de la excepción, las TRES salían afectadas: se agregaban
      // las citas del día y se comparaban contra el personal del día. La de las 16:00 era ruido
      // puro — nadie se iba a quedar sin atender a esa hora.
      const { useCase, manicuristas, agendar } = await preparar({ manicuristas: 2, sillas: 3 });
      const diez = await agendar(0, null);
      const diezBis = await agendar(1, null);
      const tarde = await agendar(2, null, rango('2026-12-07T16:00:00Z', '2026-12-07T17:00:00Z'));

      const { citasAfectadas } = await useCase.registrarAusencia(
        { manicuristaId: manicuristas[0].id, rango: TODO_EL_DIA },
        ACTOR,
      );

      expect(citasAfectadas.map((c) => c.id).sort()).toEqual([diez.id, diezBis.id].sort());
      expect(citasAfectadas.map((c) => c.id)).not.toContain(tarde.id);
    });

    it('no inventa sobrecupo: con 1 cita y 2 manicuristas, quitar a una no afecta a nadie', async () => {
      const { useCase, manicuristas, agendar } = await preparar({ manicuristas: 2, sillas: 2 });
      await agendar(0, null);

      const { citasAfectadas } = await useCase.registrarAusencia(
        { manicuristaId: manicuristas[0].id, rango: TODO_EL_DIA },
        ACTOR,
      );

      expect(citasAfectadas).toEqual([]);
    });

    it('una cita no se reporta dos veces aunque entre por las dos vías', async () => {
      const { useCase, manicuristas, agendar } = await preparar({ manicuristas: 1, sillas: 2 });
      const cita = await agendar(0, manicuristas[0].id);

      const { citasAfectadas } = await useCase.registrarAusencia(
        { manicuristaId: manicuristas[0].id, rango: TODO_EL_DIA },
        ACTOR,
      );

      expect(citasAfectadas).toHaveLength(1);
      expect(citasAfectadas[0]).toMatchObject({ id: cita.id, motivo: 'manicurista_ausente' });
    });

    it('audita cuántas citas quedaron comprometidas, sin datos de la clienta', async () => {
      const { useCase, manicuristas, agendar, auditoria } = await preparar();
      await agendar(0, manicuristas[0].id);

      await useCase.registrarAusencia({ manicuristaId: manicuristas[0].id, rango: TODO_EL_DIA }, ACTOR);

      const detalle = auditoria.registrar.mock.calls[0][0].detalle as Record<string, unknown>;
      expect(detalle).toMatchObject({ accion: 'registrar_ausencia', citasAfectadas: 1 });
      // `RN-AUD-01`: la auditoría registra el hecho, no el expediente de la clienta.
      expect(JSON.stringify(detalle)).not.toContain(CLIENTA);
    });
  });

  describe('validación del rango (deuda 4 de §16)', () => {
    it('400 EXCEPCION_DEMASIADO_LARGA: un año mal teclado no puede matar la capacidad para siempre', async () => {
      // El fallo real que esto evita: `2027` por `2026` creaba una ausencia de siglos que el motor
      // respetaba en silencio. La sucursal empezaba a rechazar citas y el registro culpable estaba
      // en una fecha que nadie iba a mirar.
      const { useCase, manicuristas } = await preparar();

      await expect(
        useCase.registrarAusencia(
          { manicuristaId: manicuristas[0].id, rango: rango('2026-12-07T00:00:00Z', '2027-12-07T00:00:00Z') },
          ACTOR,
        ),
      ).rejects.toMatchObject({ code: 'EXCEPCION_DEMASIADO_LARGA', httpStatus: 400 });
    });

    it('acepta una ausencia larga pero plausible (60 días)', async () => {
      const { useCase, manicuristas } = await preparar();

      await expect(
        useCase.registrarAusencia(
          { manicuristaId: manicuristas[0].id, rango: rango('2026-12-07T00:00:00Z', '2027-02-05T00:00:00Z'), motivo: 'Incapacidad' },
          ACTOR,
        ),
      ).resolves.toBeDefined();
    });

    it('409 SI EL DESTINO DE LA COBERTURA ESTÁ CERRADO TODO EL RANGO (domingo)', async () => {
      // La cobertura es un movimiento: la resta en la sucursal base ocurriría igual, y la suma no
      // serviría de nada porque el destino está cerrado.
      const { useCase, manicuristas, crearOtraSucursal } = await preparar();
      const destino = await crearOtraSucursal(horarioRealDeBlanc());

      await expect(
        useCase.registrarCobertura(
          // 2026-12-13 es domingo, y `horarioRealDeBlanc` cierra en domingo.
          { manicuristaId: manicuristas[0].id, sucursalId: destino.id, rango: rango('2026-12-13T09:00:00Z', '2026-12-13T18:00:00Z') },
          ACTOR,
        ),
      ).rejects.toMatchObject({ code: 'SUCURSAL_DESTINO_CERRADA_EN_EL_RANGO', httpStatus: 409 });
    });

    it('409 si la cobertura cae enteramente dentro del corte de mediodía', async () => {
      const { useCase, manicuristas, crearOtraSucursal } = await preparar();
      const destino = await crearOtraSucursal(horarioRealDeBlanc());

      await expect(
        useCase.registrarCobertura(
          // 2026-12-07 es lunes; 12:30–14:30 hora de Querétaro cae entre los bloques 9–12 y 15–18.
          { manicuristaId: manicuristas[0].id, sucursalId: destino.id, rango: rango('2026-12-07T18:30:00Z', '2026-12-07T20:30:00Z') },
          ACTOR,
        ),
      ).rejects.toMatchObject({ code: 'SUCURSAL_DESTINO_CERRADA_EN_EL_RANGO' });
    });

    it('ACEPTA una cobertura que cruza el corte: cubrir el lunes entero es legítimo', async () => {
      // No se exige que quepa en UN bloque, solo que toque alguno: una cobertura de todo el día
      // cruza el corte de las 12:00 por definición.
      const { useCase, manicuristas, crearOtraSucursal } = await preparar();
      const destino = await crearOtraSucursal(horarioRealDeBlanc());

      await expect(
        useCase.registrarCobertura(
          { manicuristaId: manicuristas[0].id, sucursalId: destino.id, rango: rango('2026-12-07T15:00:00Z', '2026-12-08T00:00:00Z') },
          ACTOR,
        ),
      ).resolves.toBeDefined();
    });

    it('una ausencia NO se valida contra ningún horario: faltar no depende de que el local abra', async () => {
      // Deliberado: la ausencia no tiene sucursal. Avisar que no vienes el domingo es información
      // válida aunque el salón esté cerrado — y rechazarla sería inventar una regla.
      const { useCase, manicuristas } = await preparar();

      await expect(
        useCase.registrarAusencia(
          { manicuristaId: manicuristas[0].id, rango: rango('2026-12-13T09:00:00Z', '2026-12-13T18:00:00Z') },
          ACTOR,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('revocación', () => {
    it('devuelve la capacidad al eliminar la excepción', async () => {
      const { useCase, manicuristas, sucursal, motor } = await preparar({ manicuristas: 2, sillas: 2 });

      const { excepcion } = await useCase.registrarAusencia(
        { manicuristaId: manicuristas[0].id, rango: TODO_EL_DIA },
        ACTOR,
      );
      expect((await motor.calcularCapacidad(sucursal.id, DIEZ_A_ONCE)).manicuristasDisponibles).toBe(1);

      await useCase.revocar({ excepcionId: excepcion.id }, ACTOR);

      expect((await motor.calcularCapacidad(sucursal.id, DIEZ_A_ONCE)).manicuristasDisponibles).toBe(2);
    });

    it('lanza 404 al revocar una excepción inexistente', async () => {
      const { useCase } = await preparar();
      await expect(useCase.revocar({ excepcionId: '77777777-7777-7777-7777-777777777777' }, ACTOR)).rejects.toMatchObject({
        httpStatus: 404,
      });
    });
  });
});
