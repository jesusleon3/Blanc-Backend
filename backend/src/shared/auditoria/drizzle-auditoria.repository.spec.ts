import { crearBaseDeDatosDePrueba } from '../../database/test-utils/pg-mem-database';
import { DrizzleAuditoriaRepository } from './drizzle-auditoria.repository';

describe('DrizzleAuditoriaRepository (integración) — RN-AUD-01', () => {
  it('registra una entrada de auditoría', async () => {
    const db = crearBaseDeDatosDePrueba();
    const repo = new DrizzleAuditoriaRepository(db);

    await expect(
      repo.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: 'admin-1',
        entidadAfectadaTipo: 'sucursal',
        entidadAfectadaId: '11111111-1111-1111-1111-111111111111',
        detalle: { accion: 'crear_sucursal' },
      }),
    ).resolves.not.toThrow();
  });
});
