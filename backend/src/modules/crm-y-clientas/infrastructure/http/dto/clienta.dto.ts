import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RegistrarClientaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nombre!: string;

  /**
   * Se valida como texto, no con un patrón estricto: el dominio lo normaliza a solo dígitos y
   * exige al menos 10. Un patrón aquí rechazaría formatos legítimos (`+52`, paréntesis, guiones)
   * que recepción teclea a diario.
   */
  @IsString()
  @MinLength(10)
  @MaxLength(25)
  telefono!: string;
}

export class BuscarPorTelefonoDto {
  @IsString()
  @MinLength(10)
  @MaxLength(25)
  telefono!: string;
}

export class BuscarPorTelefonoAnteriorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nombre!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(25)
  telefonoAnterior!: string;
}

export class CambiarTelefonoDto {
  @IsString()
  @MinLength(10)
  @MaxLength(25)
  nuevoTelefono!: string;
}

export class CambiarEstadoDeRiesgoDto {
  @IsIn(['marcar_lista_roja', 'marcar_bloqueada', 'rehabilitar'])
  accion!: 'marcar_lista_roja' | 'marcar_bloqueada' | 'rehabilitar';

  /** Para que la auditoría guarde el *por qué*, no solo el *qué*. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class ClientaIdDto {
  @IsUUID()
  id!: string;
}
