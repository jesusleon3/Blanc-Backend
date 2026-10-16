import { Inject, Injectable, Logger } from '@nestjs/common';
import { Conversacion } from '../../domain/entities/conversacion.entity';
import { EnviarMensajeDelBotUseCase } from './enviar-mensaje-del-bot.use-case';
import { CONVERSACION_REPOSITORY, ConversacionRepository } from '../../domain/ports/conversacion.repository';
import {
  CONTEXTO_CLIENTA_DE_CONVERSACION_PORT,
  ContextoClientaDeConversacionPort,
} from '../../domain/ports/contexto-clienta-de-conversacion.port';
import { MotivoDeEscalamiento, TipoMensaje } from '../../../../database/schema';
import {
  NOTIFICADOR_ESCALAMIENTO_PORT,
  NotificadorEscalamientoPort,
} from '../../domain/ports/notificador-escalamiento.port';
import { ORQUESTADOR_DE_BOT_PORT, OrquestadorDeBotPort } from '../../domain/ports/orquestador-de-bot.port';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface MensajeEntrante {
  /** `phone_number_id` del número **receptor**: es lo que dice a qué sucursal pertenece. */
  phoneNumberId: string;
  telefonoClienta: string;
  wamid: string;
  tipo: TipoMensaje;
  contenido: string | null;
  /**
   * Tipo crudo que mandó Meta (`image`, `audio`, `document`, `sticker`…). Se conserva porque la
   * **razón** del escalamiento depende de él: una imagen es casi siempre una foto de referencia
   * para cotizar (`cotizacion_compleja`), y un audio es un medio que el bot no puede leer
   * (`medio_no_soportado`). Tratarlos igual mandaría a la Encargada el motivo equivocado.
   */
  tipoCrudoDeMeta?: string;
  ocurridoEn: Date;
}

/**
 * Acuse que se manda cuando llega un medio que el bot no puede procesar.
 *
 * ⚠️ **La conversación NO puede quedarse en silencio.** Era un defecto real: una clienta mandaba
 * una foto de la manicura que quería y recibía nada — el mensaje quedaba en la bandeja y, hasta
 * que alguien la abriera, para ella el salón simplemente no contestaba. El acuse no resuelve su
 * petición, pero le dice que llegó y que alguien la va a ver.
 *
 * Es texto fijo y corto a propósito: va por **texto libre**, así que solo puede enviarse con la
 * ventana de 24 h abierta — y acaba de escribir, así que lo está.
 */
export const ACUSE_DE_MEDIO_NO_PROCESABLE =
  'Recibimos tu mensaje. Una encargada lo revisa en breve y te responde por aquí.';

/**
 * Resultado de la parte transaccional, con lo que hace falta para los efectos posteriores.
 *
 * Existe porque la decisión se toma **dentro** de la transacción (necesita la conversación
 * actualizada) pero los envíos ocurren **fuera** (son llamadas de red). Este tipo es lo que cruza
 * esa frontera.
 */
interface ResultadoInterno extends ResultadoDeRecepcion {
  pendiente: {
    conversacion: Conversacion;
    motivoForzado: MotivoDeEscalamiento | null;
    yaEstabaEscalada: boolean;
    bloqueada: boolean;
  };
}

export interface ResultadoDeRecepcion {
  /** `false` si era un reintento de Meta con un `wamid` ya procesado. */
  procesado: boolean;
  conversacionId: string | null;
  /** `true` si el mensaje dejó la conversación en modo `humano`. */
  escalada: boolean;
  /**
   * `true` si la clienta está `bloqueada` en CRM: la conversación pasa a `humano` **en silencio**,
   * sin respuesta automática.
   */
  enSilencioPorBloqueo: boolean;
  /** Motivo con el que quedó escalada, o `null` si la sigue llevando el bot. */
  motivo: MotivoDeEscalamiento | null;
  /** `true` si el bot atendió el turno y respondió. */
  atendidaPorElBot: boolean;
}

