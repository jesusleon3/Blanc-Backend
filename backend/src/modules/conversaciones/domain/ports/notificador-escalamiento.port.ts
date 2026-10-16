import { MotivoDeEscalamiento } from '../../../../database/schema';

export const NOTIFICADOR_ESCALAMIENTO_PORT = 'NOTIFICADOR_ESCALAMIENTO_PORT';

export interface AvisoDeEscalamiento {
  conversacionId: string;
  sucursalId: string;
  motivo: MotivoDeEscalamiento;
  /** `true` si la conversación ya estaba en `humano` y llegó otro mensaje. */
  yaEstabaEscalada: boolean;
  /** Cuántos mensajes de la clienta esperan respuesta en esa conversación. */
  mensajesSinResponder: number;
}

/**
 * Puerto de **salida** para avisar al personal de que una conversación necesita a una persona
 * (`WHATSAPP_ARQUITECTURA_CANAL.md` §2.1).
 *
 * ## POR QUÉ ESTO NO ES OPCIONAL
 *
 * La Dueña lo pidió literalmente: *"avisar de algo nuevo sin que haya que estar mirando la
 * pantalla"*. Y con la Cloud API dejó de ser una comodidad — al migrar un número, **el celular
 * deja de recibir notificaciones de WhatsApp**, así que la única forma de enterarse de que una
 * clienta escribió es que la plataforma avise. Sin esto, la bandeja hay que mirarla, y una
 * conversación escalada a las 9:05 puede quedarse sin atender hasta que alguien abra el panel.
 *
 * ## HOY NO SALE NINGÚN AVISO, Y EL CONTADOR ES EL PLAN B
 *
 * El adaptador por defecto solo registra en el log: el canal por el que avisar al personal
 * —correo, push del navegador, un mensaje a otro número— **no está decidido**, y elegirlo por
 * cuenta propia sería inventar un requisito. Mientras tanto,
 * `GET /v1/conversaciones/escaladas/pendientes` da el contador para que el panel lo muestre, que
 * es el sustituto honesto: sigue exigiendo tener el panel abierto, pero al menos no exige leer
 * cada conversación.
 *
 * **Nunca propaga.** Un fallo al avisar no puede deshacer el escalamiento: la conversación ya
 * necesita a una persona, y perder el aviso es peor atendido pero no incorrecto.
 */
export interface NotificadorEscalamientoPort {
  conversacionNecesitaHumano(aviso: AvisoDeEscalamiento): Promise<void>;
}
