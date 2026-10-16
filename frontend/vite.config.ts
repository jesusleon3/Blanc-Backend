// `vitest/config` y no `vite`: es el `defineConfig` que admite la clave `test`.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /**
     * El backend corre en 3000. Se usa proxy en desarrollo en lugar de CORS para que las peticiones
     * salgan del mismo origen, igual que en producción (estáticos servidos junto a la API). Así el
     * código no tiene dos modos de construir URLs.
     */
    proxy: { '/v1': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/pruebas/configuracion.ts'],
    css: false,
  },
});
