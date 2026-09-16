import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { IdentidadYAccesosModule } from '../../identidad-y-accesos.module';
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

const SECRETO = 'secreto-e2e-identidad';
const ISSUER = 'https://issuer-e2e.example/auth/v1';
/** Este E2E solo ejercita la rama HS256 legacy — el resolver de JWKS nunca debería invocarse. */
const jwksNuncaLlamado = async () => {
  throw new Error('resolverClaveJwks no debería invocarse en este E2E (solo HS256)');
};

/**
 * Permisos por `sub`, poblados por el helper `token()`.
 *
 * Tras `DEC-029`, los claims del JWT ya NO determinan rol ni sucursales: `JwtAuthGuard` solo
 * autentica y `AuthorizationGuard` resuelve los permisos contra PostgreSQL. Estos E2E prueban
 * comportamiento de negocio, no la resolución de permisos (eso tiene sus propias suites), así
 * que aquí se sustituye la consulta real por este mapa — manteniendo la cadena de tres guards
 * idéntica a la de producción.
 */
const permisosPorSub = new Map<string, PermisosUsuario>();

const permisosDePrueba: PermisosUsuarioPort = {
  obtenerPermisosPorSupabaseUserId: async (sub) => permisosPorSub.get(sub) ?? null,
};

function token(rol: Rol, sub = 'test-user', sucursales: 'GLOBAL' | string[] = 'GLOBAL') {
  permisosPorSub.set(sub, { rol, activa: true, sucursales });
  return jwt.sign({ iss: ISSUER, aud: 'authenticated', sub }, SECRETO);
}

// `sucursal_id` es una columna `uuid` real (sin FK cruzada, ADR-005) — usar UUIDs válidos, no
// slugs arbitrarios como "suc-1", que pg-mem rechaza al castear.
const SUC_1 = '11111111-1111-1111-1111-111111111111';
const SUC_AJENA = '22222222-2222-2222-2222-222222222222';
const SUC_PROPIA = '33333333-3333-3333-3333-333333333333';
const SUC_INEXISTENTE = '99999999-9999-9999-9999-999999999999';

/** Mismo patrón que `sucursales.e2e.spec.ts` — sustituye a `DatabaseModule`/`AuditoriaModule` reales. */
/** Asignada en `beforeAll`; la consume el `useFactory` de `DATABASE_CONNECTION`. */
let dbDePrueba: Database;

@Global()
@Module({
  providers: [
    // `useFactory`, no `useValue`: la base real se crea de forma asíncrona en `beforeAll`,
    // después de que este módulo ya está definido pero antes de que Nest lo resuelva.
    { provide: DATABASE_CONNECTION, useFactory: () => dbDePrueba },
    { provide: AUDITORIA_PORT, useClass: DrizzleAuditoriaRepository },
    { provide: UNIT_OF_WORK, useClass: DrizzleUnitOfWork },
  ],
  exports: [DATABASE_CONNECTION, AUDITORIA_PORT, UNIT_OF_WORK],
})
class TestInfraModule {}

