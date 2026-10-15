import { crearBaseDeDatosDePrueba } from '../../database/test-utils/postgres-de-prueba';
import { ContextoClientaAdapter } from './contexto-clienta.adapter';
import { RegistroDeIncidentesAdapter } from './registro-de-incidentes.adapter';
import { DrizzleClientaRepository } from '../crm-y-clientas/infrastructure/persistence/drizzle-clienta.repository';
import { Clienta } from '../crm-y-clientas/domain/entities/clienta.entity';
import {
  ConsultarClientaUseCase,
  RegistrarCancelacionOrdinariaUseCase,
  RegistrarIncidenteClientaUseCase,
} from '../crm-y-clientas/application/use-cases/clientas.use-cases';
import { AgendarCitaUseCase } from '../agenda/application/use-cases/agendar-cita.use-case';
import { CancelarCitaUseCase } from '../agenda/application/use-cases/cancelar-cita.use-case';
import { ReprogramarCitaUseCase } from '../agenda/application/use-cases/reprogramar-cita.use-case';
import { MarcarNoShowUseCase } from '../agenda/application/use-cases/marcar-no-show.use-case';
import { ConsultarAgendaUseCase } from '../agenda/application/use-cases/consultar-agenda.use-case';
import { DrizzleCitaRepository } from '../agenda/infrastructure/persistence/drizzle-cita.repository';
import { DrizzleSillaRepository } from '../agenda/infrastructure/persistence/drizzle-silla.repository';
import { Silla } from '../agenda/domain/entities/silla.entity';
import { MotorDisponibilidad } from '../agenda/domain/services/motor-disponibilidad';
import { ResolutorDeServicio } from '../agenda/domain/services/resolutor-de-servicio';
import { crearContextoPersonalFalso, horarioAbiertoSiempre } from '../agenda/test-utils/contexto-personal-falso';
import { crearCatalogoPorDuraciones } from '../agenda/test-utils/contexto-catalogo-falso';
import { crearProcesarListaEsperaInerte } from '../agenda/test-utils/lista-espera-inerte';
import { citaAJson } from '../agenda/infrastructure/http/cita.presenter';
import { AuditoriaPort } from '../../shared/auditoria/auditoria.port';
import { ClaimsUsuario, Rol } from '../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../shared/persistence/test-utils/unit-of-work-falso';

const ENCARGADA: ClaimsUsuario = { sub: 'encargada-1', rol: Rol.GERENTE, sucursales: 'GLOBAL', manicuristaId: null };
const ANA = 'aaaaaaaa-0000-4000-8000-000000000001';
const MANICURISTA: ClaimsUsuario = { sub: 'ana', rol: Rol.MANICURISTA, sucursales: 'GLOBAL', manicuristaId: ANA };
const SUCURSAL = '11111111-1111-4111-8111-111111111111';

const CATALOGO = crearCatalogoPorDuraciones([60]);
const SERVICIO = CATALOGO.idPara(60);

const DIEZ = new Date('2026-12-07T10:00:00.000Z');
const ONCE = new Date('2026-12-07T11:00:00.000Z');
/** Muy antes de la cita: fuera de la ventana de 60 minutos de `RN-CRM-06`. */
const AYER = new Date('2026-12-06T10:00:00.000Z');

/**
 * Monta Agenda y CRM **con los adaptadores reales de `IntegracionModule`** contra PostgreSQL.
 *
 * Deliberadamente no se doblan `ContextoClientaPort` ni `RegistroDeIncidentesPort`: lo que se
 * prueba es que el estado de una clienta real cambie el comportamiento de Agenda, y que un
 * incidente de Agenda llegue de verdad a CRM. Con dobles, estas pruebas pasarían aunque el
 * cableado estuviera roto.
 */
