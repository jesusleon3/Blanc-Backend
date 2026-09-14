import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Rol } from '../../../../../shared/auth/rol';

export class EditarUsuarioDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsEnum(Rol)
  rol?: Rol;
}
