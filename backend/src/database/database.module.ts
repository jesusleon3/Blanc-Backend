import { Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { cerrarConexion, createDbConnection, DATABASE_CONNECTION, Database } from './connection';
import { UNIT_OF_WORK } from '../shared/persistence/unit-of-work.port';
import { DrizzleUnitOfWork } from '../shared/persistence/drizzle-unit-of-work';

export { DATABASE_CONNECTION };

/** Cierra el pool de `postgres-js` al apagar Nest (Tarea 8, hardening 2026-08-11) — ver `cerrarConexion` en `connection.ts`. */
@Injectable()
class DatabaseLifecycle implements OnModuleDestroy {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async onModuleDestroy(): Promise<void> {
    await cerrarConexion(this.db);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: () => createDbConnection(process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/blanc'),
    },
    { provide: UNIT_OF_WORK, useClass: DrizzleUnitOfWork },
    DatabaseLifecycle,
  ],
  exports: [DATABASE_CONNECTION, UNIT_OF_WORK],
})
export class DatabaseModule {}
