import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { clienteDeSupabase } from './supabase';
import { configurarSesionDeApi } from '../api/cliente';
import { identidadApi } from '../api/identidad';
import type { PerfilUsuario } from '../api/contrato';

/**
 * Estado de la sesión. Los cuatro valores son excluyentes y el orden importa:
 *
 * - `cargando` — se está restaurando la sesión del almacenamiento. **Ninguna ruta debe decidir
 *   nada todavía**: si se decidiera aquí, un refresco de página expulsaría al login a alguien que
 *   sí tiene sesión.
 * - `anonima` — no hay sesión.
 * - `sin-perfil` — hay token de Supabase pero Blanc no reconoce a esa usuaria (`/yo` falló). Es un
 *   estado real y distinto de los otros dos: alguien con cuenta en Supabase y **sin registro en
 *   `identidad_accesos.usuarios`** o desactivada. Mandarla al login sería engañoso, porque sus
 *   credenciales son correctas; el problema es que no tiene acceso.
 * - `activa` — token y perfil.
 */
export type EstadoDeSesion = 'cargando' | 'anonima' | 'sin-perfil' | 'activa';

interface ContextoDeSesion {
  estado: EstadoDeSesion;
  perfil: PerfilUsuario | null;
  correo: string | null;
  iniciarSesion: (correo: string, contrasena: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const Contexto = createContext<ContextoDeSesion | null>(null);

export function ProveedorDeSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoDeSesion>('cargando');
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [correo, setCorreo] = useState<string | null>(null);

  /**
   * El token vive en una ref, no en estado.
   *
   * El cliente HTTP lo lee de forma **sincrónica** en cada petición, así que no puede depender del
   * ciclo de render de React: con `useState`, una petición disparada en el mismo tick que el login
   * leería el token anterior (o `null`).
   */
  const tokenRef = useRef<string | null>(null);

  const limpiar = useCallback(() => {
    tokenRef.current = null;
    setPerfil(null);
    setCorreo(null);
    setEstado('anonima');
  }, []);

  // Se configura una vez y antes de cualquier petición: `configurarSesionDeApi` solo guarda dos
  // funciones, y las dos leen de la ref, así que no hace falta reconfigurarlo al cambiar la sesión.
  useEffect(() => {
    configurarSesionDeApi(() => tokenRef.current, limpiar);
  }, [limpiar]);

  const resolverPerfil = useCallback(async (sesion: Session | null) => {
    if (!sesion) {
      tokenRef.current = null;
      setPerfil(null);
      setCorreo(null);
      setEstado('anonima');
      return;
    }

    tokenRef.current = sesion.access_token;
    setCorreo(sesion.user.email ?? null);

    try {
      // `/yo` es la fuente del rol: `DEC-029` establece que NO viaja en el token.
      setPerfil(await identidadApi.yo());
      setEstado('activa');
    } catch {
      // Token válido para Supabase, sin acceso en Blanc. Ver `sin-perfil` arriba.
      setPerfil(null);
      setEstado('sin-perfil');
    }
  }, []);

  useEffect(() => {
    let vigente = true;
    const cliente = clienteDeSupabase();

    void cliente.auth.getSession().then(({ data }) => {
      if (vigente) void resolverPerfil(data.session);
    });

    // Cubre el refresco de token y el cierre de sesión desde otra pestaña.
    const { data: suscripcion } = cliente.auth.onAuthStateChange((_evento, sesion) => {
      if (vigente) void resolverPerfil(sesion);
    });

    return () => {
      vigente = false;
      suscripcion.subscription.unsubscribe();
    };
  }, [resolverPerfil]);

  const iniciarSesion = useCallback(
    async (correoIngresado: string, contrasena: string) => {
      const { data, error } = await clienteDeSupabase().auth.signInWithPassword({
        email: correoIngresado.trim(),
        password: contrasena,
      });
      // Se propaga para que la pantalla de login muestre el motivo. Supabase devuelve el error en
      // el resultado, no lanzando, así que sin este `throw` un fallo pasaría por éxito.
      if (error) throw error;
      await resolverPerfil(data.session);
    },
    [resolverPerfil],
  );

  const cerrarSesion = useCallback(async () => {
    await clienteDeSupabase().auth.signOut();
    limpiar();
  }, [limpiar]);

  const valor = useMemo<ContextoDeSesion>(
    () => ({ estado, perfil, correo, iniciarSesion, cerrarSesion }),
    [estado, perfil, correo, iniciarSesion, cerrarSesion],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoDeSesion {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSesion debe usarse dentro de <ProveedorDeSesion>.');
  return contexto;
}
