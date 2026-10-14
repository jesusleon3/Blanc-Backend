import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { AgendaModule } from '../../agenda.module';
import { SucursalesYPersonalModule } from '../../../sucursales-y-personal/sucursales-y-personal.module';
import { IntegracionModule } from '../../../integracion/integracion.module';
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
import { Sucursal } from '../../../sucursales-y-personal/domain/entities/sucursal.entity';
import { Manicurista } from '../../../sucursales-y-personal/domain/entities/manicurista.entity';
import { DrizzleSucursalRepository } from '../../../sucursales-y-personal/infrastructure/persistence/drizzle-sucursal.repository';
import { DrizzleManicuristaRepository } from '../../../sucursales-y-personal/infrastructure/persistence/drizzle-manicurista.repository';
import { horarioAbiertoSiempre } from '../../test-utils/contexto-personal-falso';

const SECRETO = 'secreto-e2e-agenda';
const ISSUER = 'https://issuer-e2e.example/auth/v1';
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

const RUTA = '/v1/agenda/citas';
// `randomUUID` y no literales a mano: `@IsUUID()` exige variante válida (el cuarto grupo empieza
// en [89ab]), así que un `2222-...` escrito a ojo se rechaza con 400 y la prueba mediría el
// validador en vez del caso de uso.
const CLIENTA = randomUUID();
const SERVICIO = randomUUID();
const INICIO = '2026-12-07T10:00:00.000Z';
const FIN = '2026-12-07T11:00:00.000Z';
const INEXISTENTE = randomUUID();

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

