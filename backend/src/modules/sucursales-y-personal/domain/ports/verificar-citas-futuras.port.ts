export const VERIFICAR_CITAS_FUTURAS_PORT = 'VERIFICAR_CITAS_FUTURAS_PORT';

/**
 * Puerto hacia el Bounded Context **Agenda** (`DEC-032`).
 *
 * POR QUÉ EXISTE: la Dueña decidió (2026-09-30) que dar de baja a una manicurista con citas futuras
 * es un **bloqueo duro** — el sistema lanza excepción, no cancela ni reasigna nada. Pero la baja
 * ocurre en *Sucursales y Personal* y las citas viven en *Agenda*, y `ADR-005` prohíbe claves
 * foráneas entre esquemas mientras `ADR-001`/`ADR-002` prohíben que un módulo consulte las tablas
 * de otro. Por lo tanto la verificación **no puede ser un `JOIN`**.
 *
 * DÓNDE VIVE LA INTERFAZ, Y POR QUÉ AQUÍ: la define el **consumidor** (este módulo), no el
 * proveedor. Es el mismo patrón que `PERMISOS_USUARIO_PORT` en `shared/auth` (`DEC-029`), y evita
 * el ciclo de módulos que surgiría si *Sucursales y Personal* importara algo de *Agenda*: Agenda ya
 * es consumidor de este módulo (`01-domain-discovery.md` §4, horarios y manicuristas), así que la
 * dependencia inversa debe viajar por una interfaz que Agenda implemente, nunca al revés.
 *
 * ESTADO: sin implementación real. *Agenda* no existe todavía (Fase 2); hoy lo satisface
 * `SinAgendaVerificarCitasFuturasAdapter`, un sustituto que **siempre responde `false`**. Ver ese
 * archivo antes de confiar en esta verificación.
 */
export interface VerificarCitasFuturasPort {
  /**
   * ¿Esta manicurista tiene citas futuras que impidan darla de baja?
   *
   * "Futura" significa *programada a partir de ahora y en un estado que ocupa el horario*. La lista
   * de estados que ocupan la fija `DEC-034` — liberan `cancelada`, `expirada` y `reprogramada`;
   * todo lo demás ocupa. Cuando Agenda implemente este puerto **debe reutilizar esa misma lista**,
   * no escribir una segunda definición que pueda divergir (pendiente `N-04`).
   */
  tieneCitasFuturas(manicuristaId: string): Promise<boolean>;
}
