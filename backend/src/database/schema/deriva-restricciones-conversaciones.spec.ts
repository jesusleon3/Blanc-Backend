import { crearBaseDeDatosDePrueba } from '../test-utils/postgres-de-prueba';
import { DIRECCIONES_MENSAJE, EMISORES_MENSAJE, ESTADOS_ENTREGA, MODOS_CONVERSACION, MOTIVOS_DE_ESCALAMIENTO, TIPOS_MENSAJE } from './index';

/**
 * Detector de deriva de las restricciones a mano del esquema `conversaciones`.
 *
 * Mismo criterio que en `agenda`, `crm` y `anticipos`: Drizzle no sabe expresar `CHECK`, así que
 * viven como SQL a mano en la migración `0013` y **no están en su snapshot**.
 */
describe('Deriva de restricciones de `conversaciones`', () => {
  const literales = (definicion: string): string[] =>
    [...definicion.matchAll(/'([^']+)'::text/g)].map((coincidencia) => coincidencia[1]);

  let definiciones: Map<string, string>;

  beforeAll(async () => {
    const db = await crearBaseDeDatosDePrueba();
    const filas = (await db.execute(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conrelid IN ('conversaciones.conversaciones'::regclass, 'conversaciones.mensajes'::regclass)`,
    )) as unknown as { conname: string; def: string }[];

    definiciones = new Map(filas.map((fila) => [fila.conname, fila.def]));
  });

  it.each([
    ['conversaciones_modo_valido', MODOS_CONVERSACION],
    ['conversaciones_motivo_valido', MOTIVOS_DE_ESCALAMIENTO],
    ['mensajes_direccion_valida', DIRECCIONES_MENSAJE],
    ['mensajes_emisor_valido', EMISORES_MENSAJE],
    ['mensajes_tipo_valido', TIPOS_MENSAJE],
    ['mensajes_estado_entrega_valido', ESTADOS_ENTREGA],
  ])('el `CHECK` %s coincide EXACTAMENTE con su array de TypeScript', (nombre, esperados) => {
    const enLaBase = literales(definiciones.get(nombre as string)!);
    expect([...enLaBase].sort()).toEqual([...(esperados as readonly string[])].sort());
  });

  it('EL MODO Y SU MOTIVO VAN JUNTOS', () => {
    // `humano` sin motivo sería una conversación escalada que nadie sabe por qué — y la categoría
    // es justo lo que la Dueña mira para saber qué se le escapa al bot. Un motivo con modo `bot`
    // sería un residuo de un retorno de control mal hecho.
    const definicion = definiciones.get('conversaciones_escalamiento_coherente')!;
    expect(definicion).toContain('motivo_de_escalamiento');
    expect(definicion).toContain('escalada_en');
  });

  it('DIRECCIÓN Y EMISOR SON COHERENTES: solo la clienta emite entrantes', () => {
    // Sin esto, un "entrante del bot" pasaría y falsearía el hilo.
    expect(definiciones.get('mensajes_direccion_emisor_coherentes')).toBeDefined();
  });

  it('UN ENTRANTE SIEMPRE TRAE SU `wamid`: es lo que permite deduplicar reintentos', () => {
    // Si pudiera ser `NULL`, un reintento de Meta se colaría sin que el índice único lo viera.
    expect(definiciones.get('mensajes_entrante_con_wamid')).toBeDefined();
  });

  it('EL ÍNDICE ÚNICO DE `wamid` EXISTE Y ES PARCIAL', async () => {
    // Es la deduplicación de reintentos de Meta, impuesta en la base y no en el código: dos
    // reintentos simultáneos pasarían los dos cualquier comprobación previa en memoria.
    const db = await crearBaseDeDatosDePrueba();
    const indices = (await db.execute(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'conversaciones' AND tablename = 'mensajes'`,
    )) as unknown as { indexdef: string }[];

    const unico = indices.find((i) => i.indexdef.includes('mensajes_wamid_unq'));
    expect(unico?.indexdef).toContain('UNIQUE');
    expect(unico?.indexdef).toContain('wamid IS NOT NULL');
  });

  it('UNA CONVERSACIÓN POR SUCURSAL Y TELÉFONO', async () => {
    // Sin esto, dos webhooks simultáneos de la misma clienta crearían dos hilos y el historial
    // quedaría partido por la mitad en la bandeja.
    const db = await crearBaseDeDatosDePrueba();
    const indices = (await db.execute(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'conversaciones' AND tablename = 'conversaciones'`,
    )) as unknown as { indexdef: string }[];

    const unico = indices.find((i) => i.indexdef.includes('conversaciones_sucursal_telefono_unq'));
    expect(unico?.indexdef).toContain('UNIQUE');
    expect(unico?.indexdef).toContain('sucursal_id');
    expect(unico?.indexdef).toContain('telefono_clienta');
  });

  it('NO EXISTE NINGUNA COLUMNA DE EXPIRACIÓN DEL MODO `humano` (`RN-ESC-03`)', async () => {
    /**
     * *"Retorno de control siempre explícito."* **Esa ausencia es la regla**, y por eso se vigila
     * como se vigila un `CHECK`: si alguien añadiera una columna de caducidad de modo, el bot
     * podría recuperar una conversación escalada por tiempo — y una clienta que pidió hablar con
     * alguien y recibe de nuevo al bot a los diez minutos concluye, con razón, que nadie la
     * escuchó. Si hace falta esa columna, la decisión pasa por modificar `RN-ESC-03`, no por un
     * `ALTER TABLE`.
     */
    const db = await crearBaseDeDatosDePrueba();
    const columnas = (await db.execute(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'conversaciones' AND table_name = 'conversaciones'`,
    )) as unknown as { column_name: string }[];

    const nombres = columnas.map((c) => c.column_name);
    expect(nombres).toContain('modo');
    expect(nombres).toContain('escalada_en');
    for (const sospechosa of ['modo_expira_en', 'expira_modo_en', 'modo_vence_en', 'retorno_automatico_en']) {
      expect(nombres).not.toContain(sospechosa);
    }
  });
});
