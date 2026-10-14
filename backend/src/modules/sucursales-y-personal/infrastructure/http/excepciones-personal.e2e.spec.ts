import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { AgendaModule } from '../../../agenda/agenda.module';
import { SucursalesYPersonalModule } from '../../sucursales-y-personal.module';
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
import { Sucursal } from '../../domain/entities/sucursal.entity';
import { Manicurista } from '../../domain/entities/manicurista.entity';
import { DrizzleSucursalRepository } from '../persistence/drizzle-sucursal.repository';
import { DrizzleManicuristaRepository } from '../persistence/drizzle-manicurista.repository';
import { horarioAbiertoSiempre } from '../../../agenda/test-utils/contexto-personal-falso';
import { Servicio } from '../../../catalogo-y-cotizacion/domain/entities/servicio.entity';
import { DrizzleServicioRepository } from '../../../catalogo-y-cotizacion/infrastructure/persistence/drizzle-servicio.repository';
import { CatalogoYCotizacionModule } from '../../../catalogo-y-cotizacion/catalogo-y-cotizacion.module';

const SECRETO = 'secreto-e2e-excepciones';
const ISSUER = 'https://issuer-e2e.example/auth/v1';
const jwksNuncaLlamado = async () => {
  throw new Error('resolverClaveJwks no debería invocarse en este E2E (solo HS256)');
};

const permisosPorSub = new Map<string, PermisosUsuario>();
const permisosDePrueba: PermisosUsuarioPort = {
  obtenerPermisosPorSupabaseUserId: async (sub) => permisosPorSub.get(sub) ?? null,
};

function token(rol: Rol, sub: string) {
  permisosPorSub.set(sub, { rol, activa: true, sucursales: 'GLOBAL', manicuristaId: null });
  return jwt.sign({ iss: ISSUER, aud: 'authenticated', sub }, SECRETO);
}

const BASE = '/v1/sucursales-y-personal/excepciones';
const INICIO = '2026-12-07T00:00:00.000Z';
const FIN = '2026-12-08T00:00:00.000Z';
const CITA_INICIO = '2026-12-07T10:00:00.000Z';
const CITA_FIN = '2026-12-07T11:00:00.000Z';

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

