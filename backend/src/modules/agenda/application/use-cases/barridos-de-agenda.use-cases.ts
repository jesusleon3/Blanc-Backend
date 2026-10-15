import { Inject, Injectable, Logger } from '@nestjs/common';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import {
  NOTIFICADOR_RECORDATORIO_PORT,
  NotificadorRecordatorioPort,
} from '../../domain/ports/notificador-recordatorio.port';
import { CompletarCitaUseCase } from './completar-cita.use-case';
import { SolicitarConfirmacionCitaUseCase } from './solicitar-confirmacion-cita.use-case';
import { ClaimsUsuario } from '../../../../shared/auth/rol';

/**
 * Tamaño máximo de lote de un barrido.
 *
 * Acota la consulta, no la verdad: si quedan más elementos, el siguiente tick los recoge. Sin
 * tope, un barrido que lleve semanas sin correr se traería meses de citas olvidadas en una sola
 * consulta y bloquearía el pool mientras las procesa una por una.
 */
export const TAMANO_DE_LOTE_POR_DEFECTO = 200;

/** Antelación del recordatorio (`RN-NOT-02`). */
export const HORAS_DE_ANTELACION_DEL_RECORDATORIO = 24;

export interface ResumenDeBarrido {
  procesados: number;
  fallidos: number;
  /** Ids que fallaron, para poder mirarlos sin bucear en el log. */
  idsFallidos: string[];
}

const resumenVacio = (): ResumenDeBarrido => ({ procesados: 0, fallidos: 0, idsFallidos: [] });

/**
 * Recorre un lote **aislando el fallo de cada elemento** (`ADR-025`).
 *
 * POR QUÉ ESTO EXISTE COMO FUNCIÓN COMPARTIDA. Es la regla que más importa de los barridos y la
 * más fácil de olvidar al escribir el cuarto: **un elemento que falla no aborta el lote**. Si se
 * detuviera en el primer error, quedaría sin procesar todo lo que viniera detrás — y como el orden
 * es por antigüedad, lo que quedaría sin procesar es justo lo más urgente. Una cita con datos
 * corruptos podría bloquear el cierre de todas las demás, indefinidamente.
 *
 * El fallo se registra con el id, nunca se traga en silencio: un fallo sistemático tiene que ser
 * visible en el resumen, no solo en el log.
 */
async function procesarLote<T extends { id: string }>(
  elementos: T[],
  logger: Logger,
  nombre: string,
  accion: (elemento: T) => Promise<void>,
): Promise<ResumenDeBarrido> {
  const resumen = resumenVacio();

  for (const elemento of elementos) {
    try {
      await accion(elemento);
      resumen.procesados += 1;
    } catch (error) {
      resumen.fallidos += 1;
      resumen.idsFallidos.push(elemento.id);
      logger.error(
        `Barrido "${nombre}": falló el elemento ${elemento.id}; el resto del lote sigue.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  return resumen;
}

export { procesarLote };

/**
 * Barrido (c) — **cierre automático de citas pasadas** (`DEC-030`).
 *
 * Pasa a `completada` las citas activas cuyo horario ya terminó. Sin esto, una cita atendida se
 * queda en `agendada` para siempre y **ningún reporte de ocupación es fiable**.
 *
 * ⚠️ **CERRAR NO IMPIDE CORREGIR.** `completada → no_show` es una transición legal (`N-02`): si la
 * Encargada reporta más tarde que la clienta no se presentó, puede marcarlo igual. Esa salida es
 * la que hace aceptable cerrar de forma automática algo que el sistema no puede saber con
 * certeza — nadie le dijo que la clienta entró por la puerta.
 *
 * **Idempotente por estado**: una segunda corrida inmediata no encuentra nada, porque `completada`
 * ya no está entre los estados activos que la consulta selecciona.
 */
@Injectable()
export class CerrarCitasTerminadasUseCase {
  private readonly logger = new Logger(CerrarCitasTerminadasUseCase.name);

  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    private readonly completarCita: CompletarCitaUseCase,
  ) {}

  async ejecutar(actor: ClaimsUsuario, ahora = new Date(), limite = TAMANO_DE_LOTE_POR_DEFECTO): Promise<ResumenDeBarrido> {
    const citas = await this.citaRepository.listarActivasYaTerminadas(ahora, limite);

    return procesarLote(citas, this.logger, 'cierre_de_citas', async (cita) => {
      await this.completarCita.ejecutar({ citaId: cita.id }, actor);
    });
  }
}

/**
 * Barrido (d) — **recordatorio 24 h antes** (`RN-NOT-02`, `RN-CONV-11`).
 *
 * Pasa la cita a `pendiente_confirmacion` y emite el aviso por el puerto de notificación.
 *
 * **La transición va dentro de la transacción y el envío fuera**, en ese orden: un mensaje enviado
 * no se deshace con un `ROLLBACK`, así que si el envío falla es preferible tener una cita en
 * `pendiente_confirmacion` sin aviso —visible para la Encargada, que puede llamar— que una clienta
 * avisada de una transición que se revirtió.
 *
 * **Idempotente por estado**: la consulta selecciona solo `agendada`, y la acción la saca de ese
 * estado. Una segunda corrida no la vuelve a encontrar, sin necesitar columna de "ya recordada".
 */
@Injectable()
export class SolicitarRecordatoriosUseCase {
  private readonly logger = new Logger(SolicitarRecordatoriosUseCase.name);

  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    private readonly solicitarConfirmacion: SolicitarConfirmacionCitaUseCase,
    @Inject(NOTIFICADOR_RECORDATORIO_PORT) private readonly notificador: NotificadorRecordatorioPort,
  ) {}

  async ejecutar(
    actor: ClaimsUsuario,
    ahora = new Date(),
    opciones: { horasDeAntelacion?: number; limite?: number } = {},
  ): Promise<ResumenDeBarrido> {
    const horas = opciones.horasDeAntelacion ?? HORAS_DE_ANTELACION_DEL_RECORDATORIO;

    /**
     * Ventana `[ahora, ahora + horas]`, no un instante.
     *
     * Un barrido que busque citas que empiecen "exactamente en 24 h" no encontraría nunca nada:
     * corre cada N minutos y la probabilidad de caer en el instante justo es cero. La ventana
     * abierta hacia abajo también recupera lo que se quedó sin recordar si el servicio estuvo
     * caído — el límite inferior es `ahora` para no avisar de citas que ya pasaron.
     */
    const desde = ahora;
    const hasta = new Date(ahora.getTime() + horas * 3_600_000);

    const citas = await this.citaRepository.listarProximasSinRecordatorio(desde, hasta, opciones.limite ?? TAMANO_DE_LOTE_POR_DEFECTO);

    return procesarLote(citas, this.logger, 'recordatorios', async (cita) => {
      const actualizada = await this.solicitarConfirmacion.ejecutar({ citaId: cita.id }, actor);
      // FUERA de la transacción del caso de uso anterior: ver la nota del puerto.
      await this.notificador.recordatorioDeCita(actualizada);
    });
  }
}
