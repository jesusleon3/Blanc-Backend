import { Type } from 'class-transformer';
import { IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { HorarioSemanalDto } from './horario-semanal.dto';

export class CrearSucursalDto {
  @IsString()
  @MinLength(1)
  nombre!: string;

  @IsOptional()
  @IsString()
  numeroWhatsappAlias?: string;

  @ValidateNested()
  @Type(() => HorarioSemanalDto)
  horarioSemanal!: HorarioSemanalDto;

  @IsOptional()
  descansos?: unknown;
}
