import { customType } from 'drizzle-orm/pg-core';

/**
 * Rango horario de una cita o de una excepción de personal, como `tstzrange` nativo de PostgreSQL.
 *
 * POR QUÉ UN RANGO Y NO DOS COLUMNAS `inicio`/`fin`: la restricción `EXCLUDE USING gist` opera
 * sobre el operador de solapamiento `&&`, que solo existe para tipos de rango. Con dos columnas
 * sueltas el invariante anti-doble-booking tendría que vivir en la aplicación, que es
 * exactamente lo que `04-data-model.md` §5.1 descarta.
 *
 * POR QUÉ `tstzrange` Y NO `tsrange`: todo el resto del esquema usa `timestamp with time zone`
 * (`creado_en`, `actualizado_en`, …) y `DEC-031` lo fija así. Mezclar un rango sin zona obligaría
 * a castear en cada comparación y abriría la puerta a comparar una hora "de pared" con un
 * instante absoluto — el tipo de error que no falla en pruebas y sí en producción.
 */
export interface RangoHorario {
  inicio: Date;
  fin: Date;
}

export const tstzrange = customType<{ data: RangoHorario; driverData: string }>({
  dataType() {
    return 'tstzrange';
  },
  /** `[inicio, fin)` — inicio inclusivo, fin EXCLUSIVO: una cita que acaba a las 11:00 y otra que
   * empieza a las 11:00 **no** se solapan. Con `]` serían un conflicto y el salón no podría
   * encadenar citas consecutivas. */
  toDriver(valor: RangoHorario): string {
    return `[${valor.inicio.toISOString()},${valor.fin.toISOString()})`;
  },
  fromDriver(valor: string): RangoHorario {
    const partes = /^[[(]"?([^",]+)"?,"?([^",]+)"?[\])]$/.exec(valor);
    if (!partes) {
      throw new Error(`No se pudo interpretar el rango horario devuelto por PostgreSQL: ${valor}`);
    }
    return { inicio: new Date(partes[1]), fin: new Date(partes[2]) };
  },
});
