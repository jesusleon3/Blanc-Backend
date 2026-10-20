import { normalizarTexto } from './deteccion-de-escalamiento';
import type { CodigoDeServicio } from '../../catalogo-y-cotizacion/domain/codigos-de-servicio';

/**
 * Traduce lo que la clienta escribió al **renglón exacto** de la matriz oficial de la Dueña.
 *
 * ## POR QUÉ ESTO ES UNA TABLA Y NO UNA SUMA
 *
 * La tabla de la Dueña tiene una propiedad que no se puede calcular: **los tiempos se absorben.**
 * Un `rubber + gel + manicure` son 60 minutos, no 180. Un retiro de **gel** cabe dentro de la misma
 * hora; un retiro de **acrílico** añade su propio bloque. No hay fórmula que produzca eso: hay una
 * matriz, y hay que consultarla.
 *
 * `RN-COT-01` ya lo decía —*"la duración de un compuesto sale de una tabla de combinaciones
 * específicas y **nunca** de sumar las partes"*— y es la razón de que `FL-COT-03`, el motor de
 * sumas, se quedara sin construir: con la matriz real, **no hace falta**.
 *
 * ## DÓNDE ESTÁ LA FRONTERA CON EL MODELO (`RN-CONV-01`, `ADR-026`)
 *
 * Esto corre **en el backend, sobre el texto literal de la clienta**, y es determinista. El modelo
 * no elige el servicio ni la duración: no tiene dónde escribirlos (`Intencion` no tiene esos
 * campos). Lo único que aporta el LLM es *"esta clienta quiere agendar"*; **qué** se agenda lo
 * decide esta función contra la matriz, y **cuánto dura** lo decide la fila del catálogo en
 * PostgreSQL, que la Dueña edita desde el Backoffice.
 *
 * Por eso devuelve un **código de servicio**, no un nombre ni una duración:
 *
 * - **El nombre no**, y eso cambió el 2026-10-21. La Dueña puede renombrar cualquier fila desde
 *   `/admin`, y resolver por nombre significaba que renombrar *"Rubber + gel"* dejaba al bot sin
 *   poder agendarlo: escalaba en vez de agendar, y nadie entendía por qué porque la pantalla seguía
 *   mostrando el servicio. El `codigo` es inmutable — ni el alta ni la edición lo aceptan.
 * - **La duración tampoco**: sale de la fila del catálogo en PostgreSQL, que la Dueña edita sin
 *   desplegar nada. Esta función decide **qué fila**, no cuánto dura.
 *
 * ## LO QUE DEVUELVE, Y POR QUÉ SON TRES COSAS DISTINTAS
 *
 * - `{ servicio }` — la matriz tiene una fila exacta para lo que pidió.
 * - `{ escalar: 'cotizacion_compleja' }` — pidió **diseño**, y no es uno de los tres estándar. El
 *   precio lo fija una persona (`DEC-033`), así que la cita también.
 * - `null` — no se reconoció ninguna combinación de la matriz. **No es un error:** el turno sigue
 *   su camino normal y acaba escalando. Devolver una fila aproximada sería inventar un bloque de
 *   tiempo, y equivocarse por abajo mete una cita encima de otra.
 */
export type ResultadoDeCombinacion = { codigo: CodigoDeServicio } | { escalar: 'cotizacion_compleja' };

/**
 * Las piezas que la matriz combina. **No son servicios**: son los componentes cuya presencia
 * determina qué fila aplica.
 *
 * `retiro_gel` y `retiro_acrilico` están separados porque **se comportan distinto**, y es la
 * distinción más cara de la tabla: uno se absorbe en la hora y el otro añade un bloque entero.
 * `retiro_generico` es *"quiero que me retiren"* sin decir de qué, que es su propio servicio.
 */
type Componente =
  | 'retiro_gel'
  | 'retiro_acrilico'
  | 'retiro_generico'
  | 'gel'
  | 'rubber'
  | 'manicure'
  | 'extensiones'
  | 'bano_acrilico'
  | 'diseno_estandar';

/**
 * Las formas en que la gente escribe los tres diseños estándar en WhatsApp.
 *
 * El registro oficial es `DISENOS_ESTANDAR` (en `codigos-de-servicio.ts`); aquí están sus variantes
 * de escritura. Separar las dos listas es deliberado: una es la política de negocio —qué diseños
 * autorizó la Dueña— y la otra es vocabulario, y no tienen por qué cambiar juntas.
 *
 * **No se importa la constante oficial aquí a propósito**: esta lista no es una traducción
 * mecánica de ella (`'Puntos / Polka dots'` son tres formas de escribirlo). El vínculo lo
 * garantiza una prueba que recorre `DISENOS_ESTANDAR` y falla si el resolutor no sabe leer alguno
 * — que es la comprobación que de verdad importa, y la que un `import` no daría.
 */
const DISENOS_ESTANDAR_EN_TEXTO = [
  'frances',
  'francesa',
  'polka',
  'puntos',
  'puntitos',
  'ojo de gato',
  'ojos de gato',
] as const;

