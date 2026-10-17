import { Inject, Injectable } from '@nestjs/common';
import { Cita, validarRangoHorario } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { MotorDisponibilidad } from '../../domain/services/motor-disponibilidad';
import { SelectorDeSillaLibre } from '../../domain/services/selector-de-silla';
import { ResolutorDeServicio } from '../../domain/services/resolutor-de-servicio';
import { ProcesarListaEsperaUseCase, ResultadoHuecoLiberado } from './lista-espera.use-cases';
import { REGISTRO_DE_INCIDENTES_PORT, RegistroDeIncidentesPort } from '../../domain/ports/registro-de-incidentes.port';
import { ANTICIPO_PORT, AnticipoPort } from '../../domain/ports/anticipo.port';
import { Logger } from '@nestjs/common';
import { RangoHorario } from '../../../../database/schema';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, DomainError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { MINUTOS_DE_INCIDENTE_TARDIO } from './cancelar-cita.use-case';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

/**
 * Ventana de `RN-CRM-06`, la misma que usa `CancelarCitaUseCase`.
 *
 * Se importa de allí en vez de redefinirla: es **una sola regla de negocio** (*"de 60 a 0 minutos
 * antes de la cita se manda sugerencia de lista roja"*), y dos constantes separadas acabarían
 * divergiendo el día que el umbral cambie.
 */
export { MINUTOS_DE_INCIDENTE_TARDIO } from './cancelar-cita.use-case';

/** Tope de reprogramaciones por cadena (`DEC-042`). */
export const MAXIMO_DE_REPROGRAMACIONES = 3;
/** `RN-ANT-04`: con anticipo pagado, reagendar exige al menos 48 horas de antelación. */
export const HORAS_MINIMAS_CON_ANTICIPO = 48;