/**
 * Procesa un mensaje entrante de la Cloud API de Meta.
 *
 * ## IDEMPOTENCIA POR `wamid`, Y POR QUÉ ES LO PRIMERO
 *
 * **Meta reintenta los webhooks**: ante un timeout, un 500, o por su propia política. El mismo
 * mensaje llega varias veces. Sin deduplicar, cada reintento duplicaría el mensaje en el hilo,
 * sumaría otro al contador de pendientes, **volvería a mover la ventana de 24 h** y —en la Parte
 * 3— invocaría otra vez a la IA, con el riesgo de agendar dos veces la misma cita.
 *
 * La deduplicación la decide el **índice único de la base**, no una consulta previa: dos reintentos
 * simultáneos pasarían los dos un `SELECT` de comprobación. `registrarMensaje` devuelve `false` y
 * **todo lo demás se omite**.
 *
 * ## CLIENTA BLOQUEADA: `humano` EN SILENCIO
 *
 * Si la clienta está `bloqueada` en CRM (`RN-CRM-04`), la conversación pasa a modo `humano` con
 * motivo `clienta_bloqueada` y **no se emite ninguna respuesta automática**. Las dos mitades
 * importan: pasar a `humano` evita que el bot le conteste y le siga el juego, y el silencio evita
 * decirle *"estás bloqueada"*, que es información que la Dueña no quiere dar por un canal
 * automático. El mensaje **sí se guarda**: la bandeja tiene que mostrarlo para que una persona
 * decida.
 */
@Injectable()
export class RecibirMensajeUseCase {
  private readonly logger = new Logger(RecibirMensajeUseCase.name);

