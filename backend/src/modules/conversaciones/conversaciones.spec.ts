import { createHmac } from 'crypto';
import { crearBaseDeDatosDePrueba } from '../../database/test-utils/postgres-de-prueba';
import { Conversacion, HORAS_DE_VENTANA_DE_META } from './domain/entities/conversacion.entity';
import { DrizzleConversacionRepository } from './infrastructure/persistence/drizzle-conversacion.repository';
import { VerificadorDeFirmaMeta } from './infrastructure/meta/verificador-de-firma';
import { WhatsAppSoloLogAdapter } from './infrastructure/meta/whatsapp-solo-log.adapter';
import { ActualizarEstadoDeEntregaUseCase, RecibirMensajeUseCase } from './application/use-cases/recibir-mensaje.use-case';
import {
  CambiarModoConversacionUseCase,
  ConsultarBandejaUseCase,
  ConsultarHiloUseCase,
  EnviarMensajeManualUseCase,
  EnviarPlantillaUseCase,
  RegistrarNumeroDeSucursalUseCase,
} from './application/use-cases/bandeja.use-cases';
import { ContextoClientaDeConversacionAdapter } from '../integracion/contexto-clienta-de-conversacion.adapter';
import { DrizzleClientaRepository } from '../crm-y-clientas/infrastructure/persistence/drizzle-clienta.repository';
import { Clienta } from '../crm-y-clientas/domain/entities/clienta.entity';
import { AuditoriaPort } from '../../shared/auditoria/auditoria.port';
import { ClaimsUsuario, Rol } from '../../shared/auth/rol';
import { DrizzleUnitOfWork } from '../../shared/persistence/drizzle-unit-of-work';

const ENCARGADA: ClaimsUsuario = { sub: 'encargada-1', rol: Rol.GERENTE, sucursales: 'GLOBAL', manicuristaId: null };
const SUCURSAL_LOMAS = '11111111-1111-4111-8111-111111111111';
const SUCURSAL_ZIBATA = '22222222-2222-4222-8222-222222222222';
const NUMERO_LOMAS = 'pn-lomas-001';
const NUMERO_ZIBATA = 'pn-zibata-002';
const TELEFONO = '4421112233';

const AHORA = new Date('2026-12-07T10:00:00.000Z');
const UNA_HORA_DESPUES = new Date('2026-12-07T11:00:00.000Z');
/** 25 horas después: la ventana de Meta ya se cerró. */
const PASADAS_25_HORAS = new Date('2026-12-08T11:00:00.000Z');

async function preparar() {
  const db = await crearBaseDeDatosDePrueba();
  const repo = new DrizzleConversacionRepository(db);
  const clientaRepo = new DrizzleClientaRepository(db);
  const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
  const uow = new DrizzleUnitOfWork(db);
  const whatsapp = new WhatsAppSoloLogAdapter();
  const espiaTexto = jest.spyOn(whatsapp, 'enviarTexto');
  const espiaPlantilla = jest.spyOn(whatsapp, 'enviarPlantilla');

  const contextoClienta = new ContextoClientaDeConversacionAdapter(clientaRepo);

  // Las dos sucursales con número: el enrutamiento multi-sucursal es parte de lo que se prueba.
  await repo.registrarNumeroDeSucursal({ phoneNumberId: NUMERO_LOMAS, sucursalId: SUCURSAL_LOMAS, telefonoVisible: '4420000001' });
  await repo.registrarNumeroDeSucursal({ phoneNumberId: NUMERO_ZIBATA, sucursalId: SUCURSAL_ZIBATA, telefonoVisible: '4420000002' });

  const crearClienta = async (nombre: string, telefono: string, estado?: 'lista_roja' | 'bloqueada') => {
    const clienta = Clienta.registrar({ nombre, telefono });
    if (estado === 'lista_roja') clienta.marcarListaRoja();
    if (estado === 'bloqueada') clienta.marcarBloqueada();
    await clientaRepo.guardar(clienta);
    return clienta;
  };

  return {
    repo,
    auditoria,
    espiaTexto,
    espiaPlantilla,
    crearClienta,
    recibir: new RecibirMensajeUseCase(repo, contextoClienta, auditoria, uow),
    estados: new ActualizarEstadoDeEntregaUseCase(repo),
    bandeja: new ConsultarBandejaUseCase(repo),
    hilo: new ConsultarHiloUseCase(repo),
    enviarMensaje: new EnviarMensajeManualUseCase(repo, whatsapp, auditoria, uow),
    enviarPlantilla: new EnviarPlantillaUseCase(repo, whatsapp, auditoria, uow),
    cambiarModo: new CambiarModoConversacionUseCase(repo, auditoria, uow),
    registrarNumero: new RegistrarNumeroDeSucursalUseCase(repo, auditoria, uow),
  };
}

