import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { _sustituirClienteDeSupabase } from '../auth/supabase';
import { ProveedorDeSesion } from '../auth/sesion';
import { ErrorDeApi } from '../api/cliente';

/**
 * Doble del cliente de Supabase.
 *
 * ## POR QUÉ SUPABASE SE DOBLA Y LA API DE BLANC NO
 *
 * Son dos fronteras distintas. La API de Blanc es **nuestro contrato** y hay que verificar su
 * forma, así que va por MSW con respuestas HTTP reales. Supabase Auth es un **servicio de
 * terceros** cuyo comportamiento no estamos probando: lo que importa es qué hace esta aplicación
 * con la sesión que devuelve. Doblarlo además es la única opción honesta — no hay credenciales en
 * este entorno (`ADR-027`), así que una prueba contra Supabase real no existe.
 */
function crearSupabaseFalso(sesion: Session | null): SupabaseClient {
  const falso = {
    auth: {
      getSession: async () => ({ data: { session: sesion }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ data: { session: sesion, user: sesion?.user ?? null }, error: null }),
      signOut: async () => ({ error: null }),
    },
  };
  return falso as unknown as SupabaseClient;
}

export function sesionFalsa(correo = 'duena@blanc.mx', token = 'token-de-prueba'): Session {
  return {
    access_token: token,
    refresh_token: 'refresh-de-prueba',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: 'usuario-1', email: correo, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' },
  } as unknown as Session;
}

interface OpcionesDeMontaje {
  /** `null` monta la aplicación sin sesión, para probar las guardas. */
  sesion?: Session | null;
  ruta?: string;
}

/**
 * Monta un árbol con router, caché de consultas y sesión.
 *
 * `retry: false` en las pruebas: con reintentos, un caso que espera un error tardaría segundos y
 * el fallo aparecería como un *timeout* en vez de como la aserción que falló.
 */
export function montar(elemento: ReactElement, { sesion = sesionFalsa(), ruta = '/' }: OpcionesDeMontaje = {}) {
  _sustituirClienteDeSupabase(crearSupabaseFalso(sesion));

  const cliente = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const Envoltorio = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>
        <ProveedorDeSesion>{children}</ProveedorDeSesion>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return render(elemento, { wrapper: Envoltorio });
}

/** Para las pruebas del cliente HTTP, que no montan componentes. */
export const esErrorDeApi = (valor: unknown): valor is ErrorDeApi => valor instanceof ErrorDeApi;
