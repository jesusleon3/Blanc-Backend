import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { servidor } from './servidor';

/**
 * Entorno de pruebas del frontend.
 *
 * ## MSW, NO UN CLIENTE DOBLADO
 *
 * Es la decisión de `ADR-027` que más valor da: las pruebas interceptan **peticiones HTTP** y
 * responden con la forma real del contrato del backend. Doblar `conversacionesApi` probaría que los
 * componentes llaman a una función — sin decir nada sobre si la respuesta tiene la forma que el
 * backend devuelve. Con MSW, un cambio de forma en el backend rompe estas pruebas, que es lo que
 * se quiere de un cliente de API versionada mientras `P8` siga abierto y los tipos se escriban a
 * mano.
 */
beforeAll(() => servidor.listen({ onUnhandledRequest: 'error' }));
afterEach(() => servidor.resetHandlers());
afterAll(() => servidor.close());

// `matchMedia` no existe en jsdom y algún componente podría consultarlo al crecer.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((consulta: string) => ({
    matches: false,
    media: consulta,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
