import { crearBaseDeDatosDePrueba } from '../test-utils/postgres-de-prueba';
import {
  ESTADOS_CITA,
  ESTADOS_LISTA_ESPERA,
  ESTADOS_QUE_LIBERAN_HORARIO,
  ESTADOS_QUE_NO_CONSUMEN_LA_GARANTIA,
} from './agenda.schema';

/**
 * DETECTOR DE DERIVA entre los arrays de TypeScript y las restricciones escritas a mano en las
 * migraciones (bloqueo 2 de Fase 2).
 *
 * POR QUÉ EXISTE. Drizzle no sabe expresar `CHECK` ni `EXCLUDE USING gist`, así que los tres viven
 * como SQL a mano en `0005`/`0006`/`0007` y **no están en su snapshot**. Eso crea una regla no
 * verificable: quien añada un estado tiene que editar hasta **cuatro** sitios — el array de TS, el
 * `CHECK`, y el `WHERE` de las dos `EXCLUDE`. Hasta ahora lo único que lo sostenía era un
 * comentario, y un comentario no falla el build.
 *
 * LO QUE PASA SI SE OLVIDA, y es la razón de que esto sea una prueba y no una nota:
 *
 * - **Olvidar el `CHECK`**: el estado nuevo existe en el código y PostgreSQL lo rechaza al
 *   insertar. Molesto, pero ruidoso — se descubre enseguida.
 * - **Olvidar un `WHERE`**: *silencioso y grave*. Si el estado nuevo debía liberar el horario y la
 *   `EXCLUDE` no lo sabe, el hueco se queda ocupado por una cita muerta y nadie lo nota hasta que
 *   una clienta no puede agendar. Si debía ocupar y la restricción no lo cuenta, se puede
 *   sobrevender la misma silla — **la invariante física deja de ser una invariante**.
 *
 * Estas comprobaciones no reemplazan a la migración como fuente de verdad: la hacen **exigible**.
 */
