import { AsyncLocalStorage } from 'async_hooks';
import { Database } from '../../database/connection';

const almacen = new AsyncLocalStorage<Database>();

/**
 * Hace que la conexión transaccional (`tx` de `db.transaction()`) esté disponible a cualquier
 * repositorio invocado durante `trabajo`, sin pasarla explícitamente por cada firma de método
 * de Application → Infrastructure. Application nunca importa esto ni conoce su existencia — solo
 * habla con `UnitOfWork` (puerto); este módulo es exclusivamente de Infrastructure.
 *
 * Se usa `AsyncLocalStorage` (Node nativo, sin dependencia nueva) en vez de pasar `tx` como
 * parámetro porque los repositorios ya se inyectan una sola vez vía DI, ligados a la conexión de
 * toda la app — reconstruirlos por transacción habría requerido tocar todos los puertos del
 * dominio para aceptar una conexión por-llamada, un cambio de forma mucho más invasivo para
 * ganar lo mismo.
 */
export const TransactionContext = {
  ejecutarEnContexto<T>(tx: Database, trabajo: () => Promise<T>): Promise<T> {
    return almacen.run(tx, trabajo);
  },

  /** `undefined` fuera de una transacción activa — el repositorio debe usar su conexión por defecto. */
  obtenerConexionActiva(): Database | undefined {
    return almacen.getStore();
  },
};
