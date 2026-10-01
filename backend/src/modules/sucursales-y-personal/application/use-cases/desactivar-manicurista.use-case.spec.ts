import { DesactivarManicuristaUseCase } from './desactivar-manicurista.use-case';
import { ManicuristaRepository } from '../../domain/ports/manicurista.repository';
import { VerificarCitasFuturasPort } from '../../domain/ports/verificar-citas-futuras.port';
import { Manicurista } from '../../domain/entities/manicurista.entity';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
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

function crearVerificadorFalso(tieneCitas: boolean): jest.Mocked<VerificarCitasFuturasPort> {
  return { tieneCitasFuturas: jest.fn().mockResolvedValue(tieneCitas) };
}

describe('DesactivarManicuristaUseCase — FL-SUC-03', () => {
  it('lanza RecursoNoEncontradoError si la manicurista no existe', async () => {
    const useCase = new DesactivarManicuristaUseCase(
      crearRepoFalso(null),
      crearVerificadorFalso(false),
      { registrar: jest.fn() },
      crearUnitOfWorkFalso(),
    );
    await expect(useCase.ejecutar({ id: 'inexistente' }, ACTOR)).rejects.toThrow(RecursoNoEncontradoError);
  });

  it('da de baja el registro administrativo y audita la acción', async () => {
    const manicurista = Manicurista.crear({ nombre: 'Karla Espinoza' });
    const repo = crearRepoFalso(manicurista);
    const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };

    await new DesactivarManicuristaUseCase(repo, crearVerificadorFalso(false), auditoria, crearUnitOfWorkFalso()).ejecutar(
      { id: manicurista.id },
      ACTOR,
    );

    expect(manicurista.activa).toBe(false);
    expect(repo.guardar).toHaveBeenCalledWith(manicurista);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ detalle: { accion: 'baja_manicurista' } }));
  });

  describe('Bloqueo duro ante citas futuras (`DEC-032`)', () => {
    it('rechaza la baja con 409 MANICURISTA_CON_CITAS_ACTIVAS si hay citas futuras', async () => {
      const manicurista = Manicurista.crear({ nombre: 'Karla Espinoza' });
      const repo = crearRepoFalso(manicurista);
      const unitOfWork = crearUnitOfWorkFalso();

      const intento = new DesactivarManicuristaUseCase(
        repo,
        crearVerificadorFalso(true),
        { registrar: jest.fn() },
        unitOfWork,
      ).ejecutar({ id: manicurista.id }, ACTOR);

      await expect(intento).rejects.toThrow(ConflictoDeNegocioError);
      await expect(intento).rejects.toMatchObject({ code: 'MANICURISTA_CON_CITAS_ACTIVAS', httpStatus: 409 });

      // Nada se escribió, y la entidad en memoria tampoco quedó desactivada a medias.
      expect(unitOfWork.ejecutar).not.toHaveBeenCalled();
      expect(repo.guardar).not.toHaveBeenCalled();
      expect(manicurista.activa).toBe(true);
    });

    it('consulta el puerto con el id de la manicurista, no con el del input', async () => {
      // Hoy coinciden, pero el input podría normalizarse en el futuro; la verificación debe
      // hacerse sobre la entidad que efectivamente se va a dar de baja.
      const manicurista = Manicurista.crear({ nombre: 'Karla Espinoza' });
      const verificador = crearVerificadorFalso(false);

      await new DesactivarManicuristaUseCase(
        crearRepoFalso(manicurista),
        verificador,
        { registrar: jest.fn() },
        crearUnitOfWorkFalso(),
      ).ejecutar({ id: manicurista.id }, ACTOR);

      expect(verificador.tieneCitasFuturas).toHaveBeenCalledWith(manicurista.id);
    });

    it('la existencia se evalúa ANTES que las citas futuras: un id falso da 404, no 409', async () => {
      const verificador = crearVerificadorFalso(true);

      const intento = new DesactivarManicuristaUseCase(
        crearRepoFalso(null),
        verificador,
        { registrar: jest.fn() },
        crearUnitOfWorkFalso(),
      ).ejecutar({ id: 'inexistente' }, ACTOR);

      await expect(intento).rejects.toMatchObject({ httpStatus: 404 });
      // Ni siquiera se pregunta por citas de algo que no existe.
      expect(verificador.tieneCitasFuturas).not.toHaveBeenCalled();
    });
  });
});
