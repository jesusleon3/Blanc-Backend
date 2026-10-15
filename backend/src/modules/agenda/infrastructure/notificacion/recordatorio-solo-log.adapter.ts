import { Injectable, Logger } from '@nestjs/common';
import { NotificadorRecordatorioPort } from '../../domain/ports/notificador-recordatorio.port';
import { Cita } from '../../domain/entities/cita.entity';

/**
 * ⚠️ **ADAPTADOR PROVISIONAL: NO ENVÍA NINGÚN MENSAJE.** Deja constancia en el log y nada más.
 *
 * El canal de WhatsApp es de la Parte 2 de Fase 4 (`DEC-043`). Hasta entonces la cita **sí** pasa
 * a `pendiente_confirmacion` —el estado es real y la Encargada lo ve en la agenda— pero el aviso
 * a la clienta hay que darlo a mano.
 *
 * En Fase 4 se sustituye el proveedor en `AgendaModule` por el adaptador de plantillas de Meta, y
 * no se toca ningún caso de uso.
 */
@Injectable()
export class RecordatorioSoloLogAdapter implements NotificadorRecordatorioPort {
  private readonly logger = new Logger(RecordatorioSoloLogAdapter.name);

  async recordatorioDeCita(cita: Cita): Promise<void> {
    // Sin PII: ni nombre ni teléfono (`RN-AUD-01`). Un log no es menos registro que la auditoría.
    this.logger.warn(
      `RECORDATORIO SIN ENVIAR (canal de WhatsApp pendiente, Fase 4 Parte 2) — cita=${cita.id} ` +
        `clienta=${cita.clientaId} sucursal=${cita.sucursalId} inicio=${cita.rangoHorario.inicio.toISOString()}. ` +
        'La cita ya está en `pendiente_confirmacion`; avisar a mano hasta que exista el canal.',
    );
  }
}
