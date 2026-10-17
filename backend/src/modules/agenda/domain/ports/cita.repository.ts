import { Cita } from '../entities/cita.entity';
import { RangoHorario } from '../../../../database/schema/agenda.schema';

export const CITA_REPOSITORY = 'CITA_REPOSITORY';

/**
 * Puerto de persistencia de `Cita` (ADR-002).
 *
 * **Lo que NO está aquí, a propósito:** nada de búsqueda de huecos libres ni de cálculo de
 * disponibilidad. Eso es `MotorDisponibilidad` (`DEC-035`), un servicio de dominio que todavía no
 * existe; meterlo en el repositorio mezclaría persistencia con la regla de capacidad.
 */
export interface CitaRepository {
  /**
   * Persiste la cita.
   *
   * **Puede lanzar `ConflictoDeNegocioError` (409)** si alguna de las dos restricciones de
   * exclusión salta: `SILLA_OCUPADA` o `MANICURISTA_OCUPADA`. No es un fallo del sistema sino la
   * condición de carrera que esas restricciones existen para atrapar — dos reservas simultáneas
   * que pasaron la comprobación previa de disponibilidad.
   */
  guardar(cita: Cita): Promise<void>;
  buscarPorId(id: string): Promise<Cita | null>;
  /** Citas que **ocupan** horario en el rango dado (`DEC-034`); las canceladas/expiradas/reprogramadas no salen. */
  listarQueOcupanEnRango(sucursalId: string, rango: RangoHorario): Promise<Cita[]>;
  /** Citas que OCUPAN horario de una manicurista concreta dentro del rango (`DEC-036`). */
  listarQueOcupanDeManicuristaEnRango(manicuristaId: string, rango: RangoHorario): Promise<Cita[]>;
  /** Alimenta `VerificarCitasFuturasPort` (`DEC-032`). */
  tieneCitasFuturasQueOcupan(manicuristaId: string, desde: Date): Promise<boolean>;

  /**
   * Lectura paginada para la consulta de agenda.
   *
   * **`manicuristaId` se filtra en SQL y no en memoria, y eso no es una optimización.** Con un
   * `LIMIT`, filtrar después de traer la página daría resultados falsos: una manicurista con sus
   * citas en la página 2 vería la página 1 vacía y concluiría que no tiene trabajo. El filtro
   * tiene que entrar en la consulta.
   *
   * Quién decide ese `manicuristaId` sigue siendo el caso de uso, a partir de los permisos
   * resueltos (`P9`) — nunca la petición.
   *
   * Orden estable por inicio y luego por id: sin `ORDER BY`, PostgreSQL no garantiza el mismo
   * orden entre páginas y una cita podría salir dos veces o ninguna.
   */
  listarParaConsulta(
    sucursalId: string,
    rango: RangoHorario,
    opciones: { manicuristaId?: string; limite: number; desplazamiento: number },
  ): Promise<Cita[]>;

  /**
   * La cita de una clienta que está esperando su confirmación, si hay alguna.
   *
   * ## POR QUÉ ES UNA CONSULTA Y NO UN FILTRO EN MEMORIA
   *
   * La escribió el bot para cerrar el ciclo del recordatorio: recibe un *"sí"* y tiene que saber
   * qué cita confirma. La primera versión barría `listarParaConsulta` con un rango de 30 días y
   * filtraba por clienta y estado en Node, y eso **falla de tres formas distintas**: no ve citas
   * más allá del rango, descarta en silencio lo que pase del límite de página, y trae cien filas
   * para quedarse con una. Un recordatorio se manda 24 h antes, sí — pero la cita puede haberse
   * reprogramado a un mes, y entonces el "sí" de la clienta no confirmaría nada.
   *
   * Se acota a la sucursal porque la conversación pertenece a un número, y ese número es de una
   * sucursal: confirmar la cita que la clienta tiene en otra sucursal sería confirmar otra cosa.
   */
  buscarPendienteDeConfirmacionDeClienta(sucursalId: string, clientaId: string): Promise<Cita | null>;

  /**
   * `true` si esa cita completada **ya tiene** una garantía agendada (`RN-GAR-01`).
   *
   * Un servicio se honra una sola vez. La base lo impone además con un índice único parcial: esta
   * consulta da el mensaje legible, y el índice evita que dos personas atendiendo a la vez creen
   * dos reposiciones gratuitas del mismo servicio.
   */
  existeGarantiaDe(citaGarantizadaId: string): Promise<boolean>;

  /**
   * Citas activas cuyo horario **ya terminó** — las que el barrido de cierre pasa a `completada`
   * (`DEC-030`, `ADR-025`).
   *
   * "Activas" son `agendada`, `pendiente_confirmacion` y `confirmada`. Las demás no se tocan:
   * `en_espera_pago` tiene su propio barrido, y las terminales ya no se mueven.
   *
   * **El `limite` acota el lote**, no la verdad: si hay más, el siguiente tick las recoge. Un
   * barrido sin tope podría traerse meses de citas olvidadas en una sola consulta.
   */
  listarActivasYaTerminadas(ahora: Date, limite: number): Promise<Cita[]>;

  /**
   * Citas en `en_espera_pago` cuyo horario ya llegó sin que se confirmara el pago.
   *
   * Es la condición de `RN-ANT-03` traducida a barrido: el anticipo dejó de tener sentido en el
   * momento en que la cita empezó. Se mide contra el **inicio**, no el fin: una cita que ya
   * empezó sin pagar no se va a atender.
   */
  listarEnEsperaDePagoVencidas(ahora: Date, limite: number): Promise<Cita[]>;

  /**
   * Citas `agendada` que empiezan dentro de la ventana `[desde, hasta]` — las candidatas al
   * recordatorio de 24 h (`RN-NOT-02`).
   *
   * **Solo `agendada`**: una cita ya en `pendiente_confirmacion` tiene su recordatorio enviado, y
   * eso es lo que hace el barrido idempotente sin necesitar una columna de "ya recordada". Pedir
   * también las `confirmada` reenviaría recordatorios a quien ya respondió.
   */
  listarProximasSinRecordatorio(desde: Date, hasta: Date, limite: number): Promise<Cita[]>;
}
