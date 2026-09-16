import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { CatalogoYCotizacionModule } from '../../catalogo-y-cotizacion.module';
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

const SECRETO = 'secreto-e2e-catalogo';
const ISSUER = 'https://issuer-e2e.example/auth/v1';
/** Este E2E solo ejercita la rama HS256 legacy — el resolver de JWKS nunca debería invocarse. */
const jwksNuncaLlamado = async () => {
  throw new Error('resolverClaveJwks no debería invocarse en este E2E (solo HS256)');
};

/** Mismo mecanismo que `usuarios.e2e.spec.ts`: tras `DEC-029` los permisos se resuelven contra
 * PostgreSQL, no contra el JWT; aquí se sustituye esa consulta por un mapa poblado por `token()`,
 * conservando la cadena de tres guards idéntica a la de producción. */
const permisosPorSub = new Map<string, PermisosUsuario>();

const permisosDePrueba: PermisosUsuarioPort = {
  obtenerPermisosPorSupabaseUserId: async (sub) => permisosPorSub.get(sub) ?? null,
};

function token(rol: Rol, sub = 'test-user') {
  permisosPorSub.set(sub, { rol, activa: true, sucursales: 'GLOBAL' });
  return jwt.sign({ iss: ISSUER, aud: 'authenticated', sub }, SECRETO);
}

const RUTA = '/v1/catalogo-y-cotizacion/servicios';
const SERVICIO_VALIDO = { nombre: 'Gelish', categoria: 'aplicacion', duracionBaseMinutos: 60, precioBaseCentavos: 45000 };

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

