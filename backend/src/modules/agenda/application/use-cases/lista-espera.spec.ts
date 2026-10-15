import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';
import {
  AceptarOfertaListaEsperaUseCase,
  AvanzarTurnoListaEsperaUseCase,
  CancelarSolicitudListaEsperaUseCase,
  ConsultarListaEsperaUseCase,
  InscribirEnListaEsperaUseCase,
  MINUTOS_MINIMOS_PARA_AVISO,
  ProcesarListaEsperaUseCase,
} from './lista-espera.use-cases';
import { AgendarCitaUseCase } from './agendar-cita.use-case';
import { CancelarCitaUseCase, MINUTOS_DE_INCIDENTE_TARDIO } from './cancelar-cita.use-case';
import { ReprogramarCitaUseCase } from './reprogramar-cita.use-case';
import { DrizzleCitaRepository } from '../../infrastructure/persistence/drizzle-cita.repository';
import { DrizzleSillaRepository } from '../../infrastructure/persistence/drizzle-silla.repository';
import { DrizzleListaEsperaRepository } from '../../infrastructure/persistence/drizzle-lista-espera.repository';
import { Silla } from '../../domain/entities/silla.entity';
import { MotorDisponibilidad } from '../../domain/services/motor-disponibilidad';
import { ResolutorDeServicio } from '../../domain/services/resolutor-de-servicio';
import { crearContextoPersonalFalso, horarioAbiertoSiempre } from '../../test-utils/contexto-personal-falso';
import { crearCatalogoPorDuraciones, crearContextoClientaFalso } from '../../test-utils/contexto-catalogo-falso';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { NotificacionListaEsperaPort } from '../../domain/ports/notificacion-lista-espera.port';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';
import { crearAnticipoFalso } from '../../test-utils/anticipo-falso';
import { crearRegistroDeIncidentesFalso } from '../../test-utils/registro-de-incidentes-falso';

const ACTOR: ClaimsUsuario = { sub: 'encargada-1', rol: Rol.GERENTE, sucursales: 'GLOBAL', manicuristaId: null };
const SUCURSAL = '11111111-1111-1111-1111-111111111111';
const ANA = 'aaaaaaaa-0000-4000-8000-000000000001';
const BEA = 'bbbbbbbb-0000-4000-8000-000000000002';
const CARO = 'cccccccc-0000-4000-8000-000000000003';

/** El catálogo ofrece servicios de 60 y de 120 minutos: es el eje de la regla 2.2. */
const CATALOGO = crearCatalogoPorDuraciones([60, 120]);
const SERVICIO_1H = CATALOGO.idPara(60);
const SERVICIO_2H = CATALOGO.idPara(120);

/** 2026-12-07 es lunes. La sucursal abre 24/7 en estas pruebas, salvo donde se diga. */
const FECHA = '2026-12-07';
const DIEZ = new Date('2026-12-07T10:00:00.000Z');
const ONCE = new Date('2026-12-07T11:00:00.000Z');
/** "Ahora" muy anterior al hueco: así el umbral de 30 minutos no interfiere salvo al probarlo. */
const AYER = new Date('2026-12-06T10:00:00.000Z');

