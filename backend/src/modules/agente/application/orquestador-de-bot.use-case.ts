import { Inject, Injectable, Logger } from '@nestjs/common';
import { OrquestadorDeBotPort, ResultadoDelTurno, TurnoDelBot } from '../../conversaciones/domain/ports/orquestador-de-bot.port';
import { EnviarMensajeDelBotUseCase } from '../../conversaciones/application/use-cases/enviar-mensaje-del-bot.use-case';
import { CambiarModoConversacionUseCase } from '../../conversaciones/application/use-cases/bandeja.use-cases';
import { AGENTE_CONVERSACIONAL_PORT, AgenteConversacionalPort } from '../domain/agente-conversacional.port';
import { PRESUPUESTO_DE_IA_PORT, type PresupuestoDeIaPort } from '../domain/presupuesto-de-ia.port';
import { AgenteDeterministicoAdapter } from '../infrastructure/llm/agente-deterministico.adapter';
import { CONFIANZA_MINIMA, Intencion } from '../domain/intencion';
import { detectarEscalamientoPorTexto, motivoDeEscalamientoDe, normalizarTexto } from '../domain/deteccion-de-escalamiento';
import { HerramientasDelBot } from './herramientas-del-bot';
import { MotivoDeEscalamiento } from '../../../database/schema';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario, Rol } from '../../../shared/auth/rol';

/** Respuestas fijas del bot. Texto corto y sin promesas que el sistema no pueda cumplir. */
export const RESPUESTAS = {
  saludo: 'Hola, con gusto te ayudo a agendar. ¿Qué servicio te interesa y para qué día?',
  derivandoAHumano: 'Claro, una encargada te atiende en breve por aquí.',
  sinServicios: 'Ahora mismo no tengo el catálogo disponible. Una encargada te ayuda en breve.',
  noEntendi: 'No estoy segura de haber entendido. Una encargada te atiende en breve.',
  citaConfirmada: '¡Listo! Tu cita queda confirmada. Te esperamos.',
} as const;

/**
 * Orquestador del Agente Conversacional (Bot IA) — cierre de Fase 4.
 *
 * ## LA FRONTERA: EL MODELO CLASIFICA, EL BACKEND DECIDE
 *
 * `RN-CONV-01` — *la IA interpreta, nunca decide*. Aquí eso se cumple por construcción, en tres
 * capas que conviene leer en orden:
 *
 * 1. **Filtro determinista por frases**, antes del modelo. Cancelar, pedir una persona y quejarse
 *    escalan sin consultar al LLM: equivocarse en esos tres es caro y no se delega a un
 *    clasificador probabilístico (`DEC-040`, `RN-ESC-01`).
 * 2. **El modelo solo devuelve una `Intencion`** — qué quiere la clienta, y como mucho qué fecha o
 *    servicio mencionó. Ese tipo no tiene dónde escribir un precio ni un horario, así que **no
 *    puede inventarlos**.
 * 3. **Los datos y las acciones salen de los casos de uso reales** (`HerramientasDelBot`): precios
 *    del Catálogo, disponibilidad del `MotorDisponibilidad`, clienta de CRM, cita de
 *    `AgendarCitaUseCase`. El bot redacta con lo que le devuelven, no con lo que cree.
 *
 * ## CERO INTERFERENCIA EN MODO `humano`
 *
 * Este orquestador **no comprueba el modo**: lo comprueba `RecibirMensajeUseCase` antes de
 * invocarlo, y si la conversación ya está en `humano` no llega aquí. `RN-ESC-02` exige revalidar
 * el modo antes de cada respuesta del bot, y el borde es el sitio correcto — poner la comprobación
 * dentro dejaría la puerta abierta a que cualquier otro llamante futuro se la salte.
 */
@Injectable()
export class OrquestadorDeBotUseCase implements OrquestadorDeBotPort {
  private readonly logger = new Logger(OrquestadorDeBotUseCase.name);