describe('Catálogo — Servicios E2E (HTTP) — FL-COT-01', () => {
  let app: INestApplication;

  beforeAll(async () => {
    dbDePrueba = await crearBaseDeDatosDePrueba();

    const moduleRef = await Test.createTestingModule({
      imports: [TestInfraModule, CatalogoYCotizacionModule],
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
    // Idéntico a `main.ts` — las pruebas de validación de DTO no valen nada si el pipe difiere.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('RBAC — el catálogo es un flujo de administración cerrado', () => {
    it('rechaza crear sin token (401)', async () => {
      await request(app.getHttpServer()).post(RUTA).send(SERVICIO_VALIDO).expect(401);
    });

    it('rechaza listar sin token (401)', async () => {
      await request(app.getHttpServer()).get(RUTA).expect(401);
    });

    it.each([
      ['Gerente', Rol.GERENTE],
      ['Recepcionista', Rol.RECEPCIONISTA],
    ])('rechaza que un %s cree un servicio (403 — nivel 1)', async (_caso, rol) => {
      await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', `Bearer ${token(rol, `sub-post-${rol}`)}`)
        .send(SERVICIO_VALIDO)
        .expect(403);
    });

    it.each([
      ['Super Admin', Rol.SUPER_ADMIN],
      ['Administrador', Rol.ADMINISTRADOR],
    ])('permite a un %s crear y listar', async (_caso, rol) => {
      const server = app.getHttpServer();
      const autorizacion = `Bearer ${token(rol, `sub-ok-${rol}`)}`;

      await request(server).post(RUTA).set('Authorization', autorizacion).send(SERVICIO_VALIDO).expect(201);
      await request(server).get(RUTA).set('Authorization', autorizacion).expect(200);
    });
  });

  /**
   * El punto de este bloque: el MISMO rol que puede leer el catálogo NO puede alterarlo. Es la
   * corrección del RBAC de clase (que bloqueaba el `GET` a Recepción y habría roto `FL-COT-03`)
   * sin haber abierto la escritura por accidente en el camino.
   */
  describe('RBAC mixto — leer el catálogo y administrarlo son permisos distintos', () => {
    it.each([
      ['Gerente', Rol.GERENTE],
      ['Recepcionista', Rol.RECEPCIONISTA],
    ])('permite a un %s LEER el catálogo (200) — lo necesitará para cotizar en FL-COT-03', async (_caso, rol) => {
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
      const autorizacion = `Bearer ${token(rol, `sub-escribe-${rol}`)}`;

      // Se crea el servicio aquí, con un token de Administrador, en vez de depender de que otro
      // test lo haya dejado: así el 403 viene del permiso de escritura y no de un id inexistente.
      const creado = await request(server)
        .post(RUTA)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-para-403')}`)
        .send({ ...SERVICIO_VALIDO, nombre: `Objetivo 403 ${rol}` })
        .expect(201);
      const idExistente = creado.body.id;

      await request(server).patch(`${RUTA}/${idExistente}`).set('Authorization', autorizacion).send({ precioBaseCentavos: 1 }).expect(403);
      await request(server).post(`${RUTA}/${idExistente}/desactivar`).set('Authorization', autorizacion).expect(403);
    });

    it('rechaza actualizar y desactivar sin token (401)', async () => {
      const server = app.getHttpServer();
      const id = '00000000-0000-0000-0000-000000000000';
      await request(server).patch(`${RUTA}/${id}`).send({ nombre: 'X' }).expect(401);
      await request(server).post(`${RUTA}/${id}/desactivar`).expect(401);
    });
  });

  describe('Creación', () => {
    it('devuelve 201 con el recurso completo y el importe en centavos', async () => {
      const respuesta = await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', `Bearer ${token(Rol.ADMINISTRADOR, 'admin-crea-1')}`)
        .send({ nombre: 'Acrílico', categoria: 'aplicacion', duracionBaseMinutos: 90, precioBaseCentavos: 78000 })
        .expect(201);

      expect(respuesta.body).toEqual({
        id: expect.any(String),
        nombre: 'Acrílico',
        categoria: 'aplicacion',
        duracionBaseMinutos: 90,
        precioBaseCentavos: 78000,
        activo: true,
      });
    });

    it('el servicio creado aparece después en el listado, con el mismo entero de centavos', async () => {
      const server = app.getHttpServer();
      const autorizacion = `Bearer ${token(Rol.ADMINISTRADOR, 'admin-crea-2')}`;

      const creado = await request(server)
        .post(RUTA)
        .set('Authorization', autorizacion)
        .send({ nombre: 'Pedicure spa', categoria: 'pedicure', duracionBaseMinutos: 75, precioBaseCentavos: 62050 })
        .expect(201);

      const listado = await request(server).get(RUTA).set('Authorization', autorizacion).expect(200);

      expect(listado.body.servicios).toContainEqual(expect.objectContaining({ id: creado.body.id, precioBaseCentavos: 62050 }));
    });
  });

  describe('Actualización y baja lógica', () => {
    const autorizacionAdmin = () => `Bearer ${token(Rol.ADMINISTRADOR, 'admin-muta')}`;

    async function crearServicio(sobreescritura = {}) {
      const creado = await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', autorizacionAdmin())
        .send({ ...SERVICIO_VALIDO, ...sobreescritura })
        .expect(201);
      return creado.body;
    }

    it('PATCH aplica una actualización parcial y devuelve 200 con el recurso completo', async () => {
      const servicio = await crearServicio({ nombre: 'Para editar' });

      const editado = await request(app.getHttpServer())
        .patch(`${RUTA}/${servicio.id}`)
        .set('Authorization', autorizacionAdmin())
        .send({ precioBaseCentavos: 52000 })
        .expect(200);

      expect(editado.body).toEqual({ ...servicio, precioBaseCentavos: 52000 });
    });

    it('el cambio persiste: aparece en el siguiente GET', async () => {
      const servicio = await crearServicio({ nombre: 'Persistencia' });

      await request(app.getHttpServer())
        .patch(`${RUTA}/${servicio.id}`)
        .set('Authorization', autorizacionAdmin())
        .send({ duracionBaseMinutos: 120, nombre: 'Persistencia editada' })
        .expect(200);

      const listado = await request(app.getHttpServer()).get(RUTA).set('Authorization', autorizacionAdmin()).expect(200);

      expect(listado.body.servicios).toContainEqual(
        expect.objectContaining({ id: servicio.id, duracionBaseMinutos: 120, nombre: 'Persistencia editada' }),
      );
    });

    it('POST /:id/desactivar devuelve 204 y el servicio queda inactivo, no borrado', async () => {
      const servicio = await crearServicio({ nombre: 'Para dar de baja' });

      await request(app.getHttpServer())
        .post(`${RUTA}/${servicio.id}/desactivar`)
        .set('Authorization', autorizacionAdmin())
        .expect(204);

      const listado = await request(app.getHttpServer()).get(RUTA).set('Authorization', autorizacionAdmin()).expect(200);

      // Sigue existiendo — la baja es lógica; borrarlo falsearía las citas ya cotizadas.
      expect(listado.body.servicios).toContainEqual(expect.objectContaining({ id: servicio.id, activo: false }));
    });

    it('desactivar dos veces es idempotente (204 ambas)', async () => {
      const servicio = await crearServicio({ nombre: 'Idempotente' });
      const server = app.getHttpServer();

      await request(server).post(`${RUTA}/${servicio.id}/desactivar`).set('Authorization', autorizacionAdmin()).expect(204);
      await request(server).post(`${RUTA}/${servicio.id}/desactivar`).set('Authorization', autorizacionAdmin()).expect(204);
    });

    it.each([
      ['PATCH', (id: string) => request(app.getHttpServer()).patch(`${RUTA}/${id}`).send({ nombre: 'X' })],
      ['desactivar', (id: string) => request(app.getHttpServer()).post(`${RUTA}/${id}/desactivar`)],
    ])('%s sobre un id inexistente devuelve 404 con el formato de error estándar', async (_caso, peticion) => {
      const respuesta = await peticion('00000000-0000-0000-0000-000000000000').set('Authorization', autorizacionAdmin()).expect(404);

      expect(respuesta.body).toEqual({
        error: expect.objectContaining({ category: 'domain', code: 'RECURSO_NO_ENCONTRADO' }),
      });
    });

    describe('RN-COT-07 — editar no es una puerta trasera para meter un decimal', () => {
      it.each([
        ['un precio con decimales', { precioBaseCentavos: 450.75 }],
        ['un precio negativo', { precioBaseCentavos: -1 }],
        ['una duración fraccionaria', { duracionBaseMinutos: 30.5 }],
        ['un nombre vacío', { nombre: '' }],
        ['un campo no declarado (activo, que solo cambia por su endpoint)', { activo: false }],
      ])('PATCH rechaza %s con 400', async (_caso, cambio) => {
        const servicio = await crearServicio({ nombre: `Rechazo ${JSON.stringify(cambio)}` });

        await request(app.getHttpServer())
          .patch(`${RUTA}/${servicio.id}`)
          .set('Authorization', autorizacionAdmin())
          .send(cambio)
          .expect(400);
      });

      it('el 400 del PATCH también lo emite class-validator, no el dominio', async () => {
        const servicio = await crearServicio({ nombre: 'Origen del 400' });

        const respuesta = await request(app.getHttpServer())
          .patch(`${RUTA}/${servicio.id}`)
          .set('Authorization', autorizacionAdmin())
          .send({ precioBaseCentavos: 99.99 })
          .expect(400);

        expect(respuesta.body.error.code).toBe('SOLICITUD_INVALIDA');
        expect(respuesta.body.error.message).toContain('precioBaseCentavos');
      });

      it('un PATCH vacío es válido y no rompe nada (no-op)', async () => {
        const servicio = await crearServicio({ nombre: 'Patch vacío' });

        const respuesta = await request(app.getHttpServer())
          .patch(`${RUTA}/${servicio.id}`)
          .set('Authorization', autorizacionAdmin())
          .send({})
          .expect(200);

        expect(respuesta.body).toEqual(servicio);
      });
    });
  });

  describe('Vínculo N:M con modificadores de diseño', () => {
    const RUTA_MODIFICADORES = '/v1/catalogo-y-cotizacion/modificadores-diseno';
    const autorizacionAdmin = () => `Bearer ${token(Rol.ADMINISTRADOR, 'admin-vinculo')}`;

    async function crearServicio(nombre: string) {
      const creado = await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', autorizacionAdmin())
        .send({ ...SERVICIO_VALIDO, nombre })
        .expect(201);
      return creado.body;
    }

    async function crearModificador(nombre: string) {
      const creado = await request(app.getHttpServer())
        .post(RUTA_MODIFICADORES)
        .set('Authorization', autorizacionAdmin())
        .send({ nombre, minutosAdicionales: 15, precioAdicionalCentavos: 8000 })
        .expect(201);
      return creado.body;
    }

    it('vincula (204) y el modificador aparece en GET /:id/modificadores con todos sus datos', async () => {
      const servicio = await crearServicio('Con vínculo');
      const modificador = await crearModificador('Francés vinculado');

      await request(app.getHttpServer())
        .post(`${RUTA}/${servicio.id}/modificadores/${modificador.id}`)
        .set('Authorization', autorizacionAdmin())
        .expect(204);

      const consulta = await request(app.getHttpServer())
        .get(`${RUTA}/${servicio.id}/modificadores`)
        .set('Authorization', autorizacionAdmin())
        .expect(200);

      expect(consulta.body.modificadoresDiseno).toEqual([modificador]);
    });

    it('desvincula (204) y desaparece de la consulta', async () => {
      const servicio = await crearServicio('Para desvincular');
      const modificador = await crearModificador('Efímero');
      const server = app.getHttpServer();

      await request(server).post(`${RUTA}/${servicio.id}/modificadores/${modificador.id}`).set('Authorization', autorizacionAdmin()).expect(204);
      await request(server)
        .delete(`${RUTA}/${servicio.id}/modificadores/${modificador.id}`)
        .set('Authorization', autorizacionAdmin())
        .expect(204);

      const consulta = await request(server).get(`${RUTA}/${servicio.id}/modificadores`).set('Authorization', autorizacionAdmin()).expect(200);
      expect(consulta.body.modificadoresDiseno).toEqual([]);
    });

    it('un servicio sin vínculos devuelve una lista vacía, no 404', async () => {
      const servicio = await crearServicio('Sin vínculos');

      const consulta = await request(app.getHttpServer())
        .get(`${RUTA}/${servicio.id}/modificadores`)
        .set('Authorization', autorizacionAdmin())
        .expect(200);

      expect(consulta.body).toEqual({ modificadoresDiseno: [] });
    });

    it('vincular dos veces devuelve 409 con el código de negocio, no un 500 por el 23505', async () => {
      const servicio = await crearServicio('Duplicado');
      const modificador = await crearModificador('Duplicado mod');
      const server = app.getHttpServer();

      await request(server).post(`${RUTA}/${servicio.id}/modificadores/${modificador.id}`).set('Authorization', autorizacionAdmin()).expect(204);

      const respuesta = await request(server)
        .post(`${RUTA}/${servicio.id}/modificadores/${modificador.id}`)
        .set('Authorization', autorizacionAdmin())
        .expect(409);

      expect(respuesta.body).toEqual({
        error: expect.objectContaining({ category: 'domain', code: 'MODIFICADOR_YA_VINCULADO' }),
      });
    });

    it('desvincular algo no vinculado es idempotente (204)', async () => {
      const servicio = await crearServicio('Idempotente desvínculo');
      const modificador = await crearModificador('Nunca vinculado');

      await request(app.getHttpServer())
        .delete(`${RUTA}/${servicio.id}/modificadores/${modificador.id}`)
        .set('Authorization', autorizacionAdmin())
        .expect(204);
    });

    describe('IDs falsos e inactivos', () => {
      const ID_FALSO = '00000000-0000-0000-0000-000000000000';

      it('servicio inexistente → 404', async () => {
        const modificador = await crearModificador('Huérfano');
        const respuesta = await request(app.getHttpServer())
          .post(`${RUTA}/${ID_FALSO}/modificadores/${modificador.id}`)
          .set('Authorization', autorizacionAdmin())
          .expect(404);

        expect(respuesta.body.error.code).toBe('RECURSO_NO_ENCONTRADO');
      });

      it('modificador inexistente → 404', async () => {
        const servicio = await crearServicio('Sin modificador real');
        await request(app.getHttpServer())
          .post(`${RUTA}/${servicio.id}/modificadores/${ID_FALSO}`)
          .set('Authorization', autorizacionAdmin())
          .expect(404);
      });

      it('GET /:id/modificadores de un servicio inexistente → 404', async () => {
        await request(app.getHttpServer())
          .get(`${RUTA}/${ID_FALSO}/modificadores`)
          .set('Authorization', autorizacionAdmin())
          .expect(404);
      });

      it('DELETE sobre un servicio inexistente → 404, no un 204 engañoso', async () => {
        await request(app.getHttpServer())
          .delete(`${RUTA}/${ID_FALSO}/modificadores/${ID_FALSO}`)
          .set('Authorization', autorizacionAdmin())
          .expect(404);
      });

      it('modificador dado de baja → 409 MODIFICADOR_INACTIVO', async () => {
        const servicio = await crearServicio('Objetivo inactivo');
        const modificador = await crearModificador('Descontinuado');
        const server = app.getHttpServer();

        await request(server)
          .post(`${RUTA_MODIFICADORES}/${modificador.id}/desactivar`)
          .set('Authorization', autorizacionAdmin())
          .expect(204);

        const respuesta = await request(server)
          .post(`${RUTA}/${servicio.id}/modificadores/${modificador.id}`)
          .set('Authorization', autorizacionAdmin())
          .expect(409);

        expect(respuesta.body.error.code).toBe('MODIFICADOR_INACTIVO');
      });

      it('servicio dado de baja → 409 SERVICIO_INACTIVO', async () => {
        const servicio = await crearServicio('Servicio retirado');
        const modificador = await crearModificador('Modificador vigente');
        const server = app.getHttpServer();

        await request(server).post(`${RUTA}/${servicio.id}/desactivar`).set('Authorization', autorizacionAdmin()).expect(204);

        const respuesta = await request(server)
          .post(`${RUTA}/${servicio.id}/modificadores/${modificador.id}`)
          .set('Authorization', autorizacionAdmin())
          .expect(409);

        expect(respuesta.body.error.code).toBe('SERVICIO_INACTIVO');
      });

      it('pero SÍ deja desvincular de un servicio dado de baja (limpieza tras la baja)', async () => {
        const servicio = await crearServicio('Baja con vínculo');
        const modificador = await crearModificador('A limpiar');
        const server = app.getHttpServer();

        await request(server).post(`${RUTA}/${servicio.id}/modificadores/${modificador.id}`).set('Authorization', autorizacionAdmin()).expect(204);
        await request(server).post(`${RUTA}/${servicio.id}/desactivar`).set('Authorization', autorizacionAdmin()).expect(204);

        await request(server)
          .delete(`${RUTA}/${servicio.id}/modificadores/${modificador.id}`)
          .set('Authorization', autorizacionAdmin())
          .expect(204);
      });
    });

    describe('RBAC del vínculo', () => {
      it.each([
        ['Gerente', Rol.GERENTE],
        ['Recepcionista', Rol.RECEPCIONISTA],
      ])('un %s puede CONSULTAR los modificadores de un servicio (200)', async (_caso, rol) => {
        const servicio = await crearServicio(`Consulta ${rol}`);

        await request(app.getHttpServer())
          .get(`${RUTA}/${servicio.id}/modificadores`)
          .set('Authorization', `Bearer ${token(rol, `sub-vinculo-lee-${rol}`)}`)
          .expect(200);
      });

      it.each([
        ['Gerente', Rol.GERENTE],
        ['Recepcionista', Rol.RECEPCIONISTA],
      ])('pero un %s NO puede vincular ni desvincular (403)', async (_caso, rol) => {
        const servicio = await crearServicio(`Mutación ${rol}`);
        const modificador = await crearModificador(`Mod ${rol}`);
        const autorizacion = `Bearer ${token(rol, `sub-vinculo-escribe-${rol}`)}`;
        const server = app.getHttpServer();

        await request(server).post(`${RUTA}/${servicio.id}/modificadores/${modificador.id}`).set('Authorization', autorizacion).expect(403);
        await request(server).delete(`${RUTA}/${servicio.id}/modificadores/${modificador.id}`).set('Authorization', autorizacion).expect(403);
      });

      it('sin token, las tres rutas del vínculo responden 401', async () => {
        const server = app.getHttpServer();
        const id = '00000000-0000-0000-0000-000000000000';
        await request(server).get(`${RUTA}/${id}/modificadores`).expect(401);
        await request(server).post(`${RUTA}/${id}/modificadores/${id}`).expect(401);
        await request(server).delete(`${RUTA}/${id}/modificadores/${id}`).expect(401);
      });
    });
  });

  describe('Validación de DTO — RN-COT-07 en la frontera HTTP', () => {
    const autorizacionAdmin = () => `Bearer ${token(Rol.ADMINISTRADOR, 'admin-validacion')}`;

    it.each([
      ['un precio con decimales (pesos enviados como si fueran centavos)', { precioBaseCentavos: 450.75 }],
      ['un precio con un solo decimal', { precioBaseCentavos: 45000.5 }],
      ['un precio negativo', { precioBaseCentavos: -1 }],
      ['una duración fraccionaria', { duracionBaseMinutos: 60.5 }],
      ['una duración negativa', { duracionBaseMinutos: -30 }],
      ['un precio como cadena numérica (sin coerción implícita)', { precioBaseCentavos: '45000' }],
      ['un precio nulo', { precioBaseCentavos: null }],
      ['un nombre vacío', { nombre: '' }],
      ['una categoría ausente', { categoria: undefined }],
    ])('rechaza %s con 400', async (_caso, sobreescritura) => {
      await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', autorizacionAdmin())
        .send({ ...SERVICIO_VALIDO, ...sobreescritura })
        .expect(400);
    });

    it('acepta cero como precio y como duración: son válidos, no "vacíos"', async () => {
      await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', autorizacionAdmin())
        .send({ nombre: 'Cortesía', categoria: 'retiro', duracionBaseMinutos: 0, precioBaseCentavos: 0 })
        .expect(201);
    });

    it('rechaza campos no declarados en el DTO (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', autorizacionAdmin())
        .send({ ...SERVICIO_VALIDO, activo: false, campoInventado: 'x' })
        .expect(400);
    });

    /**
     * Prueba clave: el dominio **también** rechaza un decimal (`validarImporteEnCentavos`), así que
     * un simple `expect(400)` no demuestra cuál de las dos capas actuó. Los códigos sí los
     * distinguen: `class-validator` sale como `SOLICITUD_INVALIDA` vía `HttpExceptionFilter`,
     * mientras que el dominio saldría como `SERVICIO_PRECIO_BASE_INVALIDO`. Afirmar el primero y
     * negar el segundo prueba que el rechazo ocurre en la frontera HTTP, antes del caso de uso.
     */
    it('el 400 lo emite class-validator en la capa HTTP, NO el dominio como respaldo', async () => {
      const respuesta = await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', autorizacionAdmin())
        .send({ ...SERVICIO_VALIDO, precioBaseCentavos: 99.99 })
        .expect(400);

      expect(respuesta.body.error.code).toBe('SOLICITUD_INVALIDA');
      expect(respuesta.body.error.code).not.toBe('SERVICIO_PRECIO_BASE_INVALIDO');
      // El mensaje nombra el campo culpable, cosa que el error de dominio no hace.
      expect(respuesta.body.error.message).toContain('precioBaseCentavos');
    });
  });
});
