import { peticion } from './cliente';
import type {
  Cita,
  Disponibilidad,
  PaginaDeAgenda,
  ResultadoDeCancelacion,
  ResultadoDeReprogramacion,
  Silla,
} from './contrato';

const RUTA = '/v1/agenda/citas';

export interface RangoDeConsulta {
  sucursalId: string;
  /** ISO. El backend acota a 31 días y pagina. */
  inicio: string;
  fin: string;
  limite?: number;
  desplazamiento?: number;
}

export interface NuevaCita {
  sucursalId: string;
  servicioId: string;
  clientaId: string;
  inicio: string;
  /**
   * **No se manda.** El backend deriva el fin de la duración del servicio en el Catálogo
   * (`DEC-033`): mandarlo desde aquí sería decidir una duración en el cliente, que es exactamente
   * lo que la regla 2 de `ADR-027` prohíbe. Se deja fuera del tipo a propósito.
   */
  manicuristaId?: string;
}

export const agendaApi = {
  listar: (rango: RangoDeConsulta) => peticion<PaginaDeAgenda>(RUTA, { query: { ...rango } }),

  /** Alta normal **y walk-in**: un walk-in es una cita creada en el momento (`DEC-037`). */
  agendar: (cita: NuevaCita) => peticion<Cita>(RUTA, { metodo: 'POST', cuerpo: cita }),

  /**
   * Asignar o cambiar la manicurista. **Puede responder `409 MANICURISTA_OCUPADA`.**
   *
   * El caso real: la cita se creó con solo una Silla Virtual asignada (`DEC-031` — la clienta
   * nunca elige silla ni manicurista) y al llegar se decide quién la atiende.
   */
  asignarManicurista: (citaId: string, manicuristaId: string) =>
    peticion<Cita>(`${RUTA}/${citaId}/manicurista`, { metodo: 'POST', cuerpo: { manicuristaId } }),

  solicitarConfirmacion: (citaId: string) => peticion<Cita>(`${RUTA}/${citaId}/solicitar-confirmacion`, { metodo: 'POST' }),
  confirmar: (citaId: string) => peticion<Cita>(`${RUTA}/${citaId}/confirmar`, { metodo: 'POST' }),
  completar: (citaId: string) => peticion<Cita>(`${RUTA}/${citaId}/completar`, { metodo: 'POST' }),
  /** También admite la corrección `completada → no_show` (`N-02`). */
  marcarNoShow: (citaId: string) => peticion<Cita>(`${RUTA}/${citaId}/no-show`, { metodo: 'POST' }),

  /**
   * Cancelar. **`confirmacionDeEmpleado` es obligatoria si hay lista roja o anticipo pagado**:
   * sin ella el backend responde `409 CANCELACION_REQUIERE_CONFIRMACION` (`RN-CRM-03`/`RN-ANT-04`).
   *
   * No se manda `true` por adelantado a propósito: el `409` es lo que dispara el diálogo que
   * advierte de que el anticipo **no se reembolsa**. Enviarla siempre convertiría una barrera
   * deliberada en un trámite invisible.
   */
  cancelar: (citaId: string, datos: { motivo?: string; confirmacionDeEmpleado?: boolean } = {}) =>
    peticion<ResultadoDeCancelacion>(`${RUTA}/${citaId}/cancelar`, { metodo: 'POST', cuerpo: datos }),

  /** Mover fecha/hora. Puede fallar por el tope de 3 (`DEC-042`) o la ventana de 48 h (`RN-ANT-04`). */
  reprogramar: (citaId: string, datos: { inicio: string; manicuristaId?: string; confirmacionDeEmpleado?: boolean }) =>
    peticion<ResultadoDeReprogramacion>(`${RUTA}/${citaId}/reprogramar`, { metodo: 'POST', cuerpo: datos }),

  /** El `MotorDisponibilidad`: *"¿cabe una clienta a esta hora?"*. */
  disponibilidad: (sucursalId: string, inicio: string, fin: string) =>
    peticion<Disponibilidad>('/v1/agenda/disponibilidad', { query: { sucursalId, inicio, fin } }),

  sillas: (sucursalId: string) => peticion<{ sillas: Silla[] }>('/v1/agenda/sillas', { query: { sucursalId } }),
};