  /**
   * Intérprete de respaldo **sin coste por mensaje**, para cuando el presupuesto de IA se agota.
   *
   * Se instancia aquí y no se inyecta porque no es un punto de configuración: es *el que no
   * cuesta*. Inyectarlo por token permitiría sustituirlo por otro que sí cueste, que es justo lo
   * contrario de lo que este respaldo es.
   */
  private readonly interpreteSinCoste = new AgenteDeterministicoAdapter();

  constructor(
    @Inject(AGENTE_CONVERSACIONAL_PORT) private readonly agente: AgenteConversacionalPort,
    @Inject(PRESUPUESTO_DE_IA_PORT) private readonly presupuesto: PresupuestoDeIaPort,
    private readonly herramientas: HerramientasDelBot,
    private readonly enviarMensaje: EnviarMensajeDelBotUseCase,
    private readonly cambiarModo: CambiarModoConversacionUseCase,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
  ) {}

  async atenderTurno(turno: TurnoDelBot): Promise<ResultadoDelTurno> {
    if (turno.texto === null || turno.texto.trim().length === 0) {
      // Sin texto no hay nada que interpretar. Los medios no procesables los resuelve
      // `RecibirMensajeUseCase` antes de llegar aquí, con su acuse y su motivo propio.
      return { respondio: false, escalo: false };
    }

    // CAPA 1 — filtro determinista. Si acierta, el modelo no se invoca.
    const motivoPorTexto = detectarEscalamientoPorTexto(turno.texto);
    if (motivoPorTexto) {
      return this.escalar(turno, motivoPorTexto, { fuente: 'filtro_determinista' });
    }

    // CAPA 2 — el modelo clasifica. Nada más.
    const contexto = await this.herramientas.contextoDe(turno.conversacion);
    const turnoParaInterpretar = {
      texto: turno.texto,
      contexto: {
        tieneCitaPendienteDeConfirmar: contexto.citaPendienteDeConfirmar !== null,
        tieneOfertaDeHuecoAbierta: contexto.ofertaAbierta !== null,
      },
    };

    /**
     * **El cortacircuitos de gasto de IA (`F-07`).**
     *
     * Si el presupuesto diario está agotado, **el bot no deja de funcionar**: clasifica con el
     * intérprete determinista, que no tiene coste por mensaje y atiende saludos, precios y
     * disponibilidad. Solo escala lo que ese intérprete no reconoce.
     *
     * Es deliberado que NO sea *"escalar todo a humano"*: la propia review advirtió que esa
     * respuesta ingenua **agravaría `F-05`** —una escalada masiva que el personal no puede
     * absorber—. El tope degrada **la comprensión, no el servicio**.
     *
     * Y no es un camino nuevo que haya que probar aparte: es exactamente el mismo
     * comportamiento que el sistema ya tiene cuando no hay `OPENAI_API_KEY` (`ADR-026`).
     *
     * `intentarConsumir` consulta e incrementa en un solo acto, así que dos mensajes simultáneos
     * no pueden pasar los dos el último hueco del presupuesto.
     *
     * **Se carga al día de HOY, no a `turno.ocurridoEn`**, y la diferencia importa: `ocurridoEn` es
     * la marca de tiempo que manda Meta, y un reintento de un evento viejo traería una fecha
     * pasada. Cargarlo ahí **esquivaría el tope de hoy** — una ráfaga de reintentos antiguos
     * gastaría sin tocar el presupuesto vigente. El gasto se incurre ahora, así que se cuenta ahora.
     */
    const hayPresupuesto = await this.presupuesto.intentarConsumir();
    const interprete = hayPresupuesto ? this.agente : this.interpreteSinCoste;

    const intencion = await interprete.interpretar(turnoParaInterpretar);

    // `RN-CONV-05` — degradación a humano ante baja confianza.
    if (intencion.confianza < CONFIANZA_MINIMA) {
      return this.escalar(turno, 'baja_confianza_ia', { fuente: 'confianza', confianza: intencion.confianza, sinPresupuesto: !hayPresupuesto });
    }

    const motivoPorIntencion = motivoDeEscalamientoDe(intencion);
    if (motivoPorIntencion) {
      // `sinPresupuesto` entra en la auditoría: `RN-CONV-04` exige saber POR QUÉ el bot decidió
      // algo, y "lo clasificó el intérprete de respaldo porque el presupuesto estaba agotado" es
      // una respuesta distinta de "lo clasificó el modelo".
      return this.escalar(turno, motivoPorIntencion, { fuente: 'intencion', intencion: intencion.tipo, sinPresupuesto: !hayPresupuesto });
    }

    // CAPA 3 — los datos y las acciones salen del backend real.
    return this.ejecutar(turno, intencion, contexto);
  }

