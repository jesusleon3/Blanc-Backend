import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDbConnection } from './connection';

/** Aplica las migraciones generadas por `npm run db:generate` contra DATABASE_URL. */
async function main() {
  const db = createDbConnection(process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/blanc');
  await migrate(db, { migrationsFolder: './src/database/migrations' });
  // eslint-disable-next-line no-console
  console.log('Migraciones aplicadas.');
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
