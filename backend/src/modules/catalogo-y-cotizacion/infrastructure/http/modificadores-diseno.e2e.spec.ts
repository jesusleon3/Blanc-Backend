import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { CatalogoYCotizacionModule } from '../../catalogo-y-cotizacion.module';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
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
import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/pg-mem-database';

const SECRETO = 'secreto-e2e-modificadores';
const ISSUER = 'https://issuer-e2e.example/auth/v1';
const jwksNuncaLlamado = async () => {
  throw new Error('resolverClaveJwks no debería invocarse en este E2E (solo HS256)');
};

const permisosPorSub = new Map<string, PermisosUsuario>();

const permisosDePrueba: PermisosUsuarioPort = {
  obtenerPermisosPorSupabaseUserId: async (sub) => permisosPorSub.get(sub) ?? null,
};

function token(rol: Rol, sub = 'test-user') {
  permisosPorSub.set(sub, { rol, activa: true, sucursales: 'GLOBAL' });
  return jwt.sign({ iss: ISSUER, aud: 'authenticated', sub }, SECRETO);
}

const RUTA = '/v1/catalogo-y-cotizacion/modificadores-diseno';
const MODIFICADOR_VALIDO = { nombre: 'Diseño francés', minutosAdicionales: 15, precioAdicionalCentavos: 8000 };

@Global()
@Module({
  providers: [
    { provide: DATABASE_CONNECTION, useValue: crearBaseDeDatosDePrueba() },
    { provide: AUDITORIA_PORT, useClass: DrizzleAuditoriaRepository },
    { provide: UNIT_OF_WORK, useClass: DrizzleUnitOfWork },
  ],
  exports: [DATABASE_CONNECTION, AUDITORIA_PORT, UNIT_OF_WORK],
})
class TestInfraModule {}