describe('Agenda — Citas E2E (HTTP) — Fase 2', () => {
  let app: INestApplication;
  let sucursalId: string;
  let ana: Manicurista;
  let bea: Manicurista;

  /** Token con cada rol. `manicuristaAna` lleva su vínculo de `P9`. */
  let dueña: string;
  let encargada: string;
  let manicuristaAna: string;
  let manicuristaSinVinculo: string;
  let recepcionista: string;

  beforeAll(async () => {
    dbDePrueba = await crearBaseDeDatosDePrueba();

    const moduleRef = await Test.createTestingModule({
      // `IntegracionModule` es parte del montaje real: sin él no hay `CONTEXTO_PERSONAL_PORT` y el
      // motor de disponibilidad no arranca. Que este E2E lo exija es la prueba de que el cableado
      // entre Bounded Contexts funciona de verdad.
      imports: [TestInfraModule, AgendaModule, SucursalesYPersonalModule, IntegracionModule],
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
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    // Vacía las tablas y devuelve LA MISMA conexión, así que la app de Nest ya montada sigue
    // sirviendo. Cada prueba parte de cero: aquí la capacidad de la sucursal es el sujeto de
    // estudio, y una silla sobrante de la prueba anterior cambiaría el resultado en silencio.
    await crearBaseDeDatosDePrueba();

    // La sucursal, el personal y las sillas se vuelven a sembrar. Las sillas se crean **por la
    // API**, que es también su prueba de alta.
    const sucursalRepo = new DrizzleSucursalRepository(dbDePrueba);
    const manicuristaRepo = new DrizzleManicuristaRepository(dbDePrueba);

    dueña = token(Rol.ADMINISTRADOR, 'dueña');
    encargada = token(Rol.GERENTE, 'encargada');
    recepcionista = token(Rol.RECEPCIONISTA, 'recepcionista');

    const sucursal = Sucursal.crear({ nombre: 'Lomas', horarioSemanal: horarioAbiertoSiempre() });
    await sucursalRepo.guardar(sucursal);
    sucursalId = sucursal.id;

    ana = Manicurista.crear({ nombre: 'Ana' });
    bea = Manicurista.crear({ nombre: 'Bea' });
    for (const manicurista of [ana, bea]) {
      await manicuristaRepo.guardar(manicurista);
      await manicuristaRepo.asignarASucursal(manicurista.id, sucursalId);
    }

    manicuristaAna = token(Rol.MANICURISTA, 'ana', ana.id);
    manicuristaSinVinculo = token(Rol.MANICURISTA, 'sin-vinculo', null);

    for (const nombre of ['Lomas 1', 'Lomas 2']) {
      await request(app.getHttpServer())
        .post('/v1/agenda/sillas')
        .set('Authorization', `Bearer ${dueña}`)
        .send({ sucursalId, nombre })
        .expect(201);
    }
  });

  // Sin `async`: devuelve el `Test` de supertest para poder seguir encadenando `.expect(...)`.
  const agendar = (extra: Record<string, unknown> = {}, autorizacion = encargada) =>
    request(app.getHttpServer())
      .post(RUTA)
      .set('Authorization', `Bearer ${autorizacion}`)
      .send({ sucursalId, servicioId: SERVICIO, clientaId: CLIENTA, inicio: INICIO, fin: FIN, ...extra });

  describe('alta de citas', () => {
    it('201 y elige silla sola: la clienta nunca eligió silla', async () => {
      const respuesta = await agendar().expect(201);

      expect(respuesta.body).toMatchObject({ estado: 'agendada', sucursalId, manicuristaId: null });
      expect(respuesta.body.sillaId).toBeDefined();
    });

    it('400 si falta un campo obligatorio', async () => {
      await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ sucursalId, servicioId: SERVICIO, inicio: INICIO, fin: FIN })
        .expect(400);
    });

    it('400 si la fecha no es ISO-8601 con zona', async () => {
      await agendar({ inicio: '7 de diciembre a las 10' }).expect(400);
    });

    it('400 ante un campo no declarado: el DTO no es un buzón abierto', async () => {
      await agendar({ precioInventado: 1 }).expect(400);
    });

    it('409 cuando la sucursal se llena: 2 sillas, la tercera simultánea no cabe', async () => {
      await agendar().expect(201);
      await agendar().expect(201);

      const respuesta = await agendar().expect(409);
      expect(respuesta.body.error.code).toBe('HORARIO_NO_DISPONIBLE');
    });

    it('403 si la pide una RECEPCIONISTA: agendar no es su rol en esta API', async () => {
      await agendar({}, recepcionista).expect(403);
    });
  });

  describe('ciclo de vida', () => {
    it('200 al confirmar y 409 al confirmar dos veces (transición ilegal)', async () => {
      const { body: cita } = await agendar().expect(201);
      const ruta = `${RUTA}/${cita.id}/confirmar`;

      // `agendada -> confirmada` NO es legal: la confirmación se pide primero (`DEC-034`). La cita
      // pasa por `pendiente_confirmacion` y solo desde ahí se confirma.
      const solicitada = await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/solicitar-confirmacion`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);
      expect(solicitada.body.estado).toBe('pendiente_confirmacion');

      const confirmada = await request(app.getHttpServer()).post(ruta).set('Authorization', `Bearer ${encargada}`).expect(200);
      expect(confirmada.body.estado).toBe('confirmada');

      const repetida = await request(app.getHttpServer()).post(ruta).set('Authorization', `Bearer ${encargada}`).expect(409);
      expect(repetida.body.error.code).toBe('TRANSICION_ESTADO_INVALIDA');
    });

    it('409 al confirmar una cita recién agendada: hay que solicitar la confirmación primero', async () => {
      const { body: cita } = await agendar().expect(201);

      const respuesta = await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/confirmar`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(409);

      expect(respuesta.body.error.code).toBe('TRANSICION_ESTADO_INVALIDA');
    });

    it('404 al operar sobre una cita que no existe', async () => {
      await request(app.getHttpServer())
        .post(`${RUTA}/${INEXISTENTE}/confirmar`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(404);
    });

    it('200 al completar, y el cuerpo refleja el estado final', async () => {
      const { body: cita } = await agendar().expect(201);

      const respuesta = await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/completar`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(respuesta.body.estado).toBe('completada');
    });

    it('cancelar devuelve `incidenteTardio` (`RN-CRM-06`) sin marcar lista roja', async () => {
      const { body: cita } = await agendar().expect(201);

      const respuesta = await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/cancelar`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ motivo: 'La clienta avisó' })
        .expect(200);

      expect(respuesta.body).toHaveProperty('incidenteTardio');
      expect(respuesta.body.cita.estado).toBe('cancelada');
    });
  });

  describe('RBAC de la vista de iPad (`DEC-040`)', () => {
    it('la MANICURISTA SOLO VE SUS PROPIAS CITAS, aunque la sucursal tenga más', async () => {
      const { body: suya } = await agendar({ manicuristaId: ana.id }).expect(201);
      await agendar({ manicuristaId: bea.id }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .expect(200);

      expect(respuesta.body.citas).toHaveLength(1);
      expect(respuesta.body.citas[0].id).toBe(suya.id);
    });

    it('el filtro NO se toma de la query: pedir la agenda de otra no la devuelve', async () => {
      await agendar({ manicuristaId: bea.id }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        // Intento explícito de leer la agenda ajena pasando el id de Bea.
        .query({ sucursalId, inicio: INICIO, fin: FIN, manicuristaId: bea.id })
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .expect(200);

      expect(respuesta.body.citas).toEqual([]);
    });

    it('SU DTO NO LLEVA DATOS DE LA CLIENTA, pero sí precios', async () => {
      await agendar({ manicuristaId: ana.id }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .expect(200);

      const cita = respuesta.body.citas[0];
      // `clientaId` es la llave por la que se consultaría el historial y la clasificación de la
      // clienta — incluida la lista roja. No viaja al iPad.
      expect(cita).not.toHaveProperty('clientaId');
      expect(cita).not.toHaveProperty('numeroDeReprogramaciones');
      // Precios sí: la Dueña fue explícita.
      expect(cita).toHaveProperty('cotizacionSnapshot');
      expect(JSON.stringify(cita)).not.toContain(CLIENTA);
    });

    it('una MANICURISTA sin vínculo `manicuristaId` no ve NADA (lado seguro del error)', async () => {
      await agendar({ manicuristaId: ana.id }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${manicuristaSinVinculo}`)
        .expect(200);

      expect(respuesta.body.citas).toEqual([]);
    });

    it('403 AL CANCELAR: la vista de iPad es estrictamente de solo lectura', async () => {
      const { body: cita } = await agendar({ manicuristaId: ana.id }).expect(201);

      await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/cancelar`)
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .send({ motivo: 'No quiero atenderla' })
        .expect(403);
    });

    it('403 AL COMPLETAR: la manicurista no marca finalización (`DEC-040`)', async () => {
      const { body: cita } = await agendar({ manicuristaId: ana.id }).expect(201);

      await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/completar`)
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .expect(403);
    });

    it('403 al agendar, al reprogramar y al marcar no-show', async () => {
      const { body: cita } = await agendar({ manicuristaId: ana.id }).expect(201);
      const servidor = app.getHttpServer();

      await agendar({}, manicuristaAna).expect(403);
      await request(servidor)
        .post(`${RUTA}/${cita.id}/reprogramar`)
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .send({ inicio: '2026-12-08T10:00:00.000Z', fin: '2026-12-08T11:00:00.000Z' })
        .expect(403);
      await request(servidor).post(`${RUTA}/${cita.id}/no-show`).set('Authorization', `Bearer ${manicuristaAna}`).expect(403);
    });

    it('403 al dar de alta una silla: no amplía la capacidad del salón', async () => {
      await request(app.getHttpServer())
        .post('/v1/agenda/sillas')
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .send({ sucursalId, nombre: 'Silla pirata' })
        .expect(403);
    });

    it('401 sin token', async () => {
      await request(app.getHttpServer()).get(RUTA).query({ sucursalId, inicio: INICIO, fin: FIN }).expect(401);
    });
  });

  describe('sillas y disponibilidad', () => {
    it('200 y lista las sillas de la sucursal', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/v1/agenda/sillas')
        .query({ sucursalId })
        .set('Authorization', `Bearer ${dueña}`)
        .expect(200);

      expect(respuesta.body.sillas).toHaveLength(2);
      expect(respuesta.body.sillas.every((s: { activa: boolean }) => s.activa)).toBe(true);
    });

    it('DESACTIVAR UNA SILLA REDUCE LA CAPACIDAD VENDIBLE, no solo cambia una bandera', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/v1/agenda/sillas')
        .query({ sucursalId })
        .set('Authorization', `Bearer ${dueña}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/v1/agenda/sillas/${body.sillas[0].id}/desactivar`)
        .set('Authorization', `Bearer ${dueña}`)
        .expect(200);

      await agendar().expect(201);
      // Con una sola silla activa, la segunda simultánea ya no cabe.
      await agendar().expect(409);
    });

    it('404 al desactivar una silla inexistente', async () => {
      await request(app.getHttpServer())
        .post(`/v1/agenda/sillas/${INEXISTENTE}/desactivar`)
        .set('Authorization', `Bearer ${dueña}`)
        .expect(404);
    });

    it('la disponibilidad cruza sillas contra personal: 2 sillas y 2 manicuristas dan capacidad 2', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/v1/agenda/disponibilidad')
        .query({ sucursalId, inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(respuesta.body).toMatchObject({ sillasLibres: 2, manicuristasDisponibles: 2, capacidad: 2, hayLugar: true });
    });
  });
});
