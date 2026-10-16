import { MotivoDeEscalamiento } from '../../../../database/schema';
import { Conversacion } from '../entities/conversacion.entity';

export const ORQUESTADOR_DE_BOT_PORT = 'ORQUESTADOR_DE_BOT_PORT';

export interface TurnoDelBot {
  conversacion: Conversacion;
  /** Texto de la clienta. `null` para medios que el bot no puede leer. */
  texto: string | null;
  ocurridoEn: Date;
}

export interface ResultadoDelTurno {
  /** `true` si el bot respondió algo. */
  respondio: boolean;
  /** `true` si el bot decidió que esto lo tiene que ver una persona. */
  escalo: boolean;
  /**
   * Con qué motivo escaló. Presente solo si `escalo`.
   *
   * **Viaja en el resultado, y no se relee de la entidad.** La `Conversacion` que `RecibirMensaje`
   * tiene en memoria se cargó *antes* de que el bot corriera, así que su `motivoDeEscalamiento`
   * sigue siendo `null`: el bot escaló sobre su propia copia. Sin este campo, el aviso al personal
   * caería siempre en el valor por defecto y la Dueña vería *"fuera de alcance"* donde en realidad
   * una clienta pidió cancelar — y ese desglose por motivo es justo lo que usa para saber qué se
   * le escapa al bot (`RN-CONV-04`).
   */
  motivo?: MotivoDeEscalamiento;
}

/**
 * Lo que **Conversaciones le pide al orquestador del bot**.
 *
 * ## POR QUÉ ES UN PUERTO Y NO UNA LLAMADA DIRECTA
 *
 * El orquestador necesita ver **cinco** Bounded Contexts (Catálogo, Agenda, CRM, Anticipos y
 * Conversaciones) para poder consultar precios, disponibilidad, identificar a la clienta y
 * agendar. Si `ConversacionesModule` lo importara, y el orquestador importara Conversaciones para
 * leer el hilo, habría un **ciclo de módulos**. Con el puerto, Conversaciones declara qué necesita
 * y `AgenteModule` provee el adaptador — el mismo patrón que cerró `P5`.
 *
 * ## EL VALOR POR DEFECTO ES "NO HAY BOT"
 *
 * `ConversacionesModule` provee un adaptador inerte. Así el canal, la bandeja y el handoff
 * funcionan sin que exista ningún agente, que es exactamente el estado en el que estuvo el sistema
 * durante toda la Parte 2 — y el estado al que conviene poder volver apagando un módulo si el bot
 * se comporta mal en producción.
 */
export interface OrquestadorDeBotPort {
  /**
   * Atiende un turno entrante. **Solo se invoca si la conversación está en modo `bot`**: la
   * comprobación la hace quien llama, antes, porque `RN-ESC-02` exige revalidar el modo antes de
   * cada respuesta del bot y el lugar correcto para eso es el borde, no dentro del agente.
   */
  atenderTurno(turno: TurnoDelBot): Promise<ResultadoDelTurno>;
}
