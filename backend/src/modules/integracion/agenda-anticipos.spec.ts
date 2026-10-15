import { crearBaseDeDatosDePrueba } from '../../database/test-utils/postgres-de-prueba';
import { AnticipoAdapter } from './anticipo.adapter';
import { TransicionDeCitaAdapter } from './transicion-de-cita.adapter';
import { ContextoClientaAdapter } from './contexto-clienta.adapter';
import { DrizzleAnticipoRepository } from '../anticipos/infrastructure/persistence/drizzle-anticipo.repository';
import { DrizzleClientaRepository } from '../crm-y-clientas/infrastructure/persistence/drizzle-clienta.repository';
import { Clienta } from '../crm-y-clientas/domain/entities/clienta.entity';
import { PORCENTAJE_DE_ANTICIPO_POR_DEFECTO } from '../anticipos/domain/entities/anticipo.entity';
import {
  ConfirmarPagoAnticipoUseCase,
  ConsultarAnticiposUseCase,
  ExpirarAnticipoUseCase,
  GenerarAnticipoUseCase,
  RetenerAnticipoUseCase,
} from '../anticipos/application/use-cases/anticipos.use-cases';
import { AgendarCitaUseCase } from '../agenda/application/use-cases/agendar-cita.use-case';
import { CancelarCitaUseCase } from '../agenda/application/use-cases/cancelar-cita.use-case';
import { ReprogramarCitaUseCase } from '../agenda/application/use-cases/reprogramar-cita.use-case';
import { MarcarNoShowUseCase } from '../agenda/application/use-cases/marcar-no-show.use-case';
import { TransicionarCitaPorAnticipoUseCase } from '../agenda/application/use-cases/transicionar-cita-por-anticipo.use-case';
import { DrizzleCitaRepository } from '../agenda/infrastructure/persistence/drizzle-cita.repository';
import { DrizzleSillaRepository } from '../agenda/infrastructure/persistence/drizzle-silla.repository';
import { Silla } from '../agenda/domain/entities/silla.entity';
import { MotorDisponibilidad } from '../agenda/domain/services/motor-disponibilidad';
import { ResolutorDeServicio } from '../agenda/domain/services/resolutor-de-servicio';
import { crearContextoPersonalFalso, horarioAbiertoSiempre } from '../agenda/test-utils/contexto-personal-falso';
import { crearCatalogoPorDuraciones, servicioDePrueba } from '../agenda/test-utils/contexto-catalogo-falso';
import { crearContextoCatalogoFalso } from '../agenda/test-utils/contexto-catalogo-falso';
import { crearProcesarListaEsperaInerte } from '../agenda/test-utils/lista-espera-inerte';
import { crearRegistroDeIncidentesFalso } from '../agenda/test-utils/registro-de-incidentes-falso';
import { AuditoriaPort } from '../../shared/auditoria/auditoria.port';
import { ClaimsUsuario, Rol } from '../../shared/auth/rol';
import { DrizzleUnitOfWork } from '../../shared/persistence/drizzle-unit-of-work';

const DUEÑA: ClaimsUsuario = { sub: 'dueña-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL', manicuristaId: null };
const SUCURSAL = '11111111-1111-4111-8111-111111111111';

const CATALOGO = crearCatalogoPorDuraciones([60]);
const SERVICIO = CATALOGO.idPara(60);
/** El servicio de prueba cuesta $450.00; el 40% son $180.00. */
const PRECIO_CENTAVOS = 45000;

const DIEZ = new Date('2026-12-07T10:00:00.000Z');
const AYER = new Date('2026-12-06T10:00:00.000Z');

/**
 * Monta Agenda y Anticipos **con los dos adaptadores reales de `IntegracionModule`** contra
 * PostgreSQL, en los dos sentidos.
 *
 * Es el par que `P5` señalaba como circular, así que doblarlo no serviría de nada: lo que se
 * prueba es precisamente que el cableado cruzado funcione y que la carrera de `RN-ANT-03` se
 * resuelva donde debe.
 */
