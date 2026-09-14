# ADR-024

## Title
Integración de Identidad con Supabase Auth: mecanismo de claims personalizados, modelo de permisos (enum vs. tabla dinámica), y destino de `refresh_tokens`

## Status
Proposed — pendiente de aprobación del cliente, **y con una salvedad adicional explícita**: la parte de este ADR referida al mecanismo de Supabase (Custom Access Token Hook) se basa en documentación pública de Supabase, verificada por múltiples fuentes cruzadas (documentación oficial + discusiones de la comunidad), pero **no verificada contra el proyecto Supabase real de Blanc** — no hay acceso a ese proyecto desde este entorno de desarrollo. Ver Sección "Qué queda pendiente de verificar" antes de dar esto por definitivo.

**Nota de implementación (2026-08-22):** `FL-SEG-01`/`FL-SEG-03` ya están implementados, con alcance deliberadamente reducido para no depender de nada de este ADR que siga sin verificar — no llaman a Supabase, no usan el Custom Access Token Hook, no crean `refresh_tokens` ni tabla `permisos` (consistente con las Decisiones 2/3 de este ADR, ya aplicadas en código). La Decisión 1 (mecanismo de claims) sigue completamente sin implementar — nada en el código actual la contradice ni la confirma todavía.

**Nota de corrección (2026-08-23):** la Sección "Options Considered — Pregunta 3" de este ADR (párrafo final, "Precisión importante") describe `FL-SEG-05` (Desactivar Usuario) llamando a `admin.signOut` como parte de su caso de uso. **Esa descripción quedó superada por una decisión explícita del cliente (2026-08-23): `FL-SEG-05`, tal como fue implementado, NO interactúa con Supabase en ninguna forma — esa integración queda íntegramente para `FL-SEG-06`.** El texto original de esa sección no se reescribe (se conserva como registro de la evaluación técnica que se hizo en su momento, y sigue siendo válido como *evidencia* de que Supabase soporta ese mecanismo), pero **ya no describe el comportamiento vigente de `FL-SEG-05`**. La decisión SUPERSEDED, su fecha, motivo y la decisión vigente quedan registradas formalmente en `docs/PROJECT_STATUS.md`, entrada `DEC-012` — esa entrada es la fuente de verdad sobre cuál de las dos versiones aplica hoy. Cualquier lector de este ADR debe consultar `PROJECT_STATUS.md` antes de asumir que la Sección "Pregunta 3" describe el diseño actual de `FL-SEG-05`.

**Nota de corrección crítica (2026-08-25) — la premisa de algoritmo de firma de este ADR es factualmente incorrecta contra el proyecto real:** la evaluación de la Opción A de la Pregunta 1 (línea "Opción A no requiere ningún cambio a `JwtAuthGuard` — el token sigue firmado por Supabase con el mismo secreto (`HS256`)...", más abajo en este documento) asumía HS256 como el algoritmo de firma vigente. **Verificación real del proyecto Supabase de Blanc (`<PROJECT_REF>`), 2026-08-24/25:** la clave de firma `CURRENT` es **ECC P-256 / ES256**; HS256 solo existe como clave `PREVIOUSLY USED` (legado). Confirmado además contra los endpoints públicos del proyecto (`/.well-known/openid-configuration`, `/.well-known/jwks.json`): `issuer` real = `https://<PROJECT_REF>.supabase.co/auth/v1`; el JWKS publicado contiene únicamente una clave ES256 (`kid: 0dd96720-c81d-4406-a2de-fe6bed0f4cd8`) — sin ninguna clave HS256 (estructuralmente imposible: HS256 es simétrico, publicarla en un JWKS filtraría el secreto). El texto original de la evaluación **no se reescribe** — la Decisión 1 en sí (Custom Access Token Hook como mecanismo de enriquecimiento de claims) **sigue siendo técnicamente válida y no depende del algoritmo de firma** (el hook opera sobre el payload antes de que Supabase lo firme, con cualquier algoritmo). Lo que queda invalidado es específicamente la afirmación de que "el mismo secreto (HS256)" sigue vigente, y la asunción implícita de que `JwtAuthGuard` no necesita ningún cambio — sí lo necesita, para soportar verificación vía JWKS/ES256 además de (temporalmente, en paralelo) la rama HS256 legacy ya construida. **`DEC-001` de `docs/PROJECT_STATUS.md` se reclasifica de `OPEN`/`REQUIRES_EXTERNAL_ACCESS` a `REQUIRES_REDESIGN`** — ver esa entrada para el historial completo y el diseño propuesto (`DEC-026`). Esta ADR permanece `Proposed`; su aprobación formal queda pendiente del rediseño de la Decisión 1 descrito en `PROJECT_STATUS.md`.

