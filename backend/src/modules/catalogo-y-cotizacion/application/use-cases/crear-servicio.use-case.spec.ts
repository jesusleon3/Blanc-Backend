import { CrearServicioUseCase } from './crear-servicio.use-case';
import { ObtenerServiciosUseCase } from './obtener-servicios.use-case';
import { ServicioRepository } from '../../domain/ports/servicio.repository';
import { Servicio } from '../../domain/entities/servicio.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { DomainError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

const ACTOR: ClaimsUsuario = { sub: 'admin-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };
const INPUT_VALIDO = { nombre: 'Gelish', categoria: 'aplicacion', duracionBaseMinutos: 60, precioBaseCentavos: 45000 };

function crearRepoFalso(servicios: Servicio[] = []): jest.Mocked<ServicioRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn(),
    listar: jest.fn().mockResolvedValue(servicios),
    vincularModificador: jest.fn(),
    desvincularModificador: jest.fn(),
    listarModificadoresDeServicio: jest.fn().mockResolvedValue([]),
    estaModificadorVinculado: jest.fn().mockResolvedValue(false),
  };
}

describe('CrearServicioUseCase — FL-COT-01', () => {
  it('persiste el servicio y registra la auditoría del alta', async () => {
    const repo = crearRepoFalso();
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
    const useCase = new CrearServicioUseCase(repo, auditoria, crearUnitOfWorkFalso());

    const servicio = await useCase.ejecutar(INPUT_VALIDO, ACTOR);

    expect(repo.guardar).toHaveBeenCalledWith(servicio);
    expect(auditoria.registrar).toHaveBeenCalledWith({
      tipoAccion: 'cambio_configuracion',
      actor: 'admin-1',
      entidadAfectadaTipo: 'servicio',
      entidadAfectadaId: servicio.id,
      detalle: {
        accion: 'alta_servicio',
        nombre: 'Gelish',
        categoria: 'aplicacion',
        duracionBaseMinutos: 60,
        precioBaseCentavos: 45000,
      },
    });
  });

  it('ejecuta persistencia y auditoría dentro de la MISMA unidad de trabajo (RN-AUD-01)', async () => {
    const repo = crearRepoFalso();
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };

    // Espía que registra qué ocurrió dentro del callback transaccional y qué quedó fuera.
    const dentroDeLaTransaccion: string[] = [];
    let transaccionAbierta = false;
    const unitOfWork: UnitOfWork = {
      ejecutar: async <T,>(trabajo: () => Promise<T>): Promise<T> => {
        transaccionAbierta = true;
        try {
          return await trabajo();
        } finally {
          transaccionAbierta = false;
        }
      },
    };
    repo.guardar.mockImplementation(async () => {
      if (transaccionAbierta) dentroDeLaTransaccion.push('guardar');
    });
    auditoria.registrar.mockImplementation(async () => {
      if (transaccionAbierta) dentroDeLaTransaccion.push('auditar');
    });

    await new CrearServicioUseCase(repo, auditoria, unitOfWork).ejecutar(INPUT_VALIDO, ACTOR);

    expect(dentroDeLaTransaccion).toEqual(['guardar', 'auditar']);
  });

  it('si la auditoría falla, el error se propaga y arrastra la transacción completa', async () => {
    const repo = crearRepoFalso();
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn().mockRejectedValue(new Error('auditoría caída')) };
    const unitOfWork = crearUnitOfWorkFalso();

    await expect(new CrearServicioUseCase(repo, auditoria, unitOfWork).ejecutar(INPUT_VALIDO, ACTOR)).rejects.toThrow('auditoría caída');
  });

  it('un importe con decimales se rechaza ANTES de abrir la transacción (RN-COT-07)', async () => {
    const repo = crearRepoFalso();
    const unitOfWork = crearUnitOfWorkFalso();
    const useCase = new CrearServicioUseCase(repo, { registrar: jest.fn() }, unitOfWork);

    await expect(useCase.ejecutar({ ...INPUT_VALIDO, precioBaseCentavos: 450.75 }, ACTOR)).rejects.toThrow(DomainError);

    expect(unitOfWork.ejecutar).not.toHaveBeenCalled();
    expect(repo.guardar).not.toHaveBeenCalled();
  });
});

describe('ObtenerServiciosUseCase — FL-COT-01 (lectura)', () => {
  it('devuelve el catálogo tal cual lo entrega el repositorio', async () => {
    const gelish = Servicio.crear(INPUT_VALIDO);
    const repo = crearRepoFalso([gelish]);

    await expect(new ObtenerServiciosUseCase(repo).ejecutar()).resolves.toEqual([gelish]);
    expect(repo.listar).toHaveBeenCalledTimes(1);
  });

  it('incluye los servicios inactivos: la lectura no filtra por disponibilidad', async () => {
    const retirado = Servicio.crear({ ...INPUT_VALIDO, nombre: 'Acrílico descontinuado' });
    retirado.desactivar();
    const repo = crearRepoFalso([retirado]);

    const resultado = await new ObtenerServiciosUseCase(repo).ejecutar();

    expect(resultado).toHaveLength(1);
    expect(resultado[0].activo).toBe(false);
  });
});
