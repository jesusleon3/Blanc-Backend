import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { servidor } from '../../pruebas/servidor';
import { montar } from '../../pruebas/montar';
import { conversacion, hilo, mensaje, escaladas, perfil, SUCURSAL_LOMAS } from '../../pruebas/datos';
import { Bandeja } from './Bandeja';
import { Conversacion } from './Conversacion';
import { ContadorDeEscaladas } from '../../componentes/ContadorDeEscaladas';
import type { EstadoDeVentana } from '../../api/contrato';

const PLANTILLAS = {
  provisional: true,
  pendiente: 'N-14',
  plantillas: [
    { nombre: 'recordatorio_cita_24h', descripcion: 'Recordatorio de cita.', parametros: ['Hora de la cita'] },
    { nombre: 'oferta_hueco_lista_espera', descripcion: 'Se liberó un lugar.', parametros: ['Fecha', 'Hora'] },
  ],
};

const basico = () =>
  servidor.use(
    http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfil('GERENTE'))),
    http.get('/v1/sucursales-y-personal/sucursales', () =>
      HttpResponse.json({ sucursales: [{ id: SUCURSAL_LOMAS, nombre: 'Lomas', enMantenimiento: false }] }),
    ),
    http.get('/v1/conversaciones/plantillas', () => HttpResponse.json(PLANTILLAS)),
    http.get('/v1/conversaciones/escaladas/pendientes', () => HttpResponse.json(escaladas())),
  );

const conHilo = (estadoDeVentana: EstadoDeVentana, extra: Parameters<typeof hilo>[0] = {}) =>
  servidor.use(
    http.get('/v1/conversaciones/conv-1', () =>
      HttpResponse.json(hilo({ estadoDeVentana, ventanaAbierta: estadoDeVentana === 'abierta', ...extra })),
    ),
  );

