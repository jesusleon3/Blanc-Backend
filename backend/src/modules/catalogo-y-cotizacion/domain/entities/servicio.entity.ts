import { randomUUID } from 'crypto';
import { DomainError } from '../../../../shared/errors/domain-error';
import { Centavos, validarImporteEnCentavos } from '../value-objects/centavos';

export interface ServicioProps {
  id: string;
  nombre: string;
  /** Incluye `retiro` como categoría propia (`RN-COT-02`), no como variante de una aplicación. */
  categoria: string;
  duracionBaseMinutos: number;
  precioBaseCentavos: Centavos;
  activo: boolean;
}

/**
 * `Servicio` — aggregate raíz del catálogo (01-domain-discovery.md §5.2, 04-data-model.md §5.2).
 *
 * Alcance de esta entidad (`FL-COT-01`): el registro administrativo del servicio. **No calcula
 * duraciones ni cotizaciones**: eso es `FL-COT-02`/`FL-COT-03`, deliberadamente pospuestos, y
 * además `RN-COT-01` establece que la duración de un compuesto sale de una tabla de
 * combinaciones específicas, **nunca de sumar** las duraciones individuales de esta entidad. Por
 * eso `duracionBaseMinutos` es un dato del catálogo, no un operando de una suma.
 *
 * La relación con `ModificadorDiseno` no se modela aquí como colección: son dos aggregates raíz
 * independientes y su vínculo vive en la tabla `servicio_modificadores_aplicables`. Un aggregate
 * no contiene a otro aggregate raíz.
 */
export class Servicio {
  private constructor(private props: ServicioProps) {}

  static crear(input: { nombre: string; categoria: string; duracionBaseMinutos: number; precioBaseCentavos: number }): Servicio {
    const nombre = input.nombre.trim();
    const categoria = input.categoria.trim();

    if (nombre.length === 0) {
      throw new DomainError('SERVICIO_NOMBRE_REQUERIDO', 'El nombre del servicio no puede estar vacío.', 400);
    }
    if (categoria.length === 0) {
      throw new DomainError('SERVICIO_CATEGORIA_REQUERIDA', 'La categoría del servicio no puede estar vacía.', 400);
    }

    return new Servicio({
      id: randomUUID(),
      nombre,
      categoria,
      duracionBaseMinutos: validarDuracionEnMinutos(input.duracionBaseMinutos, 'SERVICIO'),
      precioBaseCentavos: validarImporteEnCentavos(input.precioBaseCentavos, 'SERVICIO_PRECIO_BASE'),
      activo: true,
    });
  }

  static reconstruir(props: ServicioProps): Servicio {
    return new Servicio(props);
  }

  actualizarDatos(input: { nombre?: string; categoria?: string; duracionBaseMinutos?: number; precioBaseCentavos?: number }): void {
    if (input.nombre !== undefined) {
      const nombre = input.nombre.trim();
      if (nombre.length === 0) {
        throw new DomainError('SERVICIO_NOMBRE_REQUERIDO', 'El nombre del servicio no puede estar vacío.', 400);
      }
      this.props.nombre = nombre;
    }
    if (input.categoria !== undefined) {
      const categoria = input.categoria.trim();
      if (categoria.length === 0) {
        throw new DomainError('SERVICIO_CATEGORIA_REQUERIDA', 'La categoría del servicio no puede estar vacía.', 400);
      }
      this.props.categoria = categoria;
    }
    if (input.duracionBaseMinutos !== undefined) {
      this.props.duracionBaseMinutos = validarDuracionEnMinutos(input.duracionBaseMinutos, 'SERVICIO');
    }
    if (input.precioBaseCentavos !== undefined) {
      this.props.precioBaseCentavos = validarImporteEnCentavos(input.precioBaseCentavos, 'SERVICIO_PRECIO_BASE');
    }
  }

  /** Baja del catálogo sin borrado (mismo patrón que `Manicurista`/`Usuario`): preserva el
   * historial de citas ya cotizadas con este servicio. */
  desactivar(): void {
    this.props.activo = false;
  }

  activar(): void {
    this.props.activo = true;
  }

  get id(): string {
    return this.props.id;
  }
  get nombre(): string {
    return this.props.nombre;
  }
  get categoria(): string {
    return this.props.categoria;
  }
  get duracionBaseMinutos(): number {
    return this.props.duracionBaseMinutos;
  }
  /** Importe en **centavos** (`RN-COT-07`) — nunca en unidades monetarias. */
  get precioBaseCentavos(): Centavos {
    return this.props.precioBaseCentavos;
  }
  get activo(): boolean {
    return this.props.activo;
  }
}

/** Duración en minutos enteros: un servicio de duración fraccionaria o negativa no es agendable. */
export function validarDuracionEnMinutos(valor: number, prefijoDeCodigo: string): number {
  if (!Number.isInteger(valor)) {
    throw new DomainError(`${prefijoDeCodigo}_DURACION_INVALIDA`, 'La duración debe ser un número entero de minutos.', 400, { valor });
  }
  if (valor < 0) {
    throw new DomainError(`${prefijoDeCodigo}_DURACION_INVALIDA`, 'La duración no puede ser negativa.', 400, { valor });
  }
  return valor;
}
