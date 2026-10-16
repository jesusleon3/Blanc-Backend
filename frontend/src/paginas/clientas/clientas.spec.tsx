import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { servidor } from '../../pruebas/servidor';
import { montar } from '../../pruebas/montar';
import { clienta, detalleDeClienta, incidente, perfil } from '../../pruebas/datos';
import { Clientas } from './Clientas';
import type { Rol } from '../../api/contrato';

const conSesion = (rol: Rol) =>
  servidor.use(http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfil(rol))));

const buscar = async (telefono = '4421112233') => {
  const usuario = userEvent.setup();
  await usuario.type(screen.getByPlaceholderText('Teléfono (10 dígitos)'), telefono);
  await usuario.click(screen.getByRole('button', { name: 'Buscar' }));
  return usuario;
};

describe('CRM de clientas', () => {
  it('MUESTRA LAS DOS clientas cuando comparten teléfono (mamá e hija)', async () => {
    /**
     * `RN-CRM-01` quedó superada justo por este caso. El backend **nunca elige** —elegir sería
     * adivinar, y la elección equivocada ataría el historial de incidentes a la persona errónea,
     * de la que además depende si se le pide anticipo— así que la pantalla tiene que presentar las
     * dos y dejar decidir a quien atiende.
     */
    conSesion('ADMINISTRADOR');
    servidor.use(
      http.get('/v1/crm/clientas', () =>
        HttpResponse.json({
          clientas: [
            clienta({ id: 'mama', nombre: 'Rosa Ramírez' }),
            clienta({ id: 'hija', nombre: 'Andrea Ramírez', estadoDeRiesgo: 'lista_roja' }),
          ],
        }),
      ),
    );

    montar(<Clientas />);
    await buscar();

    expect(await screen.findByText('Rosa Ramírez')).toBeInTheDocument();
    expect(screen.getByText('Andrea Ramírez')).toBeInTheDocument();
    expect(screen.getByText('Lista roja')).toBeInTheDocument();
  });

  it('distingue la SUGERENCIA automática del ESTADO, que solo cambia una persona', async () => {
    /**
     * `RN-CRM-06` enciende la sugerencia automáticamente; `RN-CRM-05` prohíbe que el estado se
     * asigne solo. Son **dos datos distintos** y la interfaz tiene que mostrarlos como tales:
     * fusionarlos sería presentar como hecho lo que es una propuesta.
     */
    conSesion('ADMINISTRADOR');
    servidor.use(
      http.get('/v1/crm/clientas', () =>
        HttpResponse.json({ clientas: [clienta({ sugeridaListaRoja: true, estadoDeRiesgo: 'normal' })] }),
      ),
      http.get('/v1/crm/clientas/clienta-1', () =>
        HttpResponse.json(detalleDeClienta({ clienta: clienta({ sugeridaListaRoja: true, estadoDeRiesgo: 'normal' }) })),
      ),
    );

    montar(<Clientas />);
    const usuario = await buscar();

    await usuario.click(await screen.findByRole('button', { name: /Andrea Ramírez/ }));

    expect(await screen.findByText(/sugiere/)).toBeInTheDocument();
    expect(screen.getByText(/La decisión es tuya: no se aplica sola/)).toBeInTheDocument();
    // El estado sigue siendo `normal`: la sugerencia no lo cambió.
    expect(screen.getAllByText('Normal').length).toBeGreaterThan(0);
  });

  it('muestra el HISTORIAL DE INCIDENTES con su antelación', async () => {
    conSesion('ADMINISTRADOR');
    servidor.use(
      http.get('/v1/crm/clientas', () => HttpResponse.json({ clientas: [clienta()] })),
      http.get('/v1/crm/clientas/clienta-1', () =>
        HttpResponse.json(
          detalleDeClienta({
            incidentes: [
              incidente({ id: 'i1', tipo: 'no_show', minutosDeAntelacion: null }),
              incidente({ id: 'i2', tipo: 'cancelacion_tardia', minutosDeAntelacion: 45 }),
              incidente({ id: 'i3', tipo: 'cancelacion_ordinaria', minutosDeAntelacion: 2880 }),
            ],
          }),
        ),
      ),
    );

    montar(<Clientas />);
    const usuario = await buscar();
    await usuario.click(await screen.findByRole('button', { name: /Andrea Ramírez/ }));

    await screen.findByText('Historial de incidentes');
    expect(screen.getByText('No llegó')).toBeInTheDocument();
    expect(screen.getByText('Canceló tarde')).toBeInTheDocument();
    expect(screen.getByText('Canceló con tiempo')).toBeInTheDocument();
    expect(screen.getByText(/avisó 45 min antes/)).toBeInTheDocument();
  });
});