describe('Personal — Excepciones E2E (HTTP) — DEC-036', () => {
  let app: INestApplication;
  let sucursalId: string;
  let otraSucursalId: string;
  let ana: Manicurista;
  let bea: Manicurista;
  let servicio: Servicio;
  let dueña: string;
  let encargada: string;
  let manicurista: string;
  let recepcionista: string;

  beforeAll(async () => {
    dbDePrueba = await crearBaseDeDatosDePrueba();

    const moduleRef = await Test.createTestingModule({
      imports: [TestInfraModule, AgendaModule, SucursalesYPersonalModule, CatalogoYCotizacionModule, IntegracionModule],
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
    await crearBaseDeDatosDePrueba();

    dueña = token(Rol.ADMINISTRADOR, 'dueña');
    encargada = token(Rol.GERENTE, 'encargada');
    manicurista = token(Rol.MANICURISTA, 'ana-usuaria');
    recepcionista = token(Rol.RECEPCIONISTA, 'recepcionista');

    servicio = Servicio.crear({ nombre: 'Gelish', categoria: 'aplicacion', duracionBaseMinutos: 60, precioBaseCentavos: 45000 });
    await new DrizzleServicioRepository(dbDePrueba).guardar(servicio);

    const sucursalRepo = new DrizzleSucursalRepository(dbDePrueba);
    const manicuristaRepo = new DrizzleManicuristaRepository(dbDePrueba);

    const lomas = Sucursal.crear({ nombre: 'Lomas', horarioSemanal: horarioAbiertoSiempre() });
    const juriquilla = Sucursal.crear({ nombre: 'Juriquilla', horarioSemanal: horarioAbiertoSiempre() });
    await sucursalRepo.guardar(lomas);
    await sucursalRepo.guardar(juriquilla);
    sucursalId = lomas.id;
    otraSucursalId = juriquilla.id;

    ana = Manicurista.crear({ nombre: 'Ana' });
    bea = Manicurista.crear({ nombre: 'Bea' });
    for (const m of [ana, bea]) {
      await manicuristaRepo.guardar(m);
      await manicuristaRepo.asignarASucursal(m.id, sucursalId);
    }

    for (const nombre of ['Lomas 1', 'Lomas 2']) {
      await request(app.getHttpServer())
        .post('/v1/agenda/sillas')
        .set('Authorization', `Bearer ${dueña}`)
        .send({ sucursalId, nombre })
        .expect(201);
    }
  });

  const agendarCita = (manicuristaId?: string) =>
    request(app.getHttpServer())
      .post('/v1/agenda/citas')
      .set('Authorization', `Bearer ${encargada}`)
      .send({
        sucursalId,
        servicioId: servicio.id,
        clientaId: randomUUID(),
        inicio: CITA_INICIO,
        ...(manicuristaId ? { manicuristaId } : {}),
      });

  const registrarAusencia = (cuerpo: Record<string, unknown> = {}, autorizacion = encargada) =>
    request(app.getHttpServer())
      .post(`${BASE}/ausencias`)
      .set('Authorization', `Bearer ${autorizacion}`)
      .send({ manicuristaId: ana.id, inicio: INICIO, fin: FIN, ...cuerpo });

  describe('ausencias', () => {
    it('201 y devuelve la excepción con `citasAfectadas` vacía cuando no hay daño', async () => {
      const respuesta = await registrarAusencia({ motivo: 'Cita médica' }).expect(201);

      expect(respuesta.body.excepcion).toMatchObject({ manicuristaId: ana.id, tipo: 'ausencia', sucursalId: null });
      // Presente aunque esté vacía: que nadie tenga que adivinar si "no vino" significa "sin daño".
      expect(respuesta.body.citasAfectadas).toEqual([]);
    });

    it('400 si el rango está invertido', async () => {
      await registrarAusencia({ inicio: FIN, fin: INICIO }).expect(400);
    });

    it('400 si la fecha no es ISO-8601', async () => {
      await registrarAusencia({ inicio: 'el lunes' }).expect(400);
    });

    it('404 si la manicurista no existe', async () => {
      await registrarAusencia({ manicuristaId: randomUUID() }).expect(404);
    });

    it('SE REGISTRA IGUAL aunque haya citas asignadas, y las reporta para reasignar', async () => {
      const { body: cita } = await agendarCita(ana.id).expect(201);

      const respuesta = await registrarAusencia().expect(201);

      expect(respuesta.body.citasAfectadas).toEqual([
        expect.objectContaining({ id: cita.id, motivo: 'manicurista_ausente' }),
      ]);
    });

    it('AVISA DE SOBRECUPO: 2 citas sin asignar y 2 manicuristas, quitar a una compromete la agenda', async () => {
      // Ninguna cita lleva el nombre de Ana. Una detección ingenua diría "cero afectadas" — y a
      // las 10:00 habría dos clientas y una sola persona para atenderlas.
      const { body: primera } = await agendarCita().expect(201);
      const { body: segunda } = await agendarCita().expect(201);

      const respuesta = await registrarAusencia().expect(201);

      expect(respuesta.body.citasAfectadas.map((c: { id: string }) => c.id).sort()).toEqual(
        [primera.id, segunda.id].sort(),
      );
      expect(respuesta.body.citasAfectadas.every((c: { motivo: string }) => c.motivo === 'sobrecupo_en_sucursal')).toBe(true);
    });
  });

  describe('coberturas', () => {
    it('201 y queda registrada contra la sucursal de destino', async () => {
      const respuesta = await request(app.getHttpServer())
        .post(`${BASE}/coberturas`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ manicuristaId: ana.id, sucursalId: otraSucursalId, inicio: INICIO, fin: FIN })
        .expect(201);

      expect(respuesta.body.excepcion).toMatchObject({ tipo: 'cobertura', sucursalId: otraSucursalId });
    });

    it('400 sin sucursal de destino: una cobertura sin destino restaría capacidad sin sumarla', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/coberturas`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ manicuristaId: ana.id, inicio: INICIO, fin: FIN })
        .expect(400);
    });

    it('404 si la sucursal de destino no existe', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/coberturas`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ manicuristaId: ana.id, sucursalId: randomUUID(), inicio: INICIO, fin: FIN })
        .expect(404);
    });

    it('LA COBERTURA ES UN MOVIMIENTO: sacar a Ana reduce la capacidad vendible de su sucursal', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/coberturas`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ manicuristaId: ana.id, sucursalId: otraSucursalId, inicio: INICIO, fin: FIN })
        .expect(201);

      const disponibilidad = await request(app.getHttpServer())
        .get('/v1/agenda/disponibilidad')
        .query({ sucursalId, inicio: CITA_INICIO, fin: CITA_FIN })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      // Siguen habiendo 2 sillas libres, pero solo queda Bea: `MIN(2, 1) = 1`.
      expect(disponibilidad.body).toMatchObject({ sillasLibres: 2, manicuristasDisponibles: 1, capacidad: 1 });

      await agendarCita().expect(201);
      // La silla 2 está físicamente vacía y aun así no cabe otra cita: no hay manos.
      await agendarCita().expect(409);
    });
  });

  describe('revocación', () => {
    it('204 y la capacidad vuelve sola', async () => {
      const { body } = await registrarAusencia().expect(201);

      await request(app.getHttpServer())
        .delete(`${BASE}/${body.excepcion.id}`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(204);

      const disponibilidad = await request(app.getHttpServer())
        .get('/v1/agenda/disponibilidad')
        .query({ sucursalId, inicio: CITA_INICIO, fin: CITA_FIN })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(disponibilidad.body.manicuristasDisponibles).toBe(2);
    });

    it('404 al revocar una excepción inexistente', async () => {
      await request(app.getHttpServer()).delete(`${BASE}/${randomUUID()}`).set('Authorization', `Bearer ${encargada}`).expect(404);
    });
  });

  describe('RBAC', () => {
    it('la ENCARGADA puede registrarlas: es quien está en el salón a las 8 de la mañana', async () => {
      await registrarAusencia({}, encargada).expect(201);
    });

    it('403 para la MANICURISTA: no se da de baja a sí misma del sistema', async () => {
      await registrarAusencia({}, manicurista).expect(403);
    });

    it('403 para la RECEPCIONISTA', async () => {
      await registrarAusencia({}, recepcionista).expect(403);
    });

    it('401 sin token', async () => {
      await request(app.getHttpServer()).post(`${BASE}/ausencias`).send({ manicuristaId: ana.id, inicio: INICIO, fin: FIN }).expect(401);
    });
  });

  it('audita el registro sin filtrar datos de la clienta (`RN-AUD-01`)', async () => {
    const clientaId = randomUUID();
    await request(app.getHttpServer())
      .post('/v1/agenda/citas')
      .set('Authorization', `Bearer ${encargada}`)
      .send({ sucursalId, servicioId: servicio.id, clientaId, inicio: CITA_INICIO, manicuristaId: ana.id })
      .expect(201);

    await registrarAusencia().expect(201);

    const filas = await dbDePrueba.execute(
      "SELECT detalle FROM auditoria.log_auditoria WHERE entidad_afectada_tipo = 'excepcion_personal'",
    );
    expect(filas.length).toBeGreaterThan(0);
    const detalle = JSON.stringify(filas);
    expect(detalle).toContain('registrar_ausencia');
    expect(detalle).not.toContain(clientaId);
  });
});
