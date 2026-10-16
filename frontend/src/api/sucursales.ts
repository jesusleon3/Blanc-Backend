import { peticion } from './cliente';
import type { Sucursal } from './contrato';

export const sucursalesApi = {
  /** El filtro por sucursal de la Bandeja se alimenta de aquí. */
  listar: () => peticion<{ sucursales: Sucursal[] }>('/v1/sucursales-y-personal/sucursales'),
};
