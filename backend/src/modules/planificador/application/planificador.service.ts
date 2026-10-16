import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CERROJOS, CerrojoDeBarrido } from '../../../shared/persistence/advisory-lock';
import {
  CerrarCitasTerminadasUseCase,
  ResumenDeBarrido,
  SolicitarRecordatoriosUseCase,
} from '../../agenda/application/use-cases/barridos-de-agenda.use-cases';
import { AvanzarTurnoListaEsperaUseCase } from '../../agenda/application/use-cases/lista-espera.use-cases';
import { BarridoDeAnticiposUseCase } from './barrido-de-anticipos.use-case';
import { PurgarMensajesUseCase } from '../../conversaciones/application/use-cases/purgar-mensajes.use-case';
import { ClaimsUsuario, Rol } from '../../../shared/auth/rol';

/** `true` salvo que se desactive explícitamente. Ver `estaActivo`. */
function planificadorActivo(): boolean {
  return process.env.PLANIFICADOR_ACTIVO !== 'false';
}

export type NombreDeBarrido = 'lista_espera' | 'anticipos' | 'cierre_de_citas' | 'recordatorios' | 'retencion_de_mensajes';

/**
 * Planificador operativo (`ADR-025`) — los **cinco** barridos temporales de la plataforma.
 *
 * El quinto, `retencion_de_mensajes`, se añadió al cerrar `ADR-029` y es el único **destructivo**:
 * borra contenido conversacional. Por eso su valor por defecto **no purga nada** y hay que
 * activarlo con `RETENCION_MENSAJES_DIAS` — ver `PurgarMensajesUseCase`.
 *
 * ## EL CRON NO CONTIENE LÓGICA
 *
 * Cada método `@Cron` hace tres cosas y ninguna más: pedir el cerrojo, llamar al caso de uso y
 * registrar el resumen. Toda la lógica vive en los casos de uso, que son invocables también por
 * HTTP (`/v1/planificador/barridos/:nombre`). Las consecuencias son el motivo del diseño:
 *
 * - **Se puede disparar a mano**, sin esperar al tick. Imprescindible mientras el canal de
 *   WhatsApp no exista y los avisos se den por teléfono.
 * - **Se prueba sin relojes**: las pruebas llaman al caso de uso con un `ahora` explícito.
 * - **Es sustituible**: mover esto a un worker o a un cron externo de Railway cambia quién llama,
 *   no qué se ejecuta.
 *
 * ## DESACTIVABLE
 *
 * `PLANIFICADOR_ACTIVO=false` apaga los ticks dejando los endpoints vivos. Hace falta para
 * **pruebas y desarrollo**: sin esto, un cron disparando barridos contra la base de pruebas
 * mientras una prueba de integración monta su escenario lo corrompería de forma intermitente — la
 * misma clase de intermitencia que esta fase acabó de erradicar del arnés, y no tiene ningún
 * sentido reintroducirla.
 *
 * ## HORARIOS
 *
 * Cada 5 minutos los tres barridos de reacción, y el de recordatorios cada hora. El de
 * recordatorios no necesita más: su ventana es de 24 horas, así que correr cada hora da 24
 * oportunidades a cada cita. Correrlo cada 5 minutos solo multiplicaría consultas vacías.
 */
@Injectable()
export class PlanificadorService {
  private readonly logger = new Logger(PlanificadorService.name);

