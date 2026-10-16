import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RegistrarAusenciaDto {
  @IsUUID()
  manicuristaId!: string;

  @IsISO8601({ strict: true })
  inicio!: string;

  @IsISO8601({ strict: true })
  fin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class RegistrarCoberturaDto extends RegistrarAusenciaDto {
  /** Obligatorio: una cobertura sin destino restaría capacidad sin sumarla en ningún lado. */
  @IsUUID()
  sucursalId!: string;
}

/** Filtro del listado. El rango es obligatorio: una lectura sin acotar no está acotada. */
export class ListarExcepcionesDto {
  @IsISO8601({ strict: true })
  inicio!: string;

  @IsISO8601({ strict: true })
  fin!: string;

  /**
   * Opcional. **Incluye las ausencias de las manicuristas asignadas a esa sucursal**, no solo las
   * coberturas con ese destino — ver la nota de `ListarExcepcionesPersonalUseCase`.
   */
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}
