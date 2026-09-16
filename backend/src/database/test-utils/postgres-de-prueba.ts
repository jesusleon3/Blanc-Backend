import { join } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '../schema';
import { Database } from '../connection';

/**
 * PostgreSQL **real** para pruebas de integración y E2E, sobre el contenedor efímero que levanta
 * `test/global-setup.js`.
 *
 * SUSTITUYE A `pg-mem`. Ver la justificación completa en `global-setup.js`: pg-mem no soporta
 * `tstzrange`, `EXCLUDE USING gist` ni `btree_gist`, los tres pilares del invariante
 * anti-doble-booking de la Fase 2 — y, además, aceptaba `BEGIN`/`ROLLBACK` sin revertir de
 * verdad, lo que dejaba la atomicidad del `UnitOfWork` sin verificar (riesgo aceptado que este
 * cambio cierra).
 *
 * UNA BASE DE DATOS POR WORKER DE JEST. Jest paraleliza por archivo en procesos separados; si
 * todos compartieran una base, el `TRUNCATE` de un archivo borraría los datos de otro a media
 * prueba. Cada worker obtiene `blanc_test_w<N>`, creada la primera vez que se le pide.
 *
 * LAS MIGRACIONES REALES SON EL DDL. No se duplica el esquema a mano (como hacía el helper de
 * pg-mem, que había que mantener sincronizado a mano): se ejecutan `src/database/migrations/*`.
 * Efecto secundario deseado — cada corrida de la suite **prueba que las migraciones aplican**
 * sobre un PostgreSQL limpio, algo que este proyecto nunca había verificado.
 */

/** Esquemas creados por las migraciones. `drizzle` (control de migraciones) se excluye a propósito. */
const ESQUEMAS_DE_NEGOCIO = ['sucursales_personal', 'auditoria', 'identidad_accesos', 'catalogo_cotizacion'];

let conexionDelWorker: { db: Database; cliente: postgres.Sql; tablas: string[] } | null = null;

function urlAdministrativa(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL no está definida. Las pruebas de integración requieren el contenedor de ' +
        'PostgreSQL que levanta `test/global-setup.js` — ejecuta la suite con `npm test`, no invocando Jest sin su configuración.',
    );
  }
  return url;
}

/** `blanc_test_w1`, `blanc_test_w2`, … — `JEST_WORKER_ID` es `1` cuando Jest corre en banda (`--runInBand`). */
function nombreBaseDelWorker(): string {
  return `blanc_test_w${process.env.JEST_WORKER_ID ?? '1'}`;
}

async function provisionarBaseDelWorker(): Promise<{ db: Database; cliente: postgres.Sql; tablas: string[] }> {
  const urlAdmin = urlAdministrativa();
  const nombreBase = nombreBaseDelWorker();

  // Conexión administrativa efímera: `CREATE DATABASE` no puede ejecutarse desde la propia base
  // que se está creando, ni dentro de una transacción.
  const admin = postgres(urlAdmin, { max: 1 });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE "${nombreBase}"`);
  } finally {
    await admin.end();
  }

  const urlDelWorker = new URL(urlAdmin);
  urlDelWorker.pathname = `/${nombreBase}`;

  // `onnotice` silenciado: las migraciones generan NOTICE de PostgreSQL al truncar nombres de
  // constraint que superan 63 caracteres (p. ej. la FK de `servicio_modificadores_aplicables`).
  // Son informativos y no indican fallo, pero inundan la salida de Jest y esconden los errores
  // que sí importan.
  const cliente = postgres(urlDelWorker.toString(), { prepare: false, max: 5, onnotice: () => {} });
  const db = drizzle(cliente, { schema }) as unknown as Database;

  // `btree_gist` habilita `EXCLUDE USING gist (manicurista_id WITH =, rango WITH &&)` — el
  // operador `=` sobre un `uuid` dentro de un índice GiST requiere esta extensión. Es el
  // prerrequisito del invariante de no-doble-booking de la Fase 2.
  await cliente.unsafe('CREATE EXTENSION IF NOT EXISTS btree_gist');

  await migrate(db, { migrationsFolder: join(__dirname, '..', 'migrations') });

  const filas = await cliente.unsafe<{ tabla: string }[]>(
    `SELECT format('%I.%I', schemaname, tablename) AS tabla
       FROM pg_tables
      WHERE schemaname = ANY($1)`,
    [ESQUEMAS_DE_NEGOCIO as unknown as string],
  );

  return { db, cliente, tablas: filas.map((f) => f.tabla) };
}

/**
 * Devuelve una base de datos **vacía** lista para usar.
 *
 * La primera invocación de cada worker crea y migra su base; las siguientes solo vacían las
 * tablas (`TRUNCATE`, mucho más rápido que recrear el esquema) y reutilizan la MISMA conexión —
 * abrir un pool por llamada agotaría `max_connections` de PostgreSQL con ~53 llamadas por corrida.
 */
export async function crearBaseDeDatosDePrueba(): Promise<Database> {
  if (!conexionDelWorker) {
    conexionDelWorker = await provisionarBaseDelWorker();
    return conexionDelWorker.db;
  }

  const { cliente, tablas } = conexionDelWorker;
  if (tablas.length > 0) {
    await cliente.unsafe(`TRUNCATE ${tablas.join(', ')} RESTART IDENTITY CASCADE`);
  }
  return conexionDelWorker.db;
}

/**
 * Cierra la conexión del worker. Opcional: `global-teardown.js` detiene el contenedor entero al
 * final, lo que corta cualquier conexión pendiente. Se expone para pruebas que quieran ser
 * explícitas.
 */
export async function cerrarBaseDeDatosDePrueba(): Promise<void> {
  if (conexionDelWorker) {
    await conexionDelWorker.cliente.end();
    conexionDelWorker = null;
  }
}
