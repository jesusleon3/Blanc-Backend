import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { Rol } from '../../../../../shared/auth/rol';

export class CrearUsuarioDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  nombre!: string;

  @IsEnum(Rol)
  rol!: Rol;
}
