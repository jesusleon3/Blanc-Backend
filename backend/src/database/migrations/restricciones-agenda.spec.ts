import { sql } from 'drizzle-orm';
import { crearBaseDeDatosDePrueba } from '../test-utils/postgres-de-prueba';
import { Database } from '../connection';

/**
 * Verifica que las restricciones `EXCLUDE USING gist` de la migración `0005` **realmente**
 * impiden el doble-booking en PostgreSQL.
 *
 * POR QUÉ ESTA PRUEBA ES DISTINTA A LAS DEMÁS: no prueba código de Blanc, prueba **SQL**. Las dos
 * restricciones son el invariante más crítico del sistema (`04-data-model.md` §5.1) y están
 * escritas a mano en la migración, fuera del alcance de Drizzle y del compilador de TypeScript.
 * Nada más que esta prueba las cubre: un error de tipeo en el `WHERE` no rompería ninguna otra
 * cosa, y el sistema vendería el mismo hueco dos veces en silencio.
 *
 * Corre contra PostgreSQL real (Testcontainers) porque `pg-mem` no soporta `tstzrange`, no parsea
 * `EXCLUDE USING gist` ni conoce `btree_gist` — el motivo por el que se sustituyó.
 */

const SUCURSAL = '11111111-1111-1111-1111-111111111111';
const CLIENTA = '22222222-2222-2222-2222-222222222222';
const SERVICIO = '33333333-3333-3333-3333-333333333333';
const ANA = '44444444-4444-4444-4444-444444444444';
const BEA = '55555555-5555-5555-5555-555555555555';

/** 10:00–11:00 y sus vecinos, en UTC para que la prueba no dependa de la zona de la máquina. */
const DIEZ_A_ONCE = ['2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z'] as const;
const DIEZ_Y_MEDIA_A_ONCE_Y_MEDIA = ['2026-11-02T10:30:00Z', '2026-11-02T11:30:00Z'] as const;
const ONCE_A_DOCE = ['2026-11-02T11:00:00Z', '2026-11-02T12:00:00Z'] as const;

async function crearSilla(db: Database, nombre: string): Promise<string> {
  const filas = await db.execute<{ id: string }>(
    sql`INSERT INTO agenda.sillas (sucursal_id, nombre) VALUES (${SUCURSAL}::uuid, ${nombre}) RETURNING id`,
  );
  return filas[0].id;
}

function insertarCita(
  db: Database,
  opciones: { sillaId: string; rango: readonly [string, string]; manicuristaId?: string | null; estado?: string },
) {
  const { sillaId, rango, manicuristaId = null, estado = 'agendada' } = opciones;
  return db.execute(sql`
    INSERT INTO agenda.citas (sucursal_id, silla_id, manicurista_id, clienta_id, servicio_id, rango_horario, estado)
    VALUES (
      ${SUCURSAL}::uuid, ${sillaId}::uuid, ${manicuristaId}::uuid, ${CLIENTA}::uuid, ${SERVICIO}::uuid,
      tstzrange(${rango[0]}::timestamptz, ${rango[1]}::timestamptz, '[)'), ${estado}
    )
  `);
}

