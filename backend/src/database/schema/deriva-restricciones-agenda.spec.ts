import { crearBaseDeDatosDePrueba } from '../test-utils/postgres-de-prueba';
import { ESTADOS_CITA, ESTADOS_QUE_LIBERAN_HORARIO } from './agenda.schema';

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

  it('las tres restricciones a mano existen en la base migrada', () => {
    // Si una desaparece, las comprobaciones siguientes pasarían por vacuidad.
    expect([...definiciones.keys()].sort()).toEqual(
      expect.arrayContaining(['citas_estado_valido', 'citas_manicurista_sin_solapamiento', 'citas_silla_sin_solapamiento']),
    );
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
});
