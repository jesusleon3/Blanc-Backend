import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { servidor } from '../../pruebas/servidor';
import { montar } from '../../pruebas/montar';
import { vigilarRechazosNoGestionados } from '../../pruebas/rechazos';
import {
  MANICURISTA_ANA,
  SUCURSAL_LOMAS,
  SUCURSAL_ZIBATA,
  citaAfectada,
  excepcion,
  manicurista,
  perfil,
  servicio,
  sucursal,
} from '../../pruebas/datos';
import { Excepciones } from './componentes/Excepciones';

const BASE = '/v1/sucursales-y-personal/excepciones';

const basico = (excepciones = [excepcion()]) =>
  servidor.use(
    http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfil('GERENTE'))),
    http.get('/v1/sucursales-y-personal/sucursales', () =>
      HttpResponse.json({ sucursales: [sucursal(), sucursal({ id: SUCURSAL_ZIBATA, nombre: 'Zibatá' })] }),
    ),
    http.get('/v1/sucursales-y-personal/manicuristas', () => HttpResponse.json({ manicuristas: [manicurista()] })),
    http.get('/v1/catalogo-y-cotizacion/servicios', () => HttpResponse.json({ servicios: [servicio()] })),
    http.get(BASE, () => HttpResponse.json({ excepciones })),
  );

describe('Ausencias y coberturas (`DEC-036`)', () => {
  vigilarRechazosNoGestionados();
  it('lista las registradas del día y permite revocar una captura equivocada', async () => {
    /**
     * Revocar **no es "deshacer una falta"**: es corregir una captura equivocada. Y hasta esta
     * entrega era imposible desde la interfaz, porque el id de la excepción solo existía en la
     * respuesta del `POST` que la creó.
     */
    basico();
    let revocado: string | null = null;
    servidor.use(
      http.delete(`${BASE}/exc-1`, () => {
        revocado = 'exc-1';
        return new HttpResponse(null, { status: 204 });
      }),
    );

    montar(<Excepciones sucursalId={SUCURSAL_LOMAS} fecha="2027-03-08" />);

    const lista = await screen.findByRole('list', { name: 'Excepciones registradas' });
    expect(within(lista).getByText('Ausencia')).toBeInTheDocument();
    expect(within(lista).getByText('Ana')).toBeInTheDocument();
    expect(within(lista).getByText(/Cita médica/)).toBeInTheDocument();

    await userEvent.setup().click(within(lista).getByRole('button', { name: 'Se capturó mal' }));

    await waitFor(() => expect(revocado).toBe('exc-1'));
  });

  it('registra una AUSENCIA DE DÍA COMPLETO con el rango del día de pared', async () => {
    basico([]);
    let enviado: Record<string, unknown> | null = null;
    servidor.use(
      http.post(`${BASE}/ausencias`, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ excepcion: excepcion(), citasAfectadas: [] });
      }),
    );

    montar(<Excepciones sucursalId={SUCURSAL_LOMAS} fecha="2027-03-08" />);

    const usuario = userEvent.setup();
    const selector = await screen.findByLabelText('¿Quién?');
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Ana' })).toBeInTheDocument());
    await usuario.selectOptions(selector, MANICURISTA_ANA);
    await usuario.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(enviado).not.toBeNull());
    // Día completo es un RANGO `00:00–23:59` de pared, no un `inicio` sin `fin`: el backend trabaja
    // con rangos, y 00:00 local del día 8 son las 06:00Z.
    expect(enviado).toMatchObject({ manicuristaId: MANICURISTA_ANA, inicio: '2027-03-08T06:00:00.000Z' });
  });

  it('registra una SALIDA ANTICIPADA por rango de horas', async () => {
    // *"Se va a las 2"* es el caso frecuente, y es distinto de *"hoy no viene"*. `DEC-036` pidió
    // los dos.
    basico([]);
    let enviado: Record<string, unknown> | null = null;
    servidor.use(
      http.post(`${BASE}/ausencias`, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ excepcion: excepcion(), citasAfectadas: [] });
      }),
    );

    montar(<Excepciones sucursalId={SUCURSAL_LOMAS} fecha="2027-03-08" />);

    const usuario = userEvent.setup();
    const selector = await screen.findByLabelText('¿Quién?');
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Ana' })).toBeInTheDocument());
    await usuario.selectOptions(selector, MANICURISTA_ANA);
    await usuario.click(screen.getByLabelText('Todo el día'));

    await usuario.clear(screen.getByLabelText('Desde'));
    await usuario.type(screen.getByLabelText('Desde'), '14:00');
    await usuario.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(enviado).not.toBeNull());
    // 14:00 local = 20:00Z.
    expect((enviado as unknown as { inicio: string }).inicio).toBe('2027-03-08T20:00:00.000Z');
  });

  it('una COBERTURA exige sucursal de destino y la manda', async () => {
    basico([]);
    let enviado: Record<string, unknown> | null = null;
    servidor.use(
      http.post(`${BASE}/coberturas`, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ excepcion: excepcion({ tipo: 'cobertura', sucursalId: SUCURSAL_ZIBATA }), citasAfectadas: [] });
      }),
    );

    montar(<Excepciones sucursalId={SUCURSAL_LOMAS} fecha="2027-03-08" />);

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('tab', { name: 'Cobertura en otra sucursal' }));

    const quien = screen.getByLabelText('¿Quién?');
    await waitFor(() => expect(within(quien).getByRole('option', { name: 'Ana' })).toBeInTheDocument());
    await usuario.selectOptions(quien, MANICURISTA_ANA);

    // Sin destino no deja registrar: una cobertura sin destino restaría capacidad sin sumarla.
    expect(screen.getByRole('button', { name: 'Registrar' })).toBeDisabled();

    await usuario.selectOptions(screen.getByLabelText('¿A qué sucursal va?'), SUCURSAL_ZIBATA);
    await usuario.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(enviado).toMatchObject({ sucursalId: SUCURSAL_ZIBATA, manicuristaId: MANICURISTA_ANA }));
  });
});

