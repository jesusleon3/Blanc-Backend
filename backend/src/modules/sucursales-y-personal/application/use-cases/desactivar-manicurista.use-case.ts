import { Inject, Injectable } from '@nestjs/common';
import { MANICURISTA_REPOSITORY, ManicuristaRepository } from '../../domain/ports/manicurista.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface DesactivarManicuristaInput {
  id: string;
}

/**
 * Caso de uso — FL-SUC-03 (Baja de manicurista).
 *
 * **Alcance explícito, no una suposición silenciosa:** este caso de uso da de baja únicamente
 * el registro administrativo de `sucursales_personal.manicuristas`. El tratamiento de citas
 * futuras asignadas a esta persona (Pregunta 4, `OWNER_DECISION_LOG.md`) pertenece al recurso
 * agendable `agenda.manicuristas_recurso`, que no existe todavía (Agenda es Fase 2) — no hay,
 * hoy, ninguna cita real que pudiera quedar huérfana. Cuando Agenda se construya, ese módulo
 * deberá decidir cómo reacciona a esta baja (evento de dominio, verificación previa, etc.) — no
 * se diseña ni se asume aquí.
 */
@Injectable()
export class DesactivarManicuristaUseCase {
  constructor(
    @Inject(MANICURISTA_REPOSITORY) private readonly manicuristaRepository: ManicuristaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: DesactivarManicuristaInput, actor: ClaimsUsuario): Promise<void> {
    const manicurista = await this.manicuristaRepository.buscarPorId(input.id);
    if (!manicurista) throw new RecursoNoEncontradoError('Manicurista', input.id);

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
