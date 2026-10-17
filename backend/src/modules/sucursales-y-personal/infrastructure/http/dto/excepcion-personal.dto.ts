import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { EsInstanteIso } from '../../../../../shared/validacion/es-instante-iso.decorator';

export class RegistrarAusenciaDto {
  @IsUUID()
  manicuristaId!: string;

  @EsInstanteIso()
  inicio!: string;

  @EsInstanteIso()
  fin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class RegistrarCoberturaDto extends RegistrarAusenciaDto {
  /** Obligatorio: una cobertura sin destino restaría capacidad sin sumarla en ningún lado. */
  @IsUUID()
  sucursalId!: string;
}

/** Filtro del listado. El rango es obligatorio: una lectura sin acotar no está acotada. */
export class ListarExcepcionesDto {
  @EsInstanteIso()
  inicio!: string;

  @EsInstanteIso()
  fin!: string;

  /**
   * Opcional. **Incluye las ausencias de las manicuristas asignadas a esa sucursal**, no solo las
   * coberturas con ese destino — ver la nota de `ListarExcepcionesPersonalUseCase`.
   */
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}
