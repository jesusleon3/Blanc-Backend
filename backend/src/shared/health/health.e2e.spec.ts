import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthController } from './health.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthorizationGuard } from '../auth/authorization.guard';
import { PermisosUsuarioPort } from '../auth/permisos-usuario.port';
import { RolesGuard } from '../auth/roles.guard';
import { HttpExceptionFilter } from '../errors/http-exception.filter';

const SECRETO = 'secreto-e2e-health';
const ISSUER = 'https://issuer-e2e.example/auth/v1';
const jwksNuncaLlamado = async () => {
  throw new Error('resolverClaveJwks no debería invocarse en este E2E');
};

/**
 * `AuthorizationGuard` fallaría si llegara a consultarlo: si `/health` dejara de ser público,
 * la petición pasaría por aquí y la prueba lo delataría con un error explícito, no con un 401
 * ambiguo.
 */
const permisosQueNuncaDebenConsultarse: PermisosUsuarioPort = {
  obtenerPermisosPorSupabaseUserId: async () => {
    throw new Error('AuthorizationGuard no debería consultarse en una ruta pública');
  },
};

/**
 * Control negativo: idéntica al `HealthController` salvo por NO llevar `@Public()`. Sirve para
 * demostrar que los 200 de `/health` vienen del decorador y no de una cadena de guards inerte.
 */
@Controller('protegida-de-contraste')
class ControladorProtegidoDeContraste {
  @Get()
  responder() {
    return { ok: true };
  }
}

describe('HealthController — E2E (sonda de Railway)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Se monta la MISMA cadena de tres guards que en producción (`auth.module.ts`, `DEC-029`).
    // Sin ella, esta prueba no demostraría nada sobre si la ruta es pública.
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController, ControladorProtegidoDeContraste],
      providers: [
        {
          provide: APP_GUARD,
          useFactory: (reflector: Reflector) => new JwtAuthGuard(SECRETO, reflector, ISSUER, jwksNuncaLlamado),
          inject: [Reflector],
        },
        {
          provide: APP_GUARD,
          useFactory: (reflector: Reflector) => new AuthorizationGuard(permisosQueNuncaDebenConsultarse, reflector),
          inject: [Reflector],
        },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 SIN token — Railway no puede autenticarse', async () => {
    const respuesta = await request(app.getHttpServer()).get('/health').expect(200);

    expect(respuesta.body).toEqual({ status: 'ok', timestamp: expect.any(String) });
  });

  it('el timestamp es una fecha ISO-8601 válida y reciente', async () => {
    const respuesta = await request(app.getHttpServer()).get('/health').expect(200);

    const instante = new Date(respuesta.body.timestamp);
    expect(Number.isNaN(instante.getTime())).toBe(false);
    expect(respuesta.body.timestamp).toBe(instante.toISOString());
    expect(Math.abs(Date.now() - instante.getTime())).toBeLessThan(10_000);
  });

  it('un token inválido tampoco la bloquea: es pública, no "autenticable"', async () => {
    await request(app.getHttpServer()).get('/health').set('Authorization', 'Bearer token-basura').expect(200);
  });

  it('no filtra información interna (versión, commit, entorno, uptime)', async () => {
    const respuesta = await request(app.getHttpServer()).get('/health').expect(200);

    // Es un endpoint sin autenticación alcanzable desde internet.
    expect(Object.keys(respuesta.body).sort()).toEqual(['status', 'timestamp']);
  });

  it('CONTRASTE: una ruta gemela SIN @Public() sí exige token — la cadena de guards está activa', async () => {
    // Sin esta prueba, los 200 anteriores podrían deberse a que los guards no están montados.
    // (Una ruta *inexistente* no serviría de control: Nest devuelve 404 sin llegar a los guards.)
    await request(app.getHttpServer()).get('/protegida-de-contraste').expect(401);
  });
});
