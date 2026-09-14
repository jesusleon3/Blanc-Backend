# Pre-arranque de Identidad y Accesos

> **Qué es este documento:** el artefacto de trabajo de la fase de pre-arranque técnico del módulo Identidad y Accesos (2026-08-11) — cubre las preguntas que `ADR-024` no cubre en detalle (la frontera funcional Supabase↔Blanc, los patrones de consistencia cross-sistema, el manejo de sesiones frente a cambios de rol/sucursal/estado, y la revisión de seguridad y de pruebas). No redefine nada ya cerrado en `ADR-010`, `04-data-model.md` o `ADR-024` — los referencia.
> **Qué NO es:** no es una autorización para implementar. No cierra la Pregunta 11 de `OWNER_DECISION_LOG.md`. No introduce Rule IDs nuevos (eso vive en `docs/business-rules/`, sin tocar aquí).
> **Fecha:** 2026-08-11.
> **Nota de implementación (2026-08-23, actualizada):** `FL-SEG-01`/`FL-SEG-03`/`FL-SEG-04`/`FL-SEG-05` (solo desactivar) ya están implementados, con alcance mínimo — sin Supabase, sin `mfa_habilitado`, sin reactivar. `FL-SEG-04` resolvió la autorización nivel 2 sobre sucursal (`tieneAlcanceSucursal`); `FL-SEG-01/03/05` no la necesitan (no operan sobre una sucursal específica). **Corrección explícita a la recomendación original de §3 de este documento:** ahí se recomendaba que `FL-SEG-05` llamara a `admin.signOut` de Supabase como parte del mismo caso de uso — esa recomendación queda superada por instrucción explícita del cliente (2026-08-23): `FL-SEG-05` implementado NO toca Supabase, esa integración queda íntegramente para `FL-SEG-06`. Todo lo que este documento describe sobre la frontera Supabase↔Blanc, consistencia cross-sistema y sesiones activas **sigue siendo planeación, no implementación**. Ver `docs/decision-flows-catalogo-diseno.md` notas (f)/(g)/(h) y `ADR-024` para el estado real.

---

## 1. Frontera Supabase Auth ↔ Backend Blanc

| Responsabilidad | Supabase Auth | Backend Blanc | Ambos | Verificado / Pendiente |
|---|---|---|---|---|
| Credenciales, password, password reset | ✅ | | | Verificado documentalmente (flujo nativo de Supabase Auth) |
| Login | ✅ | | | Verificado documentalmente |
| Refresh / rotación de token | ✅ (nativo, rotación en cada uso) | | | Verificado documentalmente (`ADR-024`) — **no verificado contra el proyecto real** |
| Logout / revocación de sesión | ✅ (`admin.signOut`, scope `local`/`global`) | | | Verificado documentalmente — **el access token ya emitido no se revoca de inmediato** (ver Sección 3) |
| Identidad del usuario (existencia de cuenta) | ✅ (fuente de verdad de `auth.users`) | | | — |
| **`rol`** | | ✅ (`identidad_accesos.usuarios`/`roles`) | ✅ inyectado al JWT vía hook | Mecanismo elegido en `ADR-024` (Custom Access Token Hook) — **no verificado contra el proyecto real** |
| **`sucursales`** | | ✅ (`identidad_accesos.usuarios_sucursales`) | ✅ inyectado al JWT vía hook | Igual que arriba; valor por defecto sin filas sigue en Pregunta 11 |
| Activación/desactivación | | ✅ (`usuarios.activa`, boolean — nombre real de columna implementado en `FL-SEG-05`, 2026-08-23; esta tabla se redactó el 2026-08-11 usando el nombre provisional `estado`) | ✅ si se decide reflejar también en Supabase (`ban_duration`) | Ver Sección 3 — patrón recomendado, no implementado |
| Invitaciones | ✅ (flujo de invite nativo) | ✅ (crear/vincular registro en `usuarios`) | ✅ | Orquestación documentada en Sección 2 (patrón), sin implementar — `FL-SEG-06` |
| Cambio de password | ✅ | | | — |
| MFA (segundo factor) | ✅ (probable, factor nativo) | ✅ (exigir que esté habilitado antes de autorizar rol crítico, `RN-SEG-02`) | ✅ | Mecanismo concreto del segundo factor — **no verificado contra el proyecto real** |
| Auditoría | | ✅ (`shared/auditoria/`, ya construido y reutilizable) | | Mecanismo ya probado en Sucursales |
| Autorización (RBAC) | | ✅ (`RolesGuard` + nivel 2, ya construido) | | `ADR-024` confirma `Rol` enum, no tabla dinámica |
| Emisión/firma del JWT | ✅ (siempre Supabase, con o sin hook) | ❌ (nunca emite su propio JWT, `ADR-024`) | | Decidido en `ADR-024` |
| Validación del JWT en cada request | | ✅ (`JwtAuthGuard`, ya construido) | | Sin cambios necesarios por `ADR-024` |

