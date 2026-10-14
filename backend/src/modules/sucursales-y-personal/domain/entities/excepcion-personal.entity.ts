import { randomUUID } from 'crypto';
import { DomainError } from '../../../../shared/errors/domain-error';
import { RangoHorario, TipoExcepcionPersonal } from '../../../../database/schema';

export interface ExcepcionPersonalProps {
  id: string;
  manicuristaId: string;
  tipo: TipoExcepcionPersonal;
  /** Solo en `cobertura`: dónde trabaja ese día. `null` en una `ausencia`. */
  sucursalId: string | null;
  rango: RangoHorario;
  motivo: string | null;
}

/**
 * `ExcepcionPersonal` — la desviación de un día concreto respecto al horario base (`DEC-036`).
 *
 * **El horario base no se modela**, y eso es deliberado: la Dueña confirmó que las manicuristas
 * tienen horario fijo y **todas trabajan al mismo tiempo**, el de su sucursal. Inventar un horario
 * por persona sería modelar una flexibilidad que el negocio no tiene y que nadie mantendría.
 * Lo que sí cambia a diario —y por eso se captura— es la excepción.
 *
 * **Una cobertura es un MOVIMIENTO, no una suma.** Si Ana, de Zibatá, cubre hoy en Lomas: Zibatá
 * pierde una persona **y** Lomas gana una. Un solo registro cambia la capacidad de dos sucursales.
 * Ese es exactamente el caso que hacía imposible resolver esto con un booleano de "faltó".
 */
export class ExcepcionPersonal {
  private constructor(private props: ExcepcionPersonalProps) {}

  /** La manicurista no está disponible **en ningún sitio** durante el rango. */
  static ausencia(input: { manicuristaId: string; rango: RangoHorario; motivo?: string | null }): ExcepcionPersonal {
    validarRango(input.rango);
    return new ExcepcionPersonal({
      id: randomUUID(),
      manicuristaId: input.manicuristaId,
      tipo: 'ausencia',
      sucursalId: null,
      rango: input.rango,
      motivo: input.motivo ?? null,
    });
  }

  /** La manicurista trabaja en `sucursalId` durante el rango, en lugar de en su sucursal base. */
  static cobertura(input: {
    manicuristaId: string;
    sucursalId: string;
    rango: RangoHorario;
    motivo?: string | null;
  }): ExcepcionPersonal {
    validarRango(input.rango);
    if (!input.sucursalId) {
      throw new DomainError('COBERTURA_SIN_SUCURSAL', 'Una cobertura debe indicar en qué sucursal se cubre.', 400);
    }
    return new ExcepcionPersonal({
      id: randomUUID(),
      manicuristaId: input.manicuristaId,
      tipo: 'cobertura',
      sucursalId: input.sucursalId,
      rango: input.rango,
      motivo: input.motivo ?? null,
    });
  }

  static reconstruir(props: ExcepcionPersonalProps): ExcepcionPersonal {
    return new ExcepcionPersonal(props);
  }

  get id(): string {
    return this.props.id;
  }
  get manicuristaId(): string {
    return this.props.manicuristaId;
  }
  get tipo(): TipoExcepcionPersonal {
    return this.props.tipo;
  }
  get sucursalId(): string | null {
    return this.props.sucursalId;
  }
  get rango(): RangoHorario {
    return this.props.rango;
  }
  get motivo(): string | null {
    return this.props.motivo;
  }
}

function validarRango(rango: RangoHorario): void {
  if (Number.isNaN(rango.inicio.getTime()) || Number.isNaN(rango.fin.getTime())) {
    throw new DomainError('EXCEPCION_RANGO_INVALIDO', 'El rango contiene una fecha inválida.', 400);
  }
  if (rango.fin.getTime() <= rango.inicio.getTime()) {
    throw new DomainError('EXCEPCION_RANGO_INVALIDO', 'El fin de la excepción debe ser posterior a su inicio.', 400);
  }
}
