import type { Database } from '../connection';
import { Sucursal } from '../../modules/sucursales-y-personal/domain/entities/sucursal.entity';
import { DrizzleSucursalRepository } from '../../modules/sucursales-y-personal/infrastructure/persistence/drizzle-sucursal.repository';
import { Silla } from '../../modules/agenda/domain/entities/silla.entity';
import { DrizzleSillaRepository } from '../../modules/agenda/infrastructure/persistence/drizzle-silla.repository';
import { Usuario } from '../../modules/identidad-y-accesos/domain/entities/usuario.entity';
import { DrizzleUsuarioRepository } from '../../modules/identidad-y-accesos/infrastructure/persistence/drizzle-usuario.repository';
import { DrizzleConversacionRepository } from '../../modules/conversaciones/infrastructure/persistence/drizzle-conversacion.repository';
import { Rol } from '../../shared/auth/rol';
import { HORARIO_DE_BLANC, SUCURSALES_DE_BLANC, nombreDeSilla } from './datos-de-blanc';
import { SERVICIOS_DE_BLANC } from './catalogo-de-blanc';
import { Servicio } from '../../modules/catalogo-y-cotizacion/domain/entities/servicio.entity';
import { DrizzleServicioRepository } from '../../modules/catalogo-y-cotizacion/infrastructure/persistence/drizzle-servicio.repository';

export interface DatosDelSuperAdmin {
  email: string;
  nombre: string;
  /** El `sub` del usuario en Supabase Auth. Es lo que `AuthorizationGuard` usa para resolver permisos. */
  supabaseUserId: string;
}

export interface OpcionesDeBootstrap {
  superAdmin: DatosDelSuperAdmin;
  /** Nombre de sucursal → `phone_number_id` de Meta. Las que falten simplemente no se mapean. */
  phoneNumberIds?: Record<string, string | undefined>;
  /** Para que el script de CLI escriba en consola y las pruebas no. */
  registrar?: (mensaje: string) => void;
}

export interface ResumenDeBootstrap {
  sucursalesCreadas: number;
  sucursalesExistentes: number;
  sillasCreadas: number;
  serviciosCreados: number;
  serviciosExistentes: number;
  numerosDeWhatsappDadosDeAlta: number;
  superAdmin: 'creado' | 'ya_existia' | 'revinculado';
}

/**
 * Inicializa una base de datos de producción vacía para dejar Blanc operable.
 *
 * ## POR QUÉ ESTE SCRIPT EXISTE
 *
 * Una base recién migrada **no tiene por dónde entrar**: todos los endpoints de alta exigen
 * `SUPER_ADMIN` o `ADMINISTRADOR`, así que la primera fila de `usuarios` tendría que insertarse con
 * SQL a mano en producción. Este es el único arranque en frío del sistema, y el resto del alta
 * (manicuristas, servicios, excepciones) sí se hace por API con su RBAC.
 *
 * ## IDEMPOTENTE, Y LO QUE ESO SIGNIFICA AQUÍ
 *
 * Se va a ejecutar en producción, probablemente desde la consola de Railway, probablemente **más
 * de una vez** — porque un despliegue se reintenta, porque nadie recuerda si ya se pasó, o porque
 * se añade la cuarta sucursal. Dos consecuencias de diseño:
 *
 * 1. **Nada se duplica.** Duplicar sillas cambiaría la capacidad vendible del salón (`DEC-031`:
 *    el número de filas *es* la capacidad).
 * 2. **Nada se reimpone.** Idempotente significa *"no cambia el resultado"*, no *"reescribe el
 *    valor de fábrica"*. Si la Dueña ajustó el horario de Álamos desde el panel, el seed **no lo
 *    pisa**; si Administración desactivó una silla por reparación, **no la reactiva**. Reimponer
 *    valores por defecto borraría decisiones de negocio en silencio, que es peor que no hacer nada.
 *
 * La clave de identidad es **el nombre**: `buscarPorNombre` para la sucursal y el nombre generado
 * por `nombreDeSilla` para la silla. No hay un `slug` ni un id estable en los datos, y usar el
 * nombre es correcto porque `sucursales.nombre` es único en la base.
 *
 * ## NO ABRE TRANSACCIÓN GLOBAL, Y ES DELIBERADO
 *
 * Cada paso es idempotente por sí mismo, así que una ejecución interrumpida a mitad **se arregla
 * volviéndola a correr**. Envolverlo todo en una transacción daría la garantía contraria a la que
 * importa aquí: ante un fallo en el paso 3, perdería los pasos 1 y 2 que ya estaban bien, y el
 * operador tendría que empezar de cero sin saber qué pasó.
 */
