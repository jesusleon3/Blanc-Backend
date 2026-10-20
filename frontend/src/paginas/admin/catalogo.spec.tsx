import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { servidor } from '../../pruebas/servidor';
import { montar } from '../../pruebas/montar';
import { vigilarRechazosNoGestionados } from '../../pruebas/rechazos';
import { SERVICIO_GELISH, modificador, perfil, servicio } from '../../pruebas/datos';
import { CatalogoAdmin } from './componentes/CatalogoAdmin';
import { ModificadoresAdmin } from './componentes/ModificadoresAdmin';

const SERVICIOS = '/v1/catalogo-y-cotizacion/servicios';
const MODIFICADORES = '/v1/catalogo-y-cotizacion/modificadores-diseno';

const contexto = (servicios = [servicio()]) =>
  servidor.use(
    http.get('/v1/identidad-y-accesos/usuarios/yo', () => HttpResponse.json(perfil('ADMINISTRADOR'))),
    http.get(SERVICIOS, () => HttpResponse.json({ servicios })),
    http.get(`${SERVICIOS}/categorias`, () => HttpResponse.json({ categorias: ['Decorado', 'Manos', 'Pies'] })),
  );

describe('Backoffice — Catálogo y tiempos', () => {
  it('DEJA ESCRITO que los tiempos son oficiales y editables sin tocar código', async () => {
    /**
     * Es un requisito explícito de la orden de trabajo, y no es decorativo: si la Dueña no sabe que
     * puede cambiar una duración desde aquí, va a pedir un despliegue para cada ajuste — o peor, va
     * a convivir con un tiempo equivocado, que es el que decide si una cita cabe.
     *
     * El aviso dice además que los **precios** siguen siendo provisionales y los **tiempos** no, que
     * es la distinción que importa antes de cobrarle a alguien.
     */
    contexto();

    montar(<CatalogoAdmin />);

    expect(await screen.findByText('Estos tiempos son los oficiales, y se editan desde aquí.')).toBeInTheDocument();
    expect(screen.getByText(/60, 120 o 180 minutos/)).toBeInTheDocument();
    expect(screen.getByText(/no son la suma de sus partes/)).toBeInTheDocument();
    expect(screen.getByText(/sin tocar código ni esperar un despliegue/)).toBeInTheDocument();
    expect(screen.getByText(/precios siguen siendo provisionales/)).toBeInTheDocument();
  });

  it('muestra la DURACIÓN de cada servicio en la tabla, no escondida en un detalle', async () => {
    /**
     * De `duracionBaseMinutos` sale el fin de cada cita (`DEC-033`), y de ahí el `tstzrange` que
     * impide solapamientos. Si está mal, el sistema **vende huecos que no caben** y nada falla:
     * se descubre en el mostrador. Tiene que verse de un vistazo, junto al precio.
     */
    contexto([servicio({ duracionBaseMinutos: 90 })]);

    montar(<CatalogoAdmin />);

    const tabla = await screen.findByRole('table', { name: 'Servicios del catálogo' });
    expect(within(tabla).getByText('90 min')).toBeInTheDocument();
    expect(within(tabla).getByText('$450.00')).toBeInTheDocument();
  });

  it('CREA un servicio con su duración y convierte el precio de pesos a centavos', async () => {
    contexto([]);
    let enviado: Record<string, unknown> | null = null;
    servidor.use(
      http.post(SERVICIOS, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(servicio({ id: 'nuevo' }), { status: 201 });
      }),
    );

    montar(<CatalogoAdmin />);

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Nuevo servicio' }));

    await usuario.type(screen.getByLabelText('Nombre'), 'Acrílico esculpido');
    await usuario.type(screen.getByLabelText('Categoría'), 'Manos');
    await usuario.type(screen.getByLabelText('Duración en minutos'), '120');
    await usuario.type(screen.getByLabelText('Precio en pesos'), '850.50');
    await usuario.click(screen.getByRole('button', { name: 'Crear servicio' }));

    await waitFor(() => expect(enviado).not.toBeNull());
    /**
     * `850.50` pesos son **85050 centavos** (`RN-COT-07`). Con `Math.trunc` habrían sido 85049:
     * `850.5 * 100` da `85049.99999999999` en coma flotante. El `@IsInt()` del DTO rechazaría el
     * decimal, así que el defecto saldría como un `400` confuso en vez de como un centavo perdido.
     */
    expect(enviado).toEqual({
      nombre: 'Acrílico esculpido',
      categoria: 'Manos',
      duracionBaseMinutos: 120,
      precioBaseCentavos: 85050,
      requiereCotizacionManual: false,
    });
  });

  it('EDITA la duración y manda SOLO el campo que cambió', async () => {
    /**
     * `PATCH` parcial. Reenviar el precio sin haberlo tocado lo reescribiría con el valor
     * redondeado del campo de texto, alterando un importe que nadie pidió cambiar.
     */
    contexto([servicio({ duracionBaseMinutos: 60 })]);
    let enviado: Record<string, unknown> | null = null;
    servidor.use(
      http.patch(`${SERVICIOS}/${SERVICIO_GELISH}`, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(servicio({ duracionBaseMinutos: 75 }));
      }),
    );

    montar(<CatalogoAdmin />);

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Editar Gelish manos' }));

    const minutos = screen.getByLabelText('Duración en minutos');
    await usuario.clear(minutos);
    await usuario.type(minutos, '75');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(enviado).not.toBeNull());
    expect(enviado).toEqual({ duracionBaseMinutos: 75 });
  });

  it('RECHAZA una duración de cero o no entera antes de llamar al backend', async () => {
    /**
     * Un servicio de 0 minutos daría un rango vacío `[inicio, inicio)` y la `EXCLUDE` no impediría
     * nada: cabrían infinitas citas a la misma hora. El backend lo rechaza con `@Min(0)`... que
     * **acepta el cero**. Esta barrera del cliente no es decorativa: explica la consecuencia.
     */
    contexto([]);
    let llamado = false;
    servidor.use(
      http.post(SERVICIOS, () => {
        llamado = true;
        return HttpResponse.json(servicio(), { status: 201 });
      }),
    );

    montar(<CatalogoAdmin />);

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Nuevo servicio' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Servicio raro');
    await usuario.type(screen.getByLabelText('Categoría'), 'Manos');
    await usuario.type(screen.getByLabelText('Duración en minutos'), '0');
    await usuario.type(screen.getByLabelText('Precio en pesos'), '100');
    await usuario.click(screen.getByRole('button', { name: 'Crear servicio' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/de ella sale la hora en que termina la cita/);
    expect(llamado).toBe(false);
  });

  it('ofrece las categorías EN USO para que no se dupliquen por mayúsculas', async () => {
    // No hay tabla de categorías: `categoria` es texto. La lista evita `Manos` y `manos`.
    contexto();

    montar(<CatalogoAdmin />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Nuevo servicio' }));

    const opciones = [...document.querySelectorAll('datalist option')].map((opcion) => opcion.getAttribute('value'));
    expect(opciones).toEqual(['Decorado', 'Manos', 'Pies']);
  });

  it('da de baja un servicio y aclara que las citas pasadas conservan su precio', async () => {
    contexto();
    let desactivado: string | null = null;
    servidor.use(
      http.post(`${SERVICIOS}/${SERVICIO_GELISH}/desactivar`, () => {
        desactivado = SERVICIO_GELISH;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    montar(<CatalogoAdmin />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Dar de baja Gelish manos' }));

    await waitFor(() => expect(desactivado).toBe(SERVICIO_GELISH));
    expect(screen.getByText(/conservan el precio con el que se cobraron/)).toBeInTheDocument();
  });

  it('marca el servicio de COTIZACIÓN MANUAL como lo que es: un precio que fija una persona', async () => {
    contexto([servicio({ nombre: 'Diseño especial', requiereCotizacionManual: true })]);

    montar(<CatalogoAdmin />);

    const tabla = await screen.findByRole('table', { name: 'Servicios del catálogo' });
    expect(within(tabla).getByText(/base, se cotiza a mano/)).toBeInTheDocument();
  });
});

describe('Backoffice — Modificadores de diseño', () => {
  const conModificadores = (modificadores = [modificador()]) => {
    contexto();
    servidor.use(http.get(MODIFICADORES, () => HttpResponse.json({ modificadoresDiseno: modificadores })));
  };

  it('EXPLICA que las combinaciones son renglones del catálogo, no una suma de modificadores', async () => {
    /**
     * ## ESTA PRUEBA PROTEGE UNA EXPLICACIÓN, Y CAMBIÓ DE FONDO (2026-10-19)
     *
     * Antes protegía un aviso de *función que falta*: los modificadores no se sumaban y el motor de
     * combinaciones (`FL-COT-03`) estaba diferido, así que un diseño con tiempo extra no se podía
     * agendar bien.
     *
     * Con la matriz oficial de la Dueña eso dejó de ser una carencia: **los tiempos se absorben, no
     * se suman**, así que no hay nada que sumar. Cada combinación es un renglón del catálogo con su
     * duración exacta, y ahí se edita. El aviso tiene que decir eso, porque lo contrario —dejar el
     * texto viejo— mandaría a la Dueña a buscar un cálculo que ya no hace falta.
     *
     * Los modificadores siguen sin sumarse, y eso también se dice: son informativos.
     */
    conModificadores();

    montar(<ModificadoresAdmin />);

    expect(await screen.findByText('Las combinaciones ya no se calculan aquí: son renglones del catálogo.')).toBeInTheDocument();
    expect(screen.getByText(/se absorben, no se suman/)).toBeInTheDocument();
    expect(screen.getByText(/no se suman solos a una cita/)).toBeInTheDocument();
    // Y los tres diseños que el bot sí agenda, nombrados: es la regla de `DEC-033` en la pantalla.
    expect(screen.getByText(/francés, puntos y ojo de gato/)).toBeInTheDocument();
  });

  it('crea un modificador con sus minutos y precio adicionales', async () => {
    conModificadores([]);
    let enviado: Record<string, unknown> | null = null;
    servidor.use(
      http.post(MODIFICADORES, async ({ request }) => {
        enviado = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(modificador(), { status: 201 });
      }),
    );

    montar(<ModificadoresAdmin />);

    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Nuevo modificador' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Pedrería');
    const minutos = screen.getByLabelText('Minutos adicionales');
    await usuario.clear(minutos);
    await usuario.type(minutos, '20');
    await usuario.type(screen.getByLabelText('Precio adicional en pesos'), '120');
    await usuario.click(screen.getByRole('button', { name: 'Crear modificador' }));

    await waitFor(() => expect(enviado).not.toBeNull());
    expect(enviado).toEqual({
      nombre: 'Pedrería',
      minutosAdicionales: 20,
      precioAdicionalCentavos: 12000,
      requiereCotizacionManual: false,
    });
  });

  /**
   * Espera a que el selector tenga el servicio antes de elegirlo.
   *
   * El selector se llena con la consulta del catálogo, que resuelve después del primer render. Sin
   * esta espera la prueba fallaría unas veces y pasaría otras según el orden en que MSW responda —
   * la clase de intermitencia que no se tapa con reintentos, se espera por la condición real.
   */
  const elegirServicio = async (usuario: ReturnType<typeof userEvent.setup>) => {
    const selector = await screen.findByLabelText('Servicio');
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Gelish manos' })).toBeInTheDocument());
    await usuario.selectOptions(selector, SERVICIO_GELISH);
  };

  it('vincula un modificador a un servicio leyendo la clave real `modificadoresDiseno`', async () => {
    /**
     * La respuesta se llama `modificadoresDiseno`, no `modificadores`. Leer la clave equivocada
     * daría `undefined` y una lista vacía **sin un solo error**: todos los modificadores
     * aparecerían como "no permitidos" y alguien los volvería a vincular uno por uno.
     */
    conModificadores();
    let vinculado: string | null = null;
    servidor.use(
      http.get(`${SERVICIOS}/${SERVICIO_GELISH}/modificadores`, () => HttpResponse.json({ modificadoresDiseno: [] })),
      http.post(`${SERVICIOS}/${SERVICIO_GELISH}/modificadores/mod-1`, () => {
        vinculado = 'mod-1';
        return new HttpResponse(null, { status: 204 });
      }),
    );

    montar(<ModificadoresAdmin />);

    const usuario = userEvent.setup();
    await elegirServicio(usuario);
    await usuario.click(await screen.findByRole('button', { name: 'Permitir Decoración francesa' }));

    await waitFor(() => expect(vinculado).toBe('mod-1'));
  });

  it('muestra como «Quitar» el que YA está vinculado', async () => {
    conModificadores();
    servidor.use(
      http.get(`${SERVICIOS}/${SERVICIO_GELISH}/modificadores`, () => HttpResponse.json({ modificadoresDiseno: [modificador()] })),
    );

    montar(<ModificadoresAdmin />);

    await elegirServicio(userEvent.setup());

    expect(await screen.findByRole('button', { name: 'Quitar Decoración francesa' })).toBeInTheDocument();
  });
});

describe('Backoffice — los fallos no dejan promesas rechazadas sueltas', () => {
  /**
   * ## EL DEFECTO QUE ESTE BLOQUE DESTAPÓ (auditoría 2026-10-17)
   *
   * Seis manejadores del Backoffice hacían `await mutacion.mutateAsync()` sin `try/catch`. El error
   * se mostraba —`useMutation` lo guarda y `AvisoDeError` lo pinta—, así que las pruebas de
   * interfaz pasaban; lo que quedaba suelto era la promesa rechazada que React descarta.
   *
   * Importa por dos razones distintas: con un informador de errores conectado, cada `409` legítimo
   * se reportaría como fallo del programa; y en las pruebas, Vitess marca el rechazo suelto como
   * posible fuente de **falsos positivos**.
   */
  vigilarRechazosNoGestionados();

  const conFallo = (ruta: string) =>
    servidor.use(
      http.post(ruta, () =>
        HttpResponse.json({ error: { category: 'domain', code: 'SERVICIO_YA_INACTIVO', message: 'Ya estaba dado de baja.' } }, { status: 409 }),
      ),
    );

  it('dar de baja un servicio que falla muestra el error y NO deja un rechazo suelto', async () => {
    contexto();
    conFallo(`${SERVICIOS}/${SERVICIO_GELISH}/desactivar`);

    montar(<CatalogoAdmin />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Dar de baja Gelish manos' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya estaba dado de baja.');
  });

  it('dar de baja un modificador que falla tampoco', async () => {
    contexto();
    servidor.use(http.get(MODIFICADORES, () => HttpResponse.json({ modificadoresDiseno: [modificador()] })));
    conFallo(`${MODIFICADORES}/mod-1/desactivar`);

    montar(<ModificadoresAdmin />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Dar de baja Decoración francesa' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya estaba dado de baja.');
  });
});
