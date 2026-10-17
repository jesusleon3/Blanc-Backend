import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

import { AnaliticaModule } from './analitica.module';
import { AgendaModule } from '../agenda/agenda.module';
import { AnticiposModule } from '../anticipos/anticipos.module';
import { ConversacionesModule } from '../conversaciones/conversaciones.module';
import { CatalogoYCotizacionModule } from '../catalogo-y-cotizacion/catalogo-y-cotizacion.module';
import { CrmYClientasModule } from '../crm-y-clientas/crm-y-clientas.module';
import { SucursalesYPersonalModule } from '../sucursales-y-personal/sucursales-y-personal.module';
import { IntegracionModule } from '../integracion/integracion.module';
import { AgenteModule } from '../agente/agente.module';

import { Sucursal } from '../sucursales-y-personal/domain/entities/sucursal.entity';
import { Manicurista } from '../sucursales-y-personal/domain/entities/manicurista.entity';
import { DrizzleSucursalRepository } from '../sucursales-y-personal/infrastructure/persistence/drizzle-sucursal.repository';
import { DrizzleManicuristaRepository } from '../sucursales-y-personal/infrastructure/persistence/drizzle-manicurista.repository';
import { horarioAbiertoSiempre } from '../agenda/test-utils/contexto-personal-falso';
import { Servicio } from '../catalogo-y-cotizacion/domain/entities/servicio.entity';
import { DrizzleServicioRepository } from '../catalogo-y-cotizacion/infrastructure/persistence/drizzle-servicio.repository';
import { Clienta } from '../crm-y-clientas/domain/entities/clienta.entity';
import { DrizzleClientaRepository } from '../crm-y-clientas/infrastructure/persistence/drizzle-clienta.repository';
import { DrizzleConversacionRepository } from '../conversaciones/infrastructure/persistence/drizzle-conversacion.repository';
import { Conversacion } from '../conversaciones/domain/entities/conversacion.entity';

import { DATABASE_CONNECTION } from '../../database/database.module';
import { Database } from '../../database/connection';
import { AUDITORIA_PORT } from '../../shared/auditoria/auditoria.port';
import { DrizzleAuditoriaRepository } from '../../shared/auditoria/drizzle-auditoria.repository';
import { UNIT_OF_WORK } from '../../shared/persistence/unit-of-work.port';
import { DrizzleUnitOfWork } from '../../shared/persistence/drizzle-unit-of-work';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { AuthorizationGuard } from '../../shared/auth/authorization.guard';
import { PermisosUsuario, PermisosUsuarioPort } from '../../shared/auth/permisos-usuario.port';
import { RolesGuard } from '../../shared/auth/roles.guard';
import { Rol } from '../../shared/auth/rol';
import { HttpExceptionFilter } from '../../shared/errors/http-exception.filter';
import { crearBaseDeDatosDePrueba } from '../../database/test-utils/postgres-de-prueba';

const SECRETO = 'secreto-e2e-analitica';
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

const RUTA = '/v1/analitica/resumen';

/**
 * Las fechas se ancl**an al reloj real**, no a una constante de 2027.
 *
 * ## POR QUÉ, Y ES UN HALLAZGO SOBRE EL DISEÑO, NO SOBRE LA PRUEBA
 *
 * Los tres reportes **no usan el mismo eje de tiempo**, y no pueden:
 *
 * - El de **citas** filtra por `lower(rango_horario)` — *cuándo es la cita*.
 * - El de **anticipos** y la **lista de espera** filtran por `creado_en` — *cuándo se registró la
 *   fila*, porque un anticipo no tiene fecha de servicio propia.
 *
 * Con citas sembradas a cinco meses vista, las dos cosas caían en rangos distintos: las citas
 * dentro y sus anticipos fuera, y el reporte parecía roto. **No lo está** — es que "los anticipos
 * de marzo" significa los creados en marzo, no los de las citas de marzo. En un reporte mensual de
 * actividad pasada coinciden; en datos del futuro, no.
 *
 * Anclar al reloj real reproduce el uso real (*"el último mes"*) y de paso deja esto documentado.
 * La advertencia correspondiente viaja en la respuesta.
 */
