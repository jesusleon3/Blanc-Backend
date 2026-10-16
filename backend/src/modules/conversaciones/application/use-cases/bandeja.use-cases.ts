import { Inject, Injectable } from '@nestjs/common';
import { Conversacion, EstadoDeVentana } from '../../domain/entities/conversacion.entity';
import {
  CONVERSACION_REPOSITORY,
  ConversacionRepository,
  EscaladasPendientes,
  MensajeRegistrado,
  PaginaDeConversaciones,
} from '../../domain/ports/conversacion.repository';
import { PROVEEDOR_WHATSAPP_PORT, ProveedorWhatsAppPort } from '../../domain/ports/proveedor-whatsapp.port';
import { ModoConversacion, MotivoDeEscalamiento } from '../../../../database/schema';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export const MAXIMO_CONVERSACIONES_POR_PAGINA = 100;
export const CONVERSACIONES_POR_PAGINA_POR_DEFECTO = 30;
export const MAXIMO_MENSAJES_POR_PAGINA = 200;
export const MENSAJES_POR_PAGINA_POR_DEFECTO = 100;

/** Lectura de la bandeja: la cola de trabajo del personal. */
@Injectable()
export class ConsultarBandejaUseCase {
  constructor(@Inject(CONVERSACION_REPOSITORY) private readonly conversaciones: ConversacionRepository) {}

  listar(filtros: {
    sucursalId?: string;
    modo?: ModoConversacion;
    soloPendientes?: boolean;
    limite?: number;
    desplazamiento?: number;
  }): Promise<PaginaDeConversaciones> {
    return this.conversaciones.listarParaBandeja({
      sucursalId: filtros.sucursalId,
      modo: filtros.modo,
      soloPendientes: filtros.soloPendientes,
      limite: Math.min(filtros.limite ?? CONVERSACIONES_POR_PAGINA_POR_DEFECTO, MAXIMO_CONVERSACIONES_POR_PAGINA),
      desplazamiento: filtros.desplazamiento ?? 0,
    });
  }
}

/**
 * El contador de conversaciones escaladas **sin atender** — tercera deuda de la Parte 2.
 *
 * ## QUÉ PROBLEMA RESUELVE, Y CUÁL NO
 *
 * Con la Cloud API el celular deja de recibir notificaciones de WhatsApp, así que **la única
 * forma de saber que una clienta escribió es que la plataforma lo diga**. El aviso activo
 * (`NotificadorEscalamientoPort`) es lo que la Dueña pidió, pero su canal —correo, push, otro
 * número— sigue sin decidir y elegirlo aquí sería inventar un requisito.
 *
 * Este contador es el sustituto honesto: **no resuelve "sin mirar la pantalla"**, sigue exigiendo
 * el panel abierto. Lo que sí resuelve es no tener que leer conversación por conversación para
 * saber si algo espera, y da el dato que un badge necesita en una sola consulta agregada.
 *
 * `masAntiguaEn` va en la respuesta porque *cuántas* esperan importa menos que *cuánto llevan
 * esperando*: tres conversaciones de hace dos minutos son una mañana normal; una de hace dos
 * horas es un fallo de atención.
 */
@Injectable()
export class ContarEscaladasPendientesUseCase {
  constructor(@Inject(CONVERSACION_REPOSITORY) private readonly conversaciones: ConversacionRepository) {}

  ejecutar(filtros: { sucursalId?: string } = {}): Promise<EscaladasPendientes> {
    return this.conversaciones.contarEscaladasPendientes(filtros);
  }
}

export interface HiloDeConversacion {
  conversacion: Conversacion;
  mensajes: MensajeRegistrado[];
  /**
   * Estado de la ventana de 24 h **en el momento de la consulta**.
   *
   * Viaja con el hilo a propósito: quien abre la conversación tiene que saber **antes de escribir**
   * si puede mandar texto libre o necesita una plantilla. Descubrirlo al pulsar enviar sería
   * redactar un mensaje para que el sistema lo rechace.
   */
  estadoDeVentana: EstadoDeVentana;
}

@Injectable()
export class ConsultarHiloUseCase {
  constructor(@Inject(CONVERSACION_REPOSITORY) private readonly conversaciones: ConversacionRepository) {}

