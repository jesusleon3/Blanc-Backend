import { DesactivarManicuristaUseCase } from './desactivar-manicurista.use-case';
import { ManicuristaRepository } from '../../domain/ports/manicurista.repository';
import { Manicurista } from '../../domain/entities/manicurista.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

const ACTOR: ClaimsUsuario = { sub: 'admin-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

function crearRepoFalso(manicurista: Manicurista | null): jest.Mocked<ManicuristaRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn().mockResolvedValue(manicurista),
    listar: jest.fn(),
    asignarASucursal: jest.fn(),
    removerDeSucursal: jest.fn(),
    listarSucursalesDeManicurista: jest.fn(),
    estaAsignadaASucursal: jest.fn(),
  };
}

describe('DesactivarManicuristaUseCase — FL-SUC-03 (Pregunta 4 explícitamente fuera de alcance)', () => {
  it('lanza RecursoNoEncontradoError si la manicurista no existe', async () => {
    const useCase = new DesactivarManicuristaUseCase(crearRepoFalso(null), { registrar: jest.fn() }, crearUnitOfWorkFalso());
    await expect(useCase.ejecutar({ id: 'inexistente' }, ACTOR)).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('da de baja el registro administrativo y audita la acción — sin tocar citas (Agenda no existe todavía)', async () => {
    const manicurista = Manicurista.crear({ nombre: 'Karla Espinoza' });
    const repo = crearRepoFalso(manicurista);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
    const useCase = new DesactivarManicuristaUseCase(repo, auditoria, crearUnitOfWorkFalso());

    await useCase.ejecutar({ id: manicurista.id }, ACTOR);

    expect(manicurista.activa).toBe(false);
    expect(repo.guardar).toHaveBeenCalledWith(manicurista);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ detalle: { accion: 'baja_manicurista' } }));
  });
});