const AHORA_REAL = Date.now();
const haceDias = (dias: number) => new Date(AHORA_REAL - dias * 86_400_000).toISOString();
const enDias = (dias: number) => new Date(AHORA_REAL + dias * 86_400_000).toISOString();
const DESDE = haceDias(30);
const HASTA = enDias(1);
/** Hora de una cita sembrada: ayer, para que sea actividad pasada realista. */
const horaDeCita = (horasDesplazadas: number) => new Date(AHORA_REAL - 86_400_000 + horasDesplazadas * 3_600_000).toISOString();

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

/**
 * Analítica de extremo a extremo, **con datos reales en los cuatro esquemas**.
 *
 * ## POR QUÉ SE MONTA EL GRAFO COMPLETO
 *
 * Lo que este archivo tiene que demostrar no es que las consultas agreguen bien —eso se vería con
 * un reporte suelto— sino que **el cruce funciona sin romper `ADR-005`**: tres contextos agregando
 * su propio esquema y `AnaliticaModule` componiendo. Con reportes dobles, la prueba no diría nada
 * sobre eso.
 *
 * Las citas, los anticipos y las conversaciones se siembran **por los casos de uso reales**, no
 * insertando filas: así los estados y los `cotizacion_snapshot` tienen la forma que el sistema
 * produce de verdad.
 */
