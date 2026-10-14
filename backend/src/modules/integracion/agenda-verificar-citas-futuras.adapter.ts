import { Inject, Injectable } from '@nestjs/common';
import { VerificarCitasFuturasPort } from '../sucursales-y-personal/domain/ports/verificar-citas-futuras.port';
import { CITA_REPOSITORY, CitaRepository } from '../agenda/domain/ports/cita.repository';

/**
 * Implementación **real** de `VerificarCitasFuturasPort` (`DEC-032`), respaldada por el Bounded
 * Context de Agenda. Sustituye al `SinAgendaVerificarCitasFuturasAdapter`, un sustituto temporal
 * que respondía siempre `false` y que, por tanto, dejaba el bloqueo duro sin proteger nada. Aquel
 * archivo se **eliminó**, no se conservó de respaldo.
 *
 * CÓMO RESPETA LA FRONTERA ENTRE CONTEXTOS: no toca `agenda.citas` con un `JOIN` —`ADR-005`
 * prohíbe las FK entre esquemas y `ADR-002` que un módulo lea las tablas de otro—, sino que
 * delega en el puerto que Agenda expone. La dirección de dependencia es
 * `SucursalesYPersonal → Agenda`, y Agenda no depende de este módulo en código, así que no hay
 * ciclo (verificado con `madge`).
 *
 * `N-04` RESUELTO AQUÍ: "qué estados cuentan como cita futura" se responde reutilizando
 * `ESTADOS_QUE_LIBERAN_HORARIO` dentro del repositorio de Agenda, que es la misma lista que
 * alimenta las restricciones de exclusión. No hay una segunda definición que pueda divergir.
 */
@Injectable()
export class AgendaVerificarCitasFuturasAdapter implements VerificarCitasFuturasPort {
  constructor(@Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository) {}

  async tieneCitasFuturas(manicuristaId: string): Promise<boolean> {
    // "Futura" se evalúa contra el instante de la consulta: una cita que ya empezó no impide dar
    // de baja a la manicurista, porque no queda nada que reasignar.
    return this.citaRepository.tieneCitasFuturasQueOcupan(manicuristaId, new Date());
  }
}
