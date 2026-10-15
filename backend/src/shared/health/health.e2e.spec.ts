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
    /**
     * EL SERVIDOR ESCUCHA UNA SOLA VEZ, Y ESTO ES LA CORRECCIÓN DE UNA INTERMITENCIA REAL.
     *
     * Con `app.init()` a secas el servidor HTTP queda creado pero **sin escuchar**, y entonces
     * `request(app.getHttpServer())` de supertest hace `listen(0)` y `close()` **en cada
     * petición**. Eso abre una carrera: si una petición encuentra el servidor ya escuchando
     * —porque la anterior lo abrió y su `close()` aún no ha terminado de completarse— no crea el
     * suyo, y el `close()` pendiente de la anterior le mata el socket a mitad.
     *
     * Los dos síntomas que producía, ambos observados: `read ECONNRESET`, y un `401` imposible en
     * el que la petición llegaba al guard **sin su cabecera `Authorization`** porque nunca se
     * terminó de recibir. Aparecía ~1 de cada 8 corridas completas, cambiando de prueba, y no
     * dependía del número de workers (fallaba igual con `--runInBand`): la carrera es **dentro**
     * de la secuencia de peticiones de un mismo archivo, y por eso casi nunca se reproducía al
     * ejecutar ese archivo aislado, con la máquina descargada.
     *
     * Con el servidor escuchando desde `beforeAll`, `address()` nunca es `null` y supertest **no
     * toca su ciclo de vida**: usa el que ya hay. El puerto `0` deja que el sistema elija uno
     * libre, así que no hay colisiones entre archivos ni workers. `app.close()` del `afterAll` lo
     * cierra al terminar.
     */
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 SIN token — Railway no puede autenticarse', async () => {
    const respuesta = await request(app.getHttpServer()).get('/health').expect(200);

    expect(respuesta.body).toEqual({ status: 'ok', timestamp: expect.any(String) });
  });

  it('el timestamp es una fecha ISO-8601 válida y se genera DURANTE la petición', async () => {
    /**
     * Se acota con los instantes de antes y después de la petición, no con una ventana fija.
     *
     * La versión anterior comparaba contra `Date.now()` con 10 segundos de margen, y eso hacía la
     * prueba dependiente de **lo rápido que vaya la máquina**: en una corrida completa con la
     * suite cargada, el intervalo entre que el servidor genera el timestamp y que la aserción
     * corre puede pasar de 10 segundos, y la prueba fallaba sin que nada estuviera roto.
     *
     * Acotar por el intervalo real de la petición afirma lo que de verdad importa —que el
     * timestamp se genera al atender, no es un valor fijo ni cacheado— y es determinista a
     * cualquier velocidad. El segundo de holgura absorbe el redondeo a milisegundos del reloj.
     */
    const antes = Date.now() - 1_000;
    const respuesta = await request(app.getHttpServer()).get('/health').expect(200);
    const despues = Date.now() + 1_000;

    const instante = new Date(respuesta.body.timestamp);
    expect(Number.isNaN(instante.getTime())).toBe(false);
    expect(respuesta.body.timestamp).toBe(instante.toISOString());
    expect(instante.getTime()).toBeGreaterThanOrEqual(antes);
    expect(instante.getTime()).toBeLessThanOrEqual(despues);
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
