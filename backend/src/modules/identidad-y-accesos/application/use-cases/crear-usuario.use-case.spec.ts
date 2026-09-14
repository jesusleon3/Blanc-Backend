import { CrearUsuarioUseCase } from './crear-usuario.use-case';
import { UsuarioRepository } from '../../domain/ports/usuario.repository';
import { Usuario } from '../../domain/entities/usuario.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { AsignacionDeRolNoPermitidaError, ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

const SUPER_ADMIN: ClaimsUsuario = { sub: 'actor-1', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL' };
const ADMINISTRADOR: ClaimsUsuario = { sub: 'actor-2', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

function crearRepoFalso(existente: Usuario | null = null): jest.Mocked<UsuarioRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn(),
    buscarPorEmail: jest.fn().mockResolvedValue(existente),
    asignarASucursal: jest.fn(),
    removerDeSucursal: jest.fn(),
    vincularCuentaExterna: jest.fn(),
    obtenerPermisosPorSupabaseUserId: jest.fn(),
  };
}

const auditoriaFalsa = (): jest.Mocked<AuditoriaPort> => ({ registrar: jest.fn() });

describe('CrearUsuarioUseCase — FL-SEG-01', () => {
  it('crea el usuario y registra auditoría sin exponer el email en el detalle (punto G)', async () => {
    const repo = crearRepoFalso();
    const auditoria = auditoriaFalsa();
    const useCase = new CrearUsuarioUseCase(repo, auditoria, crearUnitOfWorkFalso());

    const usuario = await useCase.ejecutar({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA }, ADMINISTRADOR);

    expect(usuario.email).toBe('ana@blanc.mx');
    expect(repo.guardar).toHaveBeenCalledWith(usuario);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipoAccion: 'cambio_configuracion', actor: 'actor-2', entidadAfectadaTipo: 'usuario' }),
    );
    const detalle = auditoria.registrar.mock.calls[0][0].detalle;
    expect(JSON.stringify(detalle)).not.toContain('ana@blanc.mx');
  });

  it('rechaza un email ya existente (409, ConflictoDeNegocioError) sin guardar ni auditar', async () => {
    const existente = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
    const repo = crearRepoFalso(existente);
    const auditoria = auditoriaFalsa();
    const useCase = new CrearUsuarioUseCase(repo, auditoria, crearUnitOfWorkFalso());

    await expect(useCase.ejecutar({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA }, ADMINISTRADOR)).rejects.toThrow(
      ConflictoDeNegocioError,
    );
    expect(repo.guardar).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('rechaza a un Administrador que intenta crear un Super Admin (escalamiento, punto B)', async () => {
    const repo = crearRepoFalso();
    const useCase = new CrearUsuarioUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());

    await expect(useCase.ejecutar({ email: 'nuevo@blanc.mx', nombre: 'Nuevo', rol: Rol.SUPER_ADMIN }, ADMINISTRADOR)).rejects.toThrow(
      AsignacionDeRolNoPermitidaError,
    );
    expect(repo.buscarPorEmail).not.toHaveBeenCalled();
    expect(repo.guardar).not.toHaveBeenCalled();
  });

  it('permite a un Super Admin crear otro Super Admin', async () => {
    const repo = crearRepoFalso();
    const useCase = new CrearUsuarioUseCase(repo, auditoriaFalsa(), crearUnitOfWorkFalso());

    const usuario = await useCase.ejecutar({ email: 'nuevo@blanc.mx', nombre: 'Nuevo', rol: Rol.SUPER_ADMIN }, SUPER_ADMIN);

    expect(usuario.rol).toBe(Rol.SUPER_ADMIN);
    expect(repo.guardar).toHaveBeenCalled();
  });
});