async function preparar({ sillas = 1, catalogo = CATALOGO.port }: { sillas?: number; catalogo?: typeof CATALOGO.port } = {}) {
  const db = await crearBaseDeDatosDePrueba();
  const citaRepo = new DrizzleCitaRepository(db);
  const sillaRepo = new DrizzleSillaRepository(db);
  const anticipoRepo = new DrizzleAnticipoRepository(db);
  const clientaRepo = new DrizzleClientaRepository(db);
  const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
  /**
   * **`UnitOfWork` REAL, no el falso.** Es imprescindible aquí y en ningún otro sitio lo era: lo
   * que este archivo afirma es que si la cita no se puede activar, la confirmación del pago **se
   * deshace entera**. Con el doble —que solo ejecuta el callback— la prueba habría pasado dejando
   * el anticipo en `pagado`, es decir habría certificado una atomicidad que no existe.
   */
  const uow = new DrizzleUnitOfWork(db);

  for (let i = 1; i <= sillas; i += 1) {
    await sillaRepo.guardar(Silla.crear({ sucursalId: SUCURSAL, nombre: `Lomas ${i}` }));
  }

  const motor = new MotorDisponibilidad(citaRepo, sillaRepo, crearContextoPersonalFalso({ horario: horarioAbiertoSiempre() }));
  const resolutor = new ResolutorDeServicio(catalogo);
  const contextoClienta = new ContextoClientaAdapter(clientaRepo);

  const consultarAnticipos = new ConsultarAnticiposUseCase(anticipoRepo);
  const generar = new GenerarAnticipoUseCase(anticipoRepo, auditoria, uow);
  const retener = new RetenerAnticipoUseCase(anticipoRepo, auditoria, uow);
  const anticipoPort = new AnticipoAdapter(consultarAnticipos, generar, retener);

  const transicionar = new TransicionarCitaPorAnticipoUseCase(citaRepo, sillaRepo, motor, auditoria);
  const transicionPort = new TransicionDeCitaAdapter(transicionar);

  const crearClienta = async (nombre: string, telefono: string, enListaRoja = false) => {
    const clienta = Clienta.registrar({ nombre, telefono });
    if (enListaRoja) clienta.marcarListaRoja();
    await clientaRepo.guardar(clienta);
    return clienta;
  };

  return {
    citaRepo,
    anticipoRepo,
    auditoria,
    crearClienta,
    consultarAnticipos,
    agendar: new AgendarCitaUseCase(citaRepo, sillaRepo, motor, resolutor, contextoClienta, anticipoPort, auditoria, uow),
    confirmarPago: new ConfirmarPagoAnticipoUseCase(anticipoRepo, transicionPort, auditoria, uow),
    expirarAnticipo: new ExpirarAnticipoUseCase(anticipoRepo, transicionPort, auditoria, uow),
    generarAnticipo: generar,
    cancelar: new CancelarCitaUseCase(
      citaRepo,
      auditoria,
      uow,
      crearProcesarListaEsperaInerte(),
      crearRegistroDeIncidentesFalso(),
      anticipoPort,
      contextoClienta,
    ),
    reprogramar: new ReprogramarCitaUseCase(
      citaRepo,
      sillaRepo,
      motor,
      resolutor,
      auditoria,
      uow,
      crearProcesarListaEsperaInerte(),
      crearRegistroDeIncidentesFalso(),
      anticipoPort,
    ),
    noShow: new MarcarNoShowUseCase(citaRepo, auditoria, uow, crearRegistroDeIncidentesFalso(), anticipoPort),
  };
}

const reserva = (clientaId: string, inicio = DIEZ) => ({ sucursalId: SUCURSAL, servicioId: SERVICIO, clientaId, inicio });

