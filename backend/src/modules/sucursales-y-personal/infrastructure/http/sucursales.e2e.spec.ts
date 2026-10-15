import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { SucursalesYPersonalModule } from '../../sucursales-y-personal.module';
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
import { VERIFICAR_CITAS_FUTURAS_PORT } from '../../domain/ports/verificar-citas-futuras.port';
import { CONSULTA_AGENDA_PORT } from '../../domain/ports/consulta-agenda.port';

const SECRETO = 'secreto-e2e';
const ISSUER = 'https://issuer-e2e.example/auth/v1';
/** Este E2E solo ejercita la rama HS256 legacy — el resolver de JWKS nunca debería invocarse. */
const jwksNuncaLlamado = async () => {
  throw new Error('resolverClaveJwks no debería invocarse en este E2E (solo HS256)');
};

/**
 * Permisos por `sub`, poblados por este mismo helper.
 *
 * Tras `DEC-029` los claims del JWT ya no determinan rol ni sucursales: `AuthorizationGuard` los
 * resuelve contra PostgreSQL. Este E2E prueba comportamiento de negocio, así que sustituye esa
 * consulta por un mapa, manteniendo la cadena de tres guards idéntica a la de producción.
 */
const permisosPorSub = new Map<string, PermisosUsuario>();

const permisosDePrueba: PermisosUsuarioPort = {
  obtenerPermisosPorSupabaseUserId: async (sub) => permisosPorSub.get(sub) ?? null,
};

function token(rol: Rol, sucursales: 'GLOBAL' | string[] = 'GLOBAL') {
  permisosPorSub.set('test-user', { rol, activa: true, sucursales, manicuristaId: null });
  return jwt.sign({ iss: ISSUER, aud: 'authenticated', sub: 'test-user' }, SECRETO);
}

const HORARIO = {
  lunes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  martes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  miercoles: [{ horaInicio: '09:00', horaFin: '18:00' }],
  jueves: [{ horaInicio: '09:00', horaFin: '18:00' }],
  viernes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  sabado: [{ horaInicio: '09:00', horaFin: '15:00' }],
  domingo: [],
};

/**
 * Prueba de extremo a extremo real: HTTP → Guards → Controller → Caso de uso → Repositorio
 * Drizzle → PostgreSQL real (Testcontainers). Sin mocks de aplicación — solo la base es efímera,
 * y el secreto JWT es fijo para poder firmar tokens de prueba (no hay módulo Identidad
 * todavía que los emita — ver reporte de cierre del módulo).
 */
/** Asignada en `beforeAll`; la consume el `useFactory` de `DATABASE_CONNECTION`. */
let dbDePrueba: Database;

/** Sustituye a `DatabaseModule`+`AuditoriaModule` reales — `@Global()` para que sus
 * providers lleguen a `SucursalesYPersonalModule` igual que en producción. */
@Global()
@Module({
  providers: [
    // `useFactory`, no `useValue`: la base real se crea de forma asíncrona en `beforeAll`,
    // después de que este módulo ya está definido pero antes de que Nest lo resuelva.
    { provide: DATABASE_CONNECTION, useFactory: () => dbDePrueba },
    { provide: AUDITORIA_PORT, useClass: DrizzleAuditoriaRepository },
    { provide: UNIT_OF_WORK, useClass: DrizzleUnitOfWork },
    // El adaptador real vive en `IntegracionModule` (`@Global`), que esta prueba no monta. Se
    // sustituye por un doble sin citas: estas pruebas no van sobre Agenda. Tiene que ir aquí
    // dentro —y no en los `providers` raíz— porque `DesactivarManicuristaUseCase` se resuelve en
    // el inyector de `SucursalesYPersonalModule`, al que el scope raíz no alcanza.
    { provide: VERIFICAR_CITAS_FUTURAS_PORT, useValue: { tieneCitasFuturas: async () => false } },
    // Mismo motivo: `RegistrarExcepcionPersonalUseCase` pregunta a Agenda qué citas quedan
    // comprometidas. El ciclo completo se prueba en `excepciones-personal.e2e.spec.ts`, que sí
    // monta `IntegracionModule`; aquí basta con que el inyector resuelva.
    { provide: CONSULTA_AGENDA_PORT, useValue: { citasAfectadasPorExcepcion: async () => [] } },
  ],
  exports: [DATABASE_CONNECTION, AUDITORIA_PORT, UNIT_OF_WORK, VERIFICAR_CITAS_FUTURAS_PORT, CONSULTA_AGENDA_PORT],
})
class TestInfraModule {}

