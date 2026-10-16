import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificadorRecordatorioPort } from '../agenda/domain/ports/notificador-recordatorio.port';
import { HuecoOfrecido, NotificacionListaEsperaPort } from '../agenda/domain/ports/notificacion-lista-espera.port';
import { Cita } from '../agenda/domain/entities/cita.entity';
import { SolicitudListaEspera } from '../agenda/domain/entities/solicitud-lista-espera.entity';
import { CONVERSACION_REPOSITORY, ConversacionRepository } from '../conversaciones/domain/ports/conversacion.repository';
import { EnviarPlantillaUseCase } from '../conversaciones/application/use-cases/bandeja.use-cases';
import { CLIENTA_REPOSITORY, ClientaRepository } from '../crm-y-clientas/domain/ports/clienta.repository';
import { Conversacion } from '../conversaciones/domain/entities/conversacion.entity';
// Única fuente de verdad del catálogo: ver la nota de `plantillas.ts`. La copia que vivía aquí se
// eliminó al aparecer el segundo consumidor (el selector del panel web).
import { PLANTILLAS } from '../conversaciones/domain/plantillas';
import { ClaimsUsuario, Rol } from '../../shared/auth/rol';
import { fechaLocal, ZONA_HORARIA_NEGOCIO } from '../../shared/tiempo/zona-horaria-negocio';


/**
 * Lleva las notificaciones de Agenda al canal de WhatsApp (`DEC-043`).
 *
 * ## POR QUÉ SIEMPRE PLANTILLA Y NUNCA TEXTO LIBRE
 *
 * Las dos notificaciones las dispara **el planificador**, no una conversación en curso: un
 * recordatorio sale 24 horas antes de la cita y una oferta de hueco cuando alguien cancela. En
 * ninguno de los dos casos hay forma de saber si la clienta escribió en las últimas 24 horas, y lo
 * normal es que no — así que la ventana de Meta estará **cerrada** (`N-14`) y el texto libre se
 * rechazaría. La plantilla es la única vía que funciona siempre.
 *
 * ## NO ESCALA LA CONVERSACIÓN A `humano`
 *
 * `comoHumano: false`. Si un recordatorio escalara, cada noche el barrido dejaría media agenda en
 * modo `humano` y la Encargada encontraría cien conversaciones "tomadas" que nadie tomó — y el bot
 * no podría contestar a quien respondiera al recordatorio, que es justo lo que se quiere que haga.
 *
 * ## NUNCA PROPAGA
 *
 * El fallo de un envío **no deshace** la operación que lo originó. La cita ya está en
 * `pendiente_confirmacion` y la oferta ya tiene su ventana corriendo: si el aviso no sale, es
 * trabajo manual para la Encargada, no motivo para revertir. Y es la misma razón por la que el
 * envío va fuera de la transacción.
 */
@Injectable()
export class NotificacionesWhatsAppAdapter implements NotificadorRecordatorioPort, NotificacionListaEsperaPort {
  private readonly logger = new Logger(NotificacionesWhatsAppAdapter.name);

  constructor(
    @Inject(CONVERSACION_REPOSITORY) private readonly conversaciones: ConversacionRepository,
    @Inject(CLIENTA_REPOSITORY) private readonly clientas: ClientaRepository,
    private readonly enviarPlantilla: EnviarPlantillaUseCase,
  ) {}

  async recordatorioDeCita(cita: Cita): Promise<void> {
    await this.enviar(cita.sucursalId, cita.clientaId, PLANTILLAS.recordatorioDeCita, [
      this.horaLocal(cita.rangoHorario.inicio),
    ], `recordatorio de la cita ${cita.id}`);
  }

  async ofertaDeHueco(solicitud: SolicitudListaEspera, hueco: HuecoOfrecido): Promise<void> {
    await this.enviar(
      solicitud.sucursalId,
      solicitud.clientaId,
      PLANTILLAS.ofertaDeHueco,
      [fechaLocal(hueco.inicio), this.horaLocal(hueco.inicio)],
      `oferta de hueco de la solicitud ${solicitud.id}`,
    );
  }

  /**
   * Resuelve la conversación de esa clienta en esa sucursal y manda la plantilla.
   *
   * **Si no hay conversación, no se envía nada.** La Cloud API exige un número de destino y el de
   * la clienta vive en CRM, así que se busca por ahí; pero sin una conversación previa no hay hilo
   * donde registrar el mensaje, y registrar un saliente huérfano dejaría el historial inconsistente.
   * El caso real es una clienta dada de alta por teléfono que nunca ha escrito por WhatsApp: hay
   * que avisarle a mano, y el log lo dice.
   */
  private async enviar(
    sucursalId: string,
    clientaId: string,
    plantilla: string,
    parametros: string[],
    descripcion: string,
  ): Promise<void> {
    try {
      const conversacion = await this.conversacionDe(sucursalId, clientaId);
      if (!conversacion) {
        this.logger.warn(
          `Sin conversación de WhatsApp para la clienta ${clientaId} en la sucursal ${sucursalId}: ` +
            `${descripcion} no se envía. Avisar a mano.`,
        );
        return;
      }

      await this.enviarPlantilla.ejecutar(
        { conversacionId: conversacion.id, plantilla, parametros, comoHumano: false },
        this.actorDelSistema(),
      );
    } catch (error) {
      // Nunca propaga: ver la nota de la cabecera.
      this.logger.error(
        `No se pudo enviar ${descripcion} por WhatsApp. La operación de agenda SÍ se completó.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async conversacionDe(sucursalId: string, clientaId: string): Promise<Conversacion | null> {
    const clienta = await this.clientas.buscarPorId(clientaId);
    if (!clienta) return null;

    return this.conversaciones.buscarPorSucursalYTelefono(sucursalId, clienta.telefono);
  }

  /** Hora de pared del negocio (`America/Mexico_City`), no UTC: es lo que va a leer la clienta. */
  private horaLocal(instante: Date): string {
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: ZONA_HORARIA_NEGOCIO,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(instante);
  }

  /** Mismo criterio que el resto de adaptadores de sistema: ver `DEC-044` y `ADR-025`. */
  private actorDelSistema(): ClaimsUsuario {
    return { sub: 'sistema:notificaciones-whatsapp', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL', manicuristaId: null };
  }
}
