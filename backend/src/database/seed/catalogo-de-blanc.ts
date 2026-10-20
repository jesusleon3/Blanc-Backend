/**
 * Catálogo OFICIAL de Blanc — tabla de servicios, combinaciones y tiempos de la Dueña.
 *
 * Entregada el 2026-10-19 y sembrada aquí tal cual. Sustituye a los 12 servicios provisionales que
 * venían del mockup comercial.
 *
 * ## LO QUE ESTA TABLA RESUELVE, Y POR QUÉ NO ES UNA LISTA DE PRECIOS CUALQUIERA
 *
 * **Las duraciones no se suman: se absorben.** Es la propiedad central y la que estaba mal
 * modelada hasta ahora. Un `Rubber + gel + manicure` son **60 minutos**, no 180: los tres trabajos
 * caben en la misma hora porque se hacen sobre la misma mano. Un `Retiro de gel + manicure`
 * también son 60 — el retiro de gel **se absorbe dentro de la hora**. Pero un retiro de acrílico
 * no se absorbe: ese sí añade su propio bloque.
 *
 * Por eso cada combinación es **una fila con su duración exacta** y no una suma de partes. Es lo
 * que `RN-COT-01` ya decía (*"la duración de un compuesto sale de una tabla de combinaciones
 * específicas y nunca de sumar las partes"*) y lo que `FL-COT-03` nunca llegó a construir: con la
 * tabla real de la Dueña, el motor de sumas **no hace falta**. Las combinaciones son datos, no un
 * cálculo.
 *
 * Todas las duraciones caen en bloques de **60, 120 o 180 minutos**, que encajan con el horario de
 * la sucursal (`RN-AGE-10`: L-V de 9:00 a 12:00 y de 15:00 a 18:00). Una cita de 180 minutos cabe
 * exacta en el bloque matutino **empezando a las 9:00 y solo a las 9:00**.
 *
 * ## ⚠️ LOS TIEMPOS SON OFICIALES; LOS PRECIOS SIGUEN SIENDO PROVISIONALES
 *
 * La Dueña entregó la matriz de **tiempos**. Los importes de abajo son estimaciones coherentes con
 * cada bloque, puestas para que el sistema arranque operable, y **hay que confirmarlos con ella
 * antes de cobrar nada**. Se corrigen en **Configuración → Catálogo y tiempos** del panel, sin
 * tocar código ni desplegar, y **el seed no los reimpone** al volver a correrlo.
 *
 * ## LA CONSECUENCIA DE LAS FILAS "FAMILIA" (13 a 16), DICHA ANTES DE QUE SORPRENDA
 *
 * Cuatro filas cubren varias combinaciones a la vez porque **comparten bloque de tiempo**: la 13 es
 * *retiro de gel + (rubber, gel o manicure)*, y las tres caben en una hora. Para el tiempo es
 * exacto; para el **precio** significa un solo importe para tres combinaciones que probablemente no
 * cuesten lo mismo.
 *
 * Se siembran así porque es la forma de la tabla que la Dueña entregó —tiempos, no precios— y
 * partirlas ahora sería inventar tres importes en vez de uno. Cuando dé los precios, la fila se
 * desdobla: son filas de catálogo, se crean desde el Backoffice, y lo único que habría que tocar en
 * código es el mapa de `resolutor-de-combinaciones.ts`.
 */