## Context
La auditoría de pre-arranque del módulo Identidad y Accesos (2026-08-11) encontró que `ADR-010` (Seguridad: RBAC, JWT, Audit) y `JwtAuthGuard` (`shared/auth/jwt-auth.guard.ts`, ya construido y probado sobre el módulo Sucursales y Personal) **asumen** que el JWT que el guard valida ya trae los claims `rol` y `sucursales`, y que está "firmado con el secreto de proyecto de Supabase Auth" — pero ningún documento anterior a este ADR explica **cómo** esos claims llegan a ese JWT. Ningún código de este repositorio integra todavía el SDK de Supabase (`package.json` no tiene ninguna dependencia `@supabase/*`, verificado). Esta es la primera vez que el proyecto necesita resolver esa pieza, porque es la primera vez que se construye el módulo (Identidad) responsable de emitir/enriquecer sesiones reales.

Además, la auditoría encontró dos preguntas de arquitectura relacionadas, ambas con el mismo origen (qué controla Blanc vs. qué controla Supabase):
- `04-data-model.md` §5.10 documenta una tabla `permisos` (`rol_id`, `recurso`, `accion`) que implica autorización dinámica dirigida por base de datos — pero el código ya construido en Sucursales usa un `Rol` enum estático (`shared/auth/rol.ts`) + `@Roles(...)` — un modelo distinto, sin tabla alguna.
- `04-data-model.md` §5.10 también documenta `refresh_tokens` como tabla propia de Blanc, pero el mismo documento ya advierte (línea 256-258) que "podría no requerirse tal cual" si el proveedor de autenticación gestiona rotación/revocación internamente — sin haber verificado nunca si Supabase Auth efectivamente lo hace.

## Problem Statement
Tres preguntas técnicas relacionadas, todas bloqueantes para escribir el primer caso de uso de emisión/enriquecimiento de sesión de Identidad:
1. ¿Cómo llegan `rol` y `sucursales` al JWT que Supabase Auth emite, sin romper `JwtAuthGuard` tal como está construido?
2. ¿El modelo de autorización de Identidad debe ser el `Rol` enum estático ya usado en Sucursales, o la tabla `permisos` dinámica que `04-data-model.md` documenta?
3. ¿Blanc necesita su propia tabla `refresh_tokens`, o Supabase Auth ya cubre rotación/revocación/detección de reuso nativamente?

## Constraints
- `ADR-010` ya exige: JWT de acceso de vida corta, refresh token revocable con rotación y detección de reuso, RBAC en dos niveles, MFA obligatorio para Super Admin/Administrador, revocación inmediata ante incidente.
- `JwtAuthGuard` ya está construido, probado (87 tests) y en uso por Sucursales y Personal — cualquier cambio a su forma de verificación es un cambio transversal de alto impacto, no aislado a Identidad.
- `04-data-model.md` §4.6 fija UUID como PK firme — no reabierto aquí.
- No hay acceso al proyecto Supabase real de Blanc desde este entorno — cualquier afirmación sobre su comportamiento debe distinguir explícitamente "documentado públicamente" de "verificado contra el proyecto real".
- El principio 1 de `IMPLEMENTATION_MASTER_PLAN.md` ("Infrastructure Just-In-Time") exige no construir infraestructura especulativa — aplica directamente a la pregunta de `refresh_tokens`.

## Options Considered — Pregunta 1: mecanismo de claims personalizados

