import { CrearModificadorDisenoUseCase } from './crear-modificador-diseno.use-case';
import { ObtenerModificadoresDisenoUseCase } from './obtener-modificadores-diseno.use-case';
import { ModificadorDisenoRepository } from '../../domain/ports/modificador-diseno.repository';
import { ModificadorDiseno } from '../../domain/entities/modificador-diseno.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { DomainError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

const ACTOR: ClaimsUsuario = { sub: 'admin-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };
const INPUT_VALIDO = { nombre: 'Diseño francés', minutosAdicionales: 15, precioAdicionalCentavos: 8000 };

function crearRepoFalso(modificadores: ModificadorDiseno[] = []): jest.Mocked<ModificadorDisenoRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn(),
    listar: jest.fn().mockResolvedValue(modificadores),
    listarPorIds: jest.fn().mockResolvedValue([]),
  };
}

describe('CrearModificadorDisenoUseCase — FL-COT-01', () => {
  it('persiste el modificador y registra la auditoría del alta', async () => {
    const repo = crearRepoFalso();
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };

    const modificador = await new CrearModificadorDisenoUseCase(repo, auditoria, crearUnitOfWorkFalso()).ejecutar(INPUT_VALIDO, ACTOR);

    expect(repo.guardar).toHaveBeenCalledWith(modificador);
    expect(auditoria.registrar).toHaveBeenCalledWith({
      tipoAccion: 'cambio_configuracion',
      actor: 'admin-1',
      entidadAfectadaTipo: 'modificador_diseno',
      entidadAfectadaId: modificador.id,
      detalle: {
        accion: 'alta_modificador_diseno',
        nombre: 'Diseño francés',
        minutosAdicionales: 15,
        precioAdicionalCentavos: 8000,
      },
    });
  });

  it('ejecuta persistencia y auditoría dentro de la MISMA unidad de trabajo (RN-AUD-01)', async () => {
    const repo = crearRepoFalso();
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };

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

    await new CrearModificadorDisenoUseCase(repo, auditoria, unitOfWork).ejecutar(INPUT_VALIDO, ACTOR);

    expect(dentroDeLaTransaccion).toEqual(['guardar', 'auditar']);
  });

  it('un importe adicional con decimales se rechaza ANTES de abrir la transacción (RN-COT-07)', async () => {
    const repo = crearRepoFalso();
    const unitOfWork = crearUnitOfWorkFalso();
    const useCase = new CrearModificadorDisenoUseCase(repo, { registrar: jest.fn() }, unitOfWork);

    await expect(useCase.ejecutar({ ...INPUT_VALIDO, precioAdicionalCentavos: 80.5 }, ACTOR)).rejects.toThrow(DomainError);

    expect(unitOfWork.ejecutar).not.toHaveBeenCalled();
    expect(repo.guardar).not.toHaveBeenCalled();
  });
});

describe('ObtenerModificadoresDisenoUseCase — FL-COT-01 (lectura)', () => {
  it('devuelve todos los modificadores del catálogo', async () => {
    const frances = ModificadorDiseno.crear(INPUT_VALIDO);
    const repo = crearRepoFalso([frances]);

    await expect(new ObtenerModificadoresDisenoUseCase(repo).ejecutar()).resolves.toEqual([frances]);
    expect(repo.listar).toHaveBeenCalledTimes(1);
  });
});