async function preparar({ sillas = 2 }: { sillas?: number } = {}) {
  const db = await crearBaseDeDatosDePrueba();
  const citaRepo = new DrizzleCitaRepository(db);
  const sillaRepo = new DrizzleSillaRepository(db);
  const clientaRepo = new DrizzleClientaRepository(db);
  const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
  const uow = crearUnitOfWorkFalso();

  for (let i = 1; i <= sillas; i += 1) {
    await sillaRepo.guardar(Silla.crear({ sucursalId: SUCURSAL, nombre: `Lomas ${i}` }));
  }

  const motor = new MotorDisponibilidad(citaRepo, sillaRepo, crearContextoPersonalFalso({ horario: horarioAbiertoSiempre() }));
  const resolutor = new ResolutorDeServicio(CATALOGO.port);

  const contextoClienta = new ContextoClientaAdapter(clientaRepo);
  const incidentes = new RegistroDeIncidentesAdapter(
    new RegistrarIncidenteClientaUseCase(clientaRepo, auditoria, uow),
    new RegistrarCancelacionOrdinariaUseCase(clientaRepo, uow),
  );

  const crearClienta = async (nombre: string, telefono: string, estado?: 'lista_roja' | 'bloqueada') => {
    const clienta = Clienta.registrar({ nombre, telefono });
    if (estado === 'lista_roja') clienta.marcarListaRoja();
    if (estado === 'bloqueada') clienta.marcarBloqueada();
    await clientaRepo.guardar(clienta);
    return clienta;
  };

  return {
    citaRepo,
    clientaRepo,
    crearClienta,
    consultarClienta: new ConsultarClientaUseCase(clientaRepo),
    agendar: new AgendarCitaUseCase(citaRepo, sillaRepo, motor, resolutor, contextoClienta, auditoria, uow),
    cancelar: new CancelarCitaUseCase(citaRepo, auditoria, uow, crearProcesarListaEsperaInerte(), incidentes),
    reprogramar: new ReprogramarCitaUseCase(
      citaRepo,
      sillaRepo,
      motor,
      resolutor,
      auditoria,
      uow,
      crearProcesarListaEsperaInerte(),
      incidentes,
    ),
    noShow: new MarcarNoShowUseCase(citaRepo, auditoria, uow, incidentes),
    consultarAgenda: new ConsultarAgendaUseCase(citaRepo, contextoClienta),
  };
}

const reserva = (clientaId: string, inicio = DIEZ) => ({ sucursalId: SUCURSAL, servicioId: SERVICIO, clientaId, inicio });

