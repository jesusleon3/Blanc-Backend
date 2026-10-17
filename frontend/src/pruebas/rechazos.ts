import { afterEach, beforeEach, expect } from 'vitest';

/**
 * Vigila los **rechazos de promesa no gestionados** durante una prueba.
 *
 * ## POR QUÉ ESTO MERECE UN AYUDANTE PROPIO
 *
 * El patrón `onClick={async () => { await mutacion.mutateAsync(); ... }}` parece correcto y no lo
 * es: React **descarta** la promesa que devuelve un manejador de evento, así que cuando
 * `mutateAsync` rechaza —y rechaza en cada `409` o `403`— queda una promesa rechazada sin dueño.
 *
 * El error **sí se ve en pantalla** (`useMutation` lo guarda y `AvisoDeError` lo pinta), y por eso
 * ninguna prueba de interfaz lo detectaba. Lo que queda roto es otra cosa:
 *
 * - En el navegador, un `unhandledrejection` por cada fallo. Con un informador de errores
 *   conectado, cada `409` legítimo —"otra clienta tomó el lugar"— se reportaría como un fallo del
 *   programa.
 * - En las pruebas, Vitest lo marca como error suelto y advierte de que **puede causar falsos
 *   positivos**: una aserción que falle dentro de un `await` descartado no hace fallar su prueba.
 *
 * `mutate` no tiene este problema (no devuelve promesa). `mutateAsync` solo es correcto dentro de
 * un `try/catch`, o cuando quien llama hace algo con el rechazo.
 */
export function vigilarRechazosNoGestionados(): void {
  const capturados: unknown[] = [];
  const alRechazar = (motivo: unknown) => capturados.push(motivo);

  beforeEach(() => {
    capturados.length = 0;
    process.on('unhandledRejection', alRechazar);
  });

  afterEach(async () => {
    // Un rechazo sin manejador se reporta en un tick posterior: hay que dejarlo llegar antes de
    // comprobar, o la vigilancia pasaría siempre por mirar demasiado pronto.
    await new Promise((listo) => setTimeout(listo, 0));
    process.off('unhandledRejection', alRechazar);

    expect(
      capturados.map((motivo) => (motivo instanceof Error ? `${motivo.name}: ${motivo.message}` : String(motivo))),
      'Hubo un rechazo de promesa sin gestionar: casi siempre es un `await mutateAsync()` dentro de un manejador de evento sin `try/catch`.',
    ).toEqual([]);
  });
}
