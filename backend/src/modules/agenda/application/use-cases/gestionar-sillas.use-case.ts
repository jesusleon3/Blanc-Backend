import { Inject, Injectable } from '@nestjs/common';
import { Silla } from '../../domain/entities/silla.entity';
import { SILLA_REPOSITORY, SillaRepository } from '../../domain/ports/silla.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

/**
 * Alta, baja y listado de sillas (`DEC-031`).
 *
 * **Dar de alta una silla ES ampliar la capacidad de la sucursal**, porque el número de filas *es*
 * la capacidad. Por eso se audita como cambio de configuración y no como una operación menor: es
 * la palanca con la que alguien podría, sin querer, hacer que el salón venda más citas de las que
 * puede atender.
 */
@Injectable()
export class GestionarSillasUseCase {
  constructor(
    @Inject(SILLA_REPOSITORY) private readonly sillaRepository: SillaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async crear(input: { sucursalId: string; nombre: string }, actor: ClaimsUsuario): Promise<Silla> {
    const silla = Silla.crear(input);
    await this.persistir(silla, 'alta_silla', actor);
    return silla;
  }

  async desactivar(input: { sillaId: string }, actor: ClaimsUsuario): Promise<Silla> {
    const silla = await this.sillaRepository.buscarPorId(input.sillaId);
    if (!silla) throw new RecursoNoEncontradoError('Silla', input.sillaId);

    silla.desactivar();
    await this.persistir(silla, 'baja_silla', actor);
    return silla;
  }

  listar(sucursalId: string): Promise<Silla[]> {
    return this.sillaRepository.listarPorSucursal(sucursalId);
  }

  private async persistir(silla: Silla, accion: string, actor: ClaimsUsuario): Promise<void> {
    await this.unitOfWork.ejecutar(async () => {
      await this.sillaRepository.guardar(silla);
      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: silla.sucursalId,
        entidadAfectadaTipo: 'silla',
        entidadAfectadaId: silla.id,
        detalle: { accion, nombre: silla.nombre, activa: silla.activa },
      });
    });
  }
}
