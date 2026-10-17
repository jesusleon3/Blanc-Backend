import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { servidor } from '../../pruebas/servidor';
import { montar } from '../../pruebas/montar';
import { vigilarRechazosNoGestionados } from '../../pruebas/rechazos';
import { MANICURISTA_ANA, SUCURSAL_LOMAS, SUCURSAL_ZIBATA, manicurista, perfil, sucursal } from '../../pruebas/datos';
import { PersonalAdmin } from './componentes/PersonalAdmin';
import { SucursalesYSillas } from './componentes/SucursalesYSillas';

const MANICURISTAS = '/v1/sucursales-y-personal/manicuristas';
const SILLAS = '/v1/agenda/sillas';

const contexto = () =>
  servidor.use(
    http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfil('ADMINISTRADOR'))),
    http.get('/v1/sucursales-y-personal/sucursales', () =>
      HttpResponse.json({ sucursales: [sucursal(), sucursal({ id: SUCURSAL_ZIBATA, nombre: 'Zibatá' })] }),
    ),
  );

describe('Backoffice — Personal', () => {
  /**
   * El `409 MANICURISTA_CON_CITAS_ACTIVAS` es el caso **esperado** de esta pantalla, no una
   * anomalía: es la barrera funcionando. Con `await mutateAsync()` en el `onClick`, cada vez que
   * funcionaba dejaba un rechazo de promesa sin gestionar — ver `vigilarRechazosNoGestionados`.
   */
  vigilarRechazosNoGestionados();
  it('EXPLICA el 409 MANICURISTA_CON_CITAS_ACTIVAS en vez de mostrar un conflicto genérico', async () => {
    /**
     * ## EL CASO QUE JUSTIFICA LA PANTALLA ENTERA
     *
     * `DesactivarManicuristaUseCase` bloquea la baja si hay citas futuras asignadas. Es una barrera
     * deliberada: una baja silenciosa dejaría esas citas **sin nadie que las atienda**, el motor de
     * disponibilidad dejaría de contarla, y nadie se enteraría hasta que la clienta llegara al
     * salón.
     *
     * Un *"Error 409: Conflict"* dejaría a la Dueña sin saber qué pasó ni qué hacer. El mensaje
     * tiene que nombrar la consecuencia y el siguiente paso.
     */
    contexto();
    servidor.use(
      http.get(MANICURISTAS, () => HttpResponse.json({ manicuristas: [manicurista()] })),
      http.post(`${MANICURISTAS}/${MANICURISTA_ANA}/desactivar`, () =>
        HttpResponse.json(
          {
            error: {
              category: 'domain',
              code: 'MANICURISTA_CON_CITAS_ACTIVAS',
              message: 'La manicurista tiene citas futuras; reasígnalas o cancélalas antes de darla de baja.',
            },
          },
          { status: 409 },
        ),
      ),
    );

    montar(<PersonalAdmin />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Dar de baja a Ana' }));

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(/citas futuras asignadas/);
    expect(aviso).toHaveTextContent(/las dejaría sin nadie que las atienda/);
    expect(aviso).toHaveTextContent(/reasígnalas o cancélalas en la Agenda/);

    // Y sigue activa: el rechazo no dejó la pantalla diciendo que se dio de baja.
    expect(screen.getByText('Activa')).toBeInTheDocument();
  });

  it('da de alta a una manicurista y aclara que eso NO le da acceso al sistema', async () => {
    /**
     * Manicurista y usuaria son dos cosas distintas: aquí vive la persona que atiende (lo que el
     * motor de disponibilidad necesita); el acceso al panel vive en Identidad y Accesos. Sin esta
     * aclaración, la Dueña daría de alta a alguien y esperaría que pudiera entrar al iPad.
     */
    contexto();
    let enviado: Record<string, unknown> | null = null;
    servidor.use(
      http.get(MANICURISTAS, () => HttpResponse.json({ manicuristas: [] })),
      http.post(MANICURISTAS, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(manicurista({ nombre: 'Karla' }), { status: 201 });
      }),
    );

    montar(<PersonalAdmin />);

    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText('Nombre'), 'Karla');
    await usuario.click(screen.getByRole('button', { name: 'Dar de alta' }));

    await waitFor(() => expect(enviado).toEqual({ nombre: 'Karla' }));
    expect(screen.getByText(/Darla de alta no le da acceso al sistema/)).toBeInTheDocument();
  });

  it('asigna a una manicurista a la sucursal elegida', async () => {
    contexto();
    let asignada: string | null = null;
    servidor.use(
      http.get(MANICURISTAS, ({ request }) => {
        // Con `?sucursalId=` responde "¿quién trabaja aquí?"; sin él, el registro completo. Aquí
        // Ana está dada de alta pero NO asignada a Lomas.
        const tieneFiltro = new URL(request.url).searchParams.has('sucursalId');
        return HttpResponse.json({ manicuristas: tieneFiltro ? [] : [manicurista()] });
      }),
      http.post(`${MANICURISTAS}/${MANICURISTA_ANA}/sucursales/${SUCURSAL_LOMAS}`, () => {
        asignada = MANICURISTA_ANA;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    montar(<PersonalAdmin />);

    const usuario = userEvent.setup();
    const selector = await screen.findByLabelText('Ver asignación en');
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Lomas' })).toBeInTheDocument());
    await usuario.selectOptions(selector, SUCURSAL_LOMAS);

    await usuario.click(await screen.findByRole('button', { name: 'Asignar a la sucursal a Ana' }));

    await waitFor(() => expect(asignada).toBe(MANICURISTA_ANA));
  });
});

describe('Backoffice — Sucursales y Sillas Virtuales', () => {
  const conSillas = (sillas: { id: string; sucursalId: string; nombre: string; activa: boolean }[]) => {
    contexto();
    servidor.use(http.get(SILLAS, () => HttpResponse.json({ sillas })));
  };

  it('dice cuántas citas simultáneas se pueden vender, que es lo que una silla significa', async () => {
    /**
     * `DEC-031`: el número de sillas activas **es** la capacidad vendible, y el
     * `MotorDisponibilidad` lo usa literalmente. Presentarlas como mobiliario haría que alguien
     * añadiera una "para ordenar la vista" y el sistema vendería una cita más de las que caben.
     */
    conSillas([
      { id: 'silla-1', sucursalId: SUCURSAL_LOMAS, nombre: 'Estación 1', activa: true },
      { id: 'silla-2', sucursalId: SUCURSAL_LOMAS, nombre: 'Estación 2', activa: true },
    ]);

    montar(<SucursalesYSillas />);

    const usuario = userEvent.setup();
    const selector = await screen.findByLabelText('Sucursal');
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Lomas' })).toBeInTheDocument());
    await usuario.selectOptions(selector, SUCURSAL_LOMAS);

    expect(await screen.findByText(/sillas activas en Lomas/)).toHaveTextContent('2 sillas activas en Lomas.');
    expect(screen.getByText(/no venderá más citas simultáneas que sillas activas/)).toBeInTheDocument();
  });

  it('con UNA sola silla avisa de que puede ser correcto y no un error de captura', async () => {
    /**
     * Álamos tiene una estación. Una sucursal de una silla parece un descuido, y "arreglarlo"
     * añadiendo sillas vendería dos citas a la vez donde solo cabe una.
     */
    conSillas([{ id: 'silla-1', sucursalId: SUCURSAL_LOMAS, nombre: 'Estación 1', activa: true }]);

    montar(<SucursalesYSillas />);

    const usuario = userEvent.setup();
    const selector = await screen.findByLabelText('Sucursal');
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Lomas' })).toBeInTheDocument());
    await usuario.selectOptions(selector, SUCURSAL_LOMAS);

    expect(await screen.findByText(/Una sola silla puede ser correcto/)).toBeInTheDocument();
  });

  it('añade una silla y advierte de que eso aumenta lo que se vende', async () => {
    conSillas([]);
    let enviado: Record<string, unknown> | null = null;
    servidor.use(
      http.post(SILLAS, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'silla-3', sucursalId: SUCURSAL_LOMAS, nombre: 'Estación 3', activa: true }, { status: 201 });
      }),
    );

    montar(<SucursalesYSillas />);

    const usuario = userEvent.setup();
    const selector = await screen.findByLabelText('Sucursal');
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Lomas' })).toBeInTheDocument());
    await usuario.selectOptions(selector, SUCURSAL_LOMAS);

    await usuario.type(await screen.findByLabelText('Nombre de la silla'), 'Estación 3');
    expect(screen.getByText(/aumenta cuántas citas simultáneas se venden/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Añadir silla' }));

    await waitFor(() => expect(enviado).toEqual({ sucursalId: SUCURSAL_LOMAS, nombre: 'Estación 3' }));
  });

  it('NO ofrece dar de alta sucursales desde el panel: sus horarios se cargan en el arranque', async () => {
    /**
     * Una sucursal necesita horario semanal por bloques, descansos y días festivos
     * (`RN-AGE-12`). Un formulario aquí sería una forma cómoda de dejarla a medio configurar en
     * producción, vendiendo huecos a horas en las que está cerrada. Se hace con `db:seed`.
     */
    conSillas([]);

    montar(<SucursalesYSillas />);

    expect(await screen.findByRole('list', { name: 'Sucursales' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sucursal/i })).not.toBeInTheDocument();
    expect(screen.getByText(/se cargan con el arranque del sistema, no desde aquí/)).toBeInTheDocument();
  });
});
