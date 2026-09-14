import { randomUUID } from 'crypto';
import { DomainError } from '../../../../shared/errors/domain-error';

export interface DiaFestivoProps {
  id: string;
  sucursalId: string;
  fecha: string; // "YYYY-MM-DD"
  descripcion: string | null;
}

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** `DiaFestivo` — entidad hija de `Sucursal` (04-data-model.md §5.7). */
export class DiaFestivo {
  private constructor(private props: DiaFestivoProps) {}

  static crear(input: { sucursalId: string; fecha: string; descripcion?: string }): DiaFestivo {
    if (!FORMATO_FECHA.test(input.fecha)) {
      throw new DomainError('DIA_FESTIVO_FECHA_INVALIDA', 'La fecha del día festivo debe tener formato "YYYY-MM-DD".', 400, { fecha: input.fecha });
    }
    return new DiaFestivo({
      id: randomUUID(),
      sucursalId: input.sucursalId,
      fecha: input.fecha,
      descripcion: input.descripcion ?? null,
    });
  }

  static reconstruir(props: DiaFestivoProps): DiaFestivo {
    return new DiaFestivo(props);
  }

  get id(): string {
    return this.props.id;
  }
  get sucursalId(): string {
    return this.props.sucursalId;
  }
  get fecha(): string {
    return this.props.fecha;
  }
  get descripcion(): string | null {
    return this.props.descripcion;
  }
}