describe('CRM — lista roja es control EXCLUSIVO de la Dueña (`DEC-042`)', () => {
  const sembrar = () =>
    servidor.use(
      http.get('/v1/crm/clientas', () => HttpResponse.json({ clientas: [clienta()] })),
      http.get('/v1/crm/clientas/clienta-1', () => HttpResponse.json(detalleDeClienta())),
    );

  it('la DUEÑA ve los botones de marcar y bloquear', async () => {
    conSesion('ADMINISTRADOR');
    sembrar();

    montar(<Clientas />);
    const usuario = await buscar();
    await usuario.click(await screen.findByRole('button', { name: /Andrea Ramírez/ }));

    expect(await screen.findByRole('button', { name: 'Marcar lista roja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bloquear' })).toBeInTheDocument();
  });

  it('la ENCARGADA NO VE esos botones, y la pantalla le dice de quién es la decisión', async () => {
    /**
     * No se le muestran deshabilitados sino que **no se muestran**: un botón gris invita a
     * preguntar por qué no funciona.
     *
     * Y la restricción real no es esta: el `@Roles` de `POST /:id/estado-de-riesgo` ya responde
     * `403` a la Encargada. Esto es presentación (`ADR-027`, regla 1).
     */
    conSesion('GERENTE');
    sembrar();

    montar(<Clientas />);
    expect(await screen.findByText(/Marcar o retirar lista roja lo decide la Dueña/)).toBeInTheDocument();

    const usuario = await buscar();
    await usuario.click(await screen.findByRole('button', { name: /Andrea Ramírez/ }));

    await screen.findByText('Historial de incidentes');
    expect(screen.queryByRole('button', { name: 'Marcar lista roja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bloquear' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rehabilitar' })).not.toBeInTheDocument();
  });

  it('marcar lista roja PIDE CONFIRMACIÓN y explica la consecuencia económica', async () => {
    // Marcar lista roja le exige a la clienta un anticipo del 40% para poder agendar. Es una
    // decisión con impacto económico sobre una persona: no puede quedar a un clic.
    conSesion('ADMINISTRADOR');
    sembrar();
    let accionEnviada: unknown = null;
    servidor.use(
      http.post('/v1/crm/clientas/clienta-1/estado-de-riesgo', async ({ request }) => {
        accionEnviada = await request.json();
        return HttpResponse.json(clienta({ estadoDeRiesgo: 'lista_roja' }));
      }),
    );

    montar(<Clientas />);
    const usuario = await buscar();
    await usuario.click(await screen.findByRole('button', { name: /Andrea Ramírez/ }));

    await usuario.click(await screen.findByRole('button', { name: 'Marcar lista roja' }));
    expect(screen.getByText(/anticipo del 40 % para agendar/)).toBeInTheDocument();
    expect(accionEnviada).toBeNull();

    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(accionEnviada).toEqual({ accion: 'marcar_lista_roja' }));
  });

  it('una clienta BLOQUEADA solo ofrece rehabilitar', async () => {
    conSesion('ADMINISTRADOR');
    servidor.use(
      http.get('/v1/crm/clientas', () => HttpResponse.json({ clientas: [clienta({ estadoDeRiesgo: 'bloqueada' })] })),
      http.get('/v1/crm/clientas/clienta-1', () =>
        HttpResponse.json(detalleDeClienta({ clienta: clienta({ estadoDeRiesgo: 'bloqueada' }) })),
      ),
    );

    montar(<Clientas />);
    const usuario = await buscar();
    await usuario.click(await screen.findByRole('button', { name: /Andrea Ramírez/ }));

    expect(await screen.findByRole('button', { name: 'Rehabilitar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bloquear' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar lista roja' })).not.toBeInTheDocument();
  });

  it('un `403` al marcar se explica como falta de permiso', async () => {
    // Si la interfaz se equivocara y mostrara el botón a quien no debe, el backend lo frena y el
    // mensaje tiene que ser legible.
    conSesion('ADMINISTRADOR');
    sembrar();
    servidor.use(
      http.post('/v1/crm/clientas/clienta-1/estado-de-riesgo', () =>
        HttpResponse.json({ error: { category: 'domain', code: 'ACCESO_DENEGADO', message: 'No.' } }, { status: 403 }),
      ),
    );

    montar(<Clientas />);
    const usuario = await buscar();
    await usuario.click(await screen.findByRole('button', { name: /Andrea Ramírez/ }));
    await usuario.click(await screen.findByRole('button', { name: 'Marcar lista roja' }));
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para hacer esto.');
  });

  it('NO busca hasta que hay un teléfono: evita un 400 de validación al montar', async () => {
    conSesion('ADMINISTRADOR');
    let llamadas = 0;
    servidor.use(
      http.get('/v1/crm/clientas', () => {
        llamadas += 1;
        return HttpResponse.json({ clientas: [] });
      }),
    );

    montar(<Clientas />);

    await screen.findByText('Busca una clienta por su teléfono');
    expect(llamadas).toBe(0);
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled();
  });

  it('dice claramente cuando NINGUNA clienta tiene ese teléfono', async () => {
    conSesion('ADMINISTRADOR');
    servidor.use(http.get('/v1/crm/clientas', () => HttpResponse.json({ clientas: [] })));

    montar(<Clientas />);
    await buscar('4440000000');

    expect(await screen.findByText('Ninguna clienta con ese teléfono')).toBeInTheDocument();
  });
});

describe('CRM — el teléfono viaja al backend', () => {
  it('manda el teléfono tecleado como parámetro de búsqueda', async () => {
    conSesion('ADMINISTRADOR');
    const telefonos: (string | null)[] = [];
    servidor.use(
      http.get('/v1/crm/clientas', ({ request }) => {
        telefonos.push(new URL(request.url).searchParams.get('telefono'));
        return HttpResponse.json({ clientas: [clienta()] });
      }),
    );

    montar(<Clientas />);
    await buscar('4425556677');

    await waitFor(() => expect(telefonos).toContain('4425556677'));
    const lista = screen.getByRole('list');
    expect(within(lista).getByText('Andrea Ramírez')).toBeInTheDocument();
  });
});
