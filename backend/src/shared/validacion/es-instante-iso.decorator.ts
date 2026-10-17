import { ValidationOptions, registerDecorator } from 'class-validator';

/**
 * Un instante ISO-8601 **con hora y con zona explícita**. `2027-03-08T17:00:00.000Z` o
 * `2027-03-08T11:00:00-06:00`.
 *
 * ## POR QUÉ `@IsISO8601({ strict: true })` NO BASTA, Y EL DEFECTO QUE DEJABA PASAR
 *
 * `strict` en `validator.js` significa *"que la fecha exista de verdad"* (rechaza `2027-02-30`).
 * **No exige la hora ni la zona.** Así que `@IsISO8601({ strict: true })` aceptaba:
 *
 * - **`2027-03-08`** — una fecha de pared sin hora. `new Date('2027-03-08')` la interpreta como
 *   **medianoche UTC**, que en Querétaro son las **18:00 del día 7**. Consultar la agenda del 8
 *   con `inicio=2027-03-08&fin=2027-03-09` devolvía la tarde del 7 y **perdía las citas del 8 a
 *   partir de las 18:00**. En Analítica, un reporte "de marzo" empezaba el 28 de febrero por la
 *   tarde y terminaba el 30 de marzo a las 18:00.
 * - **`2027-03-08T11:00:00`** — hora sin zona. `new Date` la resuelve en la zona **del proceso**,
 *   que en Railway es UTC: la cita se agendaba seis horas antes de lo pedido.
 *
 * Ninguno de los dos fallaba: desplazaban el resultado en silencio. Y los comentarios de los DTO
 * ya decían *"instante absoluto en ISO-8601 **con zona**"* — lo que faltaba era hacerlo exigible.
 *
 * Las fechas de pared `YYYY-MM-DD` **sí existen** en esta API (la lista de espera: *"la clienta
 * pide el jueves"*), y por eso se validan con su propio `@Matches(/^\d{4}-\d{2}-\d{2}$/)`. La
 * distinción entre *fecha de pared* e *instante* es del dominio, y ahora los dos tipos tienen cada
 * uno su validador en vez de compartir uno que acepta ambos.
 */
export function EsInstanteIso(opciones?: ValidationOptions) {
  return function (objeto: object, propiedad: string): void {
    registerDecorator({
      name: 'esInstanteIso',
      target: objeto.constructor,
      propertyName: propiedad,
      options: opciones,
      validator: {
        validate: (valor: unknown) => esInstanteIso(valor),
        defaultMessage: () =>
          `${propiedad} debe ser un instante ISO-8601 con hora y zona explícita, por ejemplo 2027-03-08T11:00:00-06:00 o 2027-03-08T17:00:00Z`,
      },
    });
  };
}

/**
 * `YYYY-MM-DDTHH:MM(:SS(.mmm))?` seguido de `Z` o de `±HH:MM`.
 *
 * El desfase se exige **con dos puntos** (`-06:00`, no `-0600`): es lo que produce
 * `Date.prototype.toISOString()` y lo que manda el frontend, y aceptar las dos formas solo
 * ampliaría la superficie sin que nadie la use.
 */
const INSTANTE_ISO = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function esInstanteIso(valor: unknown): boolean {
  if (typeof valor !== 'string') return false;

  const partes = INSTANTE_ISO.exec(valor);
  if (!partes) return false;

  if (Number.isNaN(new Date(valor).getTime())) return false;

  /**
   * El 30 de febrero **no lo detecta `new Date`**: lo desborda a marzo en silencio, así que
   * `2027-02-30T11:00:00Z` daba una fecha válida (el 2 de marzo) y pasaba la validación. Era
   * justamente la clase de error que `strict: true` decía cubrir.
   *
   * El día del calendario se comprueba aparte y **en UTC**, para que el resultado no dependa del
   * desfase que traiga la cadena: `2027-03-08T00:00:00-06:00` es un instante legítimo cuya fecha
   * en UTC es el día 8 a las 06:00, y comparar contra la fecha local del desfase daría falsos
   * negativos en los bordes del día.
   */
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const comoFecha = new Date(Date.UTC(anio, mes - 1, dia));
  return comoFecha.getUTCFullYear() === anio && comoFecha.getUTCMonth() === mes - 1 && comoFecha.getUTCDate() === dia;
}