export async function ejecutarBootstrap(db: Database, opciones: OpcionesDeBootstrap): Promise<ResumenDeBootstrap> {
  const registrar = opciones.registrar ?? (() => {});
  exigirDatosDelSuperAdmin(opciones.superAdmin);

  const sucursalRepo = new DrizzleSucursalRepository(db);
  const sillaRepo = new DrizzleSillaRepository(db);
  const usuarioRepo = new DrizzleUsuarioRepository(db);
  const conversacionRepo = new DrizzleConversacionRepository(db);

  const resumen: ResumenDeBootstrap = {
    sucursalesCreadas: 0,
    sucursalesExistentes: 0,
    sillasCreadas: 0,
    serviciosCreados: 0,
    serviciosExistentes: 0,
    numerosDeWhatsappDadosDeAlta: 0,
    superAdmin: 'ya_existia',
  };

  for (const definicion of SUCURSALES_DE_BLANC) {
    const existente = await sucursalRepo.buscarPorNombre(definicion.nombre);

    let sucursalId: string;
    if (existente) {
      // **No se toca el horario.** Ver la nota de la cabecera: puede haberse ajustado a mano.
      sucursalId = existente.id;
      resumen.sucursalesExistentes += 1;
      registrar(`· ${definicion.nombre}: ya existía (horario intacto)`);
    } else {
      const nueva = Sucursal.crear({ nombre: definicion.nombre, horarioSemanal: HORARIO_DE_BLANC });
      await sucursalRepo.guardar(nueva);
      sucursalId = nueva.id;
      resumen.sucursalesCreadas += 1;
      registrar(`✓ ${definicion.nombre}: creada con el horario de Blanc (domingo cerrado)`);
    }

    resumen.sillasCreadas += await sembrarSillas(sillaRepo, sucursalId, definicion.nombre, definicion.sillas, registrar);

    const phoneNumberId = opciones.phoneNumberIds?.[definicion.nombre];
    if (phoneNumberId) {
      if (await darDeAltaNumero(conversacionRepo, sucursalId, phoneNumberId, definicion.nombre, registrar)) {
        resumen.numerosDeWhatsappDadosDeAlta += 1;
      }
    } else {
      // No es un error: los tres números se migran en momentos distintos. Una sucursal sin número
      // opera desde el mostrador; lo único que no puede es recibir WhatsApp.
      registrar(`· ${definicion.nombre}: sin \`phone_number_id\` (se dará de alta al migrar su número)`);
    }
  }

  const catalogo = await sembrarCatalogo(new DrizzleServicioRepository(db), registrar);
  resumen.serviciosCreados = catalogo.creados;
  resumen.serviciosExistentes = catalogo.existentes;

  resumen.superAdmin = await sembrarSuperAdmin(usuarioRepo, opciones.superAdmin, registrar);

  return resumen;
}