  constructor(
    private readonly cerrojo: CerrojoDeBarrido,
    private readonly avanzarListaEspera: AvanzarTurnoListaEsperaUseCase,
    private readonly barridoDeAnticipos: BarridoDeAnticiposUseCase,
    private readonly cerrarCitas: CerrarCitasTerminadasUseCase,
    private readonly recordatorios: SolicitarRecordatoriosUseCase,
    private readonly purgarMensajes: PurgarMensajesUseCase,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'lista_espera' })
  async tickListaEspera(): Promise<void> {
    await this.tick('lista_espera', CERROJOS.avanceListaEspera);
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'anticipos' })
  async tickAnticipos(): Promise<void> {
    await this.tick('anticipos', CERROJOS.expiracionAnticipos);
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'cierre_de_citas' })
  async tickCierreDeCitas(): Promise<void> {
    await this.tick('cierre_de_citas', CERROJOS.cierreDeCitas);
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'recordatorios' })
  async tickRecordatorios(): Promise<void> {
    await this.tick('recordatorios', CERROJOS.recordatorios);
  }

  /**
   * Retención de contenido conversacional (`ADR-029`).
   *
   * Cada hora, y no cada 5 minutos, por dos razones: **sin `RETENCION_MENSAJES_DIAS` no borra
   * nada** —así que correrlo más seguido solo multiplicaría consultas vacías— y cuando sí borra lo
   * hace por lotes de 5.000, que a un lote por hora escalona la primera purga sin bloquear la
   * tabla que la Bandeja lee en caliente.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'retencion_de_mensajes' })
  async tickRetencionDeMensajes(): Promise<void> {
    await this.tick('retencion_de_mensajes', CERROJOS.retencionDeMensajes);
  }

  /**
   * Un tick: cerrojo, barrido, resumen. **Nunca propaga.**
   *
   * Si un `@Cron` lanzara, la excepción quedaría sin manejar en el temporizador de Node y podría
   * tumbar el proceso — es decir, un fallo al expirar un anticipo apagaría la API entera. El error
   * se registra y el siguiente tick vuelve a intentarlo.
   */
  private async tick(nombre: NombreDeBarrido, clave: number): Promise<void> {
    if (!planificadorActivo()) return;

    try {
      const resumen = await this.cerrojo.conCerrojo(clave, nombre, () => this.ejecutarBarrido(nombre, this.actorDelSistema()));
      // `null` = otra instancia lo tenía. No se registra como actividad: no hubo ninguna.
      if (resumen && (resumen.procesados > 0 || resumen.fallidos > 0)) {
        this.logger.log(`Barrido "${nombre}": ${resumen.procesados} procesados, ${resumen.fallidos} fallidos.`);
      }
    } catch (error) {
      this.logger.error(`Barrido "${nombre}" falló por completo.`, error instanceof Error ? error.stack : String(error));
    }
  }

  /** Despacha por nombre. Lo comparten el cron y el endpoint administrativo. */
  ejecutarBarrido(nombre: NombreDeBarrido, actor: ClaimsUsuario, ahora = new Date()): Promise<ResumenDeBarrido> {
    switch (nombre) {
      case 'lista_espera':
        return this.avanzarListaEspera
          .ejecutar({}, actor, ahora)
          .then((r) => ({ procesados: r.expiradas.length, fallidos: 0, idsFallidos: [] }));
      case 'anticipos':
        return this.barridoDeAnticipos.ejecutar(actor, ahora);
      case 'cierre_de_citas':
        return this.cerrarCitas.ejecutar(actor, ahora);
      case 'recordatorios':
        return this.recordatorios.ejecutar(actor, ahora);
      case 'retencion_de_mensajes':
        // `procesados` = mensajes purgados. Encaja en `ResumenDeBarrido` sin inventar otra forma,
        // y `fallidos` es 0 porque un `DELETE` acotado o borra o lanza: no hay fallo por elemento.
        return this.purgarMensajes.ejecutar(ahora).then((r) => ({ procesados: r.mensajesPurgados, fallidos: 0, idsFallidos: [] }));
    }
  }

  /**
   * Actor de auditoría cuando el barrido lo dispara el reloj y no una persona.
   *
   * Mismo criterio que `RegistroDeIncidentesAdapter`, `AnticipoAdapter` y `DEC-044` con el
   * principal del Bot: *"lo cerró el barrido automático"* es una respuesta más honesta en la
   * auditoría que atribuirlo a una Encargada que no estaba delante. `RN-AUD-01` exige saber quién
   * hizo qué, y un actor de sistema es un actor distinto de una persona.
   */
  private actorDelSistema(): ClaimsUsuario {
    return { sub: 'sistema:planificador', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL', manicuristaId: null };
  }

  /** Para el endpoint: informa si los ticks están activos sin exponer la variable de entorno. */
  get estaActivo(): boolean {
    return planificadorActivo();
  }
}