describe('Bandeja Compartida — ventana de 24 h de Meta (`N-14`)', () => {
  it('VENTANA ABIERTA: se puede escribir texto libre', async () => {
    basico();
    conHilo('abierta');

    montar(<Conversacion id="conv-1" />);

    expect(await screen.findByLabelText('Responder a la clienta')).toBeEnabled();
    expect(screen.queryByText('No puedes enviar texto libre')).not.toBeInTheDocument();
    expect(screen.getByText('Ventana abierta')).toBeInTheDocument();
  });

  it.each([
    ['cerrada', /Pasaron más de 24 horas/],
    ['nunca_abierta', /nunca te ha escrito por WhatsApp/],
  ] as const)('VENTANA %s: BLOQUEA el texto libre, explica la regla y ofrece plantilla', async (estado, explicacion) => {
    /**
     * El backend lo rechazaría igual con `409 VENTANA_24H_CERRADA`. Bloquearlo antes evita que
     * alguien **redacte un mensaje para que el sistema lo tire**: con una clienta esperando,
     * perder lo escrito es peor que no haber podido escribir.
     *
     * Los dos estados se prueban por separado porque **el mensaje tiene que ser distinto**: *"se
     * te pasó el plazo"* y *"esta clienta nunca te ha escrito"* llevan a acciones distintas.
     */
    basico();
    conHilo(estado);

    montar(<Conversacion id="conv-1" />);

    await screen.findByText('No puedes enviar texto libre');
    expect(screen.queryByLabelText('Responder a la clienta')).not.toBeInTheDocument();
    expect(screen.getByText(explicacion)).toBeInTheDocument();
    expect(screen.getByLabelText('Plantilla aprobada')).toBeInTheDocument();
  });

  it('el estado de la ventana SE LEE DE LA RESPUESTA, no se deduce de las marcas de tiempo', async () => {
    /**
     * Regla 2 de `ADR-027`: ningún dato de negocio se calcula en el cliente. Esta prueba lo fuerza
     * con un caso **incoherente a propósito**: `ultimaInteraccionEntranteEn` es de hace un minuto
     * —si el cliente calculara, diría "abierta"— pero el backend responde `cerrada`. Debe
     * obedecer al backend.
     *
     * Es exactamente el escenario de un reloj desfasado o de un cambio de la ventana por parte de
     * Meta: si el cliente calculara, habilitaría una caja cuyo envío se rechaza.
     */
    basico();
    conHilo('cerrada', {
      conversacion: conversacion({ ultimaInteraccionEntranteEn: new Date(Date.now() - 60_000).toISOString() }),
    });

    montar(<Conversacion id="conv-1" />);

    expect(await screen.findByText('No puedes enviar texto libre')).toBeInTheDocument();
    expect(screen.queryByLabelText('Responder a la clienta')).not.toBeInTheDocument();
  });

  it('la plantilla exige TODOS sus parámetros antes de dejar enviar', async () => {
    // Meta sustituye `{{1}}`, `{{2}}`… sin validar nada: un parámetro vacío se entrega igual, y la
    // clienta recibe un mensaje con un hueco en blanco.
    basico();
    conHilo('cerrada');
    let enviado: unknown = null;
    servidor.use(
      http.post('/v1/conversaciones/conv-1/plantilla', async ({ request }) => {
        enviado = await request.json();
        return HttpResponse.json({ conversacion: conversacion(), wamid: 'wamid.X' });
      }),
    );

    montar(<Conversacion id="conv-1" />);

    await screen.findByLabelText('Plantilla aprobada');
    // El catálogo llega por su propia consulta: hay que esperar a que la opción exista. Sin esto,
    // `selectOptions` falla sobre un `<select>` que solo tiene el marcador "Elige una…".
    await screen.findByRole('option', { name: 'oferta_hueco_lista_espera' });
    const usuario = userEvent.setup();

    // Sin plantilla elegida, el botón no deja enviar.
    expect(screen.getByRole('button', { name: 'Enviar plantilla' })).toBeDisabled();

    await usuario.selectOptions(screen.getByLabelText('Plantilla aprobada'), 'oferta_hueco_lista_espera');
    // Dos parámetros: con uno solo sigue deshabilitado.
    await usuario.type(screen.getByLabelText('Fecha'), '2026-12-07');
    expect(screen.getByRole('button', { name: 'Enviar plantilla' })).toBeDisabled();

    await usuario.type(screen.getByLabelText('Hora'), '05:00 p.m.');
    await usuario.click(screen.getByRole('button', { name: 'Enviar plantilla' }));

    await waitFor(() =>
      expect(enviado).toEqual({ plantilla: 'oferta_hueco_lista_espera', parametros: ['2026-12-07', '05:00 p.m.'] }),
    );
  });

  it('avisa de que el catálogo de plantillas es PROVISIONAL (`N-14`)', async () => {
    // Un nombre que Meta no reconoce produce un rechazo del envío, no un mensaje raro. Quien opera
    // tiene que saber que esto aún no está aprobado.
    basico();
    conHilo('cerrada');

    montar(<Conversacion id="conv-1" />);

    expect(await screen.findByText(/inventario de plantillas \(N-14\) todavía no está aprobado/)).toBeInTheDocument();
  });
});

