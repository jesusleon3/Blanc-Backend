import { IsISO8601, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Tope de la ventana del turno: 24 horas. Más allá, la fila deja de avanzar en un día de trabajo. */
export const MAXIMO_MINUTOS_DE_VENTANA = 1440;

export class InscribirEnListaEsperaDto {
  @IsUUID()
  sucursalId!: string;

  @IsUUID()
  clientaId!: string;

  @IsUUID()
  servicioId!: string;

  /**
   * Fecha de pared `YYYY-MM-DD` en la zona del negocio, **no un instante**: la clienta pide "el
   * jueves". Se valida con un patrón y no con `@IsISO8601()` porque este último también aceptaría
   * una fecha con hora, y aquí la hora no significa nada.
   */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener el formato YYYY-MM-DD' })
  fecha!: string;
}

export class ConsultarListaEsperaDto {
  @IsUUID()
  sucursalId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener el formato YYYY-MM-DD' })
  fecha!: string;
}

export class AceptarOfertaDto {
  /**
   * Hora concreta que toma la clienta. **El fin lo deriva el catálogo**, igual que al agendar.
   *
   * Se pide explícitamente y no se deduce de la oferta porque la oferta no retiene el hueco
   * (`RN-AGE-13`): entre el aviso y la respuesta la agenda pudo cambiar, y quien atiende la
   * llamada puede estar acordando otra hora del mismo día.
   */
  @IsISO8601({ strict: true })
  inicio!: string;

  @IsOptional()
  @IsUUID()
  manicuristaId?: string;
}

export class AvanzarTurnoDto {
  /** Minutos de la ventana del turno. Por defecto 60 (`DEC-039`). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAXIMO_MINUTOS_DE_VENTANA)
  minutosDeVentana?: number;
}
