import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { AgendaModule } from '../../agenda.module';
import { SucursalesYPersonalModule } from '../../../sucursales-y-personal/sucursales-y-personal.module';
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
import { Sucursal } from '../../../sucursales-y-personal/domain/entities/sucursal.entity';
import { Manicurista } from '../../../sucursales-y-personal/domain/entities/manicurista.entity';
import { DrizzleSucursalRepository } from '../../../sucursales-y-personal/infrastructure/persistence/drizzle-sucursal.repository';
import { DrizzleManicuristaRepository } from '../../../sucursales-y-personal/infrastructure/persistence/drizzle-manicurista.repository';
import { horarioAbiertoSiempre } from '../../test-utils/contexto-personal-falso';
import { Servicio } from '../../../catalogo-y-cotizacion/domain/entities/servicio.entity';
import { DrizzleServicioRepository } from '../../../catalogo-y-cotizacion/infrastructure/persistence/drizzle-servicio.repository';
import { CatalogoYCotizacionModule } from '../../../catalogo-y-cotizacion/catalogo-y-cotizacion.module';
import { CrmYClientasModule } from '../../../crm-y-clientas/crm-y-clientas.module';
import { Clienta } from '../../../crm-y-clientas/domain/entities/clienta.entity';
import { DrizzleClientaRepository } from '../../../crm-y-clientas/infrastructure/persistence/drizzle-clienta.repository';

const SECRETO = 'secreto-e2e-agenda';
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

const RUTA = '/v1/agenda/citas';
// `randomUUID` y no literales a mano: `@IsUUID()` exige variante válida (el cuarto grupo empieza
// en [89ab]), así que un `2222-...` escrito a ojo se rechaza con 400 y la prueba mediría el
// validador en vez del caso de uso.
const INICIO = '2026-12-07T10:00:00.000Z';
/** Derivado del catálogo (60 min), no elegido por el cliente. */
const FIN = '2026-12-07T11:00:00.000Z';
const INEXISTENTE = randomUUID();

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

