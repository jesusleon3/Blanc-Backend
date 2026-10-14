import { Inject, Injectable } from '@nestjs/common';
import { Cita, validarRangoHorario } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { SILLA_REPOSITORY, SillaRepository } from '../../domain/ports/silla.repository';
import { MotorDisponibilidad } from '../../domain/services/motor-disponibilidad';
import { ResolutorDeServicio } from '../../domain/services/resolutor-de-servicio';
import { VERIFICAR_CLIENTA_PORT, VerificarClientaPort } from '../../domain/ports/verificar-clienta.port';
import { RangoHorario } from '../../../../database/schema';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, DomainError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface AgendarCitaInput {
  sucursalId: string;
  servicioId: string;
  clientaId: string;
  /**
   * Instante de inicio. **El fin ya no lo decide quien llama**: se deriva de la duración del
   * servicio en el catálogo. `fin` solo se acepta para poder rechazarlo si no coincide.
   */
  inicio: Date;
  /** Opcional. Si llega, tiene que coincidir con `inicio + duración del catálogo`. */
  fin?: Date;
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
 * **Integridad referencial que la base de datos no puede dar** (`ADR-005` prohíbe las FK entre
 * esquemas): el servicio se valida contra Catálogo por puerto, y la clienta contra CRM — este
 * último con un adaptador provisional que **todavía no valida nada**, ver `VerificarClientaPort`.
 *
 * **La duración la manda el catálogo.** Quien llama ya no elige cuánto dura la cita; solo cuándo
 * empieza. Antes se podía reservar una hora para un servicio de dos y la silla quedaba libre a
 * mitad del trabajo, lista para venderse otra vez.
 */
@Injectable()
export class AgendarCitaUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(SILLA_REPOSITORY) private readonly sillaRepository: SillaRepository,
    private readonly motorDisponibilidad: MotorDisponibilidad,
    private readonly resolutorDeServicio: ResolutorDeServicio,
    @Inject(VERIFICAR_CLIENTA_PORT) private readonly clientas: VerificarClientaPort,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: AgendarCitaInput, actor: ClaimsUsuario): Promise<Cita> {
    // El catálogo primero: si el servicio no existe o está de baja, nada de lo demás importa, y
    // además su duración es la que define el rango que se va a consultar.
    const servicio = await this.resolutorDeServicio.resolver(input.servicioId);
    const rangoHorario = this.resolutorDeServicio.derivarRango(input.inicio, input.fin, servicio);

    if (!(await this.clientas.existe(input.clientaId))) {
      throw new RecursoNoEncontradoError('Clienta', input.clientaId);
    }

    // ANTES de consultar la base: un rango invertido haría que PostgreSQL lanzara un error crudo
    // al construir el `tstzrange` de la consulta, en vez del error de dominio que corresponde.
    validarRangoHorario(rangoHorario);

    // Horario de la sucursal (`RN-AGE-10`/`RN-AGE-12`) y capacidad efectiva
    // `MIN(sillas, manicuristas)` (`DEC-035`). Antes de esto, el caso de uso repartía sillas sin
    // saber si había manos para atenderlas.
    await this.motorDisponibilidad.exigirDisponibilidad(input.sucursalId, rangoHorario);

    const candidatas = await this.sillasCandidatas(input.sucursalId, rangoHorario);
    // Se congela una sola vez, fuera del bucle: reintentar en otra silla no recotiza nada.
    const cotizacionSnapshot = this.resolutorDeServicio.construirSnapshot(servicio);

    for (const sillaId of candidatas) {
      const cita = Cita.crear({
        sucursalId: input.sucursalId,
        servicioId: input.servicioId,
        clientaId: input.clientaId,
        rangoHorario,
        sillaId,
        manicuristaId: input.manicuristaId ?? null,
        cotizacionSnapshot,
      });

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
      { sucursalId: input.sucursalId, inicio: rangoHorario.inicio.toISOString(), sillasIntentadas: candidatas.length },
    );
  }

  /** Sillas activas de la sucursal que, según la foto actual, no tienen cita solapada. */
  private async sillasCandidatas(sucursalId: string, rangoHorario: RangoHorario): Promise<string[]> {
    const sillas = (await this.sillaRepository.listarPorSucursal(sucursalId)).filter((silla) => silla.activa);

    if (sillas.length === 0) {
      throw new DomainError('SUCURSAL_SIN_SILLAS', 'La sucursal no tiene ninguna silla activa configurada.', 409, {
        sucursalId,
      });
    }

    const ocupadas = new Set(
      (await this.citaRepository.listarQueOcupanEnRango(sucursalId, rangoHorario)).map((cita) => cita.sillaId),
    );

    return sillas.map((silla) => silla.id).filter((id) => !ocupadas.has(id));
  }
}
