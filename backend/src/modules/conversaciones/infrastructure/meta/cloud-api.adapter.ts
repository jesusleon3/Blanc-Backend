import { Injectable, Logger } from '@nestjs/common';
import {
  EnvioDePlantilla,
  EnvioDeTexto,
  ProveedorWhatsAppPort,
  ResultadoDeEnvio,
} from '../../domain/ports/proveedor-whatsapp.port';
import { DomainError } from '../../../../shared/errors/domain-error';

/** Versión de la Graph API. Explícita: Meta deprecia versiones y una URL sin versión cambia sola. */
export const VERSION_GRAPH_API = 'v21.0';

/**
 * Adaptador real de la **Cloud API de Meta** (`DEC-043`, `ADR-008` Enmienda 1).
 *
 * ## ⚠️ NO ESTÁ VERIFICADO CONTRA META, Y NO PUEDE ESTARLO TODAVÍA
 *
 * El trámite de alta con Meta sigue pendiente (es camino crítico de Fase 4) y **no hay credenciales
 * reales**. Este adaptador implementa el contrato documentado de la Graph API —forma del cuerpo,
 * cabecera de autorización, extracción del `wamid` de la respuesta— pero **ninguna línea se ha
 * ejecutado contra el servicio real**. Lo mismo que ocurrió con Supabase: el diseño se puede
 * cerrar sin credenciales, la verificación no.
 *
 * Qué se sabe seguro y qué no:
 * - **Seguro:** el `wamid` llega en `messages[0].id`, el endpoint es `/{phone_number_id}/messages`,
 *   y el token va como `Bearer`. Está en la documentación pública.
 * - **Sin verificar:** los códigos de error concretos, los límites de tasa reales y el
 *   comportamiento ante un número no registrado. Se tratan como fallo genérico hasta poder medirlos.
 *
 * **Se activa solo con `WHATSAPP_ACCESS_TOKEN` presente.** Sin él, `ConversacionesModule` provee el
 * adaptador de solo-log, así que nada intenta hablar con Meta por accidente.
 */
@Injectable()
export class CloudApiAdapter implements ProveedorWhatsAppPort {
  private readonly logger = new Logger(CloudApiAdapter.name);

  constructor(private readonly accessToken: string) {}

  enviarTexto(envio: EnvioDeTexto): Promise<ResultadoDeEnvio> {
    return this.enviar(envio.phoneNumberId, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: envio.telefonoDestino,
      type: 'text',
      // `preview_url: false`: un enlace con previsualización en un mensaje del salón parece correo basura
      // y Meta la cobra igual. Además la plataforma no manda enlaces (`DEC-043`: cero links).
      text: { preview_url: false, body: envio.texto },
    });
  }

  enviarPlantilla(envio: EnvioDePlantilla): Promise<ResultadoDeEnvio> {
    return this.enviar(envio.phoneNumberId, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: envio.telefonoDestino,
      type: 'template',
      template: {
        name: envio.plantilla,
        language: { code: envio.idioma },
        // Los parámetros van en el cuerpo, en el orden en que la plantilla los declara. Si el
        // orden no coincide con el aprobado en Meta, el mensaje sale con los datos cruzados.
        components:
          envio.parametros.length === 0
            ? []
            : [{ type: 'body', parameters: envio.parametros.map((texto) => ({ type: 'text', text: texto })) }],
      },
    });
  }

  private async enviar(phoneNumberId: string, cuerpo: unknown): Promise<ResultadoDeEnvio> {
    const url = `https://graph.facebook.com/${VERSION_GRAPH_API}/${phoneNumberId}/messages`;

    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      /**
       * **El detalle de Meta va al log, no al error que sube.** El cuerpo de error puede incluir
       * el número de destino, y eso es PII (`RN-AUD-01`): el mensaje que llega al operador dice
       * que falló el envío, no los datos de la clienta.
       */
      this.logger.error(`Meta rechazó el envío (${respuesta.status}): ${detalle}`);
      throw new DomainError('ENVIO_WHATSAPP_FALLIDO', 'No se pudo enviar el mensaje por WhatsApp.', 502, {
        estadoHttp: respuesta.status,
      });
    }

    const json = (await respuesta.json()) as { messages?: { id?: string }[] };
    const wamid = json.messages?.[0]?.id;

    if (!wamid) {
      // Sin `wamid` no se puede correlacionar el estado de entrega que Meta reportará después, así
      // que el mensaje quedaría huérfano. Es un fallo, no un éxito parcial.
      throw new DomainError('ENVIO_WHATSAPP_SIN_WAMID', 'Meta aceptó el envío pero no devolvió el identificador del mensaje.', 502);
    }

    return { wamid };
  }
}