  async ejecutar(
    input: { conversacionId: string; limite?: number; desplazamiento?: number },
    ahora = new Date(),
  ): Promise<HiloDeConversacion> {
    const conversacion = await this.conversaciones.buscarPorId(input.conversacionId);
    if (!conversacion) throw new RecursoNoEncontradoError('Conversacion', input.conversacionId);

    const mensajes = await this.conversaciones.listarMensajes(conversacion.id, {
      limite: Math.min(input.limite ?? MENSAJES_POR_PAGINA_POR_DEFECTO, MAXIMO_MENSAJES_POR_PAGINA),
      desplazamiento: input.desplazamiento ?? 0,
    });

    return { conversacion, mensajes, estadoDeVentana: conversacion.estadoDeVentana(ahora) };
  }
}

/**
 * Una persona escribe desde la bandeja.
 *
 * ## ESCRIBIR **ES** TOMAR LA CONVERSACIÓN
 *
 * Si la lleva el bot, enviar un mensaje manual la pasa automáticamente a modo `humano` con motivo
 * `intervencion_manual`. No es una comodidad: dejarla en `bot` después de que una persona
 * escribiera produciría **dos interlocutores a la vez** en el mismo hilo — la clienta recibiría la
 * respuesta de la Encargada y, acto seguido, la del bot contestando a lo mismo. Es exactamente la
 * colisión que `DEC-043` eliminó del lado del celular, y no tiene sentido reintroducirla aquí.
 *
 * ## LA VENTANA SE VALIDA ANTES DE LLAMAR A META (`N-14`)
 *
 * Con la ventana cerrada, el texto libre se rechaza con `VENTANA_24H_CERRADA` **sin gastar la
 * petición**. Meta lo rechazaría igual, pero el operador vería un fallo genérico de API en vez de
 * una instrucción: *"usa una plantilla"*.
 */
