import { Inject, Injectable } from '@nestjs/common';
import { MANICURISTA_REPOSITORY, ManicuristaRepository } from '../../domain/ports/manicurista.repository';
import { VERIFICAR_CITAS_FUTURAS_PORT, VerificarCitasFuturasPort } from '../../domain/ports/verificar-citas-futuras.port';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface DesactivarManicuristaInput {
  id: string;
}

/**
 * Caso de uso — FL-SUC-03 (Baja de manicurista).
 *
 * **Bloqueo duro ante citas futuras (`DEC-032`, 2026-09-30).** La Dueña resolvió la Pregunta 4 con
 * la opción (a): si la manicurista tiene citas futuras, la baja **se rechaza**; no se cancela ni se
 * reasigna nada automáticamente. La verificación viaja por `VerificarCitasFuturasPort` porque las
 * citas viven en otro Bounded Context y `ADR-005` prohíbe consultarlas directamente.
 *
 * ⚠️ **Hoy esa verificación no protege nada**: el puerto lo satisface un sustituto temporal que
 * siempre responde `false` (Agenda no existe). Ver `SinAgendaVerificarCitasFuturasAdapter`.
 *
 * **Orden de las comprobaciones, deliberado:** primero existencia (404), después citas futuras
 * (409). Un id inexistente debe dar el error más informativo, no un conflicto sobre algo que no
 * existe.
 */
@Injectable()
export class DesactivarManicuristaUseCase {
  constructor(
    @Inject(MANICURISTA_REPOSITORY) private readonly manicuristaRepository: ManicuristaRepository,
    @Inject(VERIFICAR_CITAS_FUTURAS_PORT) private readonly verificarCitasFuturas: VerificarCitasFuturasPort,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: DesactivarManicuristaInput, actor: ClaimsUsuario): Promise<void> {
    const manicurista = await this.manicuristaRepository.buscarPorId(input.id);
    if (!manicurista) throw new RecursoNoEncontradoError('Manicurista', input.id);

    if (await this.verificarCitasFuturas.tieneCitasFuturas(manicurista.id)) {
      throw new ConflictoDeNegocioError(
        'MANICURISTA_CON_CITAS_ACTIVAS',
        'La manicurista tiene citas futuras; reasígnalas o cancélalas antes de darla de baja.',
        { manicuristaId: manicurista.id },
      );
    }

    manicurista.desactivar();

    await this.unitOfWork.ejecutar(async () => {
      await this.manicuristaRepository.guardar(manicurista);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'manicurista',
        entidadAfectadaId: manicurista.id,
        detalle: { accion: 'baja_manicurista' },
      });
    });
  }
}
