import { crearBaseDeDatosDePrueba } from '../../database/test-utils/postgres-de-prueba';
import { PlanificadorService } from './application/planificador.service';
import { BarridoDeAnticiposUseCase } from './application/barrido-de-anticipos.use-case';
import { CerrojoDeBarrido } from '../../shared/persistence/advisory-lock';
import { PurgarMensajesUseCase } from '../conversaciones/application/use-cases/purgar-mensajes.use-case';
import {
  CerrarCitasTerminadasUseCase,
  SolicitarRecordatoriosUseCase,
} from '../agenda/application/use-cases/barridos-de-agenda.use-cases';
import { AvanzarTurnoListaEsperaUseCase, ProcesarListaEsperaUseCase } from '../agenda/application/use-cases/lista-espera.use-cases';
import { CompletarCitaUseCase } from '../agenda/application/use-cases/completar-cita.use-case';
import { SolicitarConfirmacionCitaUseCase } from '../agenda/application/use-cases/solicitar-confirmacion-cita.use-case';
import { AgendarCitaUseCase } from '../agenda/application/use-cases/agendar-cita.use-case';
import { DrizzleCitaRepository } from '../agenda/infrastructure/persistence/drizzle-cita.repository';
import { DrizzleSillaRepository } from '../agenda/infrastructure/persistence/drizzle-silla.repository';
import { DrizzleListaEsperaRepository } from '../agenda/infrastructure/persistence/drizzle-lista-espera.repository';
import { Silla } from '../agenda/domain/entities/silla.entity';
import { MotorDisponibilidad } from '../agenda/domain/services/motor-disponibilidad';
import { ResolutorDeServicio } from '../agenda/domain/services/resolutor-de-servicio';
import { NotificadorRecordatorioPort } from '../agenda/domain/ports/notificador-recordatorio.port';
import { NotificacionListaEsperaPort } from '../agenda/domain/ports/notificacion-lista-espera.port';
import { crearContextoPersonalFalso, horarioAbiertoSiempre } from '../agenda/test-utils/contexto-personal-falso';
import { crearCatalogoPorDuraciones } from '../agenda/test-utils/contexto-catalogo-falso';
import { ContextoClientaAdapter } from '../integracion/contexto-clienta.adapter';
import { AnticipoAdapter } from '../integracion/anticipo.adapter';
import { TransicionDeCitaAdapter } from '../integracion/transicion-de-cita.adapter';
import { TransicionarCitaPorAnticipoUseCase } from '../agenda/application/use-cases/transicionar-cita-por-anticipo.use-case';
import { DrizzleClientaRepository } from '../crm-y-clientas/infrastructure/persistence/drizzle-clienta.repository';
import { Clienta } from '../crm-y-clientas/domain/entities/clienta.entity';
import { DrizzleAnticipoRepository } from '../anticipos/infrastructure/persistence/drizzle-anticipo.repository';
import {
  ConfirmarPagoAnticipoUseCase,
  ConsultarAnticiposUseCase,
  ExpirarAnticipoUseCase,
  GenerarAnticipoUseCase,
  RetenerAnticipoUseCase,
} from '../anticipos/application/use-cases/anticipos.use-cases';
import { AuditoriaPort } from '../../shared/auditoria/auditoria.port';
import { ClaimsUsuario, Rol } from '../../shared/auth/rol';
import { DrizzleUnitOfWork } from '../../shared/persistence/drizzle-unit-of-work';
import { SelectorDeSillaLibre } from '../../modules/agenda/domain/services/selector-de-silla';

const DUEÑA: ClaimsUsuario = { sub: 'dueña-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL', manicuristaId: null };
const SUCURSAL = '11111111-1111-4111-8111-111111111111';

const CATALOGO = crearCatalogoPorDuraciones([60]);
const SERVICIO = CATALOGO.idPara(60);

/** 2026-12-07 10:00–11:00 UTC. */
const DIEZ = new Date('2026-12-07T10:00:00.000Z');
const ONCE = new Date('2026-12-07T11:00:00.000Z');
/** Antes de la cita: el barrido de cierre no debe tocar nada. */
const AYER = new Date('2026-12-06T10:00:00.000Z');
/** Después de que la cita terminó. */
const DESPUES = new Date('2026-12-07T12:00:00.000Z');

