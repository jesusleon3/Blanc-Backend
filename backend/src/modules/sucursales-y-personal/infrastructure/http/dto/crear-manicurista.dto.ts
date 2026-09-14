import { IsString, MinLength } from 'class-validator';

export class CrearManicuristaDto {
  @IsString()
  @MinLength(1)
  nombre!: string;
}
