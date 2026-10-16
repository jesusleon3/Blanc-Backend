import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class ConsultarResumenDto {
  /** ISO. El rango es obligatorio: una lectura sin acotar no está acotada. */
  @IsISO8601({ strict: true })
  desde!: string;

  @IsISO8601({ strict: true })
  hasta!: string;

  /**
   * Opcional. **No afecta a los anticipos**, que se reportan globales: su tabla no guarda la
   * sucursal y cruzarla exigiría un `JOIN` entre esquemas (`ADR-005`). La respuesta lo advierte.
   */
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}
