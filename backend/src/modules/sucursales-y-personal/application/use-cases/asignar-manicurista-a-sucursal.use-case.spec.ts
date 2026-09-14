import { AsignarManicuristaASucursalUseCase } from './asignar-manicurista-a-sucursal.use-case';
import { ManicuristaRepository } from '../../domain/ports/manicurista.repository';
import { SucursalRepository } from '../../domain/ports/sucursal.repository';
import { Manicurista } from '../../domain/entities/manicurista.entity';
import { Sucursal } from '../../domain/entities/sucursal.entity';
import { ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

const ACTOR: ClaimsUsuario = { sub: 'admin-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };
const HORARIO = {
  lunes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  martes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  miercoles: [{ horaInicio: '09:00', horaFin: '18:00' }],
  jueves: [{ horaInicio: '09:00', horaFin: '18:00' }],
  viernes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  sabado: [{ horaInicio: '09:00', horaFin: '15:00' }],
  domingo: [],
};

function repoManicuristaFalso(manicurista: Manicurista | null, yaAsignada = false): jest.Mocked<ManicuristaRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn().mockResolvedValue(manicurista),
    listar: jest.fn(),
    asignarASucursal: jest.fn(),
    removerDeSucursal: jest.fn(),
    listarSucursalesDeManicurista: jest.fn(),
    estaAsignadaASucursal: jest.fn().mockResolvedValue(yaAsignada),
  };
}

function repoSucursalFalso(sucursal: Sucursal | null): jest.Mocked<SucursalRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn().mockResolvedValue(sucursal),
    buscarPorNombre: jest.fn(),
    listar: jest.fn(),
    agregarDiaFestivo: jest.fn(),
    listarDiasFestivos: jest.fn(),
    buscarDiaFestivoPorId: jest.fn(),
    eliminarDiaFestivo: jest.fn(),
  };
}

describe('AsignarManicuristaASucursalUseCase — FL-SUC-03 (relación muchos-a-muchos)', () => {
  it('lanza RecursoNoEncontradoError si la manicurista no existe', async () => {
    const useCase = new AsignarManicuristaASucursalUseCase(
      repoManicuristaFalso(null),
      repoSucursalFalso(null),
      { registrar: jest.fn() },
      crearUnitOfWorkFalso(),
    );
    await expect(useCase.ejecutar({ manicuristaId: 'x', sucursalId: 'y' }, ACTOR)).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('lanza ConflictoDeNegocioError si ya está asignada', async () => {
    const manicurista = Manicurista.crear({ nombre: 'Karla' });
    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    const useCase = new AsignarManicuristaASucursalUseCase(
      repoManicuristaFalso(manicurista, true),
      repoSucursalFalso(sucursal),
      { registrar: jest.fn() },
      crearUnitOfWorkFalso(),
    );

    await expect(useCase.ejecutar({ manicuristaId: manicurista.id, sucursalId: sucursal.id }, ACTOR)).rejects.toThrow(ConflictoDeNegocioError);
  });

  it('asigna la manicurista a la sucursal y audita — una manicurista puede tener varias sucursales (01-domain-discovery.md §5.7)', async () => {
    const manicurista = Manicurista.crear({ nombre: 'Karla' });
    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    const repoManicurista = repoManicuristaFalso(manicurista, false);
    const useCase = new AsignarManicuristaASucursalUseCase(
      repoManicurista,
      repoSucursalFalso(sucursal),
      { registrar: jest.fn() },
      crearUnitOfWorkFalso(),
    );

    await useCase.ejecutar({ manicuristaId: manicurista.id, sucursalId: sucursal.id }, ACTOR);

    expect(repoManicurista.asignarASucursal).toHaveBeenCalledWith(manicurista.id, sucursal.id);
  });
});
