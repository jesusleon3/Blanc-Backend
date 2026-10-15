import { crearBaseDeDatosDePrueba } from '../test-utils/postgres-de-prueba';
import { ESTADOS_ANTICIPO } from './index';

/**
 * Detector de deriva de las restricciones a mano del esquema `anticipos`.
 *
 * Mismo criterio que en `agenda` y `crm`: Drizzle no sabe expresar `CHECK`, así que viven como SQL
 * a mano en la migración `0012` y **no están en su snapshot**. Aquí, además, lo que protegen es
 * dinero.
 */
describe('Deriva de restricciones de `anticipos`', () => {
  const literales = (definicion: string): string[] =>
    [...definicion.matchAll(/'([^']+)'::text/g)].map((coincidencia) => coincidencia[1]);

  let definiciones: Map<string, string>;

  beforeAll(async () => {
    const db = await crearBaseDeDatosDePrueba();
    const filas = (await db.execute(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conrelid = 'anticipos.anticipos'::regclass`,
    )) as unknown as { conname: string; def: string }[];

    definiciones = new Map(filas.map((fila) => [fila.conname, fila.def]));
  });

  it('el `CHECK` de estados coincide EXACTAMENTE con `ESTADOS_ANTICIPO`', () => {
    const enLaBase = literales(definiciones.get('anticipos_estado_valido')!);
    expect([...enLaBase].sort()).toEqual([...ESTADOS_ANTICIPO].sort());
  });

  it('UN PAGO CONFIRMADO EXIGE REFERENCIA, QUIÉN Y CUÁNDO', () => {
    // Sin referencia, un "pagado" es un pago que nadie puede verificar — y es el dato que hace
    // falta el día que la clienta afirme que sí pagó. Sin `confirmado_por`, `RN-AUD-01` queda sin
    // respuesta a "quién lo dio por bueno".
    const definicion = definiciones.get('anticipos_confirmacion_coherente')!;
    expect(definicion).toContain('referencia_pago');
    expect(definicion).toContain('confirmado_por');
    expect(definicion).toContain('confirmado_en');
  });

  it('el monto tiene que ser positivo: un anticipo de cero no es un anticipo', () => {
    expect(definiciones.get('anticipos_monto_positivo')).toBeDefined();
  });

  it('el porcentaje, si se usó, está entre 1 y 100', () => {
    expect(definiciones.get('anticipos_porcentaje_valido')).toBeDefined();
  });

  it('UN SOLO ANTICIPO POR CITA, impuesto por índice único', async () => {
    // Sin esto, dos peticiones simultáneas crearían dos anticipos de la misma cita: la clienta
    // podría pagar dos veces, o confirmarse uno y quedar el otro pendiente con la cita atascada
    // en `en_espera_pago` para siempre.
    const db = await crearBaseDeDatosDePrueba();
    const indices = (await db.execute(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'anticipos' AND tablename = 'anticipos'`,
    )) as unknown as { indexdef: string }[];

    const unico = indices.find((i) => i.indexdef.includes('anticipos_cita_unq'));
    expect(unico?.indexdef).toContain('UNIQUE');
    expect(unico?.indexdef).toContain('(cita_id)');
  });

  it('NO EXISTE NINGÚN ESTADO DE REEMBOLSO (`RN-ANT-04`)', () => {
    // *"Ningún anticipo pagado se reembolsa, bajo ninguna circunstancia."* Esa ausencia **es** la
    // regla: si alguien añadiera `reembolsado` al array, esta prueba lo señalaría para que la
    // decisión pase por modificar `RN-ANT-04` y no por un valor más en un enum.
    expect(ESTADOS_ANTICIPO).not.toContain('reembolsado');
    expect(ESTADOS_ANTICIPO).not.toContain('devuelto');
    expect(ESTADOS_ANTICIPO).toContain('retenido');
  });
});
