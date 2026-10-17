import { Inject, Injectable } from '@nestjs/common';
import { CITA_REPOSITORY, CitaRepository } from '../ports/cita.repository';
import { SILLA_REPOSITORY, SillaRepository } from '../ports/silla.repository';
import { RangoHorario } from '../../../../database/schema';
import { ConflictoDeNegocioError, DomainError } from '../../../../shared/errors/domain-error';

/**
 * Qué sillas quedan libres en un rango, **en orden estable** (`DEC-031`).
 *
 * ## POR QUÉ ESTO ES UN SERVICIO Y NO UN MÉTODO PRIVADO REPETIDO TRES VECES
 *
 * Lo era: `AgendarCitaUseCase`, `ReprogramarCitaUseCase` y `AgendarGarantiaUseCase` tenían cada
 * uno su propia versión de *"dame una silla libre"*. Las tres hacían lo mismo con matices
 * distintos, y la tercera salió mal: ignoraba el rango y confiaba en reintentar cuando la
 * `EXCLUDE` rechazara la inserción, con una guarda que **nunca se cumplía** porque comparaba el
 * SQLSTATE crudo contra un error ya traducido por el repositorio. Resultado: una garantía solo se
 * podía agendar si la primera silla del listado estaba libre.
 *
 * Con una sola implementación, ese desliz no tiene dónde ocurrir: quien añada el cuarto caso de
 * uso que necesite una silla hereda el comportamiento probado en vez de reescribirlo.
 *
 * ## LO QUE SIGUE SIENDO CONSULTIVO
 *
 * Esto **no reserva nada** (`DEC-035`). Entre que responde y la cita se inserta, otra reserva
 * puede tomar la misma silla: la autoridad final es la restricción `EXCLUDE USING gist`. Por eso
 * los casos de uso iteran sobre la lista y reintentan ante `SILLA_OCUPADA` en vez de confiar en
 * que la primera candidata vaya a aceptar la inserción.
 */
@Injectable()
export class SelectorDeSillaLibre {
  constructor(
    @Inject(SILLA_REPOSITORY) private readonly sillaRepository: SillaRepository,
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
  ) {}

  /**
   * Las sillas activas que **no** están ocupadas en el rango.
   *
   * `excluirCitaId` existe para reprogramar: la cita que se está moviendo está a punto de liberar
   * su hueco, así que no debe chocar consigo misma — sin esa exclusión, mover una cita dentro de
   * su propio horario sería imposible en una sucursal de una sola silla.
   *
   * Lanza `SUCURSAL_SIN_SILLAS` si la sucursal no tiene **ninguna** silla activa, porque eso no es
   * "está llena": es configuración incompleta, y decir "no hay lugar" mandaría a buscar otro
   * horario cuando ninguno va a funcionar.
   */
  async libresEn(sucursalId: string, rango: RangoHorario, opciones: { excluirCitaId?: string } = {}): Promise<string[]> {
    const activas = (await this.sillaRepository.listarPorSucursal(sucursalId)).filter((silla) => silla.activa);

    if (activas.length === 0) {
      throw new DomainError('SUCURSAL_SIN_SILLAS', 'La sucursal no tiene ninguna silla activa configurada.', 409, { sucursalId });
    }

    const ocupadas = new Set(
      (await this.citaRepository.listarQueOcupanEnRango(sucursalId, rango))
        .filter((cita) => cita.id !== opciones.excluirCitaId)
        .map((cita) => cita.sillaId),
    );

    return activas.map((silla) => silla.id).filter((id) => !ocupadas.has(id));
  }
}

/**
 * ¿Este error es *"esa silla se ocupó"*, y por tanto vale reintentar en otra?
 *
 * **Se compara el código de negocio, no el SQLSTATE.** `DrizzleCitaRepository.guardar` traduce el
 * `23P01` de la `EXCLUDE` a `SILLA_OCUPADA` o `MANICURISTA_OCUPADA` antes de que el caso de uso lo
 * vea, así que un `error.code === '23P01'` aquí sería siempre falso — y el reintento, código
 * muerto. Fue exactamente el defecto de `AgendarGarantiaUseCase`.
 *
 * `MANICURISTA_OCUPADA` **no** entra: cambiar de silla no libera a la manicurista, es ella la que
 * choca. Reintentar ahí solo repetiría el mismo conflicto en cada silla de la sucursal.
 */
export function esSillaOcupada(error: unknown): boolean {
  return error instanceof ConflictoDeNegocioError && error.code === 'SILLA_OCUPADA';
}
