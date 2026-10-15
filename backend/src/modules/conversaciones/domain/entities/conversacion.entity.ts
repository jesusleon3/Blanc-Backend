import { randomUUID } from 'crypto';
import { ModoConversacion, MotivoDeEscalamiento } from '../../../../database/schema';
import { ConflictoDeNegocioError, DomainError } from '../../../../shared/errors/domain-error';

/**
 * Ventana de servicio al cliente de Meta (`N-14`, `ADR-008`).
 *
 * **No es una decisión de Blanc: es una restricción de la plataforma.** Pasadas 24 horas desde el
 * último mensaje de la clienta, Meta **rechaza** cualquier texto libre del negocio; solo acepta
 * una plantilla preaprobada, y esa plantilla **se cobra**.
 *
 * Con la integración no oficial que se descartó (`DEC-043`) esto no existía. Al elegir la API
 * oficial se asumió, y por eso el dominio tiene que saber responder si la ventana está abierta
 * **antes** de intentar enviar: descubrirlo por el error de Meta significaría haber perdido el
 * mensaje y no saber por qué.
 */
export const HORAS_DE_VENTANA_DE_META = 24;

export interface ConversacionProps {
  id: string;
  sucursalId: string;
  telefonoClienta: string;
  clientaId: string | null;
  modo: ModoConversacion;
  motivoDeEscalamiento: MotivoDeEscalamiento | null;
  escaladaEn: Date | null;
  ultimaInteraccionEntranteEn: Date | null;
  ultimoMensajeEn: Date | null;
  mensajesSinResponder: number;
  creadoEn: Date;
}

/** Por qué no se puede escribir texto libre. Distingue "se cerró" de "nunca se abrió". */
export type EstadoDeVentana = 'abierta' | 'cerrada' | 'nunca_abierta';

/**
 * `Conversacion` — aggregate raíz del Bounded Context de Conversaciones / Mensajería.
 *
 * ## IDENTIDAD: EL TELÉFONO Y LA SUCURSAL, NO LA CLIENTA
 *
 * La define `(sucursalId, telefonoClienta)`, porque eso es lo único que trae el webhook de Meta.
 * `clientaId` es **opcional y posterior**: un teléfono puede corresponder a **dos clientas**
 * (mamá e hija, `RN-CRM-01` corregido en Fase 3), así que vincularla a *una* es una decisión que a
 * veces no se puede tomar — y que nunca define el hilo.
 *
 * Consecuencia deliberada: mamá e hija **comparten la conversación** aunque sean dos expedientes
 * de CRM. Es lo que ocurre en la realidad: hay un solo chat de WhatsApp.
 *
 * ## DEL MODO `humano` NO SE SALE SOLO
 *
 * `RN-ESC-03` — *"retorno de control siempre explícito"*. No hay método que devuelva el modo a
 * `bot` por inactividad, por tiempo ni por nada automático: solo `devolverAlBot()`, que invoca una
 * persona. **Esa ausencia es la regla**, y la razón es concreta: una clienta que pidió hablar con
 * alguien y recibe de nuevo al bot a los diez minutos concluye, con razón, que nadie la escuchó.
 */
export class Conversacion {
  private constructor(private props: ConversacionProps) {}

  static abrir(input: { sucursalId: string; telefonoClienta: string; clientaId?: string | null }): Conversacion {
    if (input.telefonoClienta.trim().length === 0) {
      throw new DomainError('CONVERSACION_TELEFONO_REQUERIDO', 'La conversación necesita el teléfono de la clienta.', 400);
    }

    return new Conversacion({
      id: randomUUID(),
      sucursalId: input.sucursalId,
      telefonoClienta: input.telefonoClienta,
      clientaId: input.clientaId ?? null,
      // Nace en `bot`: el escalamiento es siempre un evento posterior y explícito.
      modo: 'bot',
      motivoDeEscalamiento: null,
      escaladaEn: null,
      ultimaInteraccionEntranteEn: null,
      ultimoMensajeEn: null,
      mensajesSinResponder: 0,
      creadoEn: new Date(),
    });
  }

  static reconstruir(props: ConversacionProps): Conversacion {
    return new Conversacion(props);
  }

  /**
   * La clienta escribió: **se reinicia el reloj de la ventana de 24 h**.
   *
   * Es el único evento que la abre. Que lo haga un mensaje entrante y solo uno entrante es
   * exactamente la regla de Meta: responder no extiende la ventana, solo escribir la clienta.
   */
  registrarEntrante(ocurridoEn: Date): void {
    this.props.ultimaInteraccionEntranteEn = ocurridoEn;
    this.props.ultimoMensajeEn = ocurridoEn;
    this.props.mensajesSinResponder += 1;
  }

  /** El salón respondió: la conversación deja de estar pendiente. No toca la ventana. */
  registrarSaliente(ocurridoEn: Date): void {
    this.props.ultimoMensajeEn = ocurridoEn;
    this.props.mensajesSinResponder = 0;
  }

