import { Inject, Injectable } from '@nestjs/common';
import { Cita } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { aplicarTransicion } from './transicion-cita.base';
import { REGISTRO_DE_INCIDENTES_PORT, RegistroDeIncidentesPort } from '../../domain/ports/registro-de-incidentes.port';
import { ANTICIPO_PORT, AnticipoPort } from '../../domain/ports/anticipo.port';

/**
 * Caso de uso — la clienta no se presentó. **Siempre manual**, lo marca la Encargada o la Dueña
 * (`DEC-042`): el sistema nunca lo deduce solo, porque no tiene forma de saber si alguien entró
 * por la puerta.
 *
 * `no_show` **ocupa el horario** (`DEC-034`): es la diferencia con cancelar. Cancelar avisa y
 * libera el hueco para otra; no presentarse no libera nada, porque nadie pudo aprovecharlo.
 * Confundirlos falsearía la ocupación histórica y, con ella, cualquier reporte de productividad.
 *
 * **Dispara `RN-CRM-06`**: un `no_show` enciende la sugerencia de lista roja en CRM, sin importar
 * la antelación — no presentarse no tiene antelación que medir. Lo que se registra es el hecho;
 * **marcar lista roja sigue siendo exclusivo de la Dueña** (`RN-CRM-05`, `DEC-042`).
 */
@Injectable()
export class MarcarNoShowUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(REGISTRO_DE_INCIDENTES_PORT) private readonly incidentes: RegistroDeIncidentesPort,
    @Inject(ANTICIPO_PORT) private readonly anticipos: AnticipoPort,
  ) {}

  async ejecutar(input: { citaId: string }, actor: ClaimsUsuario, ahora = new Date()): Promise<Cita> {
    // Una sola transacción para el cambio de estado y el incidente: `DrizzleUnitOfWork` se une a
    // la que abra el caso de uso externo, así que `aplicarTransicion` no abre una segunda. Un
    // no-show sin su incidente dejaría a la Dueña sin la alerta que `RN-CRM-06` le promete.
    return this.unitOfWork.ejecutar(async () => {
      const cita = await aplicarTransicion(
        { citaRepository: this.citaRepository, auditoria: this.auditoria, unitOfWork: this.unitOfWork },
        { citaId: input.citaId, nuevoEstado: 'no_show', accion: 'marcar_no_show', actor },
      );

      await this.incidentes.registrarIncidente({
        clientaId: cita.clientaId,
        citaId: cita.id,
        tipo: 'no_show',
        ocurridoEn: ahora,
        // Negativo si ya pasó la hora, que es el caso normal de un no-show: se marca después.
        minutosDeAntelacion: Math.round((cita.rangoHorario.inicio.getTime() - ahora.getTime()) / 60_000),
      });

      // `RN-ANT-04`: *"Si la clienta no se presenta habiendo pagado, tampoco se devuelve."*
      await this.anticipos.retenerPorCitaTerminada(cita.id, 'no_show');

      return cita;
    });
  }
}