async function preparar({ sillas = 3 }: { sillas?: number } = {}) {
  const db = await crearBaseDeDatosDePrueba();
  const citaRepo = new DrizzleCitaRepository(db);
  const sillaRepo = new DrizzleSillaRepository(db);
  const listaEsperaRepo = new DrizzleListaEsperaRepository(db);
  const clientaRepo = new DrizzleClientaRepository(db);
  const anticipoRepo = new DrizzleAnticipoRepository(db);
  const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
  const uow = new DrizzleUnitOfWork(db);

  for (let i = 1; i <= sillas; i += 1) {
    await sillaRepo.guardar(Silla.crear({ sucursalId: SUCURSAL, nombre: `Lomas ${i}` }));
  }

  const motor = new MotorDisponibilidad(citaRepo, sillaRepo, crearContextoPersonalFalso({ horario: horarioAbiertoSiempre() }));
  const resolutor = new ResolutorDeServicio(CATALOGO.port);
  const contextoClienta = new ContextoClientaAdapter(clientaRepo);

  const consultarAnticipos = new ConsultarAnticiposUseCase(anticipoRepo);
  const anticipoPort = new AnticipoAdapter(
    consultarAnticipos,
    new GenerarAnticipoUseCase(anticipoRepo, auditoria, uow),
    new RetenerAnticipoUseCase(anticipoRepo, auditoria, uow),
  );
  const transicionarCita = new TransicionarCitaPorAnticipoUseCase(citaRepo, motor, new SelectorDeSillaLibre(sillaRepo, citaRepo), auditoria);
  const transicionPort = new TransicionDeCitaAdapter(transicionarCita);
  const expirarAnticipo = new ExpirarAnticipoUseCase(anticipoRepo, transicionPort, auditoria, uow);

  const notificadorRecordatorio: jest.Mocked<NotificadorRecordatorioPort> = { recordatorioDeCita: jest.fn() };
  const notificacionFila: jest.Mocked<NotificacionListaEsperaPort> = { ofertaDeHueco: jest.fn() };

  const procesarFila = new ProcesarListaEsperaUseCase(listaEsperaRepo, motor, resolutor, notificacionFila, auditoria, uow);
  const completarCita = new CompletarCitaUseCase(citaRepo, auditoria, uow);
  const solicitarConfirmacion = new SolicitarConfirmacionCitaUseCase(citaRepo, auditoria, uow);

  const cerrarCitas = new CerrarCitasTerminadasUseCase(citaRepo, completarCita);
  const recordatorios = new SolicitarRecordatoriosUseCase(citaRepo, solicitarConfirmacion, notificadorRecordatorio);
  const barridoAnticipos = new BarridoDeAnticiposUseCase(citaRepo, consultarAnticipos, expirarAnticipo, transicionarCita);
  const avanzarFila = new AvanzarTurnoListaEsperaUseCase(listaEsperaRepo, procesarFila, auditoria, uow);

  const crearClienta = async (nombre: string, telefono: string, enListaRoja = false) => {
    const clienta = Clienta.registrar({ nombre, telefono });
    if (enListaRoja) clienta.marcarListaRoja();
    await clientaRepo.guardar(clienta);
    return clienta;
  };

  const purgarMensajes = new PurgarMensajesUseCase(db);

  return {
    db,
    citaRepo,
    anticipoRepo,
    auditoria,
    crearClienta,
    consultarAnticipos,
    notificadorRecordatorio,
    cerrarCitas,
    recordatorios,
    barridoAnticipos,
    purgarMensajes,
    agendar: new AgendarCitaUseCase(citaRepo, motor, new SelectorDeSillaLibre(sillaRepo, citaRepo), resolutor, contextoClienta, anticipoPort, auditoria, uow),
    confirmarPago: new ConfirmarPagoAnticipoUseCase(anticipoRepo, transicionPort, auditoria, uow),
    completarCita,
    planificador: new PlanificadorService(new CerrojoDeBarrido(db), avanzarFila, barridoAnticipos, cerrarCitas, recordatorios, purgarMensajes),
    cerrojo: new CerrojoDeBarrido(db),
  };
}

const reserva = (clientaId: string, inicio = DIEZ) => ({ sucursalId: SUCURSAL, servicioId: SERVICIO, clientaId, inicio });