---

## 2. Patrón de consistencia cross-sistema — alta de usuario

**Por qué esto no es una transacción PostgreSQL normal:** crear un usuario completo requiere (a) una cuenta en Supabase Auth (`auth.users`, fuera del control transaccional de Blanc) y (b) un registro en `identidad_accesos.usuarios` (dentro del control transaccional de Blanc). `UnitOfWork` (`shared/persistence/`, ya construido para Sucursales) protege atomicidad **solo dentro de PostgreSQL** — una llamada HTTP a la Admin API de Supabase dentro de un `unitOfWork.ejecutar(...)` no es reversible si el `INSERT` local falla después, ni viceversa.

**Escenarios de fallo identificados (sin implementar solución todavía):**
1. Supabase crea el usuario → Blanc falla al insertar en `usuarios` → queda una cuenta de Supabase "huérfana", sin contraparte en Blanc (ver también Sección 3, "usuario en Supabase sin registro en Blanc").
2. Blanc inserta en `usuarios` → la llamada a Supabase (invitar/crear) falla → queda un registro de Blanc sin cuenta de acceso real — el usuario no puede iniciar sesión nunca, sin que nada lo señale como error.
3. Invitación enviada por Supabase → la operación local (registrar el alta en `usuarios`) falla → la persona recibe una invitación que, al aceptarla, no tiene contraparte administrativa en Blanc.
4. Reintento de red tras un timeout — sin idempotencia real hoy (mismo patrón ya documentado como riesgo en `05-api-design.md` §7 para Sucursales), un reintento podría crear dos invitaciones o dos intentos de alta para el mismo email.
5. Usuario duplicado — email ya existe en Supabase pero no en `usuarios`, o viceversa.

**Patrón recomendado para el primer caso de uso que cruce esta frontera (documentado, no implementado):**
- **Orden de operaciones: primero Supabase, después Blanc.** Razonamiento: si el paso de Blanc falla, el estado resultante (cuenta de Supabase sin registro en `usuarios`) es *detectable y reconciliable* (basta con consultar `auth.users` y comparar contra `identidad_accesos.usuarios` para encontrar huérfanos) y *no le da a nadie acceso indebido* — una cuenta de Supabase sin fila en `usuarios` no tiene `rol`, y el hook de `ADR-024` no podría emitir claims válidos para ella (o los emitiría vacíos/sin rol, que `JwtAuthGuard` ya rechaza — "rechaza un token válido pero sin un rol reconocido", ya probado). El orden inverso (Blanc primero) crearía un usuario administrativo "fantasma" que aparenta tener acceso pero no puede autenticarse — un estado más confuso de depurar y con más apariencia de bug silencioso.
- **El paso de Blanc debe ser reintentable de forma segura (idempotente) contra el mismo `email`/`id de Supabase`** — no se implementa la idempotencia completa todavía (mismo principio ya aplicado en Sucursales: no convertir una convención en garantía falsa), pero el primer caso de uso que implemente esto debe, como mínimo, verificar existencia previa antes de insertar (mismo patrón de `buscarPorNombre` ya usado en `CrearSucursalUseCase`) para que un reintento no duplique.
- **No se diseña aquí una reconciliación automática** (ej. un job que busque huérfanos periódicamente) — es exactamente el tipo de infraestructura especulativa que `IMPLEMENTATION_MASTER_PLAN.md` principio 1 prohíbe construir antes de tener evidencia de que el problema ocurre con frecuencia real. Se deja como riesgo aceptado y documentado (ver Sección 4 de este documento), no como vacío silencioso.

