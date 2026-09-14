import { ClaimsUsuario, IdentidadAutenticada } from './rol';

/**
 * Dos campos, no uno — corresponden a las dos etapas de la cadena de guards (`DEC-029`):
 *
 *   JwtAuthGuard        escribe `identidad`  → { sub }, solo lo que la firma garantiza
 *   AuthorizationGuard  escribe `usuario`    → ClaimsUsuario, con rol/sucursales de PostgreSQL
 *
 * Separarlos no es estética: hace imposible que un consumidor lea un rol que nadie verificó
 * contra la base de datos. `RolesGuard` y `@CurrentUser()` leen `usuario`, así que solo ven
 * datos ya autorizados; si la cadena estuviera mal ordenada, `usuario` sería `undefined` y el
 * sistema fallaría cerrado en vez de confiar en el token.
 */
declare global {
  namespace Express {
    interface Request {
      /** Escrito por `JwtAuthGuard`. Presente en toda petición autenticada. */
      identidad?: IdentidadAutenticada;
      /** Escrito por `AuthorizationGuard`. Presente solo tras resolver permisos reales. */
      usuario?: ClaimsUsuario;
    }
  }
}
