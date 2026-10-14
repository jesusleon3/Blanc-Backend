import { RangoHorario } from '../../../../database/schema';

export const CONSULTA_AGENDA_PORT = 'CONSULTA_AGENDA_PORT';

/** Lo mínimo que Personal necesita saber de una cita para poder reaccionar. */
export interface CitaAfectada {
  id: string;
  sucursalId: string;
  manicuristaId: string | null;
  inicio: string;
  fin: string;
  estado: string;
  /** Por qué aparece en la lista: ayuda a la Encargada a priorizar. */
  motivo: 'manicurista_ausente' | 'sobrecupo_en_sucursal';
}

/**
 * Lo que **Personal pregunta a Agenda** al registrar una excepción (`DEC-036`).
 *
 * El puerto lo define el consumidor (Personal) y lo implementa `IntegracionModule`, igual que en
 * el sentido contrario. Ninguno de los dos Bounded Contexts importa al otro.
 */
export interface ConsultaAgendaPort {
  /**
   * Citas que quedan comprometidas si esta manicurista no está disponible en ese rango.
   *
   * Devuelve **dos clases de cita**, y por eso cada una trae su `motivo`:
   * - las que tienen **a esa manicurista asignada**: se quedan literalmente sin quién las atienda;
   * - las que están **sin asignar en una sucursal que queda con sobrecupo**: hay más citas activas
   *   que personal disponible, así que alguna no se va a poder atender aunque no se sepa cuál.
   *
   * La segunda clase es la que convierte esto en algo útil: sin ella, quitar a una manicurista de
   * una sucursal llena parecería inofensivo porque "ninguna cita llevaba su nombre".
   */
  citasAfectadasPorExcepcion(manicuristaId: string, rango: RangoHorario): Promise<CitaAfectada[]>;
}
