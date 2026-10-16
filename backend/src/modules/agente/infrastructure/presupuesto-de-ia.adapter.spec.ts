import { crearBaseDeDatosDePrueba } from '../../../database/test-utils/postgres-de-prueba';
import { PresupuestoDeIaEnPostgres, TOPE_DIARIO_POR_DEFECTO } from './presupuesto-de-ia.adapter';

const AHORA = new Date('2027-03-08T17:00:00.000Z'); // 11:00 en Querétaro
/** Mismo día de pared, otra hora. */
const MAS_TARDE = new Date('2027-03-08T23:00:00.000Z'); // 17:00 en Querétaro
/** Día siguiente de pared. */
const MANANA = new Date('2027-03-09T17:00:00.000Z');

/**
 * El cortacircuitos de gasto de IA (`F-07`), contra PostgreSQL real.
 */
describe('Presupuesto de IA (`F-07`)', () => {
  const crear = async (tope?: number) => {
    const db = await crearBaseDeDatosDePrueba();
    return { db, presupuesto: new PresupuestoDeIaEnPostgres(db, tope) };
  };

  it('deja consumir mientras quede presupuesto, y cuenta cada llamada', async () => {
    const { presupuesto } = await crear(3);

    expect(await presupuesto.intentarConsumir(AHORA)).toBe(true);
    expect(await presupuesto.intentarConsumir(AHORA)).toBe(true);

    expect(await presupuesto.consumoDeHoy(AHORA)).toEqual({ llamadas: 2, tope: 3 });
  });

  it('CORTA al alcanzar el tope, y sigue cortando', async () => {
    const { presupuesto } = await crear(2);

    expect(await presupuesto.intentarConsumir(AHORA)).toBe(true);
    expect(await presupuesto.intentarConsumir(AHORA)).toBe(true);
    // La tercera ya no.
    expect(await presupuesto.intentarConsumir(AHORA)).toBe(false);
    expect(await presupuesto.intentarConsumir(AHORA)).toBe(false);

    // Y los rechazos NO incrementan el contador: solo se cuentan las llamadas que de verdad se
    // van a hacer. Si se contaran, el número dejaría de servir para estimar el gasto.
    expect(await presupuesto.consumoDeHoy(AHORA)).toEqual({ llamadas: 2, tope: 2 });
  });

  it('EL CONTADOR SOBREVIVE A UN REINICIO del proceso', async () => {
    /**
     * **La razón de que esto sea una tabla y no una variable en memoria.** Lo que `F-07` teme es
     * el gasto descontrolado por un bucle o una ráfaga, y en ese escenario lo probable es que el
     * proceso se reinicie (Railway reinicia ante un fallo). Un contador en memoria volvería a cero
     * en cada reinicio y **el tope no se alcanzaría nunca**.
     */
    const { db, presupuesto } = await crear(2);
    await presupuesto.intentarConsumir(AHORA);
    await presupuesto.intentarConsumir(AHORA);

    // Otra instancia del adaptador sobre la misma base = un proceso reiniciado.
    const despuesDelReinicio = new PresupuestoDeIaEnPostgres(db, 2);

    expect(await despuesDelReinicio.intentarConsumir(AHORA)).toBe(false);
    expect(await despuesDelReinicio.consumoDeHoy(AHORA)).toEqual({ llamadas: 2, tope: 2 });
  });

  it('EL PRESUPUESTO SE RENUEVA al cambiar el día DE PARED DE QUERÉTARO', async () => {
    /**
     * El presupuesto es diario y "el día" es el día del salón, no el día UTC. Con UTC, el corte
     * caería a las 18:00 de Querétaro —en mitad del turno de tarde— y el tope se renovaría
     * mientras el salón sigue abierto.
     */
    const { presupuesto } = await crear(1);

    expect(await presupuesto.intentarConsumir(AHORA)).toBe(true);
    // Misma fecha de pared, seis horas después: sigue agotado.
    expect(await presupuesto.intentarConsumir(MAS_TARDE)).toBe(false);
    // Día siguiente: presupuesto nuevo.
    expect(await presupuesto.intentarConsumir(MANANA)).toBe(true);

    expect(await presupuesto.consumoDeHoy(MANANA)).toEqual({ llamadas: 1, tope: 1 });
    expect(await presupuesto.consumoDeHoy(AHORA)).toEqual({ llamadas: 1, tope: 1 });
  });

  it('CONCURRENCIA: diez llamadas simultáneas con tope 5 dejan pasar exactamente 5', async () => {
    /**
     * Es la razón de que consultar e incrementar sean **un solo acto**. Con dos métodos
     * (`¿puedo?` + `registra`), las diez pasarían la comprobación antes de que ninguna
     * incrementara, y el tope no serviría de nada justo en el escenario de ráfaga que `F-07`
     * quiere atajar.
     *
     * El `INSERT … ON CONFLICT DO UPDATE … WHERE llamadas < tope` hace que PostgreSQL serialice la
     * decisión: la fila se bloquea por fila, no por la aplicación.
     */
    const { presupuesto } = await crear(5);

    const resultados = await Promise.all(Array.from({ length: 10 }, () => presupuesto.intentarConsumir(AHORA)));

    expect(resultados.filter((permitido) => permitido)).toHaveLength(5);
    expect(await presupuesto.consumoDeHoy(AHORA)).toEqual({ llamadas: 5, tope: 5 });
  });

  it('con tope 0 NO DEJA CONSUMIR NADA: es el apagado total', async () => {
    const { presupuesto } = await crear(0);

    expect(await presupuesto.intentarConsumir(AHORA)).toBe(false);
    expect(await presupuesto.consumoDeHoy(AHORA)).toEqual({ llamadas: 0, tope: 0 });
  });

  it('el tope por defecto es un valor SEGURO y finito, no ilimitado', async () => {
    /**
     * Sin `OPENAI_MAX_LLAMADAS_DIA`, el tope por defecto **existe**. Un valor por defecto
     * ilimitado haría que el cortacircuitos no protegiera a quien no lo configure — es decir, a
     * quien más lo necesita.
     */
    const { presupuesto } = await crear();

    expect(TOPE_DIARIO_POR_DEFECTO).toBeGreaterThan(0);
    expect(Number.isFinite(TOPE_DIARIO_POR_DEFECTO)).toBe(true);
    expect((await presupuesto.consumoDeHoy(AHORA)).tope).toBe(TOPE_DIARIO_POR_DEFECTO);
  });
});