describe('Ausencias — LA ALERTA DE `citasAfectadas` ES EL PRODUCTO DE LA PANTALLA', () => {
  const registrarConAfectadas = (afectadas: ReturnType<typeof citaAfectada>[]) => {
    basico([]);
    servidor.use(http.post(`${BASE}/ausencias`, () => HttpResponse.json({ excepcion: excepcion(), citasAfectadas: afectadas })));
  };

  const registrar = async () => {
    montar(<Excepciones sucursalId={SUCURSAL_LOMAS} fecha="2027-03-08" />);
    const usuario = userEvent.setup();
    const selector = await screen.findByLabelText('¿Quién?');
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Ana' })).toBeInTheDocument());
    await usuario.selectOptions(selector, MANICURISTA_ANA);
    await usuario.click(screen.getByRole('button', { name: 'Registrar' }));
    return usuario;
  };

  it('MUESTRA DESTACADAS las citas comprometidas, y dice que la ausencia SÍ se registró', async () => {
    /**
     * El requisito de fondo: **esto nunca bloquea**. La manicurista no falta porque el sistema se
     * lo permita; si el sistema no deja anotarlo, el motor de disponibilidad sigue contando con
     * alguien que no está y **sigue vendiendo huecos imposibles**.
     *
     * Así que se registra siempre y la alerta es el momento en que una persona puede reasignar o
     * reprogramar. Va con `role="alert"` y **no se cierra sola**: un aviso que desaparece a los
     * tres segundos haría que el daño se descubriera cuando la clienta llegue.
     */
    registrarConAfectadas([citaAfectada(), citaAfectada({ citaId: 'cita-2', inicio: '2027-03-08T19:00:00.000Z' })]);

    await registrar();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('2 citas quedan comprometidas');
    expect(alerta).toHaveTextContent(/sí quedó registrada/);
    expect(alerta).toHaveTextContent(/el sistema no puede fingir que hay personal que no está/);

    const citas = within(alerta).getByRole('list', { name: 'Citas comprometidas' });
    expect(within(citas).getAllByText('Cita asignada a esta manicurista')).toHaveLength(2);
    // Los ids se muestran para poder localizar las citas en la agenda.
    expect(within(citas).getByText(/cita-2/)).toBeInTheDocument();
  });

  it('distingue `sobrecupo_en_sucursal` y dice CUÁNTA GENTE FALTA', async () => {
    // La otra clase de daño: nadie la tenía asignada, pero la sucursal se queda sin suficiente
    // personal para lo que ya está vendido.
    registrarConAfectadas([citaAfectada({ clase: 'sobrecupo_en_sucursal', manicuristaId: null, deficitDePersonal: 2 })]);

    await registrar();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('La sucursal queda sin suficiente personal');
    expect(alerta).toHaveTextContent(/Faltan 2 manicuristas a esa hora/);
  });

  it('con CERO afectadas lo confirma, sin alarma', async () => {
    registrarConAfectadas([]);

    await registrar();

    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent(/Ninguna cita queda comprometida/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('la alerta SE CIERRA SOLO cuando quien opera lo dice', async () => {
    registrarConAfectadas([citaAfectada()]);

    const usuario = await registrar();

    await screen.findByRole('alert');
    await usuario.click(screen.getByRole('button', { name: 'Ya las gestioné' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
