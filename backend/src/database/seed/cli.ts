import { cerrarConexion, createDbConnection } from '../connection';
import { SUCURSALES_DE_BLANC } from './datos-de-blanc';
import { ejecutarBootstrap } from './bootstrap';

/**
 * `npm run db:seed` — inicializa una base de producción vacía.
 *
 * Toda la configuración viene de **variables de entorno**, ninguna en el código: así el mismo
 * comando sirve para el entorno de pruebas de la Dueña y para producción, sin editar nada.
 *
 * ```
 * DATABASE_URL=...                      # obligatorio
 * SUPER_ADMIN_EMAIL=duena@blanc.mx      # obligatorio
 * SUPER_ADMIN_NOMBRE="Dueña de Blanc"   # obligatorio
 * SUPER_ADMIN_SUPABASE_SUB=<uuid>       # obligatorio — Supabase → Authentication → Users → UID
 * PHONE_NUMBER_ID_ZIBATA=...            # opcional, al migrar cada número
 * PHONE_NUMBER_ID_LOMAS=...
 * PHONE_NUMBER_ID_ALAMOS=...
 * ```
 *
 * **Es idempotente**: correrlo dos veces no duplica ni falla. Ver la nota extensa de
 * `ejecutarBootstrap` sobre qué significa eso aquí (en particular: no reimpone horarios ajustados
 * a mano ni reactiva sillas desactivadas).
 */
async function main(): Promise<void> {
  const cadenaDeConexion = process.env.DATABASE_URL;
  if (!cadenaDeConexion) {
    // Sin valor por defecto a localhost, al contrario que `migrate.ts`: este script **escribe
    // datos de negocio**, y un seed que apunte por descuido a la base equivocada es peor que uno
    // que no arranque.
    throw new Error('Falta DATABASE_URL. Este script escribe datos de negocio y no asume ninguna base por defecto.');
  }

  const db = createDbConnection(cadenaDeConexion);

  try {
    // eslint-disable-next-line no-console
    const registrar = (mensaje: string) => console.log(mensaje);

    registrar('Bootstrap de Blanc — inicializando la base…\n');

    const resumen = await ejecutarBootstrap(db, {
      superAdmin: {
        email: process.env.SUPER_ADMIN_EMAIL ?? '',
        nombre: process.env.SUPER_ADMIN_NOMBRE ?? '',
        supabaseUserId: process.env.SUPER_ADMIN_SUPABASE_SUB ?? '',
      },
      phoneNumberIds: Object.fromEntries(
        SUCURSALES_DE_BLANC.map((sucursal) => [sucursal.nombre, process.env[sucursal.variableDePhoneNumberId]]),
      ),
      registrar,
    });

    registrar('\nResumen:');
    registrar(`  Sucursales creadas: ${resumen.sucursalesCreadas} (ya existían ${resumen.sucursalesExistentes})`);
    registrar(`  Sillas creadas: ${resumen.sillasCreadas}`);
    registrar(`  Servicios creados: ${resumen.serviciosCreados} (ya existían ${resumen.serviciosExistentes})`);
    registrar(`  Números de WhatsApp dados de alta: ${resumen.numerosDeWhatsappDadosDeAlta}`);
    registrar(`  Super Admin: ${resumen.superAdmin}`);
    if (resumen.serviciosCreados > 0) {
      registrar('\n⚠️ IMPORTANTE: los precios y duraciones del catálogo son PROVISIONALES.');
      registrar('   La tabla real de la Dueña no está en el repositorio y `PA-02` sigue parcialmente abierta.');
      registrar('   Corrígelos en el Backoffice (/admin) ANTES de operar: la duración decide si una cita cabe');
      registrar('   y el precio se congela en cada cita que se agende.');
    }
    registrar('\nListo. Siguiente paso: dar de alta manicuristas por la API o el Backoffice (ver GO_LIVE_RUNBOOK.md).');
  } finally {
    // El pool se cierra siempre: sin esto el proceso se queda colgado y en un contenedor de
    // Railway eso es un job que nunca termina.
    await cerrarConexion(db);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(`\n✗ El bootstrap falló: ${error instanceof Error ? error.message : String(error)}`);
    // eslint-disable-next-line no-console
    console.error('\nNada quedó a medias de forma irrecuperable: el script es idempotente, así que se puede corregir y volver a correr.');
    process.exit(1);
  });
