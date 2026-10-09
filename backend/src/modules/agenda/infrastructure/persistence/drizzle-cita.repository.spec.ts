import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';
import { DrizzleCitaRepository } from './drizzle-cita.repository';
import { DrizzleSillaRepository } from './drizzle-silla.repository';
import { Cita } from '../../domain/entities/cita.entity';
import { Silla } from '../../domain/entities/silla.entity';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';
import { Database } from '../../../../database/connection';

const SUCURSAL = '11111111-1111-1111-1111-111111111111';
const CLIENTA = '22222222-2222-2222-2222-222222222222';
const SERVICIO = '33333333-3333-3333-3333-333333333333';
const ANA = '44444444-4444-4444-4444-444444444444';
const BEA = '55555555-5555-5555-5555-555555555555';

const rango = (inicioIso: string, finIso: string) => ({ inicio: new Date(inicioIso), fin: new Date(finIso) });
const DIEZ_A_ONCE = rango('2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z');
const DIEZ_Y_MEDIA = rango('2026-11-02T10:30:00Z', '2026-11-02T11:30:00Z');
const ONCE_A_DOCE = rango('2026-11-02T11:00:00Z', '2026-11-02T12:00:00Z');

async function preparar(): Promise<{ db: Database; citaRepo: DrizzleCitaRepository; sillaRepo: DrizzleSillaRepository; sillas: Silla[] }> {
  const db = await crearBaseDeDatosDePrueba();
  const sillaRepo = new DrizzleSillaRepository(db);
  const citaRepo = new DrizzleCitaRepository(db);

  const sillas = [Silla.crear({ sucursalId: SUCURSAL, nombre: 'Lomas 1' }), Silla.crear({ sucursalId: SUCURSAL, nombre: 'Lomas 2' })];
  for (const silla of sillas) await sillaRepo.guardar(silla);

  return { db, citaRepo, sillaRepo, sillas };
}

function nuevaCita(sillaId: string, horario = DIEZ_A_ONCE, manicuristaId: string | null = null) {
  return Cita.crear({ sucursalId: SUCURSAL, sillaId, clientaId: CLIENTA, servicioId: SERVICIO, rangoHorario: horario, manicuristaId });
}

