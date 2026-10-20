import type { CodigoDeServicio } from '../../modules/catalogo-y-cotizacion/domain/codigos-de-servicio';

/**
 * Catálogo OFICIAL de Blanc — tabla de servicios, combinaciones y tiempos de la Dueña.
 *
 * Entregada el 2026-10-19 y **desglosada el 2026-10-21** para que cada combinación tenga su propio
 * precio editable.
 *
 * ## LO QUE ESTA TABLA RESUELVE, Y POR QUÉ NO ES UNA LISTA DE PRECIOS CUALQUIERA
 *
 * **Las duraciones no se suman: se absorben.** Un `Rubber + gel + manicure` son **60 minutos**, no
 * 180: los tres trabajos caben en la misma hora porque se hacen sobre la misma mano. Un `Retiro de
 * gel + manicure` también son 60 — el retiro de gel **se absorbe dentro de la hora**. Pero un
 * retiro de acrílico no se absorbe: ese sí añade su propio bloque.
 *
 * Por eso cada combinación es **una fila con su duración exacta** y no una suma de partes. Es lo
 * que `RN-COT-01` ya decía (*"la duración de un compuesto sale de una tabla de combinaciones
 * específicas y nunca de sumar las partes"*) y lo que `FL-COT-03` nunca llegó a construir: con la
 * tabla real de la Dueña, el motor de sumas **no hace falta**.
 *
 * Todas las duraciones caen en bloques de **60, 120 o 180 minutos**, que encajan con el horario de
 * la sucursal (`RN-AGE-10`: L-V de 9:00 a 12:00 y de 15:00 a 18:00). Una cita de 180 minutos cabe
 * exacta en el bloque matutino **empezando a las 9:00 y solo a las 9:00**.
 *
 * ## EL DESGLOSE DE 2026-10-21: DE 21 FILAS A 32
 *
 * La primera versión agrupaba cuatro familias en un renglón cada una —*"Retiro de gel + (rubber,
 * gel o manicure)"*— porque comparten bloque de tiempo. Para el **tiempo** era exacto; para el
 * **precio** significaba un solo importe para tres combinaciones que no cuestan lo mismo, y no
 * había forma de arreglarlo desde `/admin`.
 *
 * Ahora cada combinación es su propia fila con su propio precio. **Las duraciones no se tocaron**:
 * siguen siendo las de la Dueña, y el desglose no inventó ninguna combinación que su tabla no
 * contemplara — solo separó las que ya estaban dentro de un paréntesis.
 *
 * ## ⚠️ LOS TIEMPOS SON OFICIALES; LOS PRECIOS SIGUEN SIENDO PROVISIONALES
 *
 * La Dueña entregó la matriz de **tiempos**. Los importes de abajo son estimaciones coherentes con
 * cada bloque y con el trabajo que añade cada pieza, y **hay que confirmarlos con ella antes de
 * cobrar nada**. Se corrigen en **Configuración → Catálogo y tiempos** del panel, sin tocar código
 * ni desplegar, y **el seed no los reimpone** al volver a correrlo.
 *
 * ## EL `codigo` NO SE EDITA, Y ES LO QUE HACE SEGURO TODO LO DEMÁS
 *
 * El nombre y el precio de cualquier fila se pueden cambiar desde `/admin` sin romper nada, porque
 * el bot resuelve por `codigo` y no por nombre. Ese fue un riesgo real: renombrar *"Rubber + gel"*
 * dejaba al bot sin poder agendarlo. Ver `codigos-de-servicio.ts`.
 */

export interface ServicioASembrar {
  /**
   * Clave estable. **Inmutable**: ni el alta ni la edición de `/admin` la aceptan, y el bot resuelve
   * por ella. Ver `codigos-de-servicio.ts`.
   */
  codigo: CodigoDeServicio;
  nombre: string;
  categoria: string;
  /** La que `AgendarCitaUseCase` usa para derivar el fin de la cita. Bloques de 60/120/180. */
  duracionBaseMinutos: number;
  precioBaseCentavos: number;
  /** `true` → el precio lo fija una persona y la cita nace sin total (`DEC-033`). */
  requiereCotizacionManual?: boolean;
}

/**
 * Las **cinco categorías reales** de la Dueña. Son texto libre en el modelo (`Servicio.categoria`
 * no tiene tabla propia, ver `GET /servicios/categorias`); esta lista es la que el seed usa y la
 * que el `datalist` del Backoffice ofrece.
 */
export const CATEGORIAS_DE_BLANC = [
  'Retiro',
  'Servicios individuales',
  'Extensiones y cobertura',
  'Combinaciones con retiro',
  'Diseños y efectos',
] as const;