function exigirDatosDelSuperAdmin(datos: DatosDelSuperAdmin): void {
  /**
   * Falla **ruidosamente** y antes de escribir nada.
   *
   * El lado seguro del error: una base sembrada sin usuario inicial **parece correcta** —tiene sus
   * sucursales y sus sillas— y no se puede usar, porque no hay nadie que pueda autenticarse para
   * dar de alta a los demás. Descubrirlo después exige SQL a mano en producción.
   */
  const faltantes = [
    datos.email?.trim() ? null : 'SUPER_ADMIN_EMAIL',
    datos.nombre?.trim() ? null : 'SUPER_ADMIN_NOMBRE',
    datos.supabaseUserId?.trim() ? null : 'SUPER_ADMIN_SUPABASE_SUB',
  ].filter((nombre): nombre is string => nombre !== null);

  if (faltantes.length > 0) {
    throw new Error(
      `Faltan datos del Super Admin inicial: ${faltantes.join(', ')}. Sin ellos la base queda sembrada pero sin nadie que pueda entrar.`,
    );
  }

  /**
   * El `sub` de Supabase **es un uuid**, y `usuarios.supabase_user_id` es una columna `uuid`.
   *
   * Se valida aquí porque si no, el fallo llega como `PostgresError: invalid input syntax for type
   * uuid` **a mitad del seed, en producción**, con las sucursales ya creadas y sin decir qué
   * variable está mal. Lo destapó la propia prueba de este script al usar un `sub` de ejemplo que
   * no era uuid.
   */
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(datos.supabaseUserId.trim())) {
    throw new Error(
      `SUPER_ADMIN_SUPABASE_SUB debe ser el uuid del usuario en Supabase Auth (Authentication → Users → columna "UID"), no un correo ni un alias. Recibido: "${datos.supabaseUserId}".`,
    );
  }
}

/**
 * Catálogo inicial. Crea solo los servicios que faltan, comparando por nombre.
 *
 * ## ⚠️ NO REIMPONE PRECIOS NI DURACIONES
 *
 * Si un servicio ya existe, **no se toca**. Es la misma regla que con el horario de las sucursales
 * y aquí importa más: `catalogo-de-blanc.ts` lleva valores **provisionales** —la tabla real de la
 * Dueña no está en el repositorio y `PA-02` sigue parcialmente abierta— así que reescribir el
 * precio que alguien corrigió desde el Backoffice sería **devolver un cobro a un número ficticio**,
 * y en silencio.
 *
 * Tampoco reactiva un servicio dado de baja: desactivarlo fue retirarlo de la venta a propósito.
 */
async function sembrarCatalogo(
  repo: DrizzleServicioRepository,
  registrar: (mensaje: string) => void,
): Promise<{ creados: number; existentes: number }> {
  // `listar` devuelve activos e inactivos, así que un servicio de baja cuenta como existente.
  const existentes = new Set((await repo.listar()).map((servicio) => servicio.nombre.toLowerCase()));
  let creados = 0;

  for (const definicion of SERVICIOS_DE_BLANC) {
    if (existentes.has(definicion.nombre.toLowerCase())) continue;

    await repo.guardar(
      Servicio.crear({
        nombre: definicion.nombre,
        categoria: definicion.categoria,
        duracionBaseMinutos: definicion.duracionBaseMinutos,
        precioBaseCentavos: definicion.precioBaseCentavos,
        requiereCotizacionManual: definicion.requiereCotizacionManual ?? false,
      }),
    );
    creados += 1;
  }

  if (creados > 0) {
    registrar(`✓ Catálogo: ${creados} servicio(s) creado(s) de ${SERVICIOS_DE_BLANC.length}`);
    registrar('  ⚠️ Sus precios y duraciones son PROVISIONALES: confírmalos con la Dueña antes de operar.');
  } else {
    registrar(`· Catálogo: los ${SERVICIOS_DE_BLANC.length} servicios ya existían (precios y duraciones intactos)`);
  }

  return { creados, existentes: SERVICIOS_DE_BLANC.length - creados };
}

