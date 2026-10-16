import { useSesion } from '../auth/sesion';

/**
 * Pantalla para quien está autenticada pero no puede usar esta parte del producto.
 *
 * Existe porque *"no tienes acceso"* y *"tus credenciales son incorrectas"* son cosas distintas, y
 * mandar al login a alguien del primer caso la haría intentar la contraseña una y otra vez. Lleva
 * el botón de cerrar sesión porque es la única acción útil que le queda.
 */
export function AvisoSinAcceso({ titulo, detalle }: { titulo: string; detalle: string }) {
  const { correo, cerrarSesion } = useSesion();

  return (
    <div className="flex min-h-screen items-center justify-center bg-fondo-tenue p-6">
      <div className="w-full max-w-md rounded-lg border border-borde bg-fondo-elevado p-8 shadow">
        <h1 className="text-lg font-semibold text-texto">{titulo}</h1>
        <p className="mt-3 text-sm leading-relaxed text-texto-secundario">{detalle}</p>
        {correo ? <p className="mt-4 text-xs text-texto-terciario">Sesión actual: {correo}</p> : null}
        <button
          type="button"
          onClick={() => void cerrarSesion()}
          className="mt-6 w-full rounded bg-acento-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-acento-700"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