describe('Integración Agenda ↔ Anticipos (adaptadores reales, PostgreSQL real)', () => {
  describe('`RN-ANT-01` — generación automática, solo lista roja', () => {
    it('LA CITA DE LISTA ROJA NACE CON SU ANTICIPO YA GENERADO, al 40%', async () => {
      // El 40% lo dijo la Dueña (`DISCOVERY_CHECKLIST` 1.13). Se genera en el mismo acto de
      // agendar: una cita `en_espera_pago` sin fila de anticipo sería una cita que nadie sabe
      // cuánto cobrar.
      const { agendar, crearClienta, consultarAnticipos } = await preparar();
      const clienta = await crearClienta('Lucía Martínez', '4422223344', true);

      const cita = await agendar.ejecutar(reserva(clienta.id), DUEÑA);

      expect(cita.estado).toBe('en_espera_pago');
      const anticipo = await consultarAnticipos.deCita({ citaId: cita.id });
      expect(anticipo).toMatchObject({
        estado: 'pendiente',
        montoCentavos: (PRECIO_CENTAVOS * PORCENTAJE_DE_ANTICIPO_POR_DEFECTO) / 100,
        porcentajeAplicado: PORCENTAJE_DE_ANTICIPO_POR_DEFECTO,
      });
      expect(anticipo.montoCentavos).toBe(18000);
    });

    it('una clienta NORMAL no genera anticipo: su cita nace `agendada` y sin fila', async () => {
      const { agendar, crearClienta, consultarAnticipos } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');

      const cita = await agendar.ejecutar(reserva(clienta.id), DUEÑA);

      expect(cita.estado).toBe('agendada');
      await expect(consultarAnticipos.deCita({ citaId: cita.id })).rejects.toMatchObject({ httpStatus: 404 });
    });

    it('`DEC-033`: con servicio de cotización manual la cita se crea SIN anticipo automático', async () => {
      // No es un error: si lanzara, ningún servicio de precio variable podría venderse a una
      // clienta de lista roja. El monto lo registra después la Encargada.
      const manual = servicioDePrueba({ id: SERVICIO, requiereCotizacionManual: true });
      const { agendar, crearClienta, consultarAnticipos } = await preparar({ catalogo: crearContextoCatalogoFalso([manual]) });
      const clienta = await crearClienta('Lucía Martínez', '4422223344', true);

      const cita = await agendar.ejecutar(reserva(clienta.id), DUEÑA);

      expect(cita.estado).toBe('en_espera_pago');
      await expect(consultarAnticipos.deCita({ citaId: cita.id })).rejects.toMatchObject({ httpStatus: 404 });
    });

    it('y entonces la Encargada lo registra con monto explícito', async () => {
      const manual = servicioDePrueba({ id: SERVICIO, requiereCotizacionManual: true });
      const { agendar, crearClienta, generarAnticipo, consultarAnticipos } = await preparar({
        catalogo: crearContextoCatalogoFalso([manual]),
      });
      const clienta = await crearClienta('Lucía Martínez', '4422223344', true);
      const cita = await agendar.ejecutar(reserva(clienta.id), DUEÑA);

      await generarAnticipo.ejecutar({ citaId: cita.id, clientaId: clienta.id, baseCentavos: null, montoCentavos: 25000 }, DUEÑA);

      const anticipo = await consultarAnticipos.deCita({ citaId: cita.id });
      // Sin porcentaje: lo fijó una persona, y un `0` mentiría sobre cómo se calculó.
      expect(anticipo).toMatchObject({ montoCentavos: 25000, porcentajeAplicado: null });
    });
  });

  describe('`RN-ANT-03` — LA CARRERA POR EL HUECO SE RESUELVE AL CONFIRMAR EL PAGO', () => {
    it('UNA SOLA SILLA, DOS CITAS EN `en_espera_pago`: LA PRIMERA EN CONFIRMAR GANA', async () => {
      // El escenario central de `RN-ANT-03`: *"Hasta que se dé el anticipo se agenda, si no el
      // espacio sigue libre"*. Las dos citas coexisten sobre la misma silla porque
      // `en_espera_pago` no ocupa; el cupo se decide al pagar.
      const { agendar, crearClienta, confirmarPago, consultarAnticipos, citaRepo } = await preparar({ sillas: 1 });
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const renata = await crearClienta('Renata Salazar', '4424445566', true);

      const citaDeLucia = await agendar.ejecutar(reserva(lucia.id), DUEÑA);
      const citaDeRenata = await agendar.ejecutar(reserva(renata.id), DUEÑA);
      expect(citaDeLucia.estado).toBe('en_espera_pago');
      expect(citaDeRenata.estado).toBe('en_espera_pago');

      const anticipoDeLucia = await consultarAnticipos.deCita({ citaId: citaDeLucia.id });
      const anticipoDeRenata = await consultarAnticipos.deCita({ citaId: citaDeRenata.id });

      // Lucía paga primero y se queda con el cupo.
      await confirmarPago.ejecutar({ anticipoId: anticipoDeLucia.id, referenciaPago: 'SPEI-001' }, DUEÑA);
      expect((await citaRepo.buscarPorId(citaDeLucia.id))?.estado).toBe('agendada');

      // Renata paga después: ya no hay lugar.
      await expect(confirmarPago.ejecutar({ anticipoId: anticipoDeRenata.id, referenciaPago: 'SPEI-002' }, DUEÑA)).rejects.toMatchObject({
        code: 'HORARIO_NO_DISPONIBLE',
        httpStatus: 409,
      });
    });

    it('Y EL PAGO PERDEDOR NO QUEDA CONFIRMADO: nada de dinero contra una cita sin horario', async () => {
      // Es la razón de que confirmar y activar vayan en la MISMA transacción. Si no, habría un
      // anticipo `pagado` apuntando a una cita que sigue en `en_espera_pago`.
      const { agendar, crearClienta, confirmarPago, consultarAnticipos, citaRepo, anticipoRepo } = await preparar({ sillas: 1 });
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const renata = await crearClienta('Renata Salazar', '4424445566', true);
      const citaDeLucia = await agendar.ejecutar(reserva(lucia.id), DUEÑA);
      const citaDeRenata = await agendar.ejecutar(reserva(renata.id), DUEÑA);

      await confirmarPago.ejecutar(
        { anticipoId: (await consultarAnticipos.deCita({ citaId: citaDeLucia.id })).id, referenciaPago: 'SPEI-001' },
        DUEÑA,
      );
      const perdedor = await consultarAnticipos.deCita({ citaId: citaDeRenata.id });
      await expect(confirmarPago.ejecutar({ anticipoId: perdedor.id, referenciaPago: 'SPEI-002' }, DUEÑA)).rejects.toBeDefined();

      // Todo deshecho: el anticipo sigue pendiente y la cita en espera.
      expect((await anticipoRepo.buscarPorId(perdedor.id))?.estado).toBe('pendiente');
      expect((await anticipoRepo.buscarPorId(perdedor.id))?.referenciaPago).toBeNull();
      expect((await citaRepo.buscarPorId(citaDeRenata.id))?.estado).toBe('en_espera_pago');
    });

    it('CON DOS SILLAS LAS DOS GANAN: reasigna silla antes que rechazar el pago', async () => {
      // La clienta nunca eligió silla (`DEC-031`), así que moverla es invisible — y rechazar una
      // transferencia ya hecha teniendo la silla de al lado vacía sería absurdo.
      const { agendar, crearClienta, confirmarPago, consultarAnticipos, citaRepo } = await preparar({ sillas: 2 });
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const renata = await crearClienta('Renata Salazar', '4424445566', true);
      const citaDeLucia = await agendar.ejecutar(reserva(lucia.id), DUEÑA);
      const citaDeRenata = await agendar.ejecutar(reserva(renata.id), DUEÑA);

      await confirmarPago.ejecutar(
        { anticipoId: (await consultarAnticipos.deCita({ citaId: citaDeLucia.id })).id, referenciaPago: 'SPEI-001' },
        DUEÑA,
      );
      await confirmarPago.ejecutar(
        { anticipoId: (await consultarAnticipos.deCita({ citaId: citaDeRenata.id })).id, referenciaPago: 'SPEI-002' },
        DUEÑA,
      );

      const unaFinal = await citaRepo.buscarPorId(citaDeLucia.id);
      const otraFinal = await citaRepo.buscarPorId(citaDeRenata.id);
      expect(unaFinal?.estado).toBe('agendada');
      expect(otraFinal?.estado).toBe('agendada');
      // Y en sillas distintas, porque ahora sí ocupan.
      expect(unaFinal?.sillaId).not.toBe(otraFinal?.sillaId);
    });

    it('UNA CLIENTA NORMAL PUEDE GANARLE EL HUECO antes de que llegue la transferencia', async () => {
      const { agendar, crearClienta, confirmarPago, consultarAnticipos } = await preparar({ sillas: 1 });
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const andrea = await crearClienta('Andrea Ramírez', '4421112233');

      const citaDeLucia = await agendar.ejecutar(reserva(lucia.id), DUEÑA);
      // Andrea agenda normal y ocupa la única silla.
      await agendar.ejecutar(reserva(andrea.id), DUEÑA);

      const anticipo = await consultarAnticipos.deCita({ citaId: citaDeLucia.id });
      await expect(confirmarPago.ejecutar({ anticipoId: anticipo.id, referenciaPago: 'SPEI-001' }, DUEÑA)).rejects.toMatchObject({
        code: 'HORARIO_NO_DISPONIBLE',
      });
    });

    it('el mensaje de error dice qué hacer: reprogramar y volver a confirmar', async () => {
      const { agendar, crearClienta, confirmarPago, consultarAnticipos } = await preparar({ sillas: 1 });
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const andrea = await crearClienta('Andrea Ramírez', '4421112233');
      const citaDeLucia = await agendar.ejecutar(reserva(lucia.id), DUEÑA);
      await agendar.ejecutar(reserva(andrea.id), DUEÑA);

      const anticipo = await consultarAnticipos.deCita({ citaId: citaDeLucia.id });
      await expect(confirmarPago.ejecutar({ anticipoId: anticipo.id, referenciaPago: 'SPEI-001' }, DUEÑA)).rejects.toMatchObject({
        message: expect.stringContaining('reprograma'),
      });
    });

    it('la referencia de la transferencia es obligatoria', async () => {
      const { agendar, crearClienta, confirmarPago, consultarAnticipos } = await preparar();
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const cita = await agendar.ejecutar(reserva(lucia.id), DUEÑA);
      const anticipo = await consultarAnticipos.deCita({ citaId: cita.id });

      await expect(confirmarPago.ejecutar({ anticipoId: anticipo.id, referenciaPago: '   ' }, DUEÑA)).rejects.toMatchObject({
        code: 'ANTICIPO_REFERENCIA_REQUERIDA',
      });
    });

    it('409 al confirmar dos veces el mismo anticipo', async () => {
      const { agendar, crearClienta, confirmarPago, consultarAnticipos } = await preparar();
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const cita = await agendar.ejecutar(reserva(lucia.id), DUEÑA);
      const anticipo = await consultarAnticipos.deCita({ citaId: cita.id });

      await confirmarPago.ejecutar({ anticipoId: anticipo.id, referenciaPago: 'SPEI-001' }, DUEÑA);
      await expect(confirmarPago.ejecutar({ anticipoId: anticipo.id, referenciaPago: 'SPEI-001' }, DUEÑA)).rejects.toMatchObject({
        code: 'ANTICIPO_TRANSICION_INVALIDA',
      });
    });
  });

  describe('expiración — limpieza, no "liberación automática"', () => {
    it('expirar el anticipo pasa la cita a `expirada`', async () => {
      const { agendar, crearClienta, expirarAnticipo, consultarAnticipos, citaRepo } = await preparar();
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const cita = await agendar.ejecutar(reserva(lucia.id), DUEÑA);
      const anticipo = await consultarAnticipos.deCita({ citaId: cita.id });

      await expirarAnticipo.ejecutar({ anticipoId: anticipo.id, motivo: 'Nunca llegó la transferencia' }, DUEÑA);

      expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('expirada');
    });

    it('y entonces el hueco queda libre para otra clienta', async () => {
      const { agendar, crearClienta, expirarAnticipo, consultarAnticipos } = await preparar({ sillas: 1 });
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const andrea = await crearClienta('Andrea Ramírez', '4421112233');
      const cita = await agendar.ejecutar(reserva(lucia.id), DUEÑA);
      await expirarAnticipo.ejecutar({ anticipoId: (await consultarAnticipos.deCita({ citaId: cita.id })).id }, DUEÑA);

      await expect(agendar.ejecutar(reserva(andrea.id), DUEÑA)).resolves.toMatchObject({ estado: 'agendada' });
    });

    it('409 al expirar un anticipo ya pagado: el dinero ya está', async () => {
      const { agendar, crearClienta, confirmarPago, expirarAnticipo, consultarAnticipos } = await preparar();
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const cita = await agendar.ejecutar(reserva(lucia.id), DUEÑA);
      const anticipo = await consultarAnticipos.deCita({ citaId: cita.id });
      await confirmarPago.ejecutar({ anticipoId: anticipo.id, referenciaPago: 'SPEI-001' }, DUEÑA);

      await expect(expirarAnticipo.ejecutar({ anticipoId: anticipo.id }, DUEÑA)).rejects.toMatchObject({
        code: 'ANTICIPO_TRANSICION_INVALIDA',
      });
    });
  });

  describe('`RN-ANT-04` — nunca hay reembolso', () => {
    const prepararConPagoConfirmado = async () => {
      const contexto = await preparar({ sillas: 2 });
      const lucia = await contexto.crearClienta('Lucía Martínez', '4422223344', true);
      const cita = await contexto.agendar.ejecutar(reserva(lucia.id), DUEÑA);
      const anticipo = await contexto.consultarAnticipos.deCita({ citaId: cita.id });
      await contexto.confirmarPago.ejecutar({ anticipoId: anticipo.id, referenciaPago: 'SPEI-001' }, DUEÑA);
      return { ...contexto, cita, anticipo };
    };

    it('CANCELAR CON ANTICIPO PAGADO lo deja `retenido`, no devuelto', async () => {
      const { cancelar, cita, anticipo, anticipoRepo } = await prepararConPagoConfirmado();

      const resultado = await cancelar.ejecutar({ citaId: cita.id, confirmacionDeEmpleado: true }, DUEÑA, AYER);

      expect(resultado.anticipoRetenido).toBe(true);
      expect((await anticipoRepo.buscarPorId(anticipo.id))?.estado).toBe('retenido');
    });

    it('UN NO-SHOW CON ANTICIPO PAGADO tampoco devuelve nada', async () => {
      const { noShow, cita, anticipo, anticipoRepo } = await prepararConPagoConfirmado();

      await noShow.ejecutar({ citaId: cita.id }, DUEÑA, new Date(DIEZ.getTime() + 30 * 60_000));

      expect((await anticipoRepo.buscarPorId(anticipo.id))?.estado).toBe('retenido');
    });

    it('la retención queda auditada con `sinReembolso`', async () => {
      const { noShow, cita, auditoria } = await prepararConPagoConfirmado();

      await noShow.ejecutar({ citaId: cita.id }, DUEÑA, new Date(DIEZ.getTime() + 30 * 60_000));

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ detalle: expect.objectContaining({ accion: 'retener_anticipo', sinReembolso: true }) }),
      );
    });

    it('CANCELAR CON ANTICIPO PAGADO EXIGE CONFIRMACIÓN EXPLÍCITA, advirtiendo que no hay reembolso', async () => {
      const { cancelar, cita } = await prepararConPagoConfirmado();

      await expect(cancelar.ejecutar({ citaId: cita.id }, DUEÑA, AYER)).rejects.toMatchObject({
        code: 'CANCELACION_REQUIERE_CONFIRMACION',
        httpStatus: 409,
        message: expect.stringContaining('NO se devuelve'),
      });
    });

    it('una cita sin anticipo se cancela sin fricción: la advertencia no es un trámite', async () => {
      const { agendar, crearClienta, cancelar } = await preparar();
      const andrea = await crearClienta('Andrea Ramírez', '4421112233');
      const cita = await agendar.ejecutar(reserva(andrea.id), DUEÑA);

      await expect(cancelar.ejecutar({ citaId: cita.id }, DUEÑA, AYER)).resolves.toMatchObject({ anticipoRetenido: false });
    });

    describe('ventana de 48 horas al reprogramar — ahora por puerto real', () => {
      it('RECHAZA a menos de 48h con anticipo pagado', async () => {
        // Antes esto dependía de un parámetro `anticipoPagado` que el llamante podía poner en
        // `false` para saltarse la regla. Ahora se consulta el estado real.
        const { reprogramar, cita } = await prepararConPagoConfirmado();
        const unDiaAntes = new Date(DIEZ.getTime() - 24 * 3_600_000);

        await expect(
          reprogramar.ejecutar(
            { citaId: cita.id, nuevoInicio: new Date('2026-12-08T10:00:00.000Z'), confirmacionDeEmpleado: true },
            DUEÑA,
            unDiaAntes,
          ),
        ).rejects.toMatchObject({ code: 'REPROGRAMACION_FUERA_DE_PLAZO' });
      });

      it('y ya NO se puede saltar: no existe parámetro que diga "no hay anticipo"', async () => {
        const { reprogramar, cita } = await prepararConPagoConfirmado();
        const unDiaAntes = new Date(DIEZ.getTime() - 24 * 3_600_000);

        // El input ni acepta `anticipoPagado`; lo único que acepta es la confirmación.
        await expect(
          reprogramar.ejecutar({ citaId: cita.id, nuevoInicio: new Date('2026-12-08T10:00:00.000Z') }, DUEÑA, unDiaAntes),
        ).rejects.toMatchObject({ code: 'REPROGRAMACION_FUERA_DE_PLAZO' });
      });

      it('ACEPTA con 72h y confirmación explícita', async () => {
        const { reprogramar, cita } = await prepararConPagoConfirmado();
        const tresDiasAntes = new Date(DIEZ.getTime() - 72 * 3_600_000);

        await expect(
          reprogramar.ejecutar(
            { citaId: cita.id, nuevoInicio: new Date('2026-12-08T10:00:00.000Z'), confirmacionDeEmpleado: true },
            DUEÑA,
            tresDiasAntes,
          ),
        ).resolves.toBeDefined();
      });

      it('con 72h pero SIN confirmación: 409 con la alerta de `RN-ANT-04`', async () => {
        const { reprogramar, cita } = await prepararConPagoConfirmado();
        const tresDiasAntes = new Date(DIEZ.getTime() - 72 * 3_600_000);

        await expect(
          reprogramar.ejecutar({ citaId: cita.id, nuevoInicio: new Date('2026-12-08T10:00:00.000Z') }, DUEÑA, tresDiasAntes),
        ).rejects.toMatchObject({ code: 'REPROGRAMACION_REQUIERE_CONFIRMACION' });
      });

      it('sin anticipo pagado, el plazo de 48h NO aplica', async () => {
        const { agendar, crearClienta, reprogramar } = await preparar({ sillas: 2 });
        const andrea = await crearClienta('Andrea Ramírez', '4421112233');
        const cita = await agendar.ejecutar(reserva(andrea.id), DUEÑA);
        const unaHoraAntes = new Date(DIEZ.getTime() - 3_600_000);

        await expect(
          reprogramar.ejecutar({ citaId: cita.id, nuevoInicio: new Date('2026-12-08T10:00:00.000Z') }, DUEÑA, unaHoraAntes),
        ).resolves.toBeDefined();
      });
    });
  });

  describe('`RN-CRM-03` — cancelación de clienta en lista roja', () => {
    it('EXIGE CONFIRMACIÓN aunque el anticipo siga pendiente', async () => {
      const { agendar, crearClienta, cancelar } = await preparar();
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const cita = await agendar.ejecutar(reserva(lucia.id), DUEÑA);

      await expect(cancelar.ejecutar({ citaId: cita.id }, DUEÑA, AYER)).rejects.toMatchObject({
        code: 'CANCELACION_REQUIERE_CONFIRMACION',
        message: expect.stringContaining('lista roja'),
      });
    });

    it('y con la confirmación se cancela', async () => {
      const { agendar, crearClienta, cancelar, citaRepo } = await preparar();
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const cita = await agendar.ejecutar(reserva(lucia.id), DUEÑA);

      await cancelar.ejecutar({ citaId: cita.id, confirmacionDeEmpleado: true, motivo: 'Lo pidió ella' }, DUEÑA, AYER);

      expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('cancelada');
    });
  });
});
