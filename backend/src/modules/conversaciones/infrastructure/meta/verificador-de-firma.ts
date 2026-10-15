import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Verifica `X-Hub-Signature-256` de los webhooks de Meta (HMAC-SHA256 con el App Secret).
 *
 * ## POR QUÉ ESTO NO ES OPCIONAL
 *
 * El webhook es un endpoint **público** —Meta tiene que poder alcanzarlo sin autenticarse— así que
 * la firma es **lo único** que distingue un evento real de uno fabricado. Sin verificarla,
 * cualquiera que conozca la URL podría inyectar mensajes entrantes falsos: crear conversaciones,
 * escalarlas, y en la Parte 3 hacer que la IA actúe sobre texto que ninguna clienta escribió.
 *
 * ## COMPARACIÓN EN TIEMPO CONSTANTE
 *
 * Se usa `timingSafeEqual` y no `===`. Comparar cadenas con `===` **termina en el primer byte que
 * difiere**, y ese tiempo es medible: con suficientes intentos, un atacante puede deducir la firma
 * byte a byte sin conocer el secreto. Es un ataque conocido contra verificación de HMAC y cuesta
 * una línea evitarlo.
 *
 * `timingSafeEqual` **lanza si las longitudes difieren**, así que se comprueba antes — ese caso no
 * filtra nada: la longitud de un HMAC-SHA256 es pública y fija.
 */
@Injectable()
export class VerificadorDeFirmaMeta {
  private readonly logger = new Logger(VerificadorDeFirmaMeta.name);

  constructor(private readonly appSecret: string) {}

  /**
   * `true` si la firma corresponde al cuerpo exacto recibido.
   *
   * ⚠️ **`cuerpoCrudo` tiene que ser el cuerpo SIN PARSEAR.** El HMAC se calcula sobre los bytes
   * que Meta firmó; volver a serializar el JSON parseado cambia espacios y orden de claves, y la
   * firma **nunca** coincidiría. Por eso el controlador usa `rawBody` y no el objeto.
   */
  esValida(firmaRecibida: string | undefined, cuerpoCrudo: Buffer | string): boolean {
    if (!firmaRecibida) {
      this.logger.warn('Webhook sin cabecera X-Hub-Signature-256: se rechaza.');
      return false;
    }

    const prefijo = 'sha256=';
    if (!firmaRecibida.startsWith(prefijo)) {
      this.logger.warn('Webhook con firma en formato inesperado: se rechaza.');
      return false;
    }

    const esperada = createHmac('sha256', this.appSecret).update(cuerpoCrudo).digest('hex');
    const recibida = firmaRecibida.slice(prefijo.length);

    // `timingSafeEqual` exige longitudes iguales; la del HMAC es fija y pública, así que
    // comprobarla antes no filtra información.
    if (recibida.length !== esperada.length) return false;

    return timingSafeEqual(Buffer.from(recibida, 'utf8'), Buffer.from(esperada, 'utf8'));
  }
}
