import { ActualizarConfiguracionSucursalUseCase } from './actualizar-configuracion-sucursal.use-case';
import { SucursalRepository } from '../../domain/ports/sucursal.repository';
import { Sucursal } from '../../domain/entities/sucursal.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { AccesoFueraDeAlcanceError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
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

function crearRepoFalso(sucursal: Sucursal | null): jest.Mocked<SucursalRepository> {
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

const auditoriaFalsa = (): jest.Mocked<AuditoriaPort> => ({ registrar: jest.fn() });

describe('ActualizarConfiguracionSucursalUseCase — RN-SUC-01, nivel 2 de RBAC (ADR-010)', () => {
  it('lanza RecursoNoEncontradoError si la sucursal no existe', async () => {
    const useCase = new ActualizarConfiguracionSucursalUseCase(crearRepoFalso(null), auditoriaFalsa(), crearUnitOfWorkFalso());
    const actor: ClaimsUsuario = { sub: '1', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL' };

    await expect(useCase.ejecutar({ sucursalId: 'inexistente', nombre: 'X' }, actor)).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('rechaza a un Administrador sin alcance sobre la sucursal (defensa en profundidad, ADR-010)', async () => {
    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    const useCase = new ActualizarConfiguracionSucursalUseCase(crearRepoFalso(sucursal), auditoriaFalsa(), crearUnitOfWorkFalso());
    const actorSinAlcance: ClaimsUsuario = { sub: '1', rol: Rol.ADMINISTRADOR, sucursales: ['otra-sucursal-id'] };

    await expect(useCase.ejecutar({ sucursalId: sucursal.id, nombre: 'Nuevo nombre' }, actorSinAlcance)).rejects.toThrow(AccesoFueraDeAlcanceError);
  });

  it('permite a un Administrador con alcance explícito sobre la sucursal', async () => {
    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    const repo = crearRepoFalso(sucursal);
    const auditoria = auditoriaFalsa();
    const useCase = new ActualizarConfiguracionSucursalUseCase(repo, auditoria, crearUnitOfWorkFalso());
    const actorConAlcance: ClaimsUsuario = { sub: '1', rol: Rol.ADMINISTRADOR, sucursales: [sucursal.id] };

    const resultado = await useCase.ejecutar({ sucursalId: sucursal.id, nombre: 'Blanc Polanco Norte' }, actorConAlcance);

    expect(resultado.nombre).toBe('Blanc Polanco Norte');
    expect(repo.guardar).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('Super Admin siempre tiene alcance, sin importar el claim de sucursales', async () => {
    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    const useCase = new ActualizarConfiguracionSucursalUseCase(crearRepoFalso(sucursal), auditoriaFalsa(), crearUnitOfWorkFalso());
    const superAdmin: ClaimsUsuario = { sub: '1', rol: Rol.SUPER_ADMIN, sucursales: [] };

    await expect(useCase.ejecutar({ sucursalId: sucursal.id, nombre: 'Blanc Polanco Norte' }, superAdmin)).resolves.toBeDefined();
  });
});