describe('Analítica — resumen ejecutivo E2E (Fase 6)', () => {
  let app: INestApplication;
  let sucursalId: string;
  let otraSucursalId: string;
  let ana: Manicurista;
  let servicio: Servicio;
  let servicioManual: Servicio;
  let clienta: Clienta;
  let dueña: string;
  let encargada: string;
  let manicurista: string;

  beforeAll(async () => {
    dbDePrueba = await crearBaseDeDatosDePrueba();

    const moduleRef = await Test.createTestingModule({
      imports: [
        TestInfraModule,
        SucursalesYPersonalModule,
        CatalogoYCotizacionModule,
        AgendaModule,
        CrmYClientasModule,
        AnticiposModule,
        ConversacionesModule,
        IntegracionModule,
        AgenteModule,
        AnaliticaModule,
      ],
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
    await app.listen(0);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await crearBaseDeDatosDePrueba();

    dueña = token(Rol.ADMINISTRADOR, 'dueña');
    encargada = token(Rol.GERENTE, 'encargada');
    manicurista = token(Rol.MANICURISTA, 'ana-ipad');

    const sucursalRepo = new DrizzleSucursalRepository(dbDePrueba);
    const lomas = Sucursal.crear({ nombre: 'Lomas', horarioSemanal: horarioAbiertoSiempre() });
    const zibata = Sucursal.crear({ nombre: 'Zibatá', horarioSemanal: horarioAbiertoSiempre() });
    await sucursalRepo.guardar(lomas);
    await sucursalRepo.guardar(zibata);
    sucursalId = lomas.id;
    otraSucursalId = zibata.id;

    const manicuristaRepo = new DrizzleManicuristaRepository(dbDePrueba);
    ana = Manicurista.crear({ nombre: 'Ana' });
    await manicuristaRepo.guardar(ana);
    await manicuristaRepo.asignarASucursal(ana.id, sucursalId);

    // Zibatá también necesita personal: la capacidad es el MÍNIMO entre sillas y manicuristas, así
    // que una sucursal con sillas y sin nadie asignado no vende nada (`HORARIO_NO_DISPONIBLE`).
    const bea = Manicurista.crear({ nombre: 'Bea' });
    await manicuristaRepo.guardar(bea);
    await manicuristaRepo.asignarASucursal(bea.id, otraSucursalId);

    const servicioRepo = new DrizzleServicioRepository(dbDePrueba);
    servicio = Servicio.crear({ nombre: 'Gelish', categoria: 'manos', duracionBaseMinutos: 60, precioBaseCentavos: 45000 });
    servicioManual = Servicio.crear({
      nombre: 'Diseño artístico',
      categoria: 'manos',
      duracionBaseMinutos: 90,
      precioBaseCentavos: 80000,
      requiereCotizacionManual: true,
    });
    await servicioRepo.guardar(servicio);
    await servicioRepo.guardar(servicioManual);

    clienta = Clienta.registrar({ nombre: 'Andrea Ramírez', telefono: '4421112233' });
    await new DrizzleClientaRepository(dbDePrueba).guardar(clienta);

    for (const nombre of ['Lomas 1', 'Lomas 2', 'Lomas 3']) {
      await request(app.getHttpServer())
        .post('/v1/agenda/sillas')
        .set('Authorization', `Bearer ${dueña}`)
        .send({ sucursalId, nombre })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/v1/agenda/sillas')
      .set('Authorization', `Bearer ${dueña}`)
      .send({ sucursalId: otraSucursalId, nombre: 'Zibatá 1' })
      .expect(201);
  });

  /** Agenda por la API, como lo haría la Encargada. */
  const agendar = async (hora: string, extra: Record<string, unknown> = {}) =>
    (
      await request(app.getHttpServer())
        .post('/v1/agenda/citas')
        .set('Authorization', `Bearer ${encargada}`)
        .send({ sucursalId, servicioId: servicio.id, clientaId: clienta.id, inicio: horaDeCita(Number(hora)), ...extra })
        .expect(201)
    ).body as { id: string; estado: string };

  const accion = (citaId: string, ruta: string, cuerpo: Record<string, unknown> = {}) =>
    request(app.getHttpServer()).post(`/v1/agenda/citas/${citaId}/${ruta}`).set('Authorization', `Bearer ${encargada}`).send(cuerpo);

  const resumen = async (query: Record<string, string> = {}, autorizacion = dueña) =>
    (
      await request(app.getHttpServer())
        .get(RUTA)
        .query({ desde: DESDE, hasta: HASTA, ...query })
        .set('Authorization', `Bearer ${autorizacion}`)
        .expect(200)
    ).body;

  describe('RBAC — exclusivo de Administración', () => {
    it('la DUEÑA entra', async () => {
      await request(app.getHttpServer()).get(RUTA).query({ desde: DESDE, hasta: HASTA }).set('Authorization', `Bearer ${dueña}`).expect(200);
    });

    it('la ENCARGADA recibe 403, aunque entre a todo lo demás del panel', async () => {
      /**
       * Es más estricto que el resto del panel, y el motivo decisivo es el **desglose por
       * manicurista**: *"cuántas citas completó cada una"* es una medida del trabajo de sus
       * compañeras, y darla a quien no decide sobre su contratación es una fuga de un dato
       * sensible sin necesidad operativa. Nada de esta pantalla sirve para atender el día.
       */
      await request(app.getHttpServer())
        .get(RUTA)
        .query({ desde: DESDE, hasta: HASTA })
        .set('Authorization', `Bearer ${encargada}`)
        .expect(403);
    });

    it('la MANICURISTA recibe 403', async () => {
      await request(app.getHttpServer())
        .get(RUTA)
        .query({ desde: DESDE, hasta: HASTA })
        .set('Authorization', `Bearer ${manicurista}`)
        .expect(403);
    });

    it('401 sin token', async () => {
      await request(app.getHttpServer()).get(RUTA).query({ desde: DESDE, hasta: HASTA }).expect(401);
    });
  });

  describe('(a) embudo de citas y ocupación', () => {
    it('cuenta por estado y devuelve SIEMPRE las nueve claves, aunque estén en cero', async () => {
      // Sin esto, el cliente tendría que tratar `undefined` como 0 en cada punto donde lo lea —
      // la clase de detalle que se olvida una vez.
      const cuerpo = await resumen();

      expect(Object.keys(cuerpo.citas.porEstado).sort()).toEqual([
        'agendada',
        'cancelada',
        'completada',
        'confirmada',
        'en_espera_pago',
        'expirada',
        'no_show',
        'pendiente_confirmacion',
        'reprogramada',
      ]);
      expect(cuerpo.citas.total).toBe(0);
    });

    it('refleja el ciclo de vida real: completada, no_show y cancelada', async () => {
      const completada = await agendar('16');
      await accion(completada.id, 'completar').expect(200);

      const noLlego = await agendar('18');
      await accion(noLlego.id, 'no-show').expect(200);

      const cancelada = await agendar('20');
      await accion(cancelada.id, 'cancelar', { motivo: 'Le salió un viaje' }).expect(200);

      const cuerpo = await resumen();

      expect(cuerpo.citas.porEstado.completada).toBe(1);
      expect(cuerpo.citas.porEstado.no_show).toBe(1);
      expect(cuerpo.citas.porEstado.cancelada).toBe(1);
      expect(cuerpo.citas.total).toBe(3);
    });

    it('la TASA DE NO-SHOW usa `completada + no_show` como denominador, NO el total', async () => {
      /**
       * Las canceladas no entran: una cita cancelada con tiempo no es un `no_show`, y meterla en
       * el denominador **diluiría la tasa justo en los periodos con muchas cancelaciones**, que es
       * cuando el indicador tiene que notarse. Las activas tampoco: todavía no se sabe.
       *
       * Aquí: 1 completada + 1 no_show + 2 canceladas. La tasa es 50 %, no 25 %.
       */
      const completada = await agendar('16');
      await accion(completada.id, 'completar').expect(200);
      const noLlego = await agendar('18');
      await accion(noLlego.id, 'no-show').expect(200);
      for (const hora of ['20', '22']) {
        const cancelada = await agendar(hora);
        await accion(cancelada.id, 'cancelar').expect(200);
      }

      const cuerpo = await resumen();

      expect(cuerpo.indicadores.tasaDeNoShow).toBe(50);
    });

    it('la tasa de no-show es `null` —no 0— cuando no hubo citas atendibles', async () => {
      // "El 0 % no llegó" y "no hubo nadie a quien contar" son cosas distintas, y un 0 % en el
      // panel haría pensar que el indicador está bien cuando no hay dato.
      expect((await resumen()).indicadores.tasaDeNoShow).toBeNull();
    });

    it('desglosa las atendidas POR SUCURSAL y POR MANICURISTA', async () => {
      const conAna = await agendar('16', { manicuristaId: ana.id });
      await accion(conAna.id, 'completar').expect(200);
      const sinAsignar = await agendar('18');
      await accion(sinAsignar.id, 'completar').expect(200);

      const cuerpo = await resumen();

      expect(cuerpo.citas.atendidasPorSucursal).toEqual([{ sucursalId, completadas: 2, noShow: 0 }]);
      // `null` agrupa las completadas sin manicurista asignada (`DEC-031`): es un dato real, no un
      // hueco — significa que nadie quedó registrado como quien atendió.
      const porManicurista = cuerpo.citas.atendidasPorManicurista as { manicuristaId: string | null; completadas: number }[];
      expect(porManicurista).toHaveLength(2);
      expect(porManicurista.find((f) => f.manicuristaId === ana.id)!.completadas).toBe(1);
      expect(porManicurista.find((f) => f.manicuristaId === null)!.completadas).toBe(1);
    });

    it('el filtro por SUCURSAL acota las citas', async () => {
      const deLomas = await agendar('16');
      await accion(deLomas.id, 'completar').expect(200);

      await request(app.getHttpServer())
        .post('/v1/agenda/citas')
        .set('Authorization', `Bearer ${encargada}`)
        // Otra hora: la misma clienta a la misma hora en dos sucursales choca consigo misma, y el
        // sujeto de esta prueba es el filtro, no esa validación.
        .send({ sucursalId: otraSucursalId, servicioId: servicio.id, clientaId: clienta.id, inicio: horaDeCita(4) })
        .expect(201);

      expect((await resumen()).citas.total).toBe(2);
      expect((await resumen({ sucursalId })).citas.total).toBe(1);
    });

    it('400 con un rango invertido o demasiado amplio', async () => {
      await request(app.getHttpServer())
        .get(RUTA)
        .query({ desde: HASTA, hasta: DESDE })
        .set('Authorization', `Bearer ${dueña}`)
        .expect(400);

      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .query({ desde: haceDias(500), hasta: HASTA })
        .set('Authorization', `Bearer ${dueña}`)
        .expect(400);
      expect(respuesta.body.error.code).toBe('RANGO_DE_CONSULTA_DEMASIADO_AMPLIO');
    });
  });

  describe('(b) ingresos estimados y anticipos', () => {
    it('suma SOLO las completadas, y marca el ingreso como ESTIMADO en las advertencias', async () => {
      /**
       * El ingreso sale de `cotizacion_snapshot.totalCentavos`: **lo que se cotizó al agendar**, no
       * lo que se cobró. No incluye extras, propinas ni productos, que viven en el Excel paralelo.
       * La advertencia viaja **en la respuesta**, no solo en la documentación: quien lee un número
       * tiene que poder saber qué no incluye, en el mismo sitio donde lo lee.
       */
      const completada = await agendar('16');
      await accion(completada.id, 'completar').expect(200);
      // Esta queda agendada: no se suma.
      await agendar('18');

      const cuerpo = await resumen();

      expect(cuerpo.citas.ingresoEstimadoCentavos).toBe(45000);
      expect(cuerpo.advertencias.join(' ')).toMatch(/ESTIMADO/);
      expect(cuerpo.advertencias.join(' ')).toMatch(/Excel/);
    });

    it('una completada de COTIZACIÓN MANUAL no se suma, y se avisa de cuántas quedaron fuera', async () => {
      /**
       * `totalCentavos` es `null` para un servicio de cotización manual (`DEC-033`) — **no es
       * cero**: nadie lo cotizó. Sumarlo como 0 haría que el ingreso pareciera completo cuando le
       * falta justamente lo más caro.
       */
      const manual = await agendar('16', { servicioId: servicioManual.id });
      await accion(manual.id, 'completar').expect(200);

      const cuerpo = await resumen();

      expect(cuerpo.citas.ingresoEstimadoCentavos).toBe(0);
      expect(cuerpo.citas.completadasSinCotizar).toBe(1);
      expect(cuerpo.advertencias.join(' ')).toMatch(/cotización manual/);
    });

    it('DISTINGUE las reposiciones de garantía de las citas que se cobraron', async () => {
      /**
       * ## EL DEFECTO QUE ESTA PRUEBA DESTAPÓ (auditoría 2026-10-17)
       *
       * Una garantía es una `Cita` con `totalCentavos: 0`. En el ingreso eso es correcto —suma
       * cero, no lo infla— pero en los **conteos** era invisible: entraba en `porEstado.completada`
       * y en `atendidasPorManicurista` como una cita cualquiera.
       *
       * Las dos consecuencias, y la segunda es la que importa:
       *
       * 1. La Dueña leía *"20 completadas, $9.000"* sin saber que tres fueron gratis, así que el
       *    promedio por cita salía bajo sin explicación visible.
       * 2. **El desglose por manicurista es una medida de su trabajo**, y una reposición suele ser
       *    la corrección de su propio trabajo. Contarla igual que una cita vendida hacía que
       *    rehacer uñas despegadas **subiera** su cifra.
       *
       * No se excluyen del conteo: la silla se ocupó y hubo trabajo real. Se **nombran**, que es lo
       * que faltaba.
       */
      const original = await agendar('16');
      await accion(original.id, 'completar').expect(200);

      const { body: garantia } = await request(app.getHttpServer())
        .post('/v1/agenda/citas/garantias')
        .set('Authorization', `Bearer ${encargada}`)
        .send({ citaGarantizadaId: original.id, inicio: horaDeCita(17) })
        .expect(201);
      await accion(garantia.id, 'completar').expect(200);

      const cuerpo = await resumen();

      // Dos completadas, y una de ellas fue una reposición sin costo.
      expect(cuerpo.citas.porEstado.completada).toBe(2);
      expect(cuerpo.citas.garantiasCompletadas).toBe(1);
      // El ingreso NO se duplica: la garantía aportó cero, no el precio del servicio.
      expect(cuerpo.citas.ingresoEstimadoCentavos).toBe(45000);
      // Y `0` no es `null`: una garantía no es una cita "sin cotizar".
      expect(cuerpo.citas.completadasSinCotizar).toBe(0);
      expect(cuerpo.advertencias.join(' ')).toMatch(/garantía/i);
    });

    it('desglosa anticipos por estado y suma `pagado` + `retenido` como COBRADO', async () => {
      /**
       * Los dos cuentan: un anticipo retenido por cancelación tardía **no se reembolsa**
       * (`RN-ANT-04`), así que es dinero del salón igual que uno pagado.
       */
      const enListaRoja = Clienta.registrar({ nombre: 'Lucía', telefono: '4429998877' });
      enListaRoja.marcarListaRoja();
      await new DrizzleClientaRepository(dbDePrueba).guardar(enListaRoja);

      await request(app.getHttpServer())
        .post('/v1/agenda/citas')
        .set('Authorization', `Bearer ${encargada}`)
        .send({ sucursalId, servicioId: servicio.id, clientaId: enListaRoja.id, inicio: horaDeCita(2) })
        .expect(201);

      const cuerpo = await resumen();

      // 40 % de $450.00 = $180.00, generado por Anticipos al nacer la cita en `en_espera_pago`.
      expect(cuerpo.anticipos.porEstado.pendiente).toEqual({ cantidad: 1, centavos: 18000 });
      expect(cuerpo.anticipos.cobradoCentavos).toBe(0);
      expect(Object.keys(cuerpo.anticipos.porEstado).sort()).toEqual(['expirado', 'pagado', 'pendiente', 'retenido']);
    });

    it('ADVIERTE de que los anticipos NO se filtran por sucursal cuando se pide una', async () => {
      /**
       * `anticipos.anticipos` no guarda `sucursal_id` —es un dato de la cita, en otro esquema— y
       * filtrarlo exigiría el `JOIN` que `ADR-005` prohíbe. Se reportan globales **y se dice**:
       * fingir un desglose mal calculado sería peor que no darlo.
       */
      const cuerpo = await resumen({ sucursalId });

      expect(cuerpo.advertencias.join(' ')).toMatch(/anticipos se reportan GLOBALES/i);
    });
  });

  describe('(c) efectividad de la lista de espera', () => {
    it('cuenta inscritas, notificadas, aceptadas y expiradas', async () => {
      await request(app.getHttpServer())
        .post('/v1/agenda/lista-espera')
        .set('Authorization', `Bearer ${encargada}`)
        // Un día que no haya pasado: `LISTA_ESPERA_FECHA_PASADA` lo impide, y con razón — nadie
        // espera un hueco de ayer.
        .send({ sucursalId, clientaId: clienta.id, servicioId: servicio.id, fecha: enDias(1).slice(0, 10) })
        .expect(201);

      const cuerpo = await resumen();

      expect(cuerpo.citas.listaDeEspera.inscritas).toBe(1);
      expect(cuerpo.citas.listaDeEspera.aceptadas).toBe(0);
      // Sin ofertas notificadas, la efectividad es `null` y no 0: no hubo nada que convertir.
      expect(cuerpo.indicadores.efectividadDeListaDeEspera).toBeNull();
    });
  });

  describe('(d) desempeño del canal y del bot — la regla 80/20', () => {
    const sembrarConversacion = async (opciones: { conHumano: boolean; motivo?: string }) => {
      const repo = new DrizzleConversacionRepository(dbDePrueba);
      const conversacion = Conversacion.abrir({ sucursalId, telefonoClienta: `442${Math.random().toString().slice(2, 9)}` });
      if (opciones.motivo) {
        conversacion.escalarAHumano(opciones.motivo as never, new Date(horaDeCita(0)));
      }
      await repo.guardar(conversacion);

      await repo.registrarMensaje({
        conversacionId: conversacion.id,
        wamid: `wamid.${randomUUID()}`,
        direccion: 'entrante',
        emisor: 'clienta',
        tipo: 'texto',
        contenido: 'Hola',
        ocurridoEn: new Date(horaDeCita(0)),
      });

      if (opciones.conHumano) {
        await repo.registrarMensaje({
          conversacionId: conversacion.id,
          wamid: `wamid.${randomUUID()}`,
          direccion: 'saliente',
          emisor: 'humano',
          tipo: 'texto',
          contenido: 'Te atiendo yo',
          ocurridoEn: new Date(horaDeCita(1)),
        });
      }
      return conversacion;
    };

    it('mide "se quedó en el bot" por los MENSAJES, no por el `modo` actual', async () => {
      /**
       * **La forma obvia es incorrecta y el error sería silencioso.** Contar `modo = 'bot'` daría
       * un número inflado: `devolverAlBot` limpia `motivo_de_escalamiento` y `escalada_en`
       * (`RN-ESC-03`), así que una conversación escalada, atendida por una persona y devuelta al
       * bot queda **indistinguible** de una que nunca se escaló — y el indicador de resolución
       * autónoma mentiría justo en los casos en que una persona trabajó.
       *
       * Se deriva de los mensajes: si ninguno tiene `emisor = 'humano'`, se atendió sola. Eso es un
       * hecho registrado que no se borra al devolver el control.
       */
      await sembrarConversacion({ conHumano: false });
      await sembrarConversacion({ conHumano: false });
      await sembrarConversacion({ conHumano: false });
      // Esta sí tuvo intervención humana, y además se devolvió al bot: `modo` dice `bot`.
      await sembrarConversacion({ conHumano: true });

      const cuerpo = await resumen();

      expect(cuerpo.conversaciones.activas).toBe(4);
      expect(cuerpo.conversaciones.soloBot).toBe(3);
      expect(cuerpo.conversaciones.conIntervencionHumana).toBe(1);
      expect(cuerpo.indicadores.porcentajeResueltoPorElBot).toBe(75);
    });

    it('un mensaje de `sistema` NO cuenta como intervención humana', async () => {
      // Lo manda el Planificador (recordatorio, oferta de hueco), no una persona. Contarlo haría
      // que una conversación con recordatorio pareciera atendida a mano.
      const repo = new DrizzleConversacionRepository(dbDePrueba);
      const conversacion = Conversacion.abrir({ sucursalId, telefonoClienta: '4425550001' });
      await repo.guardar(conversacion);
      for (const [emisor, direccion] of [
        ['clienta', 'entrante'],
        ['sistema', 'saliente'],
      ] as const) {
        await repo.registrarMensaje({
          conversacionId: conversacion.id,
          wamid: `wamid.${randomUUID()}`,
          direccion,
          emisor,
          tipo: 'texto',
          contenido: 'x',
          ocurridoEn: new Date(horaDeCita(0)),
        });
      }

      const cuerpo = await resumen();

      expect(cuerpo.conversaciones.soloBot).toBe(1);
      expect(cuerpo.indicadores.porcentajeResueltoPorElBot).toBe(100);
    });

    it('desglosa los escalamientos POR MOTIVO, con los nueve del catálogo siempre presentes', async () => {
      await sembrarConversacion({ conHumano: true, motivo: 'queja_o_reclamo' });
      await sembrarConversacion({ conHumano: true, motivo: 'cancelacion_solicitada' });
      await sembrarConversacion({ conHumano: true, motivo: 'cancelacion_solicitada' });

      const cuerpo = await resumen();

      expect(cuerpo.conversaciones.escalamientosPorMotivo.cancelacion_solicitada).toBe(2);
      expect(cuerpo.conversaciones.escalamientosPorMotivo.queja_o_reclamo).toBe(1);
      expect(cuerpo.conversaciones.escalamientosPorMotivo.medio_no_soportado).toBe(0);
      expect(Object.keys(cuerpo.conversaciones.escalamientosPorMotivo)).toHaveLength(9);
    });

    it('el porcentaje es `null` —no 0— cuando no hubo conversaciones', async () => {
      // Un 0 % en el panel haría pensar que el bot no funciona, cuando no hubo nada que atender.
      expect((await resumen()).conversaciones.porcentajeResueltoPorElBot).toBeNull();
    });
  });

  describe('el ingreso total suma lo cotizado Y lo cobrado en anticipos', () => {
    it('`ingresoTotalEstimadoCentavos` = citas completadas + anticipos cobrados', async () => {
      const completada = await agendar('16');
      await accion(completada.id, 'completar').expect(200);

      const cuerpo = await resumen();

      expect(cuerpo.indicadores.ingresoTotalEstimadoCentavos).toBe(
        cuerpo.citas.ingresoEstimadoCentavos + cuerpo.anticipos.cobradoCentavos,
      );
      expect(cuerpo.indicadores.ingresoTotalEstimadoCentavos).toBe(45000);
    });
  });
});
