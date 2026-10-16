import { crearBaseDeDatosDePrueba } from '../../database/test-utils/postgres-de-prueba';
import { OrquestadorDeBotUseCase, RESPUESTAS } from './application/orquestador-de-bot.use-case';
import { HerramientasDelBot } from './application/herramientas-del-bot';
import { AgenteDeterministicoAdapter } from './infrastructure/llm/agente-deterministico.adapter';
import { AgenteConversacionalPort } from './domain/agente-conversacional.port';
import { CONFIANZA_MINIMA, Intencion } from './domain/intencion';
import { detectarEscalamientoPorTexto, FRASES_DE_ESCALAMIENTO, normalizarTexto } from './domain/deteccion-de-escalamiento';

import { Conversacion } from '../conversaciones/domain/entities/conversacion.entity';
import { DrizzleConversacionRepository } from '../conversaciones/infrastructure/persistence/drizzle-conversacion.repository';
import { WhatsAppSoloLogAdapter } from '../conversaciones/infrastructure/meta/whatsapp-solo-log.adapter';
import { EnviarMensajeDelBotUseCase } from '../conversaciones/application/use-cases/enviar-mensaje-del-bot.use-case';
import {
  CambiarModoConversacionUseCase,
  ContarEscaladasPendientesUseCase,
  EnviarPlantillaUseCase,
} from '../conversaciones/application/use-cases/bandeja.use-cases';
import { ACUSE_DE_MEDIO_NO_PROCESABLE, RecibirMensajeUseCase } from '../conversaciones/application/use-cases/recibir-mensaje.use-case';
import { NotificadorEscalamientoPort } from '../conversaciones/domain/ports/notificador-escalamiento.port';
import { ContextoClientaDeConversacionAdapter } from '../integracion/contexto-clienta-de-conversacion.adapter';
import { ContextoCatalogoAdapter } from '../integracion/contexto-catalogo.adapter';
import { ContextoClientaAdapter } from '../integracion/contexto-clienta.adapter';

import { DrizzleServicioRepository } from '../catalogo-y-cotizacion/infrastructure/persistence/drizzle-servicio.repository';
import { Servicio } from '../catalogo-y-cotizacion/domain/entities/servicio.entity';
import { ObtenerServiciosUseCase } from '../catalogo-y-cotizacion/application/use-cases/obtener-servicios.use-case';

import { DrizzleCitaRepository } from '../agenda/infrastructure/persistence/drizzle-cita.repository';
import { DrizzleSillaRepository } from '../agenda/infrastructure/persistence/drizzle-silla.repository';
import { DrizzleListaEsperaRepository } from '../agenda/infrastructure/persistence/drizzle-lista-espera.repository';
import { Silla } from '../agenda/domain/entities/silla.entity';
import { MotorDisponibilidad } from '../agenda/domain/services/motor-disponibilidad';
import { ResolutorDeServicio } from '../agenda/domain/services/resolutor-de-servicio';
import { AgendarCitaUseCase } from '../agenda/application/use-cases/agendar-cita.use-case';
import { ConfirmarCitaUseCase } from '../agenda/application/use-cases/confirmar-cita.use-case';
import { SolicitarConfirmacionCitaUseCase } from '../agenda/application/use-cases/solicitar-confirmacion-cita.use-case';
import { ConsultarDisponibilidadUseCase } from '../agenda/application/use-cases/consultar-disponibilidad.use-case';
import {
  AceptarOfertaListaEsperaUseCase,
  InscribirEnListaEsperaUseCase,
} from '../agenda/application/use-cases/lista-espera.use-cases';
import { crearContextoPersonalFalso, horarioAbiertoSiempre } from '../agenda/test-utils/contexto-personal-falso';

import { DrizzleClientaRepository } from '../crm-y-clientas/infrastructure/persistence/drizzle-clienta.repository';
import { Clienta } from '../crm-y-clientas/domain/entities/clienta.entity';

import { DrizzleAnticipoRepository } from '../anticipos/infrastructure/persistence/drizzle-anticipo.repository';
import {
  ConsultarAnticiposUseCase,
  GenerarAnticipoUseCase,
  RetenerAnticipoUseCase,
} from '../anticipos/application/use-cases/anticipos.use-cases';
import { AnticipoAdapter } from '../integracion/anticipo.adapter';

