import { Controller, Get, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthorizationGuard } from './authorization.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { ClaimsUsuario, Rol } from './rol';
import { PermisosUsuarioPort } from './permisos-usuario.port';
import { HttpExceptionFilter } from '../errors/http-exception.filter';

const SECRETO = 'secreto-orden-guards';
const ISSUER = 'https://issuer-orden.example/auth/v1';
const SUB = '0dd96720-c81d-4406-a2de-fe6bed0f4cd8';
const SUC_1 = '11111111-1111-1111-1111-111111111111';

const jwksNuncaLlamado = async () => {
  throw new Error('no debe resolverse JWKS en esta prueba (solo HS256)');
};

/** Token con claims de negocio DELIBERADAMENTE incorrectos: la prueba verifica que la base de
 * datos gana, no el token (`DEC-024`). */
function token(): string {
  return jwt.sign({ iss: ISSUER, aud: 'authenticated', sub: SUB, rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL' }, SECRETO);
}

@Controller('prueba')
class ControladorDePrueba {
  @Get('abierto')
  abierto(@CurrentUser() usuario: ClaimsUsuario) {
    return { rol: usuario.rol, sucursales: usuario.sucursales };
  }

  @Get('solo-super-admin')
  @Roles(Rol.SUPER_ADMIN)
  soloSuperAdmin() {
    return { ok: true };
  }

  @Get('publico')
  @Public()
  publico() {
    return { ok: true };
  }
}

function moduloCon(permisos: PermisosUsuarioPort) {
  @Module({
    controllers: [ControladorDePrueba],
    providers: [
      {
        provide: APP_GUARD,
        useFactory: (reflector: Reflector) => new JwtAuthGuard(SECRETO, reflector, ISSUER, jwksNuncaLlamado),
        inject: [Reflector],
      },
      {
        provide: APP_GUARD,
        useFactory: (reflector: Reflector) => new AuthorizationGuard(permisos, reflector),
        inject: [Reflector],
      },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  })
  class ModuloDePrueba {}
  return ModuloDePrueba;
}

async function levantar(permisos: PermisosUsuarioPort): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [moduloCon(permisos)] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}

/**
 * Prueba de cadena completa de los tres guards globales, en el mismo orden en que
 * `auth.module.ts` los registra (`DEC-029`). No sustituye a los tests unitarios de cada guard:
 * verifica lo que ninguno de ellos puede verificar por separado — que la secuencia funciona y que
 * la base de datos prevalece sobre los claims del token.
 */
describe('Cadena de guards — JwtAuthGuard → AuthorizationGuard → RolesGuard (DEC-029)', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('la base de datos gana sobre los claims del token', async () => {
    // El token dice SUPER_ADMIN/GLOBAL; la base de datos dice RECEPCIONISTA con una sucursal.
    app = await levantar({
      obtenerPermisosPorSupabaseUserId: async () => ({ rol: Rol.RECEPCIONISTA, activa: true, sucursales: [SUC_1] }),
    });

    const respuesta = await request(app.getHttpServer()).get('/prueba/abierto').set('Authorization', `Bearer ${token()}`).expect(200);

    expect(respuesta.body).toEqual({ rol: Rol.RECEPCIONISTA, sucursales: [SUC_1] });
  });

  it('RolesGuard decide con el rol REAL, no con el del token (403 pese a un token de Super Admin)', async () => {
    app = await levantar({
      obtenerPermisosPorSupabaseUserId: async () => ({ rol: Rol.RECEPCIONISTA, activa: true, sucursales: [SUC_1] }),
    });

    const respuesta = await request(app.getHttpServer())
      .get('/prueba/solo-super-admin')
      .set('Authorization', `Bearer ${token()}`)
      .expect(403);

    expect(respuesta.body.error.code).toBe('ROL_SIN_PERMISO');
  });

  it('un usuario desactivado en base de datos recibe 403 aunque su token siga vigente', async () => {
    app = await levantar({
      obtenerPermisosPorSupabaseUserId: async () => ({ rol: Rol.SUPER_ADMIN, activa: false, sucursales: 'GLOBAL' }),
    });

    const respuesta = await request(app.getHttpServer())
      .get('/prueba/solo-super-admin')
      .set('Authorization', `Bearer ${token()}`)
      .expect(403);

    expect(respuesta.body.error.code).toBe('USUARIO_INACTIVO');
  });

  it('un usuario no provisionado recibe 403, no 401', async () => {
    app = await levantar({ obtenerPermisosPorSupabaseUserId: async () => null });

    const respuesta = await request(app.getHttpServer()).get('/prueba/abierto').set('Authorization', `Bearer ${token()}`).expect(403);

    expect(respuesta.body.error.code).toBe('USUARIO_NO_PROVISIONADO');
  });

  it('un fallo de base de datos deniega con 503, sin dejar pasar la petición', async () => {
    app = await levantar({
      obtenerPermisosPorSupabaseUserId: async () => {
        throw new Error('connection terminated');
      },
    });

    const respuesta = await request(app.getHttpServer()).get('/prueba/abierto').set('Authorization', `Bearer ${token()}`).expect(503);

    expect(respuesta.body.error.code).toBe('AUTORIZACION_NO_DISPONIBLE');
  });

  it('sin token sigue siendo 401: la autenticación se decide antes que la autorización', async () => {
    const permisos = { obtenerPermisosPorSupabaseUserId: jest.fn() };
    app = await levantar(permisos);

    await request(app.getHttpServer()).get('/prueba/abierto').expect(401);

    // Prueba del ORDEN: si AuthorizationGuard corriera primero, habría consultado la base de datos.
    expect(permisos.obtenerPermisosPorSupabaseUserId).not.toHaveBeenCalled();
  });

  it('un endpoint @Public() atraviesa los tres guards sin token y sin consultar la base de datos', async () => {
    const permisos = { obtenerPermisosPorSupabaseUserId: jest.fn() };
    app = await levantar(permisos);

    await request(app.getHttpServer()).get('/prueba/publico').expect(200);

    expect(permisos.obtenerPermisosPorSupabaseUserId).not.toHaveBeenCalled();
  });
});
