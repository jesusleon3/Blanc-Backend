import { Body, Controller, Get, Headers, HttpCode, Inject, Logger, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../../../shared/auth/public.decorator';
import { VerificadorDeFirmaMeta } from './verificador-de-firma';
import { ActualizarEstadoDeEntregaUseCase, RecibirMensajeUseCase } from '../../application/use-cases/recibir-mensaje.use-case';
import { TipoMensaje } from '../../../../database/schema';

/**
 * Token del reto de verificación de Meta, inyectado por configuración.
 *
 * Es un token de DI y no un `process.env` leído dentro del controlador porque así la prueba puede
 * sustituirlo sin tocar el entorno del proceso — mutar `process.env` en una prueba contamina las
 * demás del mismo worker, que es la clase de acoplamiento que esta fase acabó de erradicar.
 */
export const TOKEN_VERIFICACION_META = 'TOKEN_VERIFICACION_META';

/** Forma del webhook de Meta, acotada a lo que se consume. */
interface PayloadDeMeta {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: { id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string } }[];
        statuses?: { id?: string; status?: string; errors?: { title?: string; message?: string }[] }[];
      };
    }[];
  }[];
}

/**
 * Webhook de la Cloud API de Meta (`DEC-043`, `ADR-008` Enmienda 1).
 *
 * ## `@Public()`, Y POR QUÉ ESO NO ES UN AGUJERO
 *
 * Meta no puede autenticarse con un JWT de Blanc, así que la ruta tiene que ser pública. **La
 * firma HMAC es la autenticación**: `X-Hub-Signature-256` calculada con el App Secret, que solo
 * Meta y nosotros conocemos. Sin verificarla, cualquiera con la URL podría inyectar mensajes
 * entrantes falsos — crear conversaciones, escalarlas y, en la Parte 3, hacer que la IA actúe
 * sobre texto que ninguna clienta escribió.
 *
 * ## SIEMPRE 200, SALVO FIRMA INVÁLIDA
 *
 * Meta **reintenta** ante cualquier respuesta que no sea 2xx, y con reintentos crecientes. Un 500
 * por un payload raro convertiría un evento defectuoso en un bucle indefinido. Así que todo lo que
 * no sea un problema de autenticidad se registra y se responde `200`: evento aceptado, descartado
 * si no se pudo procesar.
 *
 * La única excepción es la firma inválida → `401`. Ahí **sí** interesa que Meta reintente si fue un
 * problema transitorio, y sobre todo interesa no fingir que se procesó algo que pudo ser un ataque.
 */
@Controller('v1/webhooks/meta')
export class WebhookMetaController {
  private readonly logger = new Logger(WebhookMetaController.name);

  constructor(
    private readonly verificador: VerificadorDeFirmaMeta,
    private readonly recibirMensaje: RecibirMensajeUseCase,
    private readonly actualizarEstado: ActualizarEstadoDeEntregaUseCase,
    @Inject(TOKEN_VERIFICACION_META) private readonly tokenDeVerificacion: string,
  ) {}

  /**
   * Reto de verificación de Meta. Se llama **una vez**, al dar de alta la URL del webhook.
   *
   * Meta manda `hub.verify_token` y espera de vuelta `hub.challenge` **en texto plano**. Si no
   * coincide el token, se responde 401: aceptar un reto con token equivocado dejaría que un
   * tercero registrase nuestra URL en su propia app de Meta.
   */
  @Get()
  @Public()
  verificar(
    @Query('hub.mode') modo: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    if (modo !== 'subscribe' || token !== this.tokenDeVerificacion) {
      this.logger.warn('Reto de verificación de Meta con modo o token incorrectos: se rechaza.');
      throw new UnauthorizedException({
        error: { category: 'domain', code: 'VERIFICACION_META_INVALIDA', message: 'Token de verificación inválido.' },
      });
    }

    // Texto plano, no JSON: es lo que Meta espera literalmente.
    return challenge;
  }

