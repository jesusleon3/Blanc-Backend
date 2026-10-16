import { NavLink, Outlet } from 'react-router-dom';
import { useSesion } from '../auth/sesion';
import { esDeOperacion } from '../auth/roles';
import { ETIQUETA_DE_ROL } from './etiquetas';
import { ContadorDeEscaladas } from './ContadorDeEscaladas';
import { Boton } from './Boton';

const ENLACES = [
  { a: '/bandeja', texto: 'Bandeja' },
  { a: '/anticipos', texto: 'Anticipos' },
  { a: '/clientas', texto: 'Clientas' },
  { a: '/agenda', texto: 'Agenda' },
] as const;

/**
 * Marco del panel operativo.
 *
 * **Solo lo monta la rama de rutas de operación** (`ROLES_DE_OPERACION`), y de ahí sale que no haya
 * ni un condicional de rol en la navegación: la Manicurista nunca llega a este componente, así que
 * no hay forma de que vea un enlace a la Bandeja ni a Clientas aunque alguien se equivoque al
 * editar esta lista. Ocultar enlaces con `if` dentro de un layout compartido es la forma habitual
 * de que un día se filtre uno.
 */
export function Layout() {
  const { perfil, correo, cerrarSesion } = useSesion();

  return (
    <div className="min-h-screen bg-fondo-tenue">
      <header className="sticky top-0 z-10 border-b border-borde bg-fondo-elevado/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-contenido items-center gap-6 px-4 sm:px-6">
          <span className="text-lg font-semibold tracking-tight text-texto">
            Blanc<span className="text-acentuado">.</span>
          </span>

          <nav className="flex items-center gap-1" aria-label="Secciones">
            {ENLACES.map((enlace) => (
              <NavLink
                key={enlace.a}
                to={enlace.a}
                className={({ isActive }) =>
                  `rounded px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? 'bg-acento-50 text-acento-700' : 'text-texto-secundario hover:bg-fondo-apagado hover:text-texto'
                  }`
                }
              >
                {enlace.texto}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {/* El contador vive en el encabezado y no en la Bandeja: `DEC-046` pide que se vea en
                toda la aplicación, porque el momento en que hace falta es justo cuando se está en
                otra pantalla. */}
            {esDeOperacion(perfil?.rol) ? <ContadorDeEscaladas /> : null}

            <div className="hidden text-right leading-tight sm:block">
              <p className="text-xs font-medium text-texto">{correo}</p>
              <p className="text-[11px] text-texto-terciario">{perfil ? ETIQUETA_DE_ROL[perfil.rol] : ''}</p>
            </div>
            <Boton variante="fantasma" onClick={() => void cerrarSesion()}>
              Salir
            </Boton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-contenido px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
