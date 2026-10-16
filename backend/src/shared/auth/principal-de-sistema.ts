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
 * QUÉ SE CONSTRUYE AHORA Y QUÉ NO. Se fija aquí **la lista de operaciones** que el bot puede
 * ejecutar. **No se emite ninguna credencial ni se abre ningún endpoint al bot**, y eso sigue
 * siendo cierto tras el cierre de Fase 4: el bot vive **en proceso** y actúa a través de los
 * casos de uso directamente, con un actor de sistema identificable en auditoría. No hay ninguna
 * superficie HTTP suya que autenticar, así que no hay token de servicio que rotar.
 *
 * La postura efectiva hacia fuera sigue siendo **denegar**: `RolesGuard` solo admite los 7 roles
 * de persona, y una petición sin uno de ellos recibe `403`.
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
 * Operaciones que el Bot puede ejecutar, **y solo estas**.
 *
 * ## ENMIENDA 1 (2026-10-16): SE AUTORIZAN ESCRITURAS ACOTADAS DEL FLUJO CONVERSACIONAL
 *
 * La versión original de esta lista era **toda de lectura**, y lo decía: *"agendar por WhatsApp
 * llegará, pero es una decisión de negocio que no está tomada"*. Se tomó. La Dueña autoriza que
 * el bot cierre el flujo conversacional completo, con el límite que ya existía.
 *
 * **Lo que esto NO relaja:** `DEC-040` sigue intacto — **ninguna clienta cancela sola**, y
 * cancelar o reprogramar escala a una persona siempre. La frontera no se movió de sitio, se
 * movió de criterio: ya no es *"el bot no escribe"*, es **"el bot no decide lo que una persona
 * tiene que mirar"**.
 *
 * ## POR QUÉ ESTO ES SEGURO, Y NO DEPENDE DE LA BUENA VOLUNTAD DEL BOT
 *
 * Cada escritura de esta lista pasa por **el mismo caso de uso que usa el mostrador**. No hay una
 * vía paralela: `AgendarCitaUseCase` valida el servicio contra Catálogo, deriva la duración,
 * comprueba capacidad, respeta el horario, rechaza a una clienta bloqueada (`RN-CRM-04`) y —si
 * está en lista roja— hace nacer la cita en `en_espera_pago` con su anticipo del 40 %
 * (`RN-ANT-01`). El bot no reimplementa ninguna de esas reglas y **no puede saltárselas**, porque
 * no tiene otra forma de agendar.
 *
 * Lo que sí hace falta vigilar es que la lista no crezca por descuido, y de eso se encarga
 * `principal-de-sistema.spec.ts`: toda escritura nueva tiene que declararse en
 * `ESCRITURAS_AUTORIZADAS_AL_BOT`, y `cancelar`/`reprogramar` fallan el build.
 */
export const OPERACIONES_PERMITIDAS_AL_BOT = [
  // Lectura.
  'agenda:consultar-disponibilidad',
  'catalogo:consultar-servicios',
  'crm:consultar-clienta',
  'anticipos:consultar-de-cita',
  // Escritura acotada del flujo conversacional (Enmienda 1).
  'agenda:agendar-cita',
  'agenda:confirmar-cita',
  'agenda:inscribir-lista-espera',
  'agenda:aceptar-oferta-lista-espera',
  'crm:registrar-clienta',
  'anticipos:generar-anticipo',
] as const;

export type OperacionDelBot = (typeof OPERACIONES_PERMITIDAS_AL_BOT)[number];

/**
 * Las escrituras de la lista anterior, **declaradas explícitamente**.
 *
 * Es una lista redundante a propósito: obliga a que añadir una escritura sea un acto deliberado
 * en dos sitios, y permite que la prueba distinga *"esta operación escribe y está autorizada"* de
 * *"esta operación escribe y nadie se dio cuenta"*. Sin esto, la única defensa sería la
 * convención de nombrar `consultar-*` a las lecturas, y una operación mal nombrada se colaría.
 */
export const ESCRITURAS_AUTORIZADAS_AL_BOT: readonly OperacionDelBot[] = [
  'agenda:agendar-cita',
  'agenda:confirmar-cita',
  'agenda:inscribir-lista-espera',
  'agenda:aceptar-oferta-lista-espera',
  'crm:registrar-clienta',
  'anticipos:generar-anticipo',
];

/**
 * Operaciones que **nunca** se autorizan al bot, ni ampliando la lista.
 *
 * `DEC-040` y `DEC-042`: cancelar y reprogramar los ejecuta una persona. Reprogramar además exige
 * evaluar la ventana de 48 h con anticipo pagado (`RN-ANT-04`) y el tope de 3 reprogramaciones
 * (`DEC-042`) — reglas, y el bot no evalúa reglas.
 *
 * Están aquí como lista negra y no solo como ausencia porque **la ausencia ya falló una vez**: la
 * lista original era "toda de lectura" y eso se sostenía en la convención de nombres.
 */
export const OPERACIONES_PROHIBIDAS_AL_BOT = ['cancelar', 'reprogramar', 'eliminar', 'desactivar'] as const;

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