describe('Bandeja Compartida — handoff', () => {
  it('en modo BOT ofrece TOMAR la conversación', async () => {
    basico();
    conHilo('abierta', { conversacion: conversacion({ modo: 'bot', motivoDeEscalamiento: null, escaladaEn: null }) });
    let tomada: unknown = null;
    servidor.use(
      http.post('/v1/conversaciones/conv-1/escalar', async ({ request }) => {
        tomada = await request.json();
        return HttpResponse.json(conversacion());
      }),
    );

    montar(<Conversacion id="conv-1" />);

    await screen.findByText('La lleva el bot');
    expect(screen.queryByRole('button', { name: 'Devolver al bot' })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Tomar conversación' }));

    // El motivo es obligatorio: el `CHECK` de la base rechaza `humano` sin motivo.
    await waitFor(() => expect(tomada).toEqual({ motivo: 'intervencion_manual' }));
  });

  it('en modo HUMANO ofrece DEVOLVER al bot, que es la única salida (`RN-ESC-03`)', async () => {
    /**
     * No hay vía automática de vuelta a `bot`, y **esa ausencia es la regla**: una clienta que
     * pidió hablar con alguien y recibe de nuevo al bot a los diez minutos concluye, con razón,
     * que nadie la escuchó. Por eso hay un botón y no un temporizador.
     */
    basico();
    conHilo('abierta');
    let llamado = false;
    servidor.use(
      http.post('/v1/conversaciones/conv-1/devolver-al-bot', () => {
        llamado = true;
        return HttpResponse.json(conversacion({ modo: 'bot', motivoDeEscalamiento: null }));
      }),
    );

    montar(<Conversacion id="conv-1" />);

    await screen.findByRole('button', { name: 'Devolver al bot' });
    expect(screen.queryByRole('button', { name: 'Tomar conversación' })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Devolver al bot' }));

    await waitFor(() => expect(llamado).toBe(true));
  });

  it('distingue QUIÉN envió cada mensaje: clienta, bot, humano y sistema', async () => {
    // Confundir un mensaje del bot con uno de una compañera lleva a responder dos veces o a no
    // responder. Los cuatro emisores significan cosas distintas para quien atiende.
    basico();
    conHilo('abierta', {
      mensajes: [
        mensaje({ id: 'm1', emisor: 'clienta', contenido: 'Hola' }),
        mensaje({ id: 'm2', emisor: 'bot', direccion: 'saliente', contenido: 'Con gusto te ayudo' }),
        mensaje({ id: 'm3', emisor: 'humano', direccion: 'saliente', contenido: 'Soy Ana, dime' }),
        mensaje({ id: 'm4', emisor: 'sistema', direccion: 'saliente', tipo: 'plantilla', contenido: 'Recordatorio' }),
      ],
    });

    montar(<Conversacion id="conv-1" />);

    await screen.findByText('Hola');
    expect(screen.getByText(/^Clienta ·/)).toBeInTheDocument();
    expect(screen.getByText(/^Bot ·/)).toBeInTheDocument();
    expect(screen.getByText(/^Tú \/ el equipo ·/)).toBeInTheDocument();
    expect(screen.getByText(/^Automático ·/)).toBeInTheDocument();
  });

  it('un mensaje `no_soportado` DICE que es audio o archivo, no aparece vacío', async () => {
    basico();
    conHilo('abierta', { mensajes: [mensaje({ tipo: 'no_soportado', contenido: null })] });

    montar(<Conversacion id="conv-1" />);

    expect(await screen.findByText(/audio o un archivo/)).toBeInTheDocument();
  });

  it('un `409 VENTANA_24H_CERRADA` al responder se explica con la regla de Meta', async () => {
    basico();
    conHilo('abierta');
    servidor.use(
      http.post('/v1/conversaciones/conv-1/mensajes', () =>
        HttpResponse.json(
          { error: { category: 'domain', code: 'VENTANA_24H_CERRADA', message: 'Ventana cerrada.' } },
          { status: 409 },
        ),
      ),
    );

    montar(<Conversacion id="conv-1" />);

    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText('Responder a la clienta'), 'Hola Andrea');
    await usuario.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Pasaron más de 24 horas/);
    // Lo escrito NO se pierde: si el envío falla, sigue ahí para reintentarlo.
    expect(screen.getByLabelText('Responder a la clienta')).toHaveValue('Hola Andrea');
  });
});

