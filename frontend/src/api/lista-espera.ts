import { peticion } from './cliente';
import type { Cita, ResultadoDeAvance, SolicitudListaEspera } from './contrato';

const RUTA = '/v1/agenda/lista-espera';

export const listaEsperaApi = {
  /** La fila viva de una sucursal en una fecha, **en orden de llegada** (FIFO de `DEC-039`). */
  listar: (sucursalId: string, fecha: string) =>
    peticion<{ solicitudes: SolicitudListaEspera[] }>(RUTA, { query: { sucursalId, fecha } }),

  inscribir: (datos: { sucursalId: string; clientaId: string; servicioId: string; fecha: string }) =>
    peticion<SolicitudListaEspera>(RUTA, { metodo: 'POST', cuerpo: datos }),

  /**
   * Aceptar en nombre de la clienta. **Agenda la cita de verdad**, validando disponibilidad en ese
   * instante: la oferta nunca retuvo el lugar (`RN-AGE-13`), así que puede fallar con `409`.
   */
  aceptar: (solicitudId: string, inicio: string, manicuristaId?: string) =>
    peticion<{ solicitud: SolicitudListaEspera; cita: Cita }>(`${RUTA}/${solicitudId}/aceptar`, {
      metodo: 'POST',
      cuerpo: manicuristaId ? { inicio, manicuristaId } : { inicio },
    }),

  /**
   * Cierra los turnos vencidos y pasa el hueco a la siguiente.
   *
   * El planificador ya lo hace cada pocos minutos (`ADR-025`); este botón existe para cuando la
   * Encargada no quiere esperar al siguiente barrido.
   */
  avanzarTurno: () => peticion<ResultadoDeAvance>(`${RUTA}/avanzar-turno`, { metodo: 'POST', cuerpo: {} }),

  cancelar: (solicitudId: string) => peticion<void>(`${RUTA}/${solicitudId}`, { metodo: 'DELETE' }),
};
