import { Inject, Injectable } from '@nestjs/common';
import { ModificadorDiseno } from '../../domain/entities/modificador-diseno.entity';
import { MODIFICADOR_DISENO_REPOSITORY, ModificadorDisenoRepository } from '../../domain/ports/modificador-diseno.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface ActualizarModificadorDisenoInput {
  modificadorId: string;
  nombre?: string;
  minutosAdicionales?: number;
  precioAdicionalCentavos?: number;
}

/**
 * Caso de uso — `FL-COT-01` (edición de un modificador). Mismo criterio que
 * `ActualizarServicioUseCase`: actualización parcial, revalidación delegada en la entidad y
 * auditoría con el estado resultante de los campos sensibles.
 */
@Injectable()
export class ActualizarModificadorDisenoUseCase {
  constructor(
    @Inject(MODIFICADOR_DISENO_REPOSITORY) private readonly modificadorRepository: ModificadorDisenoRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: ActualizarModificadorDisenoInput, actor: ClaimsUsuario): Promise<ModificadorDiseno> {
    const modificador = await this.modificadorRepository.buscarPorId(input.modificadorId);
    if (!modificador) throw new RecursoNoEncontradoError('ModificadorDiseno', input.modificadorId);

    const camposSolicitados = Object.keys(input).filter((campo) => campo !== 'modificadorId');

    modificador.actualizarDatos(input);

    await this.unitOfWork.ejecutar(async () => {
      await this.modificadorRepository.guardar(modificador);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'modificador_diseno',
        entidadAfectadaId: modificador.id,
        detalle: {
          accion: 'actualizar_modificador_diseno',
          campos: camposSolicitados,
          precioAdicionalCentavos: modificador.precioAdicionalCentavos,
          minutosAdicionales: modificador.minutosAdicionales,
        },
      });
    });

    return modificador;
  }
}
