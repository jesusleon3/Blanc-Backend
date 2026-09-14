import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Conexión Drizzle sobre `postgres-js`, elegida en `03-technical-architecture.md` §3.4/§3.14
 * por su mejor comportamiento documentado con el pooler de Supabase (PgBouncer, modo
 * transacción) frente a otros drivers. `prepare: false` es la opción recomendada por esa
 * misma decisión al operar detrás de PgBouncer en modo transacción.
 */
export function createDbConnection(connectionString: string) {
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDbConnection>;

/**
 * Token de DI, definido aquí (no en `database.module.ts`) para que módulos de Infrastructure
 * que necesitan inyectar la conexión (p. ej. `DrizzleUnitOfWork`) puedan importarlo sin crear un
 * ciclo de módulos con `database.module.ts`, que a su vez los registra como providers.
 */
export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

/**
 * Cierra el pool de `postgres-js` de forma ordenada (Tarea 8, hardening 2026-08-11) — sin esto,
 * el proceso de Nest no libera los sockets al recibir SIGTERM y `app.close()` no cierra la
 * conexión de verdad. `db.$client` es la referencia al cliente `postgres-js` subyacente que
 * Drizzle expone (tipado en `drizzle-orm/postgres-js`, no una extensión propia). No cubre
 * pooling/reintentos — solo apagado ordenado, lo único que se puede justificar sin credenciales
 * reales para probarlo contra Supabase/Supavisor.
 */
export async function cerrarConexion(db: Database): Promise<void> {
  await db.$client.end();
}