/**
 * Diseños que **escalan siempre**, aunque la clienta nombre además uno estándar.
 *
 * Si pide *"francés y además unas figuras en 3D"*, lo que manda es el 3D: el precio deja de ser el
 * de la combinación estándar y el tiempo probablemente tampoco alcance.
 */
const DISENOS_COMPLEJOS = [
  'mano alzada',
  'manoalzada',
  'figuras',
  'figura',
  '3d',
  'encapsulado',
  'encapsuladas',
  'instagram',
  'pinterest',
  'tiktok',
  'personalizado',
  'personalizada',
  'pedreria',
  'piedras',
  'cristales',
  'calcomania',
  'stickers',
  'degradado',
  'ombre',
  'marmol',
  'animal print',
  'caricatura',
  'letras',
] as const;

/**
 * Palabras que dicen *"quiero diseño"* **sin decir cuál**.
 *
 * Escalan, y no por prudencia excesiva: *"quiero gel con diseño"* puede ser un francés de una hora
 * o un encapsulado de tres. Elegir uno sería adivinar el precio y el bloque de tiempo a la vez.
 */
const DISENO_SIN_ESPECIFICAR = ['diseno', 'disenio', 'decorado', 'decoracion', 'nail art', 'arte', 'efecto', 'efectos'] as const;

/** Verbos de retiro, con los artículos y pronombres que suelen llevar en medio. */
const VERBO_DE_RETIRO = '(?:retiro|retirar|retirarme|retirarmelo|quitar|quitarme|quitarmelo|remover|removerme|sacar|sacarme)';
const RELLENO = '(?:\\s+(?:de|del|el|la|los|las|mi|mis|me|un|una))*\\s+';

/**
 * La matriz oficial. **La clave es el conjunto de componentes**, ordenado alfabéticamente.
 *
 * Varias claves apuntan a la misma fila porque la tabla de la Dueña las agrupa por bloque de
 * tiempo: *retiro de gel + rubber*, *+ gel* y *+ manicure* son las tres una hora, y por eso son un
 * solo renglón del catálogo.
 *
 * **Lo que no está aquí no se resuelve.** *"Extensiones con rubber"* son dos servicios que existen
 * por separado y que la tabla **no junta**: no hay fila, así que el turno escala y una persona
 * decide. Inventar 120 (el de extensiones) o 180 (sumando) serían dos invenciones distintas.
 */
const MATRIZ: Readonly<Record<string, CodigoDeServicio>> = {
  // ── Retiro a secas: una hora, no importa el material ──
  retiro_generico: 'RETIRO',
  retiro_gel: 'RETIRO',
  retiro_acrilico: 'RETIRO',

  // ── Servicios individuales: todo cabe en una hora ──
  gel: 'GEL',
  rubber: 'RUBBER',
  manicure: 'MANICURE',
  'gel+rubber': 'RUBBER-GEL',
  'gel+manicure+rubber': 'RUBBER-GEL-MANICURE',

  // ── Extensiones y cobertura: dos horas ──
  extensiones: 'EXT',
  bano_acrilico: 'BANO',
  'extensiones+gel': 'EXT-GEL',
  'bano_acrilico+gel': 'BANO-GEL',
  'extensiones+gel+manicure': 'EXT-GEL-MANICURE',
  'bano_acrilico+gel+manicure': 'BANO-GEL-MANICURE',

  /**
   * ── Con retiro de GEL: se absorbe, sigue siendo UNA hora ──
   *
   * Cinco entradas que reflejan **exactamente** las cinco combinaciones de la familia de 60
   * minutos. Hasta el desglose del 2026-10-21 eran tres entradas apuntando a un solo renglón
   * agrupado: el tiempo era exacto, pero las tres compartían precio y no había forma de separarlas
   * desde `/admin`.
   */
  'gel+retiro_gel': 'RGEL-GEL',
  'retiro_gel+rubber': 'RGEL-RUBBER',
  'manicure+retiro_gel': 'RGEL-MANICURE',
  'gel+retiro_gel+rubber': 'RGEL-RUBBER-GEL',
  'gel+manicure+retiro_gel+rubber': 'RGEL-RUBBER-GEL-MANICURE',

  // ── Con retiro de ACRÍLICO o RUBBER: añade bloque, DOS horas ──
  'gel+retiro_acrilico': 'RACR-GEL',
  'retiro_acrilico+rubber': 'RACR-RUBBER',
  'manicure+retiro_acrilico': 'RACR-MANICURE',
  'gel+retiro_acrilico+rubber': 'RACR-RUBBER-GEL',
  'gel+manicure+retiro_acrilico+rubber': 'RACR-RUBBER-GEL-MANICURE',

  // ── Retiro de acrílico + extensiones o baño: TRES horas, y ya no comparten precio ──
  'extensiones+retiro_acrilico': 'RACR-EXT',
  'bano_acrilico+retiro_acrilico': 'RACR-BANO',
  // El manicure se absorbe dentro de las tres horas: no son tres y media.
  'extensiones+manicure+retiro_acrilico': 'RACR-EXT-MANICURE',
  'bano_acrilico+manicure+retiro_acrilico': 'RACR-BANO-MANICURE',

  // ── Diseños estándar: caben en la hora del servicio base ──
  'diseno_estandar+gel': 'GEL-DISENO',
  'diseno_estandar+rubber': 'RUBBER-DISENO',
  'diseno_estandar+manicure+rubber': 'MANICURE-RUBBER-DISENO',
  // Sobre extensiones o baño el diseño NO se absorbe (120 + 60), y los dos no cuestan lo mismo.
  'diseno_estandar+extensiones': 'EXT-DISENO',
  'bano_acrilico+diseno_estandar': 'BANO-DISENO',
};