const entrante = (extra: Partial<Parameters<RecibirMensajeUseCase['ejecutar']>[0]> = {}) => ({
  phoneNumberId: NUMERO_LOMAS,
  telefonoClienta: TELEFONO,
  wamid: 'wamid.AAA111',
  tipo: 'texto' as const,
  contenido: 'Hola, quiero agendar',
  ocurridoEn: AHORA,
  ...extra,
});

describe('Conversaciones / Mensajería (integración, PostgreSQL real)', () => {
  describe('recepción y enrutamiento multi-sucursal', () => {
    it('abre la conversación en la SUCURSAL DEL NÚMERO RECEPTOR', async () => {
      // El `phone_number_id` es lo único que dice a qué sucursal pertenece el mensaje.
      const { recibir, repo } = await preparar();

      const resultado = await recibir.ejecutar(entrante({ phoneNumberId: NUMERO_ZIBATA }));

      expect(resultado.procesado).toBe(true);
      const conversacion = await repo.buscarPorId(resultado.conversacionId!);
      expect(conversacion?.sucursalId).toBe(SUCURSAL_ZIBATA);
    });

    it('EL MISMO TELÉFONO EN DOS SUCURSALES SON DOS CONVERSACIONES', async () => {
      // La identidad es `(sucursal, teléfono)`: una clienta que escribe a Lomas y a Zibatá tiene
      // dos hilos, igual que en WhatsApp real.
      const { recibir } = await preparar();

      const enLomas = await recibir.ejecutar(entrante({ phoneNumberId: NUMERO_LOMAS, wamid: 'wamid.L1' }));
      const enZibata = await recibir.ejecutar(entrante({ phoneNumberId: NUMERO_ZIBATA, wamid: 'wamid.Z1' }));

      expect(enLomas.conversacionId).not.toBe(enZibata.conversacionId);
    });

    it('un segundo mensaje reutiliza la misma conversación', async () => {
      const { recibir } = await preparar();

      const primero = await recibir.ejecutar(entrante({ wamid: 'wamid.1' }));
      const segundo = await recibir.ejecutar(entrante({ wamid: 'wamid.2', ocurridoEn: UNA_HORA_DESPUES }));

      expect(segundo.conversacionId).toBe(primero.conversacionId);
    });

    it('un `phone_number_id` NO MAPEADO se descarta sin lanzar', async () => {
      // Lanzar devolvería 500 a Meta, que reintentaría el mismo evento en bucle indefinidamente.
      const { recibir } = await preparar();

      const resultado = await recibir.ejecutar(entrante({ phoneNumberId: 'pn-desconocido' }));

      expect(resultado).toMatchObject({ procesado: false, conversacionId: null });
    });

    it('la auditoría NO guarda el contenido del mensaje (`RN-AUD-01`)', async () => {
      const { recibir, auditoria } = await preparar();

      await recibir.ejecutar(entrante({ contenido: 'Me llamo Andrea y vivo en Juriquilla' }));

      const detalle = JSON.stringify(auditoria.registrar.mock.calls[0][0].detalle);
      expect(detalle).not.toContain('Andrea');
      expect(detalle).not.toContain('Juriquilla');
      expect(detalle).toContain('recibir_mensaje_entrante');
    });
  });

  describe('IDEMPOTENCIA POR `wamid` — Meta reintenta los webhooks', () => {
    it('EL MISMO `wamid` DOS VECES NO DUPLICA EL MENSAJE NI SUS EFECTOS', async () => {
      // Sin esto, cada reintento duplicaría el mensaje, sumaría otro pendiente, volvería a mover
      // la ventana de 24 h y —en la Parte 3— invocaría otra vez a la IA.
      const { recibir, repo, hilo } = await preparar();

      const primera = await recibir.ejecutar(entrante({ wamid: 'wamid.REPETIDO' }));
      const segunda = await recibir.ejecutar(entrante({ wamid: 'wamid.REPETIDO' }));

      expect(primera.procesado).toBe(true);
      expect(segunda.procesado).toBe(false);

      const { mensajes } = await hilo.ejecutar({ conversacionId: primera.conversacionId! });
      expect(mensajes).toHaveLength(1);

      const conversacion = await repo.buscarPorId(primera.conversacionId!);
      // El contador de pendientes NO se incrementó dos veces.
      expect(conversacion?.mensajesSinResponder).toBe(1);
    });

    it('y el reintento NO vuelve a mover la ventana de 24 h', async () => {
      const { recibir, repo } = await preparar();
      const primera = await recibir.ejecutar(entrante({ wamid: 'wamid.X', ocurridoEn: AHORA }));

      // El reintento llega con un `ocurridoEn` posterior (Meta reenvía más tarde).
      await recibir.ejecutar(entrante({ wamid: 'wamid.X', ocurridoEn: PASADAS_25_HORAS }));

      const conversacion = await repo.buscarPorId(primera.conversacionId!);
      // Si el reintento hubiera movido la ventana, esto sería `PASADAS_25_HORAS`.
      expect(conversacion?.ultimaInteraccionEntranteEn).toEqual(AHORA);
    });

    it('dos `wamid` distintos sí cuentan como dos mensajes', async () => {
      const { recibir, repo } = await preparar();

      const primera = await recibir.ejecutar(entrante({ wamid: 'wamid.A' }));
      await recibir.ejecutar(entrante({ wamid: 'wamid.B', ocurridoEn: UNA_HORA_DESPUES }));

      const conversacion = await repo.buscarPorId(primera.conversacionId!);
      expect(conversacion?.mensajesSinResponder).toBe(2);
    });
  });

  describe('VENTANA DE 24 HORAS DE META (`N-14`)', () => {
    it('recién escrito: la ventana está ABIERTA y el texto libre pasa', async () => {
      const { recibir, enviarMensaje, espiaTexto } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante());

      await expect(
        enviarMensaje.ejecutar({ conversacionId: conversacionId!, texto: 'Claro que sí' }, ENCARGADA, UNA_HORA_DESPUES),
      ).resolves.toMatchObject({ wamid: expect.stringContaining('local.') });
      expect(espiaTexto).toHaveBeenCalledTimes(1);
    });

    it('A LAS 25 HORAS SE RECHAZA EL TEXTO LIBRE CON `VENTANA_24H_CERRADA`', async () => {
      const { recibir, enviarMensaje, espiaTexto } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante());

      await expect(
        enviarMensaje.ejecutar({ conversacionId: conversacionId!, texto: 'Hola otra vez' }, ENCARGADA, PASADAS_25_HORAS),
      ).rejects.toMatchObject({ code: 'VENTANA_24H_CERRADA', httpStatus: 409 });

      // **No se gastó la petición a Meta**: se valida antes de llamar.
      expect(espiaTexto).not.toHaveBeenCalled();
    });

    it('justo antes de las 24 h sigue abierta; justo después, cerrada', async () => {
      const { recibir, repo } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante());
      const conversacion = (await repo.buscarPorId(conversacionId!))!;

      const casi = new Date(AHORA.getTime() + (HORAS_DE_VENTANA_DE_META * 3_600_000 - 1_000));
      const pasada = new Date(AHORA.getTime() + (HORAS_DE_VENTANA_DE_META * 3_600_000 + 1_000));

      expect(conversacion.estadoDeVentana(casi)).toBe('abierta');
      expect(conversacion.estadoDeVentana(pasada)).toBe('cerrada');
    });

    it('`nunca_abierta` es distinto de `cerrada`: la clienta nunca escribió', async () => {
      // Importa porque el mensaje para quien opera es distinto, y porque es el caso en que la
      // plantilla es la única vía desde el principio.
      const nueva = Conversacion.abrir({ sucursalId: SUCURSAL_LOMAS, telefonoClienta: TELEFONO });

      expect(nueva.estadoDeVentana(AHORA)).toBe('nunca_abierta');
      expect(() => nueva.exigirVentanaAbiertaParaTextoLibre(AHORA)).toThrow(
        expect.objectContaining({ code: 'VENTANA_24H_CERRADA' }),
      );
    });

    it('LA PLANTILLA SÍ PASA CON LA VENTANA CERRADA', async () => {
      const { recibir, enviarPlantilla, espiaPlantilla } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante());

      await expect(
        enviarPlantilla.ejecutar(
          { conversacionId: conversacionId!, plantilla: 'recordatorio_cita_24h', parametros: ['10:00 a.m.'] },
          ENCARGADA,
          PASADAS_25_HORAS,
        ),
      ).resolves.toBeDefined();

      expect(espiaPlantilla).toHaveBeenCalledWith(
        expect.objectContaining({ plantilla: 'recordatorio_cita_24h', idioma: 'es_MX', parametros: ['10:00 a.m.'] }),
      );
    });

    it('responder NO extiende la ventana: solo la mueve un mensaje de la clienta', async () => {
      // Es la regla de Meta, no una elección de Blanc.
      const { recibir, enviarMensaje, repo } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante());
      await enviarMensaje.ejecutar({ conversacionId: conversacionId!, texto: 'Va' }, ENCARGADA, UNA_HORA_DESPUES);

      const conversacion = await repo.buscarPorId(conversacionId!);
      expect(conversacion?.ultimaInteraccionEntranteEn).toEqual(AHORA);
    });
  });

  describe('CLIENTA BLOQUEADA: `humano` EN SILENCIO (`RN-CRM-04`)', () => {
    it('la conversación pasa a `humano` con motivo `clienta_bloqueada` y SIN respuesta automática', async () => {
      const { recibir, crearClienta, repo, espiaTexto, espiaPlantilla } = await preparar();
      await crearClienta('Ximena Morales', TELEFONO, 'bloqueada');

      const resultado = await recibir.ejecutar(entrante());

      expect(resultado).toMatchObject({ procesado: true, escalada: true, enSilencioPorBloqueo: true });
      const conversacion = await repo.buscarPorId(resultado.conversacionId!);
      expect(conversacion?.modo).toBe('humano');
      expect(conversacion?.motivoDeEscalamiento).toBe('clienta_bloqueada');
      // Silencio: ni texto ni plantilla. Decirle "estás bloqueada" por canal automático es
      // información que la Dueña no quiere dar.
      expect(espiaTexto).not.toHaveBeenCalled();
      expect(espiaPlantilla).not.toHaveBeenCalled();
    });

    it('PERO EL MENSAJE SÍ SE GUARDA: la bandeja tiene que mostrarlo', async () => {
      const { recibir, crearClienta, hilo } = await preparar();
      await crearClienta('Ximena Morales', TELEFONO, 'bloqueada');

      const { conversacionId } = await recibir.ejecutar(entrante());

      const { mensajes } = await hilo.ejecutar({ conversacionId: conversacionId! });
      expect(mensajes).toHaveLength(1);
      expect(mensajes[0].emisor).toBe('clienta');
    });

    it('una clienta `normal` NO escala: la lleva el bot', async () => {
      const { recibir, crearClienta, repo } = await preparar();
      await crearClienta('Andrea Ramírez', TELEFONO);

      const resultado = await recibir.ejecutar(entrante());

      expect(resultado.escalada).toBe(false);
      expect((await repo.buscarPorId(resultado.conversacionId!))?.modo).toBe('bot');
    });

    it('con DOS clientas en el mismo teléfono y UNA bloqueada, escala igual (lado seguro)', async () => {
      // Mamá e hija comparten número. No se sabe quién escribe, así que el bot no atiende.
      const { recibir, crearClienta, repo } = await preparar();
      await crearClienta('Carmen Aguilar', TELEFONO);
      await crearClienta('Sofía Aguilar', TELEFONO, 'bloqueada');

      const resultado = await recibir.ejecutar(entrante());

      expect(resultado.enSilencioPorBloqueo).toBe(true);
      expect((await repo.buscarPorId(resultado.conversacionId!))?.modo).toBe('humano');
    });

    it('y con dos clientas NO se vincula ninguna: elegir sería adivinar', async () => {
      const { recibir, crearClienta, repo } = await preparar();
      await crearClienta('Carmen Aguilar', TELEFONO);
      await crearClienta('Sofía Aguilar', TELEFONO);

      const resultado = await recibir.ejecutar(entrante());

      expect((await repo.buscarPorId(resultado.conversacionId!))?.clientaId).toBeNull();
    });

    it('con UNA sola clienta sí se vincula', async () => {
      const { recibir, crearClienta, repo } = await preparar();
      const andrea = await crearClienta('Andrea Ramírez', TELEFONO);

      const resultado = await recibir.ejecutar(entrante());

      expect((await repo.buscarPorId(resultado.conversacionId!))?.clientaId).toBe(andrea.id);
    });
  });

  describe('HANDOFF: del modo `humano` no se sale solo (`RN-ESC-03`)', () => {
    it('escribir desde la bandeja TOMA la conversación', async () => {
      // Dejarla en `bot` produciría dos interlocutores en el mismo hilo.
      const { recibir, enviarMensaje, repo } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante());

      await enviarMensaje.ejecutar({ conversacionId: conversacionId!, texto: 'Te atiendo yo' }, ENCARGADA, UNA_HORA_DESPUES);

      const conversacion = await repo.buscarPorId(conversacionId!);
      expect(conversacion?.modo).toBe('humano');
      expect(conversacion?.motivoDeEscalamiento).toBe('intervencion_manual');
    });

    it('UN MENSAJE NUEVO DE LA CLIENTA NO DEVUELVE EL CONTROL AL BOT', async () => {
      // Es la regla central: ninguna vía automática saca del modo `humano`.
      const { recibir, cambiarModo, repo } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante({ wamid: 'wamid.1' }));
      await cambiarModo.escalar({ conversacionId: conversacionId!, motivo: 'queja_o_reclamo' }, ENCARGADA);

      await recibir.ejecutar(entrante({ wamid: 'wamid.2', ocurridoEn: PASADAS_25_HORAS }));

      const conversacion = await repo.buscarPorId(conversacionId!);
      expect(conversacion?.modo).toBe('humano');
      expect(conversacion?.motivoDeEscalamiento).toBe('queja_o_reclamo');
    });

    it('escalar dos veces NO sobrescribe el motivo original', async () => {
      // El primero explica por qué dejó de atenderla el bot; sobrescribirlo borraría la razón real.
      const { recibir, cambiarModo, repo } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante());
      await cambiarModo.escalar({ conversacionId: conversacionId!, motivo: 'queja_o_reclamo' }, ENCARGADA);

      await cambiarModo.escalar({ conversacionId: conversacionId!, motivo: 'intervencion_manual' }, ENCARGADA);

      expect((await repo.buscarPorId(conversacionId!))?.motivoDeEscalamiento).toBe('queja_o_reclamo');
    });

    it('solo `devolverAlBot` saca del modo `humano`, y limpia el motivo', async () => {
      const { recibir, cambiarModo, repo } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante());
      await cambiarModo.escalar({ conversacionId: conversacionId!, motivo: 'solicitud_humana' }, ENCARGADA);

      await cambiarModo.devolverAlBot({ conversacionId: conversacionId! }, ENCARGADA);

      const conversacion = await repo.buscarPorId(conversacionId!);
      expect(conversacion?.modo).toBe('bot');
      expect(conversacion?.motivoDeEscalamiento).toBeNull();
      expect(conversacion?.escaladaEn).toBeNull();
    });

    it('409 al devolver al bot una conversación que ya lo lleva', async () => {
      const { recibir, cambiarModo } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante());

      await expect(cambiarModo.devolverAlBot({ conversacionId: conversacionId! }, ENCARGADA)).rejects.toMatchObject({
        code: 'CONVERSACION_YA_EN_BOT',
      });
    });
  });

  describe('bandeja', () => {
    it('ordena por actividad y filtra por sucursal, modo y pendientes', async () => {
      const { recibir, enviarMensaje, bandeja, cambiarModo } = await preparar();
      const enLomas = await recibir.ejecutar(entrante({ wamid: 'wamid.L', phoneNumberId: NUMERO_LOMAS }));
      await recibir.ejecutar(entrante({ wamid: 'wamid.Z', phoneNumberId: NUMERO_ZIBATA, ocurridoEn: UNA_HORA_DESPUES }));

      const todas = await bandeja.listar({});
      expect(todas.conversaciones).toHaveLength(2);

      const soloLomas = await bandeja.listar({ sucursalId: SUCURSAL_LOMAS });
      expect(soloLomas.conversaciones.map((c) => c.id)).toEqual([enLomas.conversacionId]);

      await cambiarModo.escalar({ conversacionId: enLomas.conversacionId!, motivo: 'queja_o_reclamo' }, ENCARGADA);
      const soloHumanas = await bandeja.listar({ modo: 'humano' });
      expect(soloHumanas.conversaciones.map((c) => c.id)).toEqual([enLomas.conversacionId]);

      // Responder la saca de pendientes.
      await enviarMensaje.ejecutar({ conversacionId: enLomas.conversacionId!, texto: 'Ya te atiendo' }, ENCARGADA, UNA_HORA_DESPUES);
      const pendientes = await bandeja.listar({ soloPendientes: true });
      expect(pendientes.conversaciones.map((c) => c.id)).not.toContain(enLomas.conversacionId);
    });

    it('el hilo viaja CON el estado de la ventana', async () => {
      const { recibir, hilo } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante());

      const abierto = await hilo.ejecutar({ conversacionId: conversacionId! }, UNA_HORA_DESPUES);
      expect(abierto.estadoDeVentana).toBe('abierta');

      const cerrado = await hilo.ejecutar({ conversacionId: conversacionId! }, PASADAS_25_HORAS);
      expect(cerrado.estadoDeVentana).toBe('cerrada');
    });

    it('404 con una conversación inexistente', async () => {
      const { hilo } = await preparar();
      await expect(hilo.ejecutar({ conversacionId: '99999999-9999-4999-8999-999999999999' })).rejects.toMatchObject({
        httpStatus: 404,
      });
    });

    it('409 si la sucursal no tiene número de WhatsApp dado de alta', async () => {
      const { recibir, enviarMensaje, registrarNumero } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante());
      // Se reasigna el número a otra sucursal: Lomas se queda sin número.
      await registrarNumero.ejecutar({ phoneNumberId: NUMERO_LOMAS, sucursalId: SUCURSAL_ZIBATA, telefonoVisible: '4420000001' }, ENCARGADA);

      await expect(
        enviarMensaje.ejecutar({ conversacionId: conversacionId!, texto: 'Hola' }, ENCARGADA, UNA_HORA_DESPUES),
      ).rejects.toMatchObject({ code: 'SUCURSAL_SIN_NUMERO_DE_WHATSAPP' });
    });
  });

  describe('estados de entrega que reporta Meta', () => {
    it('actualiza `sent`, `delivered` y `read` del mensaje saliente', async () => {
      const { recibir, enviarMensaje, estados, hilo } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante());
      const { wamid } = await enviarMensaje.ejecutar({ conversacionId: conversacionId!, texto: 'Va' }, ENCARGADA, UNA_HORA_DESPUES);

      await expect(estados.ejecutar({ wamid, estado: 'delivered' })).resolves.toBe(true);

      const { mensajes } = await hilo.ejecutar({ conversacionId: conversacionId! });
      expect(mensajes.find((m) => m.wamid === wamid)?.estadoEntrega).toBe('delivered');
    });

    it('`failed` guarda el motivo del fallo', async () => {
      const { recibir, enviarMensaje, estados, hilo } = await preparar();
      const { conversacionId } = await recibir.ejecutar(entrante());
      const { wamid } = await enviarMensaje.ejecutar({ conversacionId: conversacionId!, texto: 'Va' }, ENCARGADA, UNA_HORA_DESPUES);

      await estados.ejecutar({ wamid, estado: 'failed', error: 'Numero no registrado en WhatsApp' });

      const { mensajes } = await hilo.ejecutar({ conversacionId: conversacionId! });
      const mensaje = mensajes.find((m) => m.wamid === wamid);
      expect(mensaje?.estadoEntrega).toBe('failed');
      expect(mensaje?.errorDeEnvio).toContain('no registrado');
    });

    it('un `wamid` desconocido se ignora sin fallar', async () => {
      // Meta puede reportar el estado de un mensaje que no es nuestro; devolver error haría que
      // reintentara en bucle un evento que nunca vamos a poder procesar.
      const { estados } = await preparar();
      await expect(estados.ejecutar({ wamid: 'wamid.AJENO', estado: 'read' })).resolves.toBe(false);
    });
  });

  describe('verificación de la firma HMAC del webhook', () => {
    const SECRETO = 'app-secret-de-prueba';
    const CUERPO = JSON.stringify({ entry: [{ changes: [{ value: { messages: [] } }] }] });
    const firmar = (cuerpo: string, secreto = SECRETO) => `sha256=${createHmac('sha256', secreto).update(cuerpo).digest('hex')}`;

    it('ACEPTA una firma correcta', () => {
      const verificador = new VerificadorDeFirmaMeta(SECRETO);
      expect(verificador.esValida(firmar(CUERPO), CUERPO)).toBe(true);
    });

    it('RECHAZA una firma calculada con otro secreto', () => {
      const verificador = new VerificadorDeFirmaMeta(SECRETO);
      expect(verificador.esValida(firmar(CUERPO, 'secreto-de-un-atacante'), CUERPO)).toBe(false);
    });

    it('RECHAZA si el cuerpo cambió aunque sea un carácter', () => {
      // Es la propiedad que hace útil al HMAC: autentica el contenido, no solo el emisor.
      const verificador = new VerificadorDeFirmaMeta(SECRETO);
      expect(verificador.esValida(firmar(CUERPO), `${CUERPO} `)).toBe(false);
    });

    it('RECHAZA sin cabecera de firma', () => {
      const verificador = new VerificadorDeFirmaMeta(SECRETO);
      expect(verificador.esValida(undefined, CUERPO)).toBe(false);
    });

    it('RECHAZA una firma sin el prefijo `sha256=`', () => {
      const verificador = new VerificadorDeFirmaMeta(SECRETO);
      const sinPrefijo = createHmac('sha256', SECRETO).update(CUERPO).digest('hex');
      expect(verificador.esValida(sinPrefijo, CUERPO)).toBe(false);
    });

    it('RECHAZA una firma de longitud distinta sin lanzar', () => {
      // `timingSafeEqual` lanza si las longitudes difieren: se comprueban antes.
      const verificador = new VerificadorDeFirmaMeta(SECRETO);
      expect(() => verificador.esValida('sha256=corta', CUERPO)).not.toThrow();
      expect(verificador.esValida('sha256=corta', CUERPO)).toBe(false);
    });

    it('CON APP SECRET VACÍO RECHAZA TODO: el webhook falla cerrado', () => {
      // Un webhook sin App Secret no puede distinguir a Meta de un tercero.
      const sinSecreto = new VerificadorDeFirmaMeta('');
      expect(sinSecreto.esValida(firmar(CUERPO), CUERPO)).toBe(false);
    });
  });
});