export const SERVICIOS_DE_BLANC: readonly ServicioASembrar[] = [
  // ─── 1. Retiro (60 min) ────────────────────────────────────────────────────
  /**
   * Retiro **solo**, con drill o con acetona. Una hora completa independientemente del material: la
   * tabla no distingue el método, y la diferencia aparece al combinarlo (familias `RGEL-*` y
   * `RACR-*`). Esto cerró la ambigüedad del *"drill +15 min"* de `PA-02`: el método no cambia nada.
   */
  { codigo: 'RETIRO', nombre: 'Retiro de gel, acrílico o rubber', categoria: 'Retiro', duracionBaseMinutos: 60, precioBaseCentavos: 20000 },

  // ─── 2. Servicios individuales (60 min) ───────────────────────────────────
  { codigo: 'GEL', nombre: 'Gel', categoria: 'Servicios individuales', duracionBaseMinutos: 60, precioBaseCentavos: 35000 },
  { codigo: 'RUBBER', nombre: 'Rubber', categoria: 'Servicios individuales', duracionBaseMinutos: 60, precioBaseCentavos: 38000 },
  { codigo: 'RUBBER-GEL', nombre: 'Rubber + gel', categoria: 'Servicios individuales', duracionBaseMinutos: 60, precioBaseCentavos: 45000 },
  { codigo: 'MANICURE', nombre: 'Manicure', categoria: 'Servicios individuales', duracionBaseMinutos: 60, precioBaseCentavos: 25000 },
  /** Los tres en la MISMA hora. El caso que demuestra que las duraciones se absorben. */
  {
    codigo: 'RUBBER-GEL-MANICURE',
    nombre: 'Rubber + gel + manicure',
    categoria: 'Servicios individuales',
    duracionBaseMinutos: 60,
    precioBaseCentavos: 55000,
  },

  // ─── 3. Extensiones y cobertura (120 min) ─────────────────────────────────
  { codigo: 'EXT', nombre: 'Extensiones', categoria: 'Extensiones y cobertura', duracionBaseMinutos: 120, precioBaseCentavos: 75000 },
  { codigo: 'BANO', nombre: 'Baño de acrílico', categoria: 'Extensiones y cobertura', duracionBaseMinutos: 120, precioBaseCentavos: 70000 },
  {
    codigo: 'EXT-GEL',
    nombre: 'Extensiones + gel',
    categoria: 'Extensiones y cobertura',
    duracionBaseMinutos: 120,
    precioBaseCentavos: 85000,
  },
  {
    codigo: 'BANO-GEL',
    nombre: 'Baño de acrílico + gel',
    categoria: 'Extensiones y cobertura',
    duracionBaseMinutos: 120,
    precioBaseCentavos: 80000,
  },
  {
    codigo: 'EXT-GEL-MANICURE',
    nombre: 'Extensiones + gel + manicure',
    categoria: 'Extensiones y cobertura',
    duracionBaseMinutos: 120,
    precioBaseCentavos: 95000,
  },
  {
    codigo: 'BANO-GEL-MANICURE',
    nombre: 'Baño de acrílico + gel + manicure',
    categoria: 'Extensiones y cobertura',
    duracionBaseMinutos: 120,
    precioBaseCentavos: 90000,
  },

  // ─── 4a. Con retiro de GEL: se absorbe, sigue siendo UNA hora ─────────────
  /**
   * **El retiro de gel se absorbe dentro de la misma hora.** Es la nota crítica de la tabla: no
   * añade bloque. Confundir esta familia con la siguiente vendería dos horas donde cabe una.
   *
   * Las cinco filas reflejan exactamente las cinco combinaciones de la familia de 60 minutos
   * (gel, rubber, manicure, rubber+gel, rubber+gel+manicure), ni una más: el desglose separó lo
   * que estaba agrupado, no inventó combinaciones nuevas.
   */
  {
    codigo: 'RGEL-GEL',
    nombre: 'Retiro de gel + gel',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 60,
    precioBaseCentavos: 45000,
  },
  {
    codigo: 'RGEL-RUBBER',
    nombre: 'Retiro de gel + rubber',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 60,
    precioBaseCentavos: 48000,
  },
  {
    codigo: 'RGEL-MANICURE',
    nombre: 'Retiro de gel + manicure',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 60,
    precioBaseCentavos: 35000,
  },
  {
    codigo: 'RGEL-RUBBER-GEL',
    nombre: 'Retiro de gel + rubber + gel',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 60,
    precioBaseCentavos: 55000,
  },
  {
    codigo: 'RGEL-RUBBER-GEL-MANICURE',
    nombre: 'Retiro de gel + rubber + gel + manicure',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 60,
    precioBaseCentavos: 65000,
  },

  // ─── 4b. Con retiro de ACRÍLICO o RUBBER: añade bloque, DOS horas ─────────
  {
    codigo: 'RACR-GEL',
    nombre: 'Retiro de acrílico o rubber + gel',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 120,
    precioBaseCentavos: 55000,
  },
  {
    codigo: 'RACR-RUBBER',
    nombre: 'Retiro de acrílico o rubber + rubber',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 120,
    precioBaseCentavos: 58000,
  },
  {
    codigo: 'RACR-MANICURE',
    nombre: 'Retiro de acrílico o rubber + manicure',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 120,
    precioBaseCentavos: 45000,
  },
  {
    codigo: 'RACR-RUBBER-GEL',
    nombre: 'Retiro de acrílico o rubber + rubber + gel',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 120,
    precioBaseCentavos: 65000,
  },
  {
    codigo: 'RACR-RUBBER-GEL-MANICURE',
    nombre: 'Retiro de acrílico o rubber + rubber + gel + manicure',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 120,
    precioBaseCentavos: 75000,
  },

  // ─── 4c. Con retiro de acrílico + extensiones o baño: TRES horas ──────────
  /** El manicure se absorbe: sigue siendo el bloque de tres horas, no tres horas y media. */
  {
    codigo: 'RACR-EXT',
    nombre: 'Retiro de acrílico o rubber + extensiones',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 180,
    precioBaseCentavos: 95000,
  },
  {
    codigo: 'RACR-BANO',
    nombre: 'Retiro de acrílico o rubber + baño de acrílico',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 180,
    precioBaseCentavos: 90000,
  },
  {
    codigo: 'RACR-EXT-MANICURE',
    nombre: 'Retiro de acrílico o rubber + extensiones + manicure',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 180,
    precioBaseCentavos: 110000,
  },
  {
    codigo: 'RACR-BANO-MANICURE',
    nombre: 'Retiro de acrílico o rubber + baño de acrílico + manicure',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 180,
    precioBaseCentavos: 105000,
  },

  // ─── 5. Diseños y efectos estándar ────────────────────────────────────────
  // Los tres diseños de `DISENOS_ESTANDAR` caben en la hora del servicio base.
  {
    codigo: 'GEL-DISENO',
    nombre: 'Gel + diseño estándar',
    categoria: 'Diseños y efectos',
    duracionBaseMinutos: 60,
    precioBaseCentavos: 45000,
  },
  {
    codigo: 'RUBBER-DISENO',
    nombre: 'Rubber + diseño estándar',
    categoria: 'Diseños y efectos',
    duracionBaseMinutos: 60,
    precioBaseCentavos: 48000,
  },
  {
    codigo: 'MANICURE-RUBBER-DISENO',
    nombre: 'Manicure + rubber + diseño estándar',
    categoria: 'Diseños y efectos',
    duracionBaseMinutos: 60,
    precioBaseCentavos: 60000,
  },
  /**
   * La variante **+60 min** del bloque de diseño, desglosada en dos filas.
   *
   * Sobre extensiones o baño de acrílico el diseño **no** se absorbe: esos servicios ya ocupan sus
   * dos horas completas, así que el diseño añade su propia hora. 120 + 60 = 180. Y extensiones y
   * baño no cuestan lo mismo, de ahí las dos filas.
   */
  {
    codigo: 'EXT-DISENO',
    nombre: 'Extensiones + diseño estándar',
    categoria: 'Diseños y efectos',
    duracionBaseMinutos: 180,
    precioBaseCentavos: 110000,
  },
  {
    codigo: 'BANO-DISENO',
    nombre: 'Baño de acrílico + diseño estándar',
    categoria: 'Diseños y efectos',
    duracionBaseMinutos: 180,
    precioBaseCentavos: 105000,
  },
  /**
   * La única fila de **cotización manual** (`DEC-033`), y la única que el bot NO puede agendar.
   *
   * ## PARA QUÉ SIGUE EXISTIENDO SI LOS DISEÑOS ESTÁNDAR YA TIENEN SU FILA
   *
   * Para el mostrador. Cuando el bot escala un diseño complejo —mano alzada, 3D, encapsulado, una
   * foto de Instagram—, alguien tiene que poder agendarlo, y necesita una fila cuyo precio fije una
   * persona en vez de inventarlo. Sin ella, la Encargada tendría que elegir una combinación estándar
   * y cobrar un diseño complejo a precio de francés.
   *
   * **Su hora no es un tope.** Si el diseño necesita más tiempo, se agenda sobre la fila cuyo bloque
   * alcance (una de 180, por ejemplo): la duración sale del catálogo y no se puede ajustar cita por
   * cita. Es la limitación conocida de `FL-COT-03`, y aquí se nombra en vez de disimularse.
   */
  {
    codigo: 'DISENO-ESPECIAL',
    nombre: 'Diseño especial',
    categoria: 'Diseños y efectos',
    duracionBaseMinutos: 60,
    precioBaseCentavos: 50000,
    requiereCotizacionManual: true,
  },
];

/**
 * Los nombres que tenían las **cuatro filas agrupadas** antes del desglose del 2026-10-21.
 *
 * La migración `0019` las desactiva: quedaron sustituidas por renglones individuales, y dejarlas
 * activas significaría que el mostrador puede vender *"Retiro de gel + rubber, gel o manicure"* con
 * el precio único viejo mientras el bot vende las filas nuevas — dos fuentes de verdad para lo
 * mismo. Se **desactivan**, no se borran: una cita que ya las usó conserva su `cotizacionSnapshot`
 * y sigue siendo legible.
 */
export const FILAS_AGRUPADAS_SUSTITUIDAS = [
  'Retiro de gel + rubber, gel o manicure',
  'Retiro de acrílico o rubber + rubber, gel o manicure',
  'Retiro de acrílico o rubber + extensiones o baño de acrílico',
  'Retiro de acrílico o rubber + extensiones o baño de acrílico + manicure',
  'Extensiones o baño de acrílico + diseño estándar',
] as const;