describe('Identidad y Accesos — E2E (HTTP) — FL-SEG-01/03/04/05', () => {
  let app: INestApplication;

  beforeAll(async () => {
    dbDePrueba = await crearBaseDeDatosDePrueba();

    const moduleRef = await Test.createTestingModule({
      imports: [TestInfraModule, IdentidadYAccesosModule],
      providers: [
        // Cadena completa, en el mismo orden que `auth.module.ts` (`DEC-029`).
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

  it('rechaza crear un usuario sin token (401)', async () => {
    await request(app.getHttpServer())
      .post('/v1/identidad-y-accesos/usuarios')
      .send({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA })
      .expect(401);
  });

  it('rechaza crear un usuario con un rol sin permiso (403 — nivel 1)', async () => {
    await request(app.getHttpServer())
      .post('/v1/identidad-y-accesos/usuarios')
      .set('Authorization', `Bearer ${token(Rol.GERENTE)}`)
      .send({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA })
      .expect(403);
  });

  it('crea un usuario con un token de Administrador y lo puede editar', async () => {
    const server = app.getHttpServer();

    const creado = await request(server)
      .post('/v1/identidad-y-accesos/usuarios')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-1')}`)
      .send({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA })
      .expect(201);

    expect(creado.body).toEqual({ id: expect.any(String), email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA, activa: true });

    const editado = await request(server)
      .patch(`/v1/identidad-y-accesos/usuarios/${creado.body.id}`)
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-1')}`)
      .send({ rol: Rol.GERENTE })
      .expect(200);

    expect(editado.body.rol).toBe(Rol.GERENTE);
  });

  it('rechaza que un Administrador asigne el rol Super Admin (403 — AsignacionDeRolNoPermitidaError)', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/v1/identidad-y-accesos/usuarios')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-2')}`)
      .send({ email: 'nuevo-super@blanc.mx', nombre: 'Nuevo Super', rol: Rol.SUPER_ADMIN })
      .expect(403);

    expect(respuesta.body).toEqual({
      error: expect.objectContaining({ category: 'domain', code: 'ASIGNACION_DE_ROL_NO_PERMITIDA' }),
    });
  });

  it('rechaza que un actor cambie su propio rol (403)', async () => {
    const server = app.getHttpServer();

    const creado = await request(server)
      .post('/v1/identidad-y-accesos/usuarios')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-3')}`)
      .send({ email: 'auto-edicion@blanc.mx', nombre: 'Auto Edición', rol: Rol.ADMINISTRADOR })
      .expect(201);

    // El actor del siguiente token (`sub` = el propio usuario recién creado) edita su propio registro.
    await request(server)
      .patch(`/v1/identidad-y-accesos/usuarios/${creado.body.id}`)
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, creado.body.id)}`)
      .send({ rol: Rol.SUPER_ADMIN })
      .expect(403);
  });

  it('rechaza un email duplicado (409) con el formato de error estándar', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/v1/identidad-y-accesos/usuarios')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-4')}`)
      .send({ email: 'duplicado@blanc.mx', nombre: 'Uno', rol: Rol.RECEPCIONISTA })
      .expect(201);

    const respuesta = await request(server)
      .post('/v1/identidad-y-accesos/usuarios')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-4')}`)
      .send({ email: 'duplicado@blanc.mx', nombre: 'Dos', rol: Rol.RECEPCIONISTA })
      .expect(409);

    expect(respuesta.body).toEqual({
      error: expect.objectContaining({ category: 'domain', code: 'USUARIO_EMAIL_DUPLICADO' }),
    });
  });

  it('rechaza un payload inválido con 400 (email malformado)', async () => {
    await request(app.getHttpServer())
      .post('/v1/identidad-y-accesos/usuarios')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-5')}`)
      .send({ email: 'no-es-un-email', nombre: 'X', rol: Rol.RECEPCIONISTA })
      .expect(400);
  });

  it('devuelve 404 con el formato de error estándar al editar un usuario inexistente', async () => {
    const respuesta = await request(app.getHttpServer())
      .patch('/v1/identidad-y-accesos/usuarios/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-6')}`)
      .send({ nombre: 'X' })
      .expect(404);

    expect(respuesta.body).toEqual({
      error: expect.objectContaining({ category: 'domain', code: 'RECURSO_NO_ENCONTRADO' }),
    });
  });

  describe('Asignación/remoción de sucursal — FL-SEG-04', () => {
    it('asigna y remueve una sucursal de un usuario (204)', async () => {
      const server = app.getHttpServer();
      const creado = await request(server)
        .post('/v1/identidad-y-accesos/usuarios')
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-suc-1')}`)
        .send({ email: 'con-sucursal@blanc.mx', nombre: 'Con Sucursal', rol: Rol.RECEPCIONISTA })
        .expect(201);

      await request(server)
        .post(`/v1/identidad-y-accesos/usuarios/${creado.body.id}/sucursales/${SUC_1}`)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-suc-1')}`)
        .expect(204);

      await request(server)
        .delete(`/v1/identidad-y-accesos/usuarios/${creado.body.id}/sucursales/${SUC_1}`)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-suc-1')}`)
        .expect(204);
    });

    it('rechaza asignar sin token (401) y con un rol sin permiso (403 — nivel 1)', async () => {
      const server = app.getHttpServer();
      await request(server).post(`/v1/identidad-y-accesos/usuarios/00000000-0000-0000-0000-000000000000/sucursales/${SUC_1}`).expect(401);

      await request(server)
        .post(`/v1/identidad-y-accesos/usuarios/00000000-0000-0000-0000-000000000000/sucursales/${SUC_1}`)
        .set('Authorization', `Bearer ${token(Rol.GERENTE)}`)
        .expect(403);
    });

    it('rechaza a un Administrador con alcance limitado que asigna fuera de su sucursal (403 — nivel 2, cross-branch)', async () => {
      const server = app.getHttpServer();
      const creado = await request(server)
        .post('/v1/identidad-y-accesos/usuarios')
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-suc-2')}`)
        .send({ email: 'cross-branch@blanc.mx', nombre: 'Cross Branch', rol: Rol.RECEPCIONISTA })
        .expect(201);

      const respuesta = await request(server)
        .post(`/v1/identidad-y-accesos/usuarios/${creado.body.id}/sucursales/${SUC_AJENA}`)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-suc-3', [SUC_PROPIA])}`)
        .expect(403);

      expect(respuesta.body).toEqual({
        error: expect.objectContaining({ category: 'domain', code: 'FUERA_DE_ALCANCE_DE_SUCURSAL' }),
      });
    });

    it('rechaza la auto-asignación a una sucursal fuera del propio alcance', async () => {
      const server = app.getHttpServer();
      const creado = await request(server)
        .post('/v1/identidad-y-accesos/usuarios')
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-suc-4')}`)
        .send({ email: 'auto-asignacion@blanc.mx', nombre: 'Auto Asignación', rol: Rol.ADMINISTRADOR })
        .expect(201);

      // El actor del token es el propio usuario recién creado, con alcance limitado.
      await request(server)
        .post(`/v1/identidad-y-accesos/usuarios/${creado.body.id}/sucursales/${SUC_AJENA}`)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, creado.body.id, [SUC_PROPIA])}`)
        .expect(403);
    });

    it('devuelve 409 al asignar la misma sucursal dos veces', async () => {
      const server = app.getHttpServer();
      const creado = await request(server)
        .post('/v1/identidad-y-accesos/usuarios')
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-suc-5')}`)
        .send({ email: 'duplicado-sucursal@blanc.mx', nombre: 'Duplicado', rol: Rol.RECEPCIONISTA })
        .expect(201);

      await request(server)
        .post(`/v1/identidad-y-accesos/usuarios/${creado.body.id}/sucursales/${SUC_1}`)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-suc-5')}`)
        .expect(204);

      const respuesta = await request(server)
        .post(`/v1/identidad-y-accesos/usuarios/${creado.body.id}/sucursales/${SUC_1}`)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-suc-5')}`)
        .expect(409);

      expect(respuesta.body).toEqual({
        error: expect.objectContaining({ category: 'domain', code: 'USUARIO_YA_ASIGNADO' }),
      });
    });

    it('remover una asignación inexistente no falla (204, no-op)', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/identidad-y-accesos/usuarios/00000000-0000-0000-0000-000000000000/sucursales/${SUC_INEXISTENTE}`)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-suc-6')}`)
        .expect(204);
    });
  });

  describe('Desactivación de usuario — FL-SEG-05', () => {
    it('desactiva un usuario (204)', async () => {
      const server = app.getHttpServer();
      const creado = await request(server)
        .post('/v1/identidad-y-accesos/usuarios')
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-des-1')}`)
        .send({ email: 'desactivar@blanc.mx', nombre: 'Desactivar', rol: Rol.RECEPCIONISTA })
        .expect(201);

      await request(server)
        .post(`/v1/identidad-y-accesos/usuarios/${creado.body.id}/desactivar`)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-des-1')}`)
        .expect(204);
    });

    it('rechaza sin token (401) y con un rol sin permiso (403 — nivel 1)', async () => {
      const server = app.getHttpServer();
      await request(server).post('/v1/identidad-y-accesos/usuarios/00000000-0000-0000-0000-000000000000/desactivar').expect(401);

      await request(server)
        .post('/v1/identidad-y-accesos/usuarios/00000000-0000-0000-0000-000000000000/desactivar')
        .set('Authorization', `Bearer ${token(Rol.GERENTE)}`)
        .expect(403);
    });

    it('devuelve 404 con el formato de error estándar para un usuario inexistente', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/v1/identidad-y-accesos/usuarios/00000000-0000-0000-0000-000000000000/desactivar')
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-des-2')}`)
        .expect(404);

      expect(respuesta.body).toEqual({
        error: expect.objectContaining({ category: 'domain', code: 'RECURSO_NO_ENCONTRADO' }),
      });
    });

    it('rechaza la auto-desactivación (403 — DesactivacionNoPermitidaError)', async () => {
      const server = app.getHttpServer();
      const creado = await request(server)
        .post('/v1/identidad-y-accesos/usuarios')
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-des-3')}`)
        .send({ email: 'auto-desactivacion@blanc.mx', nombre: 'Auto Desactivación', rol: Rol.ADMINISTRADOR })
        .expect(201);

      const respuesta = await request(server)
        .post(`/v1/identidad-y-accesos/usuarios/${creado.body.id}/desactivar`)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, creado.body.id)}`)
        .expect(403);

      expect(respuesta.body).toEqual({
        error: expect.objectContaining({ category: 'domain', code: 'DESACTIVACION_NO_PERMITIDA' }),
      });
    });

    it('rechaza que un Administrador desactive a un Super Admin (403 — protección jerárquica)', async () => {
      const server = app.getHttpServer();
      const creado = await request(server)
        .post('/v1/identidad-y-accesos/usuarios')
        .set('Authorization', `Bearer ${token(Rol.SUPER_ADMIN, 'super-des-1')}`)
        .send({ email: 'super-protegido@blanc.mx', nombre: 'Super Protegido', rol: Rol.SUPER_ADMIN })
        .expect(201);

      await request(server)
        .post(`/v1/identidad-y-accesos/usuarios/${creado.body.id}/desactivar`)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-des-4')}`)
        .expect(403);
    });

    it('desactivar dos veces es idempotente (204 ambas veces, no-op la segunda)', async () => {
      const server = app.getHttpServer();
      const creado = await request(server)
        .post('/v1/identidad-y-accesos/usuarios')
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-des-5')}`)
        .send({ email: 'idempotente@blanc.mx', nombre: 'Idempotente', rol: Rol.RECEPCIONISTA })
        .expect(201);

      await request(server)
        .post(`/v1/identidad-y-accesos/usuarios/${creado.body.id}/desactivar`)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-des-5')}`)
        .expect(204);

      await request(server)
        .post(`/v1/identidad-y-accesos/usuarios/${creado.body.id}/desactivar`)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-des-5')}`)
        .expect(204);
    });
  });
});
