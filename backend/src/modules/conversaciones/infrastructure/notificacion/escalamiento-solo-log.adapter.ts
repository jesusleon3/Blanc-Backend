import { Injectable, Logger } from '@nestjs/common';
import { AvisoDeEscalamiento, NotificadorEscalamientoPort } from '../../domain/ports/notificador-escalamiento.port';

/**
 * ⚠️ **ADAPTADOR PROVISIONAL: NO AVISA A NADIE.** Registra en el log y nada más.
 *
 * **El canal no está decidido** —correo, push del navegador, un mensaje a otro número— y elegirlo
 * por cuenta propia sería inventar un requisito que la Dueña no ha dado. Mientras tanto, el
 * contador de `GET /v1/conversaciones/escaladas/pendientes` es el sustituto: no evita tener el
 * panel abierto, pero evita leer cada conversación para saber si hay algo urgente.
 *
 * El nombre dice lo que hace, por la misma lección que los otros tres adaptadores de solo-log de
 * este proyecto.
 */
@Injectable()
export class EscalamientoSoloLogAdapter implements NotificadorEscalamientoPort {
  private readonly logger = new Logger(EscalamientoSoloLogAdapter.name);

  async conversacionNecesitaHumano(aviso: AvisoDeEscalamiento): Promise<void> {
    // Nivel `warn`: es algo que requiere que una persona actúe, no una traza informativa.
    // Sin PII: ni teléfono ni contenido (`RN-AUD-01`).
    this.logger.warn(
      `CONVERSACIÓN NECESITA HUMANO (aviso al personal sin enviar, canal sin decidir) — ` +
        `conversacion=${aviso.conversacionId} sucursal=${aviso.sucursalId} motivo=${aviso.motivo} ` +
        `yaEstabaEscalada=${aviso.yaEstabaEscalada} sinResponder=${aviso.mensajesSinResponder}`,
    );
  }
}
