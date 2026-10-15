export const ANTICIPO_PORT = 'ANTICIPO_PORT';

/** Lo que Agenda necesita saber del dinero. `ninguno` = la cita no lleva anticipo. */
export type EstadoDeAnticipoDeCita = 'ninguno' | 'pendiente' | 'pagado' | 'expirado' | 'retenido';

/**
 * Lo que **Agenda pregunta y le cuenta a Anticipos**.
 *
 * SUSTITUYE AL PARÁMETRO `anticipoPagado` DE `ReprogramarCitaUseCase`, que hasta ahora lo
 * aportaba quien llamaba. Esa forma tenía un problema que no era teórico: **cualquier cliente
 * podía saltarse la ventana de 48 horas de `RN-ANT-04` enviando `anticipoPagado: false`**. Una
 * regla de negocio no puede depender de que el llamante diga la verdad sobre sí mismo.
 */
export interface AnticipoPort {
  /** Estado del anticipo de esa cita. Alimenta `RN-ANT-04` y el aviso de `RN-CRM-03`. */
  estadoDe(citaId: string): Promise<EstadoDeAnticipoDeCita>;

  /**
   * Genera el anticipo de una cita que acaba de nacer en `en_espera_pago` (`RN-ANT-01`).
   *
   * POR QUÉ SE GENERA SOLO Y NO POR UN ENDPOINT. Una cita en `en_espera_pago` **sin** fila de
   * anticipo es una cita que nadie sabe cuánto cobrar: aparecería en la agenda como pendiente de
   * pago sin monto, y la Encargada tendría que calcular el 40% a mano. Generarlo en el mismo acto
   * de agendar es lo que hace que el flujo esté completo desde el primer segundo.
   *
   * Se invoca **dentro** de la transacción que crea la cita: si el anticipo no se puede generar,
   * la cita tampoco se crea. Lo contrario dejaría una cita impagable.
   *
   * Devuelve `false` cuando **no se pudo calcular** el monto porque el servicio exige cotización
   * manual (`DEC-033`, `totalCentavos: null`). No es un error: la cita se crea igual y la
   * Encargada registra el anticipo con monto explícito por el endpoint de alta. Si fuera un error,
   * ningún servicio de precio variable podría venderse a una clienta de lista roja.
   */
  generarParaCita(input: { citaId: string; clientaId: string; baseCentavos: number | null }): Promise<boolean>;

  /**
   * La cita murió con el anticipo pagado: **el dinero se queda** (`RN-ANT-04`).
   *
   * Lo invocan `CancelarCitaUseCase` y `MarcarNoShowUseCase`. Si no hay anticipo o no estaba
   * pagado, no hace nada — no es un error, es el caso normal de la gran mayoría de las citas.
   */
  retenerPorCitaTerminada(citaId: string, motivo: 'cancelada' | 'no_show'): Promise<void>;
}