  constructor(
    @Inject(CONVERSACION_REPOSITORY) private readonly conversaciones: ConversacionRepository,
    @Inject(CONTEXTO_CLIENTA_DE_CONVERSACION_PORT) private readonly clientas: ContextoClientaDeConversacionPort,
    @Inject(NOTIFICADOR_ESCALAMIENTO_PORT) private readonly avisoAlPersonal: NotificadorEscalamientoPort,
    private readonly enviarAcuse: EnviarMensajeDelBotUseCase,
    @Inject(ORQUESTADOR_DE_BOT_PORT) private readonly orquestador: OrquestadorDeBotPort,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(entrante: MensajeEntrante): Promise<ResultadoDeRecepcion> {
    const sucursalId = await this.conversaciones.buscarSucursalDeNumero(entrante.phoneNumberId);

    if (!sucursalId) {
      /**
       * Número no dado de alta. **No se lanza**, y es deliberado: lanzar devolvería un 500 a Meta,
       * que reintentaría el mismo evento en bucle indefinidamente. Se registra y se descarta.
       *
       * El caso real: un número nuevo recién conectado en Meta que nadie mapeó todavía en
       * `numeros_de_sucursal`. El log es lo que permite darse cuenta.
       */
      this.logger.error(
        `Webhook de un phone_number_id no mapeado a ninguna sucursal: ${entrante.phoneNumberId}. ` +
          'El mensaje se descarta. Da de alta el número en `conversaciones.numeros_de_sucursal`.',
      );
      return { procesado: false, conversacionId: null, escalada: false, enSilencioPorBloqueo: false, motivo: null, atendidaPorElBot: false };
    }

    const resultado = await this.unitOfWork.ejecutar(async (): Promise<ResultadoInterno | null> => {
      const conversacion =
        (await this.conversaciones.buscarPorSucursalYTelefono(sucursalId, entrante.telefonoClienta)) ??
        Conversacion.abrir({ sucursalId, telefonoClienta: entrante.telefonoClienta });

      /**
       * La conversación se persiste **antes** del mensaje, porque `mensajes.conversacion_id` tiene
       * clave foránea: en un hilo nuevo, insertar el mensaje primero la violaría.
       *
       * Esto **no rompe la idempotencia**, que es lo que importa aquí: en un reintento de Meta,
       * este `guardar` reescribe la conversación con **los mismos valores** (los efectos del
       * mensaje —mover la ventana, el contador, el escalamiento— todavía no se han aplicado), y a
       * continuación `registrarMensaje` devuelve `false` y se sale sin tocar nada más.
       */
      await this.conversaciones.guardar(conversacion);

      // Ahora el mensaje: si es un reintento, nada más debe ocurrir.
      const esNuevo = await this.conversaciones.registrarMensaje({
        conversacionId: conversacion.id,
        wamid: entrante.wamid,
        direccion: 'entrante',
        emisor: 'clienta',
        tipo: entrante.tipo,
        contenido: entrante.contenido,
        // Un entrante ya está entregado por definición: lo tenemos.
        estadoEntrega: 'delivered',
        ocurridoEn: entrante.ocurridoEn,
      });

      if (!esNuevo) {
        this.logger.log(`Reintento de Meta con wamid ya procesado (${entrante.wamid}): se ignora sin efectos.`);
        // `null` = nada que hacer fuera de la transacción. Un reintento no envía acuses, no avisa
        // al personal y no invoca al bot: es exactamente lo que la idempotencia promete.
        return null;
      }

      // El mensaje era nuevo: ahora sí se mueve la ventana de 24 h y el contador.
      conversacion.registrarEntrante(entrante.ocurridoEn);

      const yaEstabaEscalada = !conversacion.laLlevaElBot;
      const bloqueada = await this.vincularYDetectarBloqueo(conversacion);

      /**
       * Orden de decisión, y cada paso excluye al siguiente:
       *
       * 1. **Clienta bloqueada** → `humano` en silencio. Gana sobre todo lo demás: el bot no debe
       *    atenderla y no se le dice por qué.
       * 2. **Medio que el bot no puede leer** → `humano` con acuse. No puede quedarse en silencio.
       * 3. **Ya estaba en `humano`** → el bot no interviene (`RN-ESC-03`, cero interferencia).
       * 4. **Modo `bot` y texto** → lo atiende el orquestador.
       */
      const motivoForzado = this.motivoForzadoDe(entrante, bloqueada);
      if (motivoForzado) conversacion.escalarAHumano(motivoForzado, entrante.ocurridoEn);

      await this.conversaciones.guardar(conversacion);

      await this.auditoria.registrar({
        tipoAccion: 'conversacion',
        actor: 'sistema:webhook-meta',
        sucursalRelacionada: sucursalId,
        entidadAfectadaTipo: 'conversacion',
        entidadAfectadaId: conversacion.id,
        // `RN-AUD-01`: **nunca el contenido del mensaje**. Es lo que la clienta escribió, o sea
        // PII. Se registra que hubo un mensaje y qué efecto tuvo, no qué decía.
        detalle: {
          accion: 'recibir_mensaje_entrante',
          wamid: entrante.wamid,
          tipo: entrante.tipo,
          motivoForzado,
          modo: conversacion.modo,
        },
      });

      return {
        procesado: true,
        conversacionId: conversacion.id,
        escalada: !conversacion.laLlevaElBot,
        enSilencioPorBloqueo: bloqueada,
        motivo: conversacion.motivoDeEscalamiento,
        atendidaPorElBot: false,
        // Lo que queda por hacer FUERA de la transacción: ver `efectosPosteriores`.
        pendiente: { conversacion, motivoForzado, yaEstabaEscalada, bloqueada },
      };
    });

    if (!resultado) {
      return { procesado: false, conversacionId: null, escalada: false, enSilencioPorBloqueo: false, motivo: null, atendidaPorElBot: false };
    }

    return this.efectosPosteriores(resultado, entrante);
  }

  /**
   * Lo que ocurre **después de cerrar la transacción**: enviar el acuse, avisar al personal y
   * delegar en el bot.
   *
   * POR QUÉ FUERA. Las tres cosas son llamadas de red (WhatsApp, el futuro canal de avisos, y el
   * LLM). Una transacción abierta esperando a un tercero mantiene bloqueos sobre la conversación,
   * y ninguna de las tres se deshace con un `ROLLBACK`: un mensaje enviado ya está enviado. Si
   * fallan, el mensaje entrante **ya está guardado y la conversación ya está escalada**, que es lo
   * que no se puede perder.
   */
  private async efectosPosteriores(resultado: ResultadoInterno, entrante: MensajeEntrante): Promise<ResultadoDeRecepcion> {
    const { conversacion, motivoForzado, yaEstabaEscalada, bloqueada } = resultado.pendiente;
    const base = {
      procesado: resultado.procesado,
      conversacionId: resultado.conversacionId,
      escalada: resultado.escalada,
      enSilencioPorBloqueo: resultado.enSilencioPorBloqueo,
      motivo: resultado.motivo,
      atendidaPorElBot: false,
    };

    // (1) Bloqueada: silencio absoluto. Ni acuse, ni bot. Solo el aviso al personal.
    if (bloqueada) {
      await this.avisar(conversacion, 'clienta_bloqueada', yaEstabaEscalada);
      return base;
    }

    // (2) Medio no procesable: acuse para que no se quede en silencio.
    if (motivoForzado === 'cotizacion_compleja' || motivoForzado === 'medio_no_soportado') {
      await this.acusarRecibo(conversacion, entrante.ocurridoEn);
      await this.avisar(conversacion, motivoForzado, yaEstabaEscalada);
      return base;
    }

    // (3) Ya la llevaba una persona: el bot NO interviene (`RN-ESC-03`). Solo se avisa de que
    // llegó algo nuevo, que es justo lo que el personal necesita saber.
    if (yaEstabaEscalada) {
      await this.avisar(conversacion, conversacion.motivoDeEscalamiento ?? 'intervencion_manual', true);
      return base;
    }

    // (4) Modo `bot`: lo atiende el orquestador.
    const turno = await this.atenderConElBot(conversacion, entrante);
    if (turno.escalo) {
      // El motivo viene del resultado del turno, no de `conversacion`: esa copia se cargó antes de
      // que el bot escalara sobre la suya. Ver la nota de `ResultadoDelTurno.motivo`.
      await this.avisar(conversacion, turno.motivo ?? 'fuera_de_alcance', false);
    }

    return { ...base, escalada: turno.escalo || base.escalada, atendidaPorElBot: turno.respondio };
  }

  /**
   * Motivo que **obliga** a escalar sin consultar al bot, o `null` si el bot puede atenderlo.
   *
   * La distinción entre imagen y audio no es cosmética: una imagen es casi siempre una foto de
   * referencia para cotizar un diseño (`DEC-033` → `cotizacion_compleja`, que es lo que la
   * Encargada necesita leer en la bandeja para saber que hay que poner precio), y un audio es
   * simplemente algo que el bot no puede oír (`RN-CONV-06` → `medio_no_soportado`). Mandar el
   * motivo equivocado haría que la Dueña viera "cotizaciones complejas" donde solo hubo notas de
   * voz, y esa estadística es la que usa para saber qué se le escapa al bot.
   */
  private motivoForzadoDe(entrante: MensajeEntrante, bloqueada: boolean): MotivoDeEscalamiento | null {
    if (bloqueada) return 'clienta_bloqueada';
    if (entrante.tipo === 'texto' && entrante.contenido !== null) return null;
    return entrante.tipoCrudoDeMeta === 'image' ? 'cotizacion_compleja' : 'medio_no_soportado';
  }

  /** El acuse va por texto libre, posible porque la clienta acaba de escribir. */
  private async acusarRecibo(conversacion: Conversacion, ocurridoEn: Date): Promise<void> {
    try {
      await this.enviarAcuse.ejecutar(
        // `esAcuse: true`: decirle *"no puedo leer notas de voz"* **no atiende** su nota de voz. Si
        // esto limpiara `mensajes_sin_responder`, la conversación saldría del contador de
        // escaladas pendientes y el audio se quedaría sin escuchar.
        { conversacionId: conversacion.id, texto: ACUSE_DE_MEDIO_NO_PROCESABLE, esAcuse: true },
        ocurridoEn,
      );
    } catch (error) {
      // No propaga: el mensaje ya está guardado y la conversación ya está escalada. Perder el
      // acuse deja a la clienta sin confirmación, pero no pierde su mensaje.
      this.logger.error(
        `No se pudo enviar el acuse de recibo en la conversación ${conversacion.id}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async avisar(conversacion: Conversacion, motivo: MotivoDeEscalamiento, yaEstabaEscalada: boolean): Promise<void> {
    try {
      await this.avisoAlPersonal.conversacionNecesitaHumano({
        conversacionId: conversacion.id,
        sucursalId: conversacion.sucursalId,
        motivo,
        yaEstabaEscalada,
        mensajesSinResponder: conversacion.mensajesSinResponder,
      });
    } catch (error) {
      // Nunca propaga: la conversación ya necesita a una persona. Perder el aviso es peor
      // atendido, no incorrecto.
      this.logger.error('No se pudo avisar al personal del escalamiento.', error instanceof Error ? error.stack : String(error));
    }
  }

  private async atenderConElBot(conversacion: Conversacion, entrante: MensajeEntrante) {
    try {
      return await this.orquestador.atenderTurno({ conversacion, texto: entrante.contenido, ocurridoEn: entrante.ocurridoEn });
    } catch (error) {
      // Un fallo del bot **no pierde el mensaje**: ya está en la bandeja. Lo que se pierde es la
      // respuesta automática, y eso lo cubre una persona.
      this.logger.error(
        `El orquestador del bot falló en la conversación ${conversacion.id}; el mensaje queda en la bandeja.`,
        error instanceof Error ? error.stack : String(error),
      );
      return { respondio: false, escalo: false };
    }
  }

  /**
   * Vincula la conversación con la clienta de CRM si se puede, y dice si está bloqueada.
   *
   * **Solo vincula cuando hay UNA sola coincidencia.** Con dos (mamá e hija comparten teléfono) no
   * se elige: elegir sería adivinar, y la elección equivocada ataría el historial de conversación
   * a la clienta errónea — con el agravante de que de ahí sale si se le pide anticipo.
   *
   * **El bloqueo sí se evalúa aunque haya varias**: si *cualquiera* de las clientas de ese teléfono
   * está bloqueada, la conversación se escala. Es el lado seguro — el bot no debe atender un
   * número desde el que escribe alguien bloqueado, aunque no se sepa cuál de las dos es.
   */
  private async vincularYDetectarBloqueo(conversacion: Conversacion): Promise<boolean> {
    const candidatas = await this.clientas.buscarPorTelefono(conversacion.telefonoClienta);
    if (candidatas.length === 0) return false;

    if (candidatas.length === 1 && conversacion.clientaId === null) {
      conversacion.vincularClienta(candidatas[0].id);
    }

    return candidatas.some((clienta) => clienta.estadoDeRiesgo === 'bloqueada');
  }
}

/**
 * Actualiza el estado de entrega que reporta Meta (`sent`, `delivered`, `read`, `failed`).
 *
 * **No crea nada ni falla si el `wamid` es desconocido.** Meta puede reportar el estado de un
 * mensaje que no está en nuestra base (enviado desde otra herramienta, o anterior a la migración),
 * y devolver error haría que reintentara en bucle un evento que nunca vamos a poder procesar.
 */
@Injectable()
export class ActualizarEstadoDeEntregaUseCase {
  private readonly logger = new Logger(ActualizarEstadoDeEntregaUseCase.name);

  constructor(@Inject(CONVERSACION_REPOSITORY) private readonly conversaciones: ConversacionRepository) {}

  async ejecutar(input: { wamid: string; estado: 'sent' | 'delivered' | 'read' | 'failed'; error?: string | null }): Promise<boolean> {
    const actualizado = await this.conversaciones.actualizarEstadoDeEntrega(input.wamid, input.estado, input.error);

    if (!actualizado) {
      this.logger.log(`Estado de entrega de un wamid desconocido (${input.wamid}): se ignora.`);
      return false;
    }

    if (input.estado === 'failed') {
      // `failed` es el único que merece nivel de error: significa que la clienta NO recibió el
      // mensaje, y nadie se va a enterar si no queda registrado.
      this.logger.error(`Meta reportó entrega FALLIDA del mensaje ${input.wamid}: ${input.error ?? 'sin detalle'}`);
    }

    return true;
  }
}
