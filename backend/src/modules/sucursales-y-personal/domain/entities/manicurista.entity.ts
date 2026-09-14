import { randomUUID } from 'crypto';
import { DomainError } from '../../../../shared/errors/domain-error';

export interface ManicuristaProps {
  id: string;
  nombre: string;
  activa: boolean;
}

/**
 * `Manicurista` — registro administrativo, aggregate raíz independiente (04-data-model.md §5.7).
 * Intencionalmente distinta del futuro recurso agendable `agenda.manicuristas_recurso`
 * (01-domain-discovery.md §4, nota de diseño — Pregunta Abierta #2): esta entidad no sabe nada
 * de Agenda ni de citas.
 */
export class Manicurista {
  private constructor(private props: ManicuristaProps) {}

  static crear(input: { nombre: string }): Manicurista {
    const nombre = input.nombre.trim();
    if (nombre.length === 0) {
      throw new DomainError('MANICURISTA_NOMBRE_REQUERIDO', 'El nombre de la manicurista no puede estar vacío.', 400);
    }
    return new Manicurista({ id: randomUUID(), nombre, activa: true });
  }

  static reconstruir(props: ManicuristaProps): Manicurista {
    return new Manicurista(props);
  }

  /**
   * Baja administrativa (FL-SUC-03). Alcance explícito: esta entidad no conoce citas futuras
   * — ese impacto pertenece a `agenda.manicuristas_recurso`, todavía sin construir. La
   * "Pregunta 4" de OWNER_DECISION_LOG.md (qué pasa con citas futuras al dar de baja) queda
   * fuera de este método a propósito; ver reporte de cierre del módulo.
   */
  desactivar(): void {
    this.props.activa = false;
  }

  activar(): void {
    this.props.activa = true;
  }

  get id(): string {
    return this.props.id;
  }
  get nombre(): string {
    return this.props.nombre;
  }
  get activa(): boolean {
    return this.props.activa;
  }
}
