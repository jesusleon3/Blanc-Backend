import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { servidor } from '../pruebas/servidor';
import { montar, sesionFalsa } from '../pruebas/montar';
import { perfil, escaladas } from '../pruebas/datos';
import { App } from '../App';
import type { Rol } from '../api/contrato';

const RUTA_YO = '/v1/identidad-y-accesos/usuarios/yo';

/** El perfil que devuelve `/yo`. Es la fuente del rol: NO viaja en el token (`DEC-029`). */
const responderYo = (rol: Rol) => servidor.use(http.get(RUTA_YO, () => HttpResponse.json(perfil(rol))));

/** Lo mínimo para que el panel de operación cargue sin peticiones sin manejar. */
const responderPanel = () =>
  servidor.use(
    http.get('/v1/conversaciones/escaladas/pendientes', () => HttpResponse.json(escaladas({ total: 0, porSucursal: [], masAntiguaEn: null }))),
    http.get('/v1/conversaciones', () => HttpResponse.json({ conversaciones: [], hayMas: false })),
    http.get('/v1/sucursales-y-personal/sucursales', () => HttpResponse.json({ sucursales: [] })),
  );

describe('Control de acceso por rol', () => {
  it('SIN SESIÓN manda al login', async () => {
    montar(<App />, { sesion: null, ruta: '/bandeja' });

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('la DUEÑA aterriza en la Bandeja y ve los cuatro enlaces', async () => {
    responderYo('ADMINISTRADOR');
    responderPanel();

    montar(<App />, { ruta: '/' });

    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument());
    for (const enlace of ['Bandeja', 'Anticipos', 'Clientas', 'Agenda']) {
      expect(screen.getByRole('link', { name: enlace })).toBeInTheDocument();
    }
  });

  it('la ENCARGADA también entra al panel de operación', async () => {
    responderYo('GERENTE');
    responderPanel();

    montar(<App />, { ruta: '/' });

    expect(await screen.findByRole('link', { name: 'Bandeja' })).toBeInTheDocument();
  });

  it('la DUEÑA ve el enlace de CONFIGURACIÓN y la ENCARGADA no', async () => {
    /**
     * El Backoffice cambia precios, duraciones y capacidad vendible: los números de los que salen
     * los cobros y cuántas citas simultáneas se venden. La Encargada opera el día **dentro** de
     * esas reglas; cambiarlas es de la Dueña.
     *
     * Dos listas de enlaces y no un `if` dentro de una: es la misma razón por la que la vista de
     * iPad es un árbol de rutas aparte. Y recordatorio de `ADR-027`: esto decide qué se dibuja —
     * el `@Roles` de cada endpoint (`SUPER_ADMIN`, `ADMINISTRADOR`) es lo que lo impone.
     */
    responderYo('ADMINISTRADOR');
    responderPanel();

    const { unmount } = montar(<App />, { ruta: '/' });
    expect(await screen.findByRole('link', { name: 'Configuración' })).toBeInTheDocument();
    unmount();

    responderYo('GERENTE');
    responderPanel();

    montar(<App />, { ruta: '/' });
    await waitFor(() => expect(screen.getByRole('link', { name: 'Bandeja' })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Configuración' })).not.toBeInTheDocument();
  });

  it('la ENCARGADA que abre `/admin` a mano acaba en su pantalla, no en el Backoffice', async () => {
    // `ExigeRol` la devuelve a su ruta inicial. Y si forzara la petición, el endpoint responde 403.
    responderYo('GERENTE');
    responderPanel();

    montar(<App />, { ruta: '/admin' });

    expect(await screen.findByRole('link', { name: 'Bandeja' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Secciones de configuración' })).not.toBeInTheDocument();
  });

  it('la MANICURISTA va a `/mi-agenda` y NO VE NINGÚN ENLACE al panel', async () => {
    /**
     * `DEC-040`: su vista no transporta PII ni señales de riesgo. La prueba comprueba las dos
     * mitades —que llega a su pantalla **y** que los enlaces no existen— porque la primera sola
     * pasaría aunque el layout de operación se montara debajo.
     *
     * No hay ningún manejador de MSW para la Bandeja ni el contador, y eso es parte de la
     * aserción: con `onUnhandledRequest: 'error'`, si esta rama pidiera algo del panel, la prueba
     * fallaría.
     */
    responderYo('MANICURISTA');

    montar(<App />, { ruta: '/' });

    expect(await screen.findByText('Mi agenda')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Bandeja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clientas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Anticipos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument();
  });

  it('una MANICURISTA que abre `/bandeja` por un enlace acaba en SU agenda, no en un error', async () => {
    // El error sería correcto y sería mala atención. Un enlace compartido en un grupo del equipo
    // es el caso real.
    responderYo('MANICURISTA');

    montar(<App />, { ruta: '/bandeja' });

    expect(await screen.findByText('Mi agenda')).toBeInTheDocument();
  });

  it('la MANICURISTA tampoco ve el CONTADOR de escaladas: revelaría actividad de clientas', async () => {
    responderYo('MANICURISTA');

    montar(<App />, { ruta: '/mi-agenda' });

    await screen.findByText('Mi agenda');
    expect(screen.queryByText(/Esperan a una persona/)).not.toBeInTheDocument();
  });

  it.each(['RECEPCIONISTA', 'ANALISTA', 'SOLO_LECTURA'] as const)(
    'el rol %s va a una pantalla que lo explica, no a una que falle en cada petición',
    async (rol) => {
      responderYo(rol);

      montar(<App />, { ruta: '/' });

      expect(await screen.findByText('Todavía no hay una pantalla para tu rol')).toBeInTheDocument();
    },
  );

  it('con token válido pero SIN registro en Blanc, lo dice en vez de mandar al login', async () => {
    /**
     * Es un estado real y distinto: credenciales correctas en Supabase, sin fila en
     * `identidad_accesos.usuarios` o desactivada. Mandarla al login la haría intentar la
     * contraseña una y otra vez, porque la contraseña está bien.
     */
    servidor.use(
      http.get(RUTA_YO, () =>
        HttpResponse.json({ error: { category: 'domain', code: 'USUARIO_NO_ENCONTRADO', message: 'No existe.' } }, { status: 404 }),
      ),
    );

    montar(<App />, { sesion: sesionFalsa('ajena@ejemplo.com'), ruta: '/bandeja' });

    expect(await screen.findByText('Tu cuenta no tiene acceso a Blanc')).toBeInTheDocument();
    expect(screen.getByText('ajena@ejemplo.com', { exact: false })).toBeInTheDocument();
  });
});