  @Post()
  @Public()
  @HttpCode(200)
  async recibir(
    @Headers('x-hub-signature-256') firma: string | undefined,
    @Req() peticion: Request & { rawBody?: Buffer },
    @Body() cuerpo: PayloadDeMeta,
  ): Promise<{ recibido: true; procesados: number; ignorados: number }> {
    /**
     * El HMAC se calcula sobre **los bytes exactos** que Meta firmó.
     *
     * `rawBody` lo captura `main.ts` con el `verify` del body parser. Si no estuviera disponible,
     * volver a serializar el objeto parseado cambiaría espacios y orden de claves y la firma
     * **nunca** coincidiría — así que la ausencia de `rawBody` se trata como firma inválida, no
     * como "no se pudo comprobar": fallar abierto aquí sería dejar el webhook sin autenticación.
     */
    const cuerpoCrudo = peticion.rawBody;
    if (!cuerpoCrudo || !this.verificador.esValida(firma, cuerpoCrudo)) {
      throw new UnauthorizedException({
        error: { category: 'domain', code: 'FIRMA_META_INVALIDA', message: 'La firma del webhook no es válida.' },
      });
    }

    let procesados = 0;
    let ignorados = 0;

    for (const valor of this.valoresDe(cuerpo)) {
      const phoneNumberId = valor.metadata?.phone_number_id;

      for (const mensaje of valor.messages ?? []) {
        // Cada mensaje se procesa aislado: un payload con varios no debe perderse entero porque
        // uno venga mal formado. Meta agrupa eventos, así que esto pasa.
        try {
          const resultado = await this.procesarMensaje(phoneNumberId, mensaje);
          if (resultado) procesados += 1;
          else ignorados += 1;
        } catch (error) {
          ignorados += 1;
          this.logger.error(
            `Fallo al procesar un mensaje del webhook (wamid=${mensaje.id ?? 'sin id'}); el resto del lote sigue.`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      for (const estado of valor.statuses ?? []) {
        try {
          await this.procesarEstado(estado);
          procesados += 1;
        } catch (error) {
          ignorados += 1;
          this.logger.error(
            `Fallo al procesar un estado de entrega (wamid=${estado.id ?? 'sin id'}).`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    }

    return { recibido: true, procesados, ignorados };
  }

  private *valoresDe(cuerpo: PayloadDeMeta) {
    for (const entrada of cuerpo.entry ?? []) {
      for (const cambio of entrada.changes ?? []) {
        if (cambio.value) yield cambio.value;
      }
    }
  }

  private async procesarMensaje(
    phoneNumberId: string | undefined,
    mensaje: { id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string } },
  ): Promise<boolean> {
    if (!phoneNumberId || !mensaje.id || !mensaje.from) {
      this.logger.warn('Mensaje del webhook sin phone_number_id, id o remitente: se descarta.');
      return false;
    }

    const resultado = await this.recibirMensaje.ejecutar({
      phoneNumberId,
      telefonoClienta: this.normalizar(mensaje.from),
      wamid: mensaje.id,
      tipo: this.tipoDe(mensaje.type),
      // Solo se extrae el texto. Audio, imagen y documento se guardan como `no_soportado` sin
      // contenido: `RN-CONV-06` establece que **no se procesan notas de voz**, y guardar un
      // marcador deja constancia de que la clienta mandó algo que el bot no puede leer.
      contenido: mensaje.type === 'text' ? (mensaje.text?.body ?? null) : null,
      ocurridoEn: this.instanteDe(mensaje.timestamp),
    });

    return resultado.procesado;
  }

  private async procesarEstado(estado: { id?: string; status?: string; errors?: { title?: string; message?: string }[] }): Promise<void> {
    if (!estado.id || !estado.status) return;
    if (!['sent', 'delivered', 'read', 'failed'].includes(estado.status)) return;

    await this.actualizarEstado.ejecutar({
      wamid: estado.id,
      estado: estado.status as 'sent' | 'delivered' | 'read' | 'failed',
      error: estado.errors?.[0] ? `${estado.errors[0].title ?? ''} ${estado.errors[0].message ?? ''}`.trim() : null,
    });
  }

  private tipoDe(tipo: string | undefined): TipoMensaje {
    if (tipo === 'text') return 'texto';
    if (tipo === 'template') return 'plantilla';
    return 'no_soportado';
  }

  /** Mismo criterio que CRM: últimos 10 dígitos. Meta entrega el número en formato internacional. */
  private normalizar(telefono: string): string {
    return telefono.replace(/\D/g, '').slice(-10);
  }

  /** Meta manda el timestamp en **segundos**, no milisegundos. */
  private instanteDe(timestamp: string | undefined): Date {
    const segundos = Number(timestamp);
    return Number.isFinite(segundos) && segundos > 0 ? new Date(segundos * 1000) : new Date();
  }
}
