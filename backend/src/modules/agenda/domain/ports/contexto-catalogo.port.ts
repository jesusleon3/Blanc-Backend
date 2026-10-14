export const CONTEXTO_CATALOGO_PORT = 'CONTEXTO_CATALOGO_PORT';

/**
 * Lo que **Agenda** necesita saber de un servicio para poder agendarlo.
 *
 * Es deliberadamente **menos** que la entidad `Servicio` del catálogo: Agenda no necesita saber
 * nada de modificadores, ni de vínculos N:M, ni de cómo se administra el catálogo. Pedir solo
 * esto es lo que mantiene la frontera: el día que `Servicio` cambie por dentro, Agenda no se
 * enterará mientras siga pudiendo responder estas seis cosas.
 */
export interface ServicioAgendable {
  id: string;
  nombre: string;
  categoria: string;
  /** Duración oficial del catálogo, en minutos. Es la que manda sobre el horario de la cita. */
  duracionMinutos: number;
  /** `RN-COT-07` — en centavos enteros, nunca en pesos. */
  precioCentavos: number;
  activo: boolean;
  /** `DEC-033` — su precio lo fija una persona; el sistema no debe inventar un número. */
  requiereCotizacionManual: boolean;
}

/**
 * Lo que **Agenda pregunta a Catálogo**.
 *
 * El puerto lo define el consumidor (Agenda) y lo implementa `IntegracionModule`, igual que
 * `ContextoPersonalPort` y `ConsultaAgendaPort`. Ninguno de los dos Bounded Contexts importa al
 * otro.
 *
 * POR QUÉ UN PUERTO Y NO UNA FK. `ADR-005` prohíbe las claves foráneas entre esquemas, así que
 * `citas.servicio_id` es un `uuid` sin garantía referencial. Antes de esto **se podía agendar una
 * cita de un servicio inexistente**: el único filtro era el formato del uuid. La integridad que
 * la base de datos no puede dar la da ahora el dominio, en el único punto por el que pasan todas
 * las reservas.
 */
export interface ContextoCatalogoPort {
  buscarServicio(servicioId: string): Promise<ServicioAgendable | null>;
}