describe('Bandeja Compartida — lista y prioridad visual', () => {
  it('muestra el MOTIVO del escalamiento y el badge de mensajes sin responder', async () => {
    basico();
    servidor.use(
      http.get('/v1/conversaciones', () =>
        HttpResponse.json({
          conversaciones: [
            conversacion({ id: 'c1', motivoDeEscalamiento: 'queja_o_reclamo', mensajesSinResponder: 4 }),
            conversacion({ id: 'c2', telefonoClienta: '4429998877', motivoDeEscalamiento: 'baja_confianza_ia', mensajesSinResponder: 1 }),
          ],
          hayMas: false,
        }),
      ),
    );

    montar(<Bandeja />);

    const lista = await screen.findByRole('list', { name: 'Conversaciones' });
    expect(within(lista).getByText('Queja o reclamo')).toBeInTheDocument();
    expect(within(lista).getByText('El bot no entendió')).toBeInTheDocument();
    expect(within(lista).getByLabelText('4 mensajes sin responder')).toBeInTheDocument();
    expect(within(lista).getByLabelText('1 mensaje sin responder')).toBeInTheDocument();
  });

  it('marca las conversaciones SIN CLIENTA IDENTIFICADA', async () => {
    // Pasa cuando dos clientas comparten teléfono (mamá e hija): el backend no elige, y quien
    // atiende tiene que saber que ese hilo no está vinculado a un expediente.
    basico();
    servidor.use(
      http.get('/v1/conversaciones', () =>
        HttpResponse.json({ conversaciones: [conversacion({ clientaId: null })], hayMas: false }),
      ),
    );

    montar(<Bandeja />);

    expect(await screen.findByText('Sin identificar')).toBeInTheDocument();
  });

  it('el filtro de pestaña PIDE `modo=humano` o `modo=bot` al backend', async () => {
    basico();
    const modosPedidos: (string | null)[] = [];
    servidor.use(
      http.get('/v1/conversaciones', ({ request }) => {
        modosPedidos.push(new URL(request.url).searchParams.get('modo'));
        return HttpResponse.json({ conversaciones: [], hayMas: false });
      }),
    );

    montar(<Bandeja />);

    await waitFor(() => expect(modosPedidos).toContain('humano'));

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Las lleva el bot' }));

    await waitFor(() => expect(modosPedidos).toContain('bot'));
  });

  it('el filtro de SUCURSAL viaja al backend', async () => {
    basico();
    const sucursalesPedidas: (string | null)[] = [];
    servidor.use(
      http.get('/v1/conversaciones', ({ request }) => {
        sucursalesPedidas.push(new URL(request.url).searchParams.get('sucursalId'));
        return HttpResponse.json({ conversaciones: [], hayMas: false });
      }),
    );

    montar(<Bandeja />);

    await screen.findByLabelText('Sucursal');
    // Igual que con las plantillas: la lista de sucursales es otra consulta.
    await screen.findByRole('option', { name: 'Lomas' });
    await userEvent.setup().selectOptions(screen.getByLabelText('Sucursal'), SUCURSAL_LOMAS);

    await waitFor(() => expect(sucursalesPedidas).toContain(SUCURSAL_LOMAS));
  });
});

describe('Contador de escaladas pendientes (`DEC-046`)', () => {
  // `montar` envuelve en `ProveedorDeSesion`, que pide `/yo`. Con `onUnhandledRequest: 'error'`
  // una petición sin manejador hace fallar la prueba, así que se declara aunque el contador no lo
  // use — es la contrapartida de haber elegido que MSW sea estricto.
  const conSesion = () => servidor.use(http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfil('GERENTE'))));

  it('muestra el TOTAL y CUÁNTO LLEVA ESPERANDO la más antigua', async () => {
    conSesion();
    /**
     * `DEC-046`: *cuántas* esperan importa menos que *cuánto llevan esperando*. Tres de hace dos
     * minutos son una mañana normal; una de hace dos horas es un fallo de atención. Un número a
     * secas no distingue esos dos casos, y es la razón de que `masAntiguaEn` esté en la respuesta.
     */
    servidor.use(http.get('/v1/conversaciones/escaladas/pendientes', () => HttpResponse.json(escaladas({ total: 3 }))));

    montar(<ContadorDeEscaladas />);

    const enlace = await screen.findByRole('link', { name: /3 conversaciones esperando a una persona/ });
    expect(enlace).toHaveAttribute('href', '/bandeja?filtro=escaladas');
    expect(enlace).toHaveAccessibleName(/la más antigua hace 2 h/);
  });

  it('con CERO pendientes lo dice, sin alarma', async () => {
    conSesion();
    servidor.use(
      http.get('/v1/conversaciones/escaladas/pendientes', () =>
        HttpResponse.json(escaladas({ total: 0, porSucursal: [], masAntiguaEn: null })),
      ),
    );

    montar(<ContadorDeEscaladas />);

    expect(await screen.findByText('Todo atendido')).toBeInTheDocument();
  });

  it('si la consulta FALLA no pinta nada: un "0" falso es peor que nada', async () => {
    // Un contador en 0 por un fallo de red diría "todo atendido" cuando no se sabe, y es
    // exactamente la información que no se puede dar mal.
    conSesion();
    servidor.use(
      http.get('/v1/conversaciones/escaladas/pendientes', () => new HttpResponse(null, { status: 500 })),
    );

    const { container } = montar(<ContadorDeEscaladas />);

    await waitFor(() => expect(container.querySelector('a')).toBeNull());
  });
});
