import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase Auth. **Es el único emisor de tokens del sistema.**
 *
 * ## POR QUÉ NO HAY UN `/v1/auth/login` EN BLANC
 *
 * `ADR-024` evaluó exactamente esa opción —*"Blanc emite su propio JWT tras validar el de
 * Supabase"*— y **la rechazó**: duplicaría la superficie de emisión de tokens (dos secretos, dos
 * mecanismos de firma, un endpoint de intercambio que proteger y mantener) sin ganar nada sobre
 * ir directo. El frontend obtiene el JWT de Supabase y lo manda a Blanc en `Authorization`.
 *
 * Como efecto secundario deseable, la rotación de refresh token con detección de reuso que
 * `ADR-010` exige la da `supabase-js` sin que Blanc la construya.
 *
 * ## ⚠️ NO VERIFICADO CONTRA SUPABASE REAL
 *
 * No hay credenciales en este entorno. Este flujo está construido contra el contrato documentado
 * de `supabase-js` y probado con un doble del cliente, **nunca contra el proyecto real** — misma
 * situación que `ADR-024` declaró para el backend y `ADR-008` para Meta. Es tarea de verificación
 * de despliegue, no decisión abierta.
 */

let clienteCache: SupabaseClient | null = null;

/** `true` si hay configuración de Supabase. Sin ella, el login no puede funcionar. */
export function hayConfiguracionDeSupabase(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

/**
 * El cliente, creado una sola vez.
 *
 * Lanza si falta configuración en lugar de devolver un cliente roto: un `createClient('', '')`
 * fallaría más tarde con un error de red indescifrable, y el diagnóstico real —*"falta una
 * variable de entorno"*— se perdería.
 */
export function clienteDeSupabase(): SupabaseClient {
  if (clienteCache) return clienteCache;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Ver .env.example.');
  }

  clienteCache = createClient(url, anonKey, {
    auth: {
      // Sesión persistente y refresco automático: el panel se abre al empezar el turno y se deja
      // abierto. Que la sesión se caiga a media mañana sería un fallo de operación, no de diseño.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return clienteCache;
}

/** Solo para pruebas: permite inyectar un doble y limpiarlo entre casos. */
export function _sustituirClienteDeSupabase(doble: SupabaseClient | null): void {
  clienteCache = doble;
}
