import { Inject, Injectable } from '@nestjs/common';
import { Cita, validarRangoHorario } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { SILLA_REPOSITORY, SillaRepository } from '../../domain/ports/silla.repository';
import { MotorDisponibilidad } from '../../domain/services/motor-disponibilidad';
import { ResolutorDeServicio } from '../../domain/services/resolutor-de-servicio';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { ClaimsUsuario } from '../../../../shared/auth/rol';

/**
 * Ventana de cobertura en días (`RN-GAR-01`).
 *
 * **Parametrizable por entorno**, con 7 por defecto porque es el valor que la regla fija y que la
 * Dueña aprobó. `RN-GAR-06` establece que no varía por sucursal, así que es una constante global y
 * no una columna de `sucursales` — meterla en la tabla invitaría a divergencias que la regla
 * prohíbe.
 */
export function diasDeGarantia(): number {
  const crudo = process.env.DIAS_DE_GARANTIA;
  if (crudo === undefined || crudo.trim() === '') return 7;

  const dias = Number(crudo);
  // Un valor inválido cae al de la regla, no a `NaN`: un typo no debe ampliar la cobertura a
  // cualquier fecha ni cerrarla del todo.
  return Number.isInteger(dias) && dias > 0 ? dias : 7;
}

export interface AgendarGarantiaInput {
  /** La cita `completada` que se honra. De ella salen la clienta, el servicio y la sucursal. */
  citaGarantizadaId: string;
  /** Cuándo se atiende la reposición. */
  inicio: Date;
  manicuristaId?: string | null;
  /** Qué reportó la clienta. Va a la auditoría: es el rastro de por qué se concedió. */
  motivo?: string;
}

/**
 * Agenda la **reposición de un servicio bajo garantía** — cierre de `P10`.
 *
 * ## CÓMO SE RECONCILIA ESTO CON `RN-GAR-03` Y `RN-GAR-04`
 *
 * Las dos reglas parecen chocar con «agendar una garantía gratis»:
 *
 * - **`RN-GAR-03`: ninguna garantía se aprueba automáticamente.** Se cumple porque **el sistema
 *   nunca crea una garantía por su cuenta**: este caso de uso solo lo invoca una persona
 *   autorizada desde el panel, y el bot **no puede** — un mensaje con la palabra *garantía*
 *   dispara un gatillo crítico y escala a `humano` sin tocar nada. **El acto de crearla ES la
 *   aprobación humana** que la regla exige; no hay un estado `en_revision` intermedio porque no
 *   hay nada que un proceso automático pudiera resolver mientras tanto.
 * - **`RN-GAR-04`: no hay beneficio fijo; lo decide la Dueña caso por caso.** Se cumple porque el
 *   sistema **no calcula ni sugiere** nada: una persona decide que el beneficio es *reposición del
 *   servicio* y esto lo registra. Los otros beneficios posibles —descuento, producto— **siguen
 *   fuera del sistema**, igual que antes. Lo que esto añade es la capacidad de registrar **uno** de
 *   ellos, el único que ocupa un hueco en la agenda y por tanto necesita existir como cita.
 *
 * ## QUÉ VALIDA, Y QUÉ NO
 *
 * Valida lo que es verificable: que la cita exista, esté `completada` (`RN-GAR-02`) y esté dentro
 * de la ventana (`RN-GAR-01`); que no se haya honrado ya; y que haya hueco real. **No valida si el
 * reclamo es legítimo** — eso es el juicio humano que `RN-GAR-03` reserva a una persona.
 */
