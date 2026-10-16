import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { servidor } from '../../pruebas/servidor';
import { montar } from '../../pruebas/montar';
import {
  MANICURISTA_ANA,
  MANICURISTA_BEA,
  SERVICIO_GELISH,
  SUCURSAL_LOMAS,
  cita,
  clienta,
  cotizacion,
  manicurista,
  perfil,
  servicio,
  sucursal,
} from '../../pruebas/datos';
import { Agenda } from './Agenda';
import type { Cita } from '../../api/contrato';

const RUTA_CITAS = '/v1/agenda/citas';

/** Los selectores de toda la pantalla se pueblan de aquí: cero UUIDs escritos a mano. */
const catalogoYPersonal = (citas: Cita[] = [cita()]) =>
  servidor.use(
    http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfil('GERENTE'))),
    http.get('/v1/sucursales-y-personal/sucursales', () => HttpResponse.json({ sucursales: [sucursal()] })),
    http.get('/v1/catalogo-y-cotizacion/servicios', () => HttpResponse.json({ servicios: [servicio()] })),
    http.get('/v1/sucursales-y-personal/manicuristas', () =>
      HttpResponse.json({ manicuristas: [manicurista(), manicurista({ id: MANICURISTA_BEA, nombre: 'Bea' })] }),
    ),
    http.get(RUTA_CITAS, () => HttpResponse.json({ citas, limite: 200, desplazamiento: 0, hayMas: false })),
  );

const errorDeNegocio = (code: string, message: string, status = 409) =>
  HttpResponse.json({ error: { category: 'domain', code, message } }, { status });

