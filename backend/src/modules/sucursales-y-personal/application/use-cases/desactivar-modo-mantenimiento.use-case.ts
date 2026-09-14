import { Inject, Injectable } from '@nestjs/common';
import { SUCURSAL_REPOSITORY, SucursalRepository } from '../../domain/ports/sucursal.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface DesactivarModoMantenimientoInput {
  sucursalId?: string;
}

/** Caso de uso — FL-SUC-02 (RN-SUC-02), reverso de activar. Precondición: Rol Super Admin. */
@Injectable()
export class DesactivarModoMantenimientoUseCase {
  constructor(
    @Inject(SUCURSAL_REPOSITORY) private readonly sucursalRepository: SucursalRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: DesactivarModoMantenimientoInput, actor: ClaimsUsuario): Promise<void> {
    const sucursales = input.sucursalId
      ? [await this.requerirSucursal(input.sucursalId)]
      : await this.sucursalRepository.listar();

    await this.unitOfWork.ejecutar(async () => {
      for (const sucursal of sucursales) {
        sucursal.desactivarMantenimiento();
        await this.sucursalRepository.guardar(sucursal);
      }

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: input.sucursalId,
        entidadAfectadaTipo: 'sucursal',
        entidadAfectadaId: input.sucursalId ?? 'todas',
        detalle: { accion: 'desactivar_modo_mantenimiento', alcance: input.sucursalId ? 'sucursal' : 'global' },
      });
    });
  }

  private async requerirSucursal(id: string) {
    const sucursal = await this.sucursalRepository.buscarPorId(id);
    if (!sucursal) throw new RecursoNoEncontradoError('Sucursal', id);
    return sucursal;
  }
}