async function preparar({ sillas = 1 }: { sillas?: number } = {}) {
  const db = await crearBaseDeDatosDePrueba();
  const citaRepo = new DrizzleCitaRepository(db);
  const sillaRepo = new DrizzleSillaRepository(db);
  const listaEsperaRepo = new DrizzleListaEsperaRepository(db);
  const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
  const anticipos = crearAnticipoFalso();
  const uow = crearUnitOfWorkFalso();
  const incidentes = crearRegistroDeIncidentesFalso();
  const notificacion: jest.Mocked<NotificacionListaEsperaPort> = { ofertaDeHueco: jest.fn() };

  for (let i = 1; i <= sillas; i += 1) {
    await sillaRepo.guardar(Silla.crear({ sucursalId: SUCURSAL, nombre: `Lomas ${i}` }));
  }

  const motor = new MotorDisponibilidad(citaRepo, sillaRepo, crearContextoPersonalFalso({ horario: horarioAbiertoSiempre() }));
  const resolutor = new ResolutorDeServicio(CATALOGO.port);
  const procesar = new ProcesarListaEsperaUseCase(listaEsperaRepo, motor, resolutor, notificacion, auditoria, uow);
  const agendar = new AgendarCitaUseCase(citaRepo, sillaRepo, motor, resolutor, crearContextoClientaFalso(), anticipos, auditoria, uow);

  return {
    citaRepo,
    listaEsperaRepo,
    auditoria,
    notificacion,
    procesar,
    agendar,
    inscribir: new InscribirEnListaEsperaUseCase(listaEsperaRepo, resolutor, crearContextoClientaFalso(), auditoria, uow),
    aceptar: new AceptarOfertaListaEsperaUseCase(listaEsperaRepo, agendar, auditoria, uow),
    avanzar: new AvanzarTurnoListaEsperaUseCase(listaEsperaRepo, procesar, auditoria, uow),
    cancelarSolicitud: new CancelarSolicitudListaEsperaUseCase(listaEsperaRepo, auditoria, uow),
    consultarFila: new ConsultarListaEsperaUseCase(listaEsperaRepo),
    cancelarCita: new CancelarCitaUseCase(citaRepo, auditoria, uow, procesar, incidentes, anticipos, crearContextoClientaFalso()),
    reprogramarCita: new ReprogramarCitaUseCase(citaRepo, sillaRepo, motor, resolutor, auditoria, uow, procesar, incidentes, anticipos),
  };
}