  /**
   * Estado de la ventana de Meta en un instante dado.
   *
   * `nunca_abierta` es un tercer caso real y distinto de `cerrada`: la conversación la inició el
   * salón y la clienta **nunca** respondió. Importa porque el mensaje para quien opera es
   * distinto — *"se te pasó el plazo"* frente a *"esta clienta nunca te ha escrito"*— y porque es
   * el caso en que una plantilla es la **única** vía posible desde el principio.
   */
  estadoDeVentana(ahora = new Date()): EstadoDeVentana {
    if (this.props.ultimaInteraccionEntranteEn === null) return 'nunca_abierta';

    const horas = (ahora.getTime() - this.props.ultimaInteraccionEntranteEn.getTime()) / 3_600_000;
    return horas < HORAS_DE_VENTANA_DE_META ? 'abierta' : 'cerrada';
  }

  /**
   * Lanza si no se puede enviar **texto libre** en este instante (`N-14`).
   *
   * Se comprueba en el dominio y **antes** de llamar a Meta, no al recibir su error: un envío
   * rechazado por Meta ya consumió la petición, y el operador vería un fallo genérico de API en
   * vez de una instrucción accionable. El mensaje dice qué hacer — usar una plantilla.
   */
  exigirVentanaAbiertaParaTextoLibre(ahora = new Date()): void {
    const estado = this.estadoDeVentana(ahora);
    if (estado === 'abierta') return;

    throw new ConflictoDeNegocioError(
      'VENTANA_24H_CERRADA',
      estado === 'nunca_abierta'
        ? 'Esta clienta nunca ha escrito, así que no se le puede mandar texto libre: usa una plantilla aprobada.'
        : `Pasaron más de ${HORAS_DE_VENTANA_DE_META} horas desde el último mensaje de la clienta: solo se puede enviar una plantilla aprobada.`,
      {
        conversacionId: this.props.id,
        estadoDeVentana: estado,
        ultimaInteraccionEntranteEn: this.props.ultimaInteraccionEntranteEn?.toISOString() ?? null,
        requierePlantilla: true,
      },
    );
  }

  /**
   * Pasa a modo `humano` con su motivo.
   *
   * **Idempotente en el modo, no en el motivo**: si ya está escalada, no se sobrescribe el motivo
   * original. El primero es el que explica por qué dejó de atenderla el bot; sobrescribirlo con
   * un `intervencion_manual` posterior borraría la razón real, que es justo el dato que la Dueña
   * mira para saber qué se le escapa al bot.
   */
  escalarAHumano(motivo: MotivoDeEscalamiento, ahora = new Date()): void {
    if (this.props.modo === 'humano') return;

    this.props.modo = 'humano';
    this.props.motivoDeEscalamiento = motivo;
    this.props.escaladaEn = ahora;
  }

  /**
   * Devuelve el control al bot. **Solo por acción explícita de una persona** (`RN-ESC-03`).
   *
   * No existe ninguna otra vía: ni por inactividad, ni por tiempo, ni por el propio bot. Ver la
   * nota de la cabecera.
   */
  devolverAlBot(): void {
    if (this.props.modo === 'bot') {
      throw new ConflictoDeNegocioError('CONVERSACION_YA_EN_BOT', 'Esta conversación ya la lleva el bot.', {
        conversacionId: this.props.id,
      });
    }

    this.props.modo = 'bot';
    // Se limpian juntos: el `CHECK` de la migración exige que modo y motivo sean coherentes.
    this.props.motivoDeEscalamiento = null;
    this.props.escaladaEn = null;
  }

  /** Vincula la conversación a una clienta de CRM cuando se identifica. */
  vincularClienta(clientaId: string): void {
    this.props.clientaId = clientaId;
  }

  get laLlevaElBot(): boolean {
    return this.props.modo === 'bot';
  }

  get id(): string {
    return this.props.id;
  }
  get sucursalId(): string {
    return this.props.sucursalId;
  }
  get telefonoClienta(): string {
    return this.props.telefonoClienta;
  }
  get clientaId(): string | null {
    return this.props.clientaId;
  }
  get modo(): ModoConversacion {
    return this.props.modo;
  }
  get motivoDeEscalamiento(): MotivoDeEscalamiento | null {
    return this.props.motivoDeEscalamiento;
  }
  get escaladaEn(): Date | null {
    return this.props.escaladaEn;
  }
  get ultimaInteraccionEntranteEn(): Date | null {
    return this.props.ultimaInteraccionEntranteEn;
  }
  get ultimoMensajeEn(): Date | null {
    return this.props.ultimoMensajeEn;
  }
  get mensajesSinResponder(): number {
    return this.props.mensajesSinResponder;
  }
  get creadoEn(): Date {
    return this.props.creadoEn;
  }
}