| Opción | Descripción |
|---|---|
| A. Custom Access Token Hook de Supabase (función Postgres) enriquece el JWT que Supabase ya emite | Supabase invoca una función Postgres propia de Blanc antes de emitir/refrescar cada JWT; la función consulta `identidad_accesos.usuarios`/`usuarios_sucursales` y agrega `rol`/`sucursales` al objeto de claims. El JWT resultante sigue firmado por Supabase con el mismo secreto de proyecto. |
| B. Blanc emite su propio JWT tras validar el de Supabase | El frontend obtiene un JWT nativo de Supabase (login), lo envía a un endpoint de Blanc, que lo valida contra Supabase y emite un JWT propio, firmado con un secreto distinto, con `rol`/`sucursales` ya embebidos. |
| C. Sin claims en el token — `JwtAuthGuard` solo valida `sub`, y cada request hace lookup de `rol`/`sucursales` contra la base de datos | El JWT deja de ser la fuente de `rol`/`sucursales`; se convierte en un simple identificador de sesión verificado, y la autorización se resuelve siempre contra el estado actual de la base de datos. |

**Evidencia investigada (documentación pública de Supabase, con fuentes citadas al final de este documento):**
- El Custom Access Token Hook es un mecanismo oficial y documentado: función Postgres con firma `(event jsonb) returns jsonb`, invocada por Supabase Auth antes de emitir un JWT. El campo `event.authentication_method` incluye explícitamente el valor `token_refresh` — es decir, el hook **sí vuelve a ejecutarse en cada refresh**, no solo en el login inicial. Esto significa que un cambio en `usuarios`/`usuarios_sucursales` se refleja en el siguiente JWT emitido (login o refresh), nunca de forma instantánea sobre un access token ya emitido.
- Confirmado explícitamente en la documentación de referencia de la API: **no existe forma de revocar un access token JWT ya emitido antes de su expiración natural** — la única palanca real es revocar el refresh token (`admin.signOut(userId, { scope: 'global' })`) o banear la cuenta (`ban_duration` vía `admin.updateUserById`), y ninguna de las dos invalida una sesión (access token) ya viva.
- Configuración: vía Dashboard (`Authentication > Hooks`) en producción, o `config.toml` (`[auth.hook.custom_access_token]`) en desarrollo local — ambas apuntan a la misma función Postgres (`pg-functions://postgres/<schema>/<función>`).
- Límite de tiempo de ejecución documentado: 2 segundos para hooks SQL — un `SELECT` simple contra `usuarios`/`usuarios_sucursales` está muy por debajo de ese límite en cualquier escenario razonable, pero esto no se verificó contra latencia real de producción.
- Existe una advertencia explícita de tamaño de JWT ("Minimal JWT") — relevante porque `sucursales` es un arreglo de longitud variable; con 3-4 sucursales el tamaño no es un riesgo real, pero es una restricción documentada a tener presente si el negocio crece.

**Evaluación:**
- **Opción A** no requiere ningún cambio a `JwtAuthGuard` — el token sigue firmado por Supabase con el mismo secreto (`HS256`) [**Nota de corrección 2026-08-25: esta premisa de algoritmo es incorrecta contra el proyecto real — ver "Nota de corrección crítica" en la sección Status, arriba. La afirmación de que no requiere cambios a `JwtAuthGuard` tampoco se sostiene: sí requiere agregar una rama de verificación ES256/JWKS.**], la única diferencia es que trae más claims en el payload. Es la opción de menor superficie de cambio sobre el código ya construido y probado, y es exactamente la arquitectura que `ADR-010`/`JwtAuthGuard` ya asumían implícitamente sin nombrarla.
- **Opción B** duplicaría la superficie de emisión de tokens (dos secretos, dos mecanismos de firma, un endpoint nuevo de "intercambio" que Blanc tendría que proteger y mantener) sin ganar nada que la Opción A no dé — contradice el principio de no introducir complejidad operativa sin justificación (`IMPLEMENTATION_MASTER_PLAN.md` §2, principio 1).
- **Opción C** eliminaría el problema de staleness de claims por completo (siempre lee el estado real), pero cambia la naturaleza del JWT de "stateless" a "requiere lookup en cada request" — contradice el diseño ya decidido en `ADR-010` (Opción C de ese ADR es explícitamente JWT con claims embebidos, evaluado contra "sesión server-side pura" y rechazado por acoplamiento). Reabrir esa decisión no está en el alcance de este ADR.

