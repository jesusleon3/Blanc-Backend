const { PostgreSqlContainer } = require('@testcontainers/postgresql');

/**
 * Arranca UN PostgreSQL real, efímero, para toda la corrida de Jest (`globalSetup`).
 *
 * POR QUÉ POSTGRESQL REAL Y NO `pg-mem`: se verificó empíricamente que pg-mem no soporta
 * `tstzrange`, no parsea `EXCLUDE USING gist` y no conoce la extensión `btree_gist` — es decir,
 * es incapaz de representar el mecanismo anti-doble-booking del que depende la Fase 2 (Agenda),
 * definido en `04-data-model.md` §5.1. Con pg-mem, el invariante más crítico del sistema se
 * construiría sin ninguna prueba que lo respalde.
 *
 * CONTENEDORES HUÉRFANOS: `globalTeardown` detiene el contenedor al terminar. Si Jest muere de
 * forma abrupta (SIGKILL, corte de energía) y ese hook no llega a ejecutarse, Testcontainers deja
 * corriendo un contenedor centinela — Ryuk — que elimina los recursos de la sesión al detectar
 * que el proceso que los creó desapareció. Es decir, la limpieza está cubierta por dos vías.
 */
module.exports = async () => {
  const contenedor = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('blanc_test')
    .withUsername('blanc')
    .withPassword('blanc')
    .start();

  // `globalThis` es el único canal que Jest garantiza entre `globalSetup` y `globalTeardown`
  // (corren en el mismo proceso); `process.env` es el canal hacia los workers, que son procesos
  // hijos y heredan el entorno.
  globalThis.__CONTENEDOR_POSTGRES__ = contenedor;
  process.env.TEST_DATABASE_URL = contenedor.getConnectionUri();
};
