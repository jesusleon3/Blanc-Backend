import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { createHmac, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { json } from 'express';

import { AgenteModule } from '../agente/agente.module';
import { ConversacionesModule } from '../conversaciones/conversaciones.module';
import { AgendaModule } from '../agenda/agenda.module';
import { SucursalesYPersonalModule } from '../sucursales-y-personal/sucursales-y-personal.module';
import { CatalogoYCotizacionModule } from '../catalogo-y-cotizacion/catalogo-y-cotizacion.module';
import { CrmYClientasModule } from '../crm-y-clientas/crm-y-clientas.module';
import { AnticiposModule } from '../anticipos/anticipos.module';
import { IntegracionModule } from '../integracion/integracion.module';

import { TOKEN_VERIFICACION_META } from '../conversaciones/infrastructure/meta/webhook-meta.controller';
import { VerificadorDeFirmaMeta } from '../conversaciones/infrastructure/meta/verificador-de-firma';
import { DrizzleConversacionRepository } from '../conversaciones/infrastructure/persistence/drizzle-conversacion.repository';

import { Sucursal } from '../sucursales-y-personal/domain/entities/sucursal.entity';
import { Manicurista } from '../sucursales-y-personal/domain/entities/manicurista.entity';
import { DrizzleSucursalRepository } from '../sucursales-y-personal/infrastructure/persistence/drizzle-sucursal.repository';
import { DrizzleManicuristaRepository } from '../sucursales-y-personal/infrastructure/persistence/drizzle-manicurista.repository';
import { horarioAbiertoSiempre } from '../agenda/test-utils/contexto-personal-falso';
import { Servicio } from '../catalogo-y-cotizacion/domain/entities/servicio.entity';
import { DrizzleServicioRepository } from '../catalogo-y-cotizacion/infrastructure/persistence/drizzle-servicio.repository';
import { Clienta } from '../crm-y-clientas/domain/entities/clienta.entity';
import { DrizzleClientaRepository } from '../crm-y-clientas/infrastructure/persistence/drizzle-clienta.repository';
import { DrizzleCitaRepository } from '../agenda/infrastructure/persistence/drizzle-cita.repository';
import { SolicitarRecordatoriosUseCase } from '../agenda/application/use-cases/barridos-de-agenda.use-cases';

import { DATABASE_CONNECTION } from '../../database/database.module';
import { Database } from '../../database/connection';
import { AUDITORIA_PORT } from '../../shared/auditoria/auditoria.port';
import { DrizzleAuditoriaRepository } from '../../shared/auditoria/drizzle-auditoria.repository';
import { UNIT_OF_WORK } from '../../shared/persistence/unit-of-work.port';
import { DrizzleUnitOfWork } from '../../shared/persistence/drizzle-unit-of-work';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { AuthorizationGuard } from '../../shared/auth/authorization.guard';
import { PermisosUsuario, PermisosUsuarioPort } from '../../shared/auth/permisos-usuario.port';
import { RolesGuard } from '../../shared/auth/roles.guard';
import { Rol } from '../../shared/auth/rol';
import { HttpExceptionFilter } from '../../shared/errors/http-exception.filter';
import { crearBaseDeDatosDePrueba } from '../../database/test-utils/postgres-de-prueba';
import { fechaLocal } from '../../shared/tiempo/zona-horaria-negocio';

const SECRETO = 'secreto-e2e-bot';
const ISSUER = 'https://issuer-e2e.example/auth/v1';
const APP_SECRET = 'app-secret-de-prueba-bot';
const VERIFY_TOKEN = 'token-de-verificacion-bot';
const jwksNuncaLlamado = async () => {
  throw new Error('resolverClaveJwks no debería invocarse en este E2E (solo HS256)');
};

const permisosPorSub = new Map<string, PermisosUsuario>();
const permisosDePrueba: PermisosUsuarioPort = {
  obtenerPermisosPorSupabaseUserId: async (sub) => permisosPorSub.get(sub) ?? null,
};

function token(rol: Rol, sub: string, manicuristaId: string | null = null) {
  permisosPorSub.set(sub, { rol, activa: true, sucursales: 'GLOBAL', manicuristaId });
  return jwt.sign({ iss: ISSUER, aud: 'authenticated', sub }, SECRETO);
}

const WEBHOOK = '/v1/webhooks/meta';
const BANDEJA = '/v1/conversaciones';
const NUMERO = 'pn-e2e-bot';
const TELEFONO_META = '5214421112233';
const TELEFONO = '4421112233';

let dbDePrueba: Database;

@Global()
@Module({
  providers: [
    { provide: DATABASE_CONNECTION, useFactory: () => dbDePrueba },
    { provide: AUDITORIA_PORT, useClass: DrizzleAuditoriaRepository },
    { provide: UNIT_OF_WORK, useClass: DrizzleUnitOfWork },
  ],
  exports: [DATABASE_CONNECTION, AUDITORIA_PORT, UNIT_OF_WORK],
})
class TestInfraModule {}

/**
 * **El flujo completo, de extremo a extremo: webhook de Meta → bot → PostgreSQL.**
 *
 * ## POR QUÉ SE MONTA EL GRAFO DE MÓDULOS REAL Y COMPLETO
 *
 * Siete módulos de negocio más `IntegracionModule` y `AgenteModule`, en el **mismo orden que
 * `AppModule`**. No es exceso de celo: el bot funciona solo si tres sobrescrituras de `@Global`
 * ocurren en el orden correcto —`IntegracionModule` sobre los puertos cruzados, `AgenteModule`
 * sobre `ORQUESTADOR_DE_BOT_PORT`— y **ninguna prueba unitaria puede ver eso**. Montar menos
 * módulos dejaría pasar el fallo más probable de toda esta parte: que el bot quede inerte en
 * producción porque el adaptador por defecto nunca se sustituyó, con todas las pruebas en verde.
 *
 * La prueba de que esto importa: si se quita `AgenteModule` de los `imports`, el canal sigue
 * funcionando y **solo fallan las pruebas de este archivo** — que es exactamente el plan de
 * rollback documentado.
 */
describe('Bot IA — flujo completo E2E (webhook de Meta → bot → PostgreSQL)', () => {
  let app: INestApplication;
  let sucursalId: string;
  let servicio: Servicio;
  let clienta: Clienta;
  let dueña: string;
  let encargada: string;
  let manicurista: string;

  const firmar = (cuerpo: unknown) => `sha256=${createHmac('sha256', APP_SECRET).update(JSON.stringify(cuerpo)).digest('hex')}`;

  /** Segundos, como Meta, y relativo al reloj real: la ventana de 24 h se mide contra `Date.now()`. */
  const ahoraEnSegundos = () => String(Math.floor(Date.now() / 1000));

  const payload = (wamid: string, texto: string, extra: Record<string, unknown> = {}) => ({
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: NUMERO },
              messages: [
                {
                  id: wamid,
                  from: TELEFONO_META,
                  timestamp: ahoraEnSegundos(),
                  type: 'text',
                  text: { body: texto },
                  ...extra,
                },
              ],
            },
          },
        ],
      },
    ],
  });

  /** Un mensaje entrante, firmado como lo firmaría Meta. */
  const escribe = async (texto: string, extra: Record<string, unknown> = {}) => {
    const cuerpo = payload(`wamid.${randomUUID()}`, texto, extra);
    await request(app.getHttpServer())
      .post(WEBHOOK)
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', firmar(cuerpo))
      .send(JSON.stringify(cuerpo))
      .expect(200);
  };

  const conversacion = async () => {
    const repo = new DrizzleConversacionRepository(dbDePrueba);
    const encontrada = await repo.buscarPorSucursalYTelefono(sucursalId, TELEFONO);
    if (!encontrada) throw new Error('La conversación no existe.');
    return encontrada;
  };

  /** El hilo tal como lo vería la Encargada en la Bandeja Compartida. */
  const hilo = async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`${BANDEJA}/${(await conversacion()).id}`)
      .set('Authorization', `Bearer ${encargada}`)
      .expect(200);
    return respuesta.body as {
      conversacion: { modo: string; motivoDeEscalamiento: string | null; mensajesSinResponder: number };
      mensajes: { direccion: string; emisor: string; contenido: string | null }[];
    };
  };

  const salientesDelBot = async () =>
    (await hilo()).mensajes.filter((mensaje) => mensaje.direccion === 'saliente' && mensaje.emisor === 'bot');

  beforeAll(async () => {
    dbDePrueba = await crearBaseDeDatosDePrueba();

    const moduleRef = await Test.createTestingModule({
      // **El orden es el de `AppModule` y es significativo**: `IntegracionModule` tras los BC,
      // `AgenteModule` tras `ConversacionesModule`. Ver la nota de la cabecera.
      imports: [
        TestInfraModule,
        SucursalesYPersonalModule,
        CatalogoYCotizacionModule,
        AgendaModule,
        CrmYClientasModule,
        AnticiposModule,
        ConversacionesModule,
        IntegracionModule,
        AgenteModule,
      ],
      providers: [
        {
          provide: APP_GUARD,
          useFactory: (reflector: Reflector) => new JwtAuthGuard(SECRETO, reflector, ISSUER, jwksNuncaLlamado),
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
    // El mismo captador de cuerpo crudo que `main.ts`: sin él no hay `rawBody` y el webhook
    // rechaza todo por firma inválida, de modo que la prueba pasaría por el camino equivocado.
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
    // Una sola vez: ver la nota extensa en `citas.e2e.spec.ts`. Sin esto, supertest abre y cierra
    // el servidor en cada petición y aparece el `401`/`ECONNRESET` intermitente.
    await app.listen(0);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await crearBaseDeDatosDePrueba();

    dueña = token(Rol.ADMINISTRADOR, 'dueña');
    encargada = token(Rol.GERENTE, 'encargada');
    manicurista = token(Rol.MANICURISTA, 'ana-iPad', randomUUID());

    const sucursal = Sucursal.crear({ nombre: 'Lomas', horarioSemanal: horarioAbiertoSiempre() });
    await new DrizzleSucursalRepository(dbDePrueba).guardar(sucursal);
    sucursalId = sucursal.id;

    const manicuristaRepo = new DrizzleManicuristaRepository(dbDePrueba);
    for (const nombre of ['Ana', 'Bea']) {
      const registro = Manicurista.crear({ nombre });
      await manicuristaRepo.guardar(registro);
      await manicuristaRepo.asignarASucursal(registro.id, sucursalId);
    }

    servicio = Servicio.crear({ codigo: 'GEL', nombre: 'Gel', categoria: 'Servicios individuales', duracionBaseMinutos: 60, precioBaseCentavos: 45000 });
    await new DrizzleServicioRepository(dbDePrueba).guardar(servicio);

    clienta = Clienta.registrar({ nombre: 'Andrea Ramírez', telefono: TELEFONO });
    await new DrizzleClientaRepository(dbDePrueba).guardar(clienta);

    // El número de la sucursal, por la API: es también la prueba de su alta.
    await request(app.getHttpServer())
      .post(`${BANDEJA}/numeros`)
      .set('Authorization', `Bearer ${dueña}`)
      .send({ phoneNumberId: NUMERO, sucursalId, telefonoVisible: '4420000001' })
      .expect(201);

    for (const nombre of ['Lomas 1', 'Lomas 2']) {
      await request(app.getHttpServer())
        .post('/v1/agenda/sillas')
        .set('Authorization', `Bearer ${dueña}`)
        .send({ sucursalId, nombre })
        .expect(201);
    }
  });

  describe('EL BOT ESTÁ CABLEADO: `AgenteModule` sobrescribe el orquestador inerte', () => {
    it('un mensaje entrante recibe RESPUESTA DEL BOT, visible en el hilo de la Bandeja', async () => {
      // Con el adaptador inerte (el valor por defecto de `ConversacionesModule`) no habría ningún
      // saliente de `emisor: 'bot'`. Esta aserción es, literalmente, la prueba del cableado.
      await escribe('Hola');

      const delBot = await salientesDelBot();
      expect(delBot).toHaveLength(1);
      expect((await hilo()).conversacion.modo).toBe('bot');
    });
  });

  describe('CONSULTA DE DISPONIBILIDAD por webhook, con datos reales de PostgreSQL', () => {
    it('responde con el catálogo REAL cuando la clienta pregunta precios', async () => {
      await escribe('Hola, me pasas los precios?');

      const [respuesta] = await salientesDelBot();
      // $450.00 y 60 min salen de la fila de `catalogo.servicios` sembrada arriba.
      expect(respuesta.contenido).toContain('Gel');
      expect(respuesta.contenido).toContain('$450.00');
      expect(respuesta.contenido).toContain('60 min');
    });

    it('consulta la disponibilidad real y responde que SÍ hay lugar', async () => {
      const manana = fechaLocal(new Date(Date.now() + 86_400_000));

      await escribe(`tienes lugar el ${manana} a las 13:00?`);

      expect((await salientesDelBot())[0].contenido).toContain('Sí tengo lugar');
    });
  });

  describe('AGENDA UNA CITA REAL EN LA BASE desde un mensaje de WhatsApp', () => {
    it('la cita queda en `agenda.citas` y aparece en la API de agenda', async () => {
      const manana = fechaLocal(new Date(Date.now() + 86_400_000));

      await escribe(`quiero cita de gel el ${manana} a las 13:00`);

      // (1) En la base, por el repositorio.
      const citas = await new DrizzleCitaRepository(dbDePrueba).listarParaConsulta(
        sucursalId,
        { inicio: new Date(`${manana}T00:00:00-06:00`), fin: new Date(`${manana}T23:59:00-06:00`) },
        { limite: 50, desplazamiento: 0 },
      );
      expect(citas).toHaveLength(1);
      expect(citas[0].clientaId).toBe(clienta.id);
      expect(citas[0].servicioId).toBe(servicio.id);
      expect(citas[0].estado).toBe('agendada');
      // Hora de pared de Querétaro: 13:00 local = 19:00 UTC. Es el error silencioso más probable.
      expect(citas[0].rangoHorario.inicio.toISOString()).toBe(new Date(`${manana}T13:00:00-06:00`).toISOString());
      // La silla la eligió el motor, no la clienta ni el bot.
      expect(citas[0].sillaId).not.toBeNull();

      // (2) Y por la API HTTP, que es lo que verá el panel de la Encargada.
      const agenda = await request(app.getHttpServer())
        .get('/v1/agenda/citas')
        .query({
          sucursalId,
          inicio: new Date(`${manana}T00:00:00-06:00`).toISOString(),
          fin: new Date(`${manana}T23:59:00-06:00`).toISOString(),
        })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);
      expect(agenda.body.citas).toHaveLength(1);

      // (3) Y la clienta recibió la confirmación en el hilo.
      expect((await salientesDelBot())[0].contenido).toContain('Gel');
    });
  });

  describe('ESCALAMIENTO AUTOMÁTICO a `humano`', () => {
    it('cuando la clienta pide CANCELAR: `cancelacion_solicitada`', async () => {
      await escribe('hola, necesito cancelar mi cita');

      const estado = (await hilo()).conversacion;
      expect(estado.modo).toBe('humano');
      expect(estado.motivoDeEscalamiento).toBe('cancelacion_solicitada');
    });

    it('cuando la clienta pide HABLAR CON UNA PERSONA: `solicitud_humana`', async () => {
      await escribe('quiero hablar con una persona');

      expect((await hilo()).conversacion.motivoDeEscalamiento).toBe('solicitud_humana');
    });

    it('la conversación escalada APARECE en el contador de pendientes, con su sucursal', async () => {
      await escribe('necesito cancelar mi cita');

      const respuesta = await request(app.getHttpServer())
        .get(`${BANDEJA}/escaladas/pendientes`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      // **El acuse del bot NO la borró del contador.** Antes de distinguir acuse de respuesta,
      // este número era 0 y nadie se enteraba de que había una conversación esperando.
      expect(respuesta.body.total).toBe(1);
      expect(respuesta.body.porSucursal).toEqual([{ sucursalId, total: 1 }]);
      expect(respuesta.body.masAntiguaEn).not.toBeNull();
    });

    it('el contador NO cuenta una conversación que una persona YA RESPONDIÓ', async () => {
      await escribe('necesito cancelar mi cita');
      const id = (await conversacion()).id;

      await request(app.getHttpServer())
        .post(`${BANDEJA}/${id}/mensajes`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ texto: 'Claro Andrea, ya la cancelo. ¿Te reagendo?' })
        .expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(`${BANDEJA}/escaladas/pendientes`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      // Sigue en modo `humano` (`RN-ESC-03`), pero ya no está *sin atender*: los dos términos del
      // criterio importan. Sin el segundo, contaría para siempre.
      expect((await hilo()).conversacion.modo).toBe('humano');
      expect(respuesta.body.total).toBe(0);
    });

    it('la MANICURISTA recibe 403 en el contador: revela actividad de clientas', async () => {
      await request(app.getHttpServer())
        .get(`${BANDEJA}/escaladas/pendientes`)
        .set('Authorization', `Bearer ${manicurista}`)
        .expect(403);
    });
  });

  describe('SILENCIO ABSOLUTO del bot si la conversación ya está en `humano` (`RN-ESC-03`)', () => {
    it('tras tomarla una persona, un mensaje que el bot SABRÍA contestar no recibe respuesta suya', async () => {
      await escribe('Hola');
      expect(await salientesDelBot()).toHaveLength(1);

      // Una persona la toma desde la bandeja.
      await request(app.getHttpServer())
        .post(`${BANDEJA}/${(await conversacion()).id}/escalar`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ motivo: 'intervencion_manual' })
        .expect(200);

      await escribe('me pasas los precios?');

      // Habría sido trivial responder: "precios" es una intención que el bot atiende sin problema.
      // Que no lo haga ES la regla.
      expect(await salientesDelBot()).toHaveLength(1);
      const resultado = await hilo();
      expect(resultado.conversacion.modo).toBe('humano');
      // Pero el mensaje no se perdió: está en el hilo, esperando a una persona.
      expect(resultado.mensajes.some((mensaje) => mensaje.contenido === 'me pasas los precios?')).toBe(true);
    });
  });

  describe('CONFIRMACIÓN DE CITA desde `pendiente_confirmacion` por WhatsApp', () => {
    it('un "sí" confirma la cita que el recordatorio dejó pendiente', async () => {
      const manana = fechaLocal(new Date(Date.now() + 86_400_000));
      const citaRepo = new DrizzleCitaRepository(dbDePrueba);

      // La cita se agenda por la API, como la agendaría la Encargada.
      const creada = await request(app.getHttpServer())
        .post('/v1/agenda/citas')
        .set('Authorization', `Bearer ${encargada}`)
        .send({
          sucursalId,
          servicioId: servicio.id,
          clientaId: clienta.id,
          inicio: new Date(`${manana}T15:00:00-06:00`).toISOString(),
        })
        .expect(201);

      // Y el barrido REAL de recordatorios la deja en `pendiente_confirmacion` (`ADR-025`). Se
      // resuelve del contenedor en vez de llamar al endpoint del planificador porque este grafo no
      // monta `PlanificadorModule`: el caso de uso es el mismo que invoca el cron, y es el sujeto.
      await app
        .get(SolicitarRecordatoriosUseCase)
        .ejecutar({ sub: 'sistema:planificador', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL', manicuristaId: null }, new Date(), {
          // La cita es de mañana a las 15:00 locales, así que hace falta una ventana más ancha que
          // las 24 h por defecto para que el barrido la vea.
          horasDeAntelacion: 48,
        });

      expect((await citaRepo.buscarPorId(creada.body.id))!.estado).toBe('pendiente_confirmacion');

      await escribe('sí');

      expect((await citaRepo.buscarPorId(creada.body.id))!.estado).toBe('confirmada');
      expect((await hilo()).conversacion.modo).toBe('bot');
    });
  });

  describe('UN RECORDATORIO SALIENTE NO BORRA `mensajesSinResponder`', () => {
    it('EL BARRIDO REAL de recordatorios sale por WhatsApp y deja el contador intacto', async () => {
      /**
       * Esta prueba vale por dos, y la segunda mitad no estaba planeada.
       *
       * 1. **El recordatorio sale de verdad por el canal.** `IntegracionModule` provee
       *    `NOTIFICADOR_RECORDATORIO_PORT` con el adaptador que manda plantillas de WhatsApp. Antes
       *    del cierre de Fase 4 esa sustitución **no surtía efecto** —`AgendaModule` declaraba su
       *    propio adaptador de solo-log y un proveedor local gana sobre uno `@Global`—, así que el
       *    barrido escribía en el log y nada más. Que aquí aparezca un saliente de tipo
       *    `plantilla` en el hilo es la verificación de esa corrección.
       * 2. **Y no limpia el contador**, que es lo que la orden pide comprobar.
       */
      // La clienta escribe dos veces y nadie contesta.
      await escribe('tengo una duda rarisima que nadie entiende xyzzy');
      await escribe('hola? sigo aqui');

      const pendientesAntes = (await hilo()).conversacion.mensajesSinResponder;
      expect(pendientesAntes).toBeGreaterThan(0);

      // Una cita dentro de la ventana de 24 h del barrido.
      await request(app.getHttpServer())
        .post('/v1/agenda/citas')
        .set('Authorization', `Bearer ${encargada}`)
        .send({
          sucursalId,
          servicioId: servicio.id,
          clientaId: clienta.id,
          inicio: new Date(Date.now() + 10 * 3_600_000).toISOString(),
        })
        .expect(201);

      // **El barrido real**, resuelto del contenedor: el mismo caso de uso que invoca el cron.
      const barrido = app.get(SolicitarRecordatoriosUseCase);
      const resumen = await barrido.ejecutar(
        { sub: 'sistema:planificador', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL', manicuristaId: null },
        new Date(),
      );
      expect(resumen.procesados).toBe(1);
      expect(resumen.fallidos).toBe(0);

      const resultado = await hilo();

      // (1) La plantilla salió por el canal, con `emisor: 'sistema'` y no `humano`.
      const plantillas = resultado.mensajes.filter((mensaje) => mensaje.direccion === 'saliente' && mensaje.emisor === 'sistema');
      expect(plantillas).toHaveLength(1);

      // (2) El contador no se movió. Si un recordatorio lo limpiara, la conversación saldría de la
      // cola de pendientes por un mensaje automático y los dos mensajes de la clienta se quedarían
      // sin leer — nadie volvería a mirarla.
      expect(resultado.conversacion.mensajesSinResponder).toBe(pendientesAntes);
    });

    it('una RESPUESTA HUMANA sí pone el contador a cero: es el contraste', async () => {
      await escribe('tengo una duda rarisima que nadie entiende xyzzy');
      expect((await hilo()).conversacion.mensajesSinResponder).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .post(`${BANDEJA}/${(await conversacion()).id}/mensajes`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ texto: 'Perdona la demora Andrea, cuéntame.' })
        .expect(201);

      expect((await hilo()).conversacion.mensajesSinResponder).toBe(0);
    });
  });
});
