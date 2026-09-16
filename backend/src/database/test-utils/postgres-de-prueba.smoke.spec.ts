import { sql } from 'drizzle-orm';
import { crearBaseDeDatosDePrueba } from './postgres-de-prueba';
import { servicios, sucursales } from '../schema';

/**
 * Verifica la propia infraestructura de pruebas, no un módulo de negocio.
 *
 * El bloque de Fase 2 es el que justifica haber sustituido pg-mem: si alguna de esas tres
 * aserciones falla, el motor de Agenda **no puede probarse**, porque su invariante central
 * (`04-data-model.md` §5.1 — no-doble-booking) se apoya exactamente en esas capacidades.
 */
describe('Infraestructura de pruebas — PostgreSQL real (Testcontainers)', () => {
  it('es un PostgreSQL de verdad, versión 15 o superior', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const [fila] = await db.execute<{ version: string }>(sql`SELECT version()`);

    expect(fila.version).toMatch(/PostgreSQL/);
    const mayor = Number(/PostgreSQL (\d+)/.exec(fila.version)?.[1]);
    expect(mayor).toBeGreaterThanOrEqual(15);
  });

  it('las migraciones reales aplicaron sobre una base limpia — los 4 esquemas existen', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const filas = await db.execute<{ nspname: string }>(
      sql`SELECT nspname FROM pg_namespace
           WHERE nspname IN ('sucursales_personal', 'auditoria', 'identidad_accesos', 'catalogo_cotizacion')
           ORDER BY nspname`,
    );

    expect(filas.map((f) => f.nspname)).toEqual(['auditoria', 'catalogo_cotizacion', 'identidad_accesos', 'sucursales_personal']);
  });

  it('cada llamada entrega una base VACÍA — el aislamiento entre pruebas es real', async () => {
    const primera = await crearBaseDeDatosDePrueba();
    await primera.insert(servicios).values({
      nombre: 'Residuo',
      categoria: 'aplicacion',
      duracionBaseMinutos: 60,
      precioBaseCentavos: 1000,
    });
    expect(await primera.select().from(servicios)).toHaveLength(1);

    const segunda = await crearBaseDeDatosDePrueba();
    expect(await segunda.select().from(servicios)).toHaveLength(0);
    expect(await segunda.select().from(sucursales)).toHaveLength(0);
  });

  describe('Prerrequisitos de la FASE 2 — lo que pg-mem hacía imposible probar', () => {
    it('la extensión `btree_gist` está instalada', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const filas = await db.execute<{ extname: string }>(sql`SELECT extname FROM pg_extension WHERE extname = 'btree_gist'`);

      expect(filas).toHaveLength(1);
    });

    it('el tipo `tstzrange` existe y sus operadores funcionan', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const [fila] = await db.execute<{ se_solapan: boolean }>(
        sql`SELECT tstzrange('2026-01-01 10:00+00', '2026-01-01 11:00+00')
                && tstzrange('2026-01-01 10:30+00', '2026-01-01 11:30+00') AS se_solapan`,
      );

      expect(fila.se_solapan).toBe(true);
    });

    it('una restricción EXCLUDE USING gist impide de verdad el solapamiento (el invariante anti-doble-booking)', async () => {
      const db = await crearBaseDeDatosDePrueba();

      // Reproduce en miniatura la restricción que `agenda.citas` tendrá en la Fase 2:
      // una misma manicurista no puede tener dos rangos horarios que se solapen.
      await db.execute(sql`
        CREATE TABLE ensayo_citas (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          manicurista_id uuid NOT NULL,
          rango tstzrange NOT NULL,
          EXCLUDE USING gist (manicurista_id WITH =, rango WITH &&)
        )
      `);

      const manicurista = '11111111-1111-1111-1111-111111111111';
      await db.execute(sql`
        INSERT INTO ensayo_citas (manicurista_id, rango)
        VALUES (${manicurista}::uuid, tstzrange('2026-01-01 10:00+00', '2026-01-01 11:00+00'))
      `);

      // Misma manicurista, horario solapado → la BASE DE DATOS lo rechaza, no la aplicación.
      const solapada = db.execute(sql`
        INSERT INTO ensayo_citas (manicurista_id, rango)
        VALUES (${manicurista}::uuid, tstzrange('2026-01-01 10:30+00', '2026-01-01 11:30+00'))
      `);
      await expect(solapada).rejects.toThrow(/exclusion constraint|conflicting key value/i);

      // Otra manicurista en el mismo horario sí puede: la restricción discrimina por recurso.
      const otra = '22222222-2222-2222-2222-222222222222';
      await db.execute(sql`
        INSERT INTO ensayo_citas (manicurista_id, rango)
        VALUES (${otra}::uuid, tstzrange('2026-01-01 10:30+00', '2026-01-01 11:30+00'))
      `);

      const filas = await db.execute<{ total: string }>(sql`SELECT count(*)::text AS total FROM ensayo_citas`);
      expect(filas[0].total).toBe('2');

      await db.execute(sql`DROP TABLE ensayo_citas`);
    });
  });
});
