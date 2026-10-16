import { peticion } from './cliente';
import type { Servicio } from './contrato';

export const catalogoApi = {
  servicios: () => peticion<{ servicios: Servicio[] }>('/v1/catalogo-y-cotizacion/servicios'),
};