@Injectable()
export class AgendarGarantiaUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(SILLA_REPOSITORY) private readonly sillaRepository: SillaRepository,
    private readonly motorDisponibilidad: MotorDisponibilidad,
    private readonly resolutorDeServicio: ResolutorDeServicio,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: AgendarGarantiaInput, actor: ClaimsUsuario, ahora = new Date()): Promise<Cita> {
    const original = await this.citaRepository.buscarPorId(input.citaGarantizadaId);
    if (!original) throw new RecursoNoEncontradoError('Cita', input.citaGarantizadaId);

    /**
     * `RN-GAR-02` — **solo sobre un servicio efectivamente realizado.**
     *
     * Se comprueba antes que la ventana porque es categórico: una cita cancelada o `no_show` no
     * tiene garantía por mucho que sea de ayer, y el mensaje tiene que decir eso y no *"se te pasó
     * el plazo"*, que haría pensar a la clienta que llegó tarde cuando el problema es otro.
     */
    if (original.estado !== 'completada') {
      throw new ConflictoDeNegocioError(
        'GARANTIA_SOBRE_CITA_NO_COMPLETADA',
        `La garantía solo aplica a un servicio que se realizó. Esta cita está en estado "${original.estado}".`,
        { citaGarantizadaId: original.id, estado: original.estado },
      );
    }

    // Una garantía no puede garantizarse a su vez: sería una cadena indefinida de reposiciones
    // gratuitas sin que nadie volviera a decidir nada.
    if (original.esGarantia) {
      throw new ConflictoDeNegocioError(
        'GARANTIA_SOBRE_UNA_GARANTIA',
        'Esa cita ya era una garantía. Si el problema persiste, el caso lo tiene que revisar la Dueña.',
        { citaGarantizadaId: original.id },
      );
    }

    /** `RN-GAR-01` — la ventana se cuenta desde el **fin del servicio**, que es cuando se entregó. */
    const dias = diasDeGarantia();
    const vence = new Date(original.rangoHorario.fin.getTime() + dias * 86_400_000);
    if (ahora.getTime() > vence.getTime()) {
      const diasTranscurridos = Math.floor((ahora.getTime() - original.rangoHorario.fin.getTime()) / 86_400_000);
      throw new ConflictoDeNegocioError(
        'GARANTIA_VENCIDA',
        `La garantía cubre ${dias} días desde el servicio, y han pasado ${diasTranscurridos}. Si se va a hacer una excepción, la decide la Dueña y la cita se agenda normal.`,
        { diasDeCobertura: dias, diasTranscurridos, venceEn: vence.toISOString() },
      );
    }

    // Una cita completada se honra una sola vez. La base lo impone además con un índice único
    // parcial: dos personas atendiendo a la vez podrían crear dos reposiciones del mismo servicio.
    if (await this.citaRepository.existeGarantiaDe(original.id)) {
      throw new ConflictoDeNegocioError(
        'GARANTIA_YA_OTORGADA',
        'Ese servicio ya tiene una cita de garantía agendada.',
        { citaGarantizadaId: original.id },
      );
    }

    /**
     * El servicio se toma **de la cita original**, no de la petición.
     *
     * Una garantía repone *lo que se hizo mal*: dejar elegir el servicio permitiría cambiar un
     * retiro de $150 por un acrílico de $800 y cobrarlo como garantía. Se revalida contra el
     * catálogo porque su duración define el rango, y si el servicio se dio de baja entretanto, la
     * reposición sigue siendo legítima — igual que al reprogramar (Fase 2 Parte 7).
     */
    const servicio = await this.resolutorDeServicio.resolverParaMoverCita(original.servicioId);
    const rangoHorario = this.resolutorDeServicio.derivarRango(input.inicio, undefined, servicio);
    validarRangoHorario(rangoHorario);

    await this.motorDisponibilidad.exigirDisponibilidad(original.sucursalId, rangoHorario);

    /**
     * **Costo cero, y `0` no es `null`.**
     *
     * `totalCentavos: null` significa *"nadie lo ha cotizado"* (`DEC-033`); `0` significa *"es
     * gratis"*. La diferencia importa en Analítica: una garantía **no debe contar como ingreso
     * perdido ni como servicio sin cotizar**, y con `0` entra en la suma sin alterarla.
     */
    const snapshot = {
      ...this.resolutorDeServicio.construirSnapshot(servicio, ahora),
      totalCentavos: 0,
      esGarantia: true,
    };

    const candidatas = await this.sillasCandidatas(original.sucursalId, rangoHorario);

    for (const sillaId of candidatas) {
      const cita = Cita.crear({
        sucursalId: original.sucursalId,
        servicioId: original.servicioId,
        clientaId: original.clientaId,
        rangoHorario,
        sillaId,
        manicuristaId: input.manicuristaId ?? null,
        cotizacionSnapshot: snapshot,
        /**
         * Nace `agendada`, **nunca `en_espera_pago`**, y no es una excepción a `RN-ANT-01`.
         *
         * El anticipo es el 40 % del servicio, y el servicio cuesta `0`: no hay nada que anticipar.
         * Pedirle un adelanto a una clienta para que le arreglen gratis un trabajo mal hecho sería
         * absurdo además de inútil.
         */
        esGarantia: true,
        citaGarantizadaId: original.id,
      });

      try {
        await this.unitOfWork.ejecutar(async () => {
          await this.citaRepository.guardar(cita);
          await this.auditoria.registrar({
            tipoAccion: 'agenda',
            actor: actor.sub,
            sucursalRelacionada: cita.sucursalId,
            entidadAfectadaTipo: 'cita',
            entidadAfectadaId: cita.id,
            // El motivo que reportó la clienta queda aquí: es el rastro de **por qué** se concedió
            // la garantía, que es la decisión humana que `RN-GAR-03` exige. Sin PII de la clienta
            // (`RN-AUD-01`): solo el texto del reclamo que quien atiende escribió.
            detalle: {
              accion: 'agendar_garantia',
              citaGarantizadaId: original.id,
              diasDesdeElServicio: Math.floor((ahora.getTime() - original.rangoHorario.fin.getTime()) / 86_400_000),
              motivoReportado: input.motivo ?? null,
            },
          });
        });

        return cita;
      } catch (error) {
        // Misma estrategia que `AgendarCitaUseCase`: si la silla se ocupó entre la consulta y la
        // escritura, se prueba la siguiente. La autoridad es la restricción `EXCLUDE`.
        if (!esChoqueDeSilla(error)) throw error;
      }
    }

    throw new ConflictoDeNegocioError(
      'SILLA_OCUPADA',
      'No queda ninguna silla libre a esa hora para la garantía.',
      { sucursalId: original.sucursalId },
    );
  }

  /** Mismo criterio que `AgendarCitaUseCase`: activas, en orden estable. */
  private async sillasCandidatas(sucursalId: string, rangoHorario: { inicio: Date; fin: Date }): Promise<string[]> {
    const sillas = await this.sillaRepository.listarPorSucursal(sucursalId);
    const activas = sillas.filter((silla) => silla.activa);
    void rangoHorario;
    return activas.map((silla) => silla.id);
  }
}

/** `23P01` es la violación de la restricción `EXCLUDE`: la silla se ocupó en la carrera. */
function esChoqueDeSilla(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23P01';
}
