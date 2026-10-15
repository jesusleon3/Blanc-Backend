import { Inject, Injectable } from '@nestjs/common';
import { Database, DATABASE_CONNECTION } from '../../database/connection';
import { UnitOfWork } from './unit-of-work.port';
import { TransactionContext } from './transaction-context';

@Injectable()
export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    // SE UNE A LA TRANSACCIÓN EN CURSO SI YA HAY UNA.
    //
    // Sin esto, un caso de uso que invoque a otro abría una **segunda transacción sobre otra
    // conexión del pool**. Las consecuencias no son teóricas: la interna no vería lo escrito por
    // la externa (que aún no ha hecho commit), podría quedarse esperando filas que la externa
    // tiene bloqueadas —un bloqueo mutuo entre dos transacciones de la misma petición— y si la
    // externa fallaba después, lo que la interna ya confirmó quedaba escrito. Un rollback a
    // medias es peor que no tener transacciones.
    //
    // Al unirse, la frontera transaccional es la del caso de uso más externo, que es lo que
    // "Unit of Work" significa: una sola unidad por operación de negocio, no una por capa.
    if (TransactionContext.obtenerConexionActiva()) {
      return trabajo();
    }

    return this.db.transaction((tx) => TransactionContext.ejecutarEnContexto(tx as unknown as Database, trabajo));
  }
}
