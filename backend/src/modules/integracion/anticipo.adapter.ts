import { Injectable } from '@nestjs/common';
import { AnticipoPort, EstadoDeAnticipoDeCita } from '../agenda/domain/ports/anticipo.port';
import {
  ConsultarAnticiposUseCase,
  GenerarAnticipoUseCase,
  RetenerAnticipoUseCase,
} from '../anticipos/application/use-cases/anticipos.use-cases';
import { ClaimsUsuario, Rol } from '../../shared/auth/rol';
import { DomainError } from '../../shared/errors/domain-error';

/**
 * Lo que **Agenda pregunta y le cuenta a Anticipos**.
 *
 * Es el sentido Agenda → Anticipos. Junto con `TransicionDeCitaAdapter` (el sentido inverso)
 * cierra el par que `P5` señalaba como circular: `FL-ANT-01` invocaba `FL-AGE-09` directamente.
 * Aquí ninguno de los dos contextos se importa — cada uno declara su puerto y estos dos
 * adaptadores los implementan.
 */
@Injectable()
export class AnticipoAdapter implements AnticipoPort {
  constructor(
    private readonly consultar: ConsultarAnticiposUseCase,
    private readonly generar: GenerarAnticipoUseCase,
    private readonly retener: RetenerAnticipoUseCase,
  ) {}

  async estadoDe(citaId: string): Promise<EstadoDeAnticipoDeCita> {
    const anticipo = await this.consultar.buscarDeCita(citaId);
    // `'ninguno'` y no `null`: obliga a quien consume a nombrar el caso de la cita sin anticipo,
    // que es la inmensa mayoría. Un `null` se habría tratado como falsy y confundido con
    // `'pendiente'` en alguna comparación.
    return anticipo ? anticipo.estado : 'ninguno';
  }

  async generarParaCita(input: { citaId: string; clientaId: string; baseCentavos: number | null }): Promise<boolean> {
    if (input.baseCentavos === null) {
      // `DEC-033`: no hay base de cálculo. La cita se crea igual y la Encargada registra el
      // anticipo con monto explícito. Lanzar aquí impediría vender un servicio de precio variable
      // a una clienta de lista roja, que no es lo que ninguna regla dice.
      return false;
    }

    try {
      await this.generar.ejecutar(input, this.actorDelSistema());
      return true;
    } catch (error) {
      // `ANTICIPO_YA_EXISTE` es benigno e idempotente: la cita ya tiene su anticipo. Cualquier
      // otro error sí propaga, porque dejaría una cita `en_espera_pago` sin monto que cobrar.
      if (error instanceof DomainError && error.code === 'ANTICIPO_YA_EXISTE') return true;
      throw error;
    }
  }

  async retenerPorCitaTerminada(citaId: string, motivo: 'cancelada' | 'no_show'): Promise<void> {
    await this.retener.ejecutar({ citaId, motivo }, this.actorDelSistema());
  }

  /**
   * Actor de auditoría cuando el movimiento lo dispara una regla y no una persona.
   *
   * Mismo criterio que `RegistroDeIncidentesAdapter` y que `DEC-044` con el principal del Bot:
   * *"lo generó la regla de anticipos al agendar"* es una respuesta más honesta que atribuirlo a
   * la Encargada, que agendó una cita sin decidir nada sobre el monto.
   */
  private actorDelSistema(): ClaimsUsuario {
    return { sub: 'sistema:regla-de-anticipos', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL', manicuristaId: null };
  }
}