import { AuditoriaPort } from '../../shared/auditoria/auditoria.port';
import { ClaimsUsuario, Rol } from '../../shared/auth/rol';
import { DrizzleUnitOfWork } from '../../shared/persistence/drizzle-unit-of-work';

const SUCURSAL = '11111111-1111-4111-8111-111111111111';
const NUMERO = 'pn-lomas-001';
const TELEFONO = '4421112233';
const SISTEMA: ClaimsUsuario = { sub: 'sistema', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL', manicuristaId: null };

/** Lunes. La hora de pared se escribe como `-06:00` porque es lo que diría la clienta. */
const FECHA = '2027-03-08';
const AHORA = new Date('2027-03-08T16:00:00.000Z'); // 10:00 en Querétaro

/**
 * El bot **completo**, contra PostgreSQL real y con los casos de uso reales de los cinco BC.
 *
 * ## POR QUÉ NO SE SIMULA NINGUNA HERRAMIENTA
 *
 * Lo que este archivo tiene que demostrar es precisamente que el bot **no inventa nada**: que el
 * precio que dice sale de la tabla de servicios, que la cita que agenda aparece en
 * `agenda.citas`, y que una regla de negocio que el bot no puede evaluar acaba en una persona.
 * Con herramientas dobladas, todo eso sería una afirmación sobre los dobles.
 *
 * El **único** doble es el intérprete cuando una prueba necesita forzar una intención o una
 * confianza concreta. El adaptador por defecto es el determinista real.
 */
async function preparar(opciones: { interprete?: AgenteConversacionalPort; sillas?: number } = {}) {
  const db = await crearBaseDeDatosDePrueba();
  const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
  const uow = new DrizzleUnitOfWork(db);

  const conversacionRepo = new DrizzleConversacionRepository(db);
  const citaRepo = new DrizzleCitaRepository(db);
  const sillaRepo = new DrizzleSillaRepository(db);
  const listaEsperaRepo = new DrizzleListaEsperaRepository(db);
  const clientaRepo = new DrizzleClientaRepository(db);
  const servicioRepo = new DrizzleServicioRepository(db);
  const anticipoRepo = new DrizzleAnticipoRepository(db);

  for (let i = 1; i <= (opciones.sillas ?? 2); i += 1) {
    await sillaRepo.guardar(Silla.crear({ sucursalId: SUCURSAL, nombre: `Lomas ${i}` }));
  }
  await conversacionRepo.registrarNumeroDeSucursal({ phoneNumberId: NUMERO, sucursalId: SUCURSAL, telefonoVisible: '4420000001' });

  // Catálogo real: estos son los precios que el bot tendrá que repetir, y los únicos.
  const gelish = Servicio.crear({ nombre: 'Gelish manos', categoria: 'manos', duracionBaseMinutos: 60, precioBaseCentavos: 45000 });
  const diseno = Servicio.crear({
    nombre: 'Diseño artístico',
    categoria: 'manos',
    duracionBaseMinutos: 90,
    precioBaseCentavos: 80000,
    requiereCotizacionManual: true,
  });
  await servicioRepo.guardar(gelish);
  await servicioRepo.guardar(diseno);

  const motor = new MotorDisponibilidad(citaRepo, sillaRepo, crearContextoPersonalFalso({ horario: horarioAbiertoSiempre() }));
  const resolutor = new ResolutorDeServicio(new ContextoCatalogoAdapter(servicioRepo));
  const contextoClienta = new ContextoClientaAdapter(clientaRepo);

  const consultarAnticipos = new ConsultarAnticiposUseCase(anticipoRepo);
  const anticipoPort = new AnticipoAdapter(
    consultarAnticipos,
    new GenerarAnticipoUseCase(anticipoRepo, auditoria, uow),
    new RetenerAnticipoUseCase(anticipoRepo, auditoria, uow),
  );

  const agendar = new AgendarCitaUseCase(citaRepo, sillaRepo, motor, resolutor, contextoClienta, anticipoPort, auditoria, uow);

  const herramientas = new HerramientasDelBot(
    conversacionRepo,
    citaRepo,
    listaEsperaRepo,
    clientaRepo,
    new ObtenerServiciosUseCase(servicioRepo),
    new ConsultarDisponibilidadUseCase(motor),
    agendar,
    new ConfirmarCitaUseCase(citaRepo, auditoria, uow),
    new InscribirEnListaEsperaUseCase(listaEsperaRepo, resolutor, contextoClienta, auditoria, uow),
    new AceptarOfertaListaEsperaUseCase(listaEsperaRepo, agendar, auditoria, uow),
    consultarAnticipos,
  );

  const whatsapp = new WhatsAppSoloLogAdapter();
  const espiaTexto = jest.spyOn(whatsapp, 'enviarTexto');
  const enviarDelBot = new EnviarMensajeDelBotUseCase(conversacionRepo, whatsapp, uow);
  const cambiarModo = new CambiarModoConversacionUseCase(conversacionRepo, auditoria, uow);

  const orquestador = new OrquestadorDeBotUseCase(
    opciones.interprete ?? new AgenteDeterministicoAdapter(),
    herramientas,
    enviarDelBot,
    cambiarModo,
    auditoria,
  );

  const notificador: jest.Mocked<NotificadorEscalamientoPort> = { conversacionNecesitaHumano: jest.fn() };

  const recibir = new RecibirMensajeUseCase(
    conversacionRepo,
    new ContextoClientaDeConversacionAdapter(clientaRepo),
    notificador,
    enviarDelBot,
    orquestador,
    auditoria,
    uow,
  );

  const crearClienta = async (nombre: string, telefono = TELEFONO, estado?: 'lista_roja' | 'bloqueada') => {
    const clienta = Clienta.registrar({ nombre, telefono });
    if (estado === 'lista_roja') clienta.marcarListaRoja();
    if (estado === 'bloqueada') clienta.marcarBloqueada();
    await clientaRepo.guardar(clienta);
    return clienta;
  };

  /** Simula un mensaje entrante tal como lo entregaría el webhook de Meta. */
  let contador = 0;
  const entra = (texto: string | null, extra: { tipo?: 'texto' | 'no_soportado'; tipoCrudoDeMeta?: string } = {}) => {
    contador += 1;
    return recibir.ejecutar({
      phoneNumberId: NUMERO,
      telefonoClienta: TELEFONO,
      wamid: `wamid.TEST${contador}`,
      tipo: extra.tipo ?? 'texto',
      contenido: texto,
      tipoCrudoDeMeta: extra.tipoCrudoDeMeta,
      ocurridoEn: AHORA,
    });
  };

  return {
    db,
    auditoria,
    espiaTexto,
    notificador,
    conversacionRepo,
    citaRepo,
    listaEsperaRepo,
    servicios: { gelish, diseno },
    herramientas,
    orquestador,
    agendar,
    cambiarModo,
    // El mismo caso de uso que usa el barrido de recordatorios del planificador: así la cita llega
    // a `pendiente_confirmacion` por la vía real y no mutando la entidad a mano.
    solicitarConfirmacion: new SolicitarConfirmacionCitaUseCase(citaRepo, auditoria, uow),
    inscribirEnFila: new InscribirEnListaEsperaUseCase(listaEsperaRepo, resolutor, contextoClienta, auditoria, uow),
    crearClienta,
    entra,
    recibir,
    enviarPlantilla: new EnviarPlantillaUseCase(conversacionRepo, whatsapp, auditoria, uow),
    contarEscaladas: new ContarEscaladasPendientesUseCase(conversacionRepo),
    conversacion: async (): Promise<Conversacion> => {
      const encontrada = await conversacionRepo.buscarPorSucursalYTelefono(SUCURSAL, TELEFONO);
      if (!encontrada) throw new Error('La conversación no existe.');
      return encontrada;
    },
    ultimoTextoEnviado: () => espiaTexto.mock.calls.at(-1)?.[0].texto ?? null,
  };
}

/** Intérprete doblado: devuelve la intención que la prueba necesita, sin modelo ni patrones. */
const interpreteFijo = (intencion: Intencion): AgenteConversacionalPort => ({
  interpretar: jest.fn().mockResolvedValue(intencion),
});

describe('Agente Conversacional (Bot IA) — integración con PostgreSQL real', () => {
  describe('la frontera determinista: el filtro de frases corre ANTES del modelo', () => {
    it('ESCALA por pedir cancelar SIN CONSULTAR AL MODELO', async () => {
      // `DEC-040`: ninguna clienta cancela sola con el bot. Y el modelo no se consulta, porque
      // equivocarse aquí significa que la clienta cree que canceló y el salón la espera.
      const interprete = interpreteFijo({ tipo: 'saludo', confianza: 1 });
      const { entra, crearClienta, conversacion } = await preparar({ interprete });
      await crearClienta('Ana');

      const resultado = await entra('Hola, quiero cancelar mi cita de mañana');

      expect(resultado.escalada).toBe(true);
      expect((await conversacion()).modo).toBe('humano');
      expect((await conversacion()).motivoDeEscalamiento).toBe('cancelacion_solicitada');
      // La prueba de que el filtro corre primero: el intérprete no se llegó a invocar.
      expect(interprete.interpretar).not.toHaveBeenCalled();
    });

    it('ESCALA por pedir hablar con una persona, y tampoco consulta al modelo', async () => {
      const interprete = interpreteFijo({ tipo: 'saludo', confianza: 1 });
      const { entra, crearClienta, conversacion } = await preparar({ interprete });
      await crearClienta('Ana');

      await entra('prefiero hablar con una persona por favor');

      expect((await conversacion()).motivoDeEscalamiento).toBe('solicitud_humana');
      expect(interprete.interpretar).not.toHaveBeenCalled();
    });

    it('el filtro IGNORA ACENTOS Y MAYÚSCULAS', () => {
      // Sin normalizar, "PÉSIMO" y "pesimo" serían frases distintas y la lista tendría que
      // enumerar cada variante de tilde — que es exactamente como se cuela un caso sin cubrir.
      expect(detectarEscalamientoPorTexto('EL SERVICIO FUE PÉSIMO')).toBe('queja_o_reclamo');
      expect(detectarEscalamientoPorTexto('el servicio fue pesimo')).toBe('queja_o_reclamo');
      expect(normalizarTexto('CANCELACIÓN')).toBe('cancelacion');
    });

    it('un mensaje normal NO dispara el filtro', () => {
      expect(detectarEscalamientoPorTexto('hola, quiero agendar gelish')).toBeNull();
    });

    it('el catálogo de frases cubre las tres categorías que `DEC-040` obliga a escalar', () => {
      // Lo que es configurable son las frases; **qué categorías escalan no lo es**.
      expect(Object.keys(FRASES_DE_ESCALAMIENTO)).toEqual(
        expect.arrayContaining(['cancelacion_solicitada', 'solicitud_humana', 'queja_o_reclamo']),
      );
    });
  });

  describe('`RN-CONV-05` — degradación a humano ante baja confianza', () => {
    it('ESCALA cuando el modelo responde por debajo del umbral, aunque la intención sea atendible', async () => {
      const { entra, crearClienta, conversacion } = await preparar({
        interprete: interpreteFijo({ tipo: 'agendar', confianza: CONFIANZA_MINIMA - 0.01, fecha: FECHA, hora: '11:00' }),
      });
      await crearClienta('Ana');

      await entra('mmm no se, algo para el lunes quizas');

      expect((await conversacion()).motivoDeEscalamiento).toBe('baja_confianza_ia');
    });

    it('el adaptador determinista devuelve confianza 0 ante lo que no reconoce, y eso escala', async () => {
      // Confianza binaria a propósito: no se finge un 0,7 que el adaptador no tiene.
      const { entra, crearClienta, conversacion } = await preparar();
      await crearClienta('Ana');

      await entra('xyzzy qwerty asdf');

      expect((await conversacion()).modo).toBe('humano');
      expect((await conversacion()).motivoDeEscalamiento).toBe('baja_confianza_ia');
    });
  });

  describe('el bot NO INVENTA DATOS: todo sale del backend real', () => {
    it('los PRECIOS que responde son los de la tabla de servicios', async () => {
      const { entra, crearClienta, ultimoTextoEnviado } = await preparar();
      await crearClienta('Ana');

      await entra('hola, me pasas los precios?');

      const texto = ultimoTextoEnviado();
      // $450.00 es `precioBaseCentavos: 45000` del catálogo sembrado arriba. Si el bot
      // improvisara, este número no coincidiría.
      expect(texto).toContain('Gelish manos');
      expect(texto).toContain('$450.00');
      expect(texto).toContain('60 min');
    });

    it('un servicio de COTIZACIÓN MANUAL se marca "a confirmar" y NUNCA da el precio como final', async () => {
      // `DEC-033` / `RN-COT-01`: dar el precio base de un diseño como si fuera el final es
      // exactamente el número inventado que la regla prohíbe.
      const { entra, crearClienta, ultimoTextoEnviado } = await preparar();
      await crearClienta('Ana');

      await entra('que precios tienen?');

      expect(ultimoTextoEnviado()).toContain('Diseño artístico');
      expect(ultimoTextoEnviado()).toMatch(/Diseño artístico: desde \$800\.00 \(precio exacto a confirmar/);
    });

    it('con la única silla OCUPADA responde que no hay lugar', async () => {
      const { entra, crearClienta, ultimoTextoEnviado, agendar, servicios } = await preparar({ sillas: 1 });
      await crearClienta('Ana');

      // Se ocupa la única silla a las 11:00 locales con una cita real.
      const otra = await crearClienta('Beatriz', '4429998877');
      await agendar.ejecutar(
        { sucursalId: SUCURSAL, servicioId: servicios.gelish.id, clientaId: otra.id, inicio: new Date(`${FECHA}T11:00:00-06:00`) },
        SISTEMA,
      );

      await entra(`tienes lugar el ${FECHA} a las 11:00?`);

      expect(ultimoTextoEnviado()).toContain('no tengo lugar');
    });

    it('con la silla LIBRE responde que sí: MISMA pregunta, respuesta distinta — la decide la base', async () => {
      // El par de pruebas es el argumento: si el bot improvisara la respuesta, las dos dirían lo
      // mismo porque el mensaje de la clienta es idéntico. Lo único que cambia es el estado de
      // `agenda.citas`.
      const { entra, crearClienta, ultimoTextoEnviado } = await preparar({ sillas: 1 });
      await crearClienta('Ana');

      await entra(`tienes lugar el ${FECHA} a las 11:00?`);

      expect(ultimoTextoEnviado()).toContain('Sí tengo lugar');
    });
  });

  describe('AGENDAR DE VERDAD: la cita aparece en la base', () => {
    it('AGENDA UNA CITA REAL en `agenda.citas` y responde con el día y la hora correctos', async () => {
      const { entra, crearClienta, citaRepo, ultimoTextoEnviado, servicios } = await preparar();
      const ana = await crearClienta('Ana');

      const resultado = await entra(`quiero cita de gelish el ${FECHA} a las 13:00`);

      expect(resultado.atendidaPorElBot).toBe(true);
      expect(resultado.escalada).toBe(false);

      const citas = await citaRepo.listarParaConsulta(
        SUCURSAL,
        { inicio: new Date(`${FECHA}T00:00:00-06:00`), fin: new Date(`${FECHA}T23:59:00-06:00`) },
        { limite: 50, desplazamiento: 0 },
      );
      const suya = citas.find((cita) => cita.clientaId === ana.id);

      expect(suya).toBeDefined();
      expect(suya!.servicioId).toBe(servicios.gelish.id);
      // La hora de pared, no UTC: interpretarla como UTC desplazaría la cita seis horas, que es el
      // error silencioso más probable de todo el módulo.
      expect(suya!.rangoHorario.inicio.toISOString()).toBe('2027-03-08T19:00:00.000Z');
      // La duración la deriva el Catálogo (60 min), no el modelo.
      expect(suya!.rangoHorario.fin.toISOString()).toBe('2027-03-08T20:00:00.000Z');
      expect(ultimoTextoEnviado()).toContain('Gelish manos');
    });

    it('NO AGENDA si no puede identificar a la clienta: escala', async () => {
      // Nadie en CRM con ese teléfono. Registrar una clienta "por si acaso" ensuciaría el CRM con
      // duplicados cuyo historial de incidentes quedaría partido.
      const { entra, conversacion, citaRepo } = await preparar();

      await entra(`quiero cita de gelish el ${FECHA} a las 13:00`);

      expect((await conversacion()).modo).toBe('humano');
      const citas = await citaRepo.listarParaConsulta(
        SUCURSAL,
        { inicio: new Date(`${FECHA}T00:00:00-06:00`), fin: new Date(`${FECHA}T23:59:00-06:00`) },
        { limite: 50, desplazamiento: 0 },
      );
      expect(citas).toHaveLength(0);
    });

    it('NO AGENDA con DOS CLIENTAS en el mismo teléfono: mamá e hija no se adivinan', async () => {
      // `RN-CRM-01` quedó superada justo por este caso. El bot no elige: una persona pregunta para
      // quién es la cita.
      const { entra, crearClienta, conversacion, citaRepo } = await preparar();
      await crearClienta('Mamá', TELEFONO);
      await crearClienta('Hija', TELEFONO);

      await entra(`quiero cita de gelish el ${FECHA} a las 13:00`);

      expect((await conversacion()).modo).toBe('humano');
      const citas = await citaRepo.listarParaConsulta(
        SUCURSAL,
        { inicio: new Date(`${FECHA}T00:00:00-06:00`), fin: new Date(`${FECHA}T23:59:00-06:00`) },
        { limite: 50, desplazamiento: 0 },
      );
      expect(citas).toHaveLength(0);
    });

    it('un servicio de COTIZACIÓN MANUAL no se agenda: escala con `cotizacion_compleja`', async () => {
      const { entra, crearClienta, conversacion } = await preparar();
      await crearClienta('Ana');

      await entra(`quiero agendar diseño el ${FECHA} a las 13:00`);

      // "diseño" resuelve a `Diseño artístico`, que requiere cotización manual (`DEC-033`).
      expect((await conversacion()).motivoDeEscalamiento).toBe('cotizacion_compleja');
    });

    it('una clienta en LISTA ROJA recibe las instrucciones del anticipo y la conversación ESCALA', async () => {
      // `RN-ANT-01`: la cita nace en `en_espera_pago` con su anticipo del 40%. Validar una
      // transferencia es justo lo que el bot no puede hacer: no tiene acceso al banco.
      const { entra, crearClienta, conversacion, ultimoTextoEnviado } = await preparar();
      await crearClienta('Ana', TELEFONO, 'lista_roja');

      await entra(`quiero cita de gelish el ${FECHA} a las 13:00`);

      // 40% de $450.00 = $180.00, calculado por Anticipos, no por el bot.
      expect(ultimoTextoEnviado()).toContain('$180.00');
      expect((await conversacion()).motivoDeEscalamiento).toBe('intervencion_manual');
    });

    it('sin cupo, OFRECE LA LISTA DE ESPERA en vez de improvisar otro horario', async () => {
      const { entra, crearClienta, agendar, servicios, listaEsperaRepo, ultimoTextoEnviado } = await preparar({ sillas: 1 });
      const ana = await crearClienta('Ana');
      const otra = await crearClienta('Beatriz', '4429998877');

      await agendar.ejecutar(
        { sucursalId: SUCURSAL, servicioId: servicios.gelish.id, clientaId: otra.id, inicio: new Date(`${FECHA}T13:00:00-06:00`) },
        SISTEMA,
      );

      await entra(`quiero cita de gelish el ${FECHA} a las 13:00`);

      expect(ultimoTextoEnviado()).toContain('lista de espera');
      const fila = await listaEsperaRepo.listarFila(SUCURSAL, FECHA);
      expect(fila.map((solicitud) => solicitud.clientaId)).toContain(ana.id);
    });
  });

  describe('`RN-ESC-03` — SILENCIO ABSOLUTO del bot cuando la conversación ya está en `humano`', () => {
    it('el orquestador NO SE INVOCA y el bot NO RESPONDE si el modo es `humano`', async () => {
      const preparado = await preparar();
      await preparado.crearClienta('Ana');

      // Primer mensaje: el bot atiende y la conversación sigue en `bot`.
      await preparado.entra('hola');
      const espiaOrquestador = jest.spyOn(preparado.orquestador, 'atenderTurno');

      // Una persona la toma.
      const conversacion = await preparado.conversacion();
      await preparado.cambiarModo.escalar({ conversacionId: conversacion.id, motivo: 'intervencion_manual' }, SISTEMA);

      preparado.espiaTexto.mockClear();
      const resultado = await preparado.entra('hola de nuevo, me pasas los precios?');

      // Habría sido trivial responder: "precios" es una intención que el bot sabe atender.
      // **No lo hace**, y eso es la regla: una clienta que pidió una persona y recibe de nuevo al
      // bot concluye, con razón, que nadie la escuchó.
      expect(espiaOrquestador).not.toHaveBeenCalled();
      expect(preparado.espiaTexto).not.toHaveBeenCalled();
      expect(resultado.atendidaPorElBot).toBe(false);
      expect((await preparado.conversacion()).modo).toBe('humano');
    });

    it('el mensaje SÍ se guarda y el personal SÍ recibe el aviso', async () => {
      // El silencio es del bot, no del sistema: el mensaje no se pierde y alguien tiene que saber
      // que llegó algo nuevo a una conversación que ya estaba escalada.
      const preparado = await preparar();
      await preparado.crearClienta('Ana');
      await preparado.entra('hola');

      const conversacion = await preparado.conversacion();
      await preparado.cambiarModo.escalar({ conversacionId: conversacion.id, motivo: 'queja_o_reclamo' }, SISTEMA);
      preparado.notificador.conversacionNecesitaHumano.mockClear();

      await preparado.entra('sigo esperando respuesta');

      expect(preparado.notificador.conversacionNecesitaHumano).toHaveBeenCalledWith(
        expect.objectContaining({ yaEstabaEscalada: true, motivo: 'queja_o_reclamo' }),
      );

      const hilo = await preparado.conversacionRepo.listarMensajes(conversacion.id, { limite: 50, desplazamiento: 0 });
      expect(hilo.some((mensaje) => mensaje.contenido === 'sigo esperando respuesta')).toBe(true);
    });
  });

  describe('CIERRE DEL CICLO DEL RECORDATORIO: `pendiente_confirmacion` → `confirmada`', () => {
    it('un "sí" CONFIRMA la cita que está en `pendiente_confirmacion`', async () => {
      const { entra, crearClienta, agendar, citaRepo, servicios, ultimoTextoEnviado, solicitarConfirmacion } = await preparar();
      const ana = await crearClienta('Ana');

      const cita = await agendar.ejecutar(
        { sucursalId: SUCURSAL, servicioId: servicios.gelish.id, clientaId: ana.id, inicio: new Date(`${FECHA}T15:00:00-06:00`) },
        SISTEMA,
      );
      // Por la vía real: es el caso de uso que invoca el barrido de recordatorios (`ADR-025`).
      await solicitarConfirmacion.ejecutar({ citaId: cita.id }, SISTEMA);
      expect((await citaRepo.buscarPorId(cita.id))!.estado).toBe('pendiente_confirmacion');

      await entra('sí');

      expect((await citaRepo.buscarPorId(cita.id))!.estado).toBe('confirmada');
      expect(ultimoTextoEnviado()).toBe(RESPUESTAS.citaConfirmada);
    });

    it('un "sí" SIN CITA PENDIENTE no confirma nada: escala', async () => {
      // El riesgo concreto: responder "¡listo, confirmada!" a una clienta que estaba contestando a
      // otra cosa. Sin cita pendiente, un "sí" no significa nada accionable.
      const { entra, crearClienta, conversacion } = await preparar();
      await crearClienta('Ana');

      await entra('sí');

      expect((await conversacion()).modo).toBe('humano');
    });
  });

  describe('CIERRE DEL CICLO DE LA LISTA DE ESPERA', () => {
    it('un "sí lo quiero" ACEPTA LA OFERTA y agenda la cita del hueco ofrecido', async () => {
      const { entra, crearClienta, listaEsperaRepo, citaRepo, servicios, inscribirEnFila } = await preparar();
      const ana = await crearClienta('Ana');

      // Se inscribe y se le ofrece un hueco, como haría el barrido tras una cancelación.
      const solicitud = await inscribirEnFila.ejecutar(
        { sucursalId: SUCURSAL, clientaId: ana.id, servicioId: servicios.gelish.id, fecha: FECHA },
        SISTEMA,
      );

      const guardada = await listaEsperaRepo.buscarPorId(solicitud.id);
      guardada!.ofrecer(new Date(`${FECHA}T17:00:00-06:00`), AHORA);
      await listaEsperaRepo.guardar(guardada!);

      await entra('sí lo quiero');

      const citas = await citaRepo.listarParaConsulta(
        SUCURSAL,
        { inicio: new Date(`${FECHA}T00:00:00-06:00`), fin: new Date(`${FECHA}T23:59:00-06:00`) },
        { limite: 50, desplazamiento: 0 },
      );
      expect(citas.some((cita) => cita.clientaId === ana.id && cita.rangoHorario.inicio.toISOString() === '2027-03-08T23:00:00.000Z')).toBe(
        true,
      );
      expect((await listaEsperaRepo.buscarPorId(solicitud.id))!.estado).toBe('aceptada');
    });
  });

  describe('MEDIOS NO PROCESABLES: acuse y escalamiento con el motivo correcto', () => {
    it('una NOTA DE VOZ escala con `medio_no_soportado` y recibe acuse', async () => {
      // `RN-CONV-06`: no se procesan notas de voz. El acuse existe para que la clienta no se quede
      // en silencio creyendo que su mensaje se perdió.
      const { entra, crearClienta, conversacion, ultimoTextoEnviado } = await preparar();
      await crearClienta('Ana');

      await entra(null, { tipo: 'no_soportado', tipoCrudoDeMeta: 'audio' });

      expect((await conversacion()).motivoDeEscalamiento).toBe('medio_no_soportado');
      expect(ultimoTextoEnviado()).toBe(ACUSE_DE_MEDIO_NO_PROCESABLE);
    });

    it('una IMAGEN escala con `cotizacion_compleja`, no con `medio_no_soportado`', async () => {
      // La distinción no es cosmética: la Dueña mira el desglose por motivo para saber qué se le
      // escapa al bot, y ver "cotizaciones complejas" donde solo hubo notas de voz la engañaría.
      const { entra, crearClienta, conversacion } = await preparar();
      await crearClienta('Ana');

      await entra(null, { tipo: 'no_soportado', tipoCrudoDeMeta: 'image' });

      expect((await conversacion()).motivoDeEscalamiento).toBe('cotizacion_compleja');
    });

    it('una CLIENTA BLOQUEADA no recibe NI ACUSE: silencio absoluto', async () => {
      const { entra, crearClienta, conversacion, espiaTexto, notificador } = await preparar();
      await crearClienta('Ana', TELEFONO, 'bloqueada');

      const resultado = await entra('hola, me pasas los precios?');

      expect(resultado.enSilencioPorBloqueo).toBe(true);
      expect(espiaTexto).not.toHaveBeenCalled();
      expect((await conversacion()).motivoDeEscalamiento).toBe('clienta_bloqueada');
      // Pero el personal sí se entera: el silencio es hacia la clienta, no hacia el salón.
      expect(notificador.conversacionNecesitaHumano).toHaveBeenCalled();
    });
  });

  describe('EL AVISO AL PERSONAL LLEVA EL MOTIVO REAL DEL BOT', () => {
    it('cuando el bot escala por cancelación, el aviso dice `cancelacion_solicitada`', async () => {
      // Antes de propagar el motivo en `ResultadoDelTurno`, esto decía siempre `fuera_de_alcance`:
      // la copia en memoria de `RecibirMensaje` se cargó antes de que el bot escalara sobre la suya.
      const { entra, crearClienta, notificador } = await preparar();
      await crearClienta('Ana');

      await entra('quiero cancelar');

      expect(notificador.conversacionNecesitaHumano).toHaveBeenCalledWith(
        expect.objectContaining({ motivo: 'cancelacion_solicitada', yaEstabaEscalada: false }),
      );
    });
  });

  describe('`RN-CONV-04` — trazabilidad de las decisiones de IA, SIN PII', () => {
    it('audita la intención, la confianza y la fuente, y NUNCA el texto de la clienta', async () => {
      const { entra, crearClienta, auditoria } = await preparar();
      await crearClienta('Ana');

      await entra('hola, me pasas los precios?');

      const registros = auditoria.registrar.mock.calls.map(([registro]) => registro);
      const decision = registros.find((registro) => (registro.detalle as { accion?: string })?.accion === 'bot_responde');

      expect(decision).toBeDefined();
      expect(decision!.actor).toBe('sistema:bot-conversacional');
      expect(decision!.detalle).toMatchObject({ intencion: 'consultar_servicios', confianza: 1 });

      // `RN-AUD-01`: el texto y el teléfono son PII y ya viven en el hilo, que es donde se leen.
      const serializado = JSON.stringify(registros);
      expect(serializado).not.toContain('me pasas los precios');
      expect(serializado).not.toContain(TELEFONO);
    });
  });
});
