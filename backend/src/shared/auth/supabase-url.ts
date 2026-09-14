/**
 * Resuelve la URL base del proyecto Supabase de Blanc (`DEC-023`), usada para derivar tanto el
 * `issuer` esperado (`<SUPABASE_URL>/auth/v1`) como el `jwks_uri` (`<SUPABASE_URL>/auth/v1/.well-
 * known/jwks.json`) de la verificación ES256/JWKS (`DEC-026`). Deliberadamente NO existe una
 * variable `SUPABASE_JWKS_URL` independiente — ambos valores se derivan siempre de esta única
 * fuente de confianza, para no introducir una URL de JWKS configurable de forma libre (riesgo de
 * SSRF ya señalado en la auditoría de `DEC-026`).
 *
 * Mismo patrón de `resolverJwtSecret()` (`jwt-secret.ts`): falla duro fuera de `NODE_ENV=test`,
 * sin valor por defecto conocido — un `SUPABASE_URL` incorrecto apuntaría la verificación de JWKS
 * a un proyecto ajeno.
 */
export function resolverSupabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.SUPABASE_URL;
  if (url && url.trim() !== '') return url.trim().replace(/\/+$/, '');

  if (env.NODE_ENV === 'test') {
    return 'https://supabase-url-de-pruebas.example';
  }

  throw new Error(
    'SUPABASE_URL no está configurado. Fuera de pruebas (NODE_ENV=test) este valor es obligatorio — ' +
      'se usa para derivar tanto el issuer esperado como el jwks_uri de la verificación ES256 (DEC-026). ' +
      'Configúralo en el entorno (Railway) antes de arrancar la app.',
  );
}

/** `issuer` esperado de los JWT de Supabase Auth — `<SUPABASE_URL>/auth/v1` (confirmado contra el proyecto real, `DEC-001`). */
export function resolverIssuerSupabase(supabaseUrl: string): string {
  return `${supabaseUrl}/auth/v1`;
}

/** `jwks_uri` real de Supabase Auth — derivado de `SUPABASE_URL`, nunca configurable de forma independiente. */
export function resolverJwksUri(supabaseUrl: string): URL {
  return new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
}
