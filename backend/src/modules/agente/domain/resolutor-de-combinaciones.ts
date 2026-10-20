import { normalizarTexto } from './deteccion-de-escalamiento';

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
 * Por eso devuelve un **nombre de servicio**, no una duración. La duración es del catálogo.
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
export type ResultadoDeCombinacion = { servicio: string } | { escalar: 'cotizacion_compleja' };

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
 * Los tres diseños que el bot **sí** puede agendar, y sus formas habituales en WhatsApp.
 *
 * El registro oficial es `DISENOS_ESTANDAR` en el catálogo; aquí están las variantes con las que
 * la gente los escribe. Separar las dos listas es deliberado: una es la política de negocio y la
 * otra es vocabulario.
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
const MATRIZ: Readonly<Record<string, string>> = {
  // ── Retiro a secas: una hora, no importa el material ──
  retiro_generico: 'Retiro de gel, acrílico o rubber',
  retiro_gel: 'Retiro de gel, acrílico o rubber',
  retiro_acrilico: 'Retiro de gel, acrílico o rubber',

  // ── Servicios individuales: todo cabe en una hora ──
  gel: 'Gel',
  rubber: 'Rubber',
  manicure: 'Manicure',
  'gel+rubber': 'Rubber + gel',
  'gel+manicure+rubber': 'Rubber + gel + manicure',

  // ── Extensiones y cobertura: dos horas ──
  extensiones: 'Extensiones',
  bano_acrilico: 'Baño de acrílico',
  'extensiones+gel': 'Extensiones + gel',
  'bano_acrilico+gel': 'Baño de acrílico + gel',
  'extensiones+gel+manicure': 'Extensiones + gel + manicure',
  'bano_acrilico+gel+manicure': 'Baño de acrílico + gel + manicure',

  // ── Con retiro de GEL: se absorbe, sigue siendo UNA hora ──
  'retiro_gel+rubber': 'Retiro de gel + rubber, gel o manicure',
  'gel+retiro_gel': 'Retiro de gel + rubber, gel o manicure',
  'manicure+retiro_gel': 'Retiro de gel + rubber, gel o manicure',

  // ── Con retiro de ACRÍLICO o RUBBER: añade bloque, DOS horas ──
  'retiro_acrilico+rubber': 'Retiro de acrílico o rubber + rubber, gel o manicure',
  'gel+retiro_acrilico': 'Retiro de acrílico o rubber + rubber, gel o manicure',
  'manicure+retiro_acrilico': 'Retiro de acrílico o rubber + rubber, gel o manicure',

  // ── Retiro de acrílico + extensiones o baño: TRES horas ──
  'extensiones+retiro_acrilico': 'Retiro de acrílico o rubber + extensiones o baño de acrílico',
  'bano_acrilico+retiro_acrilico': 'Retiro de acrílico o rubber + extensiones o baño de acrílico',
  // El manicure se absorbe dentro de las tres horas: no son tres y media.
  'extensiones+manicure+retiro_acrilico': 'Retiro de acrílico o rubber + extensiones o baño de acrílico + manicure',
  'bano_acrilico+manicure+retiro_acrilico': 'Retiro de acrílico o rubber + extensiones o baño de acrílico + manicure',

  // ── Diseños estándar: caben en la hora del servicio base ──
  'diseno_estandar+gel': 'Gel + diseño estándar',
  'diseno_estandar+rubber': 'Rubber + diseño estándar',
  'diseno_estandar+manicure+rubber': 'Manicure + rubber + diseño estándar',
  // Sobre extensiones el diseño NO se absorbe: 120 + 60.
  'diseno_estandar+extensiones': 'Extensiones o baño de acrílico + diseño estándar',
  'bano_acrilico+diseno_estandar': 'Extensiones o baño de acrílico + diseño estándar',
};

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

  const servicio = MATRIZ[[...componentes].sort().join('+')];
  return servicio ? { servicio } : null;
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
