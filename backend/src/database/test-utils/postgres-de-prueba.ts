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

/**
 * Esquemas que NO se vacían entre pruebas: los del sistema y el de control de migraciones de
 * Drizzle — truncar este último obligaría a volver a migrar en cada llamada.
 *
 * La lista de esquemas a vaciar se **descubre consultando la base**, no se escribe a mano. Antes
 * era una constante y provocó un fallo real: al añadir el esquema `agenda` nadie actualizó la
 * lista, sus tablas dejaron de vaciarse y las filas se acumulaban entre pruebas del mismo worker,
 * haciendo fallar aserciones correctas por datos sobrantes. Descubrirlos elimina ese pie de
 * fallo para siempre: un esquema nuevo queda cubierto sin tocar este archivo.
 */
const ESQUEMAS_NO_VACIABLES = ['drizzle', 'public', 'information_schema'];

let conexionDelWorker: { db: Database; cliente: postgres.Sql; tablas: string[] } | null = null;

/**
 * Marca de que la base de este worker **ya existe y ya está migrada**.
 *
 * ## POR QUÉ ESTO VIVE EN `process.env` Y NO EN UNA VARIABLE DE MÓDULO
 *
 * `conexionDelWorker` es estado de módulo, y **Jest reinicia el registro de módulos en cada
 * archivo de spec**: un worker que procesa 30 archivos lo veía `null` 30 veces y volvía a
 * provisionar la base 30 veces. Provisionar hacía
 * `DROP DATABASE ... WITH (FORCE)` — que **termina a la fuerza todas las conexiones abiertas a
 * esa base**, no solo las propias.
 *
 * Ahí estaba la raíz de la intermitencia: cada cambio de archivo abría una ventana en la que una
 * conexión que el archivo anterior aún no había drenado —una petición en vuelo de supertest, el
 * pool de un `app.close()` todavía en curso— era cortada de raíz por PostgreSQL. El resultado era
 * un intercambio HTTP abortado a mitad, y el síntoma, un `401` imposible: la petición llegaba al
 * guard **sin su cabecera `Authorization`**, porque nunca se terminó de recibir.
 *
 * `process.env` es lo único que sobrevive al reinicio del registro de módulos dentro del mismo
 * proceso de worker (`globalThis` no: `testEnvironment: 'node'` crea un contexto nuevo por
 * archivo). Con la marca puesta, los archivos siguientes **se conectan y vacían tablas, sin
 * volver a borrar nada**.
 *
 * Efecto secundario: la suite es bastante más rápida, porque las migraciones se aplican **una vez
 * por worker** en lugar de una por archivo. Y no se pierde la verificación de que las migraciones
 * aplican sobre una base limpia: sigue ocurriendo, una vez por worker y por corrida.
 */
const MARCA_DE_BASE_PROVISIONADA = 'BLANC_TEST_BASE_PROVISIONADA';

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
  // Si otro archivo de spec de ESTE MISMO worker ya la creó y migró, no se vuelve a tocar.
  const yaProvisionada = process.env[MARCA_DE_BASE_PROVISIONADA] === nombreBase;

  if (!yaProvisionada) {
    // Conexión administrativa efímera: `CREATE DATABASE` no puede ejecutarse desde la propia base
    // que se está creando, ni dentro de una transacción.
    const admin = postgres(urlAdmin, { max: 1 });
    try {
      await admin.unsafe(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`);
      await admin.unsafe(`CREATE DATABASE "${nombreBase}"`);
    } finally {
      await admin.end();
    }
    process.env[MARCA_DE_BASE_PROVISIONADA] = nombreBase;
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

  // Solo la primera vez en este worker. Volver a migrar una base ya migrada no haría daño
  // (Drizzle lleva su registro en el esquema `drizzle`), pero cuesta y no aporta nada.
  if (!yaProvisionada) {
    await migrate(db, { migrationsFolder: join(__dirname, '..', 'migrations') });
  }

  const filas = await cliente.unsafe<{ tabla: string }[]>(
    `SELECT format('%I.%I', schemaname, tablename) AS tabla
       FROM pg_tables
      WHERE schemaname NOT LIKE 'pg\\_%'
        AND schemaname <> ALL($1)`,
    [ESQUEMAS_NO_VACIABLES as unknown as string],
  );

  return { db, cliente, tablas: filas.map((f) => f.tabla) };
}

/**
 * Devuelve una base de datos **vacía** lista para usar.
 *
 * La primera invocación **de cada worker** (no de cada archivo) crea y migra su base; todas las
 * demás solo vacían las tablas (`TRUNCATE`, mucho más rápido que recrear el esquema) y reutilizan
 * la MISMA conexión — abrir un pool por llamada agotaría `max_connections` de PostgreSQL.
 *
 * **Nunca borra la base más de una vez por worker**: ver `MARCA_DE_BASE_PROVISIONADA`, donde está
 * explicada la intermitencia que ese borrado repetido causaba.
 */
export async function crearBaseDeDatosDePrueba(): Promise<Database> {
  if (!conexionDelWorker) {
    conexionDelWorker = await provisionarBaseDelWorker();
    // Se vacía también en el primer uso de cada archivo: la base puede traer filas del archivo
    // anterior del mismo worker, ahora que ya no se recrea.
    return vaciarYDevolver();
  }

  return vaciarYDevolver();
}

async function vaciarYDevolver(): Promise<Database> {
  const { cliente, tablas, db } = conexionDelWorker!;
  if (tablas.length > 0) {
    await cliente.unsafe(`TRUNCATE ${tablas.join(', ')} RESTART IDENTITY CASCADE`);
  }
  return db;
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
