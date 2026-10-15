export const TRANSICION_DE_CITA_PORT = 'TRANSICION_DE_CITA_PORT';

/**
 * Lo que **Anticipos le pide a Agenda** cuando el dinero cambia de estado.
 *
 * Es el sentido Anticipos → Agenda que `P5` señalaba como circularidad: `FL-ANT-01` invocaba
 * `FL-AGE-09` directamente. Aquí no hay invocación directa — Anticipos declara el puerto y
 * `IntegracionModule` provee el adaptador, igual que los otros seis. Ningún `import` entre
 * contextos, y `madge` lo verifica.
 */
export interface TransicionDeCitaPort {
  /**
   * El pago se confirmó: la cita debe pasar de `en_espera_pago` a `agendada`.
   *
   * ⚠️ **AQUÍ SE RESUELVE LA CARRERA DE `RN-ANT-03`**, y puede fallar legítimamente. Mientras el
   * anticipo estaba `pendiente`, la cita **no retenía la silla**: otra clienta pudo tomar el
   * hueco. Este método revalida disponibilidad y, si no queda lugar, lanza
   * `409 HORARIO_NO_DISPONIBLE`. Ese error **no es un fallo del sistema**: es el comportamiento
   * aprobado — *"el primero en pagar se queda con el cupo"*.
   *
   * Se invoca **dentro** de la transacción que confirma el pago, de modo que si la cita no puede
   * activarse, el anticipo tampoco queda confirmado. Lo contrario dejaría dinero registrado
   * contra una cita que nunca se agendó.
   */
  activarPorPagoConfirmado(citaId: string): Promise<void>;

  /** El anticipo expiró: la cita pasa de `en_espera_pago` a `expirada`. */
  expirarPorAnticipoNoPagado(citaId: string): Promise<void>;
}
