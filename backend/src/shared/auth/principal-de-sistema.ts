import { Rol } from './rol';

/**
 * DECISIÓN DE RBAC PARA EL BOT DE WHATSAPP (deuda 6 de §16).
 *
 * **El Bot NO es un octavo rol.** Es un *principal de sistema*, un concepto distinto de un rol de
 * persona.
 *
 * POR QUÉ NO UN `Rol.BOT`, que era la opción obvia. El catálogo de 7 roles es **cerrado** por
 * `RN-SEG-01` y `functional-scope.md` §2, y `ADR-024` lo ratificó al elegir el enum estático
 * frente a una tabla de permisos dinámica. Añadir un valor al enum sería una desviación
 * silenciosa de una decisión aceptada — y el proyecto exige una ADR nueva para eso, nunca un
 * cambio callado. Además sería **incorrecto de fondo**: los 7 roles describen a personas con
 * alcance de sucursales, jerarquía (`puedeAsignarRol`) y un registro en `usuarios`. El bot no
 * tiene nada de eso: no se le asignan sucursales, no puede ser dado de alta por otro usuario y no
 * hay nadie a quien responsabilizar si actúa mal. Meterlo en el mismo enum haría que todo
 * `@Roles(...)` existente tuviera que preguntarse si incluye al bot.
 *
 * QUÉ SE CONSTRUYE AHORA Y QUÉ NO. Se fija aquí **la lista de operaciones** que el bot podrá
 * ejecutar, para que Fase 4 no la improvise. **No se emite ninguna credencial ni se abre ningún
 * endpoint al bot todavía**: el canal de WhatsApp es de Fase 4 y no existe. Una vía de
 * autenticación viva, sin consumidor y sin nadie ejercitándola en serio, es una superficie de
 * ataque a cambio de nada.
 *
 * Hoy, por tanto, la postura efectiva es **denegar**: `RolesGuard` solo admite los 7 roles de
 * persona, y una petición sin uno de ellos recibe `403`. `rol-cerrado.spec.ts` lo verifica.
 *
 * LO QUE FASE 4 TIENE QUE CONSTRUIR, y es el motivo de que esta lista exista:
 * 1. Autenticación propia del principal de sistema (token de servicio con rotación), separada de
 *    Supabase Auth — el bot no es un usuario de Supabase.
 * 2. Un guard que reconozca ese principal y lo contraste contra `OPERACIONES_PERMITIDAS_AL_BOT`,
 *    **nunca** contra `@Roles`.
 * 3. Auditoría con el principal como `actor`, distinguible de una persona: `RN-AUD-01` exige
 *    saber quién hizo qué, y "lo hizo el bot" es una respuesta distinta de "lo hizo la Encargada".
 */

/**
 * Operaciones que el Bot podrá ejecutar, **y solo estas**.
 *
 * Todas son de **lectura** a propósito. `DEC-042` establece que ninguna clienta cancela sola y
 * que cancelar lo ejecuta siempre una persona; `DEC-040`, que la finalización tampoco es
 * automática. Un bot que pudiera escribir en la agenda sin intervención humana contradiría las
 * dos. Agendar por WhatsApp llegará, pero es una decisión de negocio que no está tomada: cuando
 * se tome, se añade aquí con su propia ADR y no antes.
 */
export const OPERACIONES_PERMITIDAS_AL_BOT = [
  'agenda:consultar-disponibilidad',
  'catalogo:consultar-servicios',
] as const;

export type OperacionDelBot = (typeof OPERACIONES_PERMITIDAS_AL_BOT)[number];

/** Los 7 roles de `RN-SEG-01`, en el orden del documento. Única fuente para la prueba de cierre. */
export const ROLES_DE_PERSONA = [
  Rol.SUPER_ADMIN,
  Rol.ADMINISTRADOR,
  Rol.GERENTE,
  Rol.RECEPCIONISTA,
  Rol.MANICURISTA,
  Rol.ANALISTA,
  Rol.SOLO_LECTURA,
] as const;
