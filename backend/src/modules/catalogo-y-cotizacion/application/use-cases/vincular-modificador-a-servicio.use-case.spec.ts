import { VincularModificadorAServicioUseCase } from './vincular-modificador-a-servicio.use-case';
import { DesvincularModificadorDeServicioUseCase } from './desvincular-modificador-de-servicio.use-case';
import { ObtenerModificadoresDeServicioUseCase } from './obtener-modificadores-de-servicio.use-case';
import { ServicioRepository } from '../../domain/ports/servicio.repository';
import { ModificadorDisenoRepository } from '../../domain/ports/modificador-diseno.repository';
import { Servicio } from '../../domain/entities/servicio.entity';
import { ModificadorDiseno } from '../../domain/entities/modificador-diseno.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

const ACTOR: ClaimsUsuario = { sub: 'admin-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' };
const SERVICIO_VALIDO = { nombre: 'Gelish', categoria: 'aplicacion', duracionBaseMinutos: 60, precioBaseCentavos: 45000 };
const MODIFICADOR_VALIDO = { nombre: 'Diseño francés', minutosAdicionales: 15, precioAdicionalCentavos: 8000 };

function crearServicioRepoFalso(servicio: Servicio | null, yaVinculado = false): jest.Mocked<ServicioRepository> {
  return {
    guardar: jest.fn(),
    buscarPorId: jest.fn().mockResolvedValue(servicio),
    listar: jest.fn(),
    vincularModificador: jest.fn(),
    desvincularModificador: jest.fn(),
    listarModificadoresDeServicio: jest.fn().mockResolvedValue([]),
    estaModificadorVinculado: jest.fn().mockResolvedValue(yaVinculado),
  };
}

