import { Inject, Injectable } from '@nestjs/common';
import { Database, DATABASE_CONNECTION } from '../../database/connection';
import { UnitOfWork } from './unit-of-work.port';
import { TransactionContext } from './transaction-context';

@Injectable()
export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => TransactionContext.ejecutarEnContexto(tx as unknown as Database, trabajo));
  }
}
