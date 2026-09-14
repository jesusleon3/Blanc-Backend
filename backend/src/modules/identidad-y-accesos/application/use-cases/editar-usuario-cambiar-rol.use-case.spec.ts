import { EditarUsuarioCambiarRolUseCase } from './editar-usuario-cambiar-rol.use-case';
import { UsuarioRepository } from '../../domain/ports/usuario.repository';
import { Usuario } from '../../domain/entities/usuario.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { AsignacionDeRolNoPermitidaError, ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

function crearRepoFalso(objetivo: Usuario | null, porEmail: Usuario | null = null): jest.Mocked<UsuarioRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn().mockResolvedValue(objetivo),
    buscarPorEmail: jest.fn().mockResolvedValue(porEmail),
    asignarASucursal: jest.fn(),
    removerDeSucursal: jest.fn(),
    vincularCuentaExterna: jest.fn(),
    obtenerPermisosPorSupabaseUserId: jest.fn(),
  };
}

const auditoriaFalsa = (): jest.Mocked<AuditoriaPort> => ({ registrar: jest.fn() });

describe('EditarUsuarioCambiarRolUseCase — FL-SEG-03', () => {
  it('lanza RecursoNoEncontradoError si el usuario no existe', async () => {
    const useCase = new EditarUsuarioCambiarRolUseCase(crearRepoFalso(null), auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL' };

    await expect(useCase.ejecutar({ usuarioId: 'inexistente', nombre: 'X' }, actor)).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('edita solo nombre, sin tocar rol, y audita sin incluir rolAnterior/rolNuevo', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA, activa: true });
    const repo = crearRepoFalso(objetivo);
    const auditoria = auditoriaFalsa();
    const useCase = new EditarUsuarioCambiarRolUseCase(repo, auditoria, crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

    const editado = await useCase.ejecutar({ usuarioId: 'u-1', nombre: 'Ana María' }, actor);

    expect(editado.nombre).toBe('Ana María');
    expect(editado.rol).toBe(Rol.RECEPCIONISTA);
    expect(repo.guardar).toHaveBeenCalled();
    const detalle = auditoria.registrar.mock.calls[0][0].detalle as Record<string, unknown>;
    expect(detalle.camposEditados).toEqual(['nombre']);
    expect(detalle.rolAnterior).toBeUndefined();
  });

  it('sin cambios reales no guarda ni audita', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA, activa: true });
    const repo = crearRepoFalso(objetivo);
    const auditoria = auditoriaFalsa();
    const useCase = new EditarUsuarioCambiarRolUseCase(repo, auditoria, crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

    await useCase.ejecutar({ usuarioId: 'u-1', nombre: 'Ana', email: 'ana@blanc.mx' }, actor);

    expect(repo.guardar).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('un Administrador puede cambiar el rol de un usuario no crítico a otro rol no crítico', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA, activa: true });
    const repo = crearRepoFalso(objetivo);
    const useCase = new EditarUsuarioCambiarRolUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

    const editado = await useCase.ejecutar({ usuarioId: 'u-1', rol: Rol.GERENTE }, actor);

    expect(editado.rol).toBe(Rol.GERENTE);
  });

  it('rechaza que un actor cambie su propio rol, incluso Super Admin (punto B.1)', async () => {
    const objetivo = Usuario.reconstruir({ id: 'actor-1', email: 'super@blanc.mx', nombre: 'Super', rol: Rol.SUPER_ADMIN, activa: true });
    const repo = crearRepoFalso(objetivo);
    const useCase = new EditarUsuarioCambiarRolUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL' };

    await expect(useCase.ejecutar({ usuarioId: 'actor-1', rol: Rol.ADMINISTRADOR }, actor)).rejects.toThrow(AsignacionDeRolNoPermitidaError);
    expect(repo.guardar).not.toHaveBeenCalled();
  });

  it('rechaza que un Administrador asigne el rol Super Admin a otro usuario (punto B.2)', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA, activa: true });
    const repo = crearRepoFalso(objetivo);
    const useCase = new EditarUsuarioCambiarRolUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

    await expect(useCase.ejecutar({ usuarioId: 'u-1', rol: Rol.SUPER_ADMIN }, actor)).rejects.toThrow(AsignacionDeRolNoPermitidaError);
  });

  it('rechaza que un Administrador cambie el rol de un usuario que hoy es Super Admin (punto B.3)', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'super@blanc.mx', nombre: 'Otro Super', rol: Rol.SUPER_ADMIN, activa: true });
    const repo = crearRepoFalso(objetivo);
    const useCase = new EditarUsuarioCambiarRolUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

    await expect(useCase.ejecutar({ usuarioId: 'u-1', rol: Rol.RECEPCIONISTA }, actor)).rejects.toThrow(AsignacionDeRolNoPermitidaError);
  });

  it('un Super Admin sí puede cambiar el rol de otro Super Admin', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'super@blanc.mx', nombre: 'Otro Super', rol: Rol.SUPER_ADMIN, activa: true });
    const repo = crearRepoFalso(objetivo);
    const useCase = new EditarUsuarioCambiarRolUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL' };

    const editado = await useCase.ejecutar({ usuarioId: 'u-1', rol: Rol.ADMINISTRADOR }, actor);
    expect(editado.rol).toBe(Rol.ADMINISTRADOR);
  });

  it('rechaza un email que ya pertenece a otro usuario (409)', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA, activa: true });
    const otro = Usuario.reconstruir({ id: 'u-2', email: 'ocupado@blanc.mx', nombre: 'Otro', rol: Rol.RECEPCIONISTA, activa: true });
    const repo = crearRepoFalso(objetivo, otro);
    const useCase = new EditarUsuarioCambiarRolUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

    await expect(useCase.ejecutar({ usuarioId: 'u-1', email: 'ocupado@blanc.mx' }, actor)).rejects.toThrow(ConflictoDeNegocioError);
  });
});
