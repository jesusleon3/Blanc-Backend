import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { servidor } from '../../pruebas/servidor';
import { montar } from '../../pruebas/montar';
import { MANICURISTA_ANA, SUCURSAL_LOMAS, SUCURSAL_ZIBATA, manicurista, perfil, resumenAnalitico, sucursal } from '../../pruebas/datos';
import { Analitica } from './Analitica';
import { App } from '../../App';
import type { Rol } from '../../api/contrato';

const RUTA = '/v1/analitica/resumen';

const basico = (resumen = resumenAnalitico(), rol: Rol = 'ADMINISTRADOR') =>
  servidor.use(
    http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfil(rol))),
    http.get('/v1/sucursales-y-personal/sucursales', () =>
      HttpResponse.json({ sucursales: [sucursal(), sucursal({ id: SUCURSAL_ZIBATA, nombre: 'Zibatá' })] }),
    ),
    http.get('/v1/sucursales-y-personal/manicuristas', () => HttpResponse.json({ manicuristas: [manicurista()] })),
    http.get(RUTA, () => HttpResponse.json(resumen)),
  );

describe('Analítica — KPIs principales', () => {
  it('muestra citas atendidas, tasa de no-show, resolución del bot e ingreso', async () => {
    basico();

    montar(<Analitica />, { ruta: '/analitica' });

    const kpis = await screen.findByRole('region', { name: 'Indicadores principales' });
    expect(within(kpis).getByText('40')).toBeInTheDocument();
    expect(within(kpis).getByText('11.1%')).toBeInTheDocument();
    expect(within(kpis).getByText('84%')).toBeInTheDocument();
    // $19,260.00 = 1_926_000 centavos. `RN-COT-07`: el dinero son centavos enteros.
    expect(within(kpis).getByText('$19,260.00')).toBeInTheDocument();
  });

  it('un indicador en `null` se muestra como «—», NO como 0%', async () => {
    /**
     * `null` y `0` significan cosas distintas: *"el bot no resolvió nada"* frente a *"no hubo nada
     * que resolver"*. Un `0%` en el panel haría pensar que el bot está roto cuando simplemente no
     * hubo conversaciones, y eso es una conclusión equivocada sobre la que alguien podría actuar.
     */
    basico(
      resumenAnalitico({
        indicadores: {
          tasaDeNoShow: null,
          efectividadDeListaDeEspera: null,
          porcentajeResueltoPorElBot: null,
          ingresoTotalEstimadoCentavos: 0,
        },
      }),
    );

    montar(<Analitica />, { ruta: '/analitica' });

    const kpis = await screen.findByRole('region', { name: 'Indicadores principales' });
    // Tres indicadores son `null` (no-show, efectividad de fila y bot), pero la efectividad no es
    // un KPI de cabecera: aquí se ven dos «—».
    expect(within(kpis).getAllByText('—')).toHaveLength(2);
    expect(within(kpis).queryByText('0%')).not.toBeInTheDocument();
    expect(within(kpis).getByText('Sin conversaciones en el periodo')).toBeInTheDocument();
    // El ingreso en CERO sí se muestra como $0.00: un cero real no es "sin dato".
    expect(within(kpis).getByText('$0.00')).toBeInTheDocument();
  });

  it('desglosa el ingreso en servicios y anticipos, para que no parezca un solo número', async () => {
    basico();

    montar(<Analitica />, { ruta: '/analitica' });

    expect(await screen.findByText(/\$18,000\.00 en servicios \+ \$1,260\.00 en anticipos/)).toBeInTheDocument();
  });
});

