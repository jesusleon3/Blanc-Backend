const { existsSync } = require('fs');
const { homedir } = require('os');
const { join } = require('path');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');

/**
 * Sockets donde vive el demonio de contenedores según el runtime instalado. Testcontainers busca
 * `DOCKER_HOST` y luego `/var/run/docker.sock`; cuando el runtime no es Docker Desktop —OrbStack,
 * Colima, Rancher— ese symlink puede no existir y el arranque falla con "Could not find a working
 * container runtime strategy" aunque `docker ps` funcione en la terminal, porque el CLI sí lee el
 * contexto activo y Testcontainers no siempre.
 */
const SOCKETS_CONOCIDOS = [
  '/var/run/docker.sock',
  join(homedir(), '.orbstack/run/docker.sock'), // OrbStack
  join(homedir(), '.colima/default/docker.sock'), // Colima
  join(homedir(), '.rd/docker.sock'), // Rancher Desktop
  join(homedir(), '.docker/run/docker.sock'), // Docker Desktop (socket de usuario)
];

/** Deja `DOCKER_HOST` apuntando a un socket que exista de verdad, respetando el que ya esté puesto. */
function resolverDockerHost() {
  if (process.env.DOCKER_HOST) return process.env.DOCKER_HOST;

  const socket = SOCKETS_CONOCIDOS.find((ruta) => existsSync(ruta));
  if (!socket) {
    throw new Error(
      'No se encontró ningún socket de Docker. Las pruebas de integración necesitan un runtime de ' +
        'contenedores en marcha (Docker Desktop, OrbStack, Colima…). Rutas probadas:\n  ' +
        SOCKETS_CONOCIDOS.join('\n  '),
    );
  }

  process.env.DOCKER_HOST = `unix://${socket}`;
  return process.env.DOCKER_HOST;
}

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
  resolverDockerHost();

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
