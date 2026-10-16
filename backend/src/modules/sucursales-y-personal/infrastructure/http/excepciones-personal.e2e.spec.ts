import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { AgendaModule } from '../../../agenda/agenda.module';
import { SucursalesYPersonalModule } from '../../sucursales-y-personal.module';
import { IntegracionModule } from '../../../integracion/integracion.module';
import { AnticiposModule } from '../../../anticipos/anticipos.module';
import { AgenteModule } from '../../../agente/agente.module';
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
import { CrmYClientasModule } from '../../../crm-y-clientas/crm-y-clientas.module';
import { Clienta } from '../../../crm-y-clientas/domain/entities/clienta.entity';
import { DrizzleClientaRepository } from '../../../crm-y-clientas/infrastructure/persistence/drizzle-clienta.repository';

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
  let clienta: Clienta;
  let dueña: string;
  let encargada: string;
  let manicurista: string;
  let recepcionista: string;

  beforeAll(async () => {
    dbDePrueba = await crearBaseDeDatosDePrueba();

    const moduleRef = await Test.createTestingModule({
      /**
       * `AgenteModule` entra porque **`IntegracionModule` arrastra `ConversacionesModule`**, y ese
       * módulo declara `ORQUESTADOR_DE_BOT_PORT` sin proveerlo: lo provee `AgenteModule`, igual
       * que `AppModule`. Sin él, el contenedor no arranca — ruidosamente, que es lo que se quiere:
       * la alternativa (un valor por defecto local en `ConversacionesModule`) hacía que el bot
       * quedara inerte **en silencio**, y ese fue un defecto real. Ver
       * `integracion/sin-defaults-locales.spec.ts`.
       */
      imports: [TestInfraModule, AgendaModule, SucursalesYPersonalModule, CatalogoYCotizacionModule, CrmYClientasModule, AnticiposModule, IntegracionModule, AgenteModule],
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
    encargada = token(Rol.GERENTE, 'encargada');
    manicurista = token(Rol.MANICURISTA, 'ana-usuaria');
    recepcionista = token(Rol.RECEPCIONISTA, 'recepcionista');

    // Clienta real: el adaptador permisivo de `clientaId` desapareció en Fase 3 Parte 1.
    clienta = Clienta.registrar({ nombre: 'Andrea Ramírez', telefono: '4421112233' });
    await new DrizzleClientaRepository(dbDePrueba).guardar(clienta);

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
        clientaId: clienta.id,
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
    const clientaId = clienta.id;
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

  describe('`GET /` — listado (Fase 5 Parte 2)', () => {
    /**
     * Sin esta ruta, **una excepción mal capturada era irreversible desde la interfaz**: para
     * revocarla hace falta su id, y el id solo vivía en la respuesta del `POST` que la creó.
     * `DEC-036` se construyó con tres escrituras y ninguna lectura porque su único consumidor era
     * el `MotorDisponibilidad`, que va al repositorio directamente.
     */
    const listar = (query: Record<string, string>, autorizacion = encargada) =>
      request(app.getHttpServer()).get(BASE).query(query).set('Authorization', `Bearer ${autorizacion}`);

    it('200 con las excepciones que SOLAPAN el rango, y permite revocar con el id devuelto', async () => {
      const { body } = await registrarAusencia().expect(201);

      const respuesta = await listar({ inicio: INICIO, fin: FIN }).expect(200);

      expect(respuesta.body.excepciones).toHaveLength(1);
      expect(respuesta.body.excepciones[0]).toMatchObject({
        id: body.excepcion.id,
        manicuristaId: ana.id,
        tipo: 'ausencia',
        sucursalId: null,
      });

      // El ciclo completo: listar → revocar con el id que vino del listado.
      await request(app.getHttpServer())
        .delete(`${BASE}/${respuesta.body.excepciones[0].id}`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(204);

      expect((await listar({ inicio: INICIO, fin: FIN }).expect(200)).body.excepciones).toHaveLength(0);
    });

    it('NO devuelve las que quedan FUERA del rango', async () => {
      await registrarAusencia().expect(201);

      // Un mes después.
      const despues = new Date(new Date(FIN).getTime() + 30 * 86_400_000).toISOString();
      const muchoDespues = new Date(new Date(FIN).getTime() + 31 * 86_400_000).toISOString();

      expect((await listar({ inicio: despues, fin: muchoDespues }).expect(200)).body.excepciones).toHaveLength(0);
    });

    it('EL FILTRO POR SUCURSAL INCLUYE LAS AUSENCIAS de las manicuristas de esa sucursal', async () => {
      /**
       * **La parte que no es obvia.** Una `ausencia` tiene `sucursal_id = null` —la manicurista no
       * está, punto— mientras que una `cobertura` sí lleva sucursal (su destino). Si el filtro
       * solo comparara `sucursal_id`, **las ausencias desaparecerían del panel justo cuando son
       * el dato que importa**: la Encargada de Lomas abriría su sucursal y no vería que Ana faltó.
       */
      await registrarAusencia().expect(201);

      const deLomas = await listar({ inicio: INICIO, fin: FIN, sucursalId }).expect(200);
      expect(deLomas.body.excepciones).toHaveLength(1);
      expect(deLomas.body.excepciones[0].sucursalId).toBeNull();

      // Y no aparece en la sucursal a la que Ana no está asignada.
      const deJuriquilla = await listar({ inicio: INICIO, fin: FIN, sucursalId: otraSucursalId }).expect(200);
      expect(deJuriquilla.body.excepciones).toHaveLength(0);
    });

    it('una COBERTURA aparece en la sucursal DESTINO', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/coberturas`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ manicuristaId: ana.id, sucursalId: otraSucursalId, inicio: INICIO, fin: FIN })
        .expect(201);

      const destino = await listar({ inicio: INICIO, fin: FIN, sucursalId: otraSucursalId }).expect(200);
      expect(destino.body.excepciones).toHaveLength(1);
      expect(destino.body.excepciones[0]).toMatchObject({ tipo: 'cobertura', sucursalId: otraSucursalId });
    });

    it('400 con un rango invertido o demasiado amplio', async () => {
      await listar({ inicio: FIN, fin: INICIO }).expect(400);

      const muyLejos = new Date(new Date(INICIO).getTime() + 90 * 86_400_000).toISOString();
      const respuesta = await listar({ inicio: INICIO, fin: muyLejos }).expect(400);
      expect(respuesta.body.error.code).toBe('RANGO_DE_CONSULTA_DEMASIADO_AMPLIO');
    });

    it('403 para MANICURISTA y RECEPCIONISTA: mismo criterio que el resto del controlador', async () => {
      for (const autorizacion of [manicurista, recepcionista]) {
        await listar({ inicio: INICIO, fin: FIN }, autorizacion).expect(403);
      }
    });
  });
});
