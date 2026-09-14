import { randomUUID } from 'crypto';
import { DomainError } from '../../../../shared/errors/domain-error';
import { Centavos, validarImporteEnCentavos } from '../value-objects/centavos';
import { validarDuracionEnMinutos } from './servicio.entity';

export interface ModificadorDisenoProps {
  id: string;
  nombre: string;
  minutosAdicionales: number;
  precioAdicionalCentavos: Centavos;
  activo: boolean;
}

/**
 * `ModificadorDiseno` — aggregate raíz **independiente**, no un hijo de `Servicio`
 * (01-domain-discovery.md §5.2: "reutilizable entre servicios, ej. 'diseño francés' aplica a
 * Gelish y Acrílico por igual").
 *
 * Su vínculo con los servicios a los que aplica vive en la tabla
 * `servicio_modificadores_aplicables`, no dentro de esta entidad ni de `Servicio`: un aggregate
 * raíz no contiene a otro.
 *
 * SOBRE `RN-COT-03` (diseño como extra por uña): esta entidad guarda el costo y el tiempo
 * adicionales **de la unidad de aplicación**, no del servicio completo. La regla de que el
 * modificador se cobra solo por las uñas donde se aplica —y no como si cubriera las diez— es del
 * motor de cálculo (`FL-COT-03`, pospuesto) y de `ComposicionPorUña`, un Value Object que
 * deliberadamente no se persiste (`04-data-model.md` §5.2). Aquí no se decide nada de eso.
 */
export class ModificadorDiseno {
  private constructor(private props: ModificadorDisenoProps) {}

  static crear(input: { nombre: string; minutosAdicionales: number; precioAdicionalCentavos: number }): ModificadorDiseno {
    const nombre = input.nombre.trim();
    if (nombre.length === 0) {
      throw new DomainError('MODIFICADOR_NOMBRE_REQUERIDO', 'El nombre del modificador no puede estar vacío.', 400);
    }

    return new ModificadorDiseno({
      id: randomUUID(),
      nombre,
      minutosAdicionales: validarDuracionEnMinutos(input.minutosAdicionales, 'MODIFICADOR'),
      precioAdicionalCentavos: validarImporteEnCentavos(input.precioAdicionalCentavos, 'MODIFICADOR_PRECIO_ADICIONAL'),
      activo: true,
    });
  }

  static reconstruir(props: ModificadorDisenoProps): ModificadorDiseno {
    return new ModificadorDiseno(props);
  }

  actualizarDatos(input: { nombre?: string; minutosAdicionales?: number; precioAdicionalCentavos?: number }): void {
    if (input.nombre !== undefined) {
      const nombre = input.nombre.trim();
      if (nombre.length === 0) {
        throw new DomainError('MODIFICADOR_NOMBRE_REQUERIDO', 'El nombre del modificador no puede estar vacío.', 400);
      }
      this.props.nombre = nombre;
    }
    if (input.minutosAdicionales !== undefined) {
      this.props.minutosAdicionales = validarDuracionEnMinutos(input.minutosAdicionales, 'MODIFICADOR');
    }
    if (input.precioAdicionalCentavos !== undefined) {
      this.props.precioAdicionalCentavos = validarImporteEnCentavos(input.precioAdicionalCentavos, 'MODIFICADOR_PRECIO_ADICIONAL');
    }
  }

  /**
   * Baja del catálogo sin borrado, mismo criterio que `Servicio.desactivar()`: un modificador
   * descontinuado ("pedrería", por ejemplo) debe seguir existiendo para las citas que ya se
   * cotizaron con él. Borrarlo físicamente falsearía el historial.
   */
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
  get minutosAdicionales(): number {
    return this.props.minutosAdicionales;
  }
  /** Importe en **centavos** (`RN-COT-07`) — nunca en unidades monetarias. */
  get precioAdicionalCentavos(): Centavos {
    return this.props.precioAdicionalCentavos;
  }
  get activo(): boolean {
    return this.props.activo;
  }
}
