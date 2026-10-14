import { Inject, Injectable } from '@nestjs/common';
import { Cita, validarRangoHorario } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { SILLA_REPOSITORY, SillaRepository } from '../../domain/ports/silla.repository';
import { MotorDisponibilidad } from '../../domain/services/motor-disponibilidad';
import { RangoHorario } from '../../../../database/schema';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, DomainError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface AgendarCitaInput {
  sucursalId: string;
  servicioId: string;
  clientaId: string;
  rangoHorario: RangoHorario;
  /** Opcional: `undefined`/`null` = la clienta no eligió. La Encargada asignará al llegar. */
  manicuristaId?: string | null;
}

/**
 * Caso de uso — reservar una cita sobre una Silla Virtual (`DEC-031`).
 *
 * **El trabajo real es elegir la silla.** La clienta nunca elige silla ni sabe que existen: pide
 * un horario. Este caso de uso busca una silla activa de la sucursal que no tenga ya una cita
 * solapada y reserva ahí. Si la clienta pidió manicurista concreta, además la fija.
 *
 * SOBRE LA CARRERA ENTRE LA CONSULTA Y EL INSERT. La comprobación de disponibilidad en memoria es
 * **consultiva, no un invariante** (`DEC-035`): entre que se listan las sillas libres y se inserta,
 * otra reserva puede quedarse con una. Por eso **se recorren las candidatas**: si la base rechaza
 * una silla por solapamiento, se intenta la siguiente. Solo cuando se agotan todas se concluye que
 * de verdad no hay lugar. La autoridad final es siempre la restricción `EXCLUDE`, nunca esta
 * consulta.
 *
 * **Validaciones delegadas en `MotorDisponibilidad`** (`DEC-035`): horario de la sucursal, corte
 * de mediodía (`RN-AGE-10`), domingo cerrado (`RN-AGE-12`) y capacidad efectiva cruzando sillas
 * contra personal operativo.
 *
 * **Lo que sigue sin validarse, y no por olvido:** que el servicio exista y esté activo (exige un
 * puerto hacia Catálogo) y que la duración corresponda a la del servicio (`FL-COT-02`, pospuesto).
 */
@Injectable()
export class AgendarCitaUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(SILLA_REPOSITORY) private readonly sillaRepository: SillaRepository,
    private readonly motorDisponibilidad: MotorDisponibilidad,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: AgendarCitaInput, actor: ClaimsUsuario): Promise<Cita> {
    // ANTES de consultar la base: un rango invertido haría que PostgreSQL lanzara un error crudo
    // al construir el `tstzrange` de la consulta, en vez del error de dominio que corresponde.
    validarRangoHorario(input.rangoHorario);

    // Horario de la sucursal (`RN-AGE-10`/`RN-AGE-12`) y capacidad efectiva
    // `MIN(sillas, manicuristas)` (`DEC-035`). Antes de esto, el caso de uso repartía sillas sin
    // saber si había manos para atenderlas.
    await this.motorDisponibilidad.exigirDisponibilidad(input.sucursalId, input.rangoHorario);

    const candidatas = await this.sillasCandidatas(input);

    for (const sillaId of candidatas) {
      const cita = Cita.crear({ ...input, sillaId, manicuristaId: input.manicuristaId ?? null });

      try {
        await this.unitOfWork.ejecutar(async () => {
          await this.citaRepository.guardar(cita);

          await this.auditoria.registrar({
            tipoAccion: 'agendamiento',
            actor: actor.sub,
            sucursalRelacionada: cita.sucursalId,
            entidadAfectadaTipo: 'cita',
            entidadAfectadaId: cita.id,
            detalle: {
              accion: 'agendar_cita',
              sillaId: cita.sillaId,
              manicuristaId: cita.manicuristaId,
              inicio: cita.rangoHorario.inicio.toISOString(),
              fin: cita.rangoHorario.fin.toISOString(),
            },
          });
        });

        return cita;
      } catch (error) {
        // Que la manicurista esté ocupada NO se arregla cambiando de silla: es ella la que choca.
        // Reintentar en otra silla solo tiene sentido ante un conflicto de silla.
        if (!(error instanceof ConflictoDeNegocioError) || error.code !== 'SILLA_OCUPADA') throw error;
      }
    }

    throw new DomainError(
      'HORARIO_NO_DISPONIBLE',
      'No queda lugar en la sucursal para ese horario.',
      409,
      { sucursalId: input.sucursalId, inicio: input.rangoHorario.inicio.toISOString(), sillasIntentadas: candidatas.length },
    );
  }

  /** Sillas activas de la sucursal que, según la foto actual, no tienen cita solapada. */
  private async sillasCandidatas(input: AgendarCitaInput): Promise<string[]> {
    const sillas = (await this.sillaRepository.listarPorSucursal(input.sucursalId)).filter((silla) => silla.activa);

    if (sillas.length === 0) {
      throw new DomainError('SUCURSAL_SIN_SILLAS', 'La sucursal no tiene ninguna silla activa configurada.', 409, {
        sucursalId: input.sucursalId,
      });
    }

    const ocupadas = new Set(
      (await this.citaRepository.listarQueOcupanEnRango(input.sucursalId, input.rangoHorario)).map((cita) => cita.sillaId),
    );

    return sillas.map((silla) => silla.id).filter((id) => !ocupadas.has(id));
  }
}
