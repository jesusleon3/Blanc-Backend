import { Inject, Injectable, Logger } from '@nestjs/common';
import { Conversacion } from '../../domain/entities/conversacion.entity';
import { CONVERSACION_REPOSITORY, ConversacionRepository } from '../../domain/ports/conversacion.repository';
import {
  CONTEXTO_CLIENTA_DE_CONVERSACION_PORT,
  ContextoClientaDeConversacionPort,
} from '../../domain/ports/contexto-clienta-de-conversacion.port';
import { TipoMensaje } from '../../../../database/schema';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface MensajeEntrante {
  /** `phone_number_id` del número **receptor**: es lo que dice a qué sucursal pertenece. */
  phoneNumberId: string;
  telefonoClienta: string;
  wamid: string;
  tipo: TipoMensaje;
  contenido: string | null;
  ocurridoEn: Date;
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
      return { procesado: false, conversacionId: null, escalada: false, enSilencioPorBloqueo: false };
    }

    return this.unitOfWork.ejecutar(async () => {
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
        return { procesado: false, conversacionId: conversacion.id, escalada: false, enSilencioPorBloqueo: false };
      }

      // El mensaje era nuevo: ahora sí se mueve la ventana de 24 h y el contador.
      conversacion.registrarEntrante(entrante.ocurridoEn);

      const bloqueada = await this.vincularYDetectarBloqueo(conversacion);
      if (bloqueada) {
        conversacion.escalarAHumano('clienta_bloqueada', entrante.ocurridoEn);
      }

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
          escaladaPorBloqueo: bloqueada,
          modo: conversacion.modo,
        },
      });

      return {
        procesado: true,
        conversacionId: conversacion.id,
        escalada: conversacion.modo === 'humano',
        enSilencioPorBloqueo: bloqueada,
      };
    });
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
