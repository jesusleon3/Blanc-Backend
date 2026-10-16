import type { Config } from 'tailwindcss';

/**
 * Tema de Tailwind sobre los tokens que YA EXISTEN en `mockup/css/tokens.css`.
 *
 * La identidad visual de Blanc no se inventa aquí: el mockup comercial —rosa profundo / burdeos,
 * `--accent-500: #cf3f77`— es el que se le enseñó al cliente, y la aplicación real tiene que
 * parecerse a lo que aprobó. Lo que se hace es declarar esos valores como escala de Tailwind.
 *
 * Los colores **semánticos** (`fondo`, `texto`, `borde`…) se resuelven por variable CSS, no por
 * valor fijo, y es la razón de que el tema oscuro funcione sin duplicar ninguna clase: la variable
 * cambia en `:root[data-theme="dark"]` y el marcado no se toca.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        acento: {
          50: '#fdf2f6',
          100: '#fce7ee',
          200: '#f9cedd',
          300: '#f2a3c0',
          400: '#e56e9a',
          500: '#cf3f77',
          600: '#ad2860',
          700: '#8c1e4e',
          800: '#711b41',
          900: '#5f1938',
        },
        exito: { DEFAULT: '#17a673', suave: 'var(--success-100)' },
        aviso: { DEFAULT: '#d68a13', suave: 'var(--warning-100)' },
        peligro: { DEFAULT: '#dc3545', suave: 'var(--danger-100)' },
        info: { DEFAULT: '#2b6ee0', suave: 'var(--info-100)' },

        // Semánticos: por variable, para que el tema oscuro no duplique clases.
        fondo: 'var(--bg)',
        'fondo-tenue': 'var(--bg-subtle)',
        'fondo-apagado': 'var(--bg-muted)',
        'fondo-elevado': 'var(--bg-elevated)',
        borde: 'var(--border)',
        'borde-fuerte': 'var(--border-strong)',
        texto: 'var(--text)',
        'texto-secundario': 'var(--text-secondary)',
        'texto-terciario': 'var(--text-tertiary)',
        'sobre-acento': 'var(--text-on-accent)',
        acentuado: 'var(--accent)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: { sm: '6px', DEFAULT: '10px', md: '10px', lg: '14px', xl: '20px' },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      maxWidth: { contenido: '1360px' },
    },
  },
  plugins: [],
} satisfies Config;
