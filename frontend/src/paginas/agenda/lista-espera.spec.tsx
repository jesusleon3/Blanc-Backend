import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { servidor } from '../../pruebas/servidor';
import { montar } from '../../pruebas/montar';
import { vigilarRechazosNoGestionados } from '../../pruebas/rechazos';
import { MANICURISTA_ANA, SERVICIO_GELISH, SUCURSAL_LOMAS, cita, clienta, manicurista, perfil, servicio, solicitud, sucursal } from '../../pruebas/datos';
import { ListaDeEspera } from './componentes/ListaDeEspera';

const RUTA = '/v1/agenda/lista-espera';

const basico = (solicitudes = [solicitud()]) =>
  servidor.use(
    http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfil('GERENTE'))),
    http.get('/v1/sucursales-y-personal/sucursales', () => HttpResponse.json({ sucursales: [sucursal()] })),
    http.get('/v1/sucursales-y-personal/manicuristas', () => HttpResponse.json({ manicuristas: [manicurista()] })),
    http.get('/v1/catalogo-y-cotizacion/servicios', () => HttpResponse.json({ servicios: [servicio()] })),
    http.get(RUTA, () => HttpResponse.json({ solicitudes })),
  );

/** `+45 min` desde ahora, para una ventana que todavía corre. */
const enMinutos = (minutos: number) => new Date(Date.now() + minutos * 60_000).toISOString();

