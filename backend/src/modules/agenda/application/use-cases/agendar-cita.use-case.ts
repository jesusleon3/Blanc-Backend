import { Inject, Injectable } from '@nestjs/common';
import { Cita, validarRangoHorario } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { MotorDisponibilidad } from '../../domain/services/motor-disponibilidad';
import { SelectorDeSillaLibre, esSillaOcupada } from '../../domain/services/selector-de-silla';
import { ResolutorDeServicio } from '../../domain/services/resolutor-de-servicio';
import { CONTEXTO_CLIENTA_PORT, ContextoClientaPort } from '../../domain/ports/contexto-clienta.port';
import { ANTICIPO_PORT, AnticipoPort } from '../../domain/ports/anticipo.port';
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
 * esquemas): el servicio se valida contra Catálogo por puerto y la clienta contra CRM, los dos
 * con adaptadores reales desde la Parte 1 de Fase 3.
 *
 * **El estado de la clienta decide en qué estado nace la cita** (`RN-CRM-04`, `RN-ANT-01`):
 * bloqueada no agenda, lista roja nace en `en_espera_pago`, normal nace `agendada`.
 *
 * **La duración la manda el catálogo.** Quien llama ya no elige cuánto dura la cita; solo cuándo
 * empieza. Antes se podía reservar una hora para un servicio de dos y la silla quedaba libre a
 * mitad del trabajo, lista para venderse otra vez.
 */
@Injectable()
export class AgendarCitaUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    private readonly motorDisponibilidad: MotorDisponibilidad,
    private readonly selectorDeSilla: SelectorDeSillaLibre,
    private readonly resolutorDeServicio: ResolutorDeServicio,
    @Inject(CONTEXTO_CLIENTA_PORT) private readonly clientas: ContextoClientaPort,
    @Inject(ANTICIPO_PORT) private readonly anticipos: AnticipoPort,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: AgendarCitaInput, actor: ClaimsUsuario): Promise<Cita> {
    // El catálogo primero: si el servicio no existe o está de baja, nada de lo demás importa, y
    // además su duración es la que define el rango que se va a consultar.
    const servicio = await this.resolutorDeServicio.resolver(input.servicioId);
    const rangoHorario = this.resolutorDeServicio.derivarRango(input.inicio, input.fin, servicio);

    const clienta = await this.clientas.obtener(input.clientaId);
    if (!clienta) throw new RecursoNoEncontradoError('Clienta', input.clientaId);

    // `RN-CRM-04`: no agenda en absoluto hasta un desbloqueo explícito. Se corta con 409 y no con
    // 403 porque no es un problema de permisos de quien opera, sino del estado de la clienta — y
    // el mensaje tiene que llevar a escalar el caso a una persona, no a buscar otro horario.
    if (clienta.estadoDeRiesgo === 'bloqueada') {
      throw new ConflictoDeNegocioError(
        'CLIENTA_BLOQUEADA',
        'Esta clienta está bloqueada y no puede agendar; el caso tiene que revisarlo una persona.',
        { clientaId: input.clientaId },
      );
    }

    /**
     * `RN-ANT-01` + `RN-CRM-03`: la clienta en lista roja **sí puede agendar**, pero su cita nace
     * pendiente de anticipo.
     *
     * Y `en_espera_pago` **NO retiene el horario** (`RN-ANT-03`, corregido en la migración `0007`
     * frente a lo que `DEC-034` había supuesto): el hueco sigue disponible para cualquier otra
     * clienta, y *"el primero en pagar se queda con el cupo"*. La carrera se resuelve al confirmar
     * el pago, no reteniendo. Por eso dos citas en este estado pueden coexistir sobre la misma
     * silla y la restricción `EXCLUDE` no las frena.
     */
    const estadoInicial = clienta.estadoDeRiesgo === 'lista_roja' ? 'en_espera_pago' : 'agendada';

    // ANTES de consultar la base: un rango invertido haría que PostgreSQL lanzara un error crudo
    // al construir el `tstzrange` de la consulta, en vez del error de dominio que corresponde.
    validarRangoHorario(rangoHorario);

    // Horario de la sucursal (`RN-AGE-10`/`RN-AGE-12`) y capacidad efectiva
    // `MIN(sillas, manicuristas)` (`DEC-035`). Antes de esto, el caso de uso repartía sillas sin
    // saber si había manos para atenderlas.
    await this.motorDisponibilidad.exigirDisponibilidad(input.sucursalId, rangoHorario);

    const candidatas = await this.selectorDeSilla.libresEn(input.sucursalId, rangoHorario);
    // Se congela una sola vez, fuera del bucle: reintentar en otra silla no recotiza nada.
    const cotizacionSnapshot = this.resolutorDeServicio.construirSnapshot(servicio);
    // Base de cálculo del anticipo. `null` con `DEC-033`: el monto lo fija una persona.
    const totalDelSnapshot = cotizacionSnapshot.totalCentavos;

    for (const sillaId of candidatas) {
      const cita = Cita.crear({
        sucursalId: input.sucursalId,
        servicioId: input.servicioId,
        clientaId: input.clientaId,
        rangoHorario,
        sillaId,
        manicuristaId: input.manicuristaId ?? null,
        cotizacionSnapshot,
        estado: estadoInicial,
      });

      try {
        await this.unitOfWork.ejecutar(async () => {
          await this.citaRepository.guardar(cita);

          // `RN-ANT-01`: la cita de una clienta en lista roja nace con su anticipo ya generado,
          // en la MISMA transacción. Una cita `en_espera_pago` sin fila de anticipo sería una
          // cita que nadie sabe cuánto cobrar.
          if (estadoInicial === 'en_espera_pago') {
            await this.anticipos.generarParaCita({
              citaId: cita.id,
              clientaId: cita.clientaId,
              baseCentavos: totalDelSnapshot,
            });
          }

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
              // Queda constancia de por qué nació donde nació: `en_espera_pago` no es un fallo
              // ni una elección de quien agenda, es consecuencia del estado de la clienta.
              estadoInicial,
            },
          });
        });

        return cita;
      } catch (error) {
        // Que la manicurista esté ocupada NO se arregla cambiando de silla: es ella la que choca.
        // Reintentar en otra silla solo tiene sentido ante un conflicto de silla — `esSillaOcupada`
        // lo distingue, y compara el código de negocio porque el repositorio ya tradujo el `23P01`.
        if (!esSillaOcupada(error)) throw error;
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
}