**Nota histórica de contexto (2026-09-13) — no modifica nada de lo anterior:** la recomendación *"primero Supabase, después Blanc"* de esta sección se escribió para el escenario que esta misma sección describe: **un alta completa de una persona que no existe todavía en ningún sistema**, y bajo el supuesto de que los claims llegarían al JWT mediante el Custom Access Token Hook (`ADR-024`, Decisión 1). **Ese no es el escenario de `FL-SEG-06`.** `DEC-025` acotó `FL-SEG-06` a "Solo Provisionar" sobre un usuario de Blanc **que ya existe** (creado por `FL-SEG-01`, que no toca Supabase), y `DEC-028` fijó su mecanismo (`createUser` sin contraseña). Además, bajo la arquitectura **C2** actualmente en evaluación (autorización resuelta consultando PostgreSQL, no leyendo claims del JWT), el perfil de riesgo se invierte respecto al razonamiento original: una fila de Blanc sin cuenta de Supabase es detectable con una consulta local trivial (`WHERE supabase_user_id IS NULL`), mientras que el estado inverso solo es detectable consultando Supabase. **Por lo tanto, esta recomendación de orden no debe interpretarse como el flujo de provisionamiento vigente de `FL-SEG-06`.** Sigue siendo válida para el escenario de alta completa que describe, si alguna vez se construye. **Lo que permanece plenamente vigente de esta sección, sin excepción:** los cinco escenarios de fallo, la imposibilidad de atomicidad cross-system, la exigencia de idempotencia y el rechazo a construir reconciliación automática.

---

## 3. Sesiones activas frente a cambios de rol, sucursal y estado

**Hecho verificado (`ADR-024`, documentación pública de Supabase, no contra el proyecto real):** un access token JWT ya emitido **no puede revocarse antes de su expiración natural** — ni Supabase ni Blanc tienen forma de invalidarlo a mitad de su vida. Las únicas palancas reales son (a) revocar el refresh token (`admin.signOut`, evita que se emita un token *nuevo*) y (b) banear la cuenta (`ban_duration`, evita un *login* nuevo) — ninguna de las dos toca un access token ya vivo.

| Escenario | Ventana de exposición real | Mitigación existente | Mitigación NO soportada (no inventar) |
|---|---|---|---|
| Rol cambiado con sesión activa | Hasta la expiración del access token actual (minutos, `ADR-010`) — el siguiente refresh sí trae el rol nuevo (el hook re-ejecuta en `token_refresh`, `ADR-024`) | Vida corta del access token, ya decidida en `ADR-010` | Invalidación instantánea del access token — no existe en Supabase, no se debe prometer |
| Sucursal removida con sesión activa | Idéntica a la anterior | Idéntica | Idéntica |
| Usuario desactivado (`usuarios.activa = false`, nombre real de columna; esta fila se redactó el 2026-08-11 con el nombre provisional `usuarios.estado = inactivo`) con sesión activa | Igual que arriba **si** Blanc solo cambia `usuarios.activa` sin tocar Supabase — que es exactamente lo que `FL-SEG-05` implementado (2026-08-23) hace hoy, ver nota superior de este documento. La reducción a "sin acceso a un login/refresh nuevo" descrita a continuación **no ocurre hoy** — dependería de que `FL-SEG-06` llame a `admin.signOut(userId, {scope:'global'})` y/o `ban_duration`, ninguno implementado todavía — pero incluso entonces el access token ya emitido seguiría siendo válido hasta expirar | Ninguna hoy — `JwtAuthGuard` no hace lookup a base de datos (por diseño, "verificable sin llamada de red") | Bloqueo instantáneo del acceso — requeriría cambiar el diseño del guard (ver abajo) |

**Qué NO se inventa aquí:** ni este documento ni `ADR-024` deciden agregar un lookup de base de datos por request al `JwtAuthGuard` (eso convertiría el JWT de stateless a "requiere IO en cada verificación", reabriendo una decisión ya cerrada en `ADR-010`, opción C rechazada explícitamente: "sesión server-side pura... rechazada... añade acoplamiento a un almacén de sesión para cada verificación"). Si el negocio exige revocación instantánea real (por ejemplo, para el escenario de desactivación por incidente de seguridad, el más sensible de los tres), esa es una decisión de arquitectura que debe tomarse explícitamente, no adoptarse por omisión — queda registrada como pregunta abierta en la Sección 6.

**Recomendación operativa original de esta sección (2026-08-11), SUPERADA — conservada solo como registro histórico de la evaluación técnica, no como plan vigente:** ~~al desactivar, ejecutar en el mismo caso de uso (dentro de `unitOfWork.ejecutar`, para la parte de Blanc) — (1) `usuarios.estado = inactivo`, (2) registrar auditoría (`RN-AUD-01`), y **fuera** de la transacción de Postgres (no es reversible por Postgres) — (3) llamar a la Admin API de Supabase para revocar sesiones (`signOut` global) y opcionalmente banear.~~ **Decisión vigente (2026-08-23, `PROJECT_STATUS.md` DEC-012):** `FL-SEG-05` implementado solo ejecuta (1) `usuarios.activa = false` y (2) auditoría — el paso (3) NO ocurre dentro de `FL-SEG-05`; queda íntegramente para `FL-SEG-06`, todavía sin implementar. El análisis de consistencia que sigue (qué pasa si (3) falla después de (1)/(2)) sigue siendo válido *como análisis técnico* para cuando `FL-SEG-06` se implemente, pero no describe un comportamiento que exista hoy: si (3) falla después de que (1)/(2) ya se confirmaron, el usuario queda desactivado en Blanc pero técnicamente con su refresh token todavía vivo en Supabase — un estado inconsistente pero **conservador** (el lado de Blanc, que es lo que `JwtAuthGuard`/nivel 2 podrían llegar a verificar en el futuro, ya quedó correcto), no al revés.

