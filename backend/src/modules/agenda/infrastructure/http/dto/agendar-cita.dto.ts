import { IsISO8601, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

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

  /**
   * **Opcional, y lo normal es omitirlo**: el fin lo deriva el backend de la duración del servicio
   * en el catálogo. Se sigue aceptando para poder **rechazarlo** si no coincide (409
   * `DURACION_NO_COINCIDE_CON_SERVICIO`), en vez de ignorarlo en silencio y reservar un hueco de
   * otro tamaño del que el cliente creía.
   */
  @IsOptional()
  @IsISO8601({ strict: true })
  fin?: string;

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

  /** Igual que en `AgendarCitaDto`: opcional, derivado del catálogo, rechazado si no coincide. */
  @IsOptional()
  @IsISO8601({ strict: true })
  fin?: string;

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

/** Tope de días que puede abarcar una consulta de agenda. Ver `ConsultarAgendaDto`. */
export const MAXIMO_DIAS_DE_CONSULTA = 31;
/** Tope duro de citas por página, aunque el cliente pida más. */
export const MAXIMO_CITAS_POR_PAGINA = 200;
export const CITAS_POR_PAGINA_POR_DEFECTO = 100;

/**
 * Parámetros del `GET` de agenda — **acotados a propósito** (deuda 5 de §16).
 *
 * Antes, `sucursalId`, `inicio` y `fin` llegaban como strings sueltos sin validar y sin límite:
 * un rango de un año devolvía todas las citas de la sucursal en un solo JSON, y una fecha mal
 * escrita llegaba como `Invalid Date` hasta el `tstzrange`. Un iPad en el salón pidiendo *el día*
 * no necesita más de esto, y el tope protege a la base de una consulta que nadie quiso hacer.
 */
export class ConsultarAgendaDto {
  @IsUUID()
  sucursalId!: string;

  @IsISO8601({ strict: true })
  inicio!: string;

  @IsISO8601({ strict: true })
  fin!: string;

  /**
   * `@Type` es imprescindible: los parámetros de query llegan como string y sin la conversión
   * explícita `@IsInt()` fallaría siempre, incluso para un `limite=50` perfectamente válido.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAXIMO_CITAS_POR_PAGINA)
  limite?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desplazamiento?: number;
}
