import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';
import {
  BuscarClientaPorTelefonoAnteriorUseCase,
  BuscarClientasPorTelefonoUseCase,
  CambiarEstadoDeRiesgoUseCase,
  CambiarTelefonoClientaUseCase,
  ConsultarClientaUseCase,
  RegistrarCancelacionOrdinariaUseCase,
  RegistrarClientaUseCase,
  RegistrarIncidenteClientaUseCase,
} from './clientas.use-cases';
import { DrizzleClientaRepository } from '../../infrastructure/persistence/drizzle-clienta.repository';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { crearUnitOfWorkFalso } from '../../../../shared/persistence/test-utils/unit-of-work-falso';

const DUEÑA: ClaimsUsuario = { sub: 'dueña-1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL', manicuristaId: null };
const CITA = '11111111-1111-4111-8111-111111111111';
const AHORA = new Date('2026-12-07T09:30:00.000Z');

async function preparar() {
  const db = await crearBaseDeDatosDePrueba();
  const repo = new DrizzleClientaRepository(db);
  const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
  const uow = crearUnitOfWorkFalso();

  return {
    repo,
    auditoria,
    registrar: new RegistrarClientaUseCase(repo, auditoria, uow),
    buscarPorTelefono: new BuscarClientasPorTelefonoUseCase(repo),
    buscarPorTelefonoAnterior: new BuscarClientaPorTelefonoAnteriorUseCase(repo),
    consultar: new ConsultarClientaUseCase(repo),
    cambiarTelefono: new CambiarTelefonoClientaUseCase(repo, auditoria, uow),
    cambiarEstado: new CambiarEstadoDeRiesgoUseCase(repo, auditoria, uow),
    registrarIncidente: new RegistrarIncidenteClientaUseCase(repo, auditoria, uow),
    registrarOrdinaria: new RegistrarCancelacionOrdinariaUseCase(repo, uow),
  };
}

