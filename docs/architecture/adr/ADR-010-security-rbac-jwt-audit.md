# ADR-010

## Title
Seguridad: RBAC con alcance por sucursal, JWT de corta duración + Refresh Token revocable, MFA obligatorio para roles elevados, auditoría append-only

## Status
Proposed — pendiente de aprobación del cliente (el alcance exacto de RBAC por rol depende de la Pregunta Abierta #11 del Domain Discovery)

**Enmendado el 2026-09-14** — ver "Enmienda 1" al final de este documento: los claims `rol` y `sucursales` dejan de viajar en el JWT; se leen de PostgreSQL en cada request (modelo C2, `DEC-029`). La Decision original de este ADR debe leerse con esa enmienda.

## Context
El cliente pidió explícitamente invertir fuerte en seguridad: RBAC, JWT, Refresh Tokens, MFA, auditoría, historial, versionado, rate limit, logs, encriptación, backups, monitoreo, alertas, secrets manager. El Domain Discovery ya define 7 roles (Super Admin, Administrador, Gerente, Recepcionista, Manicurista, Analista, Solo lectura) y deja abierto si el alcance de cada rol es global o por sucursal.

## Problem Statement
¿Cómo se diseña el modelo de autenticación y autorización para que sea seguro, revocable de inmediato ante un incidente (ej. despido de un empleado), y auditable de forma confiable — incluyendo las acciones que la propia IA ejecuta en nombre del sistema?

## Constraints
- Debe existir capacidad de revocación inmediata de acceso (offboarding de empleados, sospecha de cuenta comprometida) — no aceptable esperar la expiración natural de un token.
- Las acciones de IA (ADR-007) y las acciones administrativas (cambios de configuración, asignación de lista roja, cobros de anticipo) requieren auditoría con el mismo nivel de rigor.
- El alcance de RBAC por sucursal está pendiente de confirmación (Domain Discovery, pregunta abierta #11) — el modelo debe soportar scope por sucursal aunque el detalle fino se ajuste después.
- El sistema tendrá, en el futuro, una API pública (mencionada por el cliente para integraciones POS) — el modelo de autenticación no debe diseñarse solo pensando en usuarios internos.

## Options Considered

| Opción | Descripción |
|---|---|
| A. JWT stateless puro, sin tracking de revocación | Tokens de larga duración, sin mecanismo de invalidación anticipada. |
| B. Sesión server-side pura | Estado de sesión completo en servidor, sin tokens portables. |
| C. JWT de corta duración (access token) + Refresh Token revocable con rotación | Autorización rápida y stateless para cada request, con capacidad de revocación real vía invalidación del refresh token. |

## Decision
Se adopta la **Opción C**. Access tokens JWT de vida corta (minutos), con claims de rol y alcance de sucursal. Refresh tokens de vida más larga, rastreados y revocables del lado del servidor, con rotación en cada uso (un refresh token usado se invalida y se emite uno nuevo). RBAC se aplica en dos niveles: middleware de autorización (grueso, por endpoint/rol) y validación a nivel de caso de uso de dominio (fino, ej. "solo Recepcionista o superior puede aprobar la cancelación de una clienta en lista roja"). MFA es **obligatorio** para los roles Super Admin y Administrador como mínimo, dado que pueden alterar configuración crítica de sucursal. El log de auditoría es de **solo-anexado** (append-only, no editable ni borrable por ningún rol de aplicación) y cubre: cambios de configuración, acciones financieras (anticipos), asignación/remoción de lista roja, y toda decisión de IA con efecto de negocio (enlazado con ADR-007).

## Consequences
Se obtiene revocación inmediata de acceso y trazabilidad completa de las acciones más sensibles del sistema, a cambio de mayor complejidad operativa que un JWT puramente stateless.

### Positive Consequences
- Revocación inmediata de acceso ante despido o compromiso de cuenta, sin depender de la expiración natural del token.
- Defensa en profundidad: un fallo en el middleware de autorización no deja expuesta la validación de reglas de negocio sensibles, que se revalida en el caso de uso de dominio.
- Auditoría append-only cumple con el nivel de rigor que el cliente pidió explícitamente y da soporte a investigaciones posteriores (ej. disputa de un cargo de anticipo).
- El modelo de tokens es estándar para sistemas API-first, alineado con la futura API pública.

### Negative Consequences
- Requiere mantener un almacén de refresh tokens y lógica de rotación — más piezas móviles que un JWT puro.
- MFA obligatorio añade fricción de onboarding para los roles administrativos.
- El log de auditoría append-only crece indefinidamente y requiere una política de retención definida (ADR-022).

## Risks
- **Robo/reuso de refresh token**: mitigado con rotación en cada uso y detección de reuso (si un refresh token ya rotado se reutiliza, se invalida toda la cadena de sesión como señal de posible robo).
- **Alcance de RBAC por sucursal mal definido** hasta que se resuelva la Pregunta Abierta #11: el modelo se diseña para soportar scope por sucursal desde el inicio (claim de sucursal(es) asignadas en el token) para no requerir un rediseño cuando se confirme el detalle exacto.
- **Auditoría de decisiones de IA incompleta** si no se disciplina desde el primer caso de uso: mitigado por la exigencia de ADR-007 de que toda acción de IA pase por un caso de uso auditable.

## Alternatives Rejected
- **JWT stateless puro sin revocación**: rechazado. No permite revocar acceso de forma inmediata, inaceptable para un sistema con empleados que pueden ser desvinculados y con roles de alto privilegio (Super Admin, Administrador).
- **Sesión server-side pura**: rechazada como mecanismo único. Es menos natural para un sistema pensado desde el inicio como API-first con planes de API pública futura, y añade acoplamiento a un almacén de sesión para cada verificación de autorización.

## Future Revisit Criteria
- Se confirma el alcance exacto de RBAC por sucursal (Pregunta Abierta #11) — ajustar el modelo de claims si difiere del supuesto de "scope por sucursal asignada" adoptado aquí.
- La API pública para integradores externos (POS/inventario) se diseña formalmente — revisar si requiere un mecanismo de autenticación adicional (ej. API keys/OAuth de aplicación) distinto del de usuarios internos.

---

## Enmienda 1 (2026-09-14) — El JWT autentica; PostgreSQL autoriza en cada request

**Esta enmienda modifica el alcance de la Decision original de este ADR. El texto anterior no se reescribe: sigue siendo válido salvo en lo que esta sección precisa explícitamente.**

### Qué cambia

La Decision original dice que el access token JWT lleva "claims de rol y alcance de sucursal". **Esos dos claims dejan de viajar en el token.** El JWT conserva íntegramente su papel de credencial de autenticación —firma verificable, vida corta, `sub` como identidad— pero `rol`, `activa` y las sucursales asignadas se leen de `identidad_accesos` en PostgreSQL en cada petición autenticada, mediante una capa de autorización situada entre `JwtAuthGuard` y `RolesGuard`.

El modelo de RBAC en dos niveles que este ADR estableció **no cambia en absoluto**: sigue habiendo un nivel grueso por rol/endpoint y una revalidación fina dentro de cada caso de uso. Lo único que cambia es de dónde salen los datos que alimentan ambos niveles.

Decisión registrada en `docs/PROJECT_STATUS.md`, entrada `DEC-029`, que además deja `DEC-001` (Custom Access Token Hook) y la Decisión 1 de `ADR-024` como `SUPERSEDED`.

### Por qué esto no contradice el rechazo de la "sesión server-side pura"

Este ADR rechazó esa alternativa **como mecanismo único de autenticación**, por dos motivos textuales: que es "menos natural para un sistema pensado desde el inicio como API-first" y que "añade acoplamiento a un almacén de sesión para cada verificación de autorización". Ninguno de los dos aplica aquí:

- **No hay almacén de sesión.** No se introduce ninguna infraestructura de sesiones, ningún token opaco, ningún intercambio. La autenticación sigue siendo un JWT stateless verificado criptográficamente sin llamada de red (ES256 contra un JWKS cacheado, o HS256 legacy durante la transición).
- **Lo que se consulta es la base de datos de negocio**, la misma que cada caso de uso ya consulta para hacer su trabajo. No es un sistema adicional del que la autenticación pase a depender: es la tabla `usuarios` que Blanc ya posee y de la que `ADR-024`/`DEC-024` ya declararon que es la fuente de verdad.
- **La propiedad API-first se conserva.** El contrato no cambia: sigue siendo `Authorization: Bearer <token>` sin estado del lado del cliente.

En síntesis: se rechazó autenticar contra un almacén de sesión, y eso sigue rechazado. Lo que esta enmienda autoriza es **autorizar contra la propia base de datos de negocio**, que es una operación distinta.

### Cómo mitiga la falta de revocación inmediata

Este ADR fija como constraint que "debe existir capacidad de revocación inmediata de acceso (offboarding de empleados, sospecha de cuenta comprometida) — no aceptable esperar la expiración natural de un token". **Esa constraint no se estaba cumpliendo:** con los claims embebidos en el JWT, desactivar a un usuario (`FL-SEG-05`, `activa = false`) no producía ningún efecto hasta que su token expirara —hasta 3600 segundos con la configuración real del proyecto— y quien no refrescara conservaba sus permisos la ventana completa.

Con esta enmienda, un cambio de rol, una remoción de sucursal o una desactivación **surten efecto en la siguiente petición**, porque la autorización lee el estado actual y no una copia firmada minutos u horas antes.

**Límite que debe enunciarse sin ambigüedad:** esto **no es revocación criptográfica**. El access token emitido sigue siendo válido y verificable hasta su expiración; lo que se logra es que Blanc **deje de concederle autorización**. Un consumidor que validara ese token por su cuenta, fuera de la capa de autorización de Blanc, lo seguiría aceptando. La revocación real de la sesión sigue dependiendo de los mecanismos de Supabase Auth (`admin.signOut`, `ban_duration`), todavía sin implementar. La constraint queda satisfecha **en la superficie de API de Blanc**, no en sentido criptográfico.

### Consecuencias de la enmienda

**Positivas**
- La constraint de revocación inmediata pasa de incumplida a satisfecha en la superficie de Blanc.
- Desaparece la ventana de staleness de permisos (hasta 3600 s).
- La lógica de autorización queda íntegramente en TypeScript, cubierta por la suite de tests del repositorio, en lugar de repartirse entre SQL alojado en el proveedor de autenticación y código propio.
- Menor acoplamiento a un mecanismo propietario del proveedor: si la base de datos migrara fuera de Supabase, la autorización sigue funcionando.

**Negativas**
- Una a dos consultas adicionales por petición autenticada. Se aceptan conscientemente: son reutilizables dentro de la misma petición y marginales frente a lo que cada endpoint ya consulta a la escala actual del negocio.
- La disponibilidad de la autorización queda ligada a la de PostgreSQL. Se adopta una política **fail-closed**: ante un fallo de base de datos se deniega, nunca se asume un rol por defecto, y el error se reporta como categoría de infraestructura (`ADR-013`), nunca como `401` ni `403`.
- Cambia el contrato de error para un caso: un JWT válido cuyo portador no tiene registro en Blanc, o lo tiene con `activa = false`, pasa de `401` a `403`.

### Riesgos introducidos
- **Dependencia de PostgreSQL en el camino de autorización.** Mitigación: política fail-closed explícita; reutilización dentro de la petición; posibilidad futura de cache en un único punto de inserción, no construida hoy por ser infraestructura especulativa.
- **Ninguna mitigación nueva sobre el access token ya emitido.** Sigue siendo el riesgo aceptado que este ADR no puede resolver por sí solo.

### Qué NO cambia este ADR
JWT de vida corta con refresh revocable y rotación; RBAC en dos niveles; MFA obligatorio para Super Admin y Administrador; auditoría append-only. Todo ello sigue vigente tal como fue decidido.
