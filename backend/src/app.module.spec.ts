import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { DATABASE_CONNECTION } from './database/database.module';
import { Database } from './database/connection';
import { crearBaseDeDatosDePrueba } from './database/test-utils/postgres-de-prueba';
import { CitasController } from './modules/agenda/infrastructure/http/citas.controller';
import { SillasController } from './modules/agenda/infrastructure/http/sillas.controller';
import { ExcepcionesPersonalController } from './modules/sucursales-y-personal/infrastructure/http/excepciones-personal.controller';

/**
 * Prueba de humo del **contenedor completo**.
 *
 * POR QUÉ HACE FALTA. `npm run build` compila tipos; no resuelve el grafo de inyección. Hasta
 * ahora cada E2E montaba su propio subconjunto de módulos, así que una dependencia que solo
 * `AppModule` cablea —y `IntegracionModule` es exactamente eso— podía quedar roto con el build y
 * las 740 pruebas en verde, y fallar al arrancar en producción. Esto lo convierte en un fallo de
 * CI en lugar de un fallo de despliegue.
 */
describe('AppModule — prueba de humo del contenedor', () => {
  let db: Database;

  beforeAll(async () => {
    db = await crearBaseDeDatosDePrueba();
  });

  it('resuelve el grafo de inyección completo', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Lo único que se sustituye es la conexión: `DatabaseModule` apuntaría a la base de
      // desarrollo por `DATABASE_URL`. Todo lo demás son los providers reales.
      .overrideProvider(DATABASE_CONNECTION)
      .useValue(db)
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    // Los controladores de Fase 2: si alguno no está registrado en su módulo, las rutas no
    // existen aunque el archivo compile.
    expect(moduleRef.get(CitasController)).toBeDefined();
    expect(moduleRef.get(SillasController)).toBeDefined();
    expect(moduleRef.get(ExcepcionesPersonalController, { strict: false })).toBeDefined();

    await app.close();
  });
});
