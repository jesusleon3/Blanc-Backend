import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AgendarCitaDto {
  @IsUUID()
  sucursalId!: string;

  @IsUUID()
  servicioId!: string;

  @IsUUID()
  clientaId!: string;

  /** Instante absoluto en ISO-8601 **con zona**. Ver `ZONA_HORARIA_NEGOCIO` sobre hora de pared. */
  @IsISO8601({ strict: true })
  inicio!: string;

  @IsISO8601({ strict: true })
  fin!: string;

  /** Ausente = la clienta no eligió. La Encargada asigna al llegar (`DEC-031`). */
  @IsOptional()
  @IsUUID()
  manicuristaId?: string;
}

export class AsignarManicuristaDto {
  @IsUUID()
  manicuristaId!: string;
}

export class CancelarCitaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class ReprogramarCitaDto {
  @IsISO8601({ strict: true })
  inicio!: string;

  @IsISO8601({ strict: true })
  fin!: string;

  @IsOptional()
  @IsUUID()
  manicuristaId?: string;
}

export class ConsultarDisponibilidadDto {
  @IsUUID()
  sucursalId!: string;

  @IsISO8601({ strict: true })
  inicio!: string;

  @IsISO8601({ strict: true })
  fin!: string;
}

export class CrearSillaDto {
  @IsUUID()
  sucursalId!: string;

  @IsString()
  @MinLength(1)
  nombre!: string;
}
