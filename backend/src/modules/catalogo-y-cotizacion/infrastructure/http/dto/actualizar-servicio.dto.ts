import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

/**
 * Cuerpo de `PATCH /v1/catalogo-y-cotizacion/servicios/:id`.
 *
 * `@IsOptional()` hace que un campo ausente se omita de la actualización — **no** que un campo
 * presente se valide con menos rigor. En class-validator, `@IsOptional()` salta el resto de
 * validadores solo cuando el valor es `undefined`/`null`; si llega un `precioBaseCentavos`, tiene
 * que ser un entero ≥ 0 igual que en el alta. Actualizar no es una puerta trasera para meter un
 * decimal que `CrearServicioDto` rechazaría (`RN-COT-07`).
 *
 * `undefined` y ausente son lo mismo aquí; no existe "borrar un campo" en este recurso, así que
 * ningún campo acepta `null` como valor con significado propio.
 */
export class ActualizarServicioDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  categoria?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  duracionBaseMinutos?: number;

  /** Importe en **centavos** enteros (`RN-COT-07`) — misma exigencia que al crear. */
  @IsOptional()
  @IsInt()
  @Min(0)
  precioBaseCentavos?: number;
}
