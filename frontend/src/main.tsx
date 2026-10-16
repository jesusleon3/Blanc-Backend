import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ProveedorDeSesion } from './auth/sesion';
import { ErrorDeApi } from './api/cliente';
import './estilos/global.css';

/**
 * Configuración de TanStack Query. Las tres opciones responden a casos concretos:
 *
 * - **No se reintenta un error de negocio.** Un `409` o un `403` van a fallar igual la segunda vez;
 *   reintentarlos solo retrasa el mensaje que quien opera necesita leer. Sí se reintenta una vez
 *   ante un fallo de red, que es el caso en que insistir sirve de algo.
 * - **`staleTime` corto**: casi todo aquí se sondea con su propio intervalo, y un `staleTime` largo
 *   haría que un cambio de filtro mostrara datos viejos.
 * - **Sin reintento en mutaciones**: repetir un envío de WhatsApp duplicaría el mensaje.
 */
const clienteDeConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: (intentos, error) => {
        if (error instanceof ErrorDeApi) return false;
        return intentos < 1;
      },
    },
    mutations: { retry: false },
  },
});

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('No existe el elemento #raiz en index.html.');

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={clienteDeConsultas}>
      <BrowserRouter>
        {/* La sesión va DENTRO del router: `ExigeSesion` usa `useLocation` para guardar el destino. */}
        <ProveedorDeSesion>
          <App />
        </ProveedorDeSesion>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
