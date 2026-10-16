import { peticion } from './cliente';
import type { ResumenAnalitico } from './contrato';

export const analiticaApi = {
  /**
   * Resumen ejecutivo por rango. **Solo `SUPER_ADMIN` y `ADMINISTRADOR`** — la Encargada recibe
   * `403`, porque el desglose por manicurista es una medida del trabajo de sus compañeras.
   *
   * El rango es obligatorio y el backend lo acota a 400 días.
   */
  resumen: (desde: string, hasta: string, sucursalId?: string) =>
    peticion<ResumenAnalitico>('/v1/analitica/resumen', { query: { desde, hasta, sucursalId } }),
};
