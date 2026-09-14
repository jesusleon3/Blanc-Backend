import { Inject, Injectable } from '@nestjs/common';
import { ModificadorDiseno } from '../../domain/entities/modificador-diseno.entity';
import { MODIFICADOR_DISENO_REPOSITORY, ModificadorDisenoRepository } from '../../domain/ports/modificador-diseno.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface CrearModificadorDisenoInput {
  nombre: string;
  minutosAdicionales: number;
  /** Importe en **centavos** enteros (`RN-COT-07`); la entidad lo valida. */
  precioAdicionalCentavos: number;
}

/**
 * Caso de uso — `FL-COT-01` (alta de un modificador de diseño).
 *
 * No vincula el modificador a ningún servicio: esa relación vive en
 * `servicio_modificadores_aplicables` y está fuera del alcance de esta iteración. Igual que en
 * `CrearServicioUseCase`, escritura y auditoría comparten transacción (`RN-AUD-01`).
 */
@Injectable()
export class CrearModificadorDisenoUseCase {
  constructor(
    @Inject(MODIFICADOR_DISENO_REPOSITORY) private readonly modificadorRepository: ModificadorDisenoRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: CrearModificadorDisenoInput, actor: ClaimsUsuario): Promise<ModificadorDiseno> {
    const modificador = ModificadorDiseno.crear(input);

    await this.unitOfWork.ejecutar(async () => {
      await this.modificadorRepository.guardar(modificador);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'modificador_diseno',
        entidadAfectadaId: modificador.id,
        detalle: {
          accion: 'alta_modificador_diseno',
          nombre: modificador.nombre,
          minutosAdicionales: modificador.minutosAdicionales,
          precioAdicionalCentavos: modificador.precioAdicionalCentavos,
        },
      });
    });

    return modificador;
  }
}
