import { ActualizarServicioUseCase } from './actualizar-servicio.use-case';
import { DesactivarServicioUseCase } from './desactivar-servicio.use-case';
import { ServicioRepository } from '../../domain/ports/servicio.repository';
import { Servicio } from '../../domain/entities/servicio.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { DomainError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

const ACTOR: ClaimsUsuario = { sub: 'admin-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };
const SERVICIO_VALIDO = { nombre: 'Gelish', categoria: 'aplicacion', duracionBaseMinutos: 60, precioBaseCentavos: 45000 };

function crearRepoFalso(servicio: Servicio | null): jest.Mocked<ServicioRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn().mockResolvedValue(servicio),
    listar: jest.fn(),
    vincularModificador: jest.fn(),
    desvincularModificador: jest.fn(),
    listarModificadoresDeServicio: jest.fn().mockResolvedValue([]),
    estaModificadorVinculado: jest.fn().mockResolvedValue(false),
  };
}

/** Espía que distingue lo ocurrido dentro de la transacción de lo ocurrido fuera. */
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

describe('ActualizarServicioUseCase — FL-COT-01', () => {
  it('lanza RecursoNoEncontradoError si el servicio no existe', async () => {
    const useCase = new ActualizarServicioUseCase(crearRepoFalso(null), { registrar: jest.fn() }, crearUnitOfWorkFalso());
    await expect(useCase.ejecutar({ servicioId: 'inexistente', nombre: 'X' }, ACTOR)).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('aplica solo los campos provistos y deja el resto intacto', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    const repo = crearRepoFalso(servicio);
    const useCase = new ActualizarServicioUseCase(repo, { registrar: jest.fn() }, crearUnitOfWorkFalso());

    const resultado = await useCase.ejecutar({ servicioId: servicio.id, precioBaseCentavos: 52000 }, ACTOR);

    expect(resultado.precioBaseCentavos).toBe(52000);
    expect(resultado.nombre).toBe('Gelish');
    expect(resultado.duracionBaseMinutos).toBe(60);
    expect(repo.guardar).toHaveBeenCalledWith(servicio);
  });

  it('audita qué campos cambiaron Y el precio resultante — "cambió el precio" sin decir a cuánto no sirve', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
    const useCase = new ActualizarServicioUseCase(crearRepoFalso(servicio), auditoria, crearUnitOfWorkFalso());

    await useCase.ejecutar({ servicioId: servicio.id, precioBaseCentavos: 52000, nombre: 'Gelish premium' }, ACTOR);

    expect(auditoria.registrar).toHaveBeenCalledWith({
      tipoAccion: 'cambio_configuracion',
      actor: 'admin-1',
      entidadAfectadaTipo: 'servicio',
      entidadAfectadaId: servicio.id,
      detalle: {
        accion: 'actualizar_servicio',
        campos: ['precioBaseCentavos', 'nombre'],
        precioBaseCentavos: 52000,
        duracionBaseMinutos: 60,
      },
    });
  });

  it('persiste y audita dentro de la MISMA unidad de trabajo (RN-AUD-01)', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    const repo = crearRepoFalso(servicio);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
    const { unitOfWork, dentro, registrar } = crearUnitOfWorkEspiado();
    repo.guardar.mockImplementation(async () => registrar('guardar')());
    auditoria.registrar.mockImplementation(async () => registrar('auditar')());

    await new ActualizarServicioUseCase(repo, auditoria, unitOfWork).ejecutar(
      { servicioId: servicio.id, precioBaseCentavos: 52000 },
      ACTOR,
    );

    expect(dentro).toEqual(['guardar', 'auditar']);
  });

  describe('RN-COT-07 — editar NO es una puerta trasera para saltarse la validación del alta', () => {
    it.each([
      ['un precio con decimales', { precioBaseCentavos: 450.75 }],
      ['un precio negativo', { precioBaseCentavos: -1 }],
      ['una duración fraccionaria', { duracionBaseMinutos: 30.5 }],
      ['un nombre vacío', { nombre: '   ' }],
    ])('rechaza %s SIN abrir la transacción ni persistir', async (_caso, cambio) => {
      const servicio = Servicio.crear(SERVICIO_VALIDO);
      const repo = crearRepoFalso(servicio);
      const unitOfWork = crearUnitOfWorkFalso();
      const useCase = new ActualizarServicioUseCase(repo, { registrar: jest.fn() }, unitOfWork);

      await expect(useCase.ejecutar({ servicioId: servicio.id, ...cambio }, ACTOR)).rejects.toThrow(DomainError);

      expect(unitOfWork.ejecutar).not.toHaveBeenCalled();
      expect(repo.guardar).not.toHaveBeenCalled();
      // La entidad en memoria tampoco quedó a medias.
      expect(servicio.precioBaseCentavos).toBe(45000);
      expect(servicio.duracionBaseMinutos).toBe(60);
      expect(servicio.nombre).toBe('Gelish');
    });
  });
});

describe('DesactivarServicioUseCase — FL-COT-01', () => {
  it('lanza RecursoNoEncontradoError si el servicio no existe', async () => {
    const useCase = new DesactivarServicioUseCase(crearRepoFalso(null), { registrar: jest.fn() }, crearUnitOfWorkFalso());
    await expect(useCase.ejecutar({ servicioId: 'inexistente' }, ACTOR)).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('da de baja lógicamente y audita — sin borrar (preserva las citas ya cotizadas)', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    const repo = crearRepoFalso(servicio);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };

    await new DesactivarServicioUseCase(repo, auditoria, crearUnitOfWorkFalso()).ejecutar({ servicioId: servicio.id }, ACTOR);

    expect(servicio.activo).toBe(false);
    expect(repo.guardar).toHaveBeenCalledWith(servicio);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ detalle: { accion: 'baja_servicio' } }));
  });

  it('es idempotente: desactivar un servicio ya inactivo no falla', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    servicio.desactivar();
    const useCase = new DesactivarServicioUseCase(crearRepoFalso(servicio), { registrar: jest.fn() }, crearUnitOfWorkFalso());

    await expect(useCase.ejecutar({ servicioId: servicio.id }, ACTOR)).resolves.toBeUndefined();
    expect(servicio.activo).toBe(false);
  });

  it('persiste y audita dentro de la MISMA unidad de trabajo (RN-AUD-01)', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    const repo = crearRepoFalso(servicio);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
    const { unitOfWork, dentro, registrar } = crearUnitOfWorkEspiado();
    repo.guardar.mockImplementation(async () => registrar('guardar')());
    auditoria.registrar.mockImplementation(async () => registrar('auditar')());

    await new DesactivarServicioUseCase(repo, auditoria, unitOfWork).ejecutar({ servicioId: servicio.id }, ACTOR);

    expect(dentro).toEqual(['guardar', 'auditar']);
  });
});
