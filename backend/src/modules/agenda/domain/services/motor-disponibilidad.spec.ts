import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';
import { MotorDisponibilidad } from './motor-disponibilidad';
import { AgendarCitaUseCase } from '../../application/use-cases/agendar-cita.use-case';
import { ConsultarDisponibilidadUseCase } from '../../application/use-cases/consultar-disponibilidad.use-case';
import { DrizzleCitaRepository } from '../../infrastructure/persistence/drizzle-cita.repository';
import { DrizzleSillaRepository } from '../../infrastructure/persistence/drizzle-silla.repository';
import { Silla } from '../entities/silla.entity';
import { crearContextoPersonalFalso, horarioRealDeBlanc } from '../../test-utils/contexto-personal-falso';
import { ResolutorDeServicio } from './resolutor-de-servicio';
import { crearCatalogoPorDuraciones, crearContextoClientaFalso } from '../../test-utils/contexto-catalogo-falso';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';
import { crearAnticipoFalso } from '../../test-utils/anticipo-falso';

const ACTOR: ClaimsUsuario = { sub: 'encargada-1', rol: Rol.GERENTE, sucursales: 'GLOBAL', manicuristaId: null };
const SUCURSAL = '11111111-1111-1111-1111-111111111111';
const CLIENTA = '22222222-2222-2222-2222-222222222222';
const [ANA, BEA, CARO] = ['a1', 'b2', 'c3'].map((s) => `${s}000000-0000-0000-0000-00000000000${s[1]}`);

/**
 * Horas LOCALES de Querétaro (UTC-6). Se escriben así a propósito: el negocio piensa en hora de
 * pared, y usar UTC aquí haría ilegible qué se está probando.
 * 2027-03-08 es lunes; 2027-03-14 es domingo.
 */
const local = (iso: string) => new Date(`${iso}-06:00`);
const LUNES_10_11 = { inicio: local('2027-03-08T10:00:00'), fin: local('2027-03-08T11:00:00') };
const LUNES_11_13 = { inicio: local('2027-03-08T11:00:00'), fin: local('2027-03-08T13:00:00') };
const LUNES_8_9 = { inicio: local('2027-03-08T08:00:00'), fin: local('2027-03-08T09:00:00') };
const LUNES_17_19 = { inicio: local('2027-03-08T17:00:00'), fin: local('2027-03-08T19:00:00') };
const LUNES_16_17 = { inicio: local('2027-03-08T16:00:00'), fin: local('2027-03-08T17:00:00') };
const DOMINGO_10_11 = { inicio: local('2027-03-14T10:00:00'), fin: local('2027-03-14T11:00:00') };

async function preparar(opciones: { sillas?: number; manicuristas?: string[] } = {}) {
  const db = await crearBaseDeDatosDePrueba();
  const citaRepo = new DrizzleCitaRepository(db);
  const sillaRepo = new DrizzleSillaRepository(db);
  const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
  const anticipos = crearAnticipoFalso();

  for (let i = 1; i <= (opciones.sillas ?? 3); i += 1) {
    await sillaRepo.guardar(Silla.crear({ sucursalId: SUCURSAL, nombre: `Zibatá ${i}` }));
  }

  const contexto = crearContextoPersonalFalso({
    horario: horarioRealDeBlanc(),
    manicuristas: opciones.manicuristas ?? [ANA, BEA, CARO],
  });
  const motor = new MotorDisponibilidad(citaRepo, sillaRepo, contexto);

  return {
    motor,
    agendar: new AgendarCitaUseCase(
      citaRepo,
      sillaRepo,
      motor,
      new ResolutorDeServicio(CATALOGO.port),
      crearContextoClientaFalso(),
      anticipos,
      auditoria,
      crearUnitOfWorkFalso(),
    ),
    consultar: new ConsultarDisponibilidadUseCase(motor),
    /**
     * Otro motor sobre LA MISMA base, con otro personal operativo. Es como se simula el efecto de
     * una ausencia sin tener que montar el Bounded Context de Personal: las citas ya vendidas
     * siguen ahí y lo único que cambia es quién está para atenderlas.
     */
    motorCon: (manicuristas: string[]) =>
      new MotorDisponibilidad(
        citaRepo,
        sillaRepo,
        crearContextoPersonalFalso({ horario: horarioRealDeBlanc(), manicuristas }),
      ),
  };
}

/**
 * El `servicioId` se elige según el tamaño del rango que la prueba quiere ocupar: el fin lo deriva
 * el catálogo, así que pedir dos horas exige un servicio de dos horas.
 */
const CATALOGO = crearCatalogoPorDuraciones([30, 60, 120]);

