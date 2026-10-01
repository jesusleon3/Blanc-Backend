import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

/**
 * Cuerpo de `POST /v1/catalogo-y-cotizacion/modificadores-diseno`.
 *
 * Mismas garantías numéricas que `CrearServicioDto` — ver la nota sobre `@IsInt()` y `RN-COT-07`
 * en ese archivo.
 */
export class CrearModificadorDisenoDto {
  @IsString()
  @MinLength(1)
  nombre!: string;

  @IsInt()
  @Min(0)
  minutosAdicionales!: number;

  /** Importe en **centavos** enteros (`RN-COT-07`), por unidad de aplicación — ver `ModificadorDiseno`. */
  @IsInt()
  @Min(0)
  precioAdicionalCentavos!: number;

  /**
   * `DEC-033` — marca que este elemento NO se puede cotizar automáticamente. Por defecto `false`:
   * exigir intervención humana es la excepción, y conviene que sea explícita en el payload.
   */
  @IsOptional()
  @IsBoolean()
  requiereCotizacionManual?: boolean;
}
