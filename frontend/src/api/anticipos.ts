import { peticion } from './cliente';
import type { Anticipo, EstadoAnticipo, PaginaDeAnticipos } from './contrato';

const RUTA = '/v1/anticipos';

export const anticiposApi = {
  listar: (estado: EstadoAnticipo, limite = 50, desplazamiento = 0) =>
    peticion<PaginaDeAnticipos>(RUTA, { query: { estado, limite, desplazamiento } }),

  /**
   * Una persona vio la transferencia. **Aquí se resuelve la carrera de `RN-ANT-03`.**
   *
   * Puede responder `409 HORARIO_NO_DISPONIBLE`: otra clienta tomó el último hueco mientras
   * llegaba la transferencia. El pago **no** queda confirmado, y quien opera necesita saber eso
   * exactamente — es el motivo de que `ErrorDeApi` lleve el código de negocio.
   */
  confirmarPago: (id: string, referenciaPago: string) =>
    peticion<Anticipo>(`${RUTA}/${id}/confirmar-pago`, { metodo: 'POST', cuerpo: { referenciaPago } }),

  /** La transferencia nunca llegó: el anticipo queda `expirado` y la cita `expirada`. */
  expirar: (id: string, motivo?: string) =>
    peticion<Anticipo>(`${RUTA}/${id}/expirar`, { metodo: 'POST', cuerpo: motivo ? { motivo } : {} }),
};