/**
 * Los códigos que la matriz puede devolver. Lo consume la prueba que comprueba que **todos están
 * en el catálogo oficial**: una entrada que apuntara a un código inexistente dejaría al bot
 * escalando una combinación que la Dueña sí ofrece, y nada fallaría al compilar.
 */
export const CODIGOS_QUE_LA_MATRIZ_RESUELVE: readonly CodigoDeServicio[] = [...new Set(Object.values(MATRIZ))];

export function resolverCombinacion(texto: string): ResultadoDeCombinacion | null {
  const normalizado = normalizarTexto(texto);

  /**
   * El diseño se decide **antes** que todo lo demás, y escala con prioridad.
   *
   * *"Retiro de acrílico con extensiones y un diseño en 3D"* es una combinación que la matriz
   * sabría mapear a tres horas, y aun así escala: agendarla sería cobrar un diseño complejo a
   * precio de combinación estándar.
   */
  if (contieneAlguna(normalizado, DISENOS_COMPLEJOS)) return { escalar: 'cotizacion_compleja' };

  const tieneDisenoEstandar = contieneAlguna(normalizado, DISENOS_ESTANDAR_EN_TEXTO);
  if (!tieneDisenoEstandar && contieneAlguna(normalizado, DISENO_SIN_ESPECIFICAR)) {
    return { escalar: 'cotizacion_compleja' };
  }

  const componentes = detectarComponentes(normalizado);
  if (tieneDisenoEstandar) componentes.add('diseno_estandar');
  if (componentes.size === 0) return null;

  const codigo = MATRIZ[[...componentes].sort().join('+')];
  return codigo ? { codigo } : null;
}

/**
 * Extrae los componentes **consumiendo el texto** a medida que los reconoce.
 *
 * El consumo no es un detalle de implementación, es lo que hace que funcione: *"retiro de gel y
 * manicure"* contiene la palabra `gel`, y sin borrar primero la frase del retiro se detectarían
 * `retiro_gel` **y** `gel` **y** `manicure` — tres componentes que no corresponden a ninguna fila,
 * cuando la clienta pidió una combinación que sí existe. Lo mismo con *"baño de acrílico"*, que
 * contiene `acrilico`.
 *
 * De ahí el orden: primero las frases largas y específicas, después las palabras sueltas.
 */
function detectarComponentes(textoNormalizado: string): Set<Componente> {
  const componentes = new Set<Componente>();
  let resto = textoNormalizado;

  /** Marca el componente y borra lo que lo nombró, para que no se vuelva a contar. */
  const consumir = (patron: RegExp, componente: Componente): void => {
    if (patron.test(resto)) {
      componentes.add(componente);
      resto = resto.replace(patron, ' ');
    }
  };

  // 1. Retiros CON material. Primero, porque arrastran la palabra del material.
  consumir(new RegExp(`${VERBO_DE_RETIRO}${RELLENO}(?:acrilico|rubber)\\w*`, 'g'), 'retiro_acrilico');
  consumir(new RegExp(`${VERBO_DE_RETIRO}${RELLENO}gel\\w*`, 'g'), 'retiro_gel');

  // 2. Retiro sin material: solo si no se reconoció ninguno con material.
  if (!componentes.has('retiro_acrilico') && !componentes.has('retiro_gel')) {
    consumir(new RegExp(`(^|[^a-z])${VERBO_DE_RETIRO}(?![a-z])`, 'g'), 'retiro_generico');
  }

  // 3. `baño de acrílico` antes que nada: contiene `acrilico`, que no es un componente por sí solo.
  consumir(/(^|[^a-z])ban?o\s+(?:de\s+)?acrilico\w*/g, 'bano_acrilico');

  // 4. Palabras sueltas. Se exige que la palabra EMPIECE por el término (`gel`, `gelish`,
  //    `gelito` sí; `angel` no), porque un `includes` crudo captura sílabas dentro de otras
  //    palabras y eso agenda el servicio equivocado sin que nada falle.
  consumir(/(^|[^a-z])extension\w*/g, 'extensiones');
  consumir(/(^|[^a-z])rubber\w*/g, 'rubber');
  consumir(/(^|[^a-z])gel\w*/g, 'gel');
  consumir(/(^|[^a-z])manicur\w*/g, 'manicure');

  return componentes;
}

const contieneAlguna = (textoNormalizado: string, terminos: readonly string[]): boolean =>
  terminos.some((termino) => new RegExp(`(^|[^a-z])${termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(textoNormalizado));