describe('Analítica — LAS ADVERTENCIAS VAN ANTES DE LOS NÚMEROS', () => {
  it('muestra la advertencia de que el ingreso es un ESTIMADO sin extras de Excel', async () => {
    /**
     * **La prueba que justifica el diseño de esta pantalla.**
     *
     * El ingreso sale de lo cotizado al agendar, no de lo cobrado: no incluye extras, propinas ni
     * productos, que viven en el Excel que el salón sigue llevando. Presentarlo como "el ingreso
     * del mes" sin decirlo llevaría a comparar dos cifras que miden cosas distintas.
     *
     * Y van **arriba**, antes de los números: quien lee una cifra tiene que saber qué no incluye
     * *antes* de leerla, no en letra pequeña debajo.
     */
    basico();

    montar(<Analitica />, { ruta: '/analitica' });

    const aviso = await screen.findByRole('note', { name: 'Advertencias del reporte' });
    expect(aviso).toHaveTextContent(/ESTIMADO/);
    expect(aviso).toHaveTextContent(/no de lo cobrado/);
    expect(aviso).toHaveTextContent(/Excel/);
  });

  it('muestra TODAS las advertencias que manda el backend, incluidas las nuevas', async () => {
    // Se renderizan desde la respuesta, no desde una lista del cliente: si el backend añade una
    // advertencia mañana, aparece sola. Duplicar los textos aquí garantizaría que divergieran.
    basico(
      resumenAnalitico({
        advertencias: ['Primera advertencia', 'Los anticipos se reportan GLOBALES, sin filtro de sucursal.', 'Tercera advertencia'],
      }),
    );

    montar(<Analitica />, { ruta: '/analitica' });

    const aviso = await screen.findByRole('note', { name: 'Advertencias del reporte' });
    expect(within(aviso).getAllByRole('listitem')).toHaveLength(3);
    expect(aviso).toHaveTextContent(/GLOBALES/);
  });
});

describe('Analítica — desgloses', () => {
  it('lista las atendidas POR SUCURSAL con su nombre, no su uuid', async () => {
    basico();

    montar(<Analitica />, { ruta: '/analitica' });

    const lista = await screen.findByRole('list', { name: 'Atendidas por sucursal' });
    expect(within(lista).getByText('Lomas')).toBeInTheDocument();
    expect(within(lista).getByText('Zibatá')).toBeInTheDocument();
    expect(lista).toHaveTextContent('25');
    expect(lista).toHaveTextContent('3 no llegaron');
    expect(within(lista).queryByText(SUCURSAL_LOMAS)).not.toBeInTheDocument();
  });

  it('en el desglose POR MANICURISTA, `null` se explica en vez de aparecer vacío', async () => {
    // `null` no es un hueco de datos: significa que la cita se completó sin que nadie quedara
    // registrado como quien atendió (`DEC-031`). Dejarlo en blanco parecería un fallo.
    basico();

    montar(<Analitica />, { ruta: '/analitica' });

    const lista = await screen.findByRole('list', { name: 'Atendidas por manicurista' });
    expect(within(lista).getByText('Sin manicurista registrada')).toBeInTheDocument();
    expect(lista).toHaveTextContent('18');
  });

  it('muestra el embudo de citas ordenado, omitiendo los estados en cero', async () => {
    basico();

    montar(<Analitica />, { ruta: '/analitica' });

    await screen.findByText('Embudo de citas');
    expect(screen.getByText('Atendida')).toBeInTheDocument();
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
    // `pendiente_confirmacion` está en 0 en el fixture: no se pinta.
    expect(screen.queryByText('Por confirmar')).not.toBeInTheDocument();
  });

  it('avisa de las cancelaciones TARDÍAS y de su consecuencia', async () => {
    basico();

    montar(<Analitica />, { ruta: '/analitica' });

    expect(await screen.findByText(/3 cancelaciones con menos de 60 minutos/)).toBeInTheDocument();
    expect(screen.getByText(/incidente en el historial/)).toBeInTheDocument();
  });

  it('explica que los anticipos RETENIDOS no se devuelven', async () => {
    // `RN-ANT-04`. Es dinero del salón igual que uno pagado, y quien lee el número tiene que saber
    // por qué está sumado.
    basico();

    montar(<Analitica />, { ruta: '/analitica' });

    expect(await screen.findByText('Retenidos (no se devuelven)')).toBeInTheDocument();
    expect(screen.getByText(/no se reembolsan/)).toBeInTheDocument();
  });

  it('lista los MOTIVOS de escalamiento con su porcentaje, omitiendo los de cero', async () => {
    basico();

    montar(<Analitica />, { ruta: '/analitica' });

    const lista = await screen.findByRole('list', { name: 'Motivos de escalamiento' });
    expect(within(lista).getByText('Diseño por cotizar')).toBeInTheDocument();
    expect(within(lista).getByText('Queja o reclamo')).toBeInTheDocument();
    // De 8 escalamientos, 3 son cotización compleja = 38%.
    expect(lista).toHaveTextContent('38%');
    expect(within(lista).queryByText('Clienta bloqueada')).not.toBeInTheDocument();
  });

  it('EXPLICA cómo se mide la resolución autónoma, para evitar una lectura equivocada', async () => {
    /**
     * El indicador se deriva de los **mensajes**, no del `modo` actual: `devolverAlBot` limpia el
     * motivo (`RN-ESC-03`), así que una conversación atendida y devuelta al bot sería
     * indistinguible de una que nunca se escaló. Sin esta nota, alguien compararía el porcentaje
     * con el número de conversaciones en `modo: bot` y concluiría que el reporte está mal.
     */
    basico();

    montar(<Analitica />, { ruta: '/analitica' });

    expect(await screen.findByText(/se mide por los mensajes del periodo/)).toBeInTheDocument();
  });
});

