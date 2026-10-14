import { Inject, Injectable } from '@nestjs/common';
import { Cita } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { aplicarTransicion } from './transicion-cita.base';

/**
 * Caso de uso — la clienta no se presentó. **Siempre manual**, lo marca la Encargada o la Dueña
 * (`DEC-042`): el sistema nunca lo deduce solo, porque no tiene forma de saber si alguien entró
 * por la puerta.
 *
 * `no_show` **ocupa el horario** (`DEC-034`): es la diferencia con cancelar. Cancelar avisa y
 * libera el hueco para otra; no presentarse no libera nada, porque nadie pudo aprovecharlo.
 * Confundirlos falsearía la ocupación histórica y, con ella, cualquier reporte de productividad.
 *
 * **Consume `RN-CRM-06`**: un `no_show` es uno de los disparadores de la sugerencia de lista roja.
 * Ese enlace lo hará el módulo de CRM (Fase 3) a partir de este cambio de estado.
 */
@Injectable()
export class MarcarNoShowUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  ejecutar(input: { citaId: string }, actor: ClaimsUsuario): Promise<Cita> {
    return aplicarTransicion(
      { citaRepository: this.citaRepository, auditoria: this.auditoria, unitOfWork: this.unitOfWork },
      { citaId: input.citaId, nuevoEstado: 'no_show', accion: 'marcar_no_show', actor },
    );
  }
}
