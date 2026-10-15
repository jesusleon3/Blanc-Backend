import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';
import { AgendarCitaUseCase } from './agendar-cita.use-case';
import { SolicitarConfirmacionCitaUseCase } from './solicitar-confirmacion-cita.use-case';
import { ConfirmarCitaUseCase } from './confirmar-cita.use-case';
import { CancelarCitaUseCase } from './cancelar-cita.use-case';
import { ReprogramarCitaUseCase, MAXIMO_DE_REPROGRAMACIONES } from './reprogramar-cita.use-case';
import { MarcarNoShowUseCase } from './marcar-no-show.use-case';
import { CompletarCitaUseCase } from './completar-cita.use-case';
import { DrizzleCitaRepository } from '../../infrastructure/persistence/drizzle-cita.repository';
import { DrizzleSillaRepository } from '../../infrastructure/persistence/drizzle-silla.repository';
import { Silla } from '../../domain/entities/silla.entity';
import { Cita } from '../../domain/entities/cita.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';
import { crearAnticipoFalso } from '../../test-utils/anticipo-falso';
import { crearRegistroDeIncidentesFalso } from '../../test-utils/registro-de-incidentes-falso';
import { MotorDisponibilidad } from '../../domain/services/motor-disponibilidad';
import { crearContextoPersonalFalso } from '../../test-utils/contexto-personal-falso';
import { ResolutorDeServicio } from '../../domain/services/resolutor-de-servicio';
import { crearContextoCatalogoFalso, crearContextoClientaFalso, servicioDePrueba } from '../../test-utils/contexto-catalogo-falso';
import { crearProcesarListaEsperaInerte } from '../../test-utils/lista-espera-inerte';

const ACTOR: ClaimsUsuario = { sub: 'encargada-1', rol: Rol.GERENTE, sucursales: 'GLOBAL', manicuristaId: null };
const SUCURSAL = '11111111-1111-1111-1111-111111111111';
const CLIENTA = '22222222-2222-2222-2222-222222222222';
const SERVICIO = '33333333-3333-3333-3333-333333333333';
const ANA = '44444444-4444-4444-4444-444444444444';

const rango = (i: string, f: string) => ({ inicio: new Date(i), fin: new Date(f) });
const DIEZ_A_ONCE = rango('2027-03-08T10:00:00Z', '2027-03-08T11:00:00Z');
const DOCE_A_UNA = rango('2027-03-08T12:00:00Z', '2027-03-08T13:00:00Z');

async function preparar(numeroDeSillas = 2, estadoDeAnticipo: Parameters<typeof crearAnticipoFalso>[0] = 'ninguno') {
  const db = await crearBaseDeDatosDePrueba();
  const citaRepo = new DrizzleCitaRepository(db);
  const sillaRepo = new DrizzleSillaRepository(db);
  const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
  const anticipos = crearAnticipoFalso(estadoDeAnticipo);
  // Horario abierto y personal de sobra: estas pruebas no van sobre disponibilidad.
  const motor = new MotorDisponibilidad(citaRepo, sillaRepo, crearContextoPersonalFalso());
  const uow = crearUnitOfWorkFalso();
  const incidentes = crearRegistroDeIncidentesFalso();
  const resolutor = new ResolutorDeServicio(crearContextoCatalogoFalso([servicioDePrueba({ id: SERVICIO })]));

  for (let i = 1; i <= numeroDeSillas; i += 1) {
    await sillaRepo.guardar(Silla.crear({ sucursalId: SUCURSAL, nombre: `Lomas ${i}` }));
  }

  return {
    citaRepo,
    sillaRepo,
    auditoria,
    agendar: new AgendarCitaUseCase(citaRepo, sillaRepo, motor, resolutor, crearContextoClientaFalso(), anticipos, auditoria, uow),
    solicitar: new SolicitarConfirmacionCitaUseCase(citaRepo, auditoria, uow),
    confirmar: new ConfirmarCitaUseCase(citaRepo, auditoria, uow),
    cancelar: new CancelarCitaUseCase(citaRepo, auditoria, uow, crearProcesarListaEsperaInerte(), incidentes, anticipos, crearContextoClientaFalso()),
    reprogramar: new ReprogramarCitaUseCase(citaRepo, sillaRepo, motor, resolutor, auditoria, uow, crearProcesarListaEsperaInerte(), incidentes, anticipos),
    noShow: new MarcarNoShowUseCase(citaRepo, auditoria, uow, incidentes, anticipos),
    completar: new CompletarCitaUseCase(citaRepo, auditoria, uow),
  };
}

