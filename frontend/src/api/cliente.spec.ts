import { describe, expect, it, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { servidor } from '../pruebas/servidor';
import { ErrorDeApi, configurarSesionDeApi, peticion } from './cliente';

/**
 * El cliente HTTP, probado contra respuestas HTTP reales.
 *
 * Lo que se verifica aquí es la traducción del formato de error de `ADR-013` a `ErrorDeApi` con su
 * **código de negocio accesible** — la pieza de la que depende que la interfaz pueda decir *"otra
 * clienta ganó el cupo"* en vez de *"error 409"*.
 */
describe('cliente HTTP', () => {
  beforeEach(() => {
    configurarSesionDeApi(() => 'token-abc', () => {});
  });

  it('manda el token en `Authorization`', async () => {
    let autorizacion: string | null = null;
    servidor.use(
      http.get('/v1/prueba', ({ request }) => {
        autorizacion = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    await peticion('/v1/prueba');

    expect(autorizacion).toBe('Bearer token-abc');
  });

  it('TRADUCE el formato de error de `ADR-013` conservando el CÓDIGO DE NEGOCIO', async () => {
    // Es el caso real: `409 HORARIO_NO_DISPONIBLE` al confirmar un anticipo significa que otra
    // clienta ganó el cupo (`RN-ANT-03`), y la interfaz tiene que poder distinguirlo de cualquier
    // otro 409. Si el código se perdiera, solo quedaría el texto, y ramificar por texto se rompe
    // en cuanto alguien mejora una redacción.
    servidor.use(
      http.post('/v1/anticipos/ant-1/confirmar-pago', () =>
        HttpResponse.json(
          {
            error: {
              category: 'domain',
              code: 'HORARIO_NO_DISPONIBLE',
              message: 'Ya no hay lugar a esa hora.',
              details: { sucursalId: 'suc-1' },
            },
          },
          { status: 409 },
        ),
      ),
    );

    const fallo = await peticion('/v1/anticipos/ant-1/confirmar-pago', { metodo: 'POST', cuerpo: {} }).catch((error: unknown) => error);

    expect(fallo).toBeInstanceOf(ErrorDeApi);
    const error = fallo as ErrorDeApi;
    expect(error.estado).toBe(409);
    expect(error.codigo).toBe('HORARIO_NO_DISPONIBLE');
    expect(error.es('HORARIO_NO_DISPONIBLE')).toBe(true);
    expect(error.es('SILLA_OCUPADA')).toBe(false);
    expect(error.categoria).toBe('domain');
    expect(error.detalles).toEqual({ sucursalId: 'suc-1' });
  });

  it('un 401 CIERRA LA SESIÓN en vez de reintentar', async () => {
    // El refresco de token lo gestiona `supabase-js`. Si aun así llega un 401, insistir solo
    // repetiría el fallo: lo correcto es volver al login.
    const alPerderSesion = vi.fn();
    configurarSesionDeApi(() => 'token-vencido', alPerderSesion);
    servidor.use(http.get('/v1/prueba', () => new HttpResponse(null, { status: 401 })));

    await expect(peticion('/v1/prueba')).rejects.toBeInstanceOf(ErrorDeApi);

    expect(alPerderSesion).toHaveBeenCalledTimes(1);
  });

  it('conserva el estado HTTP cuando el error NO tiene la forma de `ADR-013`', async () => {
    // No debería pasar, pero si pasa (un proxy, un 502 de la plataforma) el estado es lo único que
    // queda para diagnosticar y no se puede perder.
    servidor.use(http.get('/v1/prueba', () => new HttpResponse('upstream caído', { status: 502 })));

    const error = (await peticion('/v1/prueba').catch((fallo: unknown) => fallo)) as ErrorDeApi;

    expect(error.estado).toBe(502);
    expect(error.codigo).toBe('RESPUESTA_INESPERADA');
  });

  it('NO PIERDE los parámetros de query que valen `false` o `0`', async () => {
    /**
     * El fallo que esto previene es silencioso: con un `if (valor)` para filtrar, un
     * `soloPendientes=false` y un `desplazamiento=0` desaparecerían de la URL, y el backend
     * aplicaría sus valores por defecto. La paginación empezaría en la página equivocada sin que
     * nada avisara.
     */
    let url = '';
    servidor.use(
      http.get('/v1/conversaciones', ({ request }) => {
        url = new URL(request.url).search;
        return HttpResponse.json({ conversaciones: [], hayMas: false });
      }),
    );

    await peticion('/v1/conversaciones', { query: { soloPendientes: false, desplazamiento: 0, modo: undefined, limite: 50 } });

    expect(url).toContain('soloPendientes=false');
    expect(url).toContain('desplazamiento=0');
    expect(url).toContain('limite=50');
    // `undefined` sí se omite: es la forma de decir "no filtres por esto".
    expect(url).not.toContain('modo');
  });

  it('un 204 no intenta parsear cuerpo', async () => {
    servidor.use(http.delete('/v1/prueba', () => new HttpResponse(null, { status: 204 })));
    await expect(peticion('/v1/prueba', { metodo: 'DELETE' })).resolves.toBeUndefined();
  });
});
