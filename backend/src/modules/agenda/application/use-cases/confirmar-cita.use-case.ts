import { Inject, Injectable } from '@nestjs/common';
import { Cita } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { aplicarTransicion } from './transicion-cita.base';

/**
 * Caso de uso — la clienta respondió que sí (`pendiente_confirmacion → confirmada`), o un humano
 * confirmó el pago del anticipo de una clienta en lista roja (`en_espera_pago → confirmada`).
 *
 * ⚠️ **ESTE ES EL PUNTO DONDE SE RESUELVE LA CARRERA DE `RN-ANT-03`.** Mientras el anticipo está
 * pendiente, el horario **no está retenido**: otra clienta puede tener una cita sobre el mismo
 * hueco, también en `en_espera_pago`. Al confirmar, la cita pasa a ocupar — y si otra llegó
 * primero, la restricción de exclusión rechaza esta y el repositorio devuelve `SILLA_OCUPADA`.
 * No es un fallo del sistema: es el comportamiento aprobado, *"el primero en pagar se queda con el
 * cupo"*. Quien consuma este caso de uso debe estar preparado para ese 409.
 */
@Injectable()
export class ConfirmarCitaUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  ejecutar(input: { citaId: string }, actor: ClaimsUsuario): Promise<Cita> {
    return aplicarTransicion(
      { citaRepository: this.citaRepository, auditoria: this.auditoria, unitOfWork: this.unitOfWork },
      { citaId: input.citaId, nuevoEstado: 'confirmada', accion: 'confirmar_cita', actor },
    );
  }
}
