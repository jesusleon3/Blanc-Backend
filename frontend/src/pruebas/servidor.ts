import { setupServer } from 'msw/node';

/** Servidor de MSW sin manejadores por defecto: cada prueba declara los que necesita. */
export const servidor = setupServer();
