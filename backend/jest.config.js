/**
 * Jest — unitarias + integración/E2E contra un PostgreSQL REAL y efímero (Testcontainers).
 *
 * `globalSetup` levanta un único contenedor `postgres:16-alpine` para toda la corrida y
 * `globalTeardown` lo detiene; cada worker trabaja sobre su propia base de datos dentro de ese
 * contenedor (ver `src/database/test-utils/postgres-de-prueba.ts`). Sustituye a `pg-mem`, que no
 * soporta `tstzrange`, `EXCLUDE USING gist` ni `btree_gist` — imprescindibles para la Fase 2 — y
 * que además no revertía transacciones de verdad.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  globalSetup: '<rootDir>/../test/global-setup.js',
  globalTeardown: '<rootDir>/../test/global-teardown.js',
  // Arrancar el contenedor y aplicar migraciones excede con creces el timeout por defecto (5 s)
  // en la primera prueba de cada worker.
  testTimeout: 60000,
  testRegex: '.*\\.spec\\.ts$',
  setupFilesAfterEnv: ['<rootDir>/../test/setup-after-env.js'],
  // Solo `.ts`: incluir `.js` hacía que ts-jest intentara compilar los hooks globales
  // (`test/*.js`) y avisara de `allowJs` desactivado. Ningún archivo `.js` de `src/` necesita
  // transformación.
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coveragePathIgnorePatterns: ['main.ts', '.module.ts', '/database/schema/', '/database/migrate.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  // La conexión pg-mem usada en pruebas de integración/E2E deja un handle TCP abierto que
  // Jest no puede cerrar por sí solo (pg-mem no expone un `.end()` real) — no es un fallo de
  // los módulos probados, ver reporte de cierre del módulo Sucursales y Personal.
  forceExit: true,
};
