import { AlcanceSucursales, Rol } from '../../../shared/auth/rol';

/**
 * Traduce las filas de `usuarios_sucursales` al claim `sucursales` que consume
 * `tieneAlcanceSucursal()`.
 *
 * ESTA ES LA ÚNICA FUNCIÓN DEL SISTEMA QUE DECIDE ESE VALOR. El patrón de aislamiento es
 * obligatorio y está impuesto por `IDENTIDAD_PRE_ARRANQUE.md` §4: cuando la Dueña responda la
 * Pregunta 11, el único archivo que debería cambiar es este. Si responderla obligara a tocar más
 * de un archivo, el aislamiento habría fallado y eso sería un defecto de diseño a corregir antes
 * de continuar.
 *
 * Dos casos, con estatus muy distinto:
 *
 * 1. Analista y Solo lectura → alcance global. **Regla de negocio APROBADA** (`RN-SEG-03`,
 *    2026-08-03, `DISCOVERY_CHECKLIST.md` 1.26): ven todas las sucursales, sin filtro, aunque no
 *    tengan filas asignadas.
 *
 * 2. Cualquier otro rol sin filas → sin acceso a ninguna sucursal.
 *    // Temporary implementation assumption: empty usuarios_sucursales = no branch access,
 *    // pending owner confirmation. Ver OWNER_DECISION_LOG.md, Pregunta 11.
 *    NO es una regla confirmada. Es la opción (b) de esa pregunta, adoptada como asunción
 *    temporal por dos motivos: es lo que el módulo Sucursales y Personal ya implementa de facto
 *    desde su hardening (`tieneAlcanceSucursal` trata el arreglo vacío como "sin acceso"), y es
 *    la alternativa conservadora — si la Dueña confirma lo contrario, ampliar el acceso es
 *    seguro; haber concedido acceso de más no lo sería.
 *
 * Super Admin recibe `'GLOBAL'` por coherencia con `RN-SEG-01` y con `tieneAlcanceSucursal()`,
 * que ya lo trata como universal antes de mirar el alcance.
 */
export function resolverAlcanceSucursales(rol: Rol, sucursalesAsignadas: string[]): AlcanceSucursales {
  if (rol === Rol.SUPER_ADMIN) return 'GLOBAL';
  if (rol === Rol.ANALISTA || rol === Rol.SOLO_LECTURA) return 'GLOBAL';
  return sucursalesAsignadas;
}
