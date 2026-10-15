import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  EnvioDePlantilla,
  EnvioDeTexto,
  ProveedorWhatsAppPort,
  ResultadoDeEnvio,
} from '../../domain/ports/proveedor-whatsapp.port';

/**
 * ⚠️ **ADAPTADOR PROVISIONAL: NO ENVÍA NADA A META.** Registra en el log y devuelve un `wamid`
 * sintético.
 *
 * Es el proveedor por defecto **mientras no haya credenciales de Meta** (el trámite de alta es
 * camino crítico de Fase 4). Con él, toda la lógica de conversaciones, ventana de 24 h, bandeja y
 * notificaciones funciona y se prueba de punta a punta; lo único que no ocurre es que el mensaje
 * salga.
 *
 * El `wamid` sintético lleva el prefijo `local.` **a propósito**: si alguna vez apareciera en un
 * entorno real, es inmediatamente reconocible como no-Meta. Un uuid pelado se confundiría con uno
 * legítimo.
 *
 * El nombre dice lo que hace, por la misma lección que `ListaEsperaSoloLogAdapter` y
 * `RecordatorioSoloLogAdapter`: un adaptador provisional tiene que ser imposible de confundir con
 * el definitivo.
 */
@Injectable()
export class WhatsAppSoloLogAdapter implements ProveedorWhatsAppPort {
  private readonly logger = new Logger(WhatsAppSoloLogAdapter.name);

  async enviarTexto(envio: EnvioDeTexto): Promise<ResultadoDeEnvio> {
    // Sin el texto: es un mensaje a una clienta, o sea PII (`RN-AUD-01`). Se registra la longitud
    // para poder diagnosticar un mensaje vacío sin volcar su contenido.
    this.logger.warn(
      `TEXTO SIN ENVIAR (sin credenciales de Meta) — numero=${envio.phoneNumberId} destino=***${envio.telefonoDestino.slice(-4)} ` +
        `caracteres=${envio.texto.length}`,
    );
    return { wamid: `local.${randomUUID()}` };
  }

  async enviarPlantilla(envio: EnvioDePlantilla): Promise<ResultadoDeEnvio> {
    // El NOMBRE de la plantilla sí se registra: no es PII y es lo que permite ver qué se habría
    // enviado. Los parámetros no, porque suelen llevar el nombre de la clienta.
    this.logger.warn(
      `PLANTILLA SIN ENVIAR (sin credenciales de Meta) — numero=${envio.phoneNumberId} destino=***${envio.telefonoDestino.slice(-4)} ` +
        `plantilla=${envio.plantilla} idioma=${envio.idioma} parametros=${envio.parametros.length}`,
    );
    return { wamid: `local.${randomUUID()}` };
  }
}