function crearModificadorRepoFalso(modificador: ModificadorDiseno | null): jest.Mocked<ModificadorDisenoRepository> {
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

describe('VincularModificadorAServicioUseCase — FL-COT-01', () => {
  it('vincula y audita cuando ambos lados existen y están activos', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
    const servicioRepo = crearServicioRepoFalso(servicio);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };

    await new VincularModificadorAServicioUseCase(
      servicioRepo,
      crearModificadorRepoFalso(modificador),
      auditoria,
      crearUnitOfWorkFalso(),
    ).ejecutar({ servicioId: servicio.id, modificadorId: modificador.id }, ACTOR);

    expect(servicioRepo.vincularModificador).toHaveBeenCalledWith(servicio.id, modificador.id);
    expect(auditoria.registrar).toHaveBeenCalledWith({
      tipoAccion: 'cambio_configuracion',
      actor: 'admin-1',
      entidadAfectadaTipo: 'servicio_modificador',
      entidadAfectadaId: servicio.id,
      detalle: { accion: 'vincular_modificador_a_servicio', modificadorId: modificador.id },
    });
  });

  it('persiste y audita dentro de la MISMA unidad de trabajo (RN-AUD-01)', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
    const servicioRepo = crearServicioRepoFalso(servicio);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
    const { unitOfWork, dentro, registrar } = crearUnitOfWorkEspiado();
    servicioRepo.vincularModificador.mockImplementation(async () => registrar('vincular')());
    auditoria.registrar.mockImplementation(async () => registrar('auditar')());

    await new VincularModificadorAServicioUseCase(
      servicioRepo,
      crearModificadorRepoFalso(modificador),
      auditoria,
      unitOfWork,
    ).ejecutar({ servicioId: servicio.id, modificadorId: modificador.id }, ACTOR);

    expect(dentro).toEqual(['vincular', 'auditar']);
  });

  describe('validación de existencia — el 404 nombra CUÁL de los dos lados falta', () => {
    it('servicio inexistente → RECURSO_NO_ENCONTRADO mencionando "Servicio"', async () => {
      const useCase = new VincularModificadorAServicioUseCase(
        crearServicioRepoFalso(null),
        crearModificadorRepoFalso(ModificadorDiseno.crear(MODIFICADOR_VALIDO)),
        { registrar: jest.fn() },
        crearUnitOfWorkFalso(),
      );

      await expect(useCase.ejecutar({ servicioId: 'fantasma', modificadorId: 'x' }, ACTOR)).rejects.toMatchObject({
        code: 'RECURSO_NO_ENCONTRADO',
        httpStatus: 404,
        details: { recurso: 'Servicio' },
      });
    });

    it('modificador inexistente → RECURSO_NO_ENCONTRADO mencionando "ModificadorDiseno"', async () => {
      const servicio = Servicio.crear(SERVICIO_VALIDO);
      const useCase = new VincularModificadorAServicioUseCase(
        crearServicioRepoFalso(servicio),
        crearModificadorRepoFalso(null),
        { registrar: jest.fn() },
        crearUnitOfWorkFalso(),
      );

      await expect(useCase.ejecutar({ servicioId: servicio.id, modificadorId: 'fantasma' }, ACTOR)).rejects.toMatchObject({
        code: 'RECURSO_NO_ENCONTRADO',
        httpStatus: 404,
        details: { recurso: 'ModificadorDiseno' },
      });
    });
  });

  describe('validación de estado activo — no se habilita una oferta que el catálogo ya retiró', () => {
    it('rechaza vincular un modificador INACTIVO (409 MODIFICADOR_INACTIVO)', async () => {
      const servicio = Servicio.crear(SERVICIO_VALIDO);
      const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
      modificador.desactivar();
      const servicioRepo = crearServicioRepoFalso(servicio);
      const unitOfWork = crearUnitOfWorkFalso();

      const intento = new VincularModificadorAServicioUseCase(
        servicioRepo,
        crearModificadorRepoFalso(modificador),
        { registrar: jest.fn() },
        unitOfWork,
      ).ejecutar({ servicioId: servicio.id, modificadorId: modificador.id }, ACTOR);

      await expect(intento).rejects.toThrow(ConflictoDeNegocioError);
      await expect(intento).rejects.toMatchObject({ code: 'MODIFICADOR_INACTIVO', httpStatus: 409 });
      expect(unitOfWork.ejecutar).not.toHaveBeenCalled();
      expect(servicioRepo.vincularModificador).not.toHaveBeenCalled();
    });

    it('rechaza vincular EN un servicio inactivo (409 SERVICIO_INACTIVO)', async () => {
      const servicio = Servicio.crear(SERVICIO_VALIDO);
      servicio.desactivar();
      const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
      const servicioRepo = crearServicioRepoFalso(servicio);

      const intento = new VincularModificadorAServicioUseCase(
        servicioRepo,
        crearModificadorRepoFalso(modificador),
        { registrar: jest.fn() },
        crearUnitOfWorkFalso(),
      ).ejecutar({ servicioId: servicio.id, modificadorId: modificador.id }, ACTOR);

      await expect(intento).rejects.toMatchObject({ code: 'SERVICIO_INACTIVO', httpStatus: 409 });
      expect(servicioRepo.vincularModificador).not.toHaveBeenCalled();
    });

    it('la inexistencia se evalúa ANTES que el estado activo: un id falso da 404, no 409', async () => {
      const servicio = Servicio.crear(SERVICIO_VALIDO);
      servicio.desactivar();

      // Servicio inactivo Y modificador inexistente: gana el 404, que es el error más informativo.
      const useCase = new VincularModificadorAServicioUseCase(
        crearServicioRepoFalso(servicio),
        crearModificadorRepoFalso(null),
        { registrar: jest.fn() },
        crearUnitOfWorkFalso(),
      );

      await expect(useCase.ejecutar({ servicioId: servicio.id, modificadorId: 'fantasma' }, ACTOR)).rejects.toMatchObject({
        httpStatus: 404,
      });
    });
  });

  it('rechaza un vínculo duplicado con 409 MODIFICADOR_YA_VINCULADO', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    const modificador = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
    const servicioRepo = crearServicioRepoFalso(servicio, true);

    const intento = new VincularModificadorAServicioUseCase(
      servicioRepo,
      crearModificadorRepoFalso(modificador),
      { registrar: jest.fn() },
      crearUnitOfWorkFalso(),
    ).ejecutar({ servicioId: servicio.id, modificadorId: modificador.id }, ACTOR);

    await expect(intento).rejects.toMatchObject({ code: 'MODIFICADOR_YA_VINCULADO', httpStatus: 409 });
    expect(servicioRepo.vincularModificador).not.toHaveBeenCalled();
  });
});

