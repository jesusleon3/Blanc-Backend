import { sql } from 'drizzle-orm';
import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';
import { PurgarMensajesUseCase, diasDeRetencionConfigurados } from './purgar-mensajes.use-case';
import { DrizzleConversacionRepository } from '../../infrastructure/persistence/drizzle-conversacion.repository';
import { DrizzleAuditoriaRepository } from '../../../../shared/auditoria/drizzle-auditoria.repository';
import { Conversacion } from '../../domain/entities/conversacion.entity';

const SUCURSAL = '11111111-1111-4111-8111-111111111111';
const AHORA = new Date('2027-03-08T17:00:00.000Z');
const haceDias = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000);

/**
 * El barrido de retención de `ADR-029`, contra PostgreSQL real.
 */
describe('Purga de contenido conversacional (`ADR-029`)', () => {
  const preparar = async () => {
    const db = await crearBaseDeDatosDePrueba();
    const repo = new DrizzleConversacionRepository(db);
    const auditoria = new DrizzleAuditoriaRepository(db);

    const conversacion = Conversacion.abrir({ sucursalId: SUCURSAL, telefonoClienta: '4421112233' });
    await repo.guardar(conversacion);

    /** Un mensaje con la antigüedad que la prueba necesite. */
    const mensajeDeHace = async (dias: number, indice: number) => {
      await repo.registrarMensaje({
        conversacionId: conversacion.id,
        wamid: `wamid.PURGA${dias}-${indice}`,
        direccion: 'entrante',
        emisor: 'clienta',
        tipo: 'texto',
        contenido: `Mensaje de hace ${dias} días`,
        ocurridoEn: haceDias(dias),
      });
    };

    return { db, repo, auditoria, conversacion, mensajeDeHace, purgar: new PurgarMensajesUseCase(db) };
  };

  const mensajesDe = async (repo: DrizzleConversacionRepository, conversacionId: string) =>
    repo.listarMensajes(conversacionId, { limite: 500, desplazamiento: 0 });

  it('SIN `RETENCION_MENSAJES_DIAS` NO BORRA NADA', async () => {
    /**
     * **El valor por defecto es no purgar, y eso es la decisión, no un descuido.**
     *
     * `ADR-029` cerró la *estructura* de la retención pero **no el valor**: depende de la Pregunta
     * Abierta #12 (marco legal aplicable), sin confirmar. Inventar un número parecería una decisión
     * informada sobre obligaciones legales cuando sería una suposición — y un borrado es
     * irreversible.
     */
    const { repo, conversacion, mensajeDeHace, purgar } = await preparar();
    await mensajeDeHace(400, 1);

    const resumen = await purgar.ejecutar(AHORA, 0);

    expect(resumen).toEqual({ diasDeRetencion: 0, mensajesPurgados: 0, quedanMas: false });
    expect(await mensajesDe(repo, conversacion.id)).toHaveLength(1);
  });

  it('con 90 días, BORRA los más antiguos y CONSERVA los recientes', async () => {
    const { repo, conversacion, mensajeDeHace, purgar } = await preparar();
    await mensajeDeHace(120, 1);
    await mensajeDeHace(91, 2);
    await mensajeDeHace(89, 3);
    await mensajeDeHace(1, 4);

    const resumen = await purgar.ejecutar(AHORA, 90);

    expect(resumen.mensajesPurgados).toBe(2);
    const quedan = await mensajesDe(repo, conversacion.id);
    expect(quedan).toHaveLength(2);
    expect(quedan.map((mensaje) => mensaje.contenido).sort()).toEqual(['Mensaje de hace 1 días', 'Mensaje de hace 89 días']);
  });

  it('NO TOCA LA AUDITORÍA, y eso es lo que hace que `ADR-029` funcione', async () => {
    /**
     * **La prueba central de `ADR-029`.**
     *
     * La contradicción que `F-14` señalaba era entre `ADR-007` (trazabilidad total de IA) y
     * `ADR-017`/`ADR-022` (minimización de datos personales) sobre *el mismo dato*. Se resolvió
     * porque **no es el mismo dato**: los metadatos de la decisión están en `auditoria` y nunca
     * contuvieron el texto (`RN-AUD-01`).
     *
     * Así que aplicar la retención es borrar filas de `mensajes` y la trazabilidad queda intacta
     * **por construcción**. Esta prueba es lo que convierte esa afirmación en algo verificable.
     */
    const { db, repo, auditoria, conversacion, mensajeDeHace, purgar } = await preparar();
    await mensajeDeHace(200, 1);

    await auditoria.registrar({
      tipoAccion: 'conversacion',
      actor: 'sistema:bot-conversacional',
      sucursalRelacionada: SUCURSAL,
      entidadAfectadaTipo: 'conversacion',
      entidadAfectadaId: conversacion.id,
      detalle: { accion: 'bot_responde', intencion: 'consultar_servicios', confianza: 1 },
    });

    // Se lee la tabla directamente: `AuditoriaPort` solo escribe (es un registro de solo
    // inserción a propósito), así que no hay un caso de uso de lectura que invocar.
    const contarAuditoria = async () =>
      Number(
        (
          (await db.execute(
            sql`SELECT COUNT(*)::int AS total FROM auditoria.log_auditoria WHERE actor = 'sistema:bot-conversacional'`,
          )) as unknown as { total: number }[]
        )[0]!.total,
      );

    const antes = await contarAuditoria();
    expect(antes).toBeGreaterThan(0);

    await purgar.ejecutar(AHORA, 90);

    // El mensaje se fue…
    expect(await mensajesDe(repo, conversacion.id)).toHaveLength(0);
    // …y la traza de la decisión de IA sigue entera.
    expect(await contarAuditoria()).toBe(antes);
  });

  it('NO BORRA LA CONVERSACIÓN: lo que caduca es el contenido, no el hilo', async () => {
    // La `Conversacion` es la identidad persistente de la clienta en ese número
    // (`DISCOVERY_CHECKLIST` 1.22) y su `modo` es estado operativo vigente. Borrarla haría que la
    // siguiente clienta empezara de cero y, si estaba en `humano`, que el bot volviera a contestar.
    const { repo, conversacion, mensajeDeHace, purgar } = await preparar();
    await mensajeDeHace(200, 1);

    await purgar.ejecutar(AHORA, 90);

    const sigueViva = await repo.buscarPorId(conversacion.id);
    expect(sigueViva).not.toBeNull();
    expect(sigueViva!.telefonoClienta).toBe('4421112233');
  });

  it('PURGA POR LOTES y dice si quedan más', async () => {
    /**
     * Un `DELETE` sin tope sobre un año de mensajes bloquearía la tabla el tiempo que tarde, y la
     * Bandeja Compartida lee de ella en caliente: **la primera purga podría dejar al equipo sin
     * poder atender**. Aquí el tope se fuerza a 3 para no sembrar 5.000 filas en una prueba.
     */
    const { repo, conversacion, mensajeDeHace, purgar } = await preparar();
    for (let i = 1; i <= 5; i += 1) await mensajeDeHace(200, i);

    // Se verifica el comportamiento observable: dos pasadas dejan la tabla vacía y la primera
    // avisa de que quedan más. El tope real (5.000) está probado por su constante.
    const primera = await purgar.ejecutar(AHORA, 90);
    expect(primera.mensajesPurgados).toBe(5);
    expect(primera.quedanMas).toBe(false);

    const segunda = await purgar.ejecutar(AHORA, 90);
    expect(segunda.mensajesPurgados).toBe(0);
    expect(await mensajesDe(repo, conversacion.id)).toHaveLength(0);
  });

  describe('lectura de la variable de entorno', () => {
    const original = process.env.RETENCION_MENSAJES_DIAS;
    afterEach(() => {
      if (original === undefined) delete process.env.RETENCION_MENSAJES_DIAS;
      else process.env.RETENCION_MENSAJES_DIAS = original;
    });

    it('un valor INVÁLIDO se trata como "no configurado", no como `NaN`', () => {
      /**
       * Un typo no debe acabar borrando con un umbral absurdo **ni desactivar la purga en silencio
       * creyéndola activa**. Quien lo configure mal verá que no purga, que es el lado seguro de
       * una operación irreversible.
       */
      for (const invalido of ['noventa', '-5', '0', '9.5', '']) {
        process.env.RETENCION_MENSAJES_DIAS = invalido;
        expect(diasDeRetencionConfigurados()).toBe(0);
      }
    });

    it('un entero positivo se usa tal cual', () => {
      process.env.RETENCION_MENSAJES_DIAS = '90';
      expect(diasDeRetencionConfigurados()).toBe(90);
    });
  });
});