describe('Planificador operativo — ADR-025 (integración, PostgreSQL real)', () => {
  describe('barrido (c) — cierre automático de citas pasadas', () => {
    it('CIERRA las citas activas cuyo horario ya terminó', async () => {
      const { agendar, crearClienta, cerrarCitas, citaRepo } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');
      const cita = await agendar.ejecutar(reserva(clienta.id), DUEÑA);

      const resumen = await cerrarCitas.ejecutar(DUEÑA, DESPUES);

      expect(resumen).toMatchObject({ procesados: 1, fallidos: 0 });
      expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('completada');
    });

    it('NO TOCA una cita que todavía no ha terminado', async () => {
      const { agendar, crearClienta, cerrarCitas, citaRepo } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');
      const cita = await agendar.ejecutar(reserva(clienta.id), DUEÑA);

      const resumen = await cerrarCitas.ejecutar(DUEÑA, AYER);

      expect(resumen.procesados).toBe(0);
      expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('agendada');
    });

    it('en el instante `fin` exacto YA cuenta como terminada (el rango es `[inicio, fin)`)', async () => {
      const { agendar, crearClienta, cerrarCitas, citaRepo } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');
      const cita = await agendar.ejecutar(reserva(clienta.id), DUEÑA);

      await cerrarCitas.ejecutar(DUEÑA, ONCE);

      expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('completada');
    });

    it('IDEMPOTENTE: la segunda corrida no encuentra nada', async () => {
      const { agendar, crearClienta, cerrarCitas } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');
      await agendar.ejecutar(reserva(clienta.id), DUEÑA);

      expect((await cerrarCitas.ejecutar(DUEÑA, DESPUES)).procesados).toBe(1);
      expect((await cerrarCitas.ejecutar(DUEÑA, DESPUES)).procesados).toBe(0);
    });

    it('CERRAR NO IMPIDE CORREGIR: `completada → no_show` sigue siendo legal (`N-02`)', async () => {
      // Es lo que hace aceptable cerrar automáticamente algo que el sistema no puede saber:
      // nadie le dijo que la clienta entró por la puerta. Si no se presentó, la Encargada aún
      // puede marcarlo.
      const { agendar, crearClienta, cerrarCitas, citaRepo } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');
      const cita = await agendar.ejecutar(reserva(clienta.id), DUEÑA);
      await cerrarCitas.ejecutar(DUEÑA, DESPUES);

      const cerrada = (await citaRepo.buscarPorId(cita.id))!;
      expect(() => cerrada.cambiarEstado('no_show')).not.toThrow();
    });

    it('UN ELEMENTO QUE FALLA NO ABORTA EL LOTE', async () => {
      // La regla que más importa de los barridos: con el orden por antigüedad, detenerse en el
      // primer error dejaría sin procesar justo lo más urgente.
      const { agendar, crearClienta, cerrarCitas, completarCita, citaRepo } = await preparar();
      const una = await crearClienta('Andrea Ramírez', '4421112233');
      const otra = await crearClienta('Carmen Aguilar', '4422223344');
      const primera = await agendar.ejecutar(reserva(una.id), DUEÑA);
      const segunda = await agendar.ejecutar(reserva(otra.id, ONCE), DUEÑA);

      const original = completarCita.ejecutar.bind(completarCita);
      jest
        .spyOn(completarCita, 'ejecutar')
        .mockImplementation(async (input, actor) =>
          input.citaId === primera.id ? Promise.reject(new Error('fallo simulado')) : original(input, actor),
        );

      const resumen = await cerrarCitas.ejecutar(DUEÑA, DESPUES);

      expect(resumen).toMatchObject({ procesados: 1, fallidos: 1, idsFallidos: [primera.id] });
      // La que venía detrás SÍ se procesó.
      expect((await citaRepo.buscarPorId(segunda.id))?.estado).toBe('completada');
      expect((await citaRepo.buscarPorId(primera.id))?.estado).toBe('agendada');
    });

    it('el lote está acotado: con `limite` 1 procesa una y deja el resto al siguiente tick', async () => {
      const { agendar, crearClienta, cerrarCitas } = await preparar();
      const una = await crearClienta('Andrea Ramírez', '4421112233');
      const otra = await crearClienta('Carmen Aguilar', '4422223344');
      await agendar.ejecutar(reserva(una.id), DUEÑA);
      await agendar.ejecutar(reserva(otra.id, ONCE), DUEÑA);

      expect((await cerrarCitas.ejecutar(DUEÑA, DESPUES, 1)).procesados).toBe(1);
      expect((await cerrarCitas.ejecutar(DUEÑA, DESPUES, 1)).procesados).toBe(1);
      expect((await cerrarCitas.ejecutar(DUEÑA, DESPUES, 1)).procesados).toBe(0);
    });
  });

  describe('barrido (d) — recordatorio 24 h antes', () => {
    it('pasa la cita a `pendiente_confirmacion` Y emite el aviso por el puerto', async () => {
      const { agendar, crearClienta, recordatorios, citaRepo, notificadorRecordatorio } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');
      const cita = await agendar.ejecutar(reserva(clienta.id), DUEÑA);

      // 20 horas antes: dentro de la ventana de 24.
      const resumen = await recordatorios.ejecutar(DUEÑA, new Date(DIEZ.getTime() - 20 * 3_600_000));

      expect(resumen.procesados).toBe(1);
      expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('pendiente_confirmacion');
      expect(notificadorRecordatorio.recordatorioDeCita).toHaveBeenCalledTimes(1);
    });

    it('NO recuerda una cita a 30 horas: está fuera de la ventana', async () => {
      const { agendar, crearClienta, recordatorios, notificadorRecordatorio } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');
      await agendar.ejecutar(reserva(clienta.id), DUEÑA);

      const resumen = await recordatorios.ejecutar(DUEÑA, new Date(DIEZ.getTime() - 30 * 3_600_000));

      expect(resumen.procesados).toBe(0);
      expect(notificadorRecordatorio.recordatorioDeCita).not.toHaveBeenCalled();
    });

    it('NO recuerda una cita que ya pasó: la ventana no mira hacia atrás', async () => {
      const { agendar, crearClienta, recordatorios } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');
      await agendar.ejecutar(reserva(clienta.id), DUEÑA);

      expect((await recordatorios.ejecutar(DUEÑA, DESPUES)).procesados).toBe(0);
    });

    it('IDEMPOTENTE SIN COLUMNA DE "YA RECORDADA": el estado lo garantiza', async () => {
      // La consulta pide `agendada` y la acción la saca de ese estado, así que una segunda
      // corrida no la vuelve a encontrar.
      const { agendar, crearClienta, recordatorios, notificadorRecordatorio } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');
      await agendar.ejecutar(reserva(clienta.id), DUEÑA);
      const veinteHorasAntes = new Date(DIEZ.getTime() - 20 * 3_600_000);

      expect((await recordatorios.ejecutar(DUEÑA, veinteHorasAntes)).procesados).toBe(1);
      expect((await recordatorios.ejecutar(DUEÑA, veinteHorasAntes)).procesados).toBe(0);
      expect(notificadorRecordatorio.recordatorioDeCita).toHaveBeenCalledTimes(1);
    });

    it('un fallo de ENVÍO no aborta el lote y la cita queda en `pendiente_confirmacion`', async () => {
      // Lado seguro del error: mejor una cita en `pendiente_confirmacion` sin aviso —visible para
      // la Encargada, que puede llamar— que una clienta avisada de algo que se revirtió.
      const { agendar, crearClienta, recordatorios, citaRepo, notificadorRecordatorio } = await preparar();
      const clienta = await crearClienta('Andrea Ramírez', '4421112233');
      const cita = await agendar.ejecutar(reserva(clienta.id), DUEÑA);
      notificadorRecordatorio.recordatorioDeCita.mockRejectedValueOnce(new Error('canal caído'));

      const resumen = await recordatorios.ejecutar(DUEÑA, new Date(DIEZ.getTime() - 20 * 3_600_000));

      expect(resumen).toMatchObject({ procesados: 0, fallidos: 1 });
      expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('pendiente_confirmacion');
    });
  });

  describe('barrido (b) — expiración de anticipos', () => {
    const prepararConAnticipoPendiente = async () => {
      const contexto = await preparar();
      const lucia = await contexto.crearClienta('Lucía Martínez', '4422223344', true);
      const cita = await contexto.agendar.ejecutar(reserva(lucia.id), DUEÑA);
      const anticipo = await contexto.consultarAnticipos.deCita({ citaId: cita.id });
      return { ...contexto, cita, anticipo };
    };

    it('EXPIRA el anticipo y la cita cuando la hora de la cita ya llegó sin pago', async () => {
      const { barridoAnticipos, cita, anticipo, citaRepo, anticipoRepo } = await prepararConAnticipoPendiente();
      expect(cita.estado).toBe('en_espera_pago');

      const resumen = await barridoAnticipos.ejecutar(DUEÑA, DESPUES);

      expect(resumen).toMatchObject({ procesados: 1, fallidos: 0 });
      expect((await anticipoRepo.buscarPorId(anticipo.id))?.estado).toBe('expirado');
      expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('expirada');
    });

    it('NO expira antes de la hora de la cita: el anticipo aún puede llegar', async () => {
      const { barridoAnticipos, anticipo, anticipoRepo } = await prepararConAnticipoPendiente();

      expect((await barridoAnticipos.ejecutar(DUEÑA, AYER)).procesados).toBe(0);
      expect((await anticipoRepo.buscarPorId(anticipo.id))?.estado).toBe('pendiente');
    });

    it('NO toca un anticipo YA PAGADO: la cita está `agendada`, no en espera', async () => {
      const { barridoAnticipos, confirmarPago, anticipo, anticipoRepo, citaRepo, cita } = await prepararConAnticipoPendiente();
      await confirmarPago.ejecutar({ anticipoId: anticipo.id, referenciaPago: 'SPEI-001' }, DUEÑA);

      expect((await barridoAnticipos.ejecutar(DUEÑA, DESPUES)).procesados).toBe(0);
      expect((await anticipoRepo.buscarPorId(anticipo.id))?.estado).toBe('pagado');
      expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('agendada');
    });

    it('IDEMPOTENTE: la segunda corrida no encuentra nada', async () => {
      const { barridoAnticipos } = await prepararConAnticipoPendiente();

      expect((await barridoAnticipos.ejecutar(DUEÑA, DESPUES)).procesados).toBe(1);
      expect((await barridoAnticipos.ejecutar(DUEÑA, DESPUES)).procesados).toBe(0);
    });

    it('EXPIRA UNA CITA HUÉRFANA: `en_espera_pago` SIN fila de anticipo (deuda cerrada)', async () => {
      // Pasa de verdad: clienta en lista roja + servicio de cotización manual (`DEC-033`) cuyo
      // anticipo nadie registró a mano. Antes, esa cita se quedaba en `en_espera_pago` para
      // siempre, porque el barrido buscaba un anticipo que nunca hubo.
      const { agendar, crearClienta, barridoAnticipos, citaRepo, consultarAnticipos, db } = await preparar();
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const cita = await agendar.ejecutar(reserva(lucia.id), DUEÑA);
      // Se borra el anticipo generado para reproducir el caso huérfano.
      const anticipo = await consultarAnticipos.deCita({ citaId: cita.id });
      await db.execute(`DELETE FROM anticipos.anticipos WHERE id = '${anticipo.id}'` as unknown as never);
      await expect(consultarAnticipos.buscarDeCita(cita.id)).resolves.toBeNull();

      const resumen = await barridoAnticipos.ejecutar(DUEÑA, DESPUES);

      expect(resumen).toMatchObject({ procesados: 1, fallidos: 0 });
      // El invariante que importa: NINGUNA cita se queda en `en_espera_pago` indefinidamente.
      expect((await citaRepo.buscarPorId(cita.id))?.estado).toBe('expirada');
    });

    it('y el hueco de la huérfana también queda libre', async () => {
      const { agendar, crearClienta, barridoAnticipos, consultarAnticipos, db } = await preparar({ sillas: 1 });
      const lucia = await crearClienta('Lucía Martínez', '4422223344', true);
      const cita = await agendar.ejecutar(reserva(lucia.id), DUEÑA);
      const anticipo = await consultarAnticipos.deCita({ citaId: cita.id });
      await db.execute(`DELETE FROM anticipos.anticipos WHERE id = '${anticipo.id}'` as unknown as never);

      await barridoAnticipos.ejecutar(DUEÑA, DESPUES);

      const andrea = await crearClienta('Andrea Ramírez', '4421112233');
      await expect(agendar.ejecutar(reserva(andrea.id), DUEÑA)).resolves.toMatchObject({ estado: 'agendada' });
    });

    it('y el hueco queda libre para otra clienta', async () => {
      const { barridoAnticipos, agendar, crearClienta } = await prepararConAnticipoPendiente();
      await barridoAnticipos.ejecutar(DUEÑA, DESPUES);
      const andrea = await crearClienta('Andrea Ramírez', '4421112233');

      await expect(agendar.ejecutar(reserva(andrea.id), DUEÑA)).resolves.toMatchObject({ estado: 'agendada' });
    });
  });

  describe('cerrojo de exclusión mutua (`pg_try_advisory_lock`)', () => {
    it('ejecuta el trabajo y libera el cerrojo al terminar', async () => {
      const { cerrojo } = await preparar();

      await expect(cerrojo.conCerrojo(9_900_001, 'prueba', async () => 'hecho')).resolves.toBe('hecho');
      // Si no se hubiera liberado, la segunda llamada devolvería `null`.
      await expect(cerrojo.conCerrojo(9_900_001, 'prueba', async () => 'otra vez')).resolves.toBe('otra vez');
    });

    it('LIBERA EL CERROJO AUNQUE EL TRABAJO LANCE', async () => {
      // Sin el `finally`, un fallo dejaría el cerrojo tomado hasta que muriera el proceso y el
      // barrido no volvería a correr nunca — un apagado silencioso.
      const { cerrojo } = await preparar();

      await expect(
        cerrojo.conCerrojo(9_900_002, 'prueba', async () => {
          throw new Error('fallo dentro del cerrojo');
        }),
      ).rejects.toThrow('fallo dentro del cerrojo');

      await expect(cerrojo.conCerrojo(9_900_002, 'prueba', async () => 'disponible')).resolves.toBe('disponible');
    });

    it('DEVUELVE `null` SIN EJECUTAR si OTRA SESIÓN tiene el cerrojo', async () => {
      // Simula la segunda instancia de Railway: una conexión distinta toma el cerrojo primero.
      const { db, cerrojo } = await preparar();
      const otraInstancia = await db.$client.reserve();

      try {
        const [{ tomado }] = await otraInstancia<{ tomado: boolean }[]>`SELECT pg_try_advisory_lock(${9_900_003}) AS tomado`;
        expect(tomado).toBe(true);

        let seEjecuto = false;
        const resultado = await cerrojo.conCerrojo(9_900_003, 'externo', async () => {
          seEjecuto = true;
          return 'no deberia';
        });

        expect(resultado).toBeNull();
        // Lo importante: **no se ejecutó**, no solo que devolviera `null`.
        expect(seEjecuto).toBe(false);
      } finally {
        await otraInstancia`SELECT pg_advisory_unlock(${9_900_003})`;
        otraInstancia.release();
      }
    });

    it('EL LOCK Y EL UNLOCK OCURREN EN LA MISMA SESIÓN: tras 10 ciclos sigue disponible', async () => {
      // El defecto que esto atrapa: con el cerrojo pedido por el pool, el `unlock` podía caer en
      // otra conexión y dejar el cerrojo original tomado para siempre. Con un pool de 5, diez
      // ciclos bastan para que las conexiones roten y el fallo aparezca.
      const { cerrojo } = await preparar();

      for (let i = 0; i < 10; i += 1) {
        await expect(cerrojo.conCerrojo(9_900_004, 'ciclos', async () => i)).resolves.toBe(i);
      }
    });
  });

  describe('`PlanificadorService` — despacho por nombre', () => {
    it('despacha los cuatro barridos y devuelve su resumen', async () => {
      const { planificador } = await preparar();

      for (const nombre of ['lista_espera', 'anticipos', 'cierre_de_citas', 'recordatorios'] as const) {
        await expect(planificador.ejecutarBarrido(nombre, DUEÑA, DESPUES)).resolves.toMatchObject({
          procesados: expect.any(Number),
          fallidos: expect.any(Number),
        });
      }
    });

    it('el cron está DESACTIVADO en pruebas: un barrido no debe dispararse solo', async () => {
      // `global-setup.js` pone `PLANIFICADOR_ACTIVO=false`. Sin esto, un tick corrompería los
      // escenarios de las pruebas de integración de forma intermitente.
      const { planificador } = await preparar();
      expect(planificador.estaActivo).toBe(false);
    });
  });
});
