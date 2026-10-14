import { Inject, Injectable } from '@nestjs/common';
import { Cita } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { aplicarTransicion } from './transicion-cita.base';

/**
 * Caso de uso — cerrar la cita como atendida (`DEC-030`).
 *
 * La Dueña decidió que `completada` es **automática por el paso del tiempo** y **sin notificación
 * a la clienta**: ningún empleado tiene que confirmarlo. Este caso de uso es el que invocará el
 * job programado cuando el horario haya pasado, y el que publicará `CitaCompletada` por el Outbox
 * — el evento del que depende toda la Fase de Garantías.
 *
 * **Por qué se almacena y no se calcula:** una vista derivada ("si el rango ya pasó, está
 * completada") no emite eventos de dominio, y Garantías necesita un instante en el que algo ocurre.
 *
 * ⚠️ **`N-02` sigue abierto** y afecta directamente a este caso de uso: `no_show` es manual y
 * `completada` automática, de modo que si el job marca `completada` a las 19:00 y la Encargada
 * descubre el no-show a la mañana siguiente, ya no puede corregir — `completada` es terminal.
 * Falta decidir entre una ventana de gracia antes de ejecutar el job, o permitir que `no_show`
 * sobrescriba. **Hasta que se resuelva, el job NO debería ejecutarse de forma agresiva.**
 */
@Injectable()
export class CompletarCitaUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  ejecutar(input: { citaId: string }, actor: ClaimsUsuario): Promise<Cita> {
    return aplicarTransicion(
      { citaRepository: this.citaRepository, auditoria: this.auditoria, unitOfWork: this.unitOfWork },
      { citaId: input.citaId, nuevoEstado: 'completada', accion: 'completar_cita', actor },
    );
  }
}
