import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma';

const CLASES: Record<Variante, string> = {
  primario: 'bg-acento-600 text-white hover:bg-acento-700 disabled:bg-acento-300',
  secundario: 'border border-borde-fuerte bg-fondo-elevado text-texto hover:bg-fondo-apagado',
  peligro: 'border border-peligro/30 bg-peligro-suave text-peligro hover:bg-peligro hover:text-white',
  fantasma: 'text-texto-secundario hover:bg-fondo-apagado hover:text-texto',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  cargando?: boolean;
  children: ReactNode;
}

export function Boton({ variante = 'primario', cargando = false, children, className = '', disabled, ...resto }: Props) {
  return (
    <button
      // `type="button"` por defecto: el `submit` implícito de un botón dentro de un formulario es
      // una fuente clásica de envíos accidentales. Quien lo quiera lo pasa explícitamente.
      type="button"
      // `aria-busy` y no solo el texto: un lector de pantalla tiene que poder anunciar la espera.
      aria-busy={cargando}
      disabled={disabled ?? cargando}
      className={`inline-flex items-center justify-center gap-2 rounded px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${CLASES[variante]} ${className}`}
      {...resto}
    >
      {cargando ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}
