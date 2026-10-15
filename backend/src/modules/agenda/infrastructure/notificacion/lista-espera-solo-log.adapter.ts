import { Injectable, Logger } from '@nestjs/common';
import { HuecoOfrecido, NotificacionListaEsperaPort } from '../../domain/ports/notificacion-lista-espera.port';
import { SolicitudListaEspera } from '../../domain/entities/solicitud-lista-espera.entity';

/**
 * ⚠️ **ADAPTADOR PROVISIONAL: NO ENVÍA NINGÚN MENSAJE.** Deja constancia en el log y nada más.
 *
 * El canal de WhatsApp es de Fase 4 (`DEC-043`). Hasta entonces la oferta queda registrada en
 * `agenda.lista_espera` con su ventana corriendo, y **avisar a la clienta es trabajo manual de la
 * Encargada**, que ve la fila por `GET /v1/agenda/lista-espera`.
 *
 * El nombre dice lo que hace a propósito: en Fase 4 se sustituye el proveedor en `AgendaModule` y
 * no se toca ningún caso de uso.
 */
@Injectable()
export class ListaEsperaSoloLogAdapter implements NotificacionListaEsperaPort {
  private readonly logger = new Logger(ListaEsperaSoloLogAdapter.name);

  async ofertaDeHueco(solicitud: SolicitudListaEspera, hueco: HuecoOfrecido): Promise<void> {
    // Sin datos de la clienta más allá de su id: `RN-AUD-01` prohíbe PII en registros, y un log
    // no es menos registro que la tabla de auditoría.
    this.logger.warn(
      `OFERTA DE HUECO SIN ENVIAR (canal de WhatsApp pendiente, Fase 4) — solicitud=${solicitud.id} ` +
        `clienta=${solicitud.clientaId} sucursal=${solicitud.sucursalId} fecha=${solicitud.fecha} ` +
        `hueco=${hueco.inicio.toISOString()}..${hueco.fin.toISOString()} expira=${solicitud.expiraEn?.toISOString()}. ` +
        'Avisar a mano desde la bandeja hasta que exista el canal.',
    );
  }
}