describe('Restricciones de exclusión de `agenda.citas` (migración 0005)', () => {
  describe('Prerrequisitos de la migración', () => {
    it('la extensión `btree_gist` quedó instalada', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const filas = await db.execute<{ extname: string }>(sql`SELECT extname FROM pg_extension WHERE extname = 'btree_gist'`);
      expect(filas).toHaveLength(1);
    });

    it('las dos restricciones existen en la tabla, y son de tipo exclusión', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const filas = await db.execute<{ conname: string; contype: string }>(sql`
        SELECT conname, contype FROM pg_constraint
         WHERE conrelid = 'agenda.citas'::regclass AND contype = 'x'
         ORDER BY conname
      `);

      expect(filas.map((f) => f.conname)).toEqual(['citas_manicurista_sin_solapamiento', 'citas_silla_sin_solapamiento']);
    });

    it('el CHECK de estado rechaza un valor fuera de la lista', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const silla = await crearSilla(db, 'Lomas 1');

      await expect(insertarCita(db, { sillaId: silla, rango: DIEZ_A_ONCE, estado: 'inventado' })).rejects.toThrow(
        /citas_estado_valido|check constraint/i,
      );
    });
  });

  describe('(a) Capacidad física — una silla, una cita a la vez', () => {
    it('RECHAZA dos citas solapadas en la MISMA silla', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const silla = await crearSilla(db, 'Lomas 1');

      await insertarCita(db, { sillaId: silla, rango: DIEZ_A_ONCE });

      await expect(insertarCita(db, { sillaId: silla, rango: DIEZ_Y_MEDIA_A_ONCE_Y_MEDIA })).rejects.toThrow(
        /citas_silla_sin_solapamiento|exclusion constraint/i,
      );
    });

    it('ACEPTA el mismo horario en sillas DISTINTAS — es lo que permite atender a varias clientas a la vez', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const silla1 = await crearSilla(db, 'Lomas 1');
      const silla2 = await crearSilla(db, 'Lomas 2');

      await insertarCita(db, { sillaId: silla1, rango: DIEZ_A_ONCE });
      await expect(insertarCita(db, { sillaId: silla2, rango: DIEZ_A_ONCE })).resolves.toBeDefined();
    });

    it('ACEPTA citas consecutivas: la que termina a las 11:00 no choca con la que empieza a las 11:00', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const silla = await crearSilla(db, 'Lomas 1');

      await insertarCita(db, { sillaId: silla, rango: DIEZ_A_ONCE });

      // El rango es `[inicio, fin)` — fin EXCLUSIVO. Con `]` el salón no podría encadenar citas.
      await expect(insertarCita(db, { sillaId: silla, rango: ONCE_A_DOCE })).resolves.toBeDefined();
    });

    it('LA CAPACIDAD DE LA SUCURSAL EMERGE DEL ESQUEMA: con 3 sillas, la cuarta cita simultánea se rechaza', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const sillas = [await crearSilla(db, 'Lomas 1'), await crearSilla(db, 'Lomas 2'), await crearSilla(db, 'Lomas 3')];

      for (const silla of sillas) {
        await insertarCita(db, { sillaId: silla, rango: DIEZ_A_ONCE });
      }

      // No hay contador en la aplicación: simplemente no queda silla libre que no choque.
      for (const silla of sillas) {
        await expect(insertarCita(db, { sillaId: silla, rango: DIEZ_A_ONCE })).rejects.toThrow(/exclusion constraint|sin_solapamiento/i);
      }
    });
  });

  describe('(b) La manicurista nombrada no se duplica', () => {
    it('RECHAZA a la misma manicurista en dos sillas distintas a la misma hora', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const silla1 = await crearSilla(db, 'Lomas 1');
      const silla2 = await crearSilla(db, 'Lomas 2');

      await insertarCita(db, { sillaId: silla1, rango: DIEZ_A_ONCE, manicuristaId: ANA });

      // La silla 2 está libre, pero Ana no puede estar en dos sitios.
      await expect(insertarCita(db, { sillaId: silla2, rango: DIEZ_A_ONCE, manicuristaId: ANA })).rejects.toThrow(
        /citas_manicurista_sin_solapamiento|exclusion constraint/i,
      );
    });

    it('ACEPTA manicuristas distintas en el mismo horario', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const silla1 = await crearSilla(db, 'Lomas 1');
      const silla2 = await crearSilla(db, 'Lomas 2');

      await insertarCita(db, { sillaId: silla1, rango: DIEZ_A_ONCE, manicuristaId: ANA });
      await expect(insertarCita(db, { sillaId: silla2, rango: DIEZ_A_ONCE, manicuristaId: BEA })).resolves.toBeDefined();
    });

    it('EL CASO QUE JUSTIFICA TODO EL PATRÓN: dos citas SIN manicurista no se bloquean entre sí por la regla (b)', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const silla1 = await crearSilla(db, 'Lomas 1');
      const silla2 = await crearSilla(db, 'Lomas 2');

      // `NULL = NULL` da NULL, no TRUE: la restricción (b) NUNCA se dispara entre filas nulas.
      // Sin Sillas Virtuales esto habría permitido citas simultáneas ILIMITADAS. Con ellas, el
      // límite lo pone la restricción (a) — ver el test de capacidad de arriba.
      await insertarCita(db, { sillaId: silla1, rango: DIEZ_A_ONCE, manicuristaId: null });
      await expect(insertarCita(db, { sillaId: silla2, rango: DIEZ_A_ONCE, manicuristaId: null })).resolves.toBeDefined();
    });

    it('asignar manicurista al llegar la clienta (UPDATE) también queda validado por la restricción', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const silla1 = await crearSilla(db, 'Lomas 1');
      const silla2 = await crearSilla(db, 'Lomas 2');

      await insertarCita(db, { sillaId: silla1, rango: DIEZ_A_ONCE, manicuristaId: ANA });
      await insertarCita(db, { sillaId: silla2, rango: DIEZ_A_ONCE, manicuristaId: null });

      // `DEC-031` §2.4: la Encargada asigna la manicurista real al llegar la clienta. Si elige a
      // Ana, que ya está ocupada, lo rechaza la base de datos — sin lógica duplicada.
      const asignacion = db.execute(sql`
        UPDATE agenda.citas SET manicurista_id = ${ANA}::uuid
         WHERE silla_id = ${silla2}::uuid
      `);
      await expect(asignacion).rejects.toThrow(/citas_manicurista_sin_solapamiento|exclusion constraint/i);
    });
  });

  describe('Estados que liberan el horario (`DEC-034`)', () => {
    it.each(['cancelada', 'expirada', 'reprogramada'])('un estado `%s` LIBERA la silla para otra cita', async (estado) => {
      const db = await crearBaseDeDatosDePrueba();
      const silla = await crearSilla(db, 'Lomas 1');

      await insertarCita(db, { sillaId: silla, rango: DIEZ_A_ONCE, estado });
      await expect(insertarCita(db, { sillaId: silla, rango: DIEZ_A_ONCE })).resolves.toBeDefined();
    });

    it.each(['agendada', 'en_espera_pago', 'completada'])('un estado `%s` SIGUE OCUPANDO la silla', async (estado) => {
      const db = await crearBaseDeDatosDePrueba();
      const silla = await crearSilla(db, 'Lomas 1');

      await insertarCita(db, { sillaId: silla, rango: DIEZ_A_ONCE, estado });
      await expect(insertarCita(db, { sillaId: silla, rango: DIEZ_A_ONCE })).rejects.toThrow(/exclusion constraint|sin_solapamiento/i);
    });

    it('cancelar una cita libera el hueco de inmediato (el UPDATE desactiva la restricción para esa fila)', async () => {
      const db = await crearBaseDeDatosDePrueba();
      const silla = await crearSilla(db, 'Lomas 1');

      await insertarCita(db, { sillaId: silla, rango: DIEZ_A_ONCE });
      await db.execute(sql`UPDATE agenda.citas SET estado = 'cancelada' WHERE silla_id = ${silla}::uuid`);

      await expect(insertarCita(db, { sillaId: silla, rango: DIEZ_A_ONCE })).resolves.toBeDefined();
    });
  });
});
