import { cerrarConexion, Database } from './connection';

describe('cerrarConexion — Tarea 8, hardening 2026-08-11', () => {
  it('cierra el cliente postgres-js subyacente vía db.$client.end()', async () => {
    const end = jest.fn().mockResolvedValue(undefined);
    const dbFalsa = { $client: { end } } as unknown as Database;

    await cerrarConexion(dbFalsa);

    expect(end).toHaveBeenCalledTimes(1);
  });
});