describe('Deriva de restricciones de `agenda.citas` (bloqueo 2)', () => {
  /** Literales `'...'::text` de un `pg_get_constraintdef`, en el orden en que aparecen. */
  const literales = (definicion: string): string[] =>
    [...definicion.matchAll(/'([^']+)'::text/g)].map((coincidencia) => coincidencia[1]);

  let definiciones: Map<string, string>;

  beforeAll(async () => {
    const db = await crearBaseDeDatosDePrueba();
    const filas = (await db.execute(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conrelid = 'agenda.citas'::regclass`,
    )) as unknown as { conname: string; def: string }[];

    definiciones = new Map(filas.map((fila) => [fila.conname, fila.def]));
  });

  it('las CUATRO restricciones a mano existen en la base migrada', () => {
    // Si una desaparece, las comprobaciones siguientes pasarían por vacuidad.
    //
    // `citas_garantia_coherente` se añadió en la auditoría de 2026-10-17: entró con la migración
    // `0016` y **nadie la vigilaba**. Es exactamente el riesgo que este archivo existe para cubrir
    // —Drizzle no la tiene en su snapshot, así que una migración regenerada la perdería sin que
    // nada fallara— y la guarda decía "las tres" mientras ya eran cuatro.
    expect([...definiciones.keys()].sort()).toEqual(
      expect.arrayContaining([
        'citas_estado_valido',
        'citas_manicurista_sin_solapamiento',
        'citas_silla_sin_solapamiento',
        'citas_garantia_coherente',
      ]),
    );
  });

  describe('garantías (`RN-GAR-01..06`) — restricciones de la migración `0016`/`0017`', () => {
    it('`es_garantia` y `cita_garantizada_id` van juntos o ninguno', () => {
      const definicion = definiciones.get('citas_garantia_coherente')!;

      // Las dos ramas: ni una garantía sin la cita que honra, ni una cita normal apuntando a una.
      expect(definicion).toContain('es_garantia');
      expect(definicion).toContain('cita_garantizada_id');
      // Y la entidad impide construir el estado ilegal antes de llegar aquí: el SQLSTATE de un
      // `CHECK` es `23514`, que `HttpExceptionFilter` no traduce — saldría como un 500 opaco.
    });

    it('UNA SOLA GARANTÍA VIVA POR SERVICIO, y el índice EXCLUYE `reprogramada`', async () => {
      /**
       * ## EL DEFECTO QUE ESTE PREDICADO CORRIGE (auditoría 2026-10-17)
       *
       * La `0016` creó el índice con `WHERE es_garantia = true` a secas. Pero reprogramar en Blanc
       * **no mueve la fila**: la original queda `reprogramada` y nace otra (`DEC-042`, porque la
       * cadena es un dato de negocio con tope de 3). Las dos compartían `cita_garantizada_id` con
       * la bandera puesta, así que el índice las rechazaba: **la clienta a la que se le estropeó el
       * trabajo no podía cambiar la hora de su reposición**, y recibía un 500 porque el `23505` de
       * este índice no tiene traducción de dominio.
       *
       * El `WHERE` completo se comprueba, y no solo que el índice exista: si alguien lo recreara
       * sin la exclusión, el invariante seguiría pareciendo correcto y la reprogramación volvería
       * a romperse.
       */
      const db = await crearBaseDeDatosDePrueba();
      const indices = (await db.execute(
        `SELECT indexdef FROM pg_indexes WHERE schemaname = 'agenda' AND tablename = 'citas'`,
      )) as unknown as { indexdef: string }[];

      const unaGarantia = indices.find((i) => i.indexdef.includes('citas_garantia_unica_por_origen'));
      expect(unaGarantia).toBeDefined();
      expect(unaGarantia!.indexdef).toContain('UNIQUE');
      expect(unaGarantia!.indexdef).toContain('es_garantia');
      /**
       * El `WHERE` tiene que coincidir **exactamente** con `ESTADOS_QUE_NO_CONSUMEN_LA_GARANTIA`.
       *
       * Es la misma clase de deriva que vigila el `CHECK` de estados, y con las mismas dos formas
       * de salir mal: si el índice **excluye más** estados de los que el array dice, se conceden
       * segundas reposiciones que nadie autorizó; si excluye **menos**, una clienta a la que el
       * salón le canceló su reposición se queda sin ella. La segunda es la que acaba en PROFECO.
       *
       * Se compara como conjunto: el orden en que PostgreSQL imprime los literales no es deriva.
       */
      expect(literales(unaGarantia!.indexdef).sort()).toEqual([...ESTADOS_QUE_NO_CONSUMEN_LA_GARANTIA].sort());
      // Y sigue siendo una NEGACIÓN: con `= ANY` la misma lista significaría lo contrario —que solo
      // esos tres estados consumen el derecho—, que es justo al revés.
      expect(unaGarantia!.indexdef).toContain('<> ALL');
      expect(unaGarantia!.indexdef).not.toContain('= ANY');
    });

    it('`no_show` y `completada` NO están entre los estados que perdonan la garantía', () => {
      /**
       * Guardia explícita sobre el fondo de la decisión de la Dueña, y no sobre su implementación:
       * el derecho se conserva cuando **el salón** no cumplió, no cuando la clienta no vino. Si
       * alguien añadiera `no_show` al array, el sistema regalaría una reposición a quien dejó la
       * silla vacía — y lo haría en silencio, porque todo lo demás seguiría pasando.
       */
      expect(ESTADOS_QUE_NO_CONSUMEN_LA_GARANTIA).not.toContain('no_show');
      expect(ESTADOS_QUE_NO_CONSUMEN_LA_GARANTIA).not.toContain('completada');
      expect([...ESTADOS_QUE_NO_CONSUMEN_LA_GARANTIA].sort()).toEqual(['cancelada', 'expirada', 'reprogramada']);
    });
  });

  it('el `CHECK` de estados coincide EXACTAMENTE con `ESTADOS_CITA`', () => {
    const enLaBase = literales(definiciones.get('citas_estado_valido')!);

    // Comparación de conjuntos, no de orden: reordenar el array de TS no es una deriva.
    expect([...enLaBase].sort()).toEqual([...ESTADOS_CITA].sort());
  });

  describe.each([
    ['citas_silla_sin_solapamiento', 'la silla'],
    ['citas_manicurista_sin_solapamiento', 'la manicurista'],
  ])('%s', (nombre) => {
    it('su `WHERE` excluye EXACTAMENTE los estados de `ESTADOS_QUE_LIBERAN_HORARIO`', () => {
      const enLaBase = literales(definiciones.get(nombre)!);

      // El predicado está formulado POR NEGACIÓN (`estado <> ALL (...)`), a propósito: un estado
      // nuevo ocupa por defecto. Equivocarse hacia "ocupa" hace que una clienta tenga que llamar;
      // equivocarse hacia "libera" permite sobrevender la misma silla en silencio.
      expect([...enLaBase].sort()).toEqual([...ESTADOS_QUE_LIBERAN_HORARIO].sort());
    });

    it('sigue siendo una negación: si alguien la invierte a `= ANY`, el array significa lo contrario', () => {
      // Esta prueba protege a la anterior. Comparar listas no detecta un cambio de operador, y con
      // `= ANY` la MISMA lista pasaría a significar "solo estos ocupan" — exactamente lo opuesto.
      expect(definiciones.get(nombre)!).toContain('<> ALL');
      expect(definiciones.get(nombre)!).not.toContain('= ANY');
    });
  });

  it('`en_espera_pago` LIBERA el horario (`RN-ANT-03` por encima de `DEC-034`)', () => {
    // Guardia explícita sobre la corrección de fondo de la migración `0007`: la regla aprobada dice
    // que el horario sigue disponible mientras el anticipo esté pendiente, y que "el primero en
    // pagar se queda con el cupo". Si alguien vuelve a hacer que ocupe, esa carrera deja de existir
    // y las dos clientas de lista roja quedan bloqueadas sin haber pagado ninguna.
    expect(ESTADOS_QUE_LIBERAN_HORARIO).toContain('en_espera_pago');
    expect(literales(definiciones.get('citas_silla_sin_solapamiento')!)).toContain('en_espera_pago');
  });

  it('la FK de la cadena de reprogramaciones apunta a la propia tabla, dentro del mismo esquema', () => {
    // `ADR-005` prohíbe FKs CRUZADAS entre esquemas; esta es interna y por tanto legítima. Se
    // verifica para que la distinción quede ejercida y no solo comentada.
    expect(definiciones.get('citas_cita_origen_id_fk')).toBe('FOREIGN KEY (cita_origen_id) REFERENCES agenda.citas(id)');
  });

  describe('`agenda.lista_espera` — mismas restricciones a mano, mismo riesgo', () => {
    let definicionesListaEspera: Map<string, string>;

    beforeAll(async () => {
      const db = await crearBaseDeDatosDePrueba();
      const filas = (await db.execute(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
         WHERE conrelid = 'agenda.lista_espera'::regclass`,
      )) as unknown as { conname: string; def: string }[];

      definicionesListaEspera = new Map(filas.map((fila) => [fila.conname, fila.def]));
    });

    it('el `CHECK` de estados coincide EXACTAMENTE con `ESTADOS_LISTA_ESPERA`', () => {
      const enLaBase = literales(definicionesListaEspera.get('lista_espera_estado_valido')!);
      expect([...enLaBase].sort()).toEqual([...ESTADOS_LISTA_ESPERA].sort());
    });

    it('UNA SOLA OFERTA ABIERTA POR FILA: el índice único parcial existe', async () => {
      // Es el invariante central de `DEC-039` ("se avisa a una sola clienta a la vez"), y vive en
      // PostgreSQL por el mismo motivo que el no-doble-booking: dos liberaciones simultáneas
      // pasarían las dos la comprobación en memoria.
      const db = await crearBaseDeDatosDePrueba();
      const indices = (await db.execute(
        `SELECT indexdef FROM pg_indexes WHERE schemaname = 'agenda' AND tablename = 'lista_espera'`,
      )) as unknown as { indexdef: string }[];

      const unaOferta = indices.find((i) => i.indexdef.includes('lista_espera_una_notificada_por_fila'));
      expect(unaOferta).toBeDefined();
      expect(unaOferta!.indexdef).toContain('UNIQUE');
      // PARCIAL, no total: si perdiera el `WHERE`, impediría tener dos solicitudes cualesquiera
      // de la misma fila — rompería la lista de espera entera en vez de limitar las ofertas.
      expect(unaOferta!.indexdef).toContain("WHERE (estado = 'notificada'::text)");
    });

    it('una oferta `notificada` NO PUEDE existir sin ventana ni sin hueco ofrecido', () => {
      // Sin `expira_en` sería una oferta que nunca caduca y bloquearía la fila para siempre.
      // Sin `hueco_inicio` no se sabría qué pasar a la siguiente, y el FIFO quedaría roto.
      const definicion = definicionesListaEspera.get('lista_espera_ventana_coherente')!;
      expect(definicion).toContain('expira_en');
      expect(definicion).toContain('hueco_inicio');
      expect(definicion).toContain('notificada_en');
    });

    it('`aceptada` y tener cita son lo mismo, en los dos sentidos', () => {
      expect(definicionesListaEspera.get('lista_espera_cita_solo_si_aceptada')).toBeDefined();
    });
  });
});
