import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { createHmac, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { json } from 'express';
import { ConversacionesModule } from '../../conversaciones.module';
import { CrmYClientasModule } from '../../../crm-y-clientas/crm-y-clientas.module';
import { CONTEXTO_CLIENTA_DE_CONVERSACION_PORT } from '../../domain/ports/contexto-clienta-de-conversacion.port';
import { ContextoClientaDeConversacionAdapter } from '../../../integracion/contexto-clienta-de-conversacion.adapter';
import { ORQUESTADOR_DE_BOT_PORT } from '../../domain/ports/orquestador-de-bot.port';
import { OrquestadorInactivoAdapter } from '../../infrastructure/orquestador-inactivo.adapter';
import { TOKEN_VERIFICACION_META } from '../meta/webhook-meta.controller';
import { VerificadorDeFirmaMeta } from '../meta/verificador-de-firma';
import { Clienta } from '../../../crm-y-clientas/domain/entities/clienta.entity';
import { DrizzleClientaRepository } from '../../../crm-y-clientas/infrastructure/persistence/drizzle-clienta.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { Database } from '../../../../database/connection';
import { AUDITORIA_PORT } from '../../../../shared/auditoria/auditoria.port';
import { DrizzleAuditoriaRepository } from '../../../../shared/auditoria/drizzle-auditoria.repository';
import { UNIT_OF_WORK } from '../../../../shared/persistence/unit-of-work.port';
import { DrizzleUnitOfWork } from '../../../../shared/persistence/drizzle-unit-of-work';
import { JwtAuthGuard } from '../../../../shared/auth/jwt-auth.guard';
import { AuthorizationGuard } from '../../../../shared/auth/authorization.guard';
import { PermisosUsuario, PermisosUsuarioPort } from '../../../../shared/auth/permisos-usuario.port';
import { RolesGuard } from '../../../../shared/auth/roles.guard';
import { Rol } from '../../../../shared/auth/rol';
import { HttpExceptionFilter } from '../../../../shared/errors/http-exception.filter';
import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';

const SECRETO_JWT = 'secreto-e2e-conversaciones';
const ISSUER = 'https://issuer-e2e.example/auth/v1';
const APP_SECRET = 'app-secret-de-prueba-e2e';
const VERIFY_TOKEN = 'token-de-verificacion-de-prueba';
const jwksNuncaLlamado = async () => {
  throw new Error('resolverClaveJwks no debería invocarse en este E2E (solo HS256)');
};

const permisosPorSub = new Map<string, PermisosUsuario>();
const permisosDePrueba: PermisosUsuarioPort = {
  obtenerPermisosPorSupabaseUserId: async (sub) => permisosPorSub.get(sub) ?? null,
};

function token(rol: Rol, sub: string, manicuristaId: string | null = null) {
  permisosPorSub.set(sub, { rol, activa: true, sucursales: 'GLOBAL', manicuristaId });
  return jwt.sign({ iss: ISSUER, aud: 'authenticated', sub }, SECRETO_JWT);
}

const BANDEJA = '/v1/conversaciones';
const WEBHOOK = '/v1/webhooks/meta';
const NUMERO = 'pn-e2e-lomas';
const TELEFONO_META = '5214421112233';
const TELEFONO_NORMALIZADO = '4421112233';

let dbDePrueba: Database;

@Global()
@Module({
  providers: [
    { provide: DATABASE_CONNECTION, useFactory: () => dbDePrueba },
    { provide: AUDITORIA_PORT, useClass: DrizzleAuditoriaRepository },
    { provide: UNIT_OF_WORK, useClass: DrizzleUnitOfWork },
    /**
     * En producción lo provee `IntegracionModule`, que esta prueba no monta. Va aquí dentro —y no
     * con `overrideProvider`— porque `overrideProvider` solo sustituye un proveedor que ya existe,
     * y `ConversacionesModule` declara el puerto sin proveerlo (es la regla de `P5`).
     */
    {
      provide: CONTEXTO_CLIENTA_DE_CONVERSACION_PORT,
      useFactory: (db: Database) => new ContextoClientaDeConversacionAdapter(new DrizzleClientaRepository(db)),
      inject: [DATABASE_CONNECTION],
    },
    /**
     * **El bot, inerte**, por la misma razón que el puerto de arriba: `ConversacionesModule`
     * declara `ORQUESTADOR_DE_BOT_PORT` y no lo provee — lo provee `AgenteModule`, que este
     * archivo no monta a propósito.
     *
     * Y es deliberado que no lo monte: **lo que este archivo prueba es el canal sin bot**, que es
     * un estado de operación real (`BOT_ACTIVO=false`) y el que estuvo vigente toda la Parte 2. El
     * bot tiene su propio E2E con el grafo completo, en `agente/bot.e2e.spec.ts`.
     */
    { provide: ORQUESTADOR_DE_BOT_PORT, useClass: OrquestadorInactivoAdapter },
  ],
  exports: [DATABASE_CONNECTION, AUDITORIA_PORT, UNIT_OF_WORK, CONTEXTO_CLIENTA_DE_CONVERSACION_PORT, ORQUESTADOR_DE_BOT_PORT],
})
class TestInfraModule {}

describe('Conversaciones — Webhook de Meta y Bandeja E2E (HTTP) — Fase 4 Parte 2', () => {
  let app: INestApplication;
  let sucursalId: string;
  let dueña: string;
  let encargada: string;
  let manicurista: string;
  let recepcionista: string;

  /** Firma el cuerpo igual que Meta: HMAC-SHA256 con el App Secret. */
  const firmar = (cuerpo: unknown, secreto = APP_SECRET) =>
    `sha256=${createHmac('sha256', secreto).update(JSON.stringify(cuerpo)).digest('hex')}`;

  /**
   * Timestamp de Meta **en segundos**, relativo al reloj real.
   *
   * Fijarlo a una constante no sirve: la ventana de 24 h se mide contra `Date.now()`, así que un
   * timestamp absoluto cae a un lado u otro según la fecha en que se corra la suite — y una
   * constante de 2026 quedaba en el *futuro*, dejando la ventana abierta justo en la prueba que
   * quería comprobarla cerrada.
   */
  const haceHoras = (horas: number) => String(Math.floor((Date.now() - horas * 3_600_000) / 1000));

  const payloadDeMensaje = (wamid: string, texto = 'Hola, quiero agendar', timestamp = haceHoras(0)) => ({
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: NUMERO },
              messages: [{ id: wamid, from: TELEFONO_META, timestamp, type: 'text', text: { body: texto } }],
            },
          },
        ],
      },
    ],
  });

  const enviarWebhook = (cuerpo: unknown, firma?: string) =>
    request(app.getHttpServer())
      .post(WEBHOOK)
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', firma ?? firmar(cuerpo))
      // `.send(string)` para que el cuerpo crudo coincida byte a byte con lo firmado: si supertest
      // reserializara el objeto, el HMAC no cuadraría.
      .send(JSON.stringify(cuerpo));

  beforeAll(async () => {
    dbDePrueba = await crearBaseDeDatosDePrueba();

    const moduleRef = await Test.createTestingModule({
      imports: [TestInfraModule, ConversacionesModule, CrmYClientasModule],
      providers: [
        {
          provide: APP_GUARD,
          useFactory: (reflector: Reflector) => new JwtAuthGuard(SECRETO_JWT, reflector, ISSUER, jwksNuncaLlamado),
          inject: [Reflector],
        },
        {
          provide: APP_GUARD,
          useFactory: (reflector: Reflector) => new AuthorizationGuard(permisosDePrueba, reflector),
          inject: [Reflector],
        },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    })
      .overrideProvider(VerificadorDeFirmaMeta)
      .useValue(new VerificadorDeFirmaMeta(APP_SECRET))
      .overrideProvider(TOKEN_VERIFICACION_META)
      .useValue(VERIFY_TOKEN)
      .compile();

    app = moduleRef.createNestApplication();
    /**
     * El mismo captador de cuerpo crudo que `main.ts`: sin él, `rawBody` no existe y el webhook
     * rechaza **todo** por firma inválida. La prueba de la firma no valdría nada si aquí se
     * omitiera, porque pasaría por el camino de "no hay cuerpo crudo".
     */
    app.use(
      json({
        verify: (peticion: IncomingMessage, _respuesta: ServerResponse, buffer: Buffer) => {
          if (buffer?.length) (peticion as IncomingMessage & { rawBody?: Buffer }).rawBody = buffer;
        },
      }),
    );
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await crearBaseDeDatosDePrueba();
    dueña = token(Rol.ADMINISTRADOR, 'dueña');
    encargada = token(Rol.GERENTE, 'encargada');
    manicurista = token(Rol.MANICURISTA, 'ana', randomUUID());
    recepcionista = token(Rol.RECEPCIONISTA, 'recepcionista');
    sucursalId = randomUUID();

    await request(app.getHttpServer())
      .post(`${BANDEJA}/numeros`)
      .set('Authorization', `Bearer ${dueña}`)
      .send({ phoneNumberId: NUMERO, sucursalId, telefonoVisible: '4420000001' })
      .expect(201);
  });

  describe('verificación del webhook (reto de Meta)', () => {
    it('200 y devuelve el challenge EN TEXTO PLANO con el token correcto', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(WEBHOOK)
        .query({ 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY_TOKEN, 'hub.challenge': '123456' })
        .expect(200);

      // Meta espera el challenge literal, no un JSON.
      expect(respuesta.text).toBe('123456');
    });

    it('401 con un token de verificación incorrecto', async () => {
      await request(app.getHttpServer())
        .get(WEBHOOK)
        .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'token-de-un-tercero', 'hub.challenge': '123456' })
        .expect(401);
    });

    it('401 si el modo no es `subscribe`', async () => {
      await request(app.getHttpServer())
        .get(WEBHOOK)
        .query({ 'hub.mode': 'otro', 'hub.verify_token': VERIFY_TOKEN, 'hub.challenge': '1' })
        .expect(401);
    });
  });

  describe('FIRMA HMAC del webhook', () => {
    it('200 con firma válida y el mensaje queda en la bandeja', async () => {
      const cuerpo = payloadDeMensaje('wamid.E2E.1');

      const respuesta = await enviarWebhook(cuerpo).expect(200);
      expect(respuesta.body).toMatchObject({ recibido: true, procesados: 1 });

      const bandeja = await request(app.getHttpServer())
        .get(BANDEJA)
        .query({ sucursalId })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(bandeja.body.conversaciones).toHaveLength(1);
      // El teléfono se normaliza a 10 dígitos: Meta lo entrega en formato internacional.
      expect(bandeja.body.conversaciones[0]).toMatchObject({ telefonoClienta: TELEFONO_NORMALIZADO, modo: 'bot' });
    });

    it('401 CON FIRMA CALCULADA CON OTRO SECRETO', async () => {
      // El webhook es público: la firma es lo ÚNICO que distingue a Meta de un tercero.
      const cuerpo = payloadDeMensaje('wamid.E2E.FALSO');

      const respuesta = await enviarWebhook(cuerpo, firmar(cuerpo, 'secreto-de-un-atacante')).expect(401);
      expect(respuesta.body.error.code).toBe('FIRMA_META_INVALIDA');
    });

    it('401 SIN CABECERA DE FIRMA', async () => {
      await request(app.getHttpServer())
        .post(WEBHOOK)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(payloadDeMensaje('wamid.E2E.SIN_FIRMA')))
        .expect(401);
    });

    it('401 si el cuerpo se altera después de firmarlo', async () => {
      // Autentica el CONTENIDO, no solo al emisor.
      const cuerpo = payloadDeMensaje('wamid.E2E.ORIGINAL');
      const firmaDelOriginal = firmar(cuerpo);
      const alterado = payloadDeMensaje('wamid.E2E.ALTERADO');

      await enviarWebhook(alterado, firmaDelOriginal).expect(401);
    });

    it('y un mensaje rechazado por firma NO crea conversación', async () => {
      await enviarWebhook(payloadDeMensaje('wamid.E2E.X'), 'sha256=0000').expect(401);

      const bandeja = await request(app.getHttpServer())
        .get(BANDEJA)
        .query({ sucursalId })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);
      expect(bandeja.body.conversaciones).toEqual([]);
    });
  });

  describe('IDEMPOTENCIA por `wamid` ante reintentos de Meta', () => {
    it('EL MISMO WEBHOOK DOS VECES: 200 las dos, UN SOLO MENSAJE', async () => {
      const cuerpo = payloadDeMensaje('wamid.E2E.REINTENTO');

      const primera = await enviarWebhook(cuerpo).expect(200);
      const segunda = await enviarWebhook(cuerpo).expect(200);

      expect(primera.body).toMatchObject({ procesados: 1, ignorados: 0 });
      // El reintento se acepta (200, para que Meta no insista) pero no procesa nada.
      expect(segunda.body).toMatchObject({ procesados: 0, ignorados: 1 });

      const bandeja = await request(app.getHttpServer())
        .get(BANDEJA)
        .query({ sucursalId })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      const conversacionId = bandeja.body.conversaciones[0].id;
      expect(bandeja.body.conversaciones[0].mensajesSinResponder).toBe(1);

      const hilo = await request(app.getHttpServer())
        .get(`${BANDEJA}/${conversacionId}`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);
      expect(hilo.body.mensajes).toHaveLength(1);
    });

    it('200 con un `phone_number_id` no mapeado: se descarta sin reventar', async () => {
      // Un 500 haría que Meta reintentara el mismo evento en bucle indefinidamente.
      const cuerpo = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: 'pn-desconocido' },
                  messages: [{ id: 'wamid.E2E.HUERFANO', from: TELEFONO_META, timestamp: '1796000000', type: 'text', text: { body: 'Hola' } }],
                },
              },
            ],
          },
        ],
      };

      const respuesta = await enviarWebhook(cuerpo).expect(200);
      expect(respuesta.body).toMatchObject({ procesados: 0, ignorados: 1 });
    });

    it('procesa los estados de entrega que reporta Meta', async () => {
      const mensaje = payloadDeMensaje('wamid.E2E.PARA_ESTADO');
      await enviarWebhook(mensaje).expect(200);

      const estado = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: NUMERO },
                  statuses: [{ id: 'wamid.E2E.PARA_ESTADO', status: 'read' }],
                },
              },
            ],
          },
        ],
      };

      const respuesta = await enviarWebhook(estado).expect(200);
      expect(respuesta.body.procesados).toBe(1);
    });
  });

  describe('clienta BLOQUEADA: silencio en modo `humano`', () => {
    it('la conversación queda en `humano` con motivo `clienta_bloqueada`', async () => {
      const bloqueada = Clienta.registrar({ nombre: 'Ximena Morales', telefono: TELEFONO_NORMALIZADO });
      bloqueada.marcarBloqueada();
      await new DrizzleClientaRepository(dbDePrueba).guardar(bloqueada);

      await enviarWebhook(payloadDeMensaje('wamid.E2E.BLOQUEADA')).expect(200);

      const bandeja = await request(app.getHttpServer())
        .get(BANDEJA)
        .query({ sucursalId })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(bandeja.body.conversaciones[0]).toMatchObject({ modo: 'humano', motivoDeEscalamiento: 'clienta_bloqueada' });
    });
  });

  describe('bandeja: responder, plantillas y ventana de 24 h', () => {
    /** Crea la conversación por webhook y devuelve su id. `horas` = antigüedad del mensaje. */
    const conversacionNuevaConEdad = async (wamid: string, horas: number) => {
      await enviarWebhook(payloadDeMensaje(wamid, 'Hola', haceHoras(horas))).expect(200);
      const bandeja = await request(app.getHttpServer())
        .get(BANDEJA)
        .query({ sucursalId })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);
      return bandeja.body.conversaciones[0].id as string;
    };

    const conversacionNueva = (wamid = 'wamid.E2E.BASE') => conversacionNuevaConEdad(wamid, 0);

    it('201 al responder, y la conversación queda TOMADA en modo `humano`', async () => {
      const id = await conversacionNueva();

      const respuesta = await request(app.getHttpServer())
        .post(`${BANDEJA}/${id}/mensajes`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ texto: 'Claro que sí, ¿a qué hora te acomoda?' })
        .expect(201);

      expect(respuesta.body.conversacion).toMatchObject({ modo: 'humano', motivoDeEscalamiento: 'intervencion_manual' });
      expect(respuesta.body.wamid).toBeDefined();
    });

    it('EL HILO INFORMA QUE LA VENTANA ESTÁ ABIERTA tras un mensaje reciente', async () => {
      // Viaja en la respuesta para que quien abre la conversación sepa **antes de escribir** si
      // puede mandar texto libre.
      const id = await conversacionNueva();

      const hilo = await request(app.getHttpServer()).get(`${BANDEJA}/${id}`).set('Authorization', `Bearer ${encargada}`).expect(200);

      expect(hilo.body.estadoDeVentana).toBe('abierta');
      expect(hilo.body.ventanaAbierta).toBe(true);
    });

    it('y que está CERRADA si el último mensaje de la clienta tiene 48 horas', async () => {
      await enviarWebhook(payloadDeMensaje('wamid.E2E.VIEJO.HILO', 'Hola', haceHoras(48))).expect(200);
      const bandeja = await request(app.getHttpServer())
        .get(BANDEJA)
        .query({ sucursalId })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      const hilo = await request(app.getHttpServer())
        .get(`${BANDEJA}/${bandeja.body.conversaciones[0].id}`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(hilo.body.estadoDeVentana).toBe('cerrada');
      expect(hilo.body.ventanaAbierta).toBe(false);
    });

    it('409 VENTANA_24H_CERRADA al responder con texto libre pasadas 24 h', async () => {
      // 48 horas: la ventana de Meta ya se cerró, así que el texto libre se rechaza **sin gastar
      // la petición** y con una instrucción accionable (usa plantilla).
      const id = await conversacionNuevaConEdad('wamid.E2E.VIEJO', 48);

      const respuesta = await request(app.getHttpServer())
        .post(`${BANDEJA}/${id}/mensajes`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ texto: 'Hola otra vez' })
        .expect(409);

      expect(respuesta.body.error.code).toBe('VENTANA_24H_CERRADA');
      expect(respuesta.body.error.details.requierePlantilla).toBe(true);
    });

    it('Y LA PLANTILLA SÍ PASA con la ventana cerrada', async () => {
      const id = await conversacionNuevaConEdad('wamid.E2E.VIEJO2', 48);

      const respuesta = await request(app.getHttpServer())
        .post(`${BANDEJA}/${id}/plantilla`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ plantilla: 'recordatorio_cita_24h', parametros: ['10:00 a.m.'] })
        .expect(201);

      expect(respuesta.body.wamid).toBeDefined();
    });

    it('400 al responder con texto vacío', async () => {
      const id = await conversacionNueva();
      await request(app.getHttpServer())
        .post(`${BANDEJA}/${id}/mensajes`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ texto: '' })
        .expect(400);
    });

    it('404 al responder en una conversación inexistente', async () => {
      await request(app.getHttpServer())
        .post(`${BANDEJA}/${randomUUID()}/mensajes`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ texto: 'Hola' })
        .expect(404);
    });
  });

  describe('handoff desde la bandeja', () => {
    const conversacionNueva = async (wamid: string) => {
      await enviarWebhook(payloadDeMensaje(wamid)).expect(200);
      const bandeja = await request(app.getHttpServer())
        .get(BANDEJA)
        .query({ sucursalId })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);
      return bandeja.body.conversaciones[0].id as string;
    };

    it('200 al escalar con motivo, y 200 al devolver al bot', async () => {
      const id = await conversacionNueva('wamid.E2E.HANDOFF');

      const escalada = await request(app.getHttpServer())
        .post(`${BANDEJA}/${id}/escalar`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ motivo: 'queja_o_reclamo' })
        .expect(200);
      expect(escalada.body).toMatchObject({ modo: 'humano', motivoDeEscalamiento: 'queja_o_reclamo' });

      const devuelta = await request(app.getHttpServer())
        .post(`${BANDEJA}/${id}/devolver-al-bot`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);
      expect(devuelta.body).toMatchObject({ modo: 'bot', motivoDeEscalamiento: null });
    });

    it('400 con un motivo de escalamiento que no existe', async () => {
      const id = await conversacionNueva('wamid.E2E.MOTIVO');
      await request(app.getHttpServer())
        .post(`${BANDEJA}/${id}/escalar`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ motivo: 'porque_me_apetece' })
        .expect(400);
    });

    it('409 al devolver al bot una conversación que ya lo lleva', async () => {
      const id = await conversacionNueva('wamid.E2E.YA_BOT');
      await request(app.getHttpServer()).post(`${BANDEJA}/${id}/devolver-al-bot`).set('Authorization', `Bearer ${encargada}`).expect(409);
    });
  });

  describe('RBAC de la bandeja', () => {
    it('403 PARA LA MANICURISTA EN TODAS LAS RUTAS', async () => {
      // Un hilo de WhatsApp contiene el teléfono de la clienta y lo que escribió: exactamente la
      // clase de dato que su vista de iPad está construida para no transportar (`DEC-040`).
      const servidor = app.getHttpServer();
      const falso = randomUUID();

      await request(servidor).get(BANDEJA).query({ sucursalId }).set('Authorization', `Bearer ${manicurista}`).expect(403);
      await request(servidor).get(`${BANDEJA}/${falso}`).set('Authorization', `Bearer ${manicurista}`).expect(403);
      await request(servidor).post(`${BANDEJA}/${falso}/mensajes`).set('Authorization', `Bearer ${manicurista}`).send({ texto: 'Hola' }).expect(403);
      await request(servidor)
        .post(`${BANDEJA}/${falso}/plantilla`)
        .set('Authorization', `Bearer ${manicurista}`)
        .send({ plantilla: 'x' })
        .expect(403);
      await request(servidor)
        .post(`${BANDEJA}/${falso}/escalar`)
        .set('Authorization', `Bearer ${manicurista}`)
        .send({ motivo: 'solicitud_humana' })
        .expect(403);
      await request(servidor).post(`${BANDEJA}/${falso}/devolver-al-bot`).set('Authorization', `Bearer ${manicurista}`).expect(403);
      await request(servidor)
        .post(`${BANDEJA}/numeros`)
        .set('Authorization', `Bearer ${manicurista}`)
        .send({ phoneNumberId: 'x', sucursalId, telefonoVisible: '4420000009' })
        .expect(403);
    });

    it('403 para la RECEPCIONISTA', async () => {
      await request(app.getHttpServer()).get(BANDEJA).query({ sucursalId }).set('Authorization', `Bearer ${recepcionista}`).expect(403);
    });

    it('403 PARA LA GERENTE al dar de alta un número: mapearlo mal desviaría conversaciones', async () => {
      await request(app.getHttpServer())
        .post(`${BANDEJA}/numeros`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ phoneNumberId: 'pn-otro', sucursalId, telefonoVisible: '4420000009' })
        .expect(403);
    });

    it('401 sin token', async () => {
      await request(app.getHttpServer()).get(BANDEJA).query({ sucursalId }).expect(401);
    });

    it('el webhook NO exige JWT: es público y se autentica por firma', async () => {
      await enviarWebhook(payloadDeMensaje('wamid.E2E.PUBLICO')).expect(200);
    });
  });
});
