import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { CrmYClientasModule } from '../../crm-y-clientas.module';
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

const SECRETO = 'secreto-e2e-crm';
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

const RUTA = '/v1/crm/clientas';
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

describe('CRM — Clientas E2E (HTTP) — Fase 3 Parte 1', () => {
  let app: INestApplication;
  let dueña: string;
  let superAdmin: string;
  let encargada: string;
  let manicurista: string;
  let recepcionista: string;

  beforeAll(async () => {
    dbDePrueba = await crearBaseDeDatosDePrueba();

    const moduleRef = await Test.createTestingModule({
      imports: [TestInfraModule, CrmYClientasModule],
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
    await app?.close();
  });

  beforeEach(async () => {
    await crearBaseDeDatosDePrueba();
    dueña = token(Rol.ADMINISTRADOR, 'dueña');
    superAdmin = token(Rol.SUPER_ADMIN, 'super');
    encargada = token(Rol.GERENTE, 'encargada');
    manicurista = token(Rol.MANICURISTA, 'ana', randomUUID());
    recepcionista = token(Rol.RECEPCIONISTA, 'recepcionista');
  });

  const registrar = (cuerpo: Record<string, unknown> = {}, autorizacion = encargada) =>
    request(app.getHttpServer())
      .post(RUTA)
      .set('Authorization', `Bearer ${autorizacion}`)
      .send({ nombre: 'Andrea Ramírez', telefono: '4421112233', ...cuerpo });

  describe('alta y búsqueda', () => {
    it('201 y nace en `normal`, sin sugerencia', async () => {
      const respuesta = await registrar().expect(201);

      expect(respuesta.body).toMatchObject({
        nombre: 'Andrea Ramírez',
        telefono: '4421112233',
        estadoDeRiesgo: 'normal',
        sugeridaListaRoja: false,
        cancelacionesOrdinarias: 0,
        telefonoAnterior: null,
      });
    });

    it('400 si falta el nombre', async () => {
      await request(app.getHttpServer()).post(RUTA).set('Authorization', `Bearer ${encargada}`).send({ telefono: '4421112233' }).expect(400);
    });

    it('400 si el teléfono es demasiado corto', async () => {
      await registrar({ telefono: '44211' }).expect(400);
    });

    it('400 ante un campo no declarado: el DTO no es un buzón abierto', async () => {
      await registrar({ estadoDeRiesgo: 'lista_roja' }).expect(400);
    });

    it('MAMÁ E HIJA: 201 las dos con el mismo teléfono, y la búsqueda devuelve LAS DOS', async () => {
      // Es el caso que corrige el supuesto de `RN-CRM-01` ("el teléfono es clave única"). Si lo
      // fuera, la segunda no podría existir — o se fusionarían los dos historiales de incidentes
      // y una lista roja de la hija caería sobre la madre.
      const { body: mama } = await registrar({ nombre: 'Carmen Aguilar' }).expect(201);
      const { body: hija } = await registrar({ nombre: 'Sofía Aguilar' }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .query({ telefono: '4421112233' })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(respuesta.body.clientas.map((c: { id: string }) => c.id).sort()).toEqual([mama.id, hija.id].sort());
    });

    it('409 CLIENTA_DUPLICADA con el mismo nombre Y el mismo teléfono', async () => {
      await registrar().expect(201);
      const respuesta = await registrar().expect(409);
      expect(respuesta.body.error.code).toBe('CLIENTA_DUPLICADA');
    });

    it('el teléfono se normaliza: se encuentra con formato internacional', async () => {
      await registrar({ telefono: '+52 442 111 2233' }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .query({ telefono: '4421112233' })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(respuesta.body.clientas).toHaveLength(1);
    });
  });

  describe('cambio de teléfono y reencuentro', () => {
    it('200 al cambiar, y se la reencuentra por nombre + teléfono anterior', async () => {
      const { body: clienta } = await registrar().expect(201);

      const cambiada = await request(app.getHttpServer())
        .post(`${RUTA}/${clienta.id}/telefono`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ nuevoTelefono: '4429998877' })
        .expect(200);

      expect(cambiada.body).toMatchObject({ telefono: '4429998877', telefonoAnterior: '4421112233' });

      const respuesta = await request(app.getHttpServer())
        .get(`${RUTA}/por-telefono-anterior`)
        .query({ nombre: 'Andrea Ramírez', telefonoAnterior: '4421112233' })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(respuesta.body.clientas.map((c: { id: string }) => c.id)).toEqual([clienta.id]);
    });

    it('404 al cambiar el teléfono de una clienta inexistente', async () => {
      await request(app.getHttpServer())
        .post(`${RUTA}/${randomUUID()}/telefono`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ nuevoTelefono: '4429998877' })
        .expect(404);
    });
  });

  describe('detalle con historial', () => {
    it('200 y devuelve la clienta con su lista de incidentes (vacía al principio)', async () => {
      const { body: clienta } = await registrar().expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(`${RUTA}/${clienta.id}`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(respuesta.body.clienta.id).toBe(clienta.id);
      expect(respuesta.body.incidentes).toEqual([]);
    });

    it('404 con una clienta inexistente', async () => {
      await request(app.getHttpServer()).get(`${RUTA}/${randomUUID()}`).set('Authorization', `Bearer ${encargada}`).expect(404);
    });
  });

  describe('LISTA ROJA: FACULTAD EXCLUSIVA DE LA DUEÑA (`DEC-042`)', () => {
    const cambiarEstado = (clientaId: string, accion: string, autorizacion: string) =>
      request(app.getHttpServer())
        .post(`${RUTA}/${clientaId}/estado-de-riesgo`)
        .set('Authorization', `Bearer ${autorizacion}`)
        .send({ accion });

    it('la DUEÑA marca lista roja: 200', async () => {
      const { body: clienta } = await registrar().expect(201);

      const respuesta = await cambiarEstado(clienta.id, 'marcar_lista_roja', dueña).expect(200);
      expect(respuesta.body).toMatchObject({ estadoDeRiesgo: 'lista_roja', sugeridaListaRoja: false });
    });

    it('el SUPER_ADMIN también', async () => {
      const { body: clienta } = await registrar().expect(201);
      await cambiarEstado(clienta.id, 'marcar_bloqueada', superAdmin).expect(200);
    });

    it('403 PARA LA GERENTE: opera el CRM a diario, pero no decide quién paga anticipo', async () => {
      // Es la única asimetría de permisos dentro de este controlador, y la razón de que el
      // `@Roles` vaya por método y no por clase.
      const { body: clienta } = await registrar().expect(201);
      await cambiarEstado(clienta.id, 'marcar_lista_roja', encargada).expect(403);
    });

    it('403 PARA LA MANICURISTA', async () => {
      const { body: clienta } = await registrar().expect(201);
      await cambiarEstado(clienta.id, 'marcar_lista_roja', manicurista).expect(403);
    });

    it('403 para la GERENTE también al REHABILITAR: la salida manual es igual de exclusiva', async () => {
      const { body: clienta } = await registrar().expect(201);
      await cambiarEstado(clienta.id, 'marcar_lista_roja', dueña).expect(200);

      await cambiarEstado(clienta.id, 'rehabilitar', encargada).expect(403);
      await cambiarEstado(clienta.id, 'rehabilitar', dueña).expect(200);
    });

    it('400 con una acción que no existe', async () => {
      const { body: clienta } = await registrar().expect(201);
      await cambiarEstado(clienta.id, 'borrar_del_sistema', dueña).expect(400);
    });

    it('409 al marcar dos veces lo mismo', async () => {
      const { body: clienta } = await registrar().expect(201);
      await cambiarEstado(clienta.id, 'marcar_lista_roja', dueña).expect(200);

      const respuesta = await cambiarEstado(clienta.id, 'marcar_lista_roja', dueña).expect(409);
      expect(respuesta.body.error.code).toBe('CLIENTA_YA_EN_LISTA_ROJA');
    });
  });

  describe('RBAC general', () => {
    it('403 PARA LA MANICURISTA EN TODO EL CONTROLADOR, incluso de lectura', async () => {
      // La Dueña fue explícita: no ve lista roja (`DEC-040`). Aquí todo es información de
      // clientas, así que no entra en ninguna ruta.
      const servidor = app.getHttpServer();
      await request(servidor).get(RUTA).query({ telefono: '4421112233' }).set('Authorization', `Bearer ${manicurista}`).expect(403);
      await request(servidor).get(`${RUTA}/${randomUUID()}`).set('Authorization', `Bearer ${manicurista}`).expect(403);
      await registrar({}, manicurista).expect(403);
    });

    it('403 para la RECEPCIONISTA, por coherencia con el resto de la plataforma', async () => {
      await registrar({}, recepcionista).expect(403);
    });

    it('401 sin token', async () => {
      await request(app.getHttpServer()).get(RUTA).query({ telefono: '4421112233' }).expect(401);
    });

    it('la ENCARGADA sí puede dar de alta y buscar: atiende el teléfono', async () => {
      await registrar({}, encargada).expect(201);
      await request(app.getHttpServer())
        .get(RUTA)
        .query({ telefono: '4421112233' })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);
    });
  });
});