export interface ServicioASembrar {
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

/**
 * Los tres diseños **estándar** que el bot puede agendar por su cuenta.
 *
 * ## POR QUÉ ESTÁN AQUÍ Y NO COMO `ModificadorDiseno` EN LA BASE
 *
 * Su tiempo **ya está dentro** de las filas 17 a 20: `Gel + diseño estándar` son 60 minutos
 * completos, no "gel más un rato". Sembrarlos además como modificadores crearía tres filas con
 * `minutosAdicionales` que **nadie suma** —el Backoffice lo advierte en voz alta— y que
 * contradirían la duración de la combinación que sí es autoritativa.
 *
 * Así que el registro oficial de los tres diseños es esta constante, que es lo que
 * `resolutor-de-combinaciones.ts` consulta para decidir si el bot agenda o escala (`DEC-033`).
 * Cualquier otro diseño —mano alzada, figuras, 3D, encapsulado, *"uno que vi en Instagram"*— no
 * está aquí, y por tanto escala a una persona.
 */
export const DISENOS_ESTANDAR = ['Francés', 'Puntos / Polka dots', 'Ojo de gato'] as const;

export const SERVICIOS_DE_BLANC: readonly ServicioASembrar[] = [
  // ─── 1. Retiro (60 min) ────────────────────────────────────────────────────
  /**
   * Retiro **solo**, con drill o con acetona. Una hora completa independientemente del material:
   * la tabla no distingue, y la diferencia aparece al combinarlo (ver filas 13 y 14).
   */
  { nombre: 'Retiro de gel, acrílico o rubber', categoria: 'Retiro', duracionBaseMinutos: 60, precioBaseCentavos: 20000 },

  // ─── 2. Servicios individuales (60 min) ───────────────────────────────────
  { nombre: 'Gel', categoria: 'Servicios individuales', duracionBaseMinutos: 60, precioBaseCentavos: 35000 },
  { nombre: 'Rubber', categoria: 'Servicios individuales', duracionBaseMinutos: 60, precioBaseCentavos: 38000 },
  { nombre: 'Rubber + gel', categoria: 'Servicios individuales', duracionBaseMinutos: 60, precioBaseCentavos: 45000 },
  { nombre: 'Manicure', categoria: 'Servicios individuales', duracionBaseMinutos: 60, precioBaseCentavos: 25000 },
  /** Los tres en la MISMA hora. El caso que demuestra que las duraciones se absorben. */
  { nombre: 'Rubber + gel + manicure', categoria: 'Servicios individuales', duracionBaseMinutos: 60, precioBaseCentavos: 55000 },

  // ─── 3. Extensiones y cobertura (120 min) ─────────────────────────────────
  { nombre: 'Extensiones', categoria: 'Extensiones y cobertura', duracionBaseMinutos: 120, precioBaseCentavos: 75000 },
  { nombre: 'Baño de acrílico', categoria: 'Extensiones y cobertura', duracionBaseMinutos: 120, precioBaseCentavos: 70000 },
  { nombre: 'Extensiones + gel', categoria: 'Extensiones y cobertura', duracionBaseMinutos: 120, precioBaseCentavos: 85000 },
  { nombre: 'Baño de acrílico + gel', categoria: 'Extensiones y cobertura', duracionBaseMinutos: 120, precioBaseCentavos: 80000 },
  { nombre: 'Extensiones + gel + manicure', categoria: 'Extensiones y cobertura', duracionBaseMinutos: 120, precioBaseCentavos: 95000 },
  {
    nombre: 'Baño de acrílico + gel + manicure',
    categoria: 'Extensiones y cobertura',
    duracionBaseMinutos: 120,
    precioBaseCentavos: 90000,
  },

  // ─── 4. Combinaciones con retiro (60 / 120 / 180 min) ─────────────────────
  /**
   * **El retiro de gel se absorbe dentro de la misma hora.** Es la nota crítica de la tabla: no
   * añade bloque. Confundirlo con la fila siguiente vendería dos horas donde cabe una, o una donde
   * hacen falta dos.
   */
  {
    nombre: 'Retiro de gel + rubber, gel o manicure',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 60,
    precioBaseCentavos: 50000,
  },
  /** El retiro de acrílico o rubber **sí** añade su bloque: 60 + 60. */
  {
    nombre: 'Retiro de acrílico o rubber + rubber, gel o manicure',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 120,
    precioBaseCentavos: 70000,
  },
  {
    nombre: 'Retiro de acrílico o rubber + extensiones o baño de acrílico',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 180,
    precioBaseCentavos: 110000,
  },
  /** El manicure se absorbe: sigue siendo el bloque de tres horas, no tres horas y media. */
  {
    nombre: 'Retiro de acrílico o rubber + extensiones o baño de acrílico + manicure',
    categoria: 'Combinaciones con retiro',
    duracionBaseMinutos: 180,
    precioBaseCentavos: 125000,
  },

  // ─── 5. Diseños y efectos estándar ────────────────────────────────────────
  // Los tres diseños de `DISENOS_ESTANDAR` caben en la hora del servicio base.
  { nombre: 'Gel + diseño estándar', categoria: 'Diseños y efectos', duracionBaseMinutos: 60, precioBaseCentavos: 45000 },
  { nombre: 'Rubber + diseño estándar', categoria: 'Diseños y efectos', duracionBaseMinutos: 60, precioBaseCentavos: 48000 },
  {
    nombre: 'Manicure + rubber + diseño estándar',
    categoria: 'Diseños y efectos',
    duracionBaseMinutos: 60,
    precioBaseCentavos: 60000,
  },
  /**
   * La variante **+60 min** del bloque de diseño.
   *
   * Sobre extensiones o baño de acrílico el diseño **no** se absorbe: esos servicios ya ocupan sus
   * dos horas completas, así que el diseño añade su propia hora. 120 + 60 = 180.
   */
  {
    nombre: 'Extensiones o baño de acrílico + diseño estándar',
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
   * **Su hora no es un tope.** Si el diseño necesita más tiempo, se agenda sobre la fila cuyo
   * bloque alcance (la de 180, por ejemplo): la duración sale del catálogo y no se puede ajustar
   * cita por cita. Es la limitación conocida de `FL-COT-03`, y aquí se nombra en vez de disimularse.
   */
  {
    nombre: 'Diseño especial',
    categoria: 'Diseños y efectos',
    duracionBaseMinutos: 60,
    precioBaseCentavos: 50000,
    requiereCotizacionManual: true,
  },
];
