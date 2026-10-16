import { IsOptional, IsUUID } from 'class-validator';

export class ListarManicuristasDto {
  /** Sin él, devuelve todas. Con él, solo las asignadas a esa sucursal. */
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}