describe('Lista de Espera — DEC-039 (integración, PostgreSQL real)', () => {
  describe('inscripción', () => {
    it('entra en la fila en estado `en_espera`', async () => {
      const { inscribir } = await preparar();

      const solicitud = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      expect(solicitud.estado).toBe('en_espera');
      expect(solicitud.expiraEn).toBeNull();
    });

    it('la fila sale EN ORDEN DE LLEGADA, que es el FIFO de `DEC-039`', async () => {
      const { inscribir, consultarFila } = await preparar();

      const primera = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);
      const segunda = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: BEA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      const fila = await consultarFila.ejecutar({ sucursalId: SUCURSAL, fecha: FECHA });
      expect(fila.map((s) => s.id)).toEqual([primera.id, segunda.id]);
    });

    it('404 si el servicio no existe', async () => {
      const { inscribir } = await preparar();
      await expect(
        inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: '99999999-9999-4999-8999-999999999999', fecha: FECHA }, ACTOR, AYER),
      ).rejects.toMatchObject({ httpStatus: 404 });
    });

    it('409 si la fecha ya pasó: una espera para ayer no puede terminar nunca', async () => {
      const { inscribir } = await preparar();
      await expect(
        inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: '2020-01-01' }, ACTOR, AYER),
      ).rejects.toMatchObject({ code: 'LISTA_ESPERA_FECHA_PASADA', httpStatus: 409 });
    });

    it('409 LISTA_ESPERA_DUPLICADA si la misma clienta se apunta dos veces a lo mismo', async () => {
      const { inscribir } = await preparar();
      const alta = { sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA };
      await inscribir.ejecutar(alta, ACTOR, AYER);

      await expect(inscribir.ejecutar(alta, ACTOR, AYER)).rejects.toMatchObject({ code: 'LISTA_ESPERA_DUPLICADA' });
    });

    it('pero sí puede apuntarse al MISMO día con OTRO servicio', async () => {
      const { inscribir } = await preparar();
      await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      await expect(
        inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_2H, fecha: FECHA }, ACTOR, AYER),
      ).resolves.toBeDefined();
    });
  });

  describe('REGLA 2.2 — el servicio tiene que caber en el hueco', () => {
    it('EL CASO CLAVE: se libera 1h, la primera quiere 2h → se le ofrece A LA SEGUNDA, que quiere 1h', async () => {
      // Una sola silla. Se agendan dos citas consecutivas (10–11 y 11–12) y se cancela la primera:
      // el hueco REAL es de una hora, porque la de las 11:00 sigue en pie. La primera de la fila
      // quiere dos horas y por tanto NO cabe, aunque sea la primera.
      const { inscribir, agendar, cancelarCita, consultarFila } = await preparar({ sillas: 1 });

      const diezAOnce = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: ONCE }, ACTOR);

      const deDosHoras = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_2H, fecha: FECHA }, ACTOR, AYER);
      const deUnaHora = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: BEA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      const { listaEspera } = await cancelarCita.ejecutar({ citaId: diezAOnce.id }, ACTOR, AYER);

      expect(listaEspera?.ofrecida?.id).toBe(deUnaHora.id);
      expect(listaEspera?.descartadasPorNoCaber).toBe(1);

      // Y la de 2h NO se penaliza: sigue `en_espera`, conserva su lugar para otro hueco mayor.
      const fila = await consultarFila.ejecutar({ sucursalId: SUCURSAL, fecha: FECHA });
      expect(fila.find((s) => s.id === deDosHoras.id)?.estado).toBe('en_espera');
    });

    it('si se liberan 2h seguidas, la primera de la fila (2h) SÍ es candidata', async () => {
      // Misma fila, hueco distinto: se cancela la única cita y queda el día libre.
      const { inscribir, agendar, cancelarCita } = await preparar({ sillas: 1 });
      const dosHoras = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_2H, clientaId: CARO, inicio: DIEZ }, ACTOR);

      const deDosHoras = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_2H, fecha: FECHA }, ACTOR, AYER);
      await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: BEA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      const { listaEspera } = await cancelarCita.ejecutar({ citaId: dosHoras.id }, ACTOR, AYER);

      expect(listaEspera?.ofrecida?.id).toBe(deDosHoras.id);
      expect(listaEspera?.descartadasPorNoCaber).toBe(0);
    });

    it('nadie cabe: no se ofrece a nadie y no se inventa una oferta', async () => {
      // Dos sillas, las dos ocupadas a las 11:00, así que al cancelar la de 10:00 el hueco es de
      // una hora y la única candidata quiere dos.
      const { inscribir, agendar, cancelarCita } = await preparar({ sillas: 1 });
      const diezAOnce = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: ONCE }, ACTOR);
      await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_2H, fecha: FECHA }, ACTOR, AYER);

      const { listaEspera } = await cancelarCita.ejecutar({ citaId: diezAOnce.id }, ACTOR, AYER);

      expect(listaEspera?.ofrecida).toBeNull();
      expect(listaEspera?.descartadasPorNoCaber).toBe(1);
    });
  });

  describe('REGLA 2.3 — umbral de 30 minutos, distinto del de 60', () => {
    it('LOS DOS UMBRALES SON INDEPENDIENTES: a 45 min hay incidente tardío Y hueco aprovechable', async () => {
      // La trampa que esto fija: 60 min mide el comportamiento de la clienta (`RN-CRM-06`,
      // sugiere lista roja) y 30 mide la utilidad del hueco (`DEC-039`). A los 45 minutos las dos
      // cosas son verdad a la vez, y unificar los umbrales habría perdido una de ellas.
      expect(MINUTOS_DE_INCIDENTE_TARDIO).toBe(60);
      expect(MINUTOS_MINIMOS_PARA_AVISO).toBe(30);

      const { inscribir, agendar, cancelarCita } = await preparar({ sillas: 1 });
      const cita = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      const enEspera = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      const cuarentaYCincoMinutosAntes = new Date(DIEZ.getTime() - 45 * 60_000);
      const resultado = await cancelarCita.ejecutar({ citaId: cita.id }, ACTOR, cuarentaYCincoMinutosAntes);

      expect(resultado.incidenteTardio).toBe(true);
      expect(resultado.listaEspera?.huecoPerdidoCortoPlazo).toBe(false);
      expect(resultado.listaEspera?.ofrecida?.id).toBe(enEspera.id);
    });

    it('a 20 minutos el hueco SE DA POR PERDIDO: nadie es avisado y queda la bandera', async () => {
      const { inscribir, agendar, cancelarCita, notificacion, consultarFila } = await preparar({ sillas: 1 });
      const cita = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      const enEspera = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      const resultado = await cancelarCita.ejecutar({ citaId: cita.id }, ACTOR, new Date(DIEZ.getTime() - 20 * 60_000));

      expect(resultado.listaEspera?.huecoPerdidoCortoPlazo).toBe(true);
      expect(resultado.listaEspera?.ofrecida).toBeNull();
      // No se escribe a nadie: ofrecerle un hueco de dentro de 20 minutos es ofrecerle algo a lo
      // que no puede llegar.
      expect(notificacion.ofertaDeHueco).not.toHaveBeenCalled();
      const fila = await consultarFila.ejecutar({ sucursalId: SUCURSAL, fecha: FECHA });
      expect(fila.find((s) => s.id === enEspera.id)?.estado).toBe('en_espera');
    });

    it('exactamente a 30 minutos el hueco se da por perdido (el umbral es inclusivo)', async () => {
      const { inscribir, agendar, cancelarCita } = await preparar({ sillas: 1 });
      const cita = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      const resultado = await cancelarCita.ejecutar({ citaId: cita.id }, ACTOR, new Date(DIEZ.getTime() - 30 * 60_000));
      expect(resultado.listaEspera?.huecoPerdidoCortoPlazo).toBe(true);
    });

    it('la bandera de hueco perdido queda auditada para la Dueña', async () => {
      const { inscribir, agendar, cancelarCita, auditoria } = await preparar({ sillas: 1 });
      const cita = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      await cancelarCita.ejecutar({ citaId: cita.id }, ACTOR, new Date(DIEZ.getTime() - 10 * 60_000));

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ detalle: expect.objectContaining({ accion: 'hueco_perdido_corto_plazo' }) }),
      );
    });
  });

  describe('una sola oferta a la vez, y avance del turno', () => {
    it('se avisa SOLO A UNA aunque se liberen dos huecos seguidos', async () => {
      const { inscribir, agendar, cancelarCita, consultarFila } = await preparar({ sillas: 2 });
      const uno = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      const dos = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);

      await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);
      await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: BEA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      const primera = await cancelarCita.ejecutar({ citaId: uno.id }, ACTOR, AYER);
      const segunda = await cancelarCita.ejecutar({ citaId: dos.id }, ACTOR, AYER);

      expect(primera.listaEspera?.ofrecida).not.toBeNull();
      // La segunda liberación NO abre otra oferta: ya hay una abierta en esa fila.
      expect(segunda.listaEspera?.ofrecida).toBeNull();

      const fila = await consultarFila.ejecutar({ sucursalId: SUCURSAL, fecha: FECHA });
      expect(fila.filter((s) => s.estado === 'notificada')).toHaveLength(1);
    });

    it('LA VENTANA EXPIRA Y PASA A LA SIGUIENTE EN FIFO', async () => {
      const { inscribir, agendar, cancelarCita, avanzar, consultarFila } = await preparar({ sillas: 1 });
      const cita = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);

      const primera = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);
      const segunda = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: BEA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      const { listaEspera } = await cancelarCita.ejecutar({ citaId: cita.id }, ACTOR, AYER);
      expect(listaEspera?.ofrecida?.id).toBe(primera.id);

      // Una hora y un minuto después: su turno venció.
      const despues = new Date(AYER.getTime() + 61 * 60_000);
      const { expiradas, nuevasOfertas } = await avanzar.ejecutar({}, ACTOR, despues);

      expect(expiradas.map((s) => s.id)).toEqual([primera.id]);
      expect(nuevasOfertas.map((s) => s.id)).toEqual([segunda.id]);

      const fila = await consultarFila.ejecutar({ sucursalId: SUCURSAL, fecha: FECHA });
      // La primera ya no está en la fila: `expirada` es terminal (ver la nota de la entidad).
      expect(fila.map((s) => s.id)).toEqual([segunda.id]);
      expect(fila[0].estado).toBe('notificada');
    });

    it('REOFRECE EL MISMO HUECO, no uno inventado: `huecoInicio` ≠ `notificadaEn`', async () => {
      // Confundir ambas fechas rompía el avance FIFO en silencio: se reevaluaba la hora en que se
      // avisó (en el pasado) en vez del hueco ofrecido, el umbral de 30 minutos lo descartaba y
      // la siguiente de la fila nunca recibía su turno.
      const { inscribir, agendar, cancelarCita, avanzar, listaEsperaRepo } = await preparar({ sillas: 1 });
      const cita = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      const primera = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);
      await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: BEA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      await cancelarCita.ejecutar({ citaId: cita.id }, ACTOR, AYER);

      const ofrecida = await listaEsperaRepo.buscarPorId(primera.id);
      expect(ofrecida?.huecoInicio).toEqual(DIEZ);
      // `notificadaEn` es otra cosa: cuándo se avisó.
      expect(ofrecida?.notificadaEn).toEqual(AYER);

      const { nuevasOfertas } = await avanzar.ejecutar({}, ACTOR, new Date(AYER.getTime() + 61 * 60_000));
      // Y la nueva oferta es del MISMO hueco de las 10:00.
      expect(nuevasOfertas[0].huecoInicio).toEqual(DIEZ);
    });

    it('la ventana es parametrizable: con 10 minutos, a los 11 ya venció', async () => {
      const { inscribir, agendar, procesar, avanzar } = await preparar({ sillas: 1 });
      await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: ONCE }, ACTOR);
      const ana = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      await procesar.procesarHuecoLiberado({ sucursalId: SUCURSAL, inicioLiberado: DIEZ, minutosDeVentana: 10 }, ACTOR, AYER);

      const aLosCinco = await avanzar.ejecutar({}, ACTOR, new Date(AYER.getTime() + 5 * 60_000));
      expect(aLosCinco.expiradas).toEqual([]);

      const aLosOnce = await avanzar.ejecutar({}, ACTOR, new Date(AYER.getTime() + 11 * 60_000));
      expect(aLosOnce.expiradas.map((s) => s.id)).toEqual([ana.id]);
    });

    it('avanzar turno no toca una oferta que todavía está viva', async () => {
      const { inscribir, agendar, cancelarCita, avanzar } = await preparar({ sillas: 1 });
      const cita = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);
      await cancelarCita.ejecutar({ citaId: cita.id }, ACTOR, AYER);

      const { expiradas, nuevasOfertas } = await avanzar.ejecutar({}, ACTOR, new Date(AYER.getTime() + 30 * 60_000));
      expect(expiradas).toEqual([]);
      expect(nuevasOfertas).toEqual([]);
    });
  });

  describe('REPROGRAMAR TAMBIÉN LIBERA HUECO', () => {
    it('mover una cita ofrece su horario a la fila', async () => {
      // Fácil de olvidar porque `DEC-039` habla de cancelaciones: la cita original pasa a
      // `reprogramada`, que no ocupa horario, así que su hueco queda igual de disponible.
      const { inscribir, agendar, reprogramarCita } = await preparar({ sillas: 2 });
      const cita = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      const ana = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      const { listaEspera } = await reprogramarCita.ejecutar({ citaId: cita.id, nuevoInicio: ONCE }, ACTOR, AYER);

      expect(listaEspera?.ofrecida?.id).toBe(ana.id);
    });
  });

  describe('aceptar la oferta', () => {
    it('AGENDA LA CITA DE VERDAD y deja la solicitud `aceptada` apuntando a ella', async () => {
      const { inscribir, agendar, cancelarCita, aceptar, citaRepo } = await preparar({ sillas: 1 });
      const original = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);
      const { listaEspera } = await cancelarCita.ejecutar({ citaId: original.id }, ACTOR, AYER);

      const { solicitud, cita } = await aceptar.ejecutar({ solicitudId: listaEspera!.ofrecida!.id, inicio: DIEZ }, ACTOR, AYER);

      expect(solicitud.estado).toBe('aceptada');
      expect(solicitud.citaId).toBe(cita.id);
      expect(cita.clientaId).toBe(ANA);
      // Pasa por `AgendarCitaUseCase`, así que hereda todo: silla elegida y cotización congelada.
      expect(cita.sillaId).toBeDefined();
      expect(cita.cotizacionSnapshot).toMatchObject({ totalCentavos: 45000 });
      await expect(citaRepo.buscarPorId(cita.id)).resolves.not.toBeNull();
    });

    it('LA CARRERA SE RESUELVE AL AGENDAR (`RN-AGE-13`): si otra tomó el hueco, 409 y sigue `notificada`', async () => {
      // La oferta NO retiene el hueco. Mientras Ana decidía, alguien más agendó su horario.
      const { inscribir, agendar, cancelarCita, aceptar, listaEsperaRepo } = await preparar({ sillas: 1 });
      const original = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);
      const { listaEspera } = await cancelarCita.ejecutar({ citaId: original.id }, ACTOR, AYER);

      // Otra clienta se adelanta y ocupa la única silla a esa hora.
      await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: BEA, inicio: DIEZ }, ACTOR);

      await expect(aceptar.ejecutar({ solicitudId: listaEspera!.ofrecida!.id, inicio: DIEZ }, ACTOR, AYER)).rejects.toMatchObject({
        code: 'HORARIO_NO_DISPONIBLE',
      });

      // No se da por aceptada ni se expira: sigue en su turno y puede aceptar otro hueco.
      const recargada = await listaEsperaRepo.buscarPorId(listaEspera!.ofrecida!.id);
      expect(recargada?.estado).toBe('notificada');
      expect(recargada?.citaId).toBeNull();
    });

    it('409 si el turno ya venció', async () => {
      const { inscribir, agendar, cancelarCita, aceptar } = await preparar({ sillas: 1 });
      const original = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);
      const { listaEspera } = await cancelarCita.ejecutar({ citaId: original.id }, ACTOR, AYER);

      await expect(
        aceptar.ejecutar({ solicitudId: listaEspera!.ofrecida!.id, inicio: DIEZ }, ACTOR, new Date(AYER.getTime() + 61 * 60_000)),
      ).rejects.toMatchObject({ code: 'LISTA_ESPERA_TURNO_VENCIDO', httpStatus: 409 });
    });

    it('409 al aceptar una solicitud que nunca recibió oferta', async () => {
      const { inscribir, aceptar } = await preparar();
      const ana = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      await expect(aceptar.ejecutar({ solicitudId: ana.id, inicio: DIEZ }, ACTOR, AYER)).rejects.toMatchObject({
        code: 'LISTA_ESPERA_TRANSICION_INVALIDA',
      });
    });

    it('404 con una solicitud inexistente', async () => {
      const { aceptar } = await preparar();
      await expect(
        aceptar.ejecutar({ solicitudId: '88888888-8888-4888-8888-888888888888', inicio: DIEZ }, ACTOR, AYER),
      ).rejects.toMatchObject({ httpStatus: 404 });
    });
  });

  describe('baja de la fila', () => {
    it('cancelar la solicitud la saca de la fila', async () => {
      const { inscribir, cancelarSolicitud, consultarFila } = await preparar();
      const ana = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      await cancelarSolicitud.ejecutar({ solicitudId: ana.id }, ACTOR);

      await expect(consultarFila.ejecutar({ sucursalId: SUCURSAL, fecha: FECHA })).resolves.toEqual([]);
    });

    it('y entonces la siguiente liberación avisa a quien venía detrás', async () => {
      const { inscribir, agendar, cancelarCita, cancelarSolicitud } = await preparar({ sillas: 1 });
      const cita = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      const ana = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);
      const bea = await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: BEA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      await cancelarSolicitud.ejecutar({ solicitudId: ana.id }, ACTOR);
      const { listaEspera } = await cancelarCita.ejecutar({ citaId: cita.id }, ACTOR, AYER);

      expect(listaEspera?.ofrecida?.id).toBe(bea.id);
    });

    it('tras cancelar, puede volver a apuntarse a lo mismo', async () => {
      // El índice único solo cubre las solicitudes vivas, a propósito.
      const { inscribir, cancelarSolicitud } = await preparar();
      const alta = { sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA };
      const ana = await inscribir.ejecutar(alta, ACTOR, AYER);
      await cancelarSolicitud.ejecutar({ solicitudId: ana.id }, ACTOR);

      await expect(inscribir.ejecutar(alta, ACTOR, AYER)).resolves.toBeDefined();
    });
  });

  describe('el aviso no sale del sistema todavía (Fase 4)', () => {
    it('se invoca el puerto de notificación, con el hueco del tamaño del servicio', async () => {
      const { inscribir, agendar, cancelarCita, notificacion } = await preparar({ sillas: 1 });
      const cita = await agendar.ejecutar({ sucursalId: SUCURSAL, servicioId: SERVICIO_1H, clientaId: CARO, inicio: DIEZ }, ACTOR);
      await inscribir.ejecutar({ sucursalId: SUCURSAL, clientaId: ANA, servicioId: SERVICIO_1H, fecha: FECHA }, ACTOR, AYER);

      await cancelarCita.ejecutar({ citaId: cita.id }, ACTOR, AYER);

      expect(notificacion.ofertaDeHueco).toHaveBeenCalledWith(
        expect.objectContaining({ clientaId: ANA }),
        { inicio: DIEZ, fin: ONCE },
      );
    });
  });
});
