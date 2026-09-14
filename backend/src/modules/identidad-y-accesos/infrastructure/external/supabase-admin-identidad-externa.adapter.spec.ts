import { SupabaseAdminIdentidadExternaAdapter } from './supabase-admin-identidad-externa.adapter';
import { ConflictoDeNegocioError, DomainError } from '../../../../shared/errors/domain-error';

const URL_BASE = 'https://proyecto-de-prueba.supabase.co';
const CLAVE = 'service-role-key-de-prueba';
const ID_DEVUELTO = '0dd96720-c81d-4406-a2de-fe6bed0f4cd8';

function respuesta(status: number, cuerpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo } as unknown as Response;
}

describe('SupabaseAdminIdentidadExternaAdapter — FL-SEG-06 (DEC-028)', () => {
  let fetchOriginal: typeof globalThis.fetch;
  let fetchFalso: jest.Mock;

  beforeEach(() => {
    fetchOriginal = globalThis.fetch;
    fetchFalso = jest.fn();
    globalThis.fetch = fetchFalso as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  const adaptador = () => new SupabaseAdminIdentidadExternaAdapter(URL_BASE, CLAVE);

  it('llama a POST /auth/v1/admin/users con la Service Role Key y solo el email (sin password)', async () => {
    fetchFalso.mockResolvedValue(respuesta(200, { id: ID_DEVUELTO }));

    await adaptador().crearCuenta({ email: 'ana@blanc.mx' });

    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toBe(`${URL_BASE}/auth/v1/admin/users`);
    expect(opciones.method).toBe('POST');
    expect(opciones.headers.apikey).toBe(CLAVE);
    expect(opciones.headers.Authorization).toBe(`Bearer ${CLAVE}`);
    // DEC-028: sin contraseña, y sin `email_confirm` (esa opción quedó sin decidir).
    expect(JSON.parse(opciones.body)).toEqual({ email: 'ana@blanc.mx' });
  });

  it('devuelve el id de la respuesta (forma raíz)', async () => {
    fetchFalso.mockResolvedValue(respuesta(200, { id: ID_DEVUELTO, email: 'ana@blanc.mx' }));
    await expect(adaptador().crearCuenta({ email: 'ana@blanc.mx' })).resolves.toEqual({ id: ID_DEVUELTO });
  });

  it('devuelve el id cuando la respuesta viene envuelta en `user`', async () => {
    fetchFalso.mockResolvedValue(respuesta(200, { user: { id: ID_DEVUELTO } }));
    await expect(adaptador().crearCuenta({ email: 'ana@blanc.mx' })).resolves.toEqual({ id: ID_DEVUELTO });
  });

  it('rechaza con IDENTIDAD_EXTERNA_YA_EXISTE si el email ya tiene cuenta (email_exists)', async () => {
    fetchFalso.mockResolvedValue(respuesta(422, { error_code: 'email_exists', msg: 'Email address already registered' }));

    await expect(adaptador().crearCuenta({ email: 'ana@blanc.mx' })).rejects.toMatchObject({
      code: 'IDENTIDAD_EXTERNA_YA_EXISTE',
      httpStatus: 409,
    });
    await expect(adaptador().crearCuenta({ email: 'ana@blanc.mx' })).rejects.toThrow(ConflictoDeNegocioError);
  });

  it('rechaza igual con user_already_exists', async () => {
    fetchFalso.mockResolvedValue(respuesta(422, { code: 'user_already_exists' }));
    await expect(adaptador().crearCuenta({ email: 'ana@blanc.mx' })).rejects.toMatchObject({
      code: 'IDENTIDAD_EXTERNA_YA_EXISTE',
    });
  });

  it('rechaza con PROVISION_SUPABASE_FALLIDA (502) ante otros errores del proveedor', async () => {
    fetchFalso.mockResolvedValue(respuesta(500, { msg: 'internal error' }));

    await expect(adaptador().crearCuenta({ email: 'ana@blanc.mx' })).rejects.toMatchObject({
      code: 'PROVISION_SUPABASE_FALLIDA',
      httpStatus: 502,
    });
  });

  it('rechaza con PROVISION_SUPABASE_NO_DISPONIBLE si la red falla', async () => {
    fetchFalso.mockRejectedValue(new TypeError('fetch failed'));

    await expect(adaptador().crearCuenta({ email: 'ana@blanc.mx' })).rejects.toMatchObject({
      code: 'PROVISION_SUPABASE_NO_DISPONIBLE',
      httpStatus: 502,
    });
  });

  it('rechaza si la respuesta es exitosa pero no trae id utilizable (no escribe `undefined`)', async () => {
    fetchFalso.mockResolvedValue(respuesta(200, {}));

    await expect(adaptador().crearCuenta({ email: 'ana@blanc.mx' })).rejects.toMatchObject({
      code: 'PROVISION_SUPABASE_RESPUESTA_INVALIDA',
    });
  });

  it('nunca incluye la Service Role Key en el error propagado', async () => {
    fetchFalso.mockResolvedValue(respuesta(500, { msg: 'boom' }));

    const error = await adaptador()
      .crearCuenta({ email: 'ana@blanc.mx' })
      .catch((e: DomainError) => e);

    expect(JSON.stringify({ mensaje: (error as DomainError).message, detalles: (error as DomainError).details })).not.toContain(CLAVE);
  });
});