describe('Analítica — filtros', () => {
  it('manda el rango como INSTANTES DE PARED de Querétaro', async () => {
    /**
     * `2027-03-01` interpretado como UTC desplazaría el día seis horas y el reporte incluiría
     * citas del día anterior. Es el mismo error que ya se evitó en la Agenda.
     */
    basico();
    let pedido: Record<string, string | null> = {};
    servidor.use(
      http.get(RUTA, ({ request }) => {
        const url = new URL(request.url);
        pedido = { desde: url.searchParams.get('desde'), hasta: url.searchParams.get('hasta'), sucursalId: url.searchParams.get('sucursalId') };
        return HttpResponse.json(resumenAnalitico());
      }),
    );

    montar(<Analitica />, { ruta: '/analitica?desde=2027-03-01&hasta=2027-03-31' });

    await waitFor(() => expect(pedido.desde).toBe('2027-03-01T06:00:00.000Z'));
    // El 31 de marzo a las 23:59:59 de Querétaro **es** el 1 de abril a las 05:59:59 UTC. Que el
    // día de fin "se pase" al mes siguiente en UTC es exactamente lo correcto: el periodo es de
    // pared, y acotarlo a las 23:59:59Z perdería las citas de la tarde del último día.
    expect(pedido.hasta).toBe('2027-04-01T05:59:59.000Z');
    // Sin sucursal en la URL, no se manda el parámetro: el backend lo trata como "todas".
    expect(pedido.sucursalId).toBeNull();
  });

  it('el filtro de SUCURSAL viaja al backend', async () => {
    basico();
    const sucursalesPedidas: (string | null)[] = [];
    servidor.use(
      http.get(RUTA, ({ request }) => {
        sucursalesPedidas.push(new URL(request.url).searchParams.get('sucursalId'));
        return HttpResponse.json(resumenAnalitico({ sucursalId: SUCURSAL_LOMAS }));
      }),
    );

    montar(<Analitica />, { ruta: '/analitica?desde=2027-03-01&hasta=2027-03-31' });

    const selector = await screen.findByLabelText('Sucursal');
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Lomas' })).toBeInTheDocument());
    await userEvent.setup().selectOptions(selector, SUCURSAL_LOMAS);

    await waitFor(() => expect(sucursalesPedidas).toContain(SUCURSAL_LOMAS));
  });

  it('los atajos de periodo cambian el rango', async () => {
    basico();

    montar(<Analitica />, { ruta: '/analitica' });

    await screen.findByRole('region', { name: 'Indicadores principales' });
    const antes = (screen.getByLabelText('Desde') as HTMLInputElement).value;

    await userEvent.setup().click(screen.getByRole('button', { name: 'Último año' }));

    expect((screen.getByLabelText('Desde') as HTMLInputElement).value).not.toBe(antes);
  });

  it('un `400 RANGO_DE_CONSULTA_DEMASIADO_AMPLIO` se muestra con su código', async () => {
    basico();
    servidor.use(
      http.get(RUTA, () =>
        HttpResponse.json(
          { error: { category: 'domain', code: 'RANGO_DE_CONSULTA_DEMASIADO_AMPLIO', message: 'Máximo 400 días.' } },
          { status: 400 },
        ),
      ),
    );

    montar(<Analitica />, { ruta: '/analitica' });

    expect(await screen.findByRole('alert')).toHaveTextContent(/RANGO_DE_CONSULTA_DEMASIADO_AMPLIO|400 días/);
  });
});