## Options Considered — Pregunta 2: modelo de permisos

| Opción | Descripción |
|---|---|
| A. `Rol` enum estático (ya construido) + `@Roles(...)` + revalidación nivel 2 en cada caso de uso | El catálogo de 7 roles vive en código TypeScript; cualquier cambio de qué puede hacer un rol requiere un despliegue. |
| B. Tabla `permisos` (`rol_id`, `recurso`, `accion`) dinámica, consultada en cada autorización | El catálogo de permisos vive en base de datos, editable sin desplegar código; el guard/nivel 2 consulta la tabla en vez de un enum. |

**Evaluación, criterio por criterio (pedida explícitamente, sin sobreingeniería):**

| Criterio | Opción A (enum) | Opción B (tabla dinámica) |
|---|---|---|
| Seguridad | Superficie de ataque menor — un permiso mal escrito requiere PR + review + deploy, no un `UPDATE` directo a una tabla | Un `UPDATE` incorrecto en `permisos` (manual o por bug) cambia autorización en producción sin revisión de código |
| Mantenibilidad (hoy, 7 roles fijos) | Alta — ya construido, probado, documentado | Requiere construir un CRUD de permisos, su propia UI/endpoint administrativo, y su propia auditoría de cambios |
| Auditabilidad | Los cambios de permiso son commits de Git, con historial completo gratis | Requiere auditar cada `UPDATE` a `permisos` explícitamente (trabajo adicional, ya que `RN-AUD-01` exigiría registrar también estos cambios) |
| Complejidad | Baja — ya existe | Alta — nuevo modelo, nuevo mecanismo de caché/consulta en cada request, nuevo endpoint administrativo |
| Performance | Sin costo — el rol ya viaja en el JWT | Requiere consultar `permisos` en cada autorización (o cachear con su propio problema de invalidación — el mismo problema de staleness de la Pregunta 1, ahora duplicado para permisos) |
| Escalabilidad | Suficiente para 7 roles fijos, sin evidencia de que el negocio necesite más | Se justificaría con decenas/cientos de permisos granulares por cliente — no es el caso de Blanc hoy (single-tenant, `ADR-009`) |
| Cambios sin deploy | No — requiere deploy | Sí — es la única ventaja real de la Opción B |
| Riesgo de configuración incorrecta | Bajo | Alto — nada impide un `INSERT` en `permisos` que otorgue un permiso no revisado por nadie |
| Compatibilidad con lo ya construido | Total — `RolesGuard`, `tieneAlcanceSucursal()`, `@Roles(...)` ya son el patrón | Ninguna — habría que reconstruir el guard y el nivel 2 de RBAC de Sucursales para que dejen de asumir el enum |
| Impacto en JWT | Ninguno — el claim `rol` sigue siendo un string simple | Ninguno directo, pero el guard necesitaría resolver permisos por rol en cada request, no solo leer el claim |
| Impacto en frontend | Ninguno — ya sabe qué son los 7 roles | Tendría que consultar/cachear el catálogo de permisos para renderizar UI condicional |
| Impacto en auditoría | Ninguno nuevo | Nuevo: cada cambio de permiso es, en sí mismo, una acción que `RN-AUD-01` exigiría auditar |

**Decisión: Opción A — mantener el `Rol` enum estático.** Blanc tiene 7 roles fijos, sin evidencia documental de que el negocio necesite permisos configurables por cliente o por instancia (es single-tenant hoy, `ADR-009`). Construir la Opción B sería resolver un problema que no existe todavía, exactamente el tipo de sobreingeniería que este proyecto ya rechaza explícitamente en otros puntos (`IMPLEMENTATION_MASTER_PLAN.md` §2, principio 4: "ningún patrón se construye dos veces contra el vacío"). La tabla `permisos` de `04-data-model.md` §5.10 **no se elimina de ese documento** — queda marcada ahí mismo como pendiente/no implementada (ver cambio documental en la Sección "Documentación modificada" del HANDOFF de esta iteración), preservando la trazabilidad de que se consideró y por qué no se construye ahora. Si en el futuro aparece un segundo cliente con necesidades de permisos distintas (`ADR-009`, Future Revisit Criteria), esta decisión se revisita entonces, no antes.

