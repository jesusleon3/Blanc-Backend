import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';
import { AgendarCitaUseCase } from './agendar-cita.use-case';
import { AsignarManicuristaEnSucursalUseCase } from './asignar-manicurista-en-sucursal.use-case';
import { DrizzleCitaRepository } from '../../infrastructure/persistence/drizzle-cita.repository';
import { DrizzleSillaRepository } from '../../infrastructure/persistence/drizzle-silla.repository';
import { Silla } from '../../domain/entities/silla.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';
import { crearAnticipoFalso } from '../../test-utils/anticipo-falso';
import { MotorDisponibilidad } from '../../domain/services/motor-disponibilidad';
import { crearContextoPersonalFalso } from '../../test-utils/contexto-personal-falso';
import { ResolutorDeServicio } from '../../domain/services/resolutor-de-servicio';
import { crearContextoCatalogoFalso, crearContextoClientaFalso, servicioDePrueba } from '../../test-utils/contexto-catalogo-falso';

const ACTOR: ClaimsUsuario = { sub: 'encargada-1', rol: Rol.GERENTE, sucursales: 'GLOBAL', manicuristaId: null };
const SUCURSAL = '11111111-1111-1111-1111-111111111111';
const CLIENTA = '22222222-2222-2222-2222-222222222222';
const SERVICIO = '33333333-3333-3333-3333-333333333333';
const ANA = '44444444-4444-4444-4444-444444444444';
const BEA = '55555555-5555-5555-5555-555555555555';

const rango = (i: string, f: string) => ({ inicio: new Date(i), fin: new Date(f) });
const DIEZ_A_ONCE = rango('2026-12-07T10:00:00Z', '2026-12-07T11:00:00Z');
const DIEZ_Y_MEDIA = rango('2026-12-07T10:30:00Z', '2026-12-07T11:30:00Z');
const ONCE_A_DOCE = rango('2026-12-07T11:00:00Z', '2026-12-07T12:00:00Z');

/** Monta el caso de uso real contra PostgreSQL, con `n` sillas activas en la sucursal. */
async function preparar(numeroDeSillas = 2) {
  const db = await crearBaseDeDatosDePrueba();
  const citaRepo = new DrizzleCitaRepository(db);
  const sillaRepo = new DrizzleSillaRepository(db);
  const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
  const anticipos = crearAnticipoFalso();
  // Horario abierto y personal de sobra: estas pruebas no van sobre disponibilidad.
  const motor = new MotorDisponibilidad(citaRepo, sillaRepo, crearContextoPersonalFalso());

  for (let i = 1; i <= numeroDeSillas; i += 1) {
    await sillaRepo.guardar(Silla.crear({ sucursalId: SUCURSAL, nombre: `Lomas ${i}` }));
  }

  return {
    citaRepo,
    sillaRepo,
    auditoria,
    agendar: new AgendarCitaUseCase(
      citaRepo,
      sillaRepo,
      motor,
      // El servicio del catálogo dura 60 minutos, que es el tamaño de todos los rangos de este
      // archivo: así el fin derivado coincide con lo que estas pruebas ya daban por supuesto.
      new ResolutorDeServicio(crearContextoCatalogoFalso([servicioDePrueba({ id: SERVICIO })])),
      crearContextoClientaFalso(),
      anticipos,
      auditoria,
      crearUnitOfWorkFalso(),
    ),
    asignar: new AsignarManicuristaEnSucursalUseCase(citaRepo, auditoria, crearUnitOfWorkFalso()),
  };
}

/**
 * `rangoHorario` sigue aceptándose por comodidad de estas pruebas, pero se traduce a `inicio`:
 * **el fin ya no lo decide quien llama**, lo deriva la duración del catálogo.
 */
const reserva = ({ rangoHorario = DIEZ_A_ONCE, ...extra }: Partial<{ manicuristaId: string | null; rangoHorario: typeof DIEZ_A_ONCE }> = {}) => ({
  sucursalId: SUCURSAL,
  servicioId: SERVICIO,
  clientaId: CLIENTA,
  inicio: rangoHorario.inicio,
  ...extra,
});

