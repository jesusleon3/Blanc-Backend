import { ProvisionarUsuarioUseCase } from './provisionar-usuario.use-case';
import { UsuarioRepository } from '../../domain/ports/usuario.repository';
import { IdentidadExternaPort } from '../../domain/ports/identidad-externa.port';
import { Usuario } from '../../domain/entities/usuario.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';
import { UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

const SUPABASE_USER_ID = '0dd96720-c81d-4406-a2de-fe6bed0f4cd8';

function crearRepoFalso(objetivo: Usuario | null, vinculoExitoso = true): jest.Mocked<UsuarioRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn().mockResolvedValue(objetivo),
    buscarPorEmail: jest.fn(),
    asignarASucursal: jest.fn(),
    removerDeSucursal: jest.fn(),
    vincularCuentaExterna: jest.fn().mockResolvedValue(vinculoExitoso),
    obtenerPermisosPorSupabaseUserId: jest.fn(),
  };
}

const identidadExternaFalsa = (): jest.Mocked<IdentidadExternaPort> => ({
  crearCuenta: jest.fn().mockResolvedValue({ id: SUPABASE_USER_ID }),
});

const auditoriaFalsa = (): jest.Mocked<AuditoriaPort> => ({ registrar: jest.fn() });

const actor: ClaimsUsuario = { sub: 'actor-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

function usuarioSinProvisionar(): Usuario {
  return Usuario.reconstruir({ id: 'u-1', email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA, activa: true });
}

describe('ProvisionarUsuarioUseCase — FL-SEG-06 (Solo Provisionar, DEC-025/DEC-028)', () => {
  it('lanza RecursoNoEncontradoError si el usuario de Blanc no existe', async () => {
    const identidad = identidadExternaFalsa();
    const useCase = new ProvisionarUsuarioUseCase(crearRepoFalso(null), identidad, auditoriaFalsa(), crearUnitOfWorkFalso());

    await expect(useCase.ejecutar({ usuarioId: 'inexistente' }, actor)).rejects.toThrow(RecursoNoEncontradoError);
    // No debe contactarse al proveedor por un usuario que no existe.
    expect(identidad.crearCuenta).not.toHaveBeenCalled();
  });

  describe('happy path', () => {
    it('crea la cuenta externa con el email y persiste el id devuelto como vínculo', async () => {
      const objetivo = usuarioSinProvisionar();
      const repo = crearRepoFalso(objetivo);
      const identidad = identidadExternaFalsa();
      const useCase = new ProvisionarUsuarioUseCase(repo, identidad, auditoriaFalsa(), crearUnitOfWorkFalso());

      await useCase.ejecutar({ usuarioId: 'u-1' }, actor);

      expect(identidad.crearCuenta).toHaveBeenCalledWith({ email: 'ana@blanc.mx' });
      expect(repo.vincularCuentaExterna).toHaveBeenCalledWith('u-1', SUPABASE_USER_ID);
    });

    it('registra auditoría sin filtrar el email ni el identificador externo (RN-AUD-01)', async () => {
      const auditoria = auditoriaFalsa();
      const useCase = new ProvisionarUsuarioUseCase(
        crearRepoFalso(usuarioSinProvisionar()),
        identidadExternaFalsa(),
        auditoria,
        crearUnitOfWorkFalso(),
      );

      await useCase.ejecutar({ usuarioId: 'u-1' }, actor);

      const entrada = auditoria.registrar.mock.calls[0][0];
      expect(entrada).toMatchObject({ actor: 'actor-1', entidadAfectadaTipo: 'usuario', entidadAfectadaId: 'u-1' });
      expect(entrada.detalle).toEqual({ accion: 'provisionar_usuario' });
      const serializado = JSON.stringify(entrada);
      expect(serializado).not.toContain('ana@blanc.mx');
      expect(serializado).not.toContain(SUPABASE_USER_ID);
    });
  });

  describe('idempotencia (DEC-028)', () => {
    it('es un no-op exitoso si el usuario ya está provisionado: no llama al proveedor, no escribe, no audita', async () => {
      const yaProvisionado = Usuario.reconstruir({
        id: 'u-1',
        email: 'ana@blanc.mx',
        nombre: 'Ana',
        rol: Rol.RECEPCIONISTA,
        activa: true,
        supabaseUserId: SUPABASE_USER_ID,
      });
      const repo = crearRepoFalso(yaProvisionado);
      const identidad = identidadExternaFalsa();
      const auditoria = auditoriaFalsa();
      const useCase = new ProvisionarUsuarioUseCase(repo, identidad, auditoria, crearUnitOfWorkFalso());

      await expect(useCase.ejecutar({ usuarioId: 'u-1' }, actor)).resolves.toBeUndefined();

      expect(identidad.crearCuenta).not.toHaveBeenCalled();
      expect(repo.vincularCuentaExterna).not.toHaveBeenCalled();
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });
  });

  describe('guardia de concurrencia (DEC-028)', () => {
    it('rechaza con USUARIO_YA_PROVISIONADO si otra ejecución ganó la carrera (0 filas afectadas)', async () => {
      const repo = crearRepoFalso(usuarioSinProvisionar(), false);
      const auditoria = auditoriaFalsa();
      const useCase = new ProvisionarUsuarioUseCase(repo, identidadExternaFalsa(), auditoria, crearUnitOfWorkFalso());

      await expect(useCase.ejecutar({ usuarioId: 'u-1' }, actor)).rejects.toMatchObject({
        code: 'USUARIO_YA_PROVISIONADO',
        httpStatus: 409,
      });
      await expect(useCase.ejecutar({ usuarioId: 'u-1' }, actor)).rejects.toThrow(ConflictoDeNegocioError);
      // El vínculo ajeno no se machaca y no se audita una operación que no ocurrió.
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });
  });

  describe('frontera transaccional (regla crítica)', () => {
    it('llama al proveedor externo ANTES de abrir la transacción de PostgreSQL', async () => {
      const orden: string[] = [];
      const repo = crearRepoFalso(usuarioSinProvisionar());
      repo.vincularCuentaExterna.mockImplementation(async () => {
        orden.push('escritura-local');
        return true;
      });
      const identidad: jest.Mocked<IdentidadExternaPort> = {
        crearCuenta: jest.fn().mockImplementation(async () => {
          orden.push('llamada-externa');
          return { id: SUPABASE_USER_ID };
        }),
      };
      const unitOfWork = crearUnitOfWorkFalso();
      const unitOfWorkEspiado: UnitOfWork = {
        ejecutar: <T,>(fn: () => Promise<T>): Promise<T> => {
          orden.push('abre-transaccion');
          return unitOfWork.ejecutar(fn);
        },
      };

      const useCase = new ProvisionarUsuarioUseCase(repo, identidad, auditoriaFalsa(), unitOfWorkEspiado);
      await useCase.ejecutar({ usuarioId: 'u-1' }, actor);

      // La llamada de red no debe ocurrir dentro de la transacción: mantendría sus locks abiertos
      // durante toda la latencia del sistema externo, y no sería reversible por ella.
      expect(orden).toEqual(['llamada-externa', 'abre-transaccion', 'escritura-local']);
    });

    it('no abre transacción ni audita si el proveedor externo falla', async () => {
      const repo = crearRepoFalso(usuarioSinProvisionar());
      const auditoria = auditoriaFalsa();
      const identidad: jest.Mocked<IdentidadExternaPort> = {
        crearCuenta: jest.fn().mockRejectedValue(new ConflictoDeNegocioError('IDENTIDAD_EXTERNA_YA_EXISTE', 'ya existe')),
      };
      const useCase = new ProvisionarUsuarioUseCase(repo, identidad, auditoria, crearUnitOfWorkFalso());

      await expect(useCase.ejecutar({ usuarioId: 'u-1' }, actor)).rejects.toMatchObject({
        code: 'IDENTIDAD_EXTERNA_YA_EXISTE',
      });
      expect(repo.vincularCuentaExterna).not.toHaveBeenCalled();
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });
  });
});
