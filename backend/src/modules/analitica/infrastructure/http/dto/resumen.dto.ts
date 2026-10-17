import { IsOptional, IsUUID } from 'class-validator';
import { EsInstanteIso } from '../../../../../shared/validacion/es-instante-iso.decorator';

export class ConsultarResumenDto {
  /** ISO. El rango es obligatorio: una lectura sin acotar no está acotada. */
  @EsInstanteIso()
  desde!: string;

  @EsInstanteIso()
  hasta!: string;

  /**
   * Opcional. **No afecta a los anticipos**, que se reportan globales: su tabla no guarda la
   * sucursal y cruzarla exigiría un `JOIN` entre esquemas (`ADR-005`). La respuesta lo advierte.
   */
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}
