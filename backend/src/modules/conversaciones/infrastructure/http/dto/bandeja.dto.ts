import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { MODOS_CONVERSACION, MOTIVOS_DE_ESCALAMIENTO } from '../../../../../database/schema';
import { MAXIMO_CONVERSACIONES_POR_PAGINA, MAXIMO_MENSAJES_POR_PAGINA } from '../../../application/use-cases/bandeja.use-cases';

export class ListarBandejaDto {
  @IsOptional()
  @IsUUID()
  sucursalId?: string;

  @IsOptional()
  @IsIn([...MODOS_CONVERSACION])
  modo?: (typeof MODOS_CONVERSACION)[number];

  /** `true` = solo las que tienen mensajes de la clienta sin responder. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  soloPendientes?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAXIMO_CONVERSACIONES_POR_PAGINA)
  limite?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desplazamiento?: number;
}

export class ListarMensajesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAXIMO_MENSAJES_POR_PAGINA)
  limite?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desplazamiento?: number;
}

export class EnviarMensajeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  texto!: string;
}

export class EnviarPlantillaDto {
  /** Nombre de la plantilla **ya aprobada por Meta**. El inventario es `N-14`, sin cerrar. */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  plantilla!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  idioma?: string;

  @IsOptional()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  parametros?: string[];
}

export class EscalarDto {
  @IsIn([...MOTIVOS_DE_ESCALAMIENTO])
  motivo!: (typeof MOTIVOS_DE_ESCALAMIENTO)[number];
}

export class RegistrarNumeroDto {
  /** `phone_number_id` que asigna Meta al número de esa sucursal. */
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  phoneNumberId!: string;

  @IsUUID()
  sucursalId!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(25)
  telefonoVisible!: string;
}
