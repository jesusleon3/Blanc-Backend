/** Jest — unit + integration (pg-mem). Sin acceso a Postgres real en este entorno; ver HANDOFF del módulo. */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
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
