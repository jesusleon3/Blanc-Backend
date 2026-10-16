import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Rol } from '../api/contrato';
import { useSesion } from './sesion';
import { rutaInicialDe } from './roles';
import { Cargando } from '../componentes/Cargando';
import { AvisoSinAcceso } from '../componentes/AvisoSinAcceso';

/**
 * Exige sesión. **Mientras el estado es `cargando` no decide nada**, y eso es lo importante: si
 * redirigiera al login durante la restauración de la sesión, cada refresco de página expulsaría a
 * quien sí tiene sesión.
 */
export function ExigeSesion({ children }: { children: ReactNode }) {
  const { estado } = useSesion();
  const ubicacion = useLocation();

  if (estado === 'cargando') return <Cargando mensaje="Restaurando tu sesión…" />;

  if (estado === 'anonima') {
    // `state.destino` para volver a donde iba tras entrar: con una bandeja que se abre desde un
    // enlace, perder el destino obliga a navegar otra vez a mano.
    return <Navigate to="/entrar" replace state={{ destino: ubicacion.pathname }} />;
  }

  if (estado === 'sin-perfil') {
    return (
      <AvisoSinAcceso
        titulo="Tu cuenta no tiene acceso a Blanc"
        detalle="Tus credenciales son correctas, pero esta cuenta no está dada de alta como usuaria de la plataforma, o fue desactivada. Pídele a la Dueña que la habilite."
      />
    );
  }

  return <>{children}</>;
}

/**
 * Exige sesión **y** uno de los roles indicados.
 *
 * Recordatorio de `ADR-027`: esto decide **qué se dibuja**. La autorización está en el `@Roles` del
 * backend, que revalida con los permisos resueltos en servidor.
 *
 * A quien no le toca **no se le muestra un 403**: se le redirige a su propia pantalla inicial. Una
 * Manicurista que abra `/bandeja` por un enlace compartido debe acabar en su agenda, no en un
 * error — el error sería correcto y sería mala atención.
 */
export function ExigeRol({ roles, children }: { roles: readonly Rol[]; children: ReactNode }) {
  const { estado, perfil } = useSesion();

  if (estado === 'cargando') return <Cargando mensaje="Comprobando tus permisos…" />;
  if (estado !== 'activa' || !perfil) return <ExigeSesion>{children}</ExigeSesion>;

  if (!roles.includes(perfil.rol)) return <Navigate to={rutaInicialDe(perfil.rol)} replace />;

  return <>{children}</>;
}