describe('AgendarCitaUseCase (integración, PostgreSQL real)', () => {
  it('reserva sobre una silla libre sin comprometer a ninguna manicurista', async () => {
    const { agendar, sillaRepo } = await preparar();

    const cita = await agendar.ejecutar(reserva(), ACTOR);

    expect(cita.estado).toBe('agendada');
    expect(cita.manicuristaId).toBeNull();
    // La clienta nunca eligió silla: el caso de uso la escogió por ella.
    const sillas = await sillaRepo.listarPorSucursal(SUCURSAL);
    expect(sillas.map((s) => s.id)).toContain(cita.sillaId);
  });

  it('audita el agendamiento con la silla y el horario', async () => {
    const { agendar, auditoria } = await preparar();

    const cita = await agendar.ejecutar(reserva(), ACTOR);

    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoAccion: 'agendamiento',
        actor: 'encargada-1',
        entidadAfectadaTipo: 'cita',
        entidadAfectadaId: cita.id,
        detalle: expect.objectContaining({ accion: 'agendar_cita', sillaId: cita.sillaId }),
      }),
    );
  });

  it('reparte las reservas simultáneas entre sillas distintas', async () => {
    const { agendar } = await preparar(3);

    const primera = await agendar.ejecutar(reserva(), ACTOR);
    const segunda = await agendar.ejecutar(reserva({ rangoHorario: DIEZ_Y_MEDIA }), ACTOR);

    expect(segunda.sillaId).not.toBe(primera.sillaId);
  });

  it('LA CAPACIDAD DE LA SUCURSAL SE RESPETA: con 2 sillas, la tercera reserva simultánea se rechaza', async () => {
    const { agendar } = await preparar(2);

    await agendar.ejecutar(reserva(), ACTOR);
    await agendar.ejecutar(reserva({ rangoHorario: DIEZ_Y_MEDIA }), ACTOR);

    await expect(agendar.ejecutar(reserva(), ACTOR)).rejects.toMatchObject({ code: 'HORARIO_NO_DISPONIBLE', httpStatus: 409 });
  });

  it('acepta citas consecutivas en la misma sucursal: 11:00 no choca con la que termina a las 11:00', async () => {
    const { agendar } = await preparar(1);

    await agendar.ejecutar(reserva(), ACTOR);
    await expect(agendar.ejecutar(reserva({ rangoHorario: ONCE_A_DOCE }), ACTOR)).resolves.toBeDefined();
  });

  describe('con manicurista elegida por la clienta', () => {
    it('la fija en la cita', async () => {
      const { agendar } = await preparar();

      const cita = await agendar.ejecutar(reserva({ manicuristaId: ANA }), ACTOR);
      expect(cita.manicuristaId).toBe(ANA);
    });

    it('MANICURISTA_OCUPADA no se reintenta en otra silla: el conflicto es la persona, no el lugar', async () => {
      const { agendar } = await preparar(3);
      await agendar.ejecutar(reserva({ manicuristaId: ANA }), ACTOR);

      // Quedan 2 sillas libres, pero Ana no puede estar en dos sitios. Cambiar de silla no
      // arreglaría nada, así que el error debe salir tal cual y no como HORARIO_NO_DISPONIBLE.
      await expect(agendar.ejecutar(reserva({ manicuristaId: ANA, rangoHorario: DIEZ_Y_MEDIA }), ACTOR)).rejects.toMatchObject({
        code: 'MANICURISTA_OCUPADA',
        httpStatus: 409,
      });
    });

    it('otra manicurista en el mismo horario sí entra', async () => {
      const { agendar } = await preparar(2);
      await agendar.ejecutar(reserva({ manicuristaId: ANA }), ACTOR);

      await expect(agendar.ejecutar(reserva({ manicuristaId: BEA }), ACTOR)).resolves.toBeDefined();
    });
  });

  describe('casos límite', () => {
    it('una sucursal sin sillas configuradas falla con un error explícito, no con "no hay horario"', async () => {
      const { agendar } = await preparar(0);

      await expect(agendar.ejecutar(reserva(), ACTOR)).rejects.toMatchObject({ code: 'SUCURSAL_SIN_SILLAS' });
    });

    it('las sillas inactivas no cuentan como capacidad', async () => {
      const { agendar, sillaRepo } = await preparar(1);
      const inactiva = Silla.crear({ sucursalId: SUCURSAL, nombre: 'Lomas 2 (retirada)' });
      inactiva.desactivar();
      await sillaRepo.guardar(inactiva);

      await agendar.ejecutar(reserva(), ACTOR);

      // Hay 2 sillas en la tabla, pero solo 1 activa: la segunda reserva no cabe.
      await expect(agendar.ejecutar(reserva(), ACTOR)).rejects.toMatchObject({ code: 'HORARIO_NO_DISPONIBLE' });
    });

    it('una cita cancelada libera la silla para una reserva nueva', async () => {
      const { agendar, citaRepo } = await preparar(1);
      const cita = await agendar.ejecutar(reserva(), ACTOR);

      cita.cambiarEstado('cancelada');
      await citaRepo.guardar(cita);

      await expect(agendar.ejecutar(reserva(), ACTOR)).resolves.toBeDefined();
    });

    it('un inicio inválido se rechaza antes de tocar la base', async () => {
      // Ya no se puede pedir un rango invertido: el fin lo deriva el catálogo a partir de una
      // duración que el resolutor garantiza positiva. Lo único que puede venir mal es el inicio.
      const { agendar } = await preparar();

      await expect(agendar.ejecutar({ ...reserva(), inicio: new Date('no es fecha') }, ACTOR)).rejects.toMatchObject({
        code: 'CITA_RANGO_INVALIDO',
        httpStatus: 400,
      });
    });
  });
});

