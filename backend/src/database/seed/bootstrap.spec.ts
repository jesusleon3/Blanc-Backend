import { crearBaseDeDatosDePrueba } from '../test-utils/postgres-de-prueba';
import { ejecutarBootstrap, type ResumenDeBootstrap } from './bootstrap';
import { HORARIO_DE_BLANC, SUCURSALES_DE_BLANC, nombreDeSilla } from './datos-de-blanc';
import { DrizzleSucursalRepository } from '../../modules/sucursales-y-personal/infrastructure/persistence/drizzle-sucursal.repository';
import { DrizzleSillaRepository } from '../../modules/agenda/infrastructure/persistence/drizzle-silla.repository';
import { DrizzleUsuarioRepository } from '../../modules/identidad-y-accesos/infrastructure/persistence/drizzle-usuario.repository';
import { DrizzleConversacionRepository } from '../../modules/conversaciones/infrastructure/persistence/drizzle-conversacion.repository';
import { DrizzleServicioRepository } from '../../modules/catalogo-y-cotizacion/infrastructure/persistence/drizzle-servicio.repository';
import { SERVICIOS_DE_BLANC } from './catalogo-de-blanc';
import { Rol } from '../../shared/auth/rol';

/** El `sub` de Supabase es un **uuid**, y `usuarios.supabase_user_id` es una columna `uuid`. */
const SUB_DE_SUPABASE = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const SUPER_ADMIN = { email: 'duena@blanc.mx', nombre: 'Dueña de Blanc', supabaseUserId: SUB_DE_SUPABASE };

/**
 * El bootstrap de producción, probado contra PostgreSQL real.
 *
 * ## LA IDEMPOTENCIA NO ES UNA COMODIDAD: ES LA CONDICIÓN DE USO
 *
 * Este script se va a ejecutar **en la base de producción**, probablemente desde la consola de
 * Railway, probablemente más de una vez — porque un despliegue se reintenta, porque alguien no
 * recuerda si ya lo corrió, o porque se añade una sucursal y hay que volver a pasarlo. Un seed que
 * duplique sillas **cambia la capacidad vendible del salón** (`DEC-031`: el número de filas *es* la
 * capacidad), y un seed que falle a la segunda deja al operador sin saber si el estado quedó a
 * medias.
 *
 * Así que la prueba central no es "siembra bien": es **"correrlo dos veces deja exactamente lo
 * mismo que correrlo una"**.
 */
