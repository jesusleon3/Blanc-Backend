import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { servidor } from '../../pruebas/servidor';
import { montar } from '../../pruebas/montar';
import { SUCURSAL_LOMAS, cita, manicurista, perfil, servicio, sucursal } from '../../pruebas/datos';
import { AccionesDeCita } from './componentes/AccionesDeCita';
import { ListaDeCitas } from './componentes/ListaDeCitas';

const GARANTIAS = '/v1/agenda/citas/garantias';

const contexto = (diasDeCobertura = 7) =>
  servidor.use(
    http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfil('GERENTE'))),
    http.get('/v1/sucursales-y-personal/sucursales', () => HttpResponse.json({ sucursales: [sucursal()] })),
    http.get('/v1/sucursales-y-personal/manicuristas', () => HttpResponse.json({ manicuristas: [manicurista()] })),
    http.get('/v1/catalogo-y-cotizacion/servicios', () => HttpResponse.json({ servicios: [servicio()] })),
    http.get(`${GARANTIAS}/cobertura`, () => HttpResponse.json({ diasDeCobertura })),
  );

const completada = () => cita({ estado: 'completada' });

describe('Garantías en la Agenda Operativa (`P10`, `RN-GAR-01..06`)', () => {
  it('SOLO ofrece la garantía sobre una cita COMPLETADA', async () => {
    /**
     * `RN-GAR-02`: la garantía cubre un servicio que **se realizó**. Ofrecer el botón en una cita
     * agendada o cancelada invitaría a un `409` seguro, y peor: insinuaría que se puede reponer un
     * trabajo que todavía no se ha hecho.
     */
    contexto();

    const { unmount } = montar(<AccionesDeCita cita={cita({ estado: 'agendada' })} onCambio={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Agendar garantía' })).not.toBeInTheDocument();
    unmount();

    montar(<AccionesDeCita cita={completada()} onCambio={() => {}} />);
    expect(screen.getByRole('button', { name: 'Agendar garantía' })).toBeInTheDocument();
  });

  it('NO ofrece garantizar una garantía: sería una cadena indefinida de reposiciones', () => {
    // El backend lo rechaza con `GARANTIA_SOBRE_UNA_GARANTIA`; la interfaz no lo propone.
    contexto();

    montar(<AccionesDeCita cita={cita({ estado: 'completada', esGarantia: true, citaGarantizadaId: 'cita-0' })} onCambio={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Agendar garantía' })).not.toBeInTheDocument();
  });

  it('DENTRO de la ventana: agenda la reposición sin costo y sin mandar el servicio', async () => {
    contexto();
    let enviado: Record<string, unknown> | null = null;
    servidor.use(
      http.post(GARANTIAS, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(cita({ id: 'cita-garantia', esGarantia: true, citaGarantizadaId: 'cita-1' }), { status: 201 });
      }),
    );

    let refrescado = false;
    montar(<AccionesDeCita cita={completada()} onCambio={() => void (refrescado = true)} />);

    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole('button', { name: 'Agendar garantía' }));

    // Los días de cobertura se LEEN del backend, no están escritos en la pantalla.
    expect(await screen.findByText(/La garantía cubre 7 días desde el servicio/)).toBeInTheDocument();

    await usuario.clear(screen.getByLabelText('Día'));
    await usuario.type(screen.getByLabelText('Día'), '2027-03-10');
    await usuario.type(screen.getByLabelText('Hora'), '11:00');
    await usuario.type(screen.getByLabelText('¿Qué reportó la clienta?'), 'Se le despegaron dos uñas en tres días');
    await usuario.click(screen.getByRole('button', { name: 'Agendar sin costo' }));

    await waitFor(() => expect(enviado).not.toBeNull());
    expect(enviado).toMatchObject({
      citaGarantizadaId: 'cita-1',
      motivo: 'Se le despegaron dos uñas en tres días',
    });

    /**
     * **No viaja `servicioId`.** Lo toma el backend de la cita original: una reposición repone *ese*
     * trabajo. Si el cliente pudiera elegirlo, un retiro de $150 se convertiría en un acrílico de
     * $800 cobrado como garantía.
     */
    expect(enviado).not.toHaveProperty('servicioId');
    // Tampoco el fin ni la duración: los deriva el backend del servicio (`DEC-033`).
    expect(enviado).not.toHaveProperty('fin');

    // Hora de pared de Querétaro: 11:00 local son las 17:00 UTC (`-06:00`).
    expect(enviado).toMatchObject({ inicio: '2027-03-10T17:00:00.000Z' });

    await waitFor(() => expect(refrescado).toBe(true));
  });

  it('FUERA de la ventana: muestra el 409 con los días reales y NO esconde el botón', async () => {
    /**
     * ## POR QUÉ LA VENTANA NO SE CALCULA EN EL CLIENTE
     *
     * Sería fácil comparar fechas aquí y ocultar el botón pasados los 7 días. Y sería peor: quien
     * atiende el mostrador vería que la función *no existe* en vez de leer que la garantía venció y
     * que una excepción la decide la Dueña. Además el cálculo usaría el reloj del navegador, que no
     * es la autoridad: `DIAS_DE_GARANTIA` vive en el servidor.
     *
     * Se ofrece el botón, y el `409` del backend —con los días exactos— es el que explica.
     */
    contexto();
    servidor.use(
      http.post(GARANTIAS, () =>
        HttpResponse.json(
          {
            error: {
              category: 'domain',
              code: 'GARANTIA_VENCIDA',
              message:
                'La garantía cubre 7 días desde el servicio, y han pasado 21. Si se va a hacer una excepción, la decide la Dueña y la cita se agenda normal.',
              details: { diasDeCobertura: 7, diasTranscurridos: 21 },
            },
          },
          { status: 409 },
        ),
      ),
    );

    montar(<AccionesDeCita cita={completada()} onCambio={() => {}} />);

    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole('button', { name: 'Agendar garantía' }));
    await usuario.type(screen.getByLabelText('Hora'), '11:00');
    await usuario.click(screen.getByRole('button', { name: 'Agendar sin costo' }));

    const aviso = await screen.findByRole('alert');
    // El mensaje del dominio se muestra TAL CUAL: trae los días reales, que una explicación fija
    // de la interfaz no podría incluir.
    expect(aviso).toHaveTextContent(/han pasado 21/);
    expect(aviso).toHaveTextContent(/la decide la Dueña/);

    // Al volver, la cita original sigue COMPLETADA y vuelve a ofrecer sus acciones: la garantía es
    // una cita nueva, no una transición de esta — un `409` no la deja en un estado intermedio.
    await usuario.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByRole('button', { name: 'No llegó' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agendar garantía' })).toBeInTheDocument();
  });

  it('propaga el 409 GARANTIA_YA_OTORGADA sin inventarle una explicación', async () => {
    contexto();
    servidor.use(
      http.post(GARANTIAS, () =>
        HttpResponse.json(
          { error: { category: 'domain', code: 'GARANTIA_YA_OTORGADA', message: 'Ese servicio ya tiene una cita de garantía agendada.' } },
          { status: 409 },
        ),
      ),
    );

    montar(<AccionesDeCita cita={completada()} onCambio={() => {}} />);

    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole('button', { name: 'Agendar garantía' }));
    await usuario.type(screen.getByLabelText('Hora'), '11:00');
    await usuario.click(screen.getByRole('button', { name: 'Agendar sin costo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese servicio ya tiene una cita de garantía agendada.');
  });

  it('marca la cita de garantía en la agenda y NO muestra su $0 como un precio', async () => {
    /**
     * Una garantía tiene `totalCentavos: 0`. Sin la insignia, ese **$0.00** en la lista parecería un
     * error de captura o un servicio sin cotizar, y alguien "lo arreglaría" cobrándolo.
     */
    contexto();

    montar(
      <ListaDeCitas
        citas={[cita({ id: 'cita-garantia', esGarantia: true, citaGarantizadaId: 'cita-1' })]}
        sucursalId={SUCURSAL_LOMAS}
        onCambio={() => {}}
      />,
    );

    expect(await screen.findByText('Garantía · sin costo')).toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('advierte que esto agenda una REPOSICIÓN y que las otras formas las decide la Dueña', async () => {
    // `RN-GAR-04`: no hay beneficio fijo. La interfaz no puede dar a entender lo contrario.
    contexto();

    montar(<AccionesDeCita cita={completada()} onCambio={() => {}} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Agendar garantía' }));

    expect(screen.getByText(/descuento o un producto, eso lo\s+decide la Dueña/)).toBeInTheDocument();
  });

  it('respeta el valor de DIAS_DE_GARANTIA que devuelva el backend, no un 7 escrito a mano', async () => {
    // Si la Dueña amplía la cobertura, la pantalla tiene que decir lo que el backend va a aplicar.
    contexto(15);

    montar(<AccionesDeCita cita={completada()} onCambio={() => {}} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Agendar garantía' }));

    expect(await screen.findByText(/La garantía cubre 15 días desde el servicio/)).toBeInTheDocument();
  });
});