---

## 4. Pregunta 11 — asunción temporal, patrón de aislamiento

**No se decide aquí.** Sigue abierta en `OWNER_DECISION_LOG.md`. Este documento solo fija el **patrón** que debe usarse si Identidad necesita una asunción temporal antes de que la Dueña responda — mismo principio ya aplicado en el hardening de Sucursales (donde la asunción de escritura ya quedó documentada, no ratificada).

**Patrón obligatorio, no negociable, cuando se implemente:**
1. La asunción vive en **una sola función**, con nombre explícito (ej. `resolverAlcancePorDefecto(rol, filasUsuarioSucursal)`), nunca repetida inline en cada caso de uso.
2. El comentario de esa función debe decir textualmente algo equivalente a:
   > `// Temporary implementation assumption: empty usuarios_sucursales = no branch access, pending owner confirmation. Ver OWNER_DECISION_LOG.md, Pregunta 11.`
3. Ningún caso de uso ni test debe asumir el valor de esta función como una regla de negocio confirmada — los tests que dependan de ella deben nombrarla como "asunción temporal" en su descripción, no como comportamiento definitivo.
4. Cuando la Dueña responda, el único archivo que debería cambiar es el de esta función — si responder la Pregunta 11 obliga a tocar más de un archivo, la asunción no estaba correctamente aislada y eso es en sí mismo un defecto de diseño a corregir antes de continuar.

**Valor de la asunción, si se necesita antes de tener respuesta:** `(b) — sin filas = sin acceso`, consistente con lo que Sucursales ya construyó de facto (ver hardening 2026-08-11). **Esto no es una decisión de negocio tomada aquí** — es la opción que exige menos cambio total en el sistema si la Dueña confirma algo distinto después (ver el análisis de consecuencias ya hecho en la auditoría de pre-arranque, Sección 4D).

---

## 5. `drizzle.config.ts` — nota para cuando inicie la implementación

**No se modifica en esta iteración** — el esquema `identidad_accesos` todavía no existe en código, y modificar `schemaFilter` antes de que exista el primer archivo de esquema no tiene efecto verificable (sería un cambio sin forma de probarlo). Nota dejada aquí para no perderla:

```ts
// drizzle.config.ts — cuando exista src/database/schema/identidad-accesos.schema.ts:
schemaFilter: ['sucursales_personal', 'auditoria', 'identidad_accesos'],
```

Sin este cambio, `npm run db:generate` no generará migraciones para el nuevo esquema — fallo silencioso fácil de no notar (no un error, simplemente "no genera nada nuevo").

---

## 6. Preguntas abiertas explícitas que esta iteración NO resuelve

Ninguna de estas se decide en este documento ni en `ADR-024` — se listan para que la siguiente iteración no las redescubra desde cero:

1. **¿El caso de uso de desactivación debe llamar a la Admin API de Supabase de forma síncrona (bloqueando la respuesta HTTP) o asíncrona (vía Outbox/evento)?** `IMPLEMENTATION_MASTER_PLAN.md` §2 (principio 1) sugiere que Outbox nace "la primera vez que un módulo real lo necesita" — desactivación de usuario con revocación real en Supabase podría ser exactamente ese primer caso, antes de lo que el roadmap original anticipaba (que lo esperaba recién en Agenda). No se decide aquí.
2. **¿Se requiere revocación instantánea real** (no acotada a la vida del access token) **para el escenario de desactivación por incidente de seguridad?** Si la respuesta es sí, reabre el modelo de tokens de `ADR-010` — señalado, no resuelto.
3. **¿Dónde vive exactamente la función Postgres del Custom Access Token Hook** — dentro de `identidad_accesos` o en un esquema transversal dedicado? `ADR-005` (sin FKs cruzadas) no impide una función en un esquema que haga `SELECT` a otro, pero no hay una convención ya establecida para "funciones transversales" en este proyecto. Menor, pero pendiente.
4. **Verificación contra el proyecto Supabase real** de todo lo que `ADR-024` marca como "documentado públicamente, no verificado" — es la condición de entrada real antes de escribir el primer caso de uso de emisión de sesión.
