import { DesactivarUsuarioUseCase } from './desactivar-usuario.use-case';
import { UsuarioRepository } from '../../domain/ports/usuario.repository';
import { Usuario } from '../../domain/entities/usuario.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { DesactivacionNoPermitidaError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
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

describe('DesactivarUsuarioUseCase — FL-SEG-05 (alcance mínimo, sin Supabase)', () => {
  it('lanza RecursoNoEncontradoError si el usuario no existe', async () => {
    const useCase = new DesactivarUsuarioUseCase(crearRepoFalso(null), auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL' };

    await expect(useCase.ejecutar({ usuarioId: 'inexistente' }, actor)).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('desactiva exitosamente y registra auditoría sin email en el detalle', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA, activa: true });
    const repo = crearRepoFalso(objetivo);
    const auditoria = auditoriaFalsa();
    const useCase = new DesactivarUsuarioUseCase(repo, auditoria, crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

    await useCase.ejecutar({ usuarioId: 'u-1' }, actor);

    expect(objetivo.activa).toBe(false);
    expect(repo.guardar).toHaveBeenCalledWith(objetivo);
    const detalle = auditoria.registrar.mock.calls[0][0].detalle;
    expect(JSON.stringify(detalle)).not.toContain('ana@blanc.mx');
    expect(detalle).toEqual({ accion: 'desactivar_usuario' });
  });

  it('rechaza que un actor se desactive a sí mismo (no auto-escalamiento, sino anti-lockout)', async () => {
    const propio = Usuario.reconstruir({ id: 'actor-1', email: 'admin@blanc.mx', nombre: 'Admin', rol: Rol.ADMINISTRADOR, activa: true });
    const repo = crearRepoFalso(propio);
    const useCase = new DesactivarUsuarioUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

    await expect(useCase.ejecutar({ usuarioId: 'actor-1' }, actor)).rejects.toThrow(DesactivacionNoPermitidaError);
    expect(repo.guardar).not.toHaveBeenCalled();
  });

  it('un Super Admin tampoco puede desactivarse a sí mismo', async () => {
    const propio = Usuario.reconstruir({ id: 'actor-1', email: 'super@blanc.mx', nombre: 'Super', rol: Rol.SUPER_ADMIN, activa: true });
    const repo = crearRepoFalso(propio);
    const useCase = new DesactivarUsuarioUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL' };

    await expect(useCase.ejecutar({ usuarioId: 'actor-1' }, actor)).rejects.toThrow(DesactivacionNoPermitidaError);
  });

  it('rechaza que un Administrador desactive a un Super Admin (protección jerárquica, mismo criterio que FL-SEG-03)', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'super@blanc.mx', nombre: 'Otro Super', rol: Rol.SUPER_ADMIN, activa: true });
    const repo = crearRepoFalso(objetivo);
    const useCase = new DesactivarUsuarioUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

    await expect(useCase.ejecutar({ usuarioId: 'u-1' }, actor)).rejects.toThrow(DesactivacionNoPermitidaError);
  });

  it('un Super Admin sí puede desactivar a otro Super Admin', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'super@blanc.mx', nombre: 'Otro Super', rol: Rol.SUPER_ADMIN, activa: true });
    const repo = crearRepoFalso(objetivo);
    const useCase = new DesactivarUsuarioUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL' };

    await useCase.ejecutar({ usuarioId: 'u-1' }, actor);
    expect(objetivo.activa).toBe(false);
  });

  it('desactivar un usuario ya desactivado es un no-op exitoso, sin volver a guardar ni auditar', async () => {
    const objetivo = Usuario.reconstruir({ id: 'u-1', email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA, activa: false });
    const repo = crearRepoFalso(objetivo);
    const auditoria = auditoriaFalsa();
    const useCase = new DesactivarUsuarioUseCase(repo, auditoria, crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

    await expect(useCase.ejecutar({ usuarioId: 'u-1' }, actor)).resolves.toBeUndefined();
    expect(repo.guardar).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });
});
