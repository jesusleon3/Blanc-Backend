export const PRESUPUESTO_DE_IA_PORT = 'PRESUPUESTO_DE_IA_PORT';

/**
 * El cortacircuitos de gasto de IA — **cierre de `F-07`**.
 *
 * ## QUÉ PROBLEMA RESUELVE
 *
 * `ARCHITECTURE_REVIEW.md` clasificó `F-07` como `High`: *"ningún ADR fija un número concreto de
 * límite de gasto de IA, ni define quién lo revisa, ni qué hace el sistema al alcanzarlo"*. El
 * escenario concreto que lo hace urgente no es el uso normal —tres sucursales no generan un gasto
 * preocupante— sino el **anómalo**: un bucle, una clienta mandando mensajes en ráfaga, o correo
 * basura dirigido al número. Sin tope, el coste crece mientras nadie mira.
 *
 * ## LO QUE PASA AL ALCANZAR EL TOPE, Y POR QUÉ NO ES "ESCALAR TODO"
 *
 * La review advirtió que la respuesta ingenua —*"escalar todo a humano"*— **agravaría `F-05`**: una
 * escalada masiva que el personal no puede absorber. Aquí no pasa eso, y la razón es el diseño del
 * bot (`ADR-026`): al agotarse el presupuesto, el orquestador **no deja de funcionar**, usa el
 * **intérprete determinista**, que atiende saludos, precios y disponibilidad sin coste por mensaje.
 * Solo escala lo que ese intérprete no reconoce.
 *
 * Es decir: el tope **degrada la comprensión, no el servicio**. Y es exactamente el mismo
 * comportamiento que el sistema ya tiene cuando no hay `OPENAI_API_KEY`, así que no introduce un
 * camino nuevo que haya que probar aparte.
 */
export interface PresupuestoDeIaPort {
  /**
   * `true` si **todavía queda presupuesto hoy**, y en ese caso **registra la llamada**.
   *
   * Consultar e incrementar es **un solo acto** a propósito: con dos métodos
   * (`¿puedo?` + `registra`), dos peticiones simultáneas podrían pasar las dos la comprobación
   * antes de que ninguna incremente. Es la misma razón por la que el no-doble-booking vive en una
   * restricción de PostgreSQL y no en una consulta previa.
   */
  intentarConsumir(ahora?: Date): Promise<boolean>;

  /** Cuántas llamadas se han hecho hoy y cuál es el tope. Para el diagnóstico y el reporte. */
  consumoDeHoy(ahora?: Date): Promise<{ llamadas: number; tope: number }>;
}
