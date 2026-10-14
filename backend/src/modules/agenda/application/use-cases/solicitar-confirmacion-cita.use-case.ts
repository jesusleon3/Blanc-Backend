import { Inject, Injectable } from '@nestjs/common';
import { Cita } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { aplicarTransicion } from './transicion-cita.base';

/**
 * Caso de uso — se envió el recordatorio y la cita queda **esperando respuesta** de la clienta
 * (`agendada → pendiente_confirmacion`).
 *
 * Existe porque `RN-CONV-11` fijó que la confirmación es **interactiva**: no basta con avisar, la
 * clienta tiene que contestar. Sin este estado intermedio no habría forma de distinguir "ya le
 * avisamos y callÓ" de "todavía no le hemos avisado" — que es justo lo que hay que saber para
 * decidir si insistir.
 *
 * **No envía el mensaje**: eso es Notificaciones (Fase 4). Este caso de uso registra que se pidió.
 */
@Injectable()
export class SolicitarConfirmacionCitaUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  ejecutar(input: { citaId: string }, actor: ClaimsUsuario): Promise<Cita> {
    return aplicarTransicion(
      { citaRepository: this.citaRepository, auditoria: this.auditoria, unitOfWork: this.unitOfWork },
      { citaId: input.citaId, nuevoEstado: 'pendiente_confirmacion', accion: 'solicitar_confirmacion', actor },
    );
  }
}