describe('Bootstrap de producción (idempotente)', () => {
  const repos = async () => {
    const db = await crearBaseDeDatosDePrueba();
    return {
      db,
      sucursales: new DrizzleSucursalRepository(db),
      sillas: new DrizzleSillaRepository(db),
      usuarios: new DrizzleUsuarioRepository(db),
      conversaciones: new DrizzleConversacionRepository(db),
    };
  };

  describe('primera ejecución en limpio', () => {
    it('crea LAS TRES SUCURSALES con el horario real de Blanc', async () => {
      const { db, sucursales } = await repos();

      await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      const creadas = await sucursales.listar();
      expect(creadas.map((sucursal) => sucursal.nombre).sort()).toEqual(['Lomas', 'Zibatá', 'Álamos'].sort());

      for (const sucursal of creadas) {
        expect(sucursal.horarioSemanal.toJSON()).toEqual(HORARIO_DE_BLANC);
      }
    });

    it('EL DOMINGO QUEDA CERRADO (`RN-AGE-12`) y el horario de semana es PARTIDO', async () => {
      /**
       * Los dos datos que más fácil se capturan mal, y de los que depende el motor: si el domingo
       * tuviera un bloque, el sistema vendería citas con el salón cerrado; si lunes a viernes
       * fuera un solo bloque de 9 a 18, vendería citas a las 13:00, cuando no hay nadie.
       */
      const { db, sucursales } = await repos();

      await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      const [cualquiera] = await sucursales.listar();
      const horario = cualquiera!.horarioSemanal.toJSON();

      expect(horario.domingo).toEqual([]);
      expect(horario.lunes).toEqual([
        { horaInicio: '09:00', horaFin: '12:00' },
        { horaInicio: '15:00', horaFin: '18:00' },
      ]);
      expect(horario.sabado).toEqual([{ horaInicio: '09:00', horaFin: '15:00' }]);
    });

    it('crea las sillas con el NÚMERO EXACTO de cada sucursal, incluida Álamos con UNA', async () => {
      // El número de filas **es** la capacidad vendible (`DEC-031`). Álamos con una silla no es un
      // caso de prueba: es un local real, y es el que destapó que no hay recepcionistas.
      const { db, sucursales, sillas } = await repos();

      await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      for (const esperada of SUCURSALES_DE_BLANC) {
        const sucursal = (await sucursales.listar()).find((candidata) => candidata.nombre === esperada.nombre);
        const suyas = await sillas.listarPorSucursal(sucursal!.id);

        expect(suyas).toHaveLength(esperada.sillas);
        expect(suyas.every((silla) => silla.activa)).toBe(true);
        expect(suyas.map((silla) => silla.nombre).sort()).toEqual(
          Array.from({ length: esperada.sillas }, (_, indice) => nombreDeSilla(esperada.nombre, indice + 1)).sort(),
        );
      }
    });

    it('crea el SUPER ADMIN vinculado a su cuenta de Supabase y con alcance GLOBAL', async () => {
      /**
       * Sin esto, una base recién desplegada **no tiene por dónde entrar**: todos los endpoints de
       * alta de usuarios exigen `SUPER_ADMIN` o `ADMINISTRADOR`, así que habría que insertar la
       * primera fila con SQL a mano en producción. Este es el único arranque en frío del sistema.
       */
      const { db, usuarios } = await repos();

      await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      const permisos = await usuarios.obtenerPermisosPorSupabaseUserId(SUPER_ADMIN.supabaseUserId);

      expect(permisos).not.toBeNull();
      expect(permisos!.rol).toBe(Rol.SUPER_ADMIN);
      expect(permisos!.activa).toBe(true);
      // `GLOBAL` y no una lista: es quien tiene que poder ver las tres sucursales el primer día.
      expect(permisos!.sucursales).toBe('GLOBAL');
    });

    it('da de alta los `phone_number_id` que vengan por ENTORNO, y omite los que no', async () => {
      /**
       * Los tres números se migran en momentos distintos (`GO_LIVE_RUNBOOK.md`), así que el seed
       * **no puede exigirlos**. Una sucursal sin número dado de alta debe poder existir y operar
       * desde el mostrador; lo único que no puede es recibir WhatsApp.
       */
      const { db, conversaciones, sucursales } = await repos();

      await ejecutarBootstrap(db, {
        superAdmin: SUPER_ADMIN,
        phoneNumberIds: { Zibatá: 'pn-zibata-real' },
      });

      const zibata = (await sucursales.listar()).find((sucursal) => sucursal.nombre === 'Zibatá');
      expect(await conversaciones.buscarSucursalDeNumero('pn-zibata-real')).toBe(zibata!.id);
      expect(await conversaciones.buscarNumeroDeSucursal(zibata!.id)).toBe('pn-zibata-real');

      // Lomas no trajo número: existe, y simplemente no tiene mapeo.
      const lomas = (await sucursales.listar()).find((sucursal) => sucursal.nombre === 'Lomas');
      expect(await conversaciones.buscarNumeroDeSucursal(lomas!.id)).toBeNull();
    });

    it('devuelve un RESUMEN de lo que hizo, para que el operador lo vea en la consola', async () => {
      const { db } = await repos();

      const resumen = await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      expect(resumen).toMatchObject<Partial<ResumenDeBootstrap>>({
        sucursalesCreadas: 3,
        sucursalesExistentes: 0,
        sillasCreadas: 5 + 3 + 1,
        serviciosCreados: SERVICIOS_DE_BLANC.length,
        superAdmin: 'creado',
      });
    });
  });

  describe('SEGUNDA EJECUCIÓN: idempotencia', () => {
    it('NO DUPLICA NADA y NO FALLA', async () => {
      /**
       * **La prueba que justifica el diseño entero.** Se va a correr en producción más de una vez:
       * un despliegue se reintenta, alguien no recuerda si ya lo pasó, o se añade la cuarta
       * sucursal. Duplicar sillas **cambiaría la capacidad vendible del salón**.
       */
      const { db, sucursales, sillas, usuarios } = await repos();

      await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN, phoneNumberIds: { Zibatá: 'pn-zibata-real' } });
      const segunda = await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN, phoneNumberIds: { Zibatá: 'pn-zibata-real' } });

      // Nada nuevo, y lo dice en el resumen.
      expect(segunda.sucursalesCreadas).toBe(0);
      expect(segunda.sucursalesExistentes).toBe(3);
      expect(segunda.sillasCreadas).toBe(0);
      expect(segunda.superAdmin).toBe('ya_existia');

      // Y el estado real no cambió.
      const todas = await sucursales.listar();
      expect(todas).toHaveLength(3);
      for (const esperada of SUCURSALES_DE_BLANC) {
        const sucursal = todas.find((candidata) => candidata.nombre === esperada.nombre);
        expect(await sillas.listarPorSucursal(sucursal!.id)).toHaveLength(esperada.sillas);
      }
      expect(await usuarios.obtenerPermisosPorSupabaseUserId(SUPER_ADMIN.supabaseUserId)).not.toBeNull();
    });

    it('TRES ejecuciones seguidas siguen dejando el mismo estado', async () => {
      // Dos podría pasar por casualidad si la segunda fallara en silencio; tres descarta eso.
      const { db, sucursales, sillas } = await repos();

      for (let i = 0; i < 3; i += 1) {
        await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });
      }

      expect(await sucursales.listar()).toHaveLength(3);
      const zibata = (await sucursales.listar()).find((sucursal) => sucursal.nombre === 'Zibatá');
      expect(await sillas.listarPorSucursal(zibata!.id)).toHaveLength(5);
    });

    it('NO PISA el horario de una sucursal que alguien ya ajustó a mano', async () => {
      /**
       * El caso real: la Dueña cambia el horario de verano de Álamos desde el panel y alguien
       * vuelve a correr el seed. **Reescribirlo sería destructivo** — borraría una decisión de
       * negocio con un valor por defecto, y en silencio.
       *
       * Idempotente significa "no cambia el resultado", no "reimpone el valor de fábrica".
       */
      const { db, sucursales } = await repos();
      await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      const alamos = (await sucursales.listar()).find((sucursal) => sucursal.nombre === 'Álamos')!;
      alamos.actualizarConfiguracion({ horarioSemanal: { ...HORARIO_DE_BLANC, sabado: [{ horaInicio: '10:00', horaFin: '14:00' }] } });
      await sucursales.guardar(alamos);

      await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      const despues = (await sucursales.listar()).find((sucursal) => sucursal.nombre === 'Álamos')!;
      expect(despues.horarioSemanal.toJSON().sabado).toEqual([{ horaInicio: '10:00', horaFin: '14:00' }]);
    });

    it('NO REACTIVA una silla que Administración desactivó', async () => {
      // Desactivar una silla es reducir la capacidad a propósito (una estación en reparación).
      // Volver a crearla o reactivarla haría que el sistema vendiera un hueco que no existe.
      const { db, sucursales, sillas } = await repos();
      await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      const zibata = (await sucursales.listar()).find((sucursal) => sucursal.nombre === 'Zibatá')!;
      const [primera] = await sillas.listarPorSucursal(zibata.id);
      primera!.desactivar();
      await sillas.guardar(primera!);

      const resumen = await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      expect(resumen.sillasCreadas).toBe(0);
      const despues = await sillas.listarPorSucursal(zibata.id);
      expect(despues).toHaveLength(5);
      expect(despues.find((silla) => silla.id === primera!.id)!.activa).toBe(false);
    });
  });

  describe('validación de entrada', () => {
    it('FALLA RUIDOSAMENTE sin los datos del Super Admin', async () => {
      // El lado seguro: una base sembrada sin usuario inicial parece correcta y no se puede usar.
      const { db } = await repos();

      await expect(
        ejecutarBootstrap(db, { superAdmin: { email: '', nombre: 'X', supabaseUserId: SUB_DE_SUPABASE } }),
      ).rejects.toThrow(/SUPER_ADMIN_EMAIL/);
      await expect(ejecutarBootstrap(db, { superAdmin: { email: 'a@b.mx', nombre: 'X', supabaseUserId: '' } })).rejects.toThrow(
        /SUPER_ADMIN_SUPABASE_SUB/,
      );
    });

    it('EXIGE QUE EL `sub` SEA UN UUID, con un mensaje que dice dónde encontrarlo', async () => {
      /**
       * Sin esta validación el fallo llegaba como `PostgresError: invalid input syntax for type
       * uuid` **a mitad del seed**, con las sucursales ya creadas y sin decir qué variable estaba
       * mal. Lo destapó esta misma prueba al usar un `sub` de ejemplo que no era uuid.
       */
      const { db, sucursales } = await repos();

      await expect(
        ejecutarBootstrap(db, { superAdmin: { email: 'a@b.mx', nombre: 'X', supabaseUserId: 'duena@blanc.mx' } }),
      ).rejects.toThrow(/Authentication → Users/);

      // Y falla ANTES de escribir nada: la base queda intacta.
      expect(await sucursales.listar()).toHaveLength(0);
    });
  });

  describe('catálogo inicial', () => {
    it('siembra los servicios base con sus duraciones y precios', async () => {
      const { db } = await repos();
      const servicioRepo = new DrizzleServicioRepository(db);

      await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      const servicios = await servicioRepo.listar();
      expect(servicios.length).toBe(SERVICIOS_DE_BLANC.length);

      const gelish = servicios.find((servicio) => servicio.nombre === 'Gelish');
      expect(gelish).toBeDefined();
      // La duración es lo que `AgendarCitaUseCase` usa para derivar el fin de la cita: si está mal,
      // el sistema vende huecos del tamaño equivocado y nada falla.
      expect(gelish!.duracionBaseMinutos).toBe(45);
      expect(gelish!.precioBaseCentavos).toBe(35000);
      expect(gelish!.activo).toBe(true);
    });

    it('«Diseño especial» nace con COTIZACIÓN MANUAL (`DEC-033`)', async () => {
      /**
       * Corresponde a las celdas que `PA-02` dejó con valor cualitativo —*"dentro de la hora
       * dependiendo del diseño"*— y es la forma honesta de representarlas: no un número inventado.
       * Su cita nace con `totalCentavos: null` y el bot escala en vez de agendarla.
       */
      const { db } = await repos();
      await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      const servicios = await new DrizzleServicioRepository(db).listar();
      const especial = servicios.find((servicio) => servicio.nombre === 'Diseño especial');

      expect(especial!.requiereCotizacionManual).toBe(true);
      // Y el resto no lo exige: sería paralizar el agendamiento automático entero.
      expect(servicios.filter((servicio) => servicio.requiereCotizacionManual)).toHaveLength(1);
    });

    it('NO REIMPONE un precio que alguien ya corrigió desde el Backoffice', async () => {
      /**
       * **La prueba más importante del seed de catálogo.**
       *
       * Los valores de `catalogo-de-blanc.ts` son **provisionales**: la tabla real de la Dueña no
       * está en el repositorio y `PA-02` sigue parcialmente abierta. Reescribir el precio que
       * alguien corrigió sería **devolver un cobro a un número ficticio, y en silencio** — con
       * dinero real de por medio, que es exactamente el riesgo que el `DISCOVERY_CHECKLIST`
       * advierte sobre este punto.
       */
      const { db } = await repos();
      await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      const servicioRepo = new DrizzleServicioRepository(db);
      const gelish = (await servicioRepo.listar()).find((servicio) => servicio.nombre === 'Gelish')!;
      gelish.actualizarDatos({ precioBaseCentavos: 42000, duracionBaseMinutos: 50 });
      await servicioRepo.guardar(gelish);

      const segunda = await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      expect(segunda.serviciosCreados).toBe(0);
      const despues = (await servicioRepo.listar()).find((servicio) => servicio.nombre === 'Gelish')!;
      expect(despues.precioBaseCentavos).toBe(42000);
      expect(despues.duracionBaseMinutos).toBe(50);
    });

    it('NO REACTIVA un servicio dado de baja', async () => {
      // Desactivarlo fue retirarlo de la venta a propósito. Recrearlo lo volvería a ofrecer.
      const { db } = await repos();
      await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      const servicioRepo = new DrizzleServicioRepository(db);
      const retiro = (await servicioRepo.listar()).find((servicio) => servicio.nombre === 'Retiro')!;
      retiro.desactivar();
      await servicioRepo.guardar(retiro);

      const segunda = await ejecutarBootstrap(db, { superAdmin: SUPER_ADMIN });

      expect(segunda.serviciosCreados).toBe(0);
      expect((await servicioRepo.listar()).find((servicio) => servicio.nombre === 'Retiro')!.activo).toBe(false);
    });
  });
});
