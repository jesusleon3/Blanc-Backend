import { ActivarModoMantenimientoUseCase } from './activar-modo-mantenimiento.use-case';
import { SucursalRepository } from '../../domain/ports/sucursal.repository';
import { Sucursal } from '../../domain/entities/sucursal.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
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

const SUPER_ADMIN: ClaimsUsuario = { sub: 'super-1', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL' };

function crearRepoFalso(sucursales: Sucursal[]): jest.Mocked<SucursalRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn((id: string) => Promise.resolve(sucursales.find((s) => s.id === id) ?? null)),
    buscarPorNombre: jest.fn(),
    listar: jest.fn().mockResolvedValue(sucursales),
    agregarDiaFestivo: jest.fn(),
    listarDiasFestivos: jest.fn(),
    buscarDiaFestivoPorId: jest.fn(),
    eliminarDiaFestivo: jest.fn(),
  };
}

describe('ActivarModoMantenimientoUseCase — RN-SUC-02', () => {
  it('activa el mantenimiento de una sola sucursal cuando se especifica sucursalId', async () => {
    const a = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    const b = Sucursal.crear({ nombre: 'Blanc Condesa', horarioSemanal: HORARIO });
    const repo = crearRepoFalso([a, b]);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
    const useCase = new ActivarModoMantenimientoUseCase(repo, auditoria, crearUnitOfWorkFalso());

    await useCase.ejecutar({ sucursalId: a.id }, SUPER_ADMIN);

    expect(a.enMantenimiento).toBe(true);
    expect(b.enMantenimiento).toBe(false);
    expect(repo.guardar).toHaveBeenCalledTimes(1);
  });

  it('activa el mantenimiento de TODAS las sucursales cuando no se especifica sucursalId (alcance global, RN-SUC-02)', async () => {
    const a = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    const b = Sucursal.crear({ nombre: 'Blanc Condesa', horarioSemanal: HORARIO });
    const repo = crearRepoFalso([a, b]);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
    const useCase = new ActivarModoMantenimientoUseCase(repo, auditoria, crearUnitOfWorkFalso());

    await useCase.ejecutar({}, SUPER_ADMIN);

    expect(a.enMantenimiento).toBe(true);
    expect(b.enMantenimiento).toBe(true);
    expect(repo.guardar).toHaveBeenCalledTimes(2);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ detalle: expect.objectContaining({ alcance: 'global' }) }));
  });

  it('lanza RecursoNoEncontradoError si la sucursal especificada no existe', async () => {
    const repo = crearRepoFalso([]);
    const useCase = new ActivarModoMantenimientoUseCase(repo, { registrar: jest.fn() }, crearUnitOfWorkFalso());

    await expect(useCase.ejecutar({ sucursalId: 'inexistente' }, SUPER_ADMIN)).rejects.toThrow(RecursoNoEncontradoError);
  });

  describe('atomicidad (Tarea 4 — hardening transversal, RN-AUD-01)', () => {
    /**
     * Doble transaccional: modela lo que un `UnitOfWork` real (respaldado por `db.transaction()`)
     * debe garantizar — los `guardar()` durante `trabajo` quedan en un buffer "pendiente" que solo
     * reemplaza el estado "confirmado" si `trabajo` resuelve; si lanza, el buffer se descarta y el
     * estado confirmado no cambia. No sustituye una prueba contra Postgres real (ver limitación de
     * pg-mem documentada en el reporte de cierre de este hardening): prueba el contrato de
     * orquestación del caso de uso, no el motor de transacciones real.
     */
    function crearRepoYUowTransaccionales(sucursales: Sucursal[]) {
      let confirmado = new Map(sucursales.map((s) => [s.id, s.enMantenimiento]));
      let pendiente: Map<string, boolean> | null = null;

      const repo: jest.Mocked<SucursalRepository> = {
        guardar: jest.fn(async (s: Sucursal) => {
          (pendiente ?? confirmado).set(s.id, s.enMantenimiento);
        }),
        buscarPorId: jest.fn((id: string) => Promise.resolve(sucursales.find((s) => s.id === id) ?? null)),
        buscarPorNombre: jest.fn(),
        listar: jest.fn().mockResolvedValue(sucursales),
        agregarDiaFestivo: jest.fn(),
        listarDiasFestivos: jest.fn(),
        buscarDiaFestivoPorId: jest.fn(),
        eliminarDiaFestivo: jest.fn(),
      };

      const unitOfWork: jest.Mocked<UnitOfWork> = {
        ejecutar: jest.fn(async (trabajo: () => Promise<unknown>) => {
          pendiente = new Map(confirmado);
          try {
            const resultado = await trabajo();
            confirmado = pendiente;
            return resultado;
          } finally {
            pendiente = null;
          }
        }),
      } as unknown as jest.Mocked<UnitOfWork>;

      return { repo, unitOfWork, estabaEnMantenimientoConfirmado: (id: string) => confirmado.get(id) };
    }

    it('si la auditoría falla después de guardar todas las sucursales, ninguna queda confirmada como en mantenimiento (todo o nada)', async () => {
      const a = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
      const b = Sucursal.crear({ nombre: 'Blanc Condesa', horarioSemanal: HORARIO });
      const { repo, unitOfWork, estabaEnMantenimientoConfirmado } = crearRepoYUowTransaccionales([a, b]);
      const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn().mockRejectedValue(new Error('fallo simulado de auditoría')) };
      const useCase = new ActivarModoMantenimientoUseCase(repo, auditoria, unitOfWork);

      await expect(useCase.ejecutar({}, SUPER_ADMIN)).rejects.toThrow('fallo simulado de auditoría');

      expect(repo.guardar).toHaveBeenCalledTimes(2);
      expect(estabaEnMantenimientoConfirmado(a.id)).toBe(false);
      expect(estabaEnMantenimientoConfirmado(b.id)).toBe(false);
    });
  });
});
