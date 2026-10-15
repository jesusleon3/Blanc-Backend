import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ESTADOS_ANTICIPO } from '../../../../../database/schema';

export const MAXIMO_ANTICIPOS_POR_PAGINA = 200;
export const ANTICIPOS_POR_PAGINA_POR_DEFECTO = 50;

/**
 * Alta manual, para el caso de `DEC-033`: un servicio cuyo precio lo fija una persona no tiene
 * base sobre la que aplicar el 40%, así que el monto lo dice quien cotizó.
 *
 * El alta **normal es automática** (`AgendarCitaUseCase` lo genera al nacer la cita en
 * `en_espera_pago`); este endpoint es la vía para los que no se pudieron calcular.
 */
export class GenerarAnticipoDto {
  @IsUUID()
  citaId!: string;

  @IsUUID()
  clientaId!: string;

  /** Centavos enteros (`RN-COT-07`). Obligatorio aquí: si fuera calculable, ya existiría. */
  @IsInt()
  @Min(1)
  montoCentavos!: number;
}

export class ConfirmarPagoDto {
  /**
   * Referencia o folio de la transferencia. **Obligatoria**: sin ella el pago no se puede
   * verificar después, y es el dato que hace falta si la clienta reclama.
   */
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  referenciaPago!: string;
}

export class ExpirarAnticipoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class ListarAnticiposDto {
  @IsIn([...ESTADOS_ANTICIPO])
  estado!: (typeof ESTADOS_ANTICIPO)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAXIMO_ANTICIPOS_POR_PAGINA)
  limite?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desplazamiento?: number;
}
