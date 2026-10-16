import { peticion } from './cliente';
import type { PerfilUsuario } from './contrato';

export const identidadApi = {
  /**
   * Quién soy. **El rol NO viaja en el JWT** (`DEC-029`): se resuelve contra PostgreSQL, porque su
   * fuente de verdad es Blanc y no Supabase. Sin esto, el cliente tendría que adivinarlo.
   */
  yo: () => peticion<PerfilUsuario>('/v1/identidad-y-accesos/usuarios/yo'),
};
