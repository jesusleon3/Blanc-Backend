/**
 * Resuelve el secreto HS256 para firmar/verificar JWT (ADR-010).
 *
 * Política (pre-arranque de Identidad y Accesos, BLOCKER #3 de esa auditoría): nunca existe un
 * secreto conocido como fallback fuera de pruebas. `NODE_ENV=test` es el valor que Jest fija
 * automáticamente al ejecutar `jest` en este proyecto (verificado empíricamente, sin
 * configuración adicional — no hay `setupFiles` ni override en `jest.config.js`) — es la única
 * señal de entorno que este proyecto usa hoy; no existe todavía `@nestjs/config` ni una noción
 * explícita de staging/producción separadas de "no es test", así que cualquier entorno que no
 * sea `test` se trata como "debe traer `JWT_SECRET` real", sin distinguir más allá de eso.
 *
 * Nota importante: los tests de `JwtAuthGuard`/E2E de este repositorio NO pasan por esta función
 * — construyen `JwtAuthGuard` directamente con un secreto literal (`new JwtAuthGuard('secreto-e2e', ...)`),
 * sin cargar `AuthModule`. Esta función solo se ejecuta cuando `AuthModule` real se importa
 * (arranque de la app, o un futuro test que decida usar la app real en vez de un módulo de
 * prueba) — por eso puede fallar duro sin riesgo de romper la suite actual.
 */
export function resolverJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (secret && secret.trim() !== '') return secret;

  if (env.NODE_ENV === 'test') {
    return 'secreto-de-pruebas-nunca-usado-fuera-de-jest';
  }

  throw new Error(
    'JWT_SECRET no está configurado. Fuera de pruebas (NODE_ENV=test) este valor es obligatorio y ' +
      'no tiene un valor por defecto — un secreto conocido/hardcodeado permitiría firmar JWT válidos ' +
      'para cualquier rol. Configúralo en el entorno (Railway/Supabase) antes de arrancar la app.',
  );
}