describe('Catálogo — Modificadores de Diseño E2E (HTTP) — FL-COT-01', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestInfraModule, CatalogoYCotizacionModule],
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
    await app.close();
  });

  describe('RBAC', () => {
    it('rechaza crear sin token (401)', async () => {
      await request(app.getHttpServer()).post(RUTA).send(MODIFICADOR_VALIDO).expect(401);
    });

    it('rechaza listar sin token (401)', async () => {
      await request(app.getHttpServer()).get(RUTA).expect(401);
    });

    it.each([
      ['Gerente', Rol.GERENTE],
      ['Recepcionista', Rol.RECEPCIONISTA],
    ])('rechaza que un %s cree un modificador (403 — nivel 1)', async (_caso, rol) => {
      await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', `Bearer ${token(rol, `sub-post-${rol}`)}`)
        .send(MODIFICADOR_VALIDO)
        .expect(403);
    });

    it.each([
      ['Super Admin', Rol.SUPER_ADMIN],
      ['Administrador', Rol.ADMINISTRADOR],
    ])('permite a un %s crear y listar', async (_caso, rol) => {
      const server = app.getHttpServer();
      const autorizacion = `Bearer ${token(rol, `sub-ok-${rol}`)}`;

      await request(server).post(RUTA).set('Authorization', autorizacion).send(MODIFICADOR_VALIDO).expect(201);
      await request(server).get(RUTA).set('Authorization', autorizacion).expect(200);
    });
  });

  /** Ver la nota equivalente en `servicios.e2e.spec.ts`. */
  describe('RBAC mixto — leer y administrar son permisos distintos', () => {
    it.each([
      ['Gerente', Rol.GERENTE],
      ['Recepcionista', Rol.RECEPCIONISTA],
    ])('permite a un %s LEER los modificadores (200)', async (_caso, rol) => {
      await request(app.getHttpServer())
        .get(RUTA)
        .set('Authorization', `Bearer ${token(rol, `sub-lee-${rol}`)}`)
        .expect(200);
    });

    it.each([
      ['Gerente', Rol.GERENTE],
      ['Recepcionista', Rol.RECEPCIONISTA],
    ])('pero NIEGA a un %s actualizar o desactivar (403)', async (_caso, rol) => {
      const server = app.getHttpServer();
      const creado = await request(server)
        .post(RUTA)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-para-403')}`)
        .send({ ...MODIFICADOR_VALIDO, nombre: `Objetivo 403 ${rol}` })
        .expect(201);

      const autorizacion = `Bearer ${token(rol, `sub-escribe-${rol}`)}`;
      await request(server)
        .patch(`${RUTA}/${creado.body.id}`)
        .set('Authorization', autorizacion)
        .send({ precioAdicionalCentavos: 1 })
        .expect(403);
      await request(server).post(`${RUTA}/${creado.body.id}/desactivar`).set('Authorization', autorizacion).expect(403);
    });

    it('rechaza actualizar y desactivar sin token (401)', async () => {
      const server = app.getHttpServer();
      const id = '00000000-0000-0000-0000-000000000000';
      await request(server).patch(`${RUTA}/${id}`).send({ nombre: 'X' }).expect(401);
      await request(server).post(`${RUTA}/${id}/desactivar`).expect(401);
    });
  });

  describe('Actualización y baja lógica', () => {
    const autorizacionAdmin = () => `Bearer ${token(Rol.ADMINISTRADOR, 'admin-muta')}`;

    async function crearModificador(sobreescritura = {}) {
      const creado = await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', autorizacionAdmin())
        .send({ ...MODIFICADOR_VALIDO, ...sobreescritura })
        .expect(201);
      return creado.body;
    }

    it('PATCH aplica una actualización parcial y devuelve 200', async () => {
      const modificador = await crearModificador({ nombre: 'Para editar' });

      const editado = await request(app.getHttpServer())
        .patch(`${RUTA}/${modificador.id}`)
        .set('Authorization', autorizacionAdmin())
        .send({ precioAdicionalCentavos: 9500 })
        .expect(200);

      expect(editado.body).toEqual({ ...modificador, precioAdicionalCentavos: 9500 });
    });

    it('POST /:id/desactivar devuelve 204 y el modificador queda inactivo, no borrado', async () => {
      const modificador = await crearModificador({ nombre: 'Para dar de baja' });

      await request(app.getHttpServer())
        .post(`${RUTA}/${modificador.id}/desactivar`)
        .set('Authorization', autorizacionAdmin())
        .expect(204);

      const listado = await request(app.getHttpServer()).get(RUTA).set('Authorization', autorizacionAdmin()).expect(200);

      expect(listado.body.modificadoresDiseno).toContainEqual(expect.objectContaining({ id: modificador.id, activo: false }));
    });

    it('desactivar dos veces es idempotente (204 ambas)', async () => {
      const modificador = await crearModificador({ nombre: 'Idempotente' });
      const server = app.getHttpServer();

      await request(server).post(`${RUTA}/${modificador.id}/desactivar`).set('Authorization', autorizacionAdmin()).expect(204);
      await request(server).post(`${RUTA}/${modificador.id}/desactivar`).set('Authorization', autorizacionAdmin()).expect(204);
    });

    it.each([
      ['PATCH', (id: string) => request(app.getHttpServer()).patch(`${RUTA}/${id}`).send({ nombre: 'X' })],
      ['desactivar', (id: string) => request(app.getHttpServer()).post(`${RUTA}/${id}/desactivar`)],
    ])('%s sobre un id inexistente devuelve 404', async (_caso, peticion) => {
      const respuesta = await peticion('00000000-0000-0000-0000-000000000000').set('Authorization', autorizacionAdmin()).expect(404);

      expect(respuesta.body).toEqual({
        error: expect.objectContaining({ category: 'domain', code: 'RECURSO_NO_ENCONTRADO' }),
      });
    });

    it.each([
      ['un importe con decimales', { precioAdicionalCentavos: 80.5 }],
      ['un importe negativo', { precioAdicionalCentavos: -500 }],
      ['minutos fraccionarios', { minutosAdicionales: 15.5 }],
      ['un campo no declarado (activo, que solo cambia por su endpoint)', { activo: false }],
    ])('PATCH rechaza %s con 400 (RN-COT-07)', async (_caso, cambio) => {
      const modificador = await crearModificador({ nombre: `Rechazo ${JSON.stringify(cambio)}` });

      await request(app.getHttpServer())
        .patch(`${RUTA}/${modificador.id}`)
        .set('Authorization', autorizacionAdmin())
        .send(cambio)
        .expect(400);
    });
  });

  describe('Creación y listado', () => {
    it('devuelve 201 con el recurso completo — sin colección de servicios (aggregate independiente)', async () => {
      const respuesta = await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-crea-1')}`)
        .send({ nombre: 'Pedrería', minutosAdicionales: 20, precioAdicionalCentavos: 12000 })
        .expect(201);

      expect(respuesta.body).toEqual({
        id: expect.any(String),
        nombre: 'Pedrería',
        minutosAdicionales: 20,
        precioAdicionalCentavos: 12000,
        activo: true,
      });
    });

    it('el modificador creado aparece en el listado con el mismo entero de centavos', async () => {
      const server = app.getHttpServer();
      const autorizacion = `Bearer ${token(Rol.ADMINISTRADOR, 'admin-crea-2')}`;

      const creado = await request(server)
        .post(RUTA)
        .set('Authorization', autorizacion)
        .send({ nombre: 'Baby boomer', minutosAdicionales: 25, precioAdicionalCentavos: 15050 })
        .expect(201);

      const listado = await request(server).get(RUTA).set('Authorization', autorizacion).expect(200);

      expect(listado.body.modificadoresDiseno).toContainEqual(
        expect.objectContaining({ id: creado.body.id, precioAdicionalCentavos: 15050 }),
      );
    });
  });

  describe('Validación de DTO — RN-COT-07 en la frontera HTTP', () => {
    const autorizacionAdmin = () => `Bearer ${token(Rol.ADMINISTRADOR, 'admin-validacion')}`;

    it.each([
      ['un importe adicional con decimales', { precioAdicionalCentavos: 80.5 }],
      ['un importe adicional negativo', { precioAdicionalCentavos: -500 }],
      ['minutos adicionales fraccionarios', { minutosAdicionales: 15.5 }],
      ['minutos adicionales negativos', { minutosAdicionales: -5 }],
      ['un importe como cadena numérica (sin coerción implícita)', { precioAdicionalCentavos: '8000' }],
      ['un nombre vacío', { nombre: '' }],
    ])('rechaza %s con 400', async (_caso, sobreescritura) => {
      await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', autorizacionAdmin())
        .send({ ...MODIFICADOR_VALIDO, ...sobreescritura })
        .expect(400);
    });

    it('acepta cero minutos y cero precio: un modificador puede ser solo estético', async () => {
      await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', autorizacionAdmin())
        .send({ nombre: 'Brillo extra', minutosAdicionales: 0, precioAdicionalCentavos: 0 })
        .expect(201);
    });

    it('rechaza campos no declarados en el DTO (forbidNonWhitelisted)', async () => {
      // `servicioId` en particular: vincular un modificador a un servicio está fuera de alcance, y
      // el DTO no debe aceptarlo en silencio para luego ignorarlo.
      await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', autorizacionAdmin())
        .send({ ...MODIFICADOR_VALIDO, servicioId: 'x' })
        .expect(400);
    });

    /** Ver la nota equivalente en `servicios.e2e.spec.ts`: distingue el rechazo de la capa HTTP
     * del rechazo del dominio, que también existiría y también daría 400. */
    it('el 400 lo emite class-validator en la capa HTTP, NO el dominio como respaldo', async () => {
      const respuesta = await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', autorizacionAdmin())
        .send({ ...MODIFICADOR_VALIDO, precioAdicionalCentavos: 1.25 })
        .expect(400);

      expect(respuesta.body.error.code).toBe('SOLICITUD_INVALIDA');
      expect(respuesta.body.error.code).not.toBe('MODIFICADOR_PRECIO_ADICIONAL_INVALIDO');
      expect(respuesta.body.error.message).toContain('precioAdicionalCentavos');
    });
  });
});
