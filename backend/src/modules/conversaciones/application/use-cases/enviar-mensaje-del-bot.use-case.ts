import { Inject, Injectable } from '@nestjs/common';
import { CONVERSACION_REPOSITORY, ConversacionRepository } from '../../domain/ports/conversacion.repository';
import { PROVEEDOR_WHATSAPP_PORT, ProveedorWhatsAppPort } from '../../domain/ports/proveedor-whatsapp.port';
import { ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

/**
 * El **bot** responde con texto libre.
 *
 * ## POR QUÉ NO REUTILIZA `EnviarMensajeManualUseCase`
 *
 * Aquel **escala la conversación a `humano`** (escribir desde la bandeja es tomarla), y eso es
 * exactamente lo que no debe pasar aquí: si el bot escalara al responder, la primera respuesta
 * automática dejaría la conversación "tomada" y el bot no podría continuar la charla. Son dos
 * actos distintos que comparten mecánica, no el mismo acto.
 *
 * ## `esAcuse`: LA DISTINCIÓN QUE SALVA AL CONTADOR DE ESCALADAS
 *
 * Una respuesta del bot **sí** pone `mensajes_sin_responder` a cero: está contestando el turno de
 * la clienta. Pero un **acuse** no contesta nada — *"una encargada te atiende en breve"* o *"no
 * puedo leer notas de voz"* son avisos de que el mensaje **sigue sin atender**.
 *
 * Sin esta distinción el sistema se rompe de la peor manera posible, en silencio: la clienta pide
 * cancelar → el bot escala a `humano` → el bot avisa *"te atiende una encargada"* → el contador
 * baja a cero → `GET /escaladas/pendientes` devuelve `0` → **nadie se entera de que hay una
 * conversación esperando**. El acuse habría borrado la única señal de que hacía falta atenderla.
 *
 * Por eso `esAcuse: true` usa `registrarNotificacionDeSistema`: actualiza `ultimo_mensaje_en` para
 * que la bandeja ordene bien, y **no toca el contador**.
 *
 * **No audita cada respuesta del bot.** `RN-CONV-04` exige trazabilidad de las *decisiones* de la
 * IA, y esas las audita el orquestador con su intención y sus herramientas; registrar además cada
 * texto enviado llenaría la auditoría de PII (`RN-AUD-01`) sin añadir información: el mensaje ya
 * queda en el hilo, que es donde se lee.
 */
@Injectable()
export class EnviarMensajeDelBotUseCase {
  constructor(
    @Inject(CONVERSACION_REPOSITORY) private readonly conversaciones: ConversacionRepository,
    @Inject(PROVEEDOR_WHATSAPP_PORT) private readonly whatsapp: ProveedorWhatsAppPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(
    input: { conversacionId: string; texto: string; esAcuse?: boolean },
    ahora = new Date(),
  ): Promise<{ wamid: string }> {
    const conversacion = await this.conversaciones.buscarPorId(input.conversacionId);
    if (!conversacion) throw new RecursoNoEncontradoError('Conversacion', input.conversacionId);

    // La misma regla que para un humano: sin ventana abierta no hay texto libre (`N-14`). El bot
    // siempre responde a un mensaje que acaba de llegar, así que en la práctica está abierta —
    // pero la comprobación no se omite por eso: un acuse diferido o un reintento podrían llegar
    // tarde, y el fallo de Meta sería opaco.
    conversacion.exigirVentanaAbiertaParaTextoLibre(ahora);

    const phoneNumberId = await this.conversaciones.buscarNumeroDeSucursal(conversacion.sucursalId);
    if (!phoneNumberId) {
      throw new ConflictoDeNegocioError('SUCURSAL_SIN_NUMERO_DE_WHATSAPP', 'Esa sucursal no tiene número de WhatsApp dado de alta.', {
        sucursalId: conversacion.sucursalId,
      });
    }

    // Fuera de la transacción: un mensaje enviado no se deshace con un `ROLLBACK`.
    const { wamid } = await this.whatsapp.enviarTexto({
      phoneNumberId,
      telefonoDestino: conversacion.telefonoClienta,
      texto: input.texto,
    });

    // Ver la nota de la cabecera: un acuse no es una respuesta, así que no limpia el contador.
    if (input.esAcuse) conversacion.registrarNotificacionDeSistema(ahora);
    else conversacion.registrarRespuesta(ahora);

    await this.unitOfWork.ejecutar(async () => {
      await this.conversaciones.registrarMensaje({
        conversacionId: conversacion.id,
        wamid,
        direccion: 'saliente',
        emisor: 'bot',
        tipo: 'texto',
        contenido: input.texto,
        estadoEntrega: 'pendiente',
        ocurridoEn: ahora,
      });
      await this.conversaciones.guardar(conversacion);
    });

    return { wamid };
  }
}
