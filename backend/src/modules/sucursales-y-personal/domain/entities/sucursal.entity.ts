import { randomUUID } from 'crypto';
import { HorarioSemanal, HorarioSemanalData } from '../value-objects/horario-semanal.vo';
import { DomainError } from '../../../../shared/errors/domain-error';

export interface SucursalProps {
  id: string;
  nombre: string;
  numeroWhatsappAlias: string | null;
  horarioSemanal: HorarioSemanal;
  descansos: unknown;
  enMantenimiento: boolean;
}

/**
 * `Sucursal` — aggregate raíz (01-domain-discovery.md §5.7, RN-SUC-01).
 * Encapsula el invariante de RN-SUC-01: toda configuración operativa vive scoped por esta
 * sucursal, sin afectar a otras.
 */
export class Sucursal {
  private constructor(private props: SucursalProps) {}

  static crear(input: { nombre: string; numeroWhatsappAlias?: string; horarioSemanal: HorarioSemanalData; descansos?: unknown }): Sucursal {
    const nombre = input.nombre.trim();
    if (nombre.length === 0) {
      throw new DomainError('SUCURSAL_NOMBRE_REQUERIDO', 'El nombre de la sucursal no puede estar vacío.', 400);
    }
    return new Sucursal({
      id: randomUUID(),
      nombre,
      numeroWhatsappAlias: input.numeroWhatsappAlias ?? null,
      horarioSemanal: HorarioSemanal.crear(input.horarioSemanal),
      descansos: input.descansos ?? null,
      enMantenimiento: false,
    });
  }

  static reconstruir(props: SucursalProps): Sucursal {
    return new Sucursal(props);
  }

  actualizarConfiguracion(input: { nombre?: string; numeroWhatsappAlias?: string | null; horarioSemanal?: HorarioSemanalData; descansos?: unknown }): void {
    if (input.nombre !== undefined) {
      const nombre = input.nombre.trim();
      if (nombre.length === 0) {
        throw new DomainError('SUCURSAL_NOMBRE_REQUERIDO', 'El nombre de la sucursal no puede estar vacío.', 400);
      }
      this.props.nombre = nombre;
    }
    if (input.numeroWhatsappAlias !== undefined) this.props.numeroWhatsappAlias = input.numeroWhatsappAlias;
    if (input.horarioSemanal !== undefined) this.props.horarioSemanal = HorarioSemanal.crear(input.horarioSemanal);
    if (input.descansos !== undefined) this.props.descansos = input.descansos;
  }

  /** RN-SUC-02: activar/desactivar es reversible, sin alterar datos existentes. */
  activarMantenimiento(): void {
    this.props.enMantenimiento = true;
  }

  desactivarMantenimiento(): void {
    this.props.enMantenimiento = false;
  }

  get id(): string {
    return this.props.id;
  }

  get nombre(): string {
    return this.props.nombre;
  }

  get numeroWhatsappAlias(): string | null {
    return this.props.numeroWhatsappAlias;
  }

  get horarioSemanal(): HorarioSemanal {
    return this.props.horarioSemanal;
  }

  get descansos(): unknown {
    return this.props.descansos;
  }

  get enMantenimiento(): boolean {
    return this.props.enMantenimiento;
  }
}