describe('DrizzleCitaRepository (integración, PostgreSQL real)', () => {
  it('guarda y recupera una cita con el rango horario intacto', async () => {
    const { citaRepo, sillas } = await preparar();
    const cita = nuevaCita(sillas[0].id);

    await citaRepo.guardar(cita);
    const recuperada = await citaRepo.buscarPorId(cita.id);

    expect(recuperada?.id).toBe(cita.id);
    expect(recuperada?.sillaId).toBe(sillas[0].id);
    expect(recuperada?.manicuristaId).toBeNull();
    expect(recuperada?.estado).toBe('agendada');
    // El customType debe reconstruir Date, no devolver la cadena cruda de PostgreSQL.
    expect(recuperada?.rangoHorario.inicio).toBeInstanceOf(Date);
    expect(recuperada?.rangoHorario.inicio.toISOString()).toBe('2026-11-02T10:00:00.000Z');
    expect(recuperada?.rangoHorario.fin.toISOString()).toBe('2026-11-02T11:00:00.000Z');
  });

  describe('El 23P01 crudo nunca sale: se traduce a un error accionable', () => {
    it('silla ocupada → ConflictoDeNegocioError SILLA_OCUPADA (409)', async () => {
      const { citaRepo, sillas } = await preparar();
      await citaRepo.guardar(nuevaCita(sillas[0].id));

      const intento = citaRepo.guardar(nuevaCita(sillas[0].id, DIEZ_Y_MEDIA));

      await expect(intento).rejects.toThrow(ConflictoDeNegocioError);
      await expect(intento).rejects.toMatchObject({ code: 'SILLA_OCUPADA', httpStatus: 409 });
    });

    it('manicurista ocupada → MANICURISTA_OCUPADA, no SILLA_OCUPADA', async () => {
      const { citaRepo, sillas } = await preparar();
      await citaRepo.guardar(nuevaCita(sillas[0].id, DIEZ_A_ONCE, ANA));

      // La silla 2 está libre; lo que choca es Ana. Distinguir importa: "no hay lugar" y "esa
      // manicurista está ocupada" llevan a conversaciones distintas con la clienta.
      const intento = citaRepo.guardar(nuevaCita(sillas[1].id, DIEZ_A_ONCE, ANA));

      await expect(intento).rejects.toMatchObject({ code: 'MANICURISTA_OCUPADA', httpStatus: 409 });
    });
  });

  it('acepta el mismo horario en sillas distintas y citas consecutivas en la misma silla', async () => {
    const { citaRepo, sillas } = await preparar();

    await citaRepo.guardar(nuevaCita(sillas[0].id, DIEZ_A_ONCE));
    await expect(citaRepo.guardar(nuevaCita(sillas[1].id, DIEZ_A_ONCE))).resolves.toBeUndefined();
    await expect(citaRepo.guardar(nuevaCita(sillas[0].id, ONCE_A_DOCE))).resolves.toBeUndefined();
  });

  it('dos citas SIN manicurista en sillas distintas conviven — el caso que justifica el patrón', async () => {
    const { citaRepo, sillas } = await preparar();

    await citaRepo.guardar(nuevaCita(sillas[0].id, DIEZ_A_ONCE, null));
    await expect(citaRepo.guardar(nuevaCita(sillas[1].id, DIEZ_A_ONCE, null))).resolves.toBeUndefined();
  });

  describe('listarQueOcupanEnRango', () => {
    it('devuelve las que se solapan y excluye las que liberan el horario', async () => {
      const { citaRepo, sillas } = await preparar();

      const vigente = nuevaCita(sillas[0].id, DIEZ_A_ONCE);
      const cancelada = nuevaCita(sillas[1].id, DIEZ_A_ONCE);
      cancelada.cambiarEstado('cancelada');
      await citaRepo.guardar(vigente);
      await citaRepo.guardar(cancelada);

      const ocupadas = await citaRepo.listarQueOcupanEnRango(SUCURSAL, DIEZ_Y_MEDIA);

      expect(ocupadas.map((c) => c.id)).toEqual([vigente.id]);
    });

    it('no devuelve una cita adyacente que solo toca el borde', async () => {
      const { citaRepo, sillas } = await preparar();
      await citaRepo.guardar(nuevaCita(sillas[0].id, DIEZ_A_ONCE));

      // `[)` — la de 10-11 no se solapa con la ventana 11-12.
      expect(await citaRepo.listarQueOcupanEnRango(SUCURSAL, ONCE_A_DOCE)).toHaveLength(0);
    });
  });

  describe('tieneCitasFuturasQueOcupan — alimentará VerificarCitasFuturasPort (DEC-032)', () => {
    it('detecta una cita futura de esa manicurista', async () => {
      const { citaRepo, sillas } = await preparar();
      await citaRepo.guardar(nuevaCita(sillas[0].id, DIEZ_A_ONCE, ANA));

      expect(await citaRepo.tieneCitasFuturasQueOcupan(ANA, new Date('2026-11-01T00:00:00Z'))).toBe(true);
      expect(await citaRepo.tieneCitasFuturasQueOcupan(BEA, new Date('2026-11-01T00:00:00Z'))).toBe(false);
    });

    it('ignora las citas pasadas y las que liberan el horario', async () => {
      const { citaRepo, sillas } = await preparar();
      const cancelada = nuevaCita(sillas[0].id, DIEZ_A_ONCE, ANA);
      cancelada.cambiarEstado('cancelada');
      await citaRepo.guardar(cancelada);

      // Cancelada → no cuenta. Y con un corte posterior, tampoco contaría aunque estuviera viva.
      expect(await citaRepo.tieneCitasFuturasQueOcupan(ANA, new Date('2026-11-01T00:00:00Z'))).toBe(false);
      expect(await citaRepo.tieneCitasFuturasQueOcupan(ANA, new Date('2026-12-01T00:00:00Z'))).toBe(false);
    });
  });

  it('asignar manicurista en mostrador persiste vía guardar (upsert), sin duplicar la fila', async () => {
    const { citaRepo, sillas } = await preparar();
    const cita = nuevaCita(sillas[0].id, DIEZ_A_ONCE, null);
    await citaRepo.guardar(cita);

    cita.asignarManicurista(ANA);
    await citaRepo.guardar(cita);

    expect((await citaRepo.buscarPorId(cita.id))?.manicuristaId).toBe(ANA);
    expect(await citaRepo.listarQueOcupanEnRango(SUCURSAL, DIEZ_A_ONCE)).toHaveLength(1);
  });
});

describe('DrizzleSillaRepository (integración, PostgreSQL real)', () => {
  it('cuenta solo las sillas ACTIVAS — es la mitad izquierda de MIN(sillas, manicuristas) de DEC-035', async () => {
    const { sillaRepo } = await preparar();
    expect(await sillaRepo.contarActivasPorSucursal(SUCURSAL)).toBe(2);

    const tercera = Silla.crear({ sucursalId: SUCURSAL, nombre: 'Lomas 3' });
    tercera.desactivar();
    await sillaRepo.guardar(tercera);

    expect(await sillaRepo.contarActivasPorSucursal(SUCURSAL)).toBe(2);
    expect(await sillaRepo.listarPorSucursal(SUCURSAL)).toHaveLength(3);
  });

  it('no cuenta sillas de otra sucursal', async () => {
    const { sillaRepo } = await preparar();
    await sillaRepo.guardar(Silla.crear({ sucursalId: '99999999-9999-9999-9999-999999999999', nombre: 'Zibatá 1' }));

    expect(await sillaRepo.contarActivasPorSucursal(SUCURSAL)).toBe(2);
  });
});
