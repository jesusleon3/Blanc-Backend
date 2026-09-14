import { Type } from 'class-transformer';
import { IsArray, IsString, Matches, ValidateNested } from 'class-validator';
import { HorarioSemanalData } from '../../../domain/value-objects/horario-semanal.vo';

export class BloqueHorarioDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'horaInicio debe tener formato HH:mm' })
  horaInicio!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'horaFin debe tener formato HH:mm' })
  horaFin!: string;
}

/** Un arreglo vacío significa "cerrado ese día" (ver HorarioSemanal, dominio). */
export class HorarioSemanalDto implements HorarioSemanalData {
  @IsArray() @ValidateNested({ each: true }) @Type(() => BloqueHorarioDto) lunes!: BloqueHorarioDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => BloqueHorarioDto) martes!: BloqueHorarioDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => BloqueHorarioDto) miercoles!: BloqueHorarioDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => BloqueHorarioDto) jueves!: BloqueHorarioDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => BloqueHorarioDto) viernes!: BloqueHorarioDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => BloqueHorarioDto) sabado!: BloqueHorarioDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => BloqueHorarioDto) domingo!: BloqueHorarioDto[];
}
