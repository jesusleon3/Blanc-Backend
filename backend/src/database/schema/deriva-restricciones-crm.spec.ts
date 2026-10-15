import { crearBaseDeDatosDePrueba } from '../test-utils/postgres-de-prueba';
import { ESTADOS_DE_RIESGO, ESTADOS_VISIBLES_EN_AGENDA, TIPOS_DE_INCIDENTE } from './index';

/**
 * Detector de deriva de las restricciones a mano del esquema `crm` (mismo criterio que
 * `deriva-restricciones-agenda.spec.ts`).
 *
 * Drizzle no sabe expresar `CHECK`, así que los de `crm` viven como SQL a mano en la migración
 * `0011` y **no están en su snapshot**. Quien añada un estado de riesgo —`vip` está previsto—
 * tiene que editar el array de TypeScript y el `CHECK`. Esto convierte esa regla en algo que
 * falla el build.
 */
describe('Deriva de restricciones de `crm`', () => {
  const literales = (definicion: string): string[] =>
    [...definicion.matchAll(/'([^']+)'::text/g)].map((coincidencia) => coincidencia[1]);

  let definiciones: Map<string, string>;

  beforeAll(async () => {
    const db = await crearBaseDeDatosDePrueba();
    const filas = (await db.execute(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conrelid IN ('crm.clientas'::regclass, 'crm.incidentes_clienta'::regclass)`,
    )) as unknown as { conname: string; def: string }[];

    definiciones = new Map(filas.map((fila) => [fila.conname, fila.def]));
  });

  it('el `CHECK` de estados de riesgo coincide EXACTAMENTE con `ESTADOS_DE_RIESGO`', () => {
    // Si falla porque se añadió `vip`, hay que tocar también el `CHECK` — y revisar `RN-CRM-02`,
    // que lo lista pero que esta entrega dejó deliberadamente sin construir.
    const enLaBase = literales(definiciones.get('clientas_estado_de_riesgo_valido')!);
    expect([...enLaBase].sort()).toEqual([...ESTADOS_DE_RIESGO].sort());
  });

  it('el `CHECK` de tipos de incidente coincide EXACTAMENTE con `TIPOS_DE_INCIDENTE`', () => {
    const enLaBase = literales(definiciones.get('incidentes_tipo_valido')!);
    expect([...enLaBase].sort()).toEqual([...TIPOS_DE_INCIDENTE].sort());
  });

  it('una clienta BLOQUEADA no puede quedar sugerida para lista roja', () => {
    // Bloqueada es más severo que lista roja; una sugerencia pendiente sobre alguien ya bloqueada
    // invita a rebajarle la severidad al atender la alerta.
    expect(definiciones.get('clientas_sugerencia_coherente')).toBeDefined();
  });

  it('el contador de cancelaciones no puede ser negativo', () => {
    expect(definiciones.get('clientas_cancelaciones_no_negativas')).toBeDefined();
  });

  it('DOS CLIENTAS PUEDEN COMPARTIR TELÉFONO: el único índice único es nombre + teléfono', async () => {
    // Es la corrección del supuesto de `RN-CRM-01` ("el teléfono es clave única"). Si alguien
    // añadiera un índice único solo sobre `telefono`, mamá e hija dejarían de poder coexistir.
    const db = await crearBaseDeDatosDePrueba();
    const indices = (await db.execute(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'crm' AND tablename = 'clientas'`,
    )) as unknown as { indexdef: string }[];

    // Se excluye la clave primaria, que es única por definición y no dice nada del teléfono.
    const unicos = indices
      .filter((i) => i.indexdef.includes('UNIQUE') && !i.indexdef.includes('clientas_pkey'))
      .map((i) => i.indexdef);

    expect(unicos).toHaveLength(1);
    expect(unicos[0]).toContain('(nombre, telefono)');
    // Lo que de verdad se vigila: NINGUNO único sobre el teléfono a solas.
    expect(unicos.some((def) => /btree \(telefono\)/.test(def))).toBe(false);
  });

  it('un mismo incidente no se puede registrar dos veces para la misma cita', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const indices = (await db.execute(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'crm' AND tablename = 'incidentes_clienta'`,
    )) as unknown as { indexdef: string }[];

    const unico = indices.find((i) => i.indexdef.includes('incidentes_cita_tipo_unq'));
    expect(unico?.indexdef).toContain('UNIQUE');
  });

  it('`en_espera_pago` SE VE en la agenda aunque libere horario', () => {
    // El fallo que esto atrapa: filtrar la vista por "estados que ocupan" dejaba invisibles las
    // citas pendientes de anticipo — justo las que hay que perseguir para cobrarlas.
    expect(ESTADOS_VISIBLES_EN_AGENDA).toContain('en_espera_pago');
    expect(ESTADOS_VISIBLES_EN_AGENDA).not.toContain('cancelada');
    expect(ESTADOS_VISIBLES_EN_AGENDA).not.toContain('reprogramada');
  });
});
