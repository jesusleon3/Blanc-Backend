import { Inject, Injectable } from '@nestjs/common';
import { Cita, validarRangoHorario } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { SILLA_REPOSITORY, SillaRepository } from '../../domain/ports/silla.repository';
import { RangoHorario } from '../../../../database/schema';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, DomainError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

/** Tope de reprogramaciones por cadena (`DEC-042`). */
export const MAXIMO_DE_REPROGRAMACIONES = 3;
/** `RN-ANT-04`: con anticipo pagado, reagendar exige al menos 48 horas de antelación. */
export const HORAS_MINIMAS_CON_ANTICIPO = 48;

export interface ReprogramarCitaInput {
  citaId: string;
  nuevoRangoHorario: RangoHorario;
  /** Mantener a la misma manicurista, o `null`/omitir para dejarla sin asignar otra vez. */
  manicuristaId?: string | null;
  /**
   * ¿Esta cita tenía un anticipo ya pagado? Lo decide `RN-ANT-04`, pero **el Bounded Context de
   * Anticipos no existe todavía** (Fase 3), así que de momento lo aporta quien llama. Cuando ese
   * contexto exista, debe consultarse por un puerto y este parámetro desaparecer.
   */
  anticipoPagado?: boolean;
}

/**
 * Caso de uso — reprogramar: la cita original muere como `reprogramada` y **nace una nueva**,
 * enlazada por `citaOrigenId`.
 *
 * POR QUÉ DOS FILAS Y NO UN `UPDATE` DEL HORARIO. La cadena de reprogramaciones es un dato de
 * negocio: `DEC-042` fija un tope de 3, y `RN-CRM-06` quiere detectar a quien reagenda mucho. Si
 * se moviera el horario sobre la misma fila, esa historia se perdería. Además, la cita vieja debe
 * **liberar su hueco** mientras la nueva ocupa el suyo — dos estados a la vez que una sola fila no
 * puede representar.
 *
 * **Todo ocurre en una transacción:** si la nueva cita no cabe, la original **no** queda marcada
 * como reprogramada. De lo contrario la clienta se quedaría sin ninguna de las dos.
 */
@Injectable()
export class ReprogramarCitaUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(SILLA_REPOSITORY) private readonly sillaRepository: SillaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: ReprogramarCitaInput, actor: ClaimsUsuario, ahora = new Date()): Promise<{ original: Cita; nueva: Cita }> {
    validarRangoHorario(input.nuevoRangoHorario);

    const original = await this.citaRepository.buscarPorId(input.citaId);
    if (!original) throw new RecursoNoEncontradoError('Cita', input.citaId);

    this.validarReglas(original, input, ahora);

    const sillaId = await this.elegirSillaLibre(original.sucursalId, input.nuevoRangoHorario, original.id);

    const nueva = Cita.crear({
      sucursalId: original.sucursalId,
      sillaId,
      clientaId: original.clientaId,
      servicioId: original.servicioId,
      rangoHorario: input.nuevoRangoHorario,
      manicuristaId: input.manicuristaId ?? null,
      citaOrigenId: original.id,
      numeroDeReprogramaciones: original.numeroDeReprogramaciones + 1,
    });

    original.cambiarEstado('reprogramada');

    await this.unitOfWork.ejecutar(async () => {
      // Primero la original: libera su hueco, de modo que la nueva pueda ocupar ESE MISMO horario
      // si la clienta solo movió la manicurista. Al revés chocarían consigo mismas.
      await this.citaRepository.guardar(original);
      await this.citaRepository.guardar(nueva);

      await this.auditoria.registrar({
        tipoAccion: 'agendamiento',
        actor: actor.sub,
        sucursalRelacionada: original.sucursalId,
        entidadAfectadaTipo: 'cita',
        entidadAfectadaId: original.id,
        detalle: {
          accion: 'reprogramar_cita',
          citaNueva: nueva.id,
          numeroDeReprogramaciones: nueva.numeroDeReprogramaciones,
          inicioAnterior: original.rangoHorario.inicio.toISOString(),
          inicioNuevo: nueva.rangoHorario.inicio.toISOString(),
        },
      });
    });

    return { original, nueva };
  }

  private validarReglas(original: Cita, input: ReprogramarCitaInput, ahora: Date): void {
    if (original.numeroDeReprogramaciones >= MAXIMO_DE_REPROGRAMACIONES) {
      throw new ConflictoDeNegocioError(
        'MAXIMO_DE_REPROGRAMACIONES_ALCANZADO',
        `Esta cita ya se reprogramó ${MAXIMO_DE_REPROGRAMACIONES} veces; no se puede volver a mover.`,
        { citaId: original.id, numeroDeReprogramaciones: original.numeroDeReprogramaciones },
      );
    }

    if (input.anticipoPagado) {
      const horasDeAntelacion = (original.rangoHorario.inicio.getTime() - ahora.getTime()) / 3_600_000;
      if (horasDeAntelacion < HORAS_MINIMAS_CON_ANTICIPO) {
        throw new ConflictoDeNegocioError(
          'REPROGRAMACION_FUERA_DE_PLAZO',
          `Con anticipo pagado, reagendar exige al menos ${HORAS_MINIMAS_CON_ANTICIPO} horas de antelación.`,
          { citaId: original.id, horasDeAntelacion: Math.round(horasDeAntelacion) },
        );
      }
    }
  }

  /**
   * Misma mecánica que `AgendarCitaUseCase`: la silla la elige el sistema, no la clienta.
   *
   * **La cita original se excluye del cálculo** porque está a punto de liberar su hueco. Sin esa
   * exclusión, mover una cita dentro del mismo horario —por ejemplo para cambiarle la manicurista—
   * fallaría consigo misma, y en una sucursal de una sola silla sería imposible reprogramar nada.
   */
  private async elegirSillaLibre(sucursalId: string, rango: RangoHorario, idAExcluir: string): Promise<string> {
    const activas = (await this.sillaRepository.listarPorSucursal(sucursalId)).filter((silla) => silla.activa);
    const ocupadas = new Set(
      (await this.citaRepository.listarQueOcupanEnRango(sucursalId, rango)).filter((cita) => cita.id !== idAExcluir).map((cita) => cita.sillaId),
    );

    const libre = activas.find((silla) => !ocupadas.has(silla.id));
    if (!libre) {
      throw new DomainError('HORARIO_NO_DISPONIBLE', 'No queda lugar en la sucursal para el nuevo horario.', 409, {
        sucursalId,
        inicio: rango.inicio.toISOString(),
      });
    }
    return libre.id;
  }
}