export interface ReprogramarCitaInput {
  citaId: string;
  /** Nuevo inicio. El fin lo deriva la duración del servicio en el catálogo. */
  nuevoInicio: Date;
  /** Opcional. Si llega, tiene que coincidir con `nuevoInicio + duración del catálogo`. */
  nuevoFin?: Date;
  /** Mantener a la misma manicurista, o `null`/omitir para dejarla sin asignar otra vez. */
  manicuristaId?: string | null;
  /**
   * Confirmación explícita de quien reprograma, **exigida solo cuando hay anticipo pagado**
   * (`RN-ANT-04`: *"levantando una alerta para confirmar el reagendamiento"*).
   *
   * Sustituye al antiguo `anticipoPagado`, que lo aportaba quien llamaba — y que permitía
   * **saltarse la ventana de 48 horas enviando `false`**. Ahora el estado del anticipo se
   * consulta por puerto y lo único que aporta el llamante es su confirmación informada.
   */
  confirmacionDeEmpleado?: boolean;
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
    private readonly motorDisponibilidad: MotorDisponibilidad,
    private readonly selectorDeSilla: SelectorDeSillaLibre,
    private readonly resolutorDeServicio: ResolutorDeServicio,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly procesarListaEspera: ProcesarListaEsperaUseCase,
    @Inject(REGISTRO_DE_INCIDENTES_PORT) private readonly incidentes: RegistroDeIncidentesPort,
    @Inject(ANTICIPO_PORT) private readonly anticipos: AnticipoPort,
  ) {}

  private readonly logger = new Logger(ReprogramarCitaUseCase.name);

  async ejecutar(
    input: ReprogramarCitaInput,
    actor: ClaimsUsuario,
    ahora = new Date(),
  ): Promise<{ original: Cita; nueva: Cita; listaEspera: ResultadoHuecoLiberado | null }> {
    const original = await this.citaRepository.buscarPorId(input.citaId);
    if (!original) throw new RecursoNoEncontradoError('Cita', input.citaId);

    // El estado del anticipo se consulta, no se recibe: ver la nota de `confirmacionDeEmpleado`.
    const anticipoPagado = (await this.anticipos.estadoDe(original.id)) === 'pagado';
    this.validarReglas(original, input, ahora, anticipoPagado);

    // El catálogo se revalida al reprogramar, pero **sin exigir que el servicio siga activo**:
    // dar de baja un servicio detiene las ventas nuevas, no anula las citas ya vendidas. Lo que sí
    // se valida es que exista y cuánto dura, porque de ahí sale el tamaño del nuevo hueco.
    const servicio = await this.resolutorDeServicio.resolverParaMoverCita(original.servicioId);
    const nuevoRangoHorario = this.resolutorDeServicio.derivarRango(input.nuevoInicio, input.nuevoFin, servicio);
    validarRangoHorario(nuevoRangoHorario);

    // La cita original se excluye del cálculo: está a punto de liberar su hueco, así que mover una
    // cita dentro del mismo horario no debe chocar consigo misma.
    await this.motorDisponibilidad.exigirDisponibilidad(original.sucursalId, nuevoRangoHorario, { excluirCitaId: original.id });

    const sillaId = await this.elegirSillaLibre(original.sucursalId, nuevoRangoHorario, original.id);

    const nueva = Cita.crear({
      sucursalId: original.sucursalId,
      sillaId,
      clientaId: original.clientaId,
      servicioId: original.servicioId,
      rangoHorario: nuevoRangoHorario,
      manicuristaId: input.manicuristaId ?? null,
      citaOrigenId: original.id,
      numeroDeReprogramaciones: original.numeroDeReprogramaciones + 1,
      // **La cotización NO se recalcula.** `RN-AGE-08` la declara inmutable y `DEC-042` separa
      // reprogramar de cancelar: mover la hora no es una venta nueva. Si el catálogo subió de
      // precio entretanto, la clienta conserva el que se le dijo. Recotizar aquí sería subirle el
      // precio por haber movido su cita.
      cotizacionSnapshot: original.cotizacionSnapshot,
      /**
       * **La condición de garantía VIAJA con la cita** (auditoría 2026-10-17).
       *
       * Sin estas dos líneas, `Cita.crear` las ponía en `false`/`null` por defecto y mover la hora
       * de una reposición la convertía en una cita normal. Lo visible era que perdía su marca; lo
       * grave es que el índice único parcial vive sobre `cita_garantizada_id WHERE es_garantia`, así
       * que **al perderse la bandera el servicio original quedaba otra vez sin honrar** y se podía
       * conceder una segunda reposición gratis. Reprogramar no es renunciar a la garantía.
       */
      esGarantia: original.esGarantia,
      citaGarantizadaId: original.citaGarantizadaId,
    });

    original.cambiarEstado('reprogramada');

    /**
     * `RN-CRM-06`: reagendar a 60 minutos o menos **es un incidente**, igual que cancelar tarde.
     * La clienta no pierde la cita, pero el hueco ya no se puede revender a nadie — es el mismo
     * daño operativo, y la Dueña recibe la misma sugerencia.
     *
     * Se mide contra el inicio de la cita ORIGINAL, no de la nueva: lo que llega tarde es el
     * aviso de que ya no viene a su hora.
     */
    const minutosDeAntelacion = Math.round((original.rangoHorario.inicio.getTime() - ahora.getTime()) / 60_000);
    const esReprogramacionTardia = minutosDeAntelacion <= MINUTOS_DE_INCIDENTE_TARDIO;

    await this.unitOfWork.ejecutar(async () => {
      // Primero la original: libera su hueco, de modo que la nueva pueda ocupar ESE MISMO horario
      // si la clienta solo movió la manicurista. Al revés chocarían consigo mismas.
      await this.citaRepository.guardar(original);
      await this.citaRepository.guardar(nueva);

      if (esReprogramacionTardia) {
        await this.incidentes.registrarIncidente({
          clientaId: original.clientaId,
          citaId: original.id,
          tipo: 'reprogramacion_tardia',
          ocurridoEn: ahora,
          minutosDeAntelacion,
        });
      }

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
          esReprogramacionTardia,
        },
      });
    });

    // REPROGRAMAR TAMBIÉN LIBERA UN HUECO, y es fácil de olvidar porque `DEC-039` habla de
    // cancelaciones: la cita original pasa a `reprogramada`, que **no ocupa horario** (`DEC-034`),
    // así que su hueco queda igual de disponible que el de una cancelada. Si solo se procesara al
    // cancelar, media de las liberaciones reales no avisaría a nadie.
    //
    // Se evalúa el hueco de la cita ORIGINAL, no el de la nueva: la nueva está ocupada.
    const listaEspera = await this.procesarFila(original, actor, ahora);

    return { original, nueva, listaEspera };
  }

  /** Nunca propaga: la reprogramación ya está confirmada. Mismo criterio que al cancelar. */
  private async procesarFila(original: Cita, actor: ClaimsUsuario, ahora: Date): Promise<ResultadoHuecoLiberado | null> {
    try {
      return await this.procesarListaEspera.procesarHuecoLiberado(
        { sucursalId: original.sucursalId, inicioLiberado: original.rangoHorario.inicio },
        actor,
        ahora,
      );
    } catch (error) {
      this.logger.error(
        `La cita ${original.id} se reprogramó correctamente, pero no se pudo procesar la lista de espera.`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  private validarReglas(original: Cita, input: ReprogramarCitaInput, ahora: Date, anticipoPagado: boolean): void {
    if (original.numeroDeReprogramaciones >= MAXIMO_DE_REPROGRAMACIONES) {
      throw new ConflictoDeNegocioError(
        'MAXIMO_DE_REPROGRAMACIONES_ALCANZADO',
        `Esta cita ya se reprogramó ${MAXIMO_DE_REPROGRAMACIONES} veces; no se puede volver a mover.`,
        { citaId: original.id, numeroDeReprogramaciones: original.numeroDeReprogramaciones },
      );
    }

    if (!anticipoPagado) return;

    const horasDeAntelacion = (original.rangoHorario.inicio.getTime() - ahora.getTime()) / 3_600_000;
    if (horasDeAntelacion < HORAS_MINIMAS_CON_ANTICIPO) {
      throw new ConflictoDeNegocioError(
        'REPROGRAMACION_FUERA_DE_PLAZO',
        `Con anticipo pagado, reagendar exige al menos ${HORAS_MINIMAS_CON_ANTICIPO} horas de antelación. ` +
          'Con menos, la cita no se reagenda y el anticipo no se devuelve (RN-ANT-04).',
        { citaId: original.id, horasDeAntelacion: Math.round(horasDeAntelacion), horasMinimas: HORAS_MINIMAS_CON_ANTICIPO },
      );
    }

    // `RN-ANT-04` pide además *"una alerta de confirmación explícita"*. Se implementa como un
    // 409 que describe la consecuencia: quien reprograma tiene que reintentar confirmando, así
    // que no puede alegar que no lo sabía.
    if (!input.confirmacionDeEmpleado) {
      throw new ConflictoDeNegocioError(
        'REPROGRAMACION_REQUIERE_CONFIRMACION',
        'Esta cita tiene un anticipo pagado. Reagendarla no lo devuelve y no habrá reembolso; ' +
          'confirma explícitamente para continuar.',
        { citaId: original.id, requiereConfirmacionDeEmpleado: true },
      );
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
    const [libre] = await this.selectorDeSilla.libresEn(sucursalId, rango, { excluirCitaId: idAExcluir });
    if (!libre) {
      throw new DomainError('HORARIO_NO_DISPONIBLE', 'No queda lugar en la sucursal para el nuevo horario.', 409, {
        sucursalId,
        inicio: rango.inicio.toISOString(),
      });
    }
    return libre;
  }
}