describe('Sucursales y Personal — E2E (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    dbDePrueba = await crearBaseDeDatosDePrueba();

    const moduleRef = await Test.createTestingModule({
      imports: [TestInfraModule, SucursalesYPersonalModule],
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

  it('rechaza crear una sucursal sin token (401)', async () => {
    await request(app.getHttpServer())
      .post('/v1/sucursales-y-personal/sucursales')
      .send({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO })
      .expect(401);
  });

  it('crea una sucursal con un token de Administrador y la puede consultar', async () => {
    const server = app.getHttpServer();

    const creada = await request(server)
      .post('/v1/sucursales-y-personal/sucursales')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .send({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO })
      .expect(201);

    expect(creada.body.nombre).toBe('Blanc Polanco');

    const consultada = await request(server)
      .get(`/v1/sucursales-y-personal/sucursales/${creada.body.id}`)
      .set('Authorization', `Bearer ${token(Rol.SOLO_LECTURA)}`)
      .expect(200);

    expect(consultada.body.id).toBe(creada.body.id);
  });

  it('rechaza a un Administrador activando modo mantenimiento (403 — RN-SUC-02 exige Super Admin)', async () => {
    const server = app.getHttpServer();
    const creada = await request(server)
      .post('/v1/sucursales-y-personal/sucursales')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .send({ nombre: 'Blanc Condesa', horarioSemanal: HORARIO })
      .expect(201);

    const respuesta = await request(server)
      .post(`/v1/sucursales-y-personal/sucursales/${creada.body.id}/activar-mantenimiento`)
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .expect(403);

    expect(respuesta.body.error.category).toBe('domain');
  });

  it('permite a Super Admin activar mantenimiento', async () => {
    const server = app.getHttpServer();
    const creada = await request(server)
      .post('/v1/sucursales-y-personal/sucursales')
      .set('Authorization', `Bearer ${token(Rol.SUPER_ADMIN)}`)
      .send({ nombre: 'Blanc Santa Fe', horarioSemanal: HORARIO })
      .expect(201);

    await request(server)
      .post(`/v1/sucursales-y-personal/sucursales/${creada.body.id}/activar-mantenimiento`)
      .set('Authorization', `Bearer ${token(Rol.SUPER_ADMIN)}`)
      .expect(204);

    const consultada = await request(server)
      .get(`/v1/sucursales-y-personal/sucursales/${creada.body.id}`)
      .set('Authorization', `Bearer ${token(Rol.SUPER_ADMIN)}`)
      .expect(200);

    expect(consultada.body.enMantenimiento).toBe(true);
  });

  it('rechaza a un Administrador con alcance sobre otra sucursal (403 — nivel 2 de RBAC, AccesoFueraDeAlcanceError)', async () => {
    const server = app.getHttpServer();
    const creada = await request(server)
      .post('/v1/sucursales-y-personal/sucursales')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .send({ nombre: 'Blanc Coyoacán', horarioSemanal: HORARIO })
      .expect(201);

    const respuesta = await request(server)
      .patch(`/v1/sucursales-y-personal/sucursales/${creada.body.id}`)
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, ['sucursal-distinta'])}`)
      .send({ nombre: 'Nuevo nombre' })
      .expect(403);

    expect(respuesta.body).toEqual({
      error: expect.objectContaining({ category: 'domain', code: 'FUERA_DE_ALCANCE_DE_SUCURSAL' }),
    });
  });

  it('devuelve 404 con el formato de error estándar (05-api-design.md §2) para una sucursal inexistente', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/v1/sucursales-y-personal/sucursales/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token(Rol.SOLO_LECTURA)}`)
      .expect(404);

    expect(respuesta.body).toEqual({
      error: expect.objectContaining({ category: 'domain', code: 'RECURSO_NO_ENCONTRADO' }),
    });
  });

  it('rechaza un payload inválido con 400 (validación de entrada, 05-api-design.md §8)', async () => {
    await request(app.getHttpServer())
      .post('/v1/sucursales-y-personal/sucursales')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .send({ nombre: '' })
      .expect(400);
  });

  it('crea y da de alta una manicurista, y la asigna a una sucursal', async () => {
    const server = app.getHttpServer();
    const sucursal = await request(server)
      .post('/v1/sucursales-y-personal/sucursales')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .send({ nombre: 'Blanc Interlomas', horarioSemanal: HORARIO })
      .expect(201);

    const manicurista = await request(server)
      .post('/v1/sucursales-y-personal/manicuristas')
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .send({ nombre: 'Karla Espinoza' })
      .expect(201);

    await request(server)
      .post(`/v1/sucursales-y-personal/manicuristas/${manicurista.body.id}/sucursales/${sucursal.body.id}`)
      .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR)}`)
      .expect(204);
  });
});
