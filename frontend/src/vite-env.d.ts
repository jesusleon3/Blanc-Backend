/// <reference types="vite/client" />

/**
 * Variables de entorno del frontend, **declaradas y tipadas**.
 *
 * Tiparlas obliga a que una variable nueva se declare aquí antes de usarse, y hace que un nombre
 * mal escrito sea un error de compilación en vez de un `undefined` en producción.
 *
 * Las tres son públicas por diseño (`ADR-027`): viajan en el bundle. **Sus valores reales no se
 * escriben en el repositorio** — ver `.env.example`.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Vacío = mismo origen (proxy en desarrollo, estáticos junto a la API en producción). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