## Options Considered — Pregunta 3: `refresh_tokens`

| Opción | Descripción |
|---|---|
| A. Construir `identidad_accesos.refresh_tokens` tal como `04-data-model.md` la documenta | Blanc gestiona su propio rastreo de refresh tokens, rotación y detección de reuso, en paralelo/en vez de lo que Supabase ya haga. |
| B. No construir la tabla — delegar rotación/revocación/detección de reuso completamente a Supabase Auth | Supabase Auth ya gestiona el ciclo de vida del refresh token internamente (confirmado documentalmente: rotación en cada uso, y `admin.signOut(userId, {scope:'global'})` para revocación). |
| C. Tabla mínima, no para gestionar el ciclo de vida del refresh token en sí, sino para necesidades propias de Blanc no cubiertas por Supabase (ej. justificación/auditoría de un `signOut` forzado) | Una tabla más pequeña que la documentada, con un propósito distinto: registrar *por qué* Blanc forzó una revocación (ligado a `RN-AUD-01`), no *cómo* se rota un token. |

**Evidencia investigada:** Supabase Auth (GoTrue) gestiona nativamente: rotación de refresh token en cada uso, revocación server-side vía `admin.signOut`, y expone `ban_duration` para bloquear futuros logins. Esto cubre exactamente lo que `ADR-010` pedía como constraint ("capacidad de revocación inmediata... rastreados y revocables del lado del servidor, con rotación en cada uso") — **sin que Blanc necesite construir ni mantener ese mecanismo por su cuenta**.

**Decisión: Opción B para el mecanismo de rotación/revocación en sí — no se construye `identidad_accesos.refresh_tokens` tal como está documentada en `04-data-model.md` §5.10.** Construirla sería exactamente la infraestructura especulativa que `IMPLEMENTATION_MASTER_PLAN.md` §2 (principio 1) ya prohíbe: Supabase ya resuelve el problema que esa tabla existía para resolver. `04-data-model.md` §5.10 **no se borra** — se marca como no implementada, con esta ADR como referencia de por qué.

**Precisión importante, no cubierta por la Opción B tal cual:** si en el futuro Blanc necesita *auditar* (`RN-AUD-01`) el motivo de negocio de una revocación forzada (ej. "se revocó la sesión de este usuario porque fue desvinculado el 2026-09-01"), eso **no** es responsabilidad de una tabla de refresh tokens — es una entrada más en `auditoria.log_auditoria`, ya construido y reutilizable, disparada por el caso de uso `FL-SEG-05` (Desactivar Usuario) cuando llame a `admin.signOut`. No se necesita ninguna tabla nueva para esto — Opción C se descarta por innecesaria, ya cubierta por infraestructura existente.

## Decision
Se adoptan, en conjunto:
1. **Custom Access Token Hook de Supabase** (función Postgres) como mecanismo de inyección de `rol`/`sucursales` en el JWT — sin cambios a la forma de verificación de `JwtAuthGuard`.
2. **`Rol` enum estático**, no tabla `permisos` dinámica — el modelo ya construido en Sucursales se confirma como el patrón oficial también para Identidad.
3. **Sin tabla `refresh_tokens` propia** — se delega el ciclo de vida completo del refresh token a Supabase Auth; `04-data-model.md` §5.10 se marca como no implementada en ese punto, con referencia a este ADR.

## Consequences

### Positive Consequences
- Cero cambios a `JwtAuthGuard` (ya construido, probado, en producción-lógica para Sucursales) — el trabajo de Identidad se concentra en la función Postgres del hook y en los casos de uso administrativos, no en reconstruir infraestructura de autenticación ya probada.
- Menos código propio que mantener y auditar en las tres decisiones — Supabase resuelve rotación/revocación/permisos-simples de forma nativa, documentada y ya operada por terceros a escala.
- Consistencia total con lo que `ADR-010` y el código ya asumían implícitamente — esta ADR no cambia arquitectura, la nombra y la confirma con evidencia.