describe('Lista de espera (`DEC-039`)', () => {
  vigilarRechazosNoGestionados();
  it('muestra la fila NUMERADA en orden de llegada (FIFO)', async () => {
    /**
     * El orden lo da el backend por `creado_en`, y **no hay columna `posicion`**: una posición
     * almacenada se desincroniza en cuanto alguien cancela. La pantalla la numera al pintar.
     */
    basico([
      solicitud({ id: 'sol-1', creadoEn: '2027-03-01T16:00:00.000Z' }),
      solicitud({ id: 'sol-2', clientaId: 'clienta-2', creadoEn: '2027-03-01T17:00:00.000Z' }),
    ]);

    montar(<ListaDeEspera sucursalId={SUCURSAL_LOMAS} fecha="2027-03-08" />);

    const fila = await screen.findByRole('list', { name: 'Fila de espera' });
    const elementos = within(fila).getAllByRole('listitem');
    expect(elementos).toHaveLength(2);
    expect(elementos[0]).toHaveTextContent('1');
    expect(elementos[1]).toHaveTextContent('2');
  });

  it('para una solicitud `notificada` muestra CUÁNTO LE QUEDA y que el lugar no está reservado', async () => {
    /**
     * `RN-AGE-13`: **la oferta no retiene el lugar.** Mientras la clienta decide, otra puede
     * tomarlo. Decirlo evita que quien atiende prometa el hueco por teléfono, y la cuenta atrás no
     * es decorativa: es el tiempo real antes de que el turno pase a la siguiente.
     */
    basico([solicitud({ estado: 'notificada', notificadaEn: new Date().toISOString(), expiraEn: enMinutos(45) })]);

    montar(<ListaDeEspera sucursalId={SUCURSAL_LOMAS} fecha="2027-03-08" />);

    expect(await screen.findByText('Avisada, esperando respuesta')).toBeInTheDocument();
    expect(screen.getByText(/Le quedan 4[0-9] min para responder/)).toBeInTheDocument();
    expect(screen.getByText(/El lugar no está reservado mientras decide/)).toBeInTheDocument();
  });

  it('un turno YA VENCIDO dice que hay que avanzar el turno', async () => {
    basico([solicitud({ estado: 'notificada', notificadaEn: enMinutos(-90), expiraEn: enMinutos(-30) })]);

    montar(<ListaDeEspera sucursalId={SUCURSAL_LOMAS} fecha="2027-03-08" />);

    expect(await screen.findByText(/Su turno ya venció/)).toBeInTheDocument();
  });

  it('ACEPTAR EN SU NOMBRE agenda a la hora que indique quien atiende', async () => {
    /**
     * La hora se pide explícitamente y no se deduce del hueco ofrecido: desde la interfaz no se
     * sabe cuál fue —el backend lo guarda, pero no viaja en la solicitud— y en una llamada real la
     * clienta puede aceptar *otra* hora del mismo día.
     */
    basico([solicitud({ estado: 'notificada', expiraEn: enMinutos(30) })]);
    let enviado: Record<string, unknown> | null = null;
    servidor.use(
      http.post(`${RUTA}/sol-1/aceptar`, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ solicitud: solicitud({ estado: 'aceptada', citaId: 'cita-9' }), cita: cita() });
      }),
    );

    montar(<ListaDeEspera sucursalId={SUCURSAL_LOMAS} fecha="2027-03-08" />);

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Aceptó: agendar' }));
    await usuario.clear(screen.getByLabelText('¿A qué hora se le agenda?'));
    await usuario.type(screen.getByLabelText('¿A qué hora se le agenda?'), '17:00');

    const selector = screen.getByLabelText('Manicurista (opcional)');
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Ana' })).toBeInTheDocument());
    await usuario.selectOptions(selector, MANICURISTA_ANA);
    await usuario.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(enviado).not.toBeNull());
    // 17:00 de pared del día de la solicitud (2027-03-08) = 23:00Z.
    expect(enviado).toEqual({ inicio: '2027-03-08T23:00:00.000Z', manicuristaId: MANICURISTA_ANA });
  });

  it('si el hueco YA SE TOMÓ mientras decidía, el `409` se explica', async () => {
    // Consecuencia directa de que la oferta no retenga nada (`RN-AGE-13`).
    basico([solicitud({ estado: 'notificada', expiraEn: enMinutos(30) })]);
    servidor.use(
      http.post(`${RUTA}/sol-1/aceptar`, () =>
        HttpResponse.json({ error: { category: 'domain', code: 'HORARIO_NO_DISPONIBLE', message: 'Ya no hay lugar.' } }, { status: 409 }),
      ),
    );

    montar(<ListaDeEspera sucursalId={SUCURSAL_LOMAS} fecha="2027-03-08" />);

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Aceptó: agendar' }));
    await usuario.click(screen.getByRole('button', { name: 'Agendar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Otra clienta tomó ese lugar/);
  });

  it('AVANZAR TURNO resume qué pasó', async () => {
    // El planificador ya lo hace cada pocos minutos (`ADR-025`); el botón es para no esperarlo.
    basico([solicitud()]);
    servidor.use(
      http.post(`${RUTA}/avanzar-turno`, () =>
        HttpResponse.json({
          expiradas: [solicitud({ id: 'sol-viejo', estado: 'expirada' })],
          nuevasOfertas: [solicitud({ id: 'sol-1', estado: 'notificada' })],
        }),
      ),
    );

    montar(<ListaDeEspera sucursalId={SUCURSAL_LOMAS} fecha="2027-03-08" />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Avanzar turno ahora' }));

    expect(await screen.findByText(/1 turno vencido, 1 oferta nueva/)).toBeInTheDocument();
  });

  it('INSCRIBE a una clienta con los ids reales de los selectores', async () => {
    basico([]);
    let enviado: Record<string, unknown> | null = null;
    servidor.use(
      http.get('/v1/crm/clientas', () => HttpResponse.json({ clientas: [clienta()] })),
      http.post(RUTA, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(solicitud());
      }),
    );

    montar(<ListaDeEspera sucursalId={SUCURSAL_LOMAS} fecha="2027-03-08" />);

    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText('Clienta (busca por teléfono)'), '4421112233');
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }));
    await usuario.click(await screen.findByRole('button', { name: /Andrea Ramírez/ }));

    const selector = screen.getByLabelText('Servicio');
    await waitFor(() => expect(within(selector).getByRole('option', { name: /Gelish manos/ })).toBeInTheDocument());
    await usuario.selectOptions(selector, SERVICIO_GELISH);
    await usuario.click(screen.getByRole('button', { name: 'Anotar' }));

    await waitFor(() =>
      expect(enviado).toEqual({
        sucursalId: SUCURSAL_LOMAS,
        clientaId: 'clienta-1',
        servicioId: SERVICIO_GELISH,
        // Fecha de pared `YYYY-MM-DD`, no un instante: la fila es por día.
        fecha: '2027-03-08',
      }),
    );
  });

  it('NO muestra las solicitudes ya cerradas en la fila activa', async () => {
    // La fila es una cola de trabajo: una aceptada o expirada no es trabajo pendiente.
    basico([solicitud({ id: 'sol-1', estado: 'aceptada' }), solicitud({ id: 'sol-2', estado: 'expirada' })]);

    montar(<ListaDeEspera sucursalId={SUCURSAL_LOMAS} fecha="2027-03-08" />);

    expect(await screen.findByText('Nadie en espera para este día')).toBeInTheDocument();
  });
});
