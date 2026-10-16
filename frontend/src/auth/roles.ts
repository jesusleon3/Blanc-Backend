import type { Rol } from '../api/contrato';

/**
 * Agrupaciones de roles para decidir **qué se dibuja**.
 *
 * ## ESTO NO ES AUTORIZACIÓN
 *
 * Regla 1 de `ADR-027`: **el rol sirve para dibujar, nunca para autorizar.** Cada endpoint
 * revalida su propio `@Roles` con los permisos resueltos en el servidor, así que alguien que
 * navegara a mano a una ruta que no le toca recibiría `403` del backend igual. Ocultar un enlace
 * es una cortesía con quien opera, no una medida de seguridad.
 *
 * **Corolario:** una restricción no está implementada porque el botón no se vea.
 *
 * Los listados se copian del `@Roles` del controlador correspondiente, para que la comparación con
 * el backend sea directa al leer.
 */

/** Administración: lo que `DEC-042` reserva a la Dueña (estado de riesgo de una clienta). */
export const ROLES_DE_ADMINISTRACION: readonly Rol[] = ['SUPER_ADMIN', 'ADMINISTRADOR'];

/** Operación del panel: Bandeja, Anticipos, CRM, Agenda. Es el `@Roles` de esos controladores. */
export const ROLES_DE_OPERACION: readonly Rol[] = ['SUPER_ADMIN', 'ADMINISTRADOR', 'GERENTE'];

/**
 * La Manicurista. **Un rol aparte, no un subconjunto de los anteriores.**
 *
 * Su vista de iPad está construida para no transportar PII ni señales de riesgo (`DEC-040`), y
 * recibe `403` en toda la Bandeja, en Anticipos y en CRM. En Anticipos el motivo es más fino que
 * "no es asunto suyo": **solo las clientas de lista roja pagan anticipo** (`RN-ANT-01`), así que
 * ver un anticipo revelaría el estado de riesgo por inferencia.
 */
export const ROL_DE_MANICURISTA: Rol = 'MANICURISTA';

export const esDeAdministracion = (rol: Rol | undefined): boolean => rol !== undefined && ROLES_DE_ADMINISTRACION.includes(rol);
export const esDeOperacion = (rol: Rol | undefined): boolean => rol !== undefined && ROLES_DE_OPERACION.includes(rol);
export const esManicurista = (rol: Rol | undefined): boolean => rol === ROL_DE_MANICURISTA;

/** Dónde aterriza cada rol al entrar. La Manicurista va a su agenda y a nada más. */
export function rutaInicialDe(rol: Rol): string {
  if (esManicurista(rol)) return '/mi-agenda';
  if (esDeOperacion(rol)) return '/bandeja';
  // `RECEPCIONISTA`, `ANALISTA` y `SOLO_LECTURA` no tienen pantalla en esta entrega. Se les manda a
  // una página que lo dice, en vez de a un `/bandeja` que les daría 403 en cada petición.
  return '/sin-acceso';
}
