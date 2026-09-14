import { Inject, Injectable } from '@nestjs/common';
import { Sucursal } from '../../domain/entities/sucursal.entity';
import { DiaFestivo } from '../../domain/entities/dia-festivo.entity';
import { SUCURSAL_REPOSITORY, SucursalRepository } from '../../domain/ports/sucursal.repository';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';

export interface ConsultarSucursalResultado {
  sucursal: Sucursal;
  diasFestivos: DiaFestivo[];
}

/**
 * Lectura pura — sin efecto, disponible a cualquier rol autenticado.
 *
 * **Sin alcance de sucursal a propósito, no por omisión:** para Analista/Solo lectura esto ya
 * es la decisión resuelta (RN-SEG-03 — alcance global). Para Administrador/Gerente/
 * Recepcionista/Manicurista sigue siendo una decisión de negocio pendiente (`OWNER_DECISION_LOG.md`
 * Pregunta 11, `functional-scope.md` §3.8) — no se agrega `tieneAlcanceSucursal()` aquí hasta
 * que la Dueña resuelva esa pregunta; hacerlo ahora sería inventar una política de autorización.
 */
@Injectable()
export class ConsultarSucursalUseCase {
  constructor(@Inject(SUCURSAL_REPOSITORY) private readonly sucursalRepository: SucursalRepository) {}

  async ejecutar(sucursalId: string): Promise<ConsultarSucursalResultado> {
    const sucursal = await this.sucursalRepository.buscarPorId(sucursalId);
    if (!sucursal) throw new RecursoNoEncontradoError('Sucursal', sucursalId);

    const diasFestivos = await this.sucursalRepository.listarDiasFestivos(sucursalId);
    return { sucursal, diasFestivos };
  }
}
