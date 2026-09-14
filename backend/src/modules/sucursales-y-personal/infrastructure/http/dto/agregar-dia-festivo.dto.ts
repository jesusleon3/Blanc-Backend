import { IsOptional, IsString, Matches } from 'class-validator';

export class AgregarDiaFestivoDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
