/**
 * Los **códigos estables** del catálogo oficial de Blanc.
 *
 * ## QUÉ PROBLEMA RESUELVE ESTA LISTA
 *
 * El resolutor del bot tiene que saber **qué fila del catálogo** corresponde a lo que pidió la
 * clienta. Hasta ahora lo sabía por el **nombre**, y eso era frágil de una forma concreta: la Dueña
 * puede renombrar cualquier servicio desde `/admin` —*"Rubber + gel"* → *"Nivelación con rubber y
 * gel semipermanente"*— y el bot dejaba de encontrar la fila. Escalaba en vez de agendar, sin que
 * nadie entendiera por qué: la pantalla seguía mostrando el servicio perfectamente.
 *
 * El `codigo` es el identificador que **no cambia nunca**. El nombre es para la clienta y para la
 * Dueña; el código es para el sistema. Con esa separación, renombrar y cambiar precios en `/admin`
 * son operaciones seguras por construcción.
 *
 * ## POR QUÉ VIVE EN EL DOMINIO DEL CATÁLOGO Y NO EN EL SEED
 *
 * Porque es **vocabulario**, no datos de arranque. El seed aporta nombres, duraciones y precios —
 * todos editables. Esta lista aporta la identidad de cada combinación oficial, que es lo único de
 * la fila que no se puede editar. Ponerla en el seed habría obligado al bot a importar de
 * `database/seed/`, que es exactamente al revés de cómo deben correr las dependencias.
 *
 * ## POR QUÉ ES UNA UNIÓN DE LITERALES Y NO `string`
 *
 * Para que un código mal escrito **no compile**. El mapa del resolutor y la tabla del seed se
 * escriben los dos contra este tipo, así que una `RGEL-GELL` se detecta en `tsc` y no en
 * producción con una clienta esperando. Es el mismo criterio que `ESTADOS_CITA`.
 */
export const CODIGOS_DE_SERVICIO = [
  // Retiro a secas (60 min)
  'RETIRO',

  // Servicios individuales (60 min)
  'GEL',
  'RUBBER',
  'RUBBER-GEL',
  'MANICURE',
  'RUBBER-GEL-MANICURE',

  // Extensiones y cobertura (120 min)
  'EXT',
  'BANO',
  'EXT-GEL',
  'BANO-GEL',
  'EXT-GEL-MANICURE',
  'BANO-GEL-MANICURE',

  // Con retiro de GEL — se absorbe, siguen siendo 60 min
  'RGEL-GEL',
  'RGEL-RUBBER',
  'RGEL-MANICURE',
  'RGEL-RUBBER-GEL',
  'RGEL-RUBBER-GEL-MANICURE',

  // Con retiro de ACRÍLICO o RUBBER — añade bloque, 120 min
  'RACR-GEL',
  'RACR-RUBBER',
  'RACR-MANICURE',
  'RACR-RUBBER-GEL',
  'RACR-RUBBER-GEL-MANICURE',

  // Con retiro de acrílico + extensiones o baño — 180 min
  'RACR-EXT',
  'RACR-BANO',
  'RACR-EXT-MANICURE',
  'RACR-BANO-MANICURE',

  // Diseños y efectos estándar
  'GEL-DISENO',
  'RUBBER-DISENO',
  'MANICURE-RUBBER-DISENO',
  'EXT-DISENO',
  'BANO-DISENO',

  // La única fila de cotización manual (`DEC-033`), para el mostrador.
  'DISENO-ESPECIAL',
] as const;

export type CodigoDeServicio = (typeof CODIGOS_DE_SERVICIO)[number];

/**
 * Los tres diseños **estándar** que el bot puede agendar por su cuenta (`DEC-033`).
 *
 * Su tiempo **ya está dentro** de las filas `*-DISENO`: `GEL-DISENO` son 60 minutos completos, no
 * "gel más un rato". Por eso no se siembran como `ModificadorDiseno` — tres filas con
 * `minutosAdicionales` que nadie suma contradirían la duración que sí es autoritativa.
 *
 * Esta constante **es** el registro oficial, y es lo que consulta el resolutor para decidir si el
 * bot agenda o escala. Cualquier otro diseño —mano alzada, figuras, 3D, encapsulado, *"uno que vi
 * en Instagram"*— no está aquí, y por tanto va a una persona.
 */
export const DISENOS_ESTANDAR = ['Francés', 'Puntos / Polka dots', 'Ojo de gato'] as const;