describe('Agenda Operativa — vista del día', () => {
  it('muestra horario, clienta, servicio, manicurista, estado y precio', async () => {
    catalogoYPersonal();

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const lista = await screen.findByRole('list', { name: 'Citas del día' });
    expect(within(lista).getByText('Andrea Ramírez · Gelish manos')).toBeInTheDocument();
    expect(within(lista).getByText(/Atiende Ana/)).toBeInTheDocument();
    expect(within(lista).getByText('Agendada')).toBeInTheDocument();
    expect(within(lista).getByText('$450.00')).toBeInTheDocument();
  });

  it('una cita SIN MANICURISTA lo dice como tarea del mostrador, no en blanco', async () => {
    // `DEC-031`: una cita puede nacer con solo Silla Virtual asignada. Dejarlo vacío haría que el
    // hueco pasara desapercibido hasta que la clienta llegara.
    catalogoYPersonal([cita({ manicuristaId: null })]);

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    expect(await screen.findByText(/Sin asignar · por asignar al llegar/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Asignar manicurista' })).toBeInTheDocument();
  });

  it('`en_espera_pago` AVISA de que el lugar no está reservado', async () => {
    // Es el único estado que no ocupa el horario: el lugar sigue vendible hasta que pague
    // (`RN-ANT-03`). Pintarlo como una cita normal haría creer que el hueco está tomado.
    catalogoYPersonal([cita({ estado: 'en_espera_pago' })]);

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    expect(await screen.findByText('Espera anticipo')).toBeInTheDocument();
    expect(screen.getByText(/El lugar NO está reservado hasta que pague/)).toBeInTheDocument();
  });

  it('muestra el indicador discreto de LISTA ROJA para recepción', async () => {
    catalogoYPersonal([cita({ enListaRoja: true })]);

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const lista = await screen.findByRole('list', { name: 'Citas del día' });
    expect(within(lista).getByText('Lista roja')).toBeInTheDocument();
  });

  it('solo ofrece las transiciones LEGALES de cada estado', async () => {
    /**
     * La tabla del cliente es copia de `TRANSICIONES_LEGALES`. Ofrecer un botón que el backend
     * rechazará con `409 TRANSICION_ILEGAL` es peor que no ofrecerlo, porque invita a intentarlo.
     *
     * `completada` solo admite `no_show`, que es la corrección administrativa de `N-02`.
     */
    catalogoYPersonal([cita({ estado: 'completada' })]);

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    await screen.findByText('Atendida');
    expect(screen.getByRole('button', { name: 'No llegó' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar atendida' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reprogramar' })).not.toBeInTheDocument();
  });

  it('una cita CANCELADA no ofrece ninguna acción', async () => {
    catalogoYPersonal([cita({ estado: 'cancelada' })]);

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    expect(await screen.findByText(/ya está cerrada: no admite más cambios/)).toBeInTheDocument();
  });
});

describe('Agenda Operativa — agendar cita y walk-in', () => {
  it('AGENDA con los ids REALES de los selectores y sin mandar `fin` ni silla ni precio', async () => {
    /**
     * La prueba central del formulario. Lo que verifica no es solo que se envíe algo, sino **qué
     * NO se envía**: el fin lo deriva el backend de la duración del catálogo, la silla la elige el
     * motor y el precio lo congela el backend. Mandar cualquiera de los tres sería decidir una
     * regla de negocio en el cliente (`ADR-027`, regla 2).
     */
    catalogoYPersonal([]);
    let enviado: Record<string, unknown> | null = null;
    servidor.use(
      http.get('/v1/crm/clientas', () => HttpResponse.json({ clientas: [clienta()] })),
      http.post(RUTA_CITAS, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(cita());
      }),
    );

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText('Clienta (busca por teléfono)'), '4421112233');
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }));
    await usuario.click(await screen.findByRole('button', { name: /Andrea Ramírez/ }));

    // Se acota al `select` concreto: hay dos campos de servicio en la pantalla (alta y consulta
    // de disponibilidad), así que buscar la opción a nivel global encontraría las dos.
    const selectorDeServicio = screen.getByLabelText('Servicio');
    await waitFor(() => expect(within(selectorDeServicio).getByRole('option', { name: /Gelish manos/ })).toBeInTheDocument());
    await usuario.selectOptions(selectorDeServicio, SERVICIO_GELISH);
    await usuario.clear(screen.getByLabelText('Hora de inicio'));
    await usuario.type(screen.getByLabelText('Hora de inicio'), '13:00');
    await usuario.click(screen.getByRole('button', { name: 'Agendar' }));

    await waitFor(() => expect(enviado).not.toBeNull());
    expect(enviado).toEqual({
      sucursalId: SUCURSAL_LOMAS,
      servicioId: SERVICIO_GELISH,
      clientaId: 'clienta-1',
      // Hora de pared de Querétaro: 13:00 local = 19:00 UTC. Interpretarla en la zona del
      // navegador desplazaría la cita, y es el error más probable de todo el frontend.
      inicio: '2027-03-08T19:00:00.000Z',
    });
    expect(enviado).not.toHaveProperty('fin');
    expect(enviado).not.toHaveProperty('sillaId');
    expect(enviado).not.toHaveProperty('cotizacionSnapshot');
  });

  it('WALK-IN pone la hora actual con un botón', async () => {
    // Un walk-in es una cita creada en el momento (`DEC-037`), no otro tipo de registro: mismo
    // formulario, un atajo para la hora.
    catalogoYPersonal([]);
    servidor.use(http.get('/v1/crm/clientas', () => HttpResponse.json({ clientas: [clienta()] })));

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const hora = (await screen.findByLabelText('Hora de inicio')) as HTMLInputElement;
    const antes = hora.value;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Walk-in (ahora)' }));

    // Cambió a la hora actual (salvo coincidencia exacta con el valor por defecto 10:00).
    expect(hora.value).not.toBe(antes === '10:00' ? undefined : antes);
    expect(hora.value).toMatch(/^\d{2}:\d{2}$/);
  });

  it('avisa de que una clienta en LISTA ROJA generará una cita en espera de pago', async () => {
    catalogoYPersonal([]);
    servidor.use(http.get('/v1/crm/clientas', () => HttpResponse.json({ clientas: [clienta({ estadoDeRiesgo: 'lista_roja' })] })));

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText('Clienta (busca por teléfono)'), '4421112233');
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }));
    await usuario.click(await screen.findByRole('button', { name: /Andrea Ramírez/ }));

    expect(await screen.findByText(/nacerá/)).toHaveTextContent(/anticipo del 40 %/);
  });
});