@Injectable()
export class EnviarMensajeManualUseCase {
  constructor(
    @Inject(CONVERSACION_REPOSITORY) private readonly conversaciones: ConversacionRepository,
    @Inject(PROVEEDOR_WHATSAPP_PORT) private readonly whatsapp: ProveedorWhatsAppPort,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(
    input: { conversacionId: string; texto: string },
    actor: ClaimsUsuario,
    ahora = new Date(),
  ): Promise<{ conversacion: Conversacion; wamid: string }> {
    const conversacion = await this.conversaciones.buscarPorId(input.conversacionId);
    if (!conversacion) throw new RecursoNoEncontradoError('Conversacion', input.conversacionId);

    // Antes de tocar nada: si la ventana está cerrada, esto lanza y no se envía ni se escribe.
    conversacion.exigirVentanaAbiertaParaTextoLibre(ahora);

    const phoneNumberId = await this.conversaciones.buscarNumeroDeSucursal(conversacion.sucursalId);
    if (!phoneNumberId) {
      throw new ConflictoDeNegocioError(
        'SUCURSAL_SIN_NUMERO_DE_WHATSAPP',
        'Esa sucursal no tiene un número de WhatsApp dado de alta, así que no se puede responder desde la bandeja.',
        { sucursalId: conversacion.sucursalId },
      );
    }

    // FUERA de la transacción: es una llamada de red, y un mensaje enviado no se deshace con un
    // `ROLLBACK`. Si fallara el guardado posterior, es preferible un mensaje enviado sin registrar
    // —visible en el teléfono de la clienta y recuperable por el webhook de estado— que un
    // registro de algo que nunca salió.
    const { wamid } = await this.whatsapp.enviarTexto({
      phoneNumberId,
      telefonoDestino: conversacion.telefonoClienta,
      texto: input.texto,
    });

    // Escribir es tomar la conversación: ver la nota de la cabecera.
    conversacion.escalarAHumano('intervencion_manual', ahora);
    // Una persona respondió de verdad: la conversación sale de pendientes.
    conversacion.registrarRespuesta(ahora);

    await this.unitOfWork.ejecutar(async () => {
      await this.conversaciones.registrarMensaje({
        conversacionId: conversacion.id,
        wamid,
        direccion: 'saliente',
        emisor: 'humano',
        tipo: 'texto',
        contenido: input.texto,
        estadoEntrega: 'pendiente',
        ocurridoEn: ahora,
      });
      await this.conversaciones.guardar(conversacion);

      await this.auditoria.registrar({
        tipoAccion: 'conversacion',
        actor: actor.sub,
        sucursalRelacionada: conversacion.sucursalId,
        entidadAfectadaTipo: 'conversacion',
        entidadAfectadaId: conversacion.id,
        // Sin el texto: `RN-AUD-01`. Queda que alguien respondió, no qué escribió.
        detalle: { accion: 'enviar_mensaje_manual', wamid, modo: conversacion.modo },
      });
    });

    return { conversacion, wamid };
  }
}

/**
 * Envía una **plantilla aprobada** — la única vía con la ventana de 24 h cerrada (`N-14`).
 *
 * **No exige que la ventana esté cerrada**: una plantilla es válida siempre. Restringirla al caso
 * cerrado obligaría a quien opera a saber en qué estado está la ventana para elegir el endpoint, y
 * el sistema ya lo sabe.
 *
 * ⚠️ **Enviar una plantilla cuesta dinero** (Meta la cobra). No se envía nada que no haya pedido
 * explícitamente una persona o un barrido del planificador.
 */
@Injectable()
export class EnviarPlantillaUseCase {
  constructor(
    @Inject(CONVERSACION_REPOSITORY) private readonly conversaciones: ConversacionRepository,
    @Inject(PROVEEDOR_WHATSAPP_PORT) private readonly whatsapp: ProveedorWhatsAppPort,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(
    input: { conversacionId: string; plantilla: string; idioma?: string; parametros?: string[]; comoHumano?: boolean },
    actor: ClaimsUsuario,
    ahora = new Date(),
  ): Promise<{ conversacion: Conversacion; wamid: string }> {
    const conversacion = await this.conversaciones.buscarPorId(input.conversacionId);
    if (!conversacion) throw new RecursoNoEncontradoError('Conversacion', input.conversacionId);

    const phoneNumberId = await this.conversaciones.buscarNumeroDeSucursal(conversacion.sucursalId);
    if (!phoneNumberId) {
      throw new ConflictoDeNegocioError(
        'SUCURSAL_SIN_NUMERO_DE_WHATSAPP',
        'Esa sucursal no tiene un número de WhatsApp dado de alta.',
        { sucursalId: conversacion.sucursalId },
      );
    }

    const parametros = input.parametros ?? [];
    const { wamid } = await this.whatsapp.enviarPlantilla({
      phoneNumberId,
      telefonoDestino: conversacion.telefonoClienta,
      plantilla: input.plantilla,
      idioma: input.idioma ?? 'es_MX',
      parametros,
    });

    /**
     * Una plantilla enviada por una persona desde la bandeja **sí** toma la conversación; una
     * enviada por el planificador (recordatorio, oferta de hueco) **no**.
     *
     * La distinción es la que evita que un recordatorio automático escale a `humano` las citas de
     * media agenda cada noche, dejando a la Encargada con cien conversaciones "tomadas" que nadie
     * tomó.
     */
    /**
     * Y la misma distinción decide si la conversación sale de "pendientes".
     *
     * Una plantilla enviada **por una persona** es una respuesta; una enviada **por el
     * planificador** (recordatorio, oferta de hueco) no lo es. Tratarlas igual era el defecto que
     * hacía que un recordatorio nocturno limpiara el contador de una conversación que nadie había
     * atendido, sacándola de la cola de trabajo de la Encargada sin que nadie la leyera.
     */
    if (input.comoHumano) {
      conversacion.escalarAHumano('intervencion_manual', ahora);
      conversacion.registrarRespuesta(ahora);
    } else {
      conversacion.registrarNotificacionDeSistema(ahora);
    }

    await this.unitOfWork.ejecutar(async () => {
      await this.conversaciones.registrarMensaje({
        conversacionId: conversacion.id,
        wamid,
        direccion: 'saliente',
        emisor: input.comoHumano ? 'humano' : 'sistema',
        tipo: 'plantilla',
        contenido: input.plantilla,
        parametrosPlantilla: parametros.length > 0 ? JSON.stringify(parametros) : null,
        estadoEntrega: 'pendiente',
        ocurridoEn: ahora,
      });
      await this.conversaciones.guardar(conversacion);

      await this.auditoria.registrar({
        tipoAccion: 'conversacion',
        actor: actor.sub,
        sucursalRelacionada: conversacion.sucursalId,
        entidadAfectadaTipo: 'conversacion',
        entidadAfectadaId: conversacion.id,
        // El NOMBRE de la plantilla sí: no es PII y es lo que permite conciliar el gasto con Meta.
        detalle: { accion: 'enviar_plantilla', plantilla: input.plantilla, wamid, modo: conversacion.modo },
      });
    });

    return { conversacion, wamid };
  }
}

/** Escalado manual y retorno de control (`RN-ESC-03`). */
@Injectable()
export class CambiarModoConversacionUseCase {
  constructor(
    @Inject(CONVERSACION_REPOSITORY) private readonly conversaciones: ConversacionRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async escalar(
    input: { conversacionId: string; motivo: MotivoDeEscalamiento },
    actor: ClaimsUsuario,
    ahora = new Date(),
  ): Promise<Conversacion> {
    const conversacion = await this.cargar(input.conversacionId);
    conversacion.escalarAHumano(input.motivo, ahora);
    await this.persistir(conversacion, 'escalar_conversacion', actor, { motivo: input.motivo });
    return conversacion;
  }

  /**
   * Devuelve el control al bot. **Es la ÚNICA vía de salida del modo `humano`** (`RN-ESC-03`).
   *
   * No hay ningún camino automático: ni por inactividad, ni por tiempo, ni por el propio bot. Una
   * clienta que pidió hablar con alguien y recibe de nuevo al bot a los diez minutos concluye, con
   * razón, que nadie la escuchó.
   */
  async devolverAlBot(input: { conversacionId: string }, actor: ClaimsUsuario): Promise<Conversacion> {
    const conversacion = await this.cargar(input.conversacionId);
    const motivoPrevio = conversacion.motivoDeEscalamiento;
    conversacion.devolverAlBot();
    await this.persistir(conversacion, 'devolver_conversacion_al_bot', actor, { motivoPrevio });
    return conversacion;
  }

  private async cargar(conversacionId: string): Promise<Conversacion> {
    const conversacion = await this.conversaciones.buscarPorId(conversacionId);
    if (!conversacion) throw new RecursoNoEncontradoError('Conversacion', conversacionId);
    return conversacion;
  }

  private async persistir(
    conversacion: Conversacion,
    accion: string,
    actor: ClaimsUsuario,
    extra: Record<string, unknown>,
  ): Promise<void> {
    await this.unitOfWork.ejecutar(async () => {
      await this.conversaciones.guardar(conversacion);
      await this.auditoria.registrar({
        tipoAccion: 'conversacion',
        actor: actor.sub,
        sucursalRelacionada: conversacion.sucursalId,
        entidadAfectadaTipo: 'conversacion',
        entidadAfectadaId: conversacion.id,
        detalle: { accion, modo: conversacion.modo, ...extra },
      });
    });
  }
}

/** Alta del mapa `phone_number_id` → sucursal. Sin esto, los webhooks de ese número se descartan. */
@Injectable()
export class RegistrarNumeroDeSucursalUseCase {
  constructor(
    @Inject(CONVERSACION_REPOSITORY) private readonly conversaciones: ConversacionRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(
    input: { phoneNumberId: string; sucursalId: string; telefonoVisible: string },
    actor: ClaimsUsuario,
  ): Promise<void> {
    await this.unitOfWork.ejecutar(async () => {
      await this.conversaciones.registrarNumeroDeSucursal(input);
      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: input.sucursalId,
        /**
         * La entidad afectada es **la sucursal**, no el número.
         *
         * `auditoria.log_auditoria.entidad_afectada_id` es `uuid`, y un `phone_number_id` de Meta
         * es una cadena opaca que no lo es. Ensanchar esa columna a `text` por este caso habría
         * tocado el historial de auditoría entero — y además es más fiel: lo que cambia de
         * configuración es la sucursal, que pasa a tener un número de WhatsApp asignado.
         */
        entidadAfectadaTipo: 'numero_de_whatsapp_de_sucursal',
        entidadAfectadaId: input.sucursalId,
        detalle: {
          accion: 'registrar_numero_de_sucursal',
          phoneNumberId: input.phoneNumberId,
          telefonoVisible: input.telefonoVisible,
        },
      });
    });
  }
}
