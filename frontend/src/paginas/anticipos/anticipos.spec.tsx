import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { servidor } from '../../pruebas/servidor';
import { montar } from '../../pruebas/montar';
import { anticipo, perfil } from '../../pruebas/datos';
import { Anticipos } from './Anticipos';

const conSesion = (rol: Parameters<typeof perfil>[0] = 'GERENTE') =>
  servidor.use(http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfil(rol))));

const conAnticipos = (lista = [anticipo()]) =>
  servidor.use(
    http.get('/v1/anticipos', () => HttpResponse.json({ anticipos: lista, limite: 50, desplazamiento: 0, hayMas: false })),
  );

describe('Anticipos — conciliación manual (`RN-ANT-01` a `RN-ANT-04`)', () => {
  it('muestra el monto en PESOS a partir de los centavos y el porcentaje aplicado', async () => {
    // `RN-COT-07`: el dinero son centavos enteros. 18000 centavos = $180.00, que es el 40% de los
    // $450.00 del servicio. Si esto se mostrara mal, la Encargada conciliaría contra el número
    // equivocado del banco.
    conSesion();
    conAnticipos([anticipo({ montoCentavos: 18000, porcentajeAplicado: 40 })]);

    montar(<Anticipos />);

    expect(await screen.findByText('$180.00')).toBeInTheDocument();
    expect(screen.getByText(/40% del servicio/)).toBeInTheDocument();
  });

  it('EXIGE la referencia del comprobante antes de dejar confirmar', async () => {
    // Es el único rastro de **qué movimiento del banco** corresponde a esta cita. Sin ella, una
    // aclaración posterior no tiene por dónde empezar.
    conSesion();
    conAnticipos();

    montar(<Anticipos />);

    await screen.findByText('$180.00');
    expect(screen.getByRole('button', { name: 'Confirmar pago' })).toBeDisabled();

    await userEvent.setup().type(screen.getByLabelText('Referencia del comprobante'), 'REF-99812');

    expect(screen.getByRole('button', { name: 'Confirmar pago' })).toBeEnabled();
  });

  it('manda la referencia al confirmar el pago', async () => {
    conSesion();
    conAnticipos();
    let enviado: unknown = null;
    servidor.use(
      http.post('/v1/anticipos/ant-1/confirmar-pago', async ({ request }) => {
        enviado = await request.json();
        return HttpResponse.json(anticipo({ estado: 'pagado', referenciaPago: 'REF-99812' }));
      }),
    );

    montar(<Anticipos />);

    await screen.findByText('$180.00');
    const usuario = userEvent.setup();
    await usuario.type(screen.getByLabelText('Referencia del comprobante'), 'REF-99812');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pago' }));

    await waitFor(() => expect(enviado).toEqual({ referenciaPago: 'REF-99812' }));
  });

  it('un `409 HORARIO_NO_DISPONIBLE` SE EXPLICA: otra clienta ganó el cupo (`RN-ANT-03`)', async () => {
    /**
     * **La prueba más importante de esta pantalla.**
     *
     * Confirmar el pago activa la cita en la misma transacción. Si otra clienta tomó el último
     * hueco mientras llegaba la transferencia, el backend responde `409` y **el pago no queda
     * confirmado** — porque la oferta nunca retuvo el lugar. No es un error del sistema: es un
     * caso normal, el dinero ya está transferido, y lo que sigue es una conversación con la
     * clienta.
     *
     * Mostrar *"Error 409: Conflict"* dejaría a la Encargada sin saber qué pasó ni qué hacer. Por
     * eso `ADR-013` exige códigos de negocio y por eso se ramifica por `code`, nunca por el texto.
     */
    conSesion();
    conAnticipos();
    servidor.use(
      http.post('/v1/anticipos/ant-1/confirmar-pago', () =>
        HttpResponse.json(
          { error: { category: 'domain', code: 'HORARIO_NO_DISPONIBLE', message: 'Ya no hay lugar.' } },
          { status: 409 },
        ),
      ),
    );

    montar(<Anticipos />);

    await screen.findByText('$180.00');
    const usuario = userEvent.setup();
    await usuario.type(screen.getByLabelText('Referencia del comprobante'), 'REF-1');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pago' }));

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(/Otra clienta tomó ese lugar/);
    expect(aviso).toHaveTextContent(/NO quedó confirmado/);
    expect(aviso).toHaveTextContent(/reagendar o devolverle el dinero/);
  });

  it('EXPIRAR pide confirmación en dos pasos y advierte de que no hay devolución', async () => {
    // Expirar libera la cita y la clienta la pierde. Es destructivo y sin vuelta: no puede quedar
    // a un clic de distancia.
    conSesion();
    conAnticipos();
    let expirado = false;
    servidor.use(
      http.post('/v1/anticipos/ant-1/expirar', () => {
        expirado = true;
        return HttpResponse.json(anticipo({ estado: 'expirado' }));
      }),
    );

    montar(<Anticipos />);

    await screen.findByText('$180.00');
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole('button', { name: 'La transferencia nunca llegó' }));
    expect(screen.getByText(/No hay devolución automática/)).toBeInTheDocument();
    expect(expirado).toBe(false);

    await usuario.click(screen.getByRole('button', { name: 'Sí, expirar' }));
    await waitFor(() => expect(expirado).toBe(true));
  });

  it('un anticipo YA PAGADO no ofrece confirmar ni expirar', async () => {
    conSesion();
    conAnticipos([anticipo({ estado: 'pagado', referenciaPago: 'REF-1', confirmadoEn: '2026-10-16T18:00:00.000Z' })]);

    montar(<Anticipos />);

    await screen.findByText('Pagado');
    expect(screen.queryByRole('button', { name: 'Confirmar pago' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'La transferencia nunca llegó' })).not.toBeInTheDocument();
  });

  it('el filtro de pestaña PIDE el estado al backend', async () => {
    conSesion();
    const estados: (string | null)[] = [];
    servidor.use(
      http.get('/v1/anticipos', ({ request }) => {
        estados.push(new URL(request.url).searchParams.get('estado'));
        return HttpResponse.json({ anticipos: [], limite: 50, desplazamiento: 0, hayMas: false });
      }),
    );

    montar(<Anticipos />);

    await waitFor(() => expect(estados).toContain('pendiente'));
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Pagados' }));
    await waitFor(() => expect(estados).toContain('pagado'));
  });

  it('un `403` dice que no tienes permiso, no un error genérico', async () => {
    // Pasa si alguien con rol insuficiente llega aquí: la señal de que la interfaz mostró algo que
    // el backend no permite. Quien opera necesita saber que no es un fallo suyo.
    conSesion();
    servidor.use(
      http.get('/v1/anticipos', () =>
        HttpResponse.json({ error: { category: 'domain', code: 'ACCESO_DENEGADO', message: 'No.' } }, { status: 403 }),
      ),
    );

    montar(<Anticipos />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para hacer esto.');
  });
});