/** Crea solo las que faltan, comparando por nombre. No reactiva las desactivadas. */
async function sembrarSillas(
  repo: DrizzleSillaRepository,
  sucursalId: string,
  nombreDeSucursal: string,
  cuantas: number,
  registrar: (mensaje: string) => void,
): Promise<number> {
  const existentes = new Set((await repo.listarPorSucursal(sucursalId)).map((silla) => silla.nombre));
  let creadas = 0;

  for (let indice = 1; indice <= cuantas; indice += 1) {
    const nombre = nombreDeSilla(nombreDeSucursal, indice);
    // `listarPorSucursal` devuelve activas **e inactivas** a propósito, así que una silla
    // desactivada cuenta como existente y no se vuelve a crear: desactivarla fue reducir la
    // capacidad deliberadamente (una estación en reparación).
    if (existentes.has(nombre)) continue;

    await repo.guardar(Silla.crear({ sucursalId, nombre }));
    creadas += 1;
  }

  if (creadas > 0) registrar(`  ✓ ${nombreDeSucursal}: ${creadas} silla(s) creada(s) de ${cuantas}`);
  return creadas;
}

/** `true` si el alta era nueva. Si el número ya apuntaba a esa sucursal, no hace nada. */
async function darDeAltaNumero(
  repo: DrizzleConversacionRepository,
  sucursalId: string,
  phoneNumberId: string,
  nombreDeSucursal: string,
  registrar: (mensaje: string) => void,
): Promise<boolean> {
  const yaMapeado = await repo.buscarSucursalDeNumero(phoneNumberId);

  if (yaMapeado === sucursalId) {
    registrar(`· ${nombreDeSucursal}: su número ya estaba dado de alta`);
    return false;
  }
  if (yaMapeado !== null) {
    /**
     * El número apunta a **otra** sucursal. Se rechaza en vez de reasignar, y es la decisión
     * correcta: mapear un `phone_number_id` a la sucursal equivocada **desvía las conversaciones
     * de una sucursal a otra**, y el síntoma es que las clientas de Lomas aparecen en la bandeja
     * de Zibatá. Es un error de configuración que hay que mirar, no resolver en silencio.
     */
    throw new Error(
      `El phone_number_id "${phoneNumberId}" ya está dado de alta en otra sucursal. Revisa las variables de entorno antes de continuar: un mapeo equivocado desvía las conversaciones de una sucursal a otra.`,
    );
  }

  await repo.registrarNumeroDeSucursal({ phoneNumberId, sucursalId, telefonoVisible: phoneNumberId });
  registrar(`✓ ${nombreDeSucursal}: número de WhatsApp dado de alta`);
  return true;
}

/**
 * El usuario inicial. **Es el único arranque en frío.**
 *
 * Tres casos, y el tercero importa: si el registro administrativo existe pero **no está vinculado**
 * a una cuenta de Supabase, se vincula. Pasa cuando alguien dio de alta el usuario por API antes de
 * crear su cuenta en Supabase, y sin este caso quedaría un usuario que no puede entrar.
 */
async function sembrarSuperAdmin(
  repo: DrizzleUsuarioRepository,
  datos: DatosDelSuperAdmin,
  registrar: (mensaje: string) => void,
): Promise<ResumenDeBootstrap['superAdmin']> {
  const existente = await repo.buscarPorEmail(datos.email);

  if (existente) {
    if (existente.supabaseUserId === datos.supabaseUserId) {
      registrar(`· Super Admin ${datos.email}: ya existía y ya estaba vinculado`);
      return 'ya_existia';
    }
    await repo.vincularCuentaExterna(existente.id, datos.supabaseUserId);
    registrar(`✓ Super Admin ${datos.email}: vinculado a su cuenta de Supabase`);
    return 'revinculado';
  }

  const usuario = Usuario.crear({ email: datos.email, nombre: datos.nombre, rol: Rol.SUPER_ADMIN });
  await repo.guardar(usuario);
  await repo.vincularCuentaExterna(usuario.id, datos.supabaseUserId);
  /**
   * **No se le asigna ninguna sucursal, y eso le da alcance `GLOBAL`.**
   *
   * `alcance-por-defecto.ts`: un usuario sin filas en `usuarios_sucursales` alcanza todas. Es lo
   * correcto para quien tiene que poder ver las tres el primer día, y asignarle las tres
   * explícitamente sería peor — el día que se abra la cuarta, quedaría fuera sin que nada avise.
   */
  registrar(`✓ Super Admin ${datos.email}: creado con alcance GLOBAL`);
  return 'creado';
}
