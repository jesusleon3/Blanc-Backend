import type { Config } from 'drizzle-kit';

/**
 * Genera migraciones únicamente para los esquemas tocados por módulos ya construidos:
 * Sucursales y Personal (`sucursales_personal`), el esquema transversal `auditoria` (RN-AUD-01),
 * Identidad y Accesos (`identidad_accesos`) y Catálogo y Cotización (`catalogo_cotizacion`,
 * alcance mínimo FL-COT-01). Ningún otro esquema
 * de 04-data-model.md §3 se genera todavía.
 */
export default {
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  schemaFilter: ['sucursales_personal', 'auditoria', 'identidad_accesos', 'catalogo_cotizacion'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/blanc',
  },
} satisfies Config;
