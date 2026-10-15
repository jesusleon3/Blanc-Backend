import { Injectable, Logger } from '@nestjs/common';
import { RegistroDeIncidentesPort, TipoDeIncidenteDeAgenda } from '../agenda/domain/ports/registro-de-incidentes.port';
import {
  RegistrarCancelacionOrdinariaUseCase,
  RegistrarIncidenteClientaUseCase,
} from '../crm-y-clientas/application/use-cases/clientas.use-cases';
import { ClaimsUsuario, Rol } from '../../shared/auth/rol';
import { DomainError } from '../../shared/errors/domain-error';

/**
 * Lleva a CRM los incidentes que ocurren en Agenda (`RN-CRM-06`).
 *
 * ## POR QUÉ ESTE ADAPTADOR NO PROPAGA LOS ERRORES
 *
 * El incidente es **consecuencia** de una acción que ya se hizo: la cita ya está cancelada o
 * marcada como no-show. Si registrar el incidente fallara y el error subiera, quien operó
 * recibiría un 500 sobre una operación que salió bien, reintentaría, y recibiría un 409 de
 * transición inválida. Peor aún: con el registro dentro de la misma transacción —que es donde
 * está, por atomicidad— un fallo *arrastraría la cancelación consigo*, y la clienta seguiría con
 * una cita que acababa de cancelar.
 *
 * La asimetría es deliberada y refleja la jerarquía real: **cancelar es el acto; el incidente es
 * la anotación**. Se registra en el log con el nivel `error` para que no se pierda en silencio.
 *
 * El caso benigno y frecuente: `INCIDENTE_YA_REGISTRADO`, cuando se reintenta marcar el mismo
 * no-show. Ese se traga a propósito — el índice único ya hizo su trabajo impidiendo que el
 * historial se inflara.
 */
@Injectable()
export class RegistroDeIncidentesAdapter implements RegistroDeIncidentesPort {
  private readonly logger = new Logger(RegistroDeIncidentesAdapter.name);

  constructor(
    private readonly registrarIncidenteEnCrm: RegistrarIncidenteClientaUseCase,
    private readonly registrarCancelacionOrdinariaEnCrm: RegistrarCancelacionOrdinariaUseCase,
  ) {}

  async registrarIncidente(input: {
    clientaId: string;
    citaId: string;
    tipo: TipoDeIncidenteDeAgenda;
    ocurridoEn: Date;
    minutosDeAntelacion: number;
  }): Promise<void> {
    try {
      await this.registrarIncidenteEnCrm.ejecutar(input, this.actorDelSistema());
    } catch (error) {
      if (error instanceof DomainError && error.code === 'INCIDENTE_YA_REGISTRADO') return;
      this.logger.error(
        `No se pudo registrar el incidente "${input.tipo}" de la cita ${input.citaId} en CRM. ` +
          'La operación de agenda SÍ se completó; la sugerencia de lista roja no se encendió.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async registrarCancelacionOrdinaria(input: { clientaId: string; citaId: string }): Promise<void> {
    try {
      await this.registrarCancelacionOrdinariaEnCrm.ejecutar(input);
    } catch (error) {
      this.logger.error(
        `No se pudo contabilizar la cancelación ordinaria de la cita ${input.citaId} en CRM.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * El `actor` de la auditoría cuando la anotación la dispara una regla, no una persona.
   *
   * No es un usuario real y no tiene por qué serlo: `RN-AUD-01` exige saber **quién** hizo qué, y
   * *"lo anotó la regla de incidentes al cancelar"* es una respuesta más honesta que atribuirlo a
   * la Encargada, que canceló una cita sin decidir nada sobre la lista roja. Mismo criterio que
   * `DEC-044` aplica al principal del Bot: un actor de sistema es un actor distinto de una
   * persona.
   */
  private actorDelSistema(): ClaimsUsuario {
    return { sub: 'sistema:regla-de-incidentes', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL', manicuristaId: null };
  }
}