describe('Analítica — RBAC: exclusiva de Administración', () => {
  const sinAnalitica = (rol: Rol) =>
    servidor.use(
      http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfil(rol))),
      http.get('/v1/sucursales-y-personal/sucursales', () => HttpResponse.json({ sucursales: [sucursal()] })),
      http.get('/v1/catalogo-y-cotizacion/servicios', () => HttpResponse.json({ servicios: [] })),
      http.get('/v1/sucursales-y-personal/manicuristas', () => HttpResponse.json({ manicuristas: [manicurista({ id: MANICURISTA_ANA })] })),
      http.get('/v1/conversaciones/escaladas/pendientes', () =>
        HttpResponse.json({ total: 0, porSucursal: [], masAntiguaEn: null }),
      ),
      http.get('/v1/conversaciones', () => HttpResponse.json({ conversaciones: [], hayMas: false })),
    );

  it('la DUEÑA VE el enlace de Analítica en el encabezado', async () => {
    sinAnalitica('ADMINISTRADOR');

    montar(<App />, { ruta: '/bandeja' });

    expect(await screen.findByRole('link', { name: 'Analítica' })).toBeInTheDocument();
  });

  it('la ENCARGADA NO VE el enlace: el desglose por manicurista mide a sus compañeras', async () => {
    /**
     * El enlace **no existe** para ella, no está oculto: `ENLACES_DE_ADMINISTRACION` es una lista
     * aparte y no un `if` dentro de la compartida. Es el mismo criterio que hace de la vista de
     * iPad un árbol de rutas separado — una condición dentro de una lista común es la forma
     * habitual de que un día se filtre un enlace.
     */
    sinAnalitica('GERENTE');

    montar(<App />, { ruta: '/bandeja' });

    await screen.findByRole('navigation', { name: 'Secciones' });
    expect(screen.queryByRole('link', { name: 'Analítica' })).not.toBeInTheDocument();
    // Y sí ve el resto del panel.
    expect(screen.getByRole('link', { name: 'Bandeja' })).toBeInTheDocument();
  });

  it('una ENCARGADA que abre `/analitica` por un enlace acaba en SU pantalla inicial', async () => {
    // El error sería correcto y sería mala atención. Y si forzara la petición, el endpoint
    // responde `403` igual: la autorización está en el backend.
    sinAnalitica('GERENTE');

    montar(<App />, { ruta: '/analitica' });

    await waitFor(() => expect(screen.queryByText('Analítica')).not.toBeInTheDocument());
    expect(await screen.findByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
  });
});

describe('Analítica — las reposiciones por garantía se nombran (auditoría 2026-10-17)', () => {
  it('avisa de cuántas completadas fueron reposiciones sin costo', async () => {
    /**
     * Una garantía entra en `porEstado.completada` y en el desglose por manicurista aportando `$0`.
     * Sin nombrarlas, la Dueña lee un promedio por cita más bajo sin saber por qué — y el desglose
     * por manicurista **sube** cuando alguien rehace su propio trabajo.
     */
    basico(resumenAnalitico({ citas: { ...resumenAnalitico().citas, garantiasCompletadas: 2 } }));

    montar(<Analitica />, { ruta: '/analitica' });

    expect(await screen.findByText(/2 de las completadas fueron reposiciones por garantía/)).toBeInTheDocument();
    expect(screen.getByText(/su ingreso es \$0/)).toBeInTheDocument();
  });

  it('en singular no dice «fueron reposiciones»', async () => {
    basico(resumenAnalitico({ citas: { ...resumenAnalitico().citas, garantiasCompletadas: 1 } }));

    montar(<Analitica />, { ruta: '/analitica' });

    expect(await screen.findByText(/1 de las completadas fue una reposición por garantía/)).toBeInTheDocument();
  });

  it('sin garantías en el periodo NO muestra el aviso', async () => {
    basico();

    montar(<Analitica />, { ruta: '/analitica' });

    await screen.findByText('Embudo de citas');
    expect(screen.queryByText(/por garantía/)).not.toBeInTheDocument();
  });
});