describe('AsignarManicuristaEnSucursalUseCase (integración, PostgreSQL real)', () => {
  it('la Encargada asigna la manicurista al llegar la clienta, sin mover la silla', async () => {
    const { agendar, asignar, citaRepo } = await preparar();
    const cita = await agendar.ejecutar(reserva(), ACTOR);

    const asignada = await asignar.ejecutar({ citaId: cita.id, manicuristaId: ANA }, ACTOR);

    expect(asignada.manicuristaId).toBe(ANA);
    expect(asignada.sillaId).toBe(cita.sillaId);
    expect((await citaRepo.buscarPorId(cita.id))?.manicuristaId).toBe(ANA);
  });

  it('permite CAMBIAR la manicurista ya asignada', async () => {
    const { agendar, asignar } = await preparar();
    const cita = await agendar.ejecutar(reserva({ manicuristaId: ANA }), ACTOR);

    const cambiada = await asignar.ejecutar({ citaId: cita.id, manicuristaId: BEA }, ACTOR);
    expect(cambiada.manicuristaId).toBe(BEA);
  });

  it('rechaza asignar una manicurista que ya está ocupada en otra silla a esa hora', async () => {
    const { agendar, asignar } = await preparar(2);
    await agendar.ejecutar(reserva({ manicuristaId: ANA }), ACTOR);
    const sinManicurista = await agendar.ejecutar(reserva({ rangoHorario: DIEZ_Y_MEDIA }), ACTOR);

    await expect(asignar.ejecutar({ citaId: sinManicurista.id, manicuristaId: ANA }, ACTOR)).rejects.toMatchObject({
      code: 'MANICURISTA_OCUPADA',
      httpStatus: 409,
    });
  });

  it('rechaza asignar a una cita cancelada: bloquearía a esa persona para una cita que ya no existe', async () => {
    const { agendar, asignar, citaRepo } = await preparar();
    const cita = await agendar.ejecutar(reserva(), ACTOR);
    cita.cambiarEstado('cancelada');
    await citaRepo.guardar(cita);

    await expect(asignar.ejecutar({ citaId: cita.id, manicuristaId: ANA }, ACTOR)).rejects.toMatchObject({
      code: 'CITA_SIN_HORARIO_ACTIVO',
    });
  });

  it('devuelve 404 si la cita no existe', async () => {
    const { asignar } = await preparar();

    await expect(asignar.ejecutar({ citaId: '00000000-0000-0000-0000-000000000000', manicuristaId: ANA }, ACTOR)).rejects.toMatchObject({
      code: 'RECURSO_NO_ENCONTRADO',
      httpStatus: 404,
    });
  });

  it('audita el cambio registrando la manicurista ANTERIOR, que es el dato que alguien querrá reconstruir', async () => {
    const { agendar, asignar, auditoria } = await preparar();
    const cita = await agendar.ejecutar(reserva({ manicuristaId: ANA }), ACTOR);

    await asignar.ejecutar({ citaId: cita.id, manicuristaId: BEA }, ACTOR);

    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        detalle: { accion: 'asignar_manicurista_en_sucursal', manicuristaAnterior: ANA, manicuristaNueva: BEA },
      }),
    );
  });
});
