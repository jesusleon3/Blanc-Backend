export const REGISTRO_DE_INCIDENTES_PORT = 'REGISTRO_DE_INCIDENTES_PORT';

/** Los tres incidentes que disparan la sugerencia de lista roja (`RN-CRM-06`). */
export type TipoDeIncidenteDeAgenda = 'no_show' | 'cancelacion_tardia' | 'reprogramacion_tardia';

/**
 * Lo que **Agenda le cuenta a CRM** cuando algo sale mal (`RN-CRM-06`).
 *
 * POR QUÉ AGENDA EMPUJA Y CRM NO PREGUNTA. El incidente ocurre en el momento exacto en que se
 * cancela, se reagenda o se marca un no-show, y depende de un dato que solo Agenda tiene: la
 * distancia entre ese instante y el inicio de la cita. Si CRM tuviera que deducirlo después,
 * necesitaría leer la agenda —cruzando la frontera en el sentido contrario— y reconstruir cuándo
 * pasó cada cosa.
 *
 * **Agenda no clasifica el riesgo, solo informa del hecho.** La decisión de encender la
 * sugerencia es de CRM (`RN-CRM-05`), y marcar lista roja es de la Dueña (`DEC-042`).
 */
export interface RegistroDeIncidentesPort {
  /** Incidente tardío (`<= 60 min`) o no-show. Enciende la sugerencia en CRM. */
  registrarIncidente(input: {
    clientaId: string;
    citaId: string;
    tipo: TipoDeIncidenteDeAgenda;
    ocurridoEn: Date;
    minutosDeAntelacion: number;
  }): Promise<void>;

  /**
   * Cancelación con más de 60 minutos de aviso. **Se cuenta, no sugiere nada** — `RN-CRM-06`
   * descartó expresamente el umbral acumulado.
   */
  registrarCancelacionOrdinaria(input: { clientaId: string; citaId: string }): Promise<void>;
}