const reserva = (rangoHorario = LUNES_10_11, extra = {}) => ({
  sucursalId: SUCURSAL,
  servicioId: CATALOGO.idPara(Math.round((rangoHorario.fin.getTime() - rangoHorario.inicio.getTime()) / 60_000)),
  clientaId: CLIENTA,
  inicio: rangoHorario.inicio,
  fin: rangoHorario.fin,
  ...extra,
});

describe('MotorDisponibilidad — RN-AGE-10 y RN-AGE-12 (horario de sucursal)', () => {
  it('ACEPTA una cita dentro de un bloque', async () => {
    const { agendar } = await preparar();
    await expect(agendar.ejecutar(reserva(), ACTOR)).resolves.toBeDefined();
  });

  it('RN-AGE-12: RECHAZA el domingo — y no por una regla en código, sino por 0 bloques configurados', async () => {
    const { agendar } = await preparar();
    await expect(agendar.ejecutar(reserva(DOMINGO_10_11), ACTOR)).rejects.toMatchObject({ code: 'SUCURSAL_CERRADA_ESE_DIA' });
  });

  it('RN-AGE-10: RECHAZA una cita que CRUZA el corte de mediodía (11:00–13:00 sobre el corte de las 12:00)', async () => {
    const { agendar } = await preparar();

    // Es el ejemplo literal de la Dueña: "no se puede agendar una cita de 2 horas a las 11am
    // porque después de las 12 no se trabaja".
    await expect(agendar.ejecutar(reserva(LUNES_11_13), ACTOR)).rejects.toMatchObject({ code: 'FUERA_DEL_HORARIO_DE_SUCURSAL' });
  });

  it.each([
    ['antes de abrir (8:00)', LUNES_8_9],
    ['pasado el cierre (17:00–19:00)', LUNES_17_19],
    ['dentro del corte (16:00 está bien, pero 12:30 no)', { inicio: local('2027-03-08T12:30:00'), fin: local('2027-03-08T13:00:00') }],
  ])('RECHAZA una cita %s', async (_caso, rango) => {
    const { agendar } = await preparar();
    await expect(agendar.ejecutar(reserva(rango), ACTOR)).rejects.toMatchObject({ code: 'FUERA_DEL_HORARIO_DE_SUCURSAL' });
  });

  it('ACEPTA el bloque de la tarde (16:00–17:00)', async () => {
    const { agendar } = await preparar();
    await expect(agendar.ejecutar(reserva(LUNES_16_17), ACTOR)).resolves.toBeDefined();
  });
});

