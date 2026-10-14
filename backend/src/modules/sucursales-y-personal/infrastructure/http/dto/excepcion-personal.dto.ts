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