describe('Agenda — Citas E2E (HTTP) — Fase 2', () => {
  let app: INestApplication;
  let sucursalId: string;
  let ana: Manicurista;
  let bea: Manicurista;
  /** Servicio REAL del catálogo: desde esta parte, `servicioId` ya no es un uuid cualquiera. */
  let servicio: Servicio;
  let servicioDeDosHoras: Servicio;
  /**
   * Clienta REAL de CRM. Desde Fase 3, `clientaId` ya no puede ser un uuid cualquiera: el
   * adaptador permisivo desapareció y el agendamiento falla con 404.
   */
  let clienta: Clienta;
  let clientaEnListaRoja: Clienta;
  let clientaBloqueada: Clienta;
  /** Alias del id, para no reescribir las ~40 pruebas que ya usaban `CLIENTA`. */
  let CLIENTA: string;

  /** Token con cada rol. `manicuristaAna` lleva su vínculo de `P9`. */
  let dueña: string;
  let encargada: string;
  let manicuristaAna: string;
  let manicuristaSinVinculo: string;
  let recepcionista: string;

  beforeAll(async () => {
    dbDePrueba = await crearBaseDeDatosDePrueba();

    const moduleRef = await Test.createTestingModule({
      // `IntegracionModule` es parte del montaje real: sin él no hay `CONTEXTO_PERSONAL_PORT` y el
      // motor de disponibilidad no arranca. Que este E2E lo exija es la prueba de que el cableado
      // entre Bounded Contexts funciona de verdad.
      imports: [TestInfraModule, AgendaModule, SucursalesYPersonalModule, CatalogoYCotizacionModule, CrmYClientasModule, IntegracionModule],
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
    // Vacía las tablas y devuelve LA MISMA conexión, así que la app de Nest ya montada sigue
    // sirviendo. Cada prueba parte de cero: aquí la capacidad de la sucursal es el sujeto de
    // estudio, y una silla sobrante de la prueba anterior cambiaría el resultado en silencio.
    await crearBaseDeDatosDePrueba();

    // La sucursal, el personal y las sillas se vuelven a sembrar. Las sillas se crean **por la
    // API**, que es también su prueba de alta.
    const sucursalRepo = new DrizzleSucursalRepository(dbDePrueba);
    const manicuristaRepo = new DrizzleManicuristaRepository(dbDePrueba);

    dueña = token(Rol.ADMINISTRADOR, 'dueña');
    encargada = token(Rol.GERENTE, 'encargada');
    recepcionista = token(Rol.RECEPCIONISTA, 'recepcionista');

    // Servicio de 60 minutos: es la duración que define el `FIN` de todas las pruebas de este
    // archivo, porque el fin ya no lo elige el cliente.
    servicio = Servicio.crear({ nombre: 'Gelish', categoria: 'aplicacion', duracionBaseMinutos: 60, precioBaseCentavos: 45000 });
    // Y uno de dos horas, para la regla 2.2 de la lista de espera.
    servicioDeDosHoras = Servicio.crear({ nombre: 'Acrílico', categoria: 'aplicacion', duracionBaseMinutos: 120, precioBaseCentavos: 78000 });
    const repoServicios = new DrizzleServicioRepository(dbDePrueba);
    await repoServicios.guardar(servicio);
    await repoServicios.guardar(servicioDeDosHoras);

    const repoClientas = new DrizzleClientaRepository(dbDePrueba);
    clienta = Clienta.registrar({ nombre: 'Andrea Ramírez', telefono: '4421112233' });
    clientaEnListaRoja = Clienta.registrar({ nombre: 'Lucía Martínez', telefono: '4422223344' });
    clientaEnListaRoja.marcarListaRoja();
    clientaBloqueada = Clienta.registrar({ nombre: 'Ximena Morales', telefono: '4423334455' });
    clientaBloqueada.marcarBloqueada();
    for (const registro of [clienta, clientaEnListaRoja, clientaBloqueada]) {
      await repoClientas.guardar(registro);
    }
    CLIENTA = clienta.id;

    const sucursal = Sucursal.crear({ nombre: 'Lomas', horarioSemanal: horarioAbiertoSiempre() });
    await sucursalRepo.guardar(sucursal);
    sucursalId = sucursal.id;

    ana = Manicurista.crear({ nombre: 'Ana' });
    bea = Manicurista.crear({ nombre: 'Bea' });
    for (const manicurista of [ana, bea]) {
      await manicuristaRepo.guardar(manicurista);
      await manicuristaRepo.asignarASucursal(manicurista.id, sucursalId);
    }

    manicuristaAna = token(Rol.MANICURISTA, 'ana', ana.id);
    manicuristaSinVinculo = token(Rol.MANICURISTA, 'sin-vinculo', null);

    for (const nombre of ['Lomas 1', 'Lomas 2']) {
      await request(app.getHttpServer())
        .post('/v1/agenda/sillas')
        .set('Authorization', `Bearer ${dueña}`)
        .send({ sucursalId, nombre })
        .expect(201);
    }
  });

  // Sin `async`: devuelve el `Test` de supertest para poder seguir encadenando `.expect(...)`.
  const agendar = (extra: Record<string, unknown> = {}, autorizacion = encargada) =>
    request(app.getHttpServer())
      .post(RUTA)
      .set('Authorization', `Bearer ${autorizacion}`)
      // Sin `fin`: lo deriva el backend de la duración del catálogo.
      .send({ sucursalId, servicioId: servicio.id, clientaId: CLIENTA, inicio: INICIO, ...extra });

  describe('alta de citas', () => {
    it('201 y elige silla sola: la clienta nunca eligió silla', async () => {
      const respuesta = await agendar().expect(201);

      expect(respuesta.body).toMatchObject({ estado: 'agendada', sucursalId, manicuristaId: null });
      expect(respuesta.body.sillaId).toBeDefined();
    });

    it('400 si falta un campo obligatorio', async () => {
      await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ sucursalId, servicioId: servicio.id, inicio: INICIO })
        .expect(400);
    });

    it('400 si la fecha no es ISO-8601 con zona', async () => {
      await agendar({ inicio: '7 de diciembre a las 10' }).expect(400);
    });

    it('400 ante un campo no declarado: el DTO no es un buzón abierto', async () => {
      await agendar({ precioInventado: 1 }).expect(400);
    });

    it('409 cuando la sucursal se llena: 2 sillas, la tercera simultánea no cabe', async () => {
      await agendar().expect(201);
      await agendar().expect(201);

      const respuesta = await agendar().expect(409);
      expect(respuesta.body.error.code).toBe('HORARIO_NO_DISPONIBLE');
    });

    it('403 si la pide una RECEPCIONISTA: agendar no es su rol en esta API', async () => {
      await agendar({}, recepcionista).expect(403);
    });
  });

  describe('integridad del catálogo (`ADR-005` no permite FK entre esquemas)', () => {
    it('404 CON UN `servicioId` QUE NO EXISTE: antes se agendaba igual', async () => {
      // Este era el hueco más grande de la API de Agenda: el único filtro sobre `servicioId` era
      // el formato del uuid, así que se podía vender una cita de un servicio inventado.
      const respuesta = await agendar({ servicioId: randomUUID() }).expect(404);
      expect(respuesta.body.error.code).toBe('RECURSO_NO_ENCONTRADO');
    });

    it('409 SERVICIO_INACTIVO con un servicio dado de baja del catálogo', async () => {
      const repo = new DrizzleServicioRepository(dbDePrueba);
      const deBaja = Servicio.crear({ nombre: 'Uñas de porcelana', categoria: 'aplicacion', duracionBaseMinutos: 60, precioBaseCentavos: 60000 });
      deBaja.desactivar();
      await repo.guardar(deBaja);

      const respuesta = await agendar({ servicioId: deBaja.id }).expect(409);
      expect(respuesta.body.error.code).toBe('SERVICIO_INACTIVO');
    });

    it('DERIVA EL FIN de la duración del catálogo cuando el cliente no lo manda', async () => {
      const respuesta = await agendar().expect(201);

      expect(respuesta.body.inicio).toBe(INICIO);
      expect(respuesta.body.fin).toBe(FIN);
    });

    it('409 SI EL CLIENTE PIDE UNA DURACIÓN DISTINTA A LA DEL SERVICIO', async () => {
      // Pedir media hora para un servicio de una hora dejaría la silla libre a mitad del trabajo.
      const respuesta = await agendar({ fin: '2026-12-07T10:30:00.000Z' }).expect(409);

      expect(respuesta.body.error.code).toBe('DURACION_NO_COINCIDE_CON_SERVICIO');
      expect(respuesta.body.error.message).toContain('60 minutos');
    });

    it('acepta un `fin` que coincide: el cliente antiguo que lo manda sigue funcionando', async () => {
      await agendar({ fin: FIN }).expect(201);
    });

    it('CONGELA LA COTIZACIÓN DESDE EL CATÁLOGO, no desde el payload', async () => {
      const respuesta = await agendar().expect(201);

      expect(respuesta.body.cotizacionSnapshot).toMatchObject({
        version: 1,
        totalCentavos: 45000,
        requiereCotizacionManual: false,
        incluyeModificadores: false,
        servicio: { id: servicio.id, nombre: 'Gelish', duracionMinutos: 60, precioCentavos: 45000 },
      });
    });

    it('400 si el cliente intenta enviar `cotizacionSnapshot`: los precios no vienen de fuera', async () => {
      // El DTO no declara el campo, así que `forbidNonWhitelisted` lo rechaza. Es el mismo
      // principio que rige para OpenAI: el backend es la única autoridad sobre precios.
      await agendar({ cotizacionSnapshot: { totalCentavos: 1 } }).expect(400);
    });

    it('`DEC-033`: con cotización manual el total viaja como `null`, no como un precio inventado', async () => {
      const repo = new DrizzleServicioRepository(dbDePrueba);
      const manual = Servicio.crear({
        nombre: 'Diseño personalizado',
        categoria: 'aplicacion',
        duracionBaseMinutos: 60,
        precioBaseCentavos: 90000,
        requiereCotizacionManual: true,
      });
      await repo.guardar(manual);

      const respuesta = await agendar({ servicioId: manual.id }).expect(201);

      expect(respuesta.body.cotizacionSnapshot.totalCentavos).toBeNull();
      expect(respuesta.body.cotizacionSnapshot.requiereCotizacionManual).toBe(true);
    });

    it('al reprogramar se revalida el catálogo y NO se recotiza (`RN-AGE-08`)', async () => {
      const { body: cita } = await agendar().expect(201);

      // Sube el precio del catálogo después de agendar.
      const repo = new DrizzleServicioRepository(dbDePrueba);
      const guardado = (await repo.buscarPorId(servicio.id))!;
      guardado.actualizarDatos({ precioBaseCentavos: 99900 });
      await repo.guardar(guardado);

      const respuesta = await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/reprogramar`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ inicio: '2026-12-08T10:00:00.000Z' })
        .expect(201);

      // La clienta conserva el precio que se le dijo: mover la hora no es una venta nueva.
      expect(respuesta.body.nueva.cotizacionSnapshot.totalCentavos).toBe(45000);
      expect(respuesta.body.nueva.fin).toBe('2026-12-08T11:00:00.000Z');
    });

    it('409 al reprogramar con una duración que no corresponde al servicio', async () => {
      const { body: cita } = await agendar().expect(201);

      const respuesta = await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/reprogramar`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ inicio: '2026-12-08T10:00:00.000Z', fin: '2026-12-08T12:00:00.000Z' })
        .expect(409);

      expect(respuesta.body.error.code).toBe('DURACION_NO_COINCIDE_CON_SERVICIO');
    });
  });

  describe('acotación y paginación del `GET` (deuda 5 de §16)', () => {
    it('400 si el rango abarca más de 31 días: un año devolvería la sucursal entera', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: '2026-01-01T00:00:00.000Z', fin: '2026-12-31T00:00:00.000Z' })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(400);

      expect(respuesta.body.error.code).toBe('RANGO_DE_CONSULTA_DEMASIADO_AMPLIO');
    });

    it('400 si el fin no es posterior al inicio', async () => {
      await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: FIN, fin: INICIO })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(400);
    });

    it('400 si `sucursalId` no es un uuid: antes llegaba sin validar hasta la consulta', async () => {
      await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId: 'la-de-lomas', inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(400);
    });

    it('400 si `limite` excede el tope duro', async () => {
      await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN, limite: 5000 })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(400);
    });

    it('pagina de verdad: con 2 citas y `limite=1` hay dos páginas distintas', async () => {
      const { body: primera } = await agendar().expect(201);
      const { body: segunda } = await agendar().expect(201);

      const pagina = (desplazamiento: number) =>
        request(app.getHttpServer())
          .get(RUTA)
          .query({ sucursalId, inicio: INICIO, fin: FIN, limite: 1, desplazamiento })
          .set('Authorization', `Bearer ${encargada}`)
          .expect(200);

      const uno = await pagina(0);
      const dos = await pagina(1);

      expect(uno.body.citas).toHaveLength(1);
      expect(uno.body.hayMas).toBe(true);
      expect(dos.body.citas).toHaveLength(1);
      // `hayMas` es `false` en la última: se pide una fila extra, no se cuenta el total.
      expect(dos.body.hayMas).toBe(false);
      // Sin solaparse ni repetirse, gracias al orden estable de la consulta.
      expect([uno.body.citas[0].id, dos.body.citas[0].id].sort()).toEqual([primera.id, segunda.id].sort());
    });

    it('LA MANICURISTA NO PIERDE SUS CITAS POR PAGINACIÓN: el filtro va en SQL, no en memoria', async () => {
      // El caso que esto atrapa: si el filtro se aplicara DESPUÉS del `LIMIT`, Ana vería su
      // página 1 vacía —porque la ocuparían las citas de Bea— y concluiría que no tiene trabajo.
      await agendar({ manicuristaId: bea.id }).expect(201);
      const { body: suya } = await agendar({ manicuristaId: ana.id }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN, limite: 1 })
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .expect(200);

      expect(respuesta.body.citas).toHaveLength(1);
      expect(respuesta.body.citas[0].id).toBe(suya.id);
    });
  });

  describe('ciclo de vida', () => {
    it('200 al confirmar y 409 al confirmar dos veces (transición ilegal)', async () => {
      const { body: cita } = await agendar().expect(201);
      const ruta = `${RUTA}/${cita.id}/confirmar`;

      // `agendada -> confirmada` NO es legal: la confirmación se pide primero (`DEC-034`). La cita
      // pasa por `pendiente_confirmacion` y solo desde ahí se confirma.
      const solicitada = await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/solicitar-confirmacion`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);
      expect(solicitada.body.estado).toBe('pendiente_confirmacion');

      const confirmada = await request(app.getHttpServer()).post(ruta).set('Authorization', `Bearer ${encargada}`).expect(200);
      expect(confirmada.body.estado).toBe('confirmada');

      const repetida = await request(app.getHttpServer()).post(ruta).set('Authorization', `Bearer ${encargada}`).expect(409);
      expect(repetida.body.error.code).toBe('TRANSICION_ESTADO_INVALIDA');
    });

    it('409 al confirmar una cita recién agendada: hay que solicitar la confirmación primero', async () => {
      const { body: cita } = await agendar().expect(201);

      const respuesta = await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/confirmar`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(409);

      expect(respuesta.body.error.code).toBe('TRANSICION_ESTADO_INVALIDA');
    });

    it('404 al operar sobre una cita que no existe', async () => {
      await request(app.getHttpServer())
        .post(`${RUTA}/${INEXISTENTE}/confirmar`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(404);
    });

    it('200 al completar, y el cuerpo refleja el estado final', async () => {
      const { body: cita } = await agendar().expect(201);

      const respuesta = await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/completar`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(respuesta.body.estado).toBe('completada');
    });

    it('cancelar devuelve `incidenteTardio` (`RN-CRM-06`) sin marcar lista roja', async () => {
      const { body: cita } = await agendar().expect(201);

      const respuesta = await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/cancelar`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ motivo: 'La clienta avisó' })
        .expect(200);

      expect(respuesta.body).toHaveProperty('incidenteTardio');
      expect(respuesta.body.cita.estado).toBe('cancelada');
    });
  });

  describe('RBAC de la vista de iPad (`DEC-040`)', () => {
    it('la MANICURISTA SOLO VE SUS PROPIAS CITAS, aunque la sucursal tenga más', async () => {
      const { body: suya } = await agendar({ manicuristaId: ana.id }).expect(201);
      await agendar({ manicuristaId: bea.id }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .expect(200);

      expect(respuesta.body.citas).toHaveLength(1);
      expect(respuesta.body.citas[0].id).toBe(suya.id);
    });

    it('400 AL INTENTAR PASAR `manicuristaId` EN LA QUERY: el parámetro no existe', async () => {
      await agendar({ manicuristaId: bea.id }).expect(201);

      // Desde que el `GET` tiene DTO, un parámetro no declarado se rechaza en vez de ignorarse.
      // Es más fuerte que ignorarlo: quien lo intenta se entera de que ese filtro no se acepta,
      // en lugar de creer que se aplicó. El filtro sale de los permisos, nunca de la petición.
      await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN, manicuristaId: bea.id })
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .expect(400);
    });

    it('y sin ese parámetro tampoco ve la agenda de Bea: el filtro es el de sus permisos', async () => {
      await agendar({ manicuristaId: bea.id }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .expect(200);

      expect(respuesta.body.citas).toEqual([]);
    });

    it('SU DTO NO LLEVA DATOS DE LA CLIENTA, pero sí precios', async () => {
      await agendar({ manicuristaId: ana.id }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .expect(200);

      const cita = respuesta.body.citas[0];
      // `clientaId` es la llave por la que se consultaría el historial y la clasificación de la
      // clienta — incluida la lista roja. No viaja al iPad.
      expect(cita).not.toHaveProperty('clientaId');
      expect(cita).not.toHaveProperty('numeroDeReprogramaciones');
      // Precios sí: la Dueña fue explícita.
      expect(cita).toHaveProperty('cotizacionSnapshot');
      expect(JSON.stringify(cita)).not.toContain(CLIENTA);
    });

    it('una MANICURISTA sin vínculo `manicuristaId` no ve NADA (lado seguro del error)', async () => {
      await agendar({ manicuristaId: ana.id }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${manicuristaSinVinculo}`)
        .expect(200);

      expect(respuesta.body.citas).toEqual([]);
    });

    it('403 AL CANCELAR: la vista de iPad es estrictamente de solo lectura', async () => {
      const { body: cita } = await agendar({ manicuristaId: ana.id }).expect(201);

      await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/cancelar`)
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .send({ motivo: 'No quiero atenderla' })
        .expect(403);
    });

    it('403 AL COMPLETAR: la manicurista no marca finalización (`DEC-040`)', async () => {
      const { body: cita } = await agendar({ manicuristaId: ana.id }).expect(201);

      await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/completar`)
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .expect(403);
    });

    it('403 al agendar, al reprogramar y al marcar no-show', async () => {
      const { body: cita } = await agendar({ manicuristaId: ana.id }).expect(201);
      const servidor = app.getHttpServer();

      await agendar({}, manicuristaAna).expect(403);
      await request(servidor)
        .post(`${RUTA}/${cita.id}/reprogramar`)
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .send({ inicio: '2026-12-08T10:00:00.000Z', fin: '2026-12-08T11:00:00.000Z' })
        .expect(403);
      await request(servidor).post(`${RUTA}/${cita.id}/no-show`).set('Authorization', `Bearer ${manicuristaAna}`).expect(403);
    });

    it('403 al dar de alta una silla: no amplía la capacidad del salón', async () => {
      await request(app.getHttpServer())
        .post('/v1/agenda/sillas')
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .send({ sucursalId, nombre: 'Silla pirata' })
        .expect(403);
    });

    it('401 sin token', async () => {
      await request(app.getHttpServer()).get(RUTA).query({ sucursalId, inicio: INICIO, fin: FIN }).expect(401);
    });
  });

  describe('integración con CRM (`RN-CRM-04`, `RN-ANT-01`) — Fase 3 Parte 1', () => {
    it('404 CON UN `clientaId` INEXISTENTE: se retiró el adaptador permisivo', async () => {
      const respuesta = await agendar({ clientaId: randomUUID() }).expect(404);
      expect(respuesta.body.error.code).toBe('RECURSO_NO_ENCONTRADO');
    });

    it('409 CLIENTA_BLOQUEADA (`RN-CRM-04`): el caso se escala a una persona', async () => {
      const respuesta = await agendar({ clientaId: clientaBloqueada.id }).expect(409);
      expect(respuesta.body.error.code).toBe('CLIENTA_BLOQUEADA');
    });

    it('LISTA ROJA: LA CITA NACE `en_espera_pago` (`RN-ANT-01`), no `agendada`', async () => {
      const respuesta = await agendar({ clientaId: clientaEnListaRoja.id }).expect(201);
      expect(respuesta.body.estado).toBe('en_espera_pago');
    });

    it('y esa cita SE VE en la agenda aunque `en_espera_pago` libere horario', async () => {
      // El fallo que esto atrapa: filtrando la vista por "estados que ocupan", las citas
      // pendientes de anticipo eran invisibles — justo las que hay que perseguir para cobrar.
      const { body: cita } = await agendar({ clientaId: clientaEnListaRoja.id }).expect(201);

      const agendaDelDia = await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(agendaDelDia.body.citas.map((c: { id: string }) => c.id)).toContain(cita.id);
    });

    it('LA ENCARGADA VE `enListaRoja`; la MANICURISTA NO RECIBE EL CAMPO', async () => {
      await agendar({ clientaId: clientaEnListaRoja.id, manicuristaId: ana.id }).expect(201);

      const paraLaEncargada = await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);
      expect(paraLaEncargada.body.citas[0].enListaRoja).toBe(true);

      const paraElIpad = await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${manicuristaAna}`)
        .expect(200);

      expect(paraElIpad.body.citas).toHaveLength(1);
      expect(paraElIpad.body.citas[0]).not.toHaveProperty('enListaRoja');
      expect(paraElIpad.body.citas[0]).not.toHaveProperty('clientaId');
    });

    it('una clienta `normal` sigue naciendo `agendada` y con `enListaRoja: false`', async () => {
      await agendar().expect(201);

      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .query({ sucursalId, inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(respuesta.body.citas[0]).toMatchObject({ estado: 'agendada', enListaRoja: false });
    });
  });

  describe('lista de espera (`DEC-039`)', () => {
    const LISTA = '/v1/agenda/lista-espera';
    /** La fecha de pared en Querétaro de `INICIO` (10:00 UTC del 7 de diciembre). */
    const FECHA = '2026-12-07';

    /**
     * Cada inscripción necesita una clienta REAL y **distinta**: el índice único impide que la
     * misma se apunte dos veces al mismo servicio, sucursal y fecha. Antes bastaba un
     * `randomUUID()`; desde Fase 3 el adaptador contra CRM es real y un uuid inventado da 404.
     *
     * Se siembran por adelantado para que `inscribir` siga siendo **encadenable**: si creara la
     * clienta dentro, tendría que ser `async`, y como el `Test` de supertest es *thenable*, el
     * `await` colapsaría el `Test` en un `Response` y `.expect(201)` dejaría de existir.
     */
    const clientasDeFila: string[] = [];

    beforeEach(async () => {
      clientasDeFila.length = 0;
      const repo = new DrizzleClientaRepository(dbDePrueba);
      for (let i = 1; i <= 6; i += 1) {
        const nueva = Clienta.registrar({ nombre: `Clienta de fila ${i}`, telefono: `442880000${i}` });
        await repo.guardar(nueva);
        clientasDeFila.push(nueva.id);
      }
    });

    let siguiente = 0;
    const inscribir = (cuerpo: Record<string, unknown> = {}, autorizacion = encargada) => {
      const clientaId = clientasDeFila[siguiente++ % clientasDeFila.length];
      return request(app.getHttpServer())
        .post(LISTA)
        .set('Authorization', `Bearer ${autorizacion}`)
        .send({ sucursalId, clientaId, servicioId: servicio.id, fecha: FECHA, ...cuerpo });
    };

    it('201 al inscribir y 200 al consultar la fila', async () => {
      const alta = await inscribir().expect(201);
      expect(alta.body).toMatchObject({ estado: 'en_espera', fecha: FECHA, expiraEn: null });

      const fila = await request(app.getHttpServer())
        .get(LISTA)
        .query({ sucursalId, fecha: FECHA })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(fila.body.solicitudes).toHaveLength(1);
    });

    it('400 si la fecha no es `YYYY-MM-DD`: la clienta pide un día, no un instante', async () => {
      await inscribir({ fecha: '2026-12-07T10:00:00.000Z' }).expect(400);
    });

    it('404 con un servicio que no existe', async () => {
      await inscribir({ servicioId: randomUUID() }).expect(404);
    });

    it('EL CASO DE LA REGLA 2.2 POR HTTP: hueco de 1h salta a la de 2h y ofrece a la de 1h', async () => {
      // Dos citas consecutivas sobre las dos sillas existentes a las 11:00, de modo que al
      // cancelar la de las 10:00 el hueco real sea de una hora.
      const { body: diezAOnce } = await agendar().expect(201);
      await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ sucursalId, servicioId: servicio.id, clientaId: CLIENTA, inicio: FIN })
        .expect(201);
      await request(app.getHttpServer())
        .post(RUTA)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ sucursalId, servicioId: servicio.id, clientaId: CLIENTA, inicio: FIN })
        .expect(201);

      const { body: deDosHoras } = await inscribir({ servicioId: servicioDeDosHoras.id }).expect(201);
      const { body: deUnaHora } = await inscribir().expect(201);

      await request(app.getHttpServer())
        .post(`${RUTA}/${diezAOnce.id}/cancelar`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      const fila = await request(app.getHttpServer())
        .get(LISTA)
        .query({ sucursalId, fecha: FECHA })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      const porId = new Map(fila.body.solicitudes.map((s: { id: string }) => [s.id, s]));
      expect(porId.get(deUnaHora.id)).toMatchObject({ estado: 'notificada' });
      // La de dos horas no cabía y conserva su lugar sin penalización.
      expect(porId.get(deDosHoras.id)).toMatchObject({ estado: 'en_espera', expiraEn: null });
    });

    it('201 al aceptar la oferta: agenda la cita de verdad', async () => {
      const { body: cita } = await agendar().expect(201);
      const { body: solicitud } = await inscribir().expect(201);

      await request(app.getHttpServer())
        .post(`${RUTA}/${cita.id}/cancelar`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      const aceptada = await request(app.getHttpServer())
        .post(`${LISTA}/${solicitud.id}/aceptar`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ inicio: INICIO })
        .expect(201);

      expect(aceptada.body.solicitud.estado).toBe('aceptada');
      expect(aceptada.body.cita.id).toBe(aceptada.body.solicitud.citaId);
      // Hereda todo de `AgendarCitaUseCase`, incluida la cotización congelada.
      expect(aceptada.body.cita.cotizacionSnapshot).toMatchObject({ totalCentavos: 45000 });
    });

    it('409 al aceptar una solicitud que nunca recibió oferta', async () => {
      const { body: solicitud } = await inscribir().expect(201);

      const respuesta = await request(app.getHttpServer())
        .post(`${LISTA}/${solicitud.id}/aceptar`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ inicio: INICIO })
        .expect(409);

      expect(respuesta.body.error.code).toBe('LISTA_ESPERA_TRANSICION_INVALIDA');
    });

    it('404 al aceptar una solicitud inexistente', async () => {
      await request(app.getHttpServer())
        .post(`${LISTA}/${randomUUID()}/aceptar`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ inicio: INICIO })
        .expect(404);
    });

    it('200 en `avanzar-turno`: es el sustituto del planificador que no existe', async () => {
      const respuesta = await request(app.getHttpServer())
        .post(`${LISTA}/avanzar-turno`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({})
        .expect(200);

      expect(respuesta.body).toEqual({ expiradas: [], nuevasOfertas: [] });
    });

    it('400 si `minutosDeVentana` excede el tope de 24 horas', async () => {
      await request(app.getHttpServer())
        .post(`${LISTA}/avanzar-turno`)
        .set('Authorization', `Bearer ${encargada}`)
        .send({ minutosDeVentana: 99999 })
        .expect(400);
    });

    it('204 al darse de baja de la fila', async () => {
      const { body: solicitud } = await inscribir().expect(201);

      await request(app.getHttpServer())
        .delete(`${LISTA}/${solicitud.id}`)
        .set('Authorization', `Bearer ${encargada}`)
        .expect(204);

      const fila = await request(app.getHttpServer())
        .get(LISTA)
        .query({ sucursalId, fecha: FECHA })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);
      expect(fila.body.solicitudes).toEqual([]);
    });

    describe('RBAC', () => {
      it('403 PARA LA MANICURISTA, incluso de lectura: la fila lleva datos de clientas', async () => {
        // Su vista de iPad no transporta `clientaId` por diseño (`DEC-040`), y la fila está llena
        // de clientas que además no son las suyas.
        await request(app.getHttpServer())
          .get(LISTA)
          .query({ sucursalId, fecha: FECHA })
          .set('Authorization', `Bearer ${manicuristaAna}`)
          .expect(403);
      });

      it('403 para la RECEPCIONISTA, por coherencia con el resto de la API de Agenda', async () => {
        await inscribir({}, recepcionista).expect(403);
      });

      it('401 sin token', async () => {
        await request(app.getHttpServer()).get(LISTA).query({ sucursalId, fecha: FECHA }).expect(401);
      });

      it('la DUEÑA sí puede operar la fila', async () => {
        await inscribir({}, dueña).expect(201);
      });
    });
  });

  describe('sillas y disponibilidad', () => {
    it('200 y lista las sillas de la sucursal', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/v1/agenda/sillas')
        .query({ sucursalId })
        .set('Authorization', `Bearer ${dueña}`)
        .expect(200);

      expect(respuesta.body.sillas).toHaveLength(2);
      expect(respuesta.body.sillas.every((s: { activa: boolean }) => s.activa)).toBe(true);
    });

    it('DESACTIVAR UNA SILLA REDUCE LA CAPACIDAD VENDIBLE, no solo cambia una bandera', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/v1/agenda/sillas')
        .query({ sucursalId })
        .set('Authorization', `Bearer ${dueña}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/v1/agenda/sillas/${body.sillas[0].id}/desactivar`)
        .set('Authorization', `Bearer ${dueña}`)
        .expect(200);

      await agendar().expect(201);
      // Con una sola silla activa, la segunda simultánea ya no cabe.
      await agendar().expect(409);
    });

    it('404 al desactivar una silla inexistente', async () => {
      await request(app.getHttpServer())
        .post(`/v1/agenda/sillas/${INEXISTENTE}/desactivar`)
        .set('Authorization', `Bearer ${dueña}`)
        .expect(404);
    });

    it('la disponibilidad cruza sillas contra personal: 2 sillas y 2 manicuristas dan capacidad 2', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/v1/agenda/disponibilidad')
        .query({ sucursalId, inicio: INICIO, fin: FIN })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(200);

      expect(respuesta.body).toMatchObject({ sillasLibres: 2, manicuristasDisponibles: 2, capacidad: 2, hayLugar: true });
    });
  });
});