describe('DesvincularModificadorDeServicioUseCase — FL-COT-01', () => {
  it('desvincula y audita', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    const servicioRepo = crearServicioRepoFalso(servicio);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };

    await new DesvincularModificadorDeServicioUseCase(servicioRepo, auditoria, crearUnitOfWorkFalso()).ejecutar(
      { servicioId: servicio.id, modificadorId: 'mod-1' },
      ACTOR,
    );

    expect(servicioRepo.desvincularModificador).toHaveBeenCalledWith(servicio.id, 'mod-1');
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ detalle: { accion: 'desvincular_modificador_de_servicio', modificadorId: 'mod-1' } }),
    );
  });

  it('exige que el servicio exista: un id falso en la URL da 404, no un 204 engañoso', async () => {
    const useCase = new DesvincularModificadorDeServicioUseCase(crearServicioRepoFalso(null), { registrar: jest.fn() }, crearUnitOfWorkFalso());
    await expect(useCase.ejecutar({ servicioId: 'fantasma', modificadorId: 'mod-1' }, ACTOR)).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('es idempotente: desvincular algo no vinculado no falla', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    const useCase = new DesvincularModificadorDeServicioUseCase(
      crearServicioRepoFalso(servicio),
      { registrar: jest.fn() },
      crearUnitOfWorkFalso(),
    );

    await expect(useCase.ejecutar({ servicioId: servicio.id, modificadorId: 'nunca-vinculado' }, ACTOR)).resolves.toBeUndefined();
  });

  it('PERMITE limpiar vínculos de un servicio INACTIVO — asimetría deliberada con vincular', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    servicio.desactivar();
    const servicioRepo = crearServicioRepoFalso(servicio);

    await new DesvincularModificadorDeServicioUseCase(servicioRepo, { registrar: jest.fn() }, crearUnitOfWorkFalso()).ejecutar(
      { servicioId: servicio.id, modificadorId: 'mod-1' },
      ACTOR,
    );

    // Exigir `activo` aquí dejaría vínculos imposibles de borrar tras una baja.
    expect(servicioRepo.desvincularModificador).toHaveBeenCalledWith(servicio.id, 'mod-1');
  });

  it('persiste y audita dentro de la MISMA unidad de trabajo (RN-AUD-01)', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    const servicioRepo = crearServicioRepoFalso(servicio);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
    const { unitOfWork, dentro, registrar } = crearUnitOfWorkEspiado();
    servicioRepo.desvincularModificador.mockImplementation(async () => registrar('desvincular')());
    auditoria.registrar.mockImplementation(async () => registrar('auditar')());

    await new DesvincularModificadorDeServicioUseCase(servicioRepo, auditoria, unitOfWork).ejecutar(
      { servicioId: servicio.id, modificadorId: 'mod-1' },
      ACTOR,
    );

    expect(dentro).toEqual(['desvincular', 'auditar']);
  });
});

describe('ObtenerModificadoresDeServicioUseCase — FL-COT-01 (lectura)', () => {
  it('hidrata los modificadores vinculados en UNA sola consulta (sin N+1)', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    const frances = ModificadorDiseno.crear(MODIFICADOR_VALIDO);
    const pedreria = ModificadorDiseno.crear({ ...MODIFICADOR_VALIDO, nombre: 'Pedrería' });

    const servicioRepo = crearServicioRepoFalso(servicio);
    servicioRepo.listarModificadoresDeServicio.mockResolvedValue([frances.id, pedreria.id]);
    const modificadorRepo = crearModificadorRepoFalso(null);
    modificadorRepo.listarPorIds.mockResolvedValue([frances, pedreria]);

    const resultado = await new ObtenerModificadoresDeServicioUseCase(servicioRepo, modificadorRepo).ejecutar({
      servicioId: servicio.id,
    });

    expect(resultado).toEqual([frances, pedreria]);
    expect(modificadorRepo.listarPorIds).toHaveBeenCalledTimes(1);
    expect(modificadorRepo.listarPorIds).toHaveBeenCalledWith([frances.id, pedreria.id]);
    expect(modificadorRepo.buscarPorId).not.toHaveBeenCalled();
  });

  it('lanza 404 si el servicio no existe', async () => {
    const useCase = new ObtenerModificadoresDeServicioUseCase(crearServicioRepoFalso(null), crearModificadorRepoFalso(null));
    await expect(useCase.ejecutar({ servicioId: 'fantasma' })).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('un servicio sin modificadores devuelve [] sin consultar el repositorio de modificadores', async () => {
    const servicio = Servicio.crear(SERVICIO_VALIDO);
    const servicioRepo = crearServicioRepoFalso(servicio);
    const modificadorRepo = crearModificadorRepoFalso(null);

    await expect(new ObtenerModificadoresDeServicioUseCase(servicioRepo, modificadorRepo).ejecutar({ servicioId: servicio.id })).resolves.toEqual(
      [],
    );
  });
});
