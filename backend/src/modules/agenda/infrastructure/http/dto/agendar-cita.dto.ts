import { IsBoolean, IsISO8601, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
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

  /**
   * Aprobación explícita del empleado, **exigida solo cuando hay algo que advertir**: clienta en
   * lista roja (`RN-CRM-03`) o anticipo pagado que no se devuelve (`RN-ANT-04`).
   *
   * El flujo es de dos pasos a propósito: la primera llamada sin esto recibe un `409` que describe
   * la consecuencia, y hay que reintentar confirmando. Es la diferencia entre haber aprobado algo
   * y haberlo pulsado.
   */
  @IsOptional()
  @IsBoolean()
  confirmacionDeEmpleado?: boolean;
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

  /** `RN-ANT-04` pide *"una alerta de confirmación explícita"* al reagendar con anticipo pagado. */
  @IsOptional()
  @IsBoolean()
  confirmacionDeEmpleado?: boolean;
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

/**
 * Agendar una garantía (`RN-GAR-01..06`, cierre de `P10`).
 *
 * **No lleva `servicioId` ni `clientaId`**: los dos salen de la cita original. Dejar elegir el
 * servicio permitiría cambiar un retiro de $150 por un acrílico de $800 y cobrarlo como garantía.
 */
export class AgendarGarantiaDto {
  @IsUUID()
  citaGarantizadaId!: string;

  @IsISO8601({ strict: true })
  inicio!: string;

  @IsOptional()
  @IsUUID()
  manicuristaId?: string;

  /** Qué reportó la clienta. Va a la auditoría: es el rastro de por qué se concedió. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
