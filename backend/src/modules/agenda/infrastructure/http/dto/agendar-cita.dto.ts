import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { EsInstanteIso } from '../../../../../shared/validacion/es-instante-iso.decorator';

export class AgendarCitaDto {
  @IsUUID()
  sucursalId!: string;

  @IsUUID()
  servicioId!: string;

  @IsUUID()
  clientaId!: string;

  /** Instante absoluto en ISO-8601 **con zona**. Ver `ZONA_HORARIA_NEGOCIO` sobre hora de pared. */
  @EsInstanteIso()
  inicio!: string;

  /**
   * **Opcional, y lo normal es omitirlo**: el fin lo deriva el backend de la duración del servicio
   * en el catálogo. Se sigue aceptando para poder **rechazarlo** si no coincide (409
   * `DURACION_NO_COINCIDE_CON_SERVICIO`), en vez de ignorarlo en silencio y reservar un hueco de
   * otro tamaño del que el cliente creía.
   */
  @IsOptional()
  @EsInstanteIso()
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
  @EsInstanteIso()
  inicio!: string;

  /** Igual que en `AgendarCitaDto`: opcional, derivado del catálogo, rechazado si no coincide. */
  @IsOptional()
  @EsInstanteIso()
  fin?: string;

  @IsOptional()
  @IsUUID()
  manicuristaId?: string;

  /** `RN-ANT-04` pide *"una alerta de confirmación explícita"* al reagendar con anticipo pagado. */
  @IsOptional()
  @IsBoolean()
  confirmacionDeEmpleado?: boolean;
}

/**
 * Query de `GET /v1/agenda/disponibilidad`.
 *
 * ## ESTE DTO EXISTÍA Y EL CONTROLADOR NO LO USABA (auditoría 2026-10-17)
 *
 * La validación estaba escrita; `SillasController.disponibilidad` leía los tres parámetros como
 * `@Query('...') x: string` sueltos y nunca pasaba por aquí. Tres formas de llegar a un
 * `500 ERROR_INESPERADO`:
 *
 * - **Sin `inicio`**: `new Date(undefined)` es `Invalid Date`, y `diaDeLaSemana` lanza el
 *   `RangeError` de `Intl` al formatearla. No es un `DomainError`, así que no se traduce.
 * - **`sucursalId` que no es uuid**: llega a PostgreSQL y vuelve como `22P02`, que
 *   `HttpExceptionFilter` tampoco traduce.
 * - **Una fecha de pared**: no fallaba, que es peor — desplazaba la consulta seis horas.
 *
 * Era el único endpoint de la API sin DTO cableado, y conviene decir por qué importa más de lo que
 * parece: lo va a consultar el bot para proponer horarios, así que un 500 aquí es un 500 en medio
 * de una conversación con una clienta.
 */
export class ConsultarDisponibilidadDto {
  @IsUUID()
  sucursalId!: string;

  @EsInstanteIso()
  inicio!: string;

  @EsInstanteIso()
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

  @EsInstanteIso()
  inicio!: string;

  @EsInstanteIso()
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

  @EsInstanteIso()
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