  private async ejecutar(
    turno: TurnoDelBot,
    intencion: Intencion,
    contexto: Awaited<ReturnType<HerramientasDelBot['contextoDe']>>,
  ): Promise<ResultadoDelTurno> {
    switch (intencion.tipo) {
      case 'saludo':
        return this.responder(turno, RESPUESTAS.saludo, intencion);

      case 'consultar_servicios': {
        // Precios del Catálogo, nunca del modelo.
        const texto = await this.herramientas.textoDeServicios();
        return this.responder(turno, texto ?? RESPUESTAS.sinServicios, intencion);
      }

      case 'consultar_disponibilidad': {
        const respuesta = await this.herramientas.textoDeDisponibilidad(turno.conversacion.sucursalId, intencion);
        if (respuesta.escalar) return this.escalar(turno, respuesta.escalar, { fuente: 'herramienta' });
        return this.responder(turno, respuesta.texto, intencion);
      }

      case 'agendar': {
        const respuesta = await this.herramientas.intentarAgendar(turno.conversacion, intencion);
        if (respuesta.escalar) {
          // Si la herramienta trajo texto, es información que la clienta necesita (p. ej. el monto
          // del anticipo de lista roja). No se audita el texto: `RN-AUD-01`.
          return this.escalar(turno, respuesta.escalar, { fuente: 'herramienta' }, respuesta.texto || undefined);
        }
        return this.responder(turno, respuesta.texto, intencion);
      }

      case 'confirmar_cita': {
        /**
         * Cierre del ciclo del recordatorio: `pendiente_confirmacion` → `confirmada`.
         *
         * Solo si hay una cita en ese estado. Un "sí" a secas sin cita pendiente no se interpreta
         * como confirmación de nada — eso sería adivinar, y la clienta podría estar respondiendo a
         * otra cosa.
         */
        if (!contexto.citaPendienteDeConfirmar) {
          return this.escalar(turno, 'fuera_de_alcance', { fuente: 'sin_cita_pendiente' });
        }
        await this.herramientas.confirmarCita(contexto.citaPendienteDeConfirmar);
        return this.responder(turno, RESPUESTAS.citaConfirmada, intencion);
      }

      case 'aceptar_oferta': {
        if (!contexto.ofertaAbierta) {
          return this.escalar(turno, 'fuera_de_alcance', { fuente: 'sin_oferta_abierta' });
        }
        const respuesta = await this.herramientas.aceptarOferta(contexto.ofertaAbierta);
        if (respuesta.escalar) return this.escalar(turno, respuesta.escalar, { fuente: 'herramienta' }, respuesta.texto || undefined);
        return this.responder(turno, respuesta.texto, intencion);
      }

      default:
        // Toda intención no contemplada escala en vez de improvisar. Es el lado seguro: una
        // respuesta inventada cuesta más que un escalamiento de más.
        return this.escalar(turno, 'fuera_de_alcance', { fuente: 'intencion_no_atendible', intencion: intencion.tipo });
    }
  }