describe('MotorDisponibilidad — capacidad efectiva MIN(sillas, manicuristas) — DEC-035', () => {
  it('EL ESCENARIO CLAVE: 3 sillas, 3 manicuristas, 1 ausente → entran 2 citas y la 3ª se rechaza', async () => {
    // La manicurista ausente se refleja devolviendo solo 2 operativas, que es lo que el adaptador
    // real calcula a partir de las excepciones de personal.
    const { agendar, consultar } = await preparar({ sillas: 3, manicuristas: [ANA, BEA] });

    await expect(agendar.ejecutar(reserva(), ACTOR)).resolves.toBeDefined();
    await expect(agendar.ejecutar(reserva(), ACTOR)).resolves.toBeDefined();

    const antes = await consultar.ejecutar({ sucursalId: SUCURSAL, rangoHorario: LUNES_10_11 });
    expect(antes).toMatchObject({ sillasLibres: 1, manicuristasDisponibles: 0, capacidad: 0, hayLugar: false });

    // La silla 3 está FÍSICAMENTE VACÍA, y aun así no se puede agendar: no hay manos.
    await expect(agendar.ejecutar(reserva(), ACTOR)).rejects.toMatchObject({ code: 'HORARIO_NO_DISPONIBLE' });
  });

  it('el mensaje distingue "sin manos" de "sin sillas" — son conversaciones distintas con la clienta', async () => {
    const { agendar } = await preparar({ sillas: 3, manicuristas: [ANA] });
    await agendar.ejecutar(reserva(), ACTOR);

    await expect(agendar.ejecutar(reserva(), ACTOR)).rejects.toThrow(/manicuristas disponibles/i);
  });

  it('con sillas como factor limitante, el motivo es el otro', async () => {
    const { agendar, consultar } = await preparar({ sillas: 1, manicuristas: [ANA, BEA, CARO] });
    await agendar.ejecutar(reserva(), ACTOR);

    const resultado = await consultar.ejecutar({ sucursalId: SUCURSAL, rangoHorario: LUNES_10_11 });
    expect(resultado).toMatchObject({ sillasLibres: 0, hayLugar: false, motivo: 'SIN_SILLAS_LIBRES' });
  });

  it('una cita con manicurista nombrada descuenta a ESA persona, no a cualquiera', async () => {
    const { agendar, consultar } = await preparar({ sillas: 3, manicuristas: [ANA, BEA, CARO] });
    await agendar.ejecutar(reserva(LUNES_10_11, { manicuristaId: ANA }), ACTOR);

    const resultado = await consultar.ejecutar({ sucursalId: SUCURSAL, rangoHorario: LUNES_10_11 });
    expect(resultado.manicuristasDisponibles).toBe(2);
  });

  it('una cita SIN manicurista también consume una persona: alguien tendrá que atenderla', async () => {
    const { agendar, consultar } = await preparar({ sillas: 3, manicuristas: [ANA, BEA, CARO] });
    await agendar.ejecutar(reserva(), ACTOR);

    // Ignorar esto haría que el motor ofreciera más huecos de los que hay manos para atender.
    const resultado = await consultar.ejecutar({ sucursalId: SUCURSAL, rangoHorario: LUNES_10_11 });
    expect(resultado.manicuristasDisponibles).toBe(2);
  });

  it('una sucursal sin sillas configuradas da un error de configuración, no "no hay lugar"', async () => {
    const { agendar } = await preparar({ sillas: 0 });
    await expect(agendar.ejecutar(reserva(), ACTOR)).rejects.toMatchObject({ code: 'SUCURSAL_SIN_SILLAS' });
  });

  describe('`deficitDePersonal` — el aviso que `capacidad` no puede dar', () => {
    it('es 0 mientras el personal alcance para las citas ya vendidas', async () => {
      const { motor, agendar } = await preparar({ sillas: 3, manicuristas: [ANA, BEA, CARO] });
      await agendar.ejecutar(reserva(), ACTOR);

      expect((await motor.calcularCapacidad(SUCURSAL, LUNES_10_11)).deficitDePersonal).toBe(0);
    });

    it('CUENTA LAS CITAS QUE SE QUEDAN SIN MANOS, que es lo que `capacidad` no puede expresar', async () => {
      const { agendar, motorCon } = await preparar({ sillas: 3, manicuristas: [ANA, BEA] });
      await agendar.ejecutar(reserva(), ACTOR);
      await agendar.ejecutar(reserva(), ACTOR);

      // Con las dos manicuristas, las dos citas están cubiertas: no hay déficit.
      expect((await motorCon([ANA, BEA]).calcularCapacidad(SUCURSAL, LUNES_10_11)).deficitDePersonal).toBe(0);

      // Si BEA falta, una de las dos citas se queda sin quién la atienda.
      const trasLaAusencia = await motorCon([ANA]).calcularCapacidad(SUCURSAL, LUNES_10_11);
      expect(trasLaAusencia.deficitDePersonal).toBe(1);

      // Y aquí está el motivo de que sea un campo aparte: `capacidad` vale 0 en LOS DOS casos,
      // porque se recorta. Por sí sola no distingue "justo lleno" de "pasado de rosca" — y esa
      // distinción es toda la pregunta al registrar una ausencia.
      expect(trasLaAusencia.capacidad).toBe(0);
      expect((await motorCon([ANA, BEA]).calcularCapacidad(SUCURSAL, LUNES_10_11)).capacidad).toBe(0);
    });
  });

  it('un horario libre reporta capacidad completa', async () => {
    const { consultar } = await preparar({ sillas: 3, manicuristas: [ANA, BEA, CARO] });

    const resultado = await consultar.ejecutar({ sucursalId: SUCURSAL, rangoHorario: LUNES_10_11 });
    expect(resultado).toMatchObject({ sillasLibres: 3, manicuristasDisponibles: 3, capacidad: 3, hayLugar: true });
  });
});

describe('ConsultarDisponibilidadUseCase — lo que preguntará el bot', () => {
  it('no lanza ante un horario inválido: devuelve el motivo para poder explicárselo a la clienta', async () => {
    const { consultar } = await preparar();

    const resultado = await consultar.ejecutar({ sucursalId: SUCURSAL, rangoHorario: DOMINGO_10_11 });
    expect(resultado).toMatchObject({ hayLugar: false, motivo: 'SUCURSAL_CERRADA_ESE_DIA' });
  });

  it('informa del cruce de corte sin reservar nada', async () => {
    const { consultar } = await preparar();

    const resultado = await consultar.ejecutar({ sucursalId: SUCURSAL, rangoHorario: LUNES_11_13 });
    expect(resultado).toMatchObject({ hayLugar: false, motivo: 'FUERA_DEL_HORARIO_DE_SUCURSAL' });
  });
});
