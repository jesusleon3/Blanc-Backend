import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSesion } from '../../auth/sesion';
import { rutaInicialDe } from '../../auth/roles';
import { hayConfiguracionDeSupabase } from '../../auth/supabase';
import { Boton } from '../../componentes/Boton';
import { Cargando } from '../../componentes/Cargando';

/**
 * Pantalla de acceso.
 *
 * ## EL LOGIN VA CONTRA SUPABASE AUTH, NO CONTRA BLANC
 *
 * No hay `POST /v1/auth/login` en el backend, y no debe haberlo: `ADR-024` evaluó esa opción
 * —*"Blanc emite su propio JWT tras validar el de Supabase"*— y **la rechazó** por duplicar la
 * superficie de emisión de tokens sin ganar nada. El JWT lo emite Supabase y Blanc lo verifica.
 *
 * Tras entrar, el rol se obtiene de `GET /usuarios/yo`, **no del token** (`DEC-029`), y de ahí sale
 * la pantalla de destino: la Manicurista a su agenda, el resto a la Bandeja.
 */
export function Entrar() {
  const { estado, perfil, iniciarSesion } = useSesion();
  const ubicacion = useLocation();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (estado === 'cargando') return <Cargando mensaje="Restaurando tu sesión…" />;

  if (estado === 'activa' && perfil) {
    // El destino guardado por la guarda tiene prioridad: si alguien abrió un enlace a una
    // conversación concreta, debe acabar ahí y no en la pantalla inicial de su rol.
    const destino = (ubicacion.state as { destino?: string } | null)?.destino;
    return <Navigate to={destino ?? rutaInicialDe(perfil.rol)} replace />;
  }

  const configurado = hayConfiguracionDeSupabase();

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await iniciarSesion(correo, contrasena);
    } catch (fallo) {
      // El mensaje de Supabase es genérico a propósito ("Invalid login credentials") para no
      // revelar si el correo existe. Se muestra tal cual en vez de inventar uno más amable, que
      // induciría a probar contraseñas.
      setError(fallo instanceof Error ? fallo.message : 'No se pudo iniciar sesión.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-fondo-tenue px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-texto">
            Blanc<span className="text-acentuado">.</span>
          </h1>
          <p className="mt-2 text-sm text-texto-secundario">Panel operativo</p>
        </div>

        <form onSubmit={enviar} className="rounded-lg border border-borde bg-fondo-elevado p-6 shadow" noValidate>
          {!configurado ? (
            <div role="alert" className="mb-5 rounded border border-aviso/30 bg-aviso-suave px-3 py-2.5 text-xs text-aviso">
              Falta configurar <code className="font-mono">VITE_SUPABASE_URL</code> y{' '}
              <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>. Ver <code className="font-mono">.env.example</code>.
            </div>
          ) : null}

          <label htmlFor="correo" className="block text-sm font-medium text-texto">
            Correo
          </label>
          <input
            id="correo"
            type="email"
            autoComplete="username"
            required
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            className="mt-1.5 w-full rounded border border-borde bg-fondo px-3 py-2.5 text-sm text-texto placeholder:text-texto-terciario"
            placeholder="tucorreo@blanc.mx"
          />

          <label htmlFor="contrasena" className="mt-4 block text-sm font-medium text-texto">
            Contraseña
          </label>
          <input
            id="contrasena"
            type="password"
            autoComplete="current-password"
            required
            value={contrasena}
            onChange={(evento) => setContrasena(evento.target.value)}
            className="mt-1.5 w-full rounded border border-borde bg-fondo px-3 py-2.5 text-sm text-texto"
          />

          {error ? (
            <p role="alert" className="mt-4 rounded border border-peligro/30 bg-peligro-suave px-3 py-2.5 text-sm text-peligro">
              {error}
            </p>
          ) : null}

          <Boton type="submit" cargando={enviando} disabled={!configurado} className="mt-6 w-full">
            Entrar
          </Boton>
        </form>
      </div>
    </div>
  );
}