  private async responder(turno: TurnoDelBot, texto: string, intencion: Intencion): Promise<ResultadoDelTurno> {
    await this.auditar(turno, 'bot_responde', { intencion: intencion.tipo, confianza: intencion.confianza });

    try {
      await this.enviarMensaje.ejecutar({ conversacionId: turno.conversacion.id, texto }, turno.ocurridoEn);
      return { respondio: true, escalo: false };
    } catch (error) {
      // Si el envío falla, **se escala**: la clienta escribió y no puede quedarse sin respuesta.
      this.logger.error(
        `El bot no pudo responder en la conversación ${turno.conversacion.id}; se escala a una persona.`,
        error instanceof Error ? error.stack : String(error),
      );
      return this.escalar(turno, 'fuera_de_alcance', { fuente: 'fallo_de_envio' });
    }
  }

  /**
   * Pasa la conversación a `humano` y, **si puede, avisa a la clienta**.
   *
   * El aviso va después del cambio de modo y su fallo no lo deshace: lo importante es que la
   * conversación quede marcada para que una persona la vea. Y no se envía cuando el escalamiento
   * es por bloqueo —ese caso no llega aquí— ni si la ventana está cerrada.
   *
   * ## `textoParaLaClienta`: ESCALAR NO SIEMPRE ES CALLARSE
   *
   * Por defecto se manda *"una encargada te atiende en breve"*, pero hay escalamientos que llevan
   * **información que la clienta necesita ya**. El caso real es la lista roja: la cita queda en
   * `en_espera_pago` y hay que decirle el monto del anticipo (`RN-ANT-01`). Si eso se tragara con
   * el mensaje genérico, la clienta esperaría una respuesta sin saber que depende de una
   * transferencia suya — y nadie sabría por qué su cita nunca se activó.
   *
   * Sigue siendo un acuse (`esAcuse: true`): informa, no atiende. El contador de escaladas
   * pendientes tiene que seguir contándola.
   */
  private async escalar(
    turno: TurnoDelBot,
    motivo: MotivoDeEscalamiento,
    detalle: Record<string, unknown>,
    textoParaLaClienta: string = RESPUESTAS.derivandoAHumano,
  ): Promise<ResultadoDelTurno> {
    await this.cambiarModo.escalar({ conversacionId: turno.conversacion.id, motivo }, this.actorDelSistema(), turno.ocurridoEn);
    await this.auditar(turno, 'bot_escala', { motivo, ...detalle });

    try {
      await this.enviarMensaje.ejecutar(
        // `esAcuse: true` — **crítico**. Este mensaje avisa de que viene una persona; no atiende
        // nada. Si limpiara `mensajes_sin_responder`, la conversación que acaba de escalar
        // desaparecería del contador de escaladas pendientes y nadie sabría que hay que atenderla.
        { conversacionId: turno.conversacion.id, texto: textoParaLaClienta, esAcuse: true },
        turno.ocurridoEn,
      );
    } catch (error) {
      this.logger.warn(
        `La conversación ${turno.conversacion.id} se escaló pero no se pudo avisar a la clienta: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return { respondio: false, escalo: true, motivo };
  }

  /**
   * `RN-CONV-04` — **trazabilidad de toda decisión de IA**.
   *
   * Se registra la intención, la confianza y la fuente de la decisión; **nunca el texto de la
   * clienta ni la respuesta** (`RN-AUD-01`: eso es PII y ya vive en el hilo). Lo que la auditoría
   * tiene que poder responder es *"por qué el bot hizo esto"*, y para eso basta la clasificación.
   */
  private async auditar(turno: TurnoDelBot, accion: string, detalle: Record<string, unknown>): Promise<void> {
    await this.auditoria.registrar({
      tipoAccion: 'conversacion',
      actor: 'sistema:bot-conversacional',
      sucursalRelacionada: turno.conversacion.sucursalId,
      entidadAfectadaTipo: 'conversacion',
      entidadAfectadaId: turno.conversacion.id,
      detalle: { accion, ...detalle },
    });
  }

  /** Mismo criterio que los demás actores de sistema (`DEC-044`, `ADR-025`). */
  private actorDelSistema(): ClaimsUsuario {
    return { sub: 'sistema:bot-conversacional', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL', manicuristaId: null };
  }
}

/** Reexportado para las pruebas: comprueban el filtro sin montar el orquestador. */
export { normalizarTexto };
