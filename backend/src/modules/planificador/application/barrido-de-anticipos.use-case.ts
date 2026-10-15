import { Inject, Injectable, Logger } from '@nestjs/common';
import { CITA_REPOSITORY, CitaRepository } from '../../agenda/domain/ports/cita.repository';
import {
  procesarLote,
  ResumenDeBarrido,
  TAMANO_DE_LOTE_POR_DEFECTO,
} from '../../agenda/application/use-cases/barridos-de-agenda.use-cases';
import { ConsultarAnticiposUseCase, ExpirarAnticipoUseCase } from '../../anticipos/application/use-cases/anticipos.use-cases';
import { ClaimsUsuario } from '../../../shared/auth/rol';

/**
 * Barrido (b) — **expiración de anticipos no pagados** (`RN-ANT-03`).
 *
 * ## POR QUÉ ESTE BARRIDO VIVE EN EL PLANIFICADOR Y NO EN UN BOUNDED CONTEXT
 *
 * Necesita las dos mitades de un dato que **ningún contexto tiene entero**: qué citas en
 * `en_espera_pago` ya llegaron a su hora (lo sabe Agenda) y cuál es el anticipo de cada una (lo
 * sabe Anticipos). Ponerlo en Agenda le daría conocimiento del ciclo de vida del dinero; ponerlo
 * en Anticipos le exigiría leer horarios de citas. Las dos opciones ensanchan un contexto para
 * alojar una tarea que no es suya.
 *
 * El planificador es un **adaptador conductor** (como un controlador), no un contexto: puede ver
 * varios porque orquestar es precisamente su función. Es la distinción que `ADR-025` fija frente a
 * `IntegracionModule`, que aloja adaptadores *conducidos*.
 *
 * ## EL CRITERIO: LA HORA DE LA CITA, NO UN PLAZO PROPIO
 *
 * Se expira cuando **la cita ya empezó** sin pago confirmado. Es lo que `RN-ANT-03` implica: no
 * hay "ventana de gracia" que caducar porque nunca hubo retención, así que inventar un plazo
 * propio (`expira_en` en el anticipo) habría sido añadir una regla que el negocio no pidió. El
 * momento en que el anticipo deja de tener sentido es el momento en que la cita se perdió.
 *
 * **Idempotente por estado**: tras expirar, el anticipo queda `expirado` y la cita `expirada`, así
 * que la consulta —que pide `en_espera_pago`— no la vuelve a encontrar.
 */
@Injectable()
export class BarridoDeAnticiposUseCase {
  private readonly logger = new Logger(BarridoDeAnticiposUseCase.name);

  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    private readonly consultarAnticipos: ConsultarAnticiposUseCase,
    private readonly expirarAnticipo: ExpirarAnticipoUseCase,
  ) {}

  async ejecutar(actor: ClaimsUsuario, ahora = new Date(), limite = TAMANO_DE_LOTE_POR_DEFECTO): Promise<ResumenDeBarrido> {
    const citas = await this.citaRepository.listarEnEsperaDePagoVencidas(ahora, limite);

    return procesarLote(citas, this.logger, 'expiracion_de_anticipos', async (cita) => {
      const anticipo = await this.consultarAnticipos.buscarDeCita(cita.id);

      if (!anticipo || anticipo.estado !== 'pendiente') {
        /**
         * Sin anticipo, o con uno que ya no está pendiente.
         *
         * **No es un fallo y no se cuenta como tal.** Dos casos reales: una cita de clienta en
         * lista roja cuyo servicio exige cotización manual (`DEC-033`) y cuyo anticipo nadie
         * registró a mano, y una carrera en la que alguien confirmó el pago entre la consulta y
         * esta línea. En ninguno hay nada que expirar.
         *
         * ⚠️ El primer caso deja la cita en `en_espera_pago` para siempre, porque este barrido no
         * puede tocarla sin anticipo. Queda señalado en §16 como pendiente de decidir: o se expira
         * la cita sin anticipo, o se obliga a registrarlo al agendar.
         */
        return;
      }

      await this.expirarAnticipo.ejecutar({ anticipoId: anticipo.id, motivo: 'La cita llegó a su hora sin pago confirmado' }, actor);
    });
  }
}
