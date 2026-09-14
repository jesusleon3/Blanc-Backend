import { ActualizarModificadorDisenoUseCase } from './actualizar-modificador-diseno.use-case';
import { DesactivarModificadorDisenoUseCase } from './desactivar-modificador-diseno.use-case';
import { ModificadorDisenoRepository } from '../../domain/ports/modificador-diseno.repository';
import { ModificadorDiseno } from '../../domain/entities/modificador-diseno.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { DomainError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

const ACTOR: ClaimsUsuario = { sub: 'admin-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };
const MODIFICADOR_VALIDO = { nombre: 'Diseño francés', minutosAdicionales: 15, precioAdicionalCentavos: 8000 };

function crearRepoFalso(modificador: ModificadorDiseno | null): jest.Mocked<ModificadorDisenoRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn().mockResolvedValue(modificador),
    listar: jest.fn(),
    listarPorIds: jest.fn().mockResolvedValue([]),
  };
}

function crearUnitOfWorkEspiado() {
  const dentro: string[] = [];
  let abierta = false;
  const unitOfWork: UnitOfWork = {
    ejecutar: async <T,>(trabajo: () => Promise<T>): Promise<T> => {
      abierta = true;
      try {
        return await trabajo();
      } finally {
        abierta = false;
      }
    },
  };
  return { unitOfWork, dentro, registrar: (etiqueta: string) => () => void (abierta && dentro.push(etiqueta)) };
}

describe('ActualizarModificadorDisenoUseCase — FL-COT-01', () => {
  it('lanza RecursoNoEncontradoError si el modificador no existe', async () => {
    const useCase = new ActualizarModificadorDisenoUseCase(crearRepoFalso(null), { registrar: jest.fn() }, crearUnitOfWorkFalso());
    await expect(useCase.ejecutar({ modificadorId: 'inexistente', nombre: 'X' }, ACTOR)).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('aplica solo los campos provistos y audita el estado resultante', async () => {
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
    const useCase = new ActualizarModificadorDisenoUseCase(crearRepoFalso(modificador), auditoria, crearUnitOfWorkFalso());

    const resultado = await useCase.ejecutar({ modificadorId: modificador.id, precioAdicionalCentavos: 9500 }, ACTOR);

    expect(resultado.precioAdicionalCentavos).toBe(9500);
    expect(resultado.minutosAdicionales).toBe(15);
    expect(auditoria.registrar).toHaveBeenCalledWith({
      tipoAccion: 'cambio_configuracion',
      actor: 'admin-1',
      entidadAfectadaTipo: 'modificador_diseno',
      entidadAfectadaId: modificador.id,
      detalle: {
        accion: 'actualizar_modificador_diseno',
        campos: ['precioAdicionalCentavos'],
        precioAdicionalCentavos: 9500,
        minutosAdicionales: 15,
      },
    });
  });

  it('persiste y audita dentro de la MISMA unidad de trabajo (RN-AUD-01)', async () => {
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
    const repo = crearRepoFalso(modificador);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
    const { unitOfWork, dentro, registrar } = crearUnitOfWorkEspiado();
    repo.guardar.mockImplementation(async () => registrar('guardar')());
    auditoria.registrar.mockImplementation(async () => registrar('auditar')());

    await new ActualizarModificadorDisenoUseCase(repo, auditoria, unitOfWork).ejecutar(
      { modificadorId: modificador.id, minutosAdicionales: 20 },
      ACTOR,
    );

    expect(dentro).toEqual(['guardar', 'auditar']);
  });

  describe('RN-COT-07 — misma exigencia que al crear', () => {
    it.each([
      ['un importe con decimales', { precioAdicionalCentavos: 80.5 }],
      ['un importe negativo', { precioAdicionalCentavos: -500 }],
      ['minutos fraccionarios', { minutosAdicionales: 15.5 }],
      ['un nombre vacío', { nombre: '  ' }],
    ])('rechaza %s SIN abrir la transacción ni persistir', async (_caso, cambio) => {
      const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
      const repo = crearRepoFalso(modificador);
      const unitOfWork = crearUnitOfWorkFalso();
      const useCase = new ActualizarModificadorDisenoUseCase(repo, { registrar: jest.fn() }, unitOfWork);

      await expect(useCase.ejecutar({ modificadorId: modificador.id, ...cambio }, ACTOR)).rejects.toThrow(DomainError);

      expect(unitOfWork.ejecutar).not.toHaveBeenCalled();
      expect(repo.guardar).not.toHaveBeenCalled();
      expect(modificador.precioAdicionalCentavos).toBe(8000);
      expect(modificador.minutosAdicionales).toBe(15);
    });
  });
});

describe('DesactivarModificadorDisenoUseCase — FL-COT-01', () => {
  it('lanza RecursoNoEncontradoError si el modificador no existe', async () => {
    const useCase = new DesactivarModificadorDisenoUseCase(crearRepoFalso(null), { registrar: jest.fn() }, crearUnitOfWorkFalso());
    await expect(useCase.ejecutar({ modificadorId: 'inexistente' }, ACTOR)).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('da de baja lógicamente y audita — sin borrar', async () => {
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
    const repo = crearRepoFalso(modificador);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };

    await new DesactivarModificadorDisenoUseCase(repo, auditoria, crearUnitOfWorkFalso()).ejecutar(
      { modificadorId: modificador.id },
      ACTOR,
    );

    expect(modificador.activo).toBe(false);
    expect(repo.guardar).toHaveBeenCalledWith(modificador);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ detalle: { accion: 'baja_modificador_diseno' } }));
  });

  it('es idempotente: desactivar un modificador ya inactivo no falla', async () => {
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
    modificador.desactivar();
    const useCase = new DesactivarModificadorDisenoUseCase(crearRepoFalso(modificador), { registrar: jest.fn() }, crearUnitOfWorkFalso());

    await expect(useCase.ejecutar({ modificadorId: modificador.id }, ACTOR)).resolves.toBeUndefined();
    expect(modificador.activo).toBe(false);
  });

  it('persiste y audita dentro de la MISMA unidad de trabajo (RN-AUD-01)', async () => {
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
    const repo = crearRepoFalso(modificador);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
    const { unitOfWork, dentro, registrar } = crearUnitOfWorkEspiado();
    repo.guardar.mockImplementation(async () => registrar('guardar')());
    auditoria.registrar.mockImplementation(async () => registrar('auditar')());

    await new DesactivarModificadorDisenoUseCase(repo, auditoria, unitOfWork).ejecutar({ modificadorId: modificador.id }, ACTOR);

    expect(dentro).toEqual(['guardar', 'auditar']);
  });
});
