/**
 * Catálogo inicial de servicios.
 *
 * ## ⚠️ ESTOS NÚMEROS SON PROVISIONALES Y NO SON LOS DE LA DUEÑA
 *
 * Hay que decirlo antes que nada, porque es la diferencia entre un seed útil y un seed peligroso:
 *
 * - **Los nombres y las categorías** salen del alcance documentado del negocio (Manos, Pies,
 *   Decorado; Gelish, Acrílico, Polygel, Pedicure, Manicure, Retiro, Nail Art).
 * - **Las duraciones y los precios NO están en el repositorio.** La Dueña entregó *"una tabla
 *   extensa con docenas de combinaciones"* en la reunión del 2026-08-03, y esa tabla **no se
 *   incorporó a `docs/`**. Además `PA-02` sigue **parcialmente abierta**: varias celdas quedaron
 *   sin valor numérico (*"Diseño Especial"*, *"SP"*, *"CF"*, *"CC"*) y la regla *"retiro de gel con
 *   drill: +15 min"* no está reconciliada con los valores absolutos previos.
 * - Los valores de aquí son los del **mockup comercial**, cuyo propio README los declara
 *   *"100% ficticios"*. Están en un rango plausible para que el sistema arranque operable, y
 *   **nada más**.
 *
 * El `DISCOVERY_CHECKLIST` lo advierte literalmente sobre este punto: *"Riesgo de asumir: Alto si
 * no se marca visiblemente como estimado — cotizaciones incorrectas con dinero real de por
 * medio."* Por eso:
 *
 * 1. **El seed no los reimpone.** Si alguien ya corrigió un precio desde el Backoffice, volver a
 *    correrlo **no lo pisa** — igual que con el horario de las sucursales.
 * 2. **Se corrigen desde el Backoffice web**, sin tocar SQL ni desplegar.
 * 3. Esta tabla es una constante editable, así que cambiarla aquí también es trivial.
 *
 * > **Antes de salir a producción, estos precios y duraciones tienen que confirmarse con la
 * > Dueña.** El motor de disponibilidad usa la duración para decidir si una cita cabe, y el
 * > snapshot usa el precio para congelar lo que se va a cobrar: equivocarlos no da un error, da
 * > citas que no caben y cobros incorrectos.
 */

export interface ServicioASembrar {
  nombre: string;
  categoria: string;
  /** La que `AgendarCitaUseCase` usa para derivar el fin de la cita. */
  duracionBaseMinutos: number;
  precioBaseCentavos: number;
  /** `true` → el precio lo fija una persona y la cita nace sin total (`DEC-033`). */
  requiereCotizacionManual?: boolean;
}

/** Categorías. Son texto libre en el modelo; esta lista es la que el seed usa. */
export const CATEGORIAS_DE_BLANC = ['Manos', 'Pies', 'Decorado'] as const;

export const SERVICIOS_DE_BLANC: readonly ServicioASembrar[] = [
  // --- Manos ---
  { nombre: 'Manicure', categoria: 'Manos', duracionBaseMinutos: 30, precioBaseCentavos: 20000 },
  { nombre: 'Gelish', categoria: 'Manos', duracionBaseMinutos: 45, precioBaseCentavos: 35000 },
  { nombre: 'Acrílico', categoria: 'Manos', duracionBaseMinutos: 90, precioBaseCentavos: 65000 },
  { nombre: 'Polygel', categoria: 'Manos', duracionBaseMinutos: 90, precioBaseCentavos: 70000 },
  { nombre: 'Reparación', categoria: 'Manos', duracionBaseMinutos: 15, precioBaseCentavos: 10000 },
  /**
   * El retiro es su propio servicio, no un modificador.
   *
   * `RN-COT-04` y `PA-02` tratan *"Retiro + aplicación"* como **combinaciones con su propia
   * duración**, no como una suma. Mientras el motor de combinaciones (`FL-COT-03`) siga pospuesto,
   * un retiro se agenda como servicio aparte y quien atiende elige el hueco que corresponda.
   */
  { nombre: 'Retiro', categoria: 'Manos', duracionBaseMinutos: 20, precioBaseCentavos: 15000 },

  // --- Pies ---
  { nombre: 'Pedicure', categoria: 'Pies', duracionBaseMinutos: 50, precioBaseCentavos: 40000 },
  { nombre: 'Pedicure con gelish', categoria: 'Pies', duracionBaseMinutos: 70, precioBaseCentavos: 55000 },

  // --- Decorado ---
  { nombre: 'Diseño', categoria: 'Decorado', duracionBaseMinutos: 15, precioBaseCentavos: 12000 },
  { nombre: 'Nail Art', categoria: 'Decorado', duracionBaseMinutos: 30, precioBaseCentavos: 28000 },
  /**
   * Cotización manual (`DEC-033`): su precio **lo fija una persona** y por eso la cita nace con
   * `totalCentavos: null`. Es también el servicio que hace que el bot escale en vez de agendar.
   *
   * Corresponde a las celdas que `PA-02` dejó con valor cualitativo —*"dentro de la hora
   * dependiendo del diseño"*— y es la forma honesta de representarlas: no un número inventado.
   */
  { nombre: 'Diseño especial', categoria: 'Decorado', duracionBaseMinutos: 60, precioBaseCentavos: 50000, requiereCotizacionManual: true },
];
