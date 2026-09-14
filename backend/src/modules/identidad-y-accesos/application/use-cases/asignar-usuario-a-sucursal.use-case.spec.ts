import { AsignarUsuarioASucursalUseCase } from './asignar-usuario-a-sucursal.use-case';
import { UsuarioRepository } from '../../domain/ports/usuario.repository';
import { Usuario } from '../../domain/entities/usuario.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { AccesoFueraDeAlcanceError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

function crearRepoFalso(objetivo: Usuario | null): jest.Mocked<UsuarioRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn().mockResolvedValue(objetivo),
    buscarPorEmail: jest.fn(),
    asignarASucursal: jest.fn(),
    removerDeSucursal: jest.fn(),
    vincularCuentaExterna: jest.fn(),
    obtenerPermisosPorSupabaseUserId: jest.fn(),
  };
}

const auditoriaFalsa = (): jest.Mocked<AuditoriaPort> => ({ registrar: jest.fn() });

describe('AsignarUsuarioASucursalUseCase — FL-SEG-04', () => {
  it('lanza RecursoNoEncontradoError si el usuario no existe', async () => {
    const useCase = new AsignarUsuarioASucursalUseCase(crearRepoFalso(null), auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL' };

    await expect(useCase.ejecutar({ usuarioId: 'inexistente', sucursalId: 'suc-1' }, actor)).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('rechaza a un actor sin alcance sobre la sucursal objetivo (nivel 2)', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA, activa: true });
    const repo = crearRepoFalso(objetivo);
    const useCase = new AsignarUsuarioASucursalUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const actorSinAlcance: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: ['otra-sucursal'] };

    await expect(useCase.ejecutar({ usuarioId: 'u-1', sucursalId: 'suc-1' }, actorSinAlcance)).rejects.toThrow(AccesoFueraDeAlcanceError);
    expect(repo.asignarASucursal).not.toHaveBeenCalled();
  });

  it('rechaza la auto-asignación a una sucursal fuera del propio alcance (mismo mecanismo, sin regla especial)', async () => {
    const propio = Usuario.reconstruir({ id: 'actor-1', email: 'admin@blanc.mx', nombre: 'Admin', rol: Rol.ADMINISTRADOR, activa: true });
    const repo = crearRepoFalso(propio);
    const useCase = new AsignarUsuarioASucursalUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: ['sucursal-propia'] };

    await expect(useCase.ejecutar({ usuarioId: 'actor-1', sucursalId: 'sucursal-ajena' }, actor)).rejects.toThrow(AccesoFueraDeAlcanceError);
  });

  it('permite a un actor con alcance explícito asignar y registra auditoría', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA, activa: true });
    const repo = crearRepoFalso(objetivo);
    const auditoria = auditoriaFalsa();
    const useCase = new AsignarUsuarioASucursalUseCase(repo, auditoria, crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: ['suc-1'] };

    await useCase.ejecutar({ usuarioId: 'u-1', sucursalId: 'suc-1' }, actor);

    expect(repo.asignarASucursal).toHaveBeenCalledWith('u-1', 'suc-1');
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ entidadAfectadaTipo: 'usuario_sucursal' }));
  });

  it('Super Admin puede asignar cualquier sucursal sin restricción', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA, activa: true });
    const repo = crearRepoFalso(objetivo);
    const useCase = new AsignarUsuarioASucursalUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const superAdmin: ClaimsUsuario = { sub: 'actor-1', rol: Rol.SUPER_ADMIN, sucursales: [] };

    await expect(useCase.ejecutar({ usuarioId: 'u-1', sucursalId: 'cualquier-sucursal' }, superAdmin)).resolves.toBeUndefined();
  });
});