/** El fin lo deriva el catálogo (60 min, igual que todos los rangos de este archivo). */
const reserva = ({ rangoHorario = DIEZ_A_ONCE, ...extra }: { rangoHorario?: typeof DIEZ_A_ONCE } & Record<string, unknown> = {}) => ({
  sucursalId: SUCURSAL,
  servicioId: SERVICIO,
  clientaId: CLIENTA,
  inicio: rangoHorario.inicio,
  ...extra,
});

describe('Ciclo de vida de una Cita (integración, PostgreSQL real) — cierre de P3', () => {
  it('recorre el flujo normal completo: agendada → pendiente_confirmacion → confirmada → completada', async () => {
    const { agendar, solicitar, confirmar, completar, citaRepo } = await preparar();
    const cita = await agendar.ejecutar(reserva(), ACTOR);

    await solicitar.ejecutar({ citaId: cita.id }, ACTOR);
    await confirmar.ejecutar({ citaId: cita.id }, ACTOR);
    await completar.ejecutar({ citaId: cita.id }, ACTOR);

    expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('completada');
  });

  it('rechaza una transición ilegal con TRANSICION_ESTADO_INVALIDA, sin tocar la base', async () => {
    const { agendar, confirmar, citaRepo } = await preparar();
    const cita = await agendar.ejecutar(reserva(), ACTOR);

    // `agendada -> confirmada` no es legal: la confirmación responde a un recordatorio.
    await expect(confirmar.ejecutar({ citaId: cita.id }, ACTOR)).rejects.toMatchObject({ code: 'TRANSICION_ESTADO_INVALIDA' });
    expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('agendada');
  });

  it('una cita terminal ya no se mueve', async () => {
    const { agendar, cancelar, completar } = await preparar();
    const cita = await agendar.ejecutar(reserva(), ACTOR);
    await cancelar.ejecutar({ citaId: cita.id }, ACTOR);

    await expect(completar.ejecutar({ citaId: cita.id }, ACTOR)).rejects.toThrow(/terminal/i);
  });

  describe('CancelarCitaUseCase — libera el hueco de verdad', () => {
    it('cancelar LIBERA la silla: el mismo horario se puede volver a reservar', async () => {
      const { agendar, cancelar } = await preparar(1);
      const cita = await agendar.ejecutar(reserva(), ACTOR);

      // Con 1 sola silla, esto solo puede pasar si cancelar liberó de verdad.
      await expect(agendar.ejecutar(reserva(), ACTOR)).rejects.toMatchObject({ code: 'HORARIO_NO_DISPONIBLE' });
      await cancelar.ejecutar({ citaId: cita.id }, ACTOR);
      await expect(agendar.ejecutar(reserva(), ACTOR)).resolves.toBeDefined();
    });

    it('cancelar libera también a la manicurista', async () => {
      const { agendar, cancelar } = await preparar(2);
      const cita = await agendar.ejecutar(reserva({ manicuristaId: ANA }), ACTOR);

      await expect(agendar.ejecutar(reserva({ manicuristaId: ANA }), ACTOR)).rejects.toMatchObject({ code: 'MANICURISTA_OCUPADA' });
      await cancelar.ejecutar({ citaId: cita.id }, ACTOR);
      await expect(agendar.ejecutar(reserva({ manicuristaId: ANA }), ACTOR)).resolves.toBeDefined();
    });

    describe('RN-CRM-06 — indicador de incidente tardío', () => {
      it('cancelar a más de 60 minutos NO es incidente', async () => {
        const { agendar, cancelar } = await preparar();
        const cita = await agendar.ejecutar(reserva(), ACTOR);

        const dosHorasAntes = new Date(DIEZ_A_ONCE.inicio.getTime() - 120 * 60000);
        const { incidenteTardio } = await cancelar.ejecutar({ citaId: cita.id }, ACTOR, dosHorasAntes);
        expect(incidenteTardio).toBe(false);
      });

      it.each([
        ['30 minutos antes', 30],
        ['justo en el minuto 60', 60],
        ['ya empezada', -15],
      ])('cancelar %s SÍ es incidente', async (_caso, minutosAntes) => {
        const { agendar, cancelar } = await preparar();
        const cita = await agendar.ejecutar(reserva(), ACTOR);

        const momento = new Date(DIEZ_A_ONCE.inicio.getTime() - minutosAntes * 60000);
        const { incidenteTardio } = await cancelar.ejecutar({ citaId: cita.id }, ACTOR, momento);
        expect(incidenteTardio).toBe(true);
      });

      it('el indicador NO marca lista roja: solo informa — esa decisión es solo de la Dueña (DEC-042)', async () => {
        const { agendar, cancelar, auditoria } = await preparar();
        const cita = await agendar.ejecutar(reserva(), ACTOR);

        const { incidenteTardio } = await cancelar.ejecutar({ citaId: cita.id }, ACTOR, DIEZ_A_ONCE.inicio);

        expect(incidenteTardio).toBe(true);
        // Queda en la auditoría para que CRM lo consuma, no se actúa sobre la clienta aquí.
        expect(auditoria.registrar).toHaveBeenCalledWith(
          expect.objectContaining({ detalle: expect.objectContaining({ accion: 'cancelar_cita', incidenteTardio: true }) }),
        );
      });
    });
  });

  describe('ReprogramarCitaUseCase', () => {
    it('marca la original como `reprogramada`, crea la nueva y las enlaza', async () => {
      const { agendar, reprogramar, citaRepo } = await preparar();
      const original = await agendar.ejecutar(reserva(), ACTOR);

      const { nueva } = await reprogramar.ejecutar({ citaId: original.id, nuevoInicio: DOCE_A_UNA.inicio }, ACTOR);

      expect((await citaRepo.buscarPorId(original.id))?.estado).toBe('reprogramada');
      expect(nueva.citaOrigenId).toBe(original.id);
      expect(nueva.numeroDeReprogramaciones).toBe(1);
      expect(nueva.estado).toBe('agendada');
    });

    it('`reprogramada` LIBERA el hueco viejo para otra clienta', async () => {
      const { agendar, reprogramar } = await preparar(1);
      const original = await agendar.ejecutar(reserva(), ACTOR);

      await reprogramar.ejecutar({ citaId: original.id, nuevoInicio: DOCE_A_UNA.inicio }, ACTOR);

      // Una sola silla: el horario de las 10 solo queda libre si `reprogramada` liberó.
      await expect(agendar.ejecutar(reserva(), ACTOR)).resolves.toBeDefined();
    });

    it('permite reprogramar al MISMO horario (p. ej. solo para cambiar de manicurista)', async () => {
      const { agendar, reprogramar } = await preparar(1);
      const original = await agendar.ejecutar(reserva(), ACTOR);

      // La original está a punto de liberar: no debe chocar consigo misma, ni con 1 sola silla.
      const { nueva } = await reprogramar.ejecutar(
        { citaId: original.id, nuevoInicio: DIEZ_A_ONCE.inicio, manicuristaId: ANA },
        ACTOR,
      );
      expect(nueva.manicuristaId).toBe(ANA);
    });

    it(`rechaza la reprogramación número ${MAXIMO_DE_REPROGRAMACIONES + 1} (DEC-042)`, async () => {
      const { agendar, reprogramar } = await preparar(3);
      let actual = await agendar.ejecutar(reserva(), ACTOR);

      for (let i = 1; i <= MAXIMO_DE_REPROGRAMACIONES; i += 1) {
        // Un día más por iteración, con aritmética real: concatenar el número daba "2027-03-010".
        const nuevoInicio = new Date(DIEZ_A_ONCE.inicio.getTime() + i * 86400000);
        actual = (await reprogramar.ejecutar({ citaId: actual.id, nuevoInicio }, ACTOR)).nueva;
        expect(actual.numeroDeReprogramaciones).toBe(i);
      }

      await expect(reprogramar.ejecutar({ citaId: actual.id, nuevoInicio: DOCE_A_UNA.inicio }, ACTOR)).rejects.toMatchObject({
        code: 'MAXIMO_DE_REPROGRAMACIONES_ALCANZADO',
      });
    });

    describe('RN-ANT-04 — con anticipo pagado exige 48h de antelación', () => {
      /** El estado del anticipo ya NO llega por parámetro: se consulta por puerto. */
      const conAnticipoPagado = () => preparar(1, 'pagado');

      it('rechaza si faltan menos de 48 horas', async () => {
        const { agendar, reprogramar } = await conAnticipoPagado();
        const original = await agendar.ejecutar(reserva(), ACTOR);

        const unDiaAntes = new Date(DIEZ_A_ONCE.inicio.getTime() - 24 * 3600000);
        await expect(
          reprogramar.ejecutar(
            { citaId: original.id, nuevoInicio: DOCE_A_UNA.inicio, confirmacionDeEmpleado: true },
            ACTOR,
            unDiaAntes,
          ),
        ).rejects.toMatchObject({ code: 'REPROGRAMACION_FUERA_DE_PLAZO' });
      });

      it('EXIGE CONFIRMACIÓN EXPLÍCITA aunque haya plazo (`RN-ANT-04`, alerta de confirmación)', async () => {
        // Sin confirmar, 409 que describe la consecuencia: reagendar no devuelve el anticipo.
        const { agendar, reprogramar } = await conAnticipoPagado();
        const original = await agendar.ejecutar(reserva(), ACTOR);

        const tresDiasAntes = new Date(DIEZ_A_ONCE.inicio.getTime() - 72 * 3600000);
        await expect(
          reprogramar.ejecutar({ citaId: original.id, nuevoInicio: DOCE_A_UNA.inicio }, ACTOR, tresDiasAntes),
        ).rejects.toMatchObject({ code: 'REPROGRAMACION_REQUIERE_CONFIRMACION', httpStatus: 409 });
      });

      it('acepta con 48 horas o más y confirmación', async () => {
        const { agendar, reprogramar } = await conAnticipoPagado();
        const original = await agendar.ejecutar(reserva(), ACTOR);

        const tresDiasAntes = new Date(DIEZ_A_ONCE.inicio.getTime() - 72 * 3600000);
        await expect(
          reprogramar.ejecutar(
            { citaId: original.id, nuevoInicio: DOCE_A_UNA.inicio, confirmacionDeEmpleado: true },
            ACTOR,
            tresDiasAntes,
          ),
        ).resolves.toBeDefined();
      });

      it('sin anticipo pagado no aplica el plazo', async () => {
        const { agendar, reprogramar } = await preparar();
        const original = await agendar.ejecutar(reserva(), ACTOR);

        const unaHoraAntes = new Date(DIEZ_A_ONCE.inicio.getTime() - 3600000);
        await expect(
          reprogramar.ejecutar({ citaId: original.id, nuevoInicio: DOCE_A_UNA.inicio }, ACTOR, unaHoraAntes),
        ).resolves.toBeDefined();
      });
    });

    it('si la nueva cita no cabe, la original NO queda marcada como reprogramada', async () => {
      const { agendar, reprogramar, citaRepo } = await preparar(1);
      const original = await agendar.ejecutar(reserva(), ACTOR);
      // Ocupamos el destino con otra clienta en la única silla.
      await agendar.ejecutar(reserva({ rangoHorario: DOCE_A_UNA }), ACTOR);

      await expect(reprogramar.ejecutar({ citaId: original.id, nuevoInicio: DOCE_A_UNA.inicio }, ACTOR)).rejects.toMatchObject({
        code: 'HORARIO_NO_DISPONIBLE',
      });

      // Si quedara `reprogramada`, la clienta se habría quedado sin ninguna de las dos citas.
      expect((await citaRepo.buscarPorId(original.id))?.estado).toBe('agendada');
    });
  });

  describe('Flujo de anticipo (lista roja) — RN-ANT-03', () => {
    it('una cita en `en_espera_pago` NO retiene el hueco: otra clienta puede reservarlo', async () => {
      const { citaRepo, agendar } = await preparar(1);
      const sillaId = (await agendar.ejecutar(reserva({ rangoHorario: DOCE_A_UNA }), ACTOR)).sillaId;

      const enEspera = Cita.crear({ ...reserva(), rangoHorario: DIEZ_A_ONCE, sillaId, estado: 'en_espera_pago' });
      await citaRepo.guardar(enEspera);

      // El hueco de las 10 sigue disponible pese a la cita pendiente de pago.
      await expect(agendar.ejecutar(reserva(), ACTOR)).resolves.toBeDefined();
    });

    it('LA CARRERA SE RESUELVE AL CONFIRMAR EL PAGO: la segunda recibe SILLA_OCUPADA', async () => {
      const { citaRepo, sillaRepo, confirmar } = await preparar(1);
      const sillaId = (await sillaRepo.listarPorSucursal(SUCURSAL))[0].id;

      const primera = Cita.crear({ ...reserva(), rangoHorario: DIEZ_A_ONCE, sillaId, estado: 'en_espera_pago' });
      const segunda = Cita.crear({ ...reserva(), rangoHorario: DIEZ_A_ONCE, sillaId, estado: 'en_espera_pago' });
      await citaRepo.guardar(primera);
      await citaRepo.guardar(segunda);

      await expect(confirmar.ejecutar({ citaId: primera.id }, ACTOR)).resolves.toBeDefined();
      // "el primero en pagar se queda con el cupo" — la segunda transfirió y aun así lo pierde.
      await expect(confirmar.ejecutar({ citaId: segunda.id }, ACTOR)).rejects.toMatchObject({ code: 'SILLA_OCUPADA' });
    });
  });

  describe('MarcarNoShowUseCase y CompletarCitaUseCase', () => {
    it('`no_show` OCUPA el horario: no libera la silla, a diferencia de cancelar', async () => {
      const { agendar, noShow } = await preparar(1);
      const cita = await agendar.ejecutar(reserva(), ACTOR);

      await noShow.ejecutar({ citaId: cita.id }, ACTOR);

      // Nadie pudo aprovechar ese hueco: tratarlo como libre falsearía la ocupación histórica.
      await expect(agendar.ejecutar(reserva(), ACTOR)).rejects.toMatchObject({ code: 'HORARIO_NO_DISPONIBLE' });
    });

    it('se puede cerrar directo desde `agendada`, sin haber pasado por confirmación', async () => {
      const { agendar, noShow, completar } = await preparar(2);
      const unaCita = await agendar.ejecutar(reserva(), ACTOR);
      const otra = await agendar.ejecutar(reserva({ rangoHorario: DOCE_A_UNA }), ACTOR);

      await expect(completar.ejecutar({ citaId: unaCita.id }, ACTOR)).resolves.toBeDefined();
      await expect(noShow.ejecutar({ citaId: otra.id }, ACTOR)).resolves.toBeDefined();
    });

    it('N-02: `completada -> no_show` es una corrección válida, no una transición rota', async () => {
      const { agendar, completar, noShow, citaRepo, auditoria } = await preparar();
      const cita = await agendar.ejecutar(reserva(), ACTOR);

      // El job marca `completada` por paso del tiempo (`DEC-030`)...
      await completar.ejecutar({ citaId: cita.id }, ACTOR);
      // ...y a la mañana siguiente la Encargada descubre que la clienta nunca llegó.
      await noShow.ejecutar({ citaId: cita.id }, ACTOR);

      expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('no_show');
      // Queda rastro de que vino de `completada`: es una corrección, no un no-show de origen.
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ detalle: expect.objectContaining({ estadoAnterior: 'completada', estadoNuevo: 'no_show' }) }),
      );
    });

    it('pero `no_show -> completada` NO es legal: la corrección va en un solo sentido', async () => {
      const { agendar, noShow, completar } = await preparar();
      const cita = await agendar.ejecutar(reserva(), ACTOR);
      await noShow.ejecutar({ citaId: cita.id }, ACTOR);

      await expect(completar.ejecutar({ citaId: cita.id }, ACTOR)).rejects.toMatchObject({ code: 'TRANSICION_ESTADO_INVALIDA' });
    });

    it('auditan el estado anterior, que es lo que permite reconstruir cómo llegó ahí', async () => {
      const { agendar, noShow, auditoria } = await preparar();
      const cita = await agendar.ejecutar(reserva(), ACTOR);

      await noShow.ejecutar({ citaId: cita.id }, ACTOR);

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          detalle: expect.objectContaining({ accion: 'marcar_no_show', estadoAnterior: 'agendada', estadoNuevo: 'no_show' }),
        }),
      );
    });
  });

  it('devuelve 404 si la cita no existe', async () => {
    const { confirmar } = await preparar();
    await expect(confirmar.ejecutar({ citaId: '00000000-0000-0000-0000-000000000000' }, ACTOR)).rejects.toMatchObject({
      code: 'RECURSO_NO_ENCONTRADO',
      httpStatus: 404,
    });
  });
});