### Negative Consequences
- La staleness de claims (rol/sucursal cambiados) queda acotada por la vida del access token (minutos) y por cuándo ocurre el siguiente refresh — no es instantánea. Ya era una consecuencia aceptada implícitamente por `ADR-010` al elegir JWT de vida corta sobre sesión server-side pura; este ADR la hace explícita con evidencia concreta, no la introduce.
- Dependencia dura de una función Postgres viviendo dentro del proyecto Supabase de Blanc — un cambio de proveedor de autenticación en el futuro (`Future Revisit Criteria` de `ADR-010`) requeriría rediseñar este mecanismo específico, no solo cambiar un valor de configuración.
- Si Blanc necesita permisos granulares en el futuro (Opción B de la Pregunta 2), hay que construir esa infraestructura desde cero — se acepta ese costo futuro a cambio de no pagarlo hoy sin necesidad demostrada.

## Risks
- **El plan/tier real de Supabase que use Blanc podría no incluir Auth Hooks**, o tener un comportamiento distinto al documentado públicamente — no verificado. Mitigación: verificar contra el proyecto real antes de escribir el primer caso de uso de emisión de sesión (ver Future Revisit Criteria).
- **El comportamiento exacto en desarrollo local/self-hosted (`config.toml`) podría diferir del comportamiento en la nube** — la documentación no distingue explícitamente. Mitigación: mismo punto de verificación.
- **Latencia del hook bajo carga real** no verificada — el límite documentado (2s) da margen amplio para un `SELECT` simple, pero nunca se probó contra el proyecto real.
- **Revocación no instantánea de un access token ya emitido** es un riesgo aceptado, no mitigado por este ADR — documentado explícitamente en la Sección 9/10 del `HANDOFF` de esta iteración como comportamiento conocido, no como vacío.

## Alternatives Rejected
- **Opción B de la Pregunta 1 (Blanc emite su propio JWT):** rechazada por duplicar superficie de firma/verificación sin beneficio sobre la Opción A.
- **Opción C de la Pregunta 1 (sin claims en el token, lookup en cada request):** rechazada por reabrir una decisión (JWT stateless con claims embebidos vs. sesión server-side) ya cerrada en `ADR-010`, fuera del alcance de este ADR.
- **Opción B de la Pregunta 2 (tabla `permisos` dinámica):** rechazada por sobreingeniería frente a 7 roles fijos sin evidencia de necesidad — no se descarta para siempre, ver Future Revisit Criteria.
- **Opción A y C de la Pregunta 3 (`refresh_tokens` propia, completa o mínima):** rechazadas por infraestructura especulativa que Supabase ya cubre; Opción C específicamente porque el caso real que intentaba cubrir (auditoría del motivo de una revocación) ya lo cubre `auditoria.log_auditoria`.

## Future Revisit Criteria
- **Antes de escribir el primer caso de uso de emisión/enriquecimiento de sesión de Identidad:** verificar contra el proyecto Supabase real de Blanc — (a) que Auth Hooks está disponible en el plan contratado, (b) que el Custom Access Token Hook efectivamente puede configurarse apuntando a una función en el esquema `identidad_accesos` (o el esquema que se decida), (c) el comportamiento exacto en el entorno de desarrollo local si se usa Supabase self-hosted/CLI.
- Si Blanc adquiere un segundo cliente (`ADR-009`, Future Revisit Criteria) con necesidades de permisos configurables por instancia, revisitar la Pregunta 2 (Opción B).
- Si el negocio exige revocación de acceso verdaderamente instantánea (no acotada a la vida del access token), revisitar el modelo de tokens completo de `ADR-010` — este ADR no lo resuelve, solo documenta el límite actual con evidencia.

## Fuentes consultadas (documentación pública, no verificada contra el proyecto real)
- Supabase Docs — Custom Access Token Hook: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- Supabase Docs — Auth Hooks (configuración, timing, límites): https://supabase.com/docs/guides/auth/auth-hooks
- Supabase Docs — Custom Claims & RBAC: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
- Supabase Docs — JavaScript `signOut` (revocación, `scope: 'global'`): https://supabase.com/docs/reference/javascript/auth-signout
- Supabase Docs — JavaScript `updateUserById` (`ban_duration`): https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
- Discusión de la comunidad confirmando `authentication_method: token_refresh` como disparador del hook (corrobora, no reemplaza, la documentación oficial).
