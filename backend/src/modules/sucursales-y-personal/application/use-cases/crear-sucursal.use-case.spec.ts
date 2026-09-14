import { CrearSucursalUseCase } from './crear-sucursal.use-case';
import { SucursalRepository } from '../../domain/ports/sucursal.repository';
import { Sucursal } from '../../domain/entities/sucursal.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

const HORARIO = {
  lunes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  martes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  miercoles: [{ horaInicio: '09:00', horaFin: '18:00' }],
  jueves: [{ horaInicio: '09:00', horaFin: '18:00' }],
  viernes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  sabado: [{ horaInicio: '09:00', horaFin: '15:00' }],
  domingo: [],
};

const ACTOR: ClaimsUsuario = { sub: 'admin-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };

describe('CrearSucursalUseCase — FL-SUC-01', () => {
  function crearRepoFalso(): jest.Mocked<SucursalRepository> {
    return {
      guardar: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorNombre: jest.fn().mockResolvedValue(null),
      listar: jest.fn(),
      agregarDiaFestivo: jest.fn(),
      listarDiasFestivos: jest.fn(),
      buscarDiaFestivoPorId: jest.fn(),
      eliminarDiaFestivo: jest.fn(),
    };
  }

  function crearAuditoriaFalsa(): jest.Mocked<AuditoriaPort> {
    return { registrar: jest.fn() };
  }

  it('crea la sucursal y registra auditoría (RN-AUD-01, FL-AUD-01)', async () => {
    const repo = crearRepoFalso();
    const auditoria = crearAuditoriaFalsa();
    const useCase = new CrearSucursalUseCase(repo, auditoria, crearUnitOfWorkFalso());

    const sucursal = await useCase.ejecutar({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO }, ACTOR);

    expect(sucursal.nombre).toBe('Blanc Polanco');
    expect(repo.guardar).toHaveBeenCalledWith(sucursal);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipoAccion: 'cambio_configuracion', actor: 'admin-1', entidadAfectadaTipo: 'sucursal' }),
    );
  });

  it('rechaza un nombre duplicado (409, ConflictoDeNegocioError)', async () => {
    const repo = crearRepoFalso();
    repo.buscarPorNombre.mockResolvedValue(Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO }));
    const auditoria = crearAuditoriaFalsa();
    const useCase = new CrearSucursalUseCase(repo, auditoria, crearUnitOfWorkFalso());

    await expect(useCase.ejecutar({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO }, ACTOR)).rejects.toThrow(ConflictoDeNegocioError);
    expect(repo.guardar).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });
});