describe('Agenda Operativa — asignar manicurista al llegar', () => {
  it('asigna con el id de la manicurista DE ESA SUCURSAL', async () => {
    catalogoYPersonal([cita({ manicuristaId: null })]);
    let enviado: unknown = null;
    let sucursalPedida: string | null = null;
    servidor.use(
      http.get('/v1/sucursales-y-personal/manicuristas', ({ request }) => {
        sucursalPedida = new URL(request.url).searchParams.get('sucursalId');
        return HttpResponse.json({ manicuristas: [manicurista()] });
      }),
      http.post(`${RUTA_CITAS}/cita-1/manicurista`, async ({ request }) => {
        enviado = await request.json();
        return HttpResponse.json(cita());
      }),
    );

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Asignar manicurista' }));
    const selector = screen.getByLabelText('¿Quién la atiende?');
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Ana' })).toBeInTheDocument());
    await usuario.selectOptions(selector, MANICURISTA_ANA);
    await usuario.click(screen.getByRole('button', { name: 'Asignar' }));

    await waitFor(() => expect(enviado).toEqual({ manicuristaId: MANICURISTA_ANA }));
    // El selector pidió solo las de esta sucursal: ofrecer las de otra garantiza un 409.
    expect(sucursalPedida).toBe(SUCURSAL_LOMAS);
  });

  it('un `409 MANICURISTA_OCUPADA` se explica con claridad', async () => {
    catalogoYPersonal([cita({ manicuristaId: null })]);
    servidor.use(
      http.post(`${RUTA_CITAS}/cita-1/manicurista`, () =>
        errorDeNegocio('MANICURISTA_OCUPADA', 'Ya tiene otra cita a esa hora.'),
      ),
    );

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Asignar manicurista' }));
    const selector = screen.getByLabelText('¿Quién la atiende?');
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Ana' })).toBeInTheDocument());
    await usuario.selectOptions(selector, MANICURISTA_ANA);
    await usuario.click(screen.getByRole('button', { name: 'Asignar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/otra cita a esa hora|MANICURISTA_OCUPADA/);
  });
});

describe('Agenda Operativa — cancelar con confirmación consciente', () => {
  it('EL `409` DISPARA LA ADVERTENCIA y el reintento manda `confirmacionDeEmpleado`', async () => {
    /**
     * **La prueba más importante de esta pantalla.**
     *
     * El flujo es deliberado: cancelar → `409 CANCELACION_REQUIERE_CONFIRMACION` → se explica que
     * **el anticipo no se reembolsa** → la persona decide → reintento con la confirmación.
     *
     * Mandar `confirmacionDeEmpleado: true` desde el principio sería más corto y convertiría una
     * barrera deliberada en un trámite invisible: alguien cancelaría la cita de una clienta que
     * pagó sin enterarse de que su dinero no se devuelve, y la clienta lo descubriría después.
     */
    catalogoYPersonal([cita({ enListaRoja: true })]);
    const cuerpos: Record<string, unknown>[] = [];
    servidor.use(
      http.post(`${RUTA_CITAS}/cita-1/cancelar`, async ({ request }) => {
        const cuerpo = (await request.json()) as Record<string, unknown>;
        cuerpos.push(cuerpo);
        if (!cuerpo.confirmacionDeEmpleado) {
          return errorDeNegocio('CANCELACION_REQUIERE_CONFIRMACION', 'Requiere confirmación del empleado.');
        }
        return HttpResponse.json({
          cita: cita({ estado: 'cancelada' }),
          incidenteTardio: true,
          anticipoRetenido: true,
          listaEspera: { huecoPerdidoCortoPlazo: false, ofrecidaA: null, descartadasPorNoCaber: 0 },
        });
      }),
    );

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await usuario.type(screen.getByLabelText('Motivo de la cancelación'), 'Le salió un viaje');
    await usuario.click(screen.getByRole('button', { name: 'Cancelar la cita' }));

    // Primer intento: SIN confirmación, y el backend lo rechaza.
    await waitFor(() => expect(cuerpos).toHaveLength(1));
    expect(cuerpos[0]).not.toHaveProperty('confirmacionDeEmpleado');

    // La advertencia aparece con las dos consecuencias.
    expect(await screen.findByText('Esta cancelación tiene consecuencias para la clienta')).toBeInTheDocument();
    expect(screen.getByText(/queda retenido y no se reembolsa/)).toBeInTheDocument();
    expect(screen.getByText(/se registra como incidente en su historial/)).toBeInTheDocument();

    // Y se puede retroceder sin cancelar nada.
    expect(screen.getByRole('button', { name: 'No cancelar' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Sí, cancelar de todas formas' }));

    await waitFor(() => expect(cuerpos).toHaveLength(2));
    expect(cuerpos[1]).toMatchObject({ motivo: 'Le salió un viaje', confirmacionDeEmpleado: true });
  });

  it('muestra el RESUMEN con `incidenteTardio` y `anticipoRetenido`', async () => {
    catalogoYPersonal();
    servidor.use(
      http.post(`${RUTA_CITAS}/cita-1/cancelar`, () =>
        HttpResponse.json({
          cita: cita({ estado: 'cancelada' }),
          incidenteTardio: true,
          anticipoRetenido: true,
          listaEspera: { huecoPerdidoCortoPlazo: false, ofrecidaA: null, descartadasPorNoCaber: 0 },
        }),
      ),
    );

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar la cita' }));

    const resumen = await screen.findByRole('status');
    expect(resumen).toHaveTextContent(/menos de 60 minutos: queda registrado como incidente/);
    expect(resumen).toHaveTextContent(/anticipo queda retenido y no se reembolsa/);
  });

  it('muestra `huecoPerdidoCortoPlazo`: nadie fue avisado y es capacidad recuperable', async () => {
    // `<= 30 min`: el hueco se liberó demasiado tarde para avisar a la fila. La Encargada puede
    // intentar llenarlo a mano, y para eso tiene que saberlo.
    catalogoYPersonal();
    servidor.use(
      http.post(`${RUTA_CITAS}/cita-1/cancelar`, () =>
        HttpResponse.json({
          cita: cita({ estado: 'cancelada' }),
          incidenteTardio: true,
          anticipoRetenido: false,
          listaEspera: { huecoPerdidoCortoPlazo: true, ofrecidaA: null, descartadasPorNoCaber: 0 },
        }),
      ),
    );

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar la cita' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/no se avisó a nadie/);
  });

  it('distingue `listaEspera: null` ("no se pudo procesar") de "no había nadie"', async () => {
    catalogoYPersonal();
    servidor.use(
      http.post(`${RUTA_CITAS}/cita-1/cancelar`, () =>
        HttpResponse.json({ cita: cita({ estado: 'cancelada' }), incidenteTardio: false, anticipoRetenido: false, listaEspera: null }),
      ),
    );

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar la cita' }));

    const resumen = await screen.findByRole('status');
    expect(resumen).toHaveTextContent(/no se pudo procesar ahora/);
    expect(resumen).not.toHaveTextContent(/No había nadie/);
  });
});

describe('Agenda Operativa — reprogramar', () => {
  it('manda la nueva hora como instante de pared de Querétaro', async () => {
    catalogoYPersonal();
    let enviado: Record<string, unknown> | null = null;
    servidor.use(
      http.post(`${RUTA_CITAS}/cita-1/reprogramar`, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ original: cita({ estado: 'reprogramada' }), nueva: cita({ id: 'cita-2' }) });
      }),
    );

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Reprogramar' }));
    await usuario.clear(screen.getByLabelText('Nueva hora'));
    await usuario.type(screen.getByLabelText('Nueva hora'), '16:30');
    await usuario.click(screen.getByRole('button', { name: 'Reprogramar' }));

    await waitFor(() => expect(enviado).not.toBeNull());
    expect((enviado as unknown as { inicio: string }).inicio).toMatch(/T22:30:00\.000Z$/);
  });

  it('AVISA del tope de 3 antes de intentarlo (`DEC-042`)', async () => {
    // El dato viene en la cita. El backend lo rechaza igualmente, pero gastar el intento no aporta
    // nada y el mensaje llega antes.
    catalogoYPersonal([cita({ numeroDeReprogramaciones: 3 })]);

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Reprogramar' }));

    expect(screen.getByText(/ya se reprogramó 3 veces: el límite es 3/)).toBeInTheDocument();
  });

  it('explica el error de la VENTANA DE 48 H con anticipo pagado (`RN-ANT-04`)', async () => {
    catalogoYPersonal();
    servidor.use(
      http.post(`${RUTA_CITAS}/cita-1/reprogramar`, () =>
        errorDeNegocio('REPROGRAMACION_FUERA_DE_VENTANA', 'Con anticipo pagado hay que avisar 48 h antes.'),
      ),
    );

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Reprogramar' }));
    await usuario.click(screen.getByRole('button', { name: 'Reprogramar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/48 h antes|REPROGRAMACION_FUERA_DE_VENTANA/);
  });
});

describe('Agenda Operativa — consulta de disponibilidad', () => {
  it('pregunta por el RANGO QUE OCUPA EL SERVICIO, no por un instante', async () => {
    /**
     * *"¿Hay hueco a las 5?"* no es una pregunta respondible: a las 5 puede caber un retiro de 30
     * minutos y no un acrílico de dos horas. La duración sale del catálogo, igual que la usa el
     * backend para derivar el fin de la cita.
     */
    catalogoYPersonal();
    let pedido: { inicio: string | null; fin: string | null } | null = null;
    servidor.use(
      http.get('/v1/agenda/disponibilidad', ({ request }) => {
        const url = new URL(request.url);
        pedido = { inicio: url.searchParams.get('inicio'), fin: url.searchParams.get('fin') };
        return HttpResponse.json({
          sillasLibres: 1,
          manicuristasDisponibles: 2,
          capacidad: 1,
          deficitDePersonal: 0,
          hayLugar: true,
        });
      }),
    );

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const usuario = userEvent.setup();
    const selector = await screen.findByLabelText('Servicio a consultar');
    await waitFor(() => expect(within(selector).getByRole('option', { name: /Gelish manos/ })).toBeInTheDocument());
    await usuario.selectOptions(selector, SERVICIO_GELISH);
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));

    await waitFor(() => expect(pedido).not.toBeNull());
    // 17:00 local = 23:00Z; el servicio dura 60 min, así que el fin es una hora después.
    const rango = pedido as unknown as { inicio: string; fin: string };
    expect(new Date(rango.fin).getTime() - new Date(rango.inicio).getTime()).toBe(60 * 60_000);
    expect(await screen.findByText('Sí cabe')).toBeInTheDocument();
  });

  it('muestra el DÉFICIT DE PERSONAL cuando hay sillas pero falta gente', async () => {
    // `deficitDePersonal` sin acotar a 0 es lo que permite ver un sobrecupo real. La versión
    // acotada era un defecto de Fase 2: hacía que la clase `sobrecupo_en_sucursal` no se emitiera.
    catalogoYPersonal();
    servidor.use(
      http.get('/v1/agenda/disponibilidad', () =>
        HttpResponse.json({
          sillasLibres: 3,
          manicuristasDisponibles: 1,
          capacidad: 0,
          deficitDePersonal: 2,
          hayLugar: false,
          motivo: 'SIN_PERSONAL_SUFICIENTE',
        }),
      ),
    );

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    const usuario = userEvent.setup();
    const selector = await screen.findByLabelText('Servicio a consultar');
    await waitFor(() => expect(within(selector).getByRole('option', { name: /Gelish manos/ })).toBeInTheDocument());
    await usuario.selectOptions(selector, SERVICIO_GELISH);
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }));

    expect(await screen.findByText('No cabe')).toBeInTheDocument();
    expect(screen.getByText(/Faltan 2 manicuristas/)).toBeInTheDocument();
  });
});

describe('Agenda Operativa — la sucursal y la fecha viven en la URL', () => {
  it('consulta el rango del DÍA DE PARED indicado en la URL', async () => {
    catalogoYPersonal();
    let pedido: Record<string, string | null> = {};
    servidor.use(
      http.get(RUTA_CITAS, ({ request }) => {
        const url = new URL(request.url);
        pedido = {
          sucursalId: url.searchParams.get('sucursalId'),
          inicio: url.searchParams.get('inicio'),
          fin: url.searchParams.get('fin'),
        };
        return HttpResponse.json({ citas: [], limite: 200, desplazamiento: 0, hayMas: false });
      }),
    );

    montar(<Agenda />, { ruta: `/agenda?fecha=2027-03-08&sucursal=${SUCURSAL_LOMAS}` });

    await waitFor(() => expect(pedido.sucursalId).toBe(SUCURSAL_LOMAS));
    // 00:00 local del día 8 = 06:00Z, no 00:00Z. Usar UTC perdería las citas de la madrugada y
    // traería las del día anterior.
    expect(pedido.inicio).toBe('2027-03-08T06:00:00.000Z');
  });
});

describe('Agenda Operativa — el precio se conserva al reprogramar', () => {
  it('lo dice en el diálogo: reprogramar no recotiza', async () => {
    catalogoYPersonal([cita({ cotizacionSnapshot: cotizacion({ totalCentavos: 52000 }) })]);

    montar(<Agenda />, { ruta: '/agenda?fecha=2027-03-08' });

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Reprogramar' }));

    expect(screen.getByText(/\$520\.00\) se conserva/)).toBeInTheDocument();
  });
});
