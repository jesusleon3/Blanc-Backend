/**
 * Resuelve la Service Role Key del proyecto Supabase (`DEC-023`), usada exclusivamente para
 * autenticar llamadas servidor-a-servidor a la Admin API (`FL-SEG-06`, provisionamiento).
 *
 * Es el secreto de mayor privilegio del proyecto: permite crear, modificar y eliminar cualquier
 * cuenta. Por eso sigue exactamente la misma política de `resolverJwtSecret()`
 * (`jwt-secret.ts`): falla duro fuera de `NODE_ENV=test`, sin valor por defecto conocido. Un
 * fallback hardcodeado sería, además de inútil, una invitación a filtrarlo.
 *
 * NUNCA debe escribirse en logs, en auditoría, en mensajes de error ni en documentación — solo
 * viaja en el encabezado de la petición a Supabase.
 */
export function resolverSupabaseServiceRoleKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (key && key.trim() !== '') return key.trim();

  if (env.NODE_ENV === 'test') {
    return 'service-role-key-de-pruebas-nunca-usada-fuera-de-jest';
  }

  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY no está configurada. Fuera de pruebas (NODE_ENV=test) este valor es ' +
      'obligatorio para el provisionamiento de identidades (FL-SEG-06) y no tiene valor por defecto. ' +
      'Configúrala en el entorno (Railway), nunca en un archivo versionado.',
  );
}
