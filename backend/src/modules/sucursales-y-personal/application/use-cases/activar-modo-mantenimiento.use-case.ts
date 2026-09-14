import { Inject, Injectable } from '@nestjs/common';
import { SUCURSAL_REPOSITORY, SucursalRepository } from '../../domain/ports/sucursal.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface ActivarModoMantenimientoInput {
  /** Si se omite, el mantenimiento se activa para todas las sucursales (RN-SUC-02, alcance global). */
  sucursalId?: string;
}

/**
 * Caso de uso — FL-SUC-02 (RN-SUC-02). Precondición explícita de la regla: **Rol Super Admin**
 * — la autorización de nivel 1 (`@Roles(Rol.SUPER_ADMIN)`) ya la exige en el controlador; este
 * caso de uso no vuelve a filtrar por rol porque no hay alcance de sucursal que revalidar
 * (Super Admin ya es global, RN-SUC-02 no distingue por sucursal asignada).
 */
@Injectable()
export class ActivarModoMantenimientoUseCase {
  constructor(
    @Inject(SUCURSAL_REPOSITORY) private readonly sucursalRepository: SucursalRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: ActivarModoMantenimientoInput, actor: ClaimsUsuario): Promise<void> {
    const sucursales = input.sucursalId
      ? [await this.requerirSucursal(input.sucursalId)]
      : await this.sucursalRepository.listar();

    // Alcance global: activar mantenimiento en N sucursales + registrar la auditoría es una sola
    // unidad de negocio (RN-AUD-01) — si la sucursal 3 de 5 falla, ninguna debe quedar a medias.
    await this.unitOfWork.ejecutar(async () => {
      for (const sucursal of sucursales) {
        sucursal.activarMantenimiento();
        await this.sucursalRepository.guardar(sucursal);
      }

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: input.sucursalId,
        entidadAfectadaTipo: 'sucursal',
        entidadAfectadaId: input.sucursalId ?? 'todas',
        detalle: { accion: 'activar_modo_mantenimiento', alcance: input.sucursalId ? 'sucursal' : 'global' },
      });
    });
  }

  private async requerirSucursal(id: string) {
    const sucursal = await this.sucursalRepository.buscarPorId(id);
    if (!sucursal) throw new RecursoNoEncontradoError('Sucursal', id);
    return sucursal;
  }
}
