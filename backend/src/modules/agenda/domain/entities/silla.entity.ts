import { randomUUID } from 'crypto';
import { DomainError } from '../../../../shared/errors/domain-error';

export interface SillaProps {
  id: string;
  sucursalId: string;
  nombre: string;
  activa: boolean;
}

/**
 * `Silla` — la estación de trabajo física de una sucursal (`DEC-031`).
 *
 * **El número de sillas de una sucursal ES su capacidad.** No existe ninguna constante con los
 * números (Zibatá 5, Lomas 3, Álamos 1): son filas. Añadir una silla es insertar una.
 *
 * No es un recurso que la clienta elija ni vea: es un mecanismo interno de capacidad. Nada en
 * WhatsApp menciona una silla.
 */
export class Silla {
  private constructor(private props: SillaProps) {}

  static crear(input: { sucursalId: string; nombre: string }): Silla {
    const nombre = input.nombre.trim();
    if (nombre.length === 0) {
      throw new DomainError('SILLA_NOMBRE_REQUERIDO', 'El nombre de la silla no puede estar vacío.', 400);
    }
    return new Silla({ id: randomUUID(), sucursalId: input.sucursalId, nombre, activa: true });
  }

  static reconstruir(props: SillaProps): Silla {
    return new Silla(props);
  }

  /** Baja lógica: una silla retirada debe seguir existiendo para las citas históricas que la usaron. */
  desactivar(): void {
    this.props.activa = false;
  }

  activar(): void {
    this.props.activa = true;
  }

  get id(): string {
    return this.props.id;
  }
  get sucursalId(): string {
    return this.props.sucursalId;
  }
  get nombre(): string {
    return this.props.nombre;
  }
  get activa(): boolean {
    return this.props.activa;
  }
}
