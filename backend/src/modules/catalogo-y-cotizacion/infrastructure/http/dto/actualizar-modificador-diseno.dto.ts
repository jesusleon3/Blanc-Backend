import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

/**
 * Cuerpo de `PATCH /v1/catalogo-y-cotizacion/modificadores-diseno/:id`.
 *
 * Mismas garantías que `ActualizarServicioDto` — ver la nota sobre `@IsOptional()` y `RN-COT-07`
 * en ese archivo.
 *
 * **Sin campo `activo`**: la baja y el alta se hacen por su propio endpoint
 * (`POST /:id/desactivar`), no editando un booleano. Un cambio de estado del catálogo merece una
 * acción explícita y su propia entrada de auditoría, no confundirse con una edición de datos.
 */
export class ActualizarModificadorDisenoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minutosAdicionales?: number;

  /** Importe en **centavos** enteros (`RN-COT-07`) — misma exigencia que al crear. */
  @IsOptional()
  @IsInt()
  @Min(0)
  precioAdicionalCentavos?: number;
}