describe('CRM / Clientas (integración, PostgreSQL real)', () => {
  describe('identidad', () => {
    it('nace en `normal`, sin sugerencia y sin cancelaciones', async () => {
      const { registrar } = await preparar();
      const clienta = await registrar.ejecutar({ nombre: 'Andrea Ramírez', telefono: '4421112233' }, DUEÑA);

      expect(clienta.estadoDeRiesgo).toBe('normal');
      expect(clienta.sugeridaListaRoja).toBe(false);
      expect(clienta.cancelacionesOrdinarias).toBe(0);
    });

    it('DOS CLIENTAS PUEDEN COMPARTIR TELÉFONO: mamá e hija son registros distintos', async () => {
      // `RN-CRM-01` decía que el teléfono era "clave única", pero estaba marcada como supuesto de
      // trabajo y la realidad del salón la contradice. Si fuera única, la hija no podría existir
      // —o peor, se fusionarían los dos historiales y una lista roja de una caería sobre la otra.
      const { registrar, buscarPorTelefono } = await preparar();
      const mama = await registrar.ejecutar({ nombre: 'Carmen Aguilar', telefono: '4421112233' }, DUEÑA);
      const hija = await registrar.ejecutar({ nombre: 'Sofía Aguilar', telefono: '4421112233' }, DUEÑA);

      const encontradas = await buscarPorTelefono.ejecutar({ telefono: '4421112233' });

      expect(encontradas.map((c) => c.id).sort()).toEqual([mama.id, hija.id].sort());
    });

    it('pero NO el mismo nombre Y el mismo teléfono: eso es un duplicado real', async () => {
      const { registrar } = await preparar();
      const alta = { nombre: 'Andrea Ramírez', telefono: '4421112233' };
      await registrar.ejecutar(alta, DUEÑA);

      await expect(registrar.ejecutar(alta, DUEÑA)).rejects.toMatchObject({ code: 'CLIENTA_DUPLICADA', httpStatus: 409 });
    });

    it.each([
      ['con símbolos', '(442) 111-2233'],
      ['con código de país', '+52 442 111 2233'],
      ['con el 1 heredado de los móviles de WhatsApp', '521 442 111 2233'],
      ['pegado', '4421112233'],
    ])('EL TELÉFONO SE NORMALIZA — %s es la misma persona', async (_caso, comoLlega) => {
      // No es cosmético: **WhatsApp entrega siempre formato internacional** y recepción teclea 10
      // dígitos. Sin unificarlos, la misma clienta tendría dos expedientes —uno del bot y otro
      // del mostrador— con el historial de incidentes partido en dos, que es el dato del que
      // depende si se le pide anticipo.
      const { registrar, buscarPorTelefono } = await preparar();
      await registrar.ejecutar({ nombre: 'Andrea Ramírez', telefono: comoLlega }, DUEÑA);

      const encontradas = await buscarPorTelefono.ejecutar({ telefono: '4421112233' });
      expect(encontradas).toHaveLength(1);
      expect(encontradas[0].telefono).toBe('4421112233');
    });

    it('y el duplicado se detecta aunque los dos formatos sean distintos', async () => {
      const { registrar } = await preparar();
      await registrar.ejecutar({ nombre: 'Andrea Ramírez', telefono: '4421112233' }, DUEÑA);

      await expect(registrar.ejecutar({ nombre: 'Andrea Ramírez', telefono: '+52 442 111 2233' }, DUEÑA)).rejects.toMatchObject({
        code: 'CLIENTA_DUPLICADA',
      });
    });

    it('400 si el teléfono tiene menos de 10 dígitos', async () => {
      const { registrar } = await preparar();
      await expect(registrar.ejecutar({ nombre: 'Andrea', telefono: '44211' }, DUEÑA)).rejects.toMatchObject({
        code: 'CLIENTA_TELEFONO_INVALIDO',
        httpStatus: 400,
      });
    });

    it('la auditoría del alta NO lleva nombre ni teléfono (`RN-AUD-01`)', async () => {
      const { registrar, auditoria } = await preparar();
      await registrar.ejecutar({ nombre: 'Andrea Ramírez', telefono: '4421112233' }, DUEÑA);

      const detalle = JSON.stringify(auditoria.registrar.mock.calls[0][0].detalle);
      expect(detalle).not.toContain('Andrea');
      expect(detalle).not.toContain('4421112233');
    });
  });

  describe('cambio de teléfono', () => {
    it('REENCUENTRA A QUIEN CAMBIÓ DE NÚMERO por nombre + teléfono anterior', async () => {
      // El caso real: escribe desde un número desconocido y su historial queda inalcanzable.
      const { registrar, cambiarTelefono, buscarPorTelefonoAnterior } = await preparar();
      const clienta = await registrar.ejecutar({ nombre: 'Andrea Ramírez', telefono: '4421112233' }, DUEÑA);

      await cambiarTelefono.ejecutar({ clientaId: clienta.id, nuevoTelefono: '4429998877' }, DUEÑA);

      const encontradas = await buscarPorTelefonoAnterior.ejecutar({ nombre: 'Andrea Ramírez', telefonoAnterior: '4421112233' });
      expect(encontradas.map((c) => c.id)).toEqual([clienta.id]);
      expect(encontradas[0].telefono).toBe('4429998877');
    });

    it('409 si el teléfono nuevo es el mismo', async () => {
      const { registrar, cambiarTelefono } = await preparar();
      const clienta = await registrar.ejecutar({ nombre: 'Andrea Ramírez', telefono: '4421112233' }, DUEÑA);

      await expect(cambiarTelefono.ejecutar({ clientaId: clienta.id, nuevoTelefono: '442 111 2233' }, DUEÑA)).rejects.toMatchObject({
        code: 'CLIENTA_TELEFONO_SIN_CAMBIO',
      });
    });
  });

  describe('SUGERIR NO ES MARCAR — `RN-CRM-05` + `RN-CRM-06`', () => {
    it('UN INCIDENTE ENCIENDE LA SUGERENCIA PERO NO CAMBIA EL ESTADO', async () => {
      // Es la conciliación entre las dos reglas: el incidente dispara la *sugerencia*, no la
      // marca. Si este caso de uso cambiara `estadoDeRiesgo`, la facultad exclusiva de la Dueña
      // dejaría de existir en la práctica aunque siguiera escrita en el endpoint.
      const { registrar, registrarIncidente } = await preparar();
      const clienta = await registrar.ejecutar({ nombre: 'Lucía Martínez', telefono: '4422223344' }, DUEÑA);

      const tras = await registrarIncidente.ejecutar(
        { clientaId: clienta.id, citaId: CITA, tipo: 'no_show', ocurridoEn: AHORA, minutosDeAntelacion: -15 },
        DUEÑA,
      );

      expect(tras.sugeridaListaRoja).toBe(true);
      expect(tras.estadoDeRiesgo).toBe('normal');
    });

    it('CINCO CANCELACIONES ORDINARIAS SE CUENTAN Y NO SUGIEREN NADA', async () => {
      // `RN-CRM-06` es explícita: el disparador *"no es un umbral acumulado (no se cuentan N
      // cancelaciones en una ventana de días)"*. El contador existe como contexto para la Dueña
      // (`RN-CRM-05` sugiere "con base en historial de cancelaciones"), no como disparador.
      //
      // Cinco y no una: con una sola, un umbral acumulado mal implementado pasaría igual.
      const { registrar, registrarOrdinaria, consultar } = await preparar();
      const clienta = await registrar.ejecutar({ nombre: 'Renata Salazar', telefono: '4424445566' }, DUEÑA);

      for (let i = 0; i < 5; i += 1) {
        await registrarOrdinaria.ejecutar({ clientaId: clienta.id });
      }

      const { clienta: recargada, incidentes } = await consultar.ejecutar({ clientaId: clienta.id });
      expect(recargada.cancelacionesOrdinarias).toBe(5);
      expect(recargada.sugeridaListaRoja).toBe(false);
      expect(recargada.estadoDeRiesgo).toBe('normal');
      // Y no se anota como incidente: cancelar con aviso no es un incidente.
      expect(incidentes).toEqual([]);
    });

    it('una cancelación ordinaria de una clienta que no está en CRM no rompe nada', async () => {
      // Devuelve `null` en vez de 404: lo que se pierde es un contador de contexto, no una regla,
      // y una cancelación no debe fallar por eso.
      const { registrarOrdinaria } = await preparar();
      await expect(registrarOrdinaria.ejecutar({ clientaId: '99999999-9999-4999-8999-999999999999' })).resolves.toBeNull();
    });

    it('el historial guarda QUÉ pasó, no solo cuántas veces', async () => {
      // Un contador diría "3" sin decir qué. La Dueña no podría juzgar si tres cancelaciones con
      // aviso valen lo mismo que tres no-shows.
      const { registrar, registrarIncidente, consultar } = await preparar();
      const clienta = await registrar.ejecutar({ nombre: 'Lucía Martínez', telefono: '4422223344' }, DUEÑA);

      await registrarIncidente.ejecutar(
        { clientaId: clienta.id, citaId: CITA, tipo: 'cancelacion_tardia', ocurridoEn: AHORA, minutosDeAntelacion: 12 },
        DUEÑA,
      );

      const { incidentes } = await consultar.ejecutar({ clientaId: clienta.id });
      expect(incidentes).toEqual([
        expect.objectContaining({ tipo: 'cancelacion_tardia', citaId: CITA, minutosDeAntelacion: 12 }),
      ]);
    });

    it('EL MISMO INCIDENTE NO SE REGISTRA DOS VECES: un reintento no infla el historial', async () => {
      // El historial es la base de una decisión que perjudica a la clienta.
      const { registrar, registrarIncidente } = await preparar();
      const clienta = await registrar.ejecutar({ nombre: 'Lucía Martínez', telefono: '4422223344' }, DUEÑA);
      const incidente = { clientaId: clienta.id, citaId: CITA, tipo: 'no_show' as const, ocurridoEn: AHORA, minutosDeAntelacion: -5 };

      await registrarIncidente.ejecutar(incidente, DUEÑA);

      await expect(registrarIncidente.ejecutar(incidente, DUEÑA)).rejects.toMatchObject({ code: 'INCIDENTE_YA_REGISTRADO' });
    });

    it('una clienta ya bloqueada no recibe sugerencia: bloqueada es más severo que lista roja', async () => {
      const { registrar, cambiarEstado, registrarIncidente } = await preparar();
      const clienta = await registrar.ejecutar({ nombre: 'Ximena Morales', telefono: '4423334455' }, DUEÑA);
      await cambiarEstado.ejecutar({ clientaId: clienta.id, accion: 'marcar_bloqueada' }, DUEÑA);

      const tras = await registrarIncidente.ejecutar(
        { clientaId: clienta.id, citaId: CITA, tipo: 'no_show', ocurridoEn: AHORA, minutosDeAntelacion: -5 },
        DUEÑA,
      );

      expect(tras.sugeridaListaRoja).toBe(false);
      expect(tras.estadoDeRiesgo).toBe('bloqueada');
    });
  });

  describe('estado de riesgo — facultad de la Dueña', () => {
    it('marcar lista roja APAGA la sugerencia: ya se atendió', async () => {
      const { registrar, registrarIncidente, cambiarEstado } = await preparar();
      const clienta = await registrar.ejecutar({ nombre: 'Lucía Martínez', telefono: '4422223344' }, DUEÑA);
      await registrarIncidente.ejecutar(
        { clientaId: clienta.id, citaId: CITA, tipo: 'no_show', ocurridoEn: AHORA, minutosDeAntelacion: -5 },
        DUEÑA,
      );

      const marcada = await cambiarEstado.ejecutar({ clientaId: clienta.id, accion: 'marcar_lista_roja' }, DUEÑA);

      expect(marcada.estadoDeRiesgo).toBe('lista_roja');
      // Si quedara encendida, la alerta reaparecería para siempre sobre una decisión ya tomada.
      expect(marcada.sugeridaListaRoja).toBe(false);
    });

    it('la auditoría distingue si venía sugerida o fue decisión propia de la Dueña', async () => {
      const { registrar, cambiarEstado, auditoria } = await preparar();
      const clienta = await registrar.ejecutar({ nombre: 'Lucía Martínez', telefono: '4422223344' }, DUEÑA);

      await cambiarEstado.ejecutar({ clientaId: clienta.id, accion: 'marcar_lista_roja', motivo: 'Decisión directa' }, DUEÑA);

      expect(auditoria.registrar).toHaveBeenLastCalledWith(
        expect.objectContaining({
          detalle: expect.objectContaining({
            accion: 'marcar_lista_roja',
            estadoAnterior: 'normal',
            estadoNuevo: 'lista_roja',
            veniaSugeridaPorElSistema: false,
          }),
        }),
      );
    });

    it('REHABILITAR NO BORRA EL HISTORIAL: es una decisión sobre el presente, no una amnesia', async () => {
      const { registrar, registrarIncidente, cambiarEstado, consultar } = await preparar();
      const clienta = await registrar.ejecutar({ nombre: 'Lucía Martínez', telefono: '4422223344' }, DUEÑA);
      await registrarIncidente.ejecutar(
        { clientaId: clienta.id, citaId: CITA, tipo: 'no_show', ocurridoEn: AHORA, minutosDeAntelacion: -5 },
        DUEÑA,
      );
      await cambiarEstado.ejecutar({ clientaId: clienta.id, accion: 'marcar_lista_roja' }, DUEÑA);

      const rehabilitada = await cambiarEstado.ejecutar({ clientaId: clienta.id, accion: 'rehabilitar' }, DUEÑA);

      expect(rehabilitada.estadoDeRiesgo).toBe('normal');
      // Si vuelve a fallar, la Dueña tiene que poder ver que ya había pasado antes.
      const { incidentes } = await consultar.ejecutar({ clientaId: clienta.id });
      expect(incidentes).toHaveLength(1);
    });

    it('409 al marcar dos veces lo mismo', async () => {
      const { registrar, cambiarEstado } = await preparar();
      const clienta = await registrar.ejecutar({ nombre: 'Lucía Martínez', telefono: '4422223344' }, DUEÑA);
      await cambiarEstado.ejecutar({ clientaId: clienta.id, accion: 'marcar_lista_roja' }, DUEÑA);

      await expect(cambiarEstado.ejecutar({ clientaId: clienta.id, accion: 'marcar_lista_roja' }, DUEÑA)).rejects.toMatchObject({
        code: 'CLIENTA_YA_EN_LISTA_ROJA',
      });
    });

    it('409 al rehabilitar a quien ya está normal', async () => {
      const { registrar, cambiarEstado } = await preparar();
      const clienta = await registrar.ejecutar({ nombre: 'Andrea Ramírez', telefono: '4421112233' }, DUEÑA);

      await expect(cambiarEstado.ejecutar({ clientaId: clienta.id, accion: 'rehabilitar' }, DUEÑA)).rejects.toMatchObject({
        code: 'CLIENTA_YA_NORMAL',
      });
    });

    it('404 con una clienta inexistente', async () => {
      const { cambiarEstado } = await preparar();
      await expect(
        cambiarEstado.ejecutar({ clientaId: '99999999-9999-4999-8999-999999999999', accion: 'marcar_lista_roja' }, DUEÑA),
      ).rejects.toMatchObject({ httpStatus: 404 });
    });
  });
});
