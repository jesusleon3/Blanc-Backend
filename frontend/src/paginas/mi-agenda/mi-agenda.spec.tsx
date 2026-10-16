import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { servidor } from '../../pruebas/servidor';
import { montar } from '../../pruebas/montar';
import { SUCURSAL_ZIBATA, citaDeManicurista, cotizacion, perfil, servicio, sucursal } from '../../pruebas/datos';
import { MiAgenda } from './MiAgenda';
import { App } from '../../App';

const RUTA_CITAS = '/v1/agenda/citas';

const basico = (citas = [citaDeManicurista()], perfilUsado = perfil('MANICURISTA')) =>
  servidor.use(
    http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfilUsado)),
    http.get('/v1/sucursales-y-personal/sucursales', () => HttpResponse.json({ sucursales: [sucursal()] })),
    http.get('/v1/catalogo-y-cotizacion/servicios', () => HttpResponse.json({ servicios: [servicio()] })),
    http.get(RUTA_CITAS, () => HttpResponse.json({ citas, limite: 200, desplazamiento: 0, hayMas: false })),
  );

describe('Vista de iPad — qué muestra', () => {
  it('muestra horario, nombre de la clienta, servicio y DESGLOSE de precio', async () => {
    /**
     * La Dueña fue explícita: la Manicurista **ve precios**. Y el desglose, no solo el total — es
     * lo que le permite responder si la clienta pregunta por qué cuesta eso.
     *
     * El nombre de la clienta se añadió en esta entrega: va a atender físicamente a esa persona, y
     * ocultárselo no protege nada. Lo que `DEC-040` protege es la clasificación de riesgo.
     */
    basico([citaDeManicurista({ cotizacionSnapshot: cotizacion({ totalCentavos: 45000 }) })]);

    montar(<MiAgenda />, { ruta: '/mi-agenda' });

    const lista = await screen.findByRole('list', { name: 'Mis citas' });
    expect(within(lista).getByText('Andrea Ramírez')).toBeInTheDocument();
    // El nombre del servicio sale del snapshot congelado, no del catálogo vigente: es lo que se
    // cotizó al agendar, y el catálogo pudo cambiar de precio desde entonces.
    expect(within(lista).getAllByText('Gelish manos').length).toBeGreaterThan(0);
    expect(within(lista).getAllByText('$450.00').length).toBeGreaterThan(0);
  });

  it('un servicio de COTIZACIÓN MANUAL dice "por confirmar", NO $0.00', async () => {
    /**
     * **Era un defecto real de la Fase 5.** El tipo declaraba `totalCentavos: number` y el
     * backend devuelve `number | null`; `null` pasaba por el formateador de moneda y salía
     * **$0.00** — un precio falso en pantalla que la manicurista podría decirle a la clienta.
     *
     * `null` no es cero: es la negativa explícita del sistema a inventar un precio que debe fijar
     * una persona (`DEC-033`).
     */
    basico([
      citaDeManicurista({
        cotizacionSnapshot: cotizacion({ totalCentavos: null, requiereCotizacionManual: true }),
      }),
    ]);

    montar(<MiAgenda />, { ruta: '/mi-agenda' });

    const lista = await screen.findByRole('list', { name: 'Mis citas' });
    expect(within(lista).getByText('Precio por confirmar')).toBeInTheDocument();
    expect(within(lista).queryByText('$0.00')).not.toBeInTheDocument();
    expect(within(lista).getByText(/lo fija una encargada/)).toBeInTheDocument();
  });

  it('las citas vienen ORDENADAS por hora', async () => {
    basico([
      citaDeManicurista({ id: 'tarde', inicio: '2027-03-08T23:00:00.000Z', fin: '2027-03-09T00:00:00.000Z' }),
      citaDeManicurista({ id: 'temprano', inicio: '2027-03-08T16:00:00.000Z', fin: '2027-03-08T17:00:00.000Z' }),
    ]);

    montar(<MiAgenda />, { ruta: '/mi-agenda' });

    const lista = await screen.findByRole('list', { name: 'Mis citas' });
    const horas = within(lista)
      .getAllByRole('listitem')
      .map((elemento) => elemento.textContent ?? '');
    // 16:00Z = 10:00 a.m. local; 23:00Z = 05:00 p.m. local.
    expect(horas[0]).toContain('10:00');
    expect(horas[1]).toContain('05:00');
  });

  it('un día SIN CITAS lo dice', async () => {
    basico([]);

    montar(<MiAgenda />, { ruta: '/mi-agenda' });

    expect(await screen.findByText('No tienes citas este día')).toBeInTheDocument();
  });

  it('sin VÍNCULO de personal (`P9`) avisa en vez de decir "hoy no tienes nada"', async () => {
    /**
     * El backend devuelve **cero citas** —el lado seguro del error— y sin este aviso la pantalla
     * parecería decir *"hoy no tienes trabajo"*, que es una mentira con consecuencias: se iría a
     * casa.
     */
    basico([], perfil('MANICURISTA', { manicuristaId: null }));

    montar(<MiAgenda />, { ruta: '/mi-agenda' });

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/no está vinculada a tu ficha de personal/);
    expect(alerta).toHaveTextContent(/no es que no tengas trabajo hoy/);
  });

  it('junta las citas de TODAS las sucursales: una cobertura no la deja sin ver su día', async () => {
    /**
     * `DEC-036`: ese día puede estar cubriendo en otra sucursal. Preguntarle en cuál está la
     * obligaría a saber cambiar un selector para ver sus propias citas. El backend ya le devuelve
     * solo las suyas en cada sucursal.
     */
    servidor.use(
      http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfil('MANICURISTA'))),
      http.get('/v1/sucursales-y-personal/sucursales', () =>
        HttpResponse.json({ sucursales: [sucursal(), sucursal({ id: SUCURSAL_ZIBATA, nombre: 'Zibatá' })] }),
      ),
      http.get('/v1/catalogo-y-cotizacion/servicios', () => HttpResponse.json({ servicios: [servicio()] })),
      http.get(RUTA_CITAS, ({ request }) => {
        const sucursalId = new URL(request.url).searchParams.get('sucursalId');
        return HttpResponse.json({
          citas: [citaDeManicurista({ id: `cita-${sucursalId}`, sucursalId: sucursalId ?? '' })],
          limite: 200,
          desplazamiento: 0,
          hayMas: false,
        });
      }),
    );

    montar(<MiAgenda />, { ruta: '/mi-agenda' });

    const lista = await screen.findByRole('list', { name: 'Mis citas' });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('Vista de iPad — CERO MUTACIONES', () => {
  it('no hay NINGÚN botón de acción sobre una cita', async () => {
    /**
     * No es una omisión visual: los endpoints de cancelar, completar y `no_show` responden `403` a
     * su rol. Si alguien añadiera un botón aquí, no funcionaría — pero la prueba lo detectaría
     * antes de que llegue al iPad.
     */
    basico();

    montar(<MiAgenda />, { ruta: '/mi-agenda' });

    await screen.findByRole('list', { name: 'Mis citas' });

    for (const prohibido of ['Cancelar', 'Marcar atendida', 'No llegó', 'Confirmar', 'Reprogramar', 'Asignar manicurista', 'Pedir confirmación']) {
      expect(screen.queryByRole('button', { name: prohibido })).not.toBeInTheDocument();
    }

    // Los únicos controles son navegación: el día, «Hoy» y salir.
    const botones = screen.getAllByRole('button').map((boton) => boton.textContent);
    expect(botones.sort()).toEqual(['Hoy', 'Salir']);
  });

  it('NO HACE NINGUNA PETICIÓN de escritura', async () => {
    // Con `onUnhandledRequest: 'error'`, cualquier `POST` o `DELETE` sin manejador haría fallar la
    // prueba. No se declara ninguno a propósito: la ausencia es la aserción.
    const metodos: string[] = [];
    basico();
    servidor.events.on('request:start', ({ request }) => metodos.push(request.method));

    montar(<MiAgenda />, { ruta: '/mi-agenda' });
    await screen.findByRole('list', { name: 'Mis citas' });

    expect(metodos.every((metodo) => metodo === 'GET')).toBe(true);
    servidor.events.removeAllListeners();
  });
});

describe('Vista de iPad — CERO FUGAS (`DEC-040`)', () => {
  it('NO MUESTRA lista roja ni anticipos, ni aunque el backend se equivocara y los enviara', async () => {
    /**
     * **La prueba que importa.** El backend no envía estos campos a su rol, y aquí se le manda una
     * respuesta que **sí los trae** para comprobar que la pantalla no los pinta de todas formas.
     *
     * Es defensa en profundidad: la garantía real es que `ConsultarAgendaUseCase` ni consulta CRM
     * para ella, pero si un presenter futuro se descuidara, esta vista seguiría sin exponerlo.
     */
    basico([
      // Forma deliberadamente incorrecta: con `enListaRoja` y `clientaId`.
      { ...citaDeManicurista(), enListaRoja: true, clientaId: 'clienta-secreta-1' } as ReturnType<typeof citaDeManicurista>,
    ]);

    montar(<MiAgenda />, { ruta: '/mi-agenda' });

    await screen.findByRole('list', { name: 'Mis citas' });

    expect(screen.queryByText('Lista roja')).not.toBeInTheDocument();
    expect(screen.queryByText(/lista roja/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/anticipo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/clienta-secreta-1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Espera anticipo/)).not.toBeInTheDocument();
  });

  it('no muestra el CONTADOR de conversaciones escaladas ni enlaces al panel', async () => {
    /**
     * Por eso esta vista **no monta `Layout`**: ese marco lleva el contador y los tres enlaces. El
     * contador revelaría actividad de clientas y los enlaces darían `403` en cada petición.
     *
     * Se monta `App` entera, no solo `MiAgenda`: así se verifica que el **árbol de rutas** la aísla,
     * que es donde vive la garantía. Y no se declara ningún manejador para
     * `/escaladas/pendientes`: con MSW estricto, si esta rama lo pidiera, la prueba fallaría.
     */
    basico();

    montar(<App />, { ruta: '/mi-agenda' });

    await screen.findByText('Mi agenda');
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Esperan a una persona/)).not.toBeInTheDocument();
    expect(screen.queryByText('Todo atendido')).not.toBeInTheDocument();
    for (const enlace of ['Bandeja', 'Anticipos', 'Clientas', 'Agenda']) {
      expect(screen.queryByRole('link', { name: enlace })).not.toBeInTheDocument();
    }
  });

  it('una MANICURISTA que abre `/agenda` acaba en SU vista, no en la de mostrador', async () => {
    basico();

    montar(<App />, { ruta: '/agenda' });

    expect(await screen.findByText('Mi agenda')).toBeInTheDocument();
    // Nada del mostrador: ni el formulario de alta ni las pestañas.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Walk-in (ahora)' })).not.toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: 'Ausencias y coberturas' })).not.toBeInTheDocument();
  });
});
