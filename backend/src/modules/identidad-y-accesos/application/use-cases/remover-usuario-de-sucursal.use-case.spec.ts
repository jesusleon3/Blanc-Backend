import { RemoverUsuarioDeSucursalUseCase } from './remover-usuario-de-sucursal.use-case';
import { UsuarioRepository } from '../../domain/ports/usuario.repository';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { AccesoFueraDeAlcanceError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

function crearRepoFalso(): jest.Mocked<UsuarioRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn(),
    buscarPorEmail: jest.fn(),
    asignarASucursal: jest.fn(),
    removerDeSucursal: jest.fn(),
    vincularCuentaExterna: jest.fn(),
    obtenerPermisosPorSupabaseUserId: jest.fn(),
  };
}

const auditoriaFalsa = (): jest.Mocked<AuditoriaPort> => ({ registrar: jest.fn() });

describe('RemoverUsuarioDeSucursalUseCase — FL-SEG-04', () => {
  it('rechaza a un actor sin alcance sobre la sucursal objetivo (nivel 2)', async () => {
    const repo = crearRepoFalso();
    const useCase = new RemoverUsuarioDeSucursalUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const actorSinAlcance: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: ['otra-sucursal'] };

    await expect(useCase.ejecutar({ usuarioId: 'u-1', sucursalId: 'suc-1' }, actorSinAlcance)).rejects.toThrow(AccesoFueraDeAlcanceError);
    expect(repo.removerDeSucursal).not.toHaveBeenCalled();
  });

  it('remueve sin verificar existencia previa (mismo precedente que RemoverManicuristaDeSucursalUseCase)', async () => {
    const repo = crearRepoFalso();
    const auditoria = auditoriaFalsa();
    const useCase = new RemoverUsuarioDeSucursalUseCase(repo, auditoria, crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: ['suc-1'] };

    await useCase.ejecutar({ usuarioId: 'u-1', sucursalId: 'suc-1' }, actor);

    expect(repo.buscarPorId).not.toHaveBeenCalled();
    expect(repo.removerDeSucursal).toHaveBeenCalledWith('u-1', 'suc-1');
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ entidadAfectadaTipo: 'usuario_sucursal' }));
  });

  it('Super Admin puede remover de cualquier sucursal sin restricción', async () => {
    const repo = crearRepoFalso();
    const useCase = new RemoverUsuarioDeSucursalUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const superAdmin: ClaimsUsuario = { sub: 'actor-1', rol: Rol.SUPER_ADMIN, sucursales: [] };

    await expect(useCase.ejecutar({ usuarioId: 'u-1', sucursalId: 'cualquier-sucursal' }, superAdmin)).resolves.toBeUndefined();
  });
});