describe('Integración Agenda ↔ CRM (adaptadores reales, PostgreSQL real)', () => {
  describe('el estado de la clienta decide si se agenda y cómo', () => {
    it('una clienta `normal` agenda y su cita nace `agendada`', async () => {
      const { agendar, crearClienta } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');

      const cita = await agendar.ejecutar(reserva(clienta.id), ENCARGADA);
      expect(cita.estado).toBe('agendada');
    });

    it('404 CON UN `clientaId` QUE NO EXISTE: se retiró el adaptador permisivo', async () => {
      // Hasta Fase 3 Parte 1, `CrmNoConstruidoVerificarClientaAdapter` aceptaba cualquier uuid y
      // se podía vender una cita a una clienta inventada. `ADR-005` impide pedirle esta integridad
      // a una clave foránea entre esquemas, así que la da el puerto.
      const { agendar } = await preparar();

      await expect(agendar.ejecutar(reserva('99999999-9999-4999-8999-999999999999'), ENCARGADA)).rejects.toMatchObject({
        code: 'RECURSO_NO_ENCONTRADO',
        httpStatus: 404,
      });
    });

    it('409 CLIENTA_BLOQUEADA (`RN-CRM-04`): no agenda hasta que lo revise una persona', async () => {
      const { agendar, crearClienta } = await preparar();
      const bloqueada = await crearClienta('Ximena Morales', '4423334455', 'bloqueada');

      await expect(agendar.ejecutar(reserva(bloqueada.id), ENCARGADA)).rejects.toMatchObject({
        code: 'CLIENTA_BLOQUEADA',
        httpStatus: 409,
      });
    });

    it('LISTA ROJA: LA CITA NACE EN `en_espera_pago` (`RN-ANT-01`), no `agendada`', async () => {
      const { agendar, crearClienta } = await preparar();
      const enListaRoja = await crearClienta('Lucía Martínez', '4422223344', 'lista_roja');

      const cita = await agendar.ejecutar(reserva(enListaRoja.id), ENCARGADA);

      expect(cita.estado).toBe('en_espera_pago');
    });

    it('Y ESE ESTADO NO RETIENE EL HORARIO (`RN-ANT-03`): otra clienta puede tomarlo', async () => {
      // Es la consecuencia que `DEC-034` había supuesto al revés y que la migración `0007`
      // corrigió. `RN-ANT-03`: *"el horario permanece disponible... el primero en pagar se queda
      // con el cupo"*. Con una sola silla, la clienta normal entra igual.
      const { agendar, crearClienta } = await preparar({ sillas: 1 });
      const enListaRoja = await crearClienta('Lucía Martínez', '4422223344', 'lista_roja');
      const normal = await crearClienta('Andrea Ramírez', '4421112233');

      await agendar.ejecutar(reserva(enListaRoja.id), ENCARGADA);

      const segunda = await agendar.ejecutar(reserva(normal.id), ENCARGADA);
      expect(segunda.estado).toBe('agendada');
      expect(segunda.rangoHorario.inicio).toEqual(DIEZ);
    });

    it('`RN-CRM-07` NO RETROACTIVO: marcar lista roja después no cambia la cita ya agendada', async () => {
      // *"Si ya tenía una cita hecha no es lista roja, pero si es para volver a agendar... se pide
      // anticipo"*. Mismo principio que `RN-AGE-08` con el snapshot de cotización.
      const { agendar, crearClienta, clientaRepo, citaRepo } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');
      const cita = await agendar.ejecutar(reserva(clienta.id), ENCARGADA);

      const recargada = (await clientaRepo.buscarPorId(clienta.id))!;
      recargada.marcarListaRoja();
      await clientaRepo.guardar(recargada);

      // La cita de antes sigue como estaba.
      expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('agendada');
      // Y la siguiente ya nace pendiente de anticipo.
      const nueva = await agendar.ejecutar(reserva(clienta.id, ONCE), ENCARGADA);
      expect(nueva.estado).toBe('en_espera_pago');
    });
  });

  describe('incidentes que llegan de Agenda a CRM (`RN-CRM-06`)', () => {
    it('UN NO-SHOW ENCIENDE LA SUGERENCIA, y nada más', async () => {
      const { agendar, noShow, crearClienta, consultarClienta } = await preparar();
      const clienta = await crearClienta('Lucía Martínez', '4422223344');
      const cita = await agendar.ejecutar(reserva(clienta.id), ENCARGADA);

      await noShow.ejecutar({ citaId: cita.id }, ENCARGADA, new Date(DIEZ.getTime() + 30 * 60_000));

      const { clienta: tras, incidentes } = await consultarClienta.ejecutar({ clientaId: clienta.id });
      expect(tras.sugeridaListaRoja).toBe(true);
      // **No se marca lista roja**: eso es exclusivo de la Dueña (`RN-CRM-05`, `DEC-042`).
      expect(tras.estadoDeRiesgo).toBe('normal');
      expect(incidentes).toEqual([expect.objectContaining({ tipo: 'no_show', citaId: cita.id })]);
    });

    it('CANCELAR A 30 MINUTOS es incidente tardío y enciende la sugerencia', async () => {
      const { agendar, cancelar, crearClienta, consultarClienta } = await preparar();
      const clienta = await crearClienta('Lucía Martínez', '4422223344');
      const cita = await agendar.ejecutar(reserva(clienta.id), ENCARGADA);

      const { incidenteTardio } = await cancelar.ejecutar({ citaId: cita.id }, ENCARGADA, new Date(DIEZ.getTime() - 30 * 60_000));

      expect(incidenteTardio).toBe(true);
      const { clienta: tras, incidentes } = await consultarClienta.ejecutar({ clientaId: clienta.id });
      expect(tras.sugeridaListaRoja).toBe(true);
      expect(incidentes).toEqual([expect.objectContaining({ tipo: 'cancelacion_tardia', minutosDeAntelacion: 30 })]);
    });

    it('CANCELAR CON UN DÍA DE AVISO solo cuenta: no enciende la sugerencia', async () => {
      // `RN-CRM-06` descartó expresamente el umbral acumulado. El contador es contexto para la
      // Dueña, no disparador.
      const { agendar, cancelar, crearClienta, consultarClienta } = await preparar();
      const clienta = await crearClienta('Renata Salazar', '4424445566');
      const cita = await agendar.ejecutar(reserva(clienta.id), ENCARGADA);

      await cancelar.ejecutar({ citaId: cita.id }, ENCARGADA, AYER);

      const { clienta: tras, incidentes } = await consultarClienta.ejecutar({ clientaId: clienta.id });
      expect(tras.cancelacionesOrdinarias).toBe(1);
      expect(tras.sugeridaListaRoja).toBe(false);
      expect(incidentes).toEqual([]);
    });

    it('REPROGRAMAR A 30 MINUTOS es incidente (`reprogramacion_tardia`)', async () => {
      // Es el mismo daño operativo que cancelar tarde: el hueco ya no se puede revender.
      const { agendar, reprogramar, crearClienta, consultarClienta } = await preparar();
      const clienta = await crearClienta('Lucía Martínez', '4422223344');
      const cita = await agendar.ejecutar(reserva(clienta.id), ENCARGADA);

      await reprogramar.ejecutar({ citaId: cita.id, nuevoInicio: ONCE }, ENCARGADA, new Date(DIEZ.getTime() - 30 * 60_000));

      const { clienta: tras, incidentes } = await consultarClienta.ejecutar({ clientaId: clienta.id });
      expect(tras.sugeridaListaRoja).toBe(true);
      expect(incidentes).toEqual([expect.objectContaining({ tipo: 'reprogramacion_tardia' })]);
    });

    it('REPROGRAMAR CON UN DÍA DE AVISO no genera incidente ni cuenta cancelación', async () => {
      // Mover una cita con tiempo no es un daño: el hueco se puede revender.
      const { agendar, reprogramar, crearClienta, consultarClienta } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');
      const cita = await agendar.ejecutar(reserva(clienta.id), ENCARGADA);

      await reprogramar.ejecutar({ citaId: cita.id, nuevoInicio: ONCE }, ENCARGADA, AYER);

      const { clienta: tras, incidentes } = await consultarClienta.ejecutar({ clientaId: clienta.id });
      expect(tras.sugeridaListaRoja).toBe(false);
      expect(tras.cancelacionesOrdinarias).toBe(0);
      expect(incidentes).toEqual([]);
    });

    it('a 61 minutos NO es incidente; a 60 exactos SÍ (el umbral es inclusivo)', async () => {
      const { agendar, cancelar, crearClienta, consultarClienta } = await preparar();
      const conMargen = await crearClienta('Andrea Ramírez', '4421112233');
      const alLimite = await crearClienta('Lucía Martínez', '4422223344');

      const unaCita = await agendar.ejecutar(reserva(conMargen.id), ENCARGADA);
      const otraCita = await agendar.ejecutar(reserva(alLimite.id), ENCARGADA);

      await cancelar.ejecutar({ citaId: unaCita.id }, ENCARGADA, new Date(DIEZ.getTime() - 61 * 60_000));
      await cancelar.ejecutar({ citaId: otraCita.id }, ENCARGADA, new Date(DIEZ.getTime() - 60 * 60_000));

      expect((await consultarClienta.ejecutar({ clientaId: conMargen.id })).clienta.sugeridaListaRoja).toBe(false);
      expect((await consultarClienta.ejecutar({ clientaId: alLimite.id })).clienta.sugeridaListaRoja).toBe(true);
    });

    it('UN FALLO AL ANOTAR EN CRM NO DESHACE LA CANCELACIÓN', async () => {
      // La jerarquía real: cancelar es el acto, el incidente es la anotación. Si el adaptador
      // propagara, la clienta seguiría con una cita que acababa de cancelar.
      const { agendar, cancelar, crearClienta, clientaRepo, citaRepo } = await preparar();
      const clienta = await crearClienta('Lucía Martínez', '4422223344');
      const cita = await agendar.ejecutar(reserva(clienta.id), ENCARGADA);

      jest.spyOn(clientaRepo, 'registrarIncidente').mockRejectedValueOnce(new Error('CRM caído'));

      await expect(
        cancelar.ejecutar({ citaId: cita.id }, ENCARGADA, new Date(DIEZ.getTime() - 10 * 60_000)),
      ).resolves.toMatchObject({ incidenteTardio: true });

      expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('cancelada');
    });
  });

  describe('`enListaRoja` en la consulta de agenda — y NUNCA en el iPad', () => {
    it('la GERENTE ve el indicador: necesita saber a quién pedirle anticipo', async () => {
      const { agendar, crearClienta, consultarAgenda } = await preparar();
      const enListaRoja = await crearClienta('Lucía Martínez', '4422223344', 'lista_roja');
      const normal = await crearClienta('Andrea Ramírez', '4421112233');
      await agendar.ejecutar(reserva(enListaRoja.id), ENCARGADA);
      await agendar.ejecutar(reserva(normal.id), ENCARGADA);

      const pagina = await consultarAgenda.ejecutar({ sucursalId: SUCURSAL, rangoHorario: { inicio: DIEZ, fin: ONCE } }, ENCARGADA);

      expect(pagina.enListaRojaPorClienta.get(enListaRoja.id)).toBe(true);
      expect(pagina.enListaRojaPorClienta.get(normal.id)).toBe(false);
    });

    it('A LA MANICURISTA NO SE LE CONSULTA SIQUIERA: el mapa viene vacío', async () => {
      // No se consulta y luego se filtra: si el dato nunca entra en el proceso, no puede
      // escaparse por un presenter futuro, por un log ni por un mensaje de error (`DEC-040`).
      const { agendar, crearClienta, consultarAgenda } = await preparar();
      const enListaRoja = await crearClienta('Lucía Martínez', '4422223344', 'lista_roja');
      await agendar.ejecutar({ ...reserva(enListaRoja.id), manicuristaId: ANA }, ENCARGADA);

      const pagina = await consultarAgenda.ejecutar(
        { sucursalId: SUCURSAL, rangoHorario: { inicio: DIEZ, fin: ONCE } },
        MANICURISTA,
      );

      expect(pagina.citas).toHaveLength(1);
      expect(pagina.enListaRojaPorClienta.size).toBe(0);
    });

    it('Y SU DTO NO LLEVA `enListaRoja` NI `clientaId`', async () => {
      const { agendar, crearClienta } = await preparar();
      const enListaRoja = await crearClienta('Lucía Martínez', '4422223344', 'lista_roja');
      const cita = await agendar.ejecutar({ ...reserva(enListaRoja.id), manicuristaId: ANA }, ENCARGADA);

      // Incluso forzando el dato en el presenter, la forma de la Manicurista no lo incluye.
      const paraElIpad = citaAJson(cita, MANICURISTA, { enListaRoja: true });

      expect(paraElIpad).not.toHaveProperty('enListaRoja');
      expect(paraElIpad).not.toHaveProperty('clientaId');
      expect(citaAJson(cita, ENCARGADA, { enListaRoja: true })).toMatchObject({ enListaRoja: true });
    });
  });
});
