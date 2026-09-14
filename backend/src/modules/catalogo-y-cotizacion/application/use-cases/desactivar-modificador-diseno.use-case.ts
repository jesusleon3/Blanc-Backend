import { Inject, Injectable } from '@nestjs/common';
import { MODIFICADOR_DISENO_REPOSITORY, ModificadorDisenoRepository } from '../../domain/ports/modificador-diseno.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface DesactivarModificadorDisenoInput {
  modificadorId: string;
}

/**
 * Caso de uso — `FL-COT-01` (baja de un modificador). Mismo criterio que
 * `DesactivarServicioUseCase`: baja lógica e idempotente, nunca borrado físico.
 *
 * NOTA: desactivar un modificador **no** retira sus vínculos en
 * `servicio_modificadores_aplicables` — esa tabla no se lee ni se escribe todavía. Cuando el
 * vínculo se implemente, tendrá que decidirse si un servicio activo puede seguir ofreciendo un
 * modificador inactivo; esa decisión no se anticipa aquí.
 */
@Injectable()
export class DesactivarModificadorDisenoUseCase {
  constructor(
    @Inject(MODIFICADOR_DISENO_REPOSITORY) private readonly modificadorRepository: ModificadorDisenoRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: DesactivarModificadorDisenoInput, actor: ClaimsUsuario): Promise<void> {
    const modificador = await this.modificadorRepository.buscarPorId(input.modificadorId);
    if (!modificador) throw new RecursoNoEncontradoError('ModificadorDiseno', input.modificadorId);

    modificador.desactivar();

    await this.unitOfWork.ejecutar(async () => {
      await this.modificadorRepository.guardar(modificador);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'modificador_diseno',
        entidadAfectadaId: modificador.id,
        detalle: { accion: 'baja_modificador_diseno' },
      });
    });
  }
}
