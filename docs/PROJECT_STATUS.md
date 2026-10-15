# PROJECT_STATUS — Blanc

> **Qué responde este documento:** *"¿Dónde está el proyecto ahora?"* — una sola fuente para saber qué está implementado, qué está pendiente, qué está en auditoría, y qué decisiones siguen abiertas, cerradas, diferidas, rechazadas o fuera de alcance, sin tener que reconstruirlo leyendo cada handoff de cada iteración.
> **Qué NO es:** no reemplaza a ningún documento existente — los referencia y resume, no los duplica. No es un ADR, no es el Decision Log de negocio, no es un Decision Flow, no es un handoff de iteración. Ver §1 para la responsabilidad exacta de cada uno.
> **Cómo mantenerlo:** cada vez que una iteración implemente, cierre, difiera o descarte algo, se actualiza este documento en la misma iteración — nunca se deja para "después". Las decisiones históricas nunca se borran, se marcan `SUPERSEDED`/`REPLACED` con la fecha y la decisión vigente (§5).
> **Fecha de creación:** 2026-08-23. **Última verificación contra el repositorio real:** 2026-08-23, cuarta pasada — `DEC-025` cerrada (Solo Provisionar), checklist operacional completo preparado para el cierre de `DEC-001` (155/155 tests, 28 suites, `tsc`/`nest build`/ESLint limpios, `madge` 0 ciclos — ver §2 y §10).

---

## 1. Quién responde qué (para no duplicar información)

| Documento | Responde | Vigente para |
|---|---|---|
| **`PROJECT_STATUS.md`** (este documento) | ¿Dónde está el proyecto ahora? Estado consolidado, decisiones con historial, riesgos, dependencias, qué falta para entrega | Todo el proyecto, todo el tiempo |
| `docs/decision-flows-catalogo-diseno.md` | ¿Qué flujos (Decision Flows) existen y cuál es su estado de diseño/negocio? | Catálogo de flujos — este documento **cita** su estado de implementación, no lo redefine |
| `docs/OWNER_DECISION_LOG.md` | ¿Qué decisiones de producto/negocio (de la Dueña) siguen abiertas o se cerraron? | Decisiones de negocio — este documento **referencia** sus preguntas, nunca las duplica ni las cierra |
| `docs/architecture/adr/ADR-*.md` | ¿Por qué se adoptó esta decisión técnica/arquitectónica, con qué alternativas se comparó? | Decisiones técnicas — este documento cita el número de ADR, no repite su razonamiento |
| Handoffs de iteración (mensajes de cierre de cada sesión, no archivos separados en este proyecto) | ¿Qué ocurrió exactamente durante una iteración concreta? | Historial operativo — este documento consolida sus conclusiones, no su detalle línea por línea |
| `docs/ARCHITECTURE_CLOSURE_PLAN.md` | ¿Qué falta para declarar la arquitectura general (no solo Identidad) formalmente cerrada? | Pendientes P1-P10 de arquitectura general — este documento no los duplica, solo referencia su estado en §9 |
| `docs/architecture/04-data-model.md` | ¿Cuál es el modelo de datos real, columna por columna, con su justificación? | Fuente de verdad del esquema — este documento resume qué tablas existen, no las columnas |
| `HANDOFF.md` / `ARCHITECTURE-HANDOFF.md` / `DESIGN-PHASE-HANDOFF.md` (raíz del repo) | Snapshot de cierre de la **fase de diseño** (2026-07-13/15), antes de que existiera código | **Históricos, superados por la realidad de implementación** — no se actualizan, no se leen como estado actual. `PROJECT_STATUS.md` es su sucesor funcional para todo lo posterior al inicio de implementación |

---

## 2. Estado real verificado del código (2026-08-23)

Verificado directamente contra el repositorio, no tomado de un handoff anterior sin confirmar:

- **155/155 tests, 28 suites.** `tsc --noEmit` limpio. `nest build` limpio. ESLint limpio. `madge --circular`: 0 ciclos, 103 archivos.
  - **Actualización 2026-09-14 (cierre de FL-COT-01, partes 1-4 — flujo COMPLETO):** **407/407 tests, 43 suites**; `tsc --noEmit`, `nest build`, ESLint limpios; `madge --circular`: 0 ciclos, **153 archivos**.
- Dos módulos de negocio implementados y cableados en `app.module.ts`: **Sucursales y Personal** (completo, endurecido) e **Identidad y Accesos** (parcial, alcance mínimo por incremento — ver §4).
  - **Actualización 2026-09-14:** son **tres** — se agregó **Catálogo y Cotización** (`CatalogoYCotizacionModule`, cableado en `app.module.ts` **sin controladores**; ver §13).
- Cero dependencias `@supabase/*` en `package.json` — ninguna integración real o simulada con Supabase existe en código todavía.

---

## 3. Terminología de estados — equivalencias

Este proyecto ya usaba varios vocabularios de estado en distintos documentos (`Abierta`/`Resuelta` en `OWNER_DECISION_LOG.md`; `Abierto`/`Resuelto` en `ARCHITECTURE_CLOSURE_PLAN.md`; `CLOSED`/`ARCHITECTURE DECISION REQUIRED`/etc. en las auditorías de esta sesión). No se reemplaza ninguno — se establece la equivalencia:

| Estado en `PROJECT_STATUS.md` | Significa | Equivalente en otros documentos del proyecto |
|---|---|---|
| `OPEN` | Decisión identificada, sin resolver todavía | `Abierta` (`OWNER_DECISION_LOG.md`), `Abierto` (`ARCHITECTURE_CLOSURE_PLAN.md`), `ARCHITECTURE/BUSINESS/SECURITY DECISION REQUIRED` |
| `CLOSED` | Decisión tomada y confirmada explícitamente | `Resuelto`/`Resuelta`, `Aprobada` (Business Rules) |
| `IMPLEMENTED` | Existe en código, con tests pasando, verificado | (nuevo — no existía un estado de código en los documentos de decisión) |
| `IN_PROGRESS` | En construcción activa en la iteración actual | — (ninguno activo ahora mismo, ver §4) |
| `AUDIT_REQUIRED` | Se está verificando evidencia antes de decidir/implementar | Fase de auditoría previa a cada `FL-SEG-*` en esta sesión |
| `DEFERRED` | Pospuesto deliberadamente a una fase/flujo posterior, con razón explícita | "Fuera de esta iteración", "pertenece a `FL-SEG-XX`" |
| `REJECTED` | Alternativa evaluada y descartada, con evidencia de por qué | "Se descarta", "no se implementa" (`ADR-024`) |
| `OUT_OF_SCOPE` | Nunca estuvo en el alcance del incremento en cuestión — no es lo mismo que `DEFERRED` (que implica intención futura) | "No aplica a este flujo" |
| `ACCEPTED_RISK` | Riesgo conocido, evaluado, aceptado conscientemente — no es un bug | "Riesgo aceptado deliberadamente" (`ARCHITECTURE_CLOSURE_PLAN.md` ya usa esta frase) |
| `BLOCKED` | No puede avanzar sin que algo (interno al proyecto: autorización, decisión) se resuelva primero | "Requiere autorización explícita" |
| `REQUIRES_EXTERNAL_ACCESS` | No puede verificarse ni cerrarse sin acceso/configuración a un sistema externo (Supabase real) — distinto de `BLOCKED`: aquí no falta una decisión del proyecto, falta infraestructura externa fuera del control de este repositorio | "Requiere acceso real a Supabase", "no verificado contra el proyecto real" (nuevo, introducido en la auditoría de preparación de `FL-SEG-06`, 2026-08-23) |
| `REQUIRES_REDESIGN` | Ya existe evidencia real (no falta acceso externo) que invalida una premisa del diseño original — no es "aprobar o rechazar tal cual", es que el diseño propuesto necesita ampliarse/corregirse antes de poder aprobarse | (nuevo, introducido 2026-08-25 tras verificar que `ADR-024` asumía HS256 y el proyecto real usa ES256/JWKS — ver `DEC-001`) |
| `SUPERSEDED` / `REPLACED` | Una decisión o recomendación anterior fue reemplazada por una más reciente — se conserva el historial, no se borra | (nuevo — necesario porque ya ocurrió al menos una vez, ver DEC-012) |

---

## 4. Estado consolidado por flujo (Identidad y Accesos)

| Flow ID | Nombre | Estado | Endpoint(s) | Notas |
|---|---|---|---|---|
| `FL-SEG-01` | Alta de Usuario Interno y Rol | **IMPLEMENTED**, alcance mínimo | `POST /usuarios` | Sin Supabase, sin sucursales al crear |
| `FL-SEG-02` | *(Verificar Permiso de Rol — histórico)* | **OUT_OF_SCOPE** (excluido del catálogo desde `decision-flows-revision-critica.md`) | — | Es mecanismo técnico de `ADR-010`, no un flujo de negocio — nunca se implementa como tal |
| `FL-SEG-03` | Editar Usuario / Cambiar Rol | **IMPLEMENTED**, alcance mínimo | `PATCH /usuarios/:id` | Reglas de auto-escalamiento y jerarquía Super Admin implementadas |
| `FL-SEG-04` | Asignar / Remover Usuario de Sucursal | **IMPLEMENTED**, alcance mínimo | `POST`/`DELETE /usuarios/:id/sucursales/:sucursalId` | Único flujo de Identidad con nivel 2 (`tieneAlcanceSucursal`) implementado hasta ahora |
| `FL-SEG-05` | Desactivar Usuario | **IMPLEMENTED**, solo desactivación administrativa | `POST /usuarios/:id/desactivar` | **`activa=false` NO revoca acceso efectivo todavía** — ver `ACCEPTED_RISK` en §8. Sin "reactivar" (`DEFERRED`, ver DEC-011) |
| `FL-SEG-06` | Invitar / Sincronizar Usuario con Supabase Auth | **NOT_IMPLEMENTED** — alcance del primer incremento **CLOSED** (`DEC-025`, 2026-08-23): **Solo Provisionar**. Independiente del hallazgo JWT/ES256 (usa Admin API + Service Role Key, no pasa por `JwtAuthGuard`) — ver §10, `DEC-026` (`IMPLEMENTED`) | — | Sin Rule ID de negocio que lo respalde (es un flujo técnico, ver `decision-flows-catalogo-diseno.md` nota d). Es la dependencia crítica para que `activa=false` tenga efecto real. **Nota (2026-09-14, actualizada):** `JwtAuthGuard` ya puede verificar JWT ES256 reales (`DEC-026`, implementado). Para que un usuario final quede **autorizado** falta: (a) `FL-SEG-06` en sí, que crea el vínculo `supabase_user_id`; y (b) la capa de autorización de **`DEC-029` (C2)**, que sustituye al Custom Access Token Hook — `rol`/`sucursales` ya **no** vendrán en el JWT, se leerán de PostgreSQL. `DEC-001` quedó `SUPERSEDED` |
| `FL-SEG-07` | Exigir / Verificar MFA | **NOT_IMPLEMENTED** | — | Respaldado por `RN-SEG-02` (Aprobada), mecanismo concreto depende de Supabase (`FL-SEG-06`) |

**Verificado contra código real, no asumido:** los 5 archivos de casos de uso existentes en `src/modules/identidad-y-accesos/application/use-cases/` son exactamente `crear-usuario`, `editar-usuario-cambiar-rol`, `asignar-usuario-a-sucursal`, `remover-usuario-de-sucursal`, `desactivar-usuario` — ninguno más. No existe `activar-usuario.use-case.ts` ni ningún adapter de Supabase.

**Módulo Sucursales y Personal:** `IMPLEMENTED`, completo y endurecido (hardening transversal 2026-08-11) — no tiene flujos pendientes de esta naturaleza. Su única deuda registrada es la inconsistencia de nivel 2 en `AsignarManicuristaASucursalUseCase`/`RemoverManicuristaDeSucursalUseCase` (ver DEC-014).

---

## 5. Registro de decisiones con historial (`DEC-XXX`)

> Ninguna entrada se borra cuando cambia de estado — se agrega un nuevo evento al historial, conservando el anterior.

### DEC-001 — Mecanismo de claims personalizados de Supabase (Custom Access Token Hook)
**Estado actual:** `SUPERSEDED` por `DEC-029` (C2), 2026-09-14. **El Custom Access Token Hook NO se implementará.** El problema que esta decisión intentaba resolver —cómo llegan `rol` y `sucursales` a la capa de autorización— queda resuelto por otro mecanismo: consultar PostgreSQL de Blanc en cada request en lugar de incrustar esos datos en el JWT. Esta entrada se conserva íntegra como registro de la evaluación; su historial no se reescribe.
**Estado anterior:** `REQUIRES_REDESIGN` (2026-08-25) → antes `OPEN`/`REQUIRES_EXTERNAL_ACCESS` (2026-08-11)
**Historial:**
- 2026-08-11: Se investigó documentación pública de Supabase (Custom Access Token Hook) y se recomendó como mecanismo, documentado en `ADR-024`. `ADR-024` queda `Proposed`, con salvedad explícita de que el mecanismo **no está verificado contra el proyecto Supabase real de Blanc**.
- 2026-08-23 (auditoría de preparación `FL-SEG-06`): reconfirmado explícitamente que **NO se marca `IMPLEMENTED`** — nada en el código lo usa ni lo asume. Permanece `OPEN`/`REQUIRES_EXTERNAL_ACCESS` hasta que se verifique contra el proyecto real (disponibilidad de Auth Hooks en el plan contratado, comportamiento real en `token_refresh`) y se apruebe formalmente `ADR-024`. No se cierra por instrucción explícita — es condición de entrada, no un paso ya dado.
- 2026-08-23 (segunda auditoría, mismo día — intento explícito de verificación contra Supabase real): se buscó activamente acceso real al proyecto Supabase de Blanc desde este entorno — sin herramientas MCP de Supabase registradas (`ToolSearch` sin resultados), sin CLI de Supabase instalado (`which supabase` sin resultado), sin variables de entorno `SUPABASE_*` en el shell, sin archivo `.env` real (solo `.env.example` con placeholders), sin ningún directorio `supabase/config.toml` en el repositorio. **Conclusión: cero acceso real, no parcial — ninguno de los 11 puntos de verificación solicitados pudo comprobarse.** No hay evidencia nueva que permita mover esta decisión en ninguna dirección — se reconfirma `OPEN`/`REQUIRES_EXTERNAL_ACCESS`, sin cerrar ni recomendar rediseño, porque no cerrar tampoco tiene evidencia que lo sustente (no se encontró ninguna limitación que invalide `ADR-024`, tampoco ninguna confirmación de que sea viable). Clasificación explícita: **(B) mantener OPEN** — ni (A) aprobar ni (C) rediseñar, por ausencia total de evidencia en cualquier sentido.
- 2026-08-23 (tercera auditoría — cierre de `DEC-025`, `FL-SEG-06` acotado a "Solo Provisionar"): **`DEC-001` NO se cierra por consecuencia del cierre de `DEC-025`.** Ambas decisiones son independientes: `DEC-025` fija qué caso de uso se construye (Provisionar), `DEC-001` fija cómo los claims llegan al JWT en general — un principio transversal a cualquier login/refresh del sistema, no específico del caso de uso de provisión. Cerrar el alcance de qué se provisiona no aporta ninguna evidencia sobre si el Custom Access Token Hook está disponible en el plan de Supabase de Blanc. Se preparó en esta misma iteración una checklist operacional completa (§10.6/§10.7) para cuando exista acceso real — explícitamente, sin ejecutar ninguna de sus verificaciones todavía. Permanece **`OPEN` / `REQUIRES_EXTERNAL_ACCESS`**, sin excepción.
- **2026-09-14 (cierre — SUPERSEDED por `DEC-029`):** tras la auditoría arquitectónica de alternativas (ver `DEC-029` para el análisis completo), se descarta el Custom Access Token Hook como mecanismo. **Motivo:** el hook existe únicamente para *copiar* al JWT unos datos cuya fuente de verdad ya es PostgreSQL de Blanc (`DEC-024`), y esa copia empieza a envejecer en el instante en que se emite — con `access token expiry = 3600s` confirmado, hasta una hora de exposición con permisos ya revocados. Consultar la fuente de verdad directamente elimina la clase de problema en vez de acotarla. Se suman tres razones: (a) el hook acopla la autorización de Blanc a un mecanismo propietario de Supabase y obliga a que las tablas de Blanc vivan en su PostgreSQL; (b) partiría la lógica de autorización en dos lenguajes (SQL dentro de Supabase + TypeScript en Blanc), fuera del alcance de la suite de tests del repositorio; (c) su comportamiento en `token_refresh` nunca pudo verificarse contra este proyecto — seguía siendo `REQUIRES_EXTERNAL_ACCESS` indefinidamente. **Nada de lo evaluado en esta entrada se borra:** el análisis del hook sigue siendo válido como registro de por qué se consideró y por qué no se construye. Si en el futuro apareciera una necesidad real de claims embebidos (por ejemplo, un consumidor externo que deba autorizar sin consultar a Blanc), esta decisión se revisita entonces, no antes. La Decisión 1 de `ADR-024` queda igualmente superada por `DEC-029`; `ADR-024` no se reescribe.
- 2026-08-24/25 (verificación real del proyecto Supabase de Blanc, `<PROJECT_REF>`, Plan Pro): el cliente verificó directamente en el Dashboard — Custom Access Token Hook **disponible** en el plan; clave de firma `CURRENT` = **ECC P-256 (ES256)**; clave `PREVIOUSLY USED` = Legacy HS256; `access token expiry` = 3600s; ningún hook creado, ninguna configuración modificada. Confirmado empíricamente contra el código (`backend/src/shared/auth/jwt-auth.guard.ts:50`) que `jwt.verify(token, this.jwtSecret)` con un secreto de texto plano **rechaza** un JWT ES256 real (`JsonWebTokenError: invalid algorithm`) y acepta HS256 — reproducido con un script Node aislado, no asumido. Confirmado además, vía los endpoints públicos y no autenticados del proyecto (`/.well-known/openid-configuration`, `/.well-known/jwks.json`, ambos consultados de solo lectura sin modificar nada): `issuer` real = `https://<PROJECT_REF>.supabase.co/auth/v1`; `jwks_uri` real = `https://<PROJECT_REF>.supabase.co/auth/v1/.well-known/jwks.json` (confirma que se puede derivar de `SUPABASE_URL`, sin variable independiente); el JWKS publicado contiene exactamente una clave (`kid: 0dd96720-c81d-4406-a2de-fe6bed0f4cd8`, ES256/P-256) — sin ninguna clave HS256 (estructuralmente imposible para una clave simétrica). **Esto invalida la premisa central de la Decisión 1 de `ADR-024`** (que asumía HS256 vigente) sin invalidar la Decisión 1 en sí (el mecanismo del hook sigue siendo válido, es ortogonal al algoritmo de firma). **Reclasificado de `OPEN`/`REQUIRES_EXTERNAL_ACCESS` a `REQUIRES_REDESIGN`** — ya no falta acceso externo (se obtuvo), falta ampliar el diseño. Diseño de rediseño propuesto y aprobado conceptualmente por el cliente: ver `DEC-026`. `audience` real del JWT de sesión queda sin confirmar — ver `DEC-027`.

### DEC-002 — Modelo de permisos: `Rol` enum estático vs. tabla dinámica
**Estado actual:** `CLOSED`
**Historial:**
- 2026-08-11: Se evaluaron ambas opciones (`ADR-024`) con análisis criterio por criterio. Se confirma el `Rol` enum estático — sin evidencia de necesidad de permisos configurables en runtime. La tabla `permisos` de `04-data-model.md` queda marcada `No implementada`, no se elimina del documento.

### DEC-003 — `refresh_tokens` propia vs. delegada a Supabase
**Estado actual:** `CLOSED`
**Historial:**
- 2026-08-11: Se confirma no construir tabla propia — Supabase Auth ya cubre rotación/revocación nativamente (`ADR-024`), verificado contra documentación pública, no contra el proyecto real.

### DEC-004 — Autorización nivel 2 (`tieneAlcanceSucursal`) en `FL-SEG-04`
**Estado actual:** `CLOSED`
**Historial:**
- 2026-08-22: Confirmado explícitamente por el cliente — se aplica sobre la sucursal objetivo, para asignar y remover, incluida auto-asignación. Implementado y probado.

### DEC-005 — Autorización nivel 2 en `FL-SEG-01`/`FL-SEG-03`
**Estado actual:** `OUT_OF_SCOPE` (no `OPEN` — se determinó que estos flujos no operan sobre ninguna sucursal específica, por lo que la pregunta no aplica, no que se haya diferido)
**Historial:**
- 2026-08-22: Auditoría determinó que ni alta ni edición de usuario tocan `sucursales` — la pregunta de nivel 2 no es aplicable a este alcance, a diferencia de `FL-SEG-04`.

### DEC-006 — Auto-escalamiento de rol / jerarquía Super Admin en `FL-SEG-03`
**Estado actual:** `CLOSED`
**Historial:**
- 2026-08-22: Confirmadas 3 reglas: nadie cambia su propio rol; solo Super Admin asigna Super Admin; un no-Super-Admin no puede cambiar el rol de un Super Admin. Implementadas en `puedeAsignarRol()` (`shared/auth/rol.ts`).

### DEC-007 — Invariante "al menos un Super Admin activo"
**Estado actual:** `DEFERRED` / `ACCEPTED_RISK`
**Historial:**
- 2026-08-22: Evaluado, recomendado, **explícitamente no implementado** por instrucción del cliente hasta contar con confirmación formal. Sin evidencia documental previa de que sea un requisito — se trata como riesgo aceptado, no como decisión de negocio inventada.

### DEC-008 — Campo `activa: boolean` vs. `estado` de texto en `FL-SEG-05`
**Estado actual:** `CLOSED`
**Historial:**
- 2026-08-23: Se descarta el enum de 3 valores (`activo`/`inactivo`/`suspendido`) que una edición anterior de `04-data-model.md` había propuesto sin respaldo — ningún documento fija más de dos valores. Se confirma `activa: boolean`, mismo patrón que `Manicurista.activa`.

### DEC-009 — Protección de Super Admin al desactivar (`FL-SEG-05`)
**Estado actual:** `CLOSED`
**Historial:**
- 2026-08-23: Confirmado — un actor no-Super-Admin no puede desactivar a un usuario cuyo rol actual es Super Admin. Mismo criterio que DEC-006, aplicado sin una función compartida (solo un llamador hoy).

### DEC-010 — Auto-desactivación
**Estado actual:** `CLOSED`
**Historial:**
- 2026-08-23: Confirmado — bloqueada, por prevención de bloqueo administrativo accidental (no es una medida anti-escalamiento, es anti-lockout — distinción explícita del cliente).

### DEC-011 — "Reactivar usuario" en `FL-SEG-05`
**Estado actual:** `DEFERRED`
**Historial:**
- 2026-08-22: El nombre del propio `Flow ID` en el catálogo ("Desactivar / Reactivar Usuario") sugería ambas direcciones.
- 2026-08-23: Auditoría encontró tensión de evidencia — el precedente real de código (`Manicurista`) solo construyó "desactivar", nunca "activar", pese a que la entidad soporta ambos. El cliente confirma: reactivación queda fuera de esta iteración, documentada como pendiente en el catálogo (nota h), no resuelta a favor de ninguna interpretación.

### DEC-012 — Llamar a Supabase (`admin.signOut`) dentro de `FL-SEG-05`
**Estado actual:** `SUPERSEDED`
**Historial:**
- 2026-08-11: `IDENTIDAD_PRE_ARRANQUE.md` §3 recomendó que el caso de uso de desactivación llamara a `admin.signOut` de Supabase como parte del mismo flujo.
- 2026-08-23: **Superada explícitamente por el cliente** — `FL-SEG-05` implementado NO toca Supabase; esa integración queda íntegramente en `FL-SEG-06`. La recomendación de 2026-08-11 se conserva en `IDENTIDAD_PRE_ARRANQUE.md` con nota de corrección, no se borra. **La decisión vigente es la de 2026-08-23**, no la anterior — no debe volver a proponerse.
- 2026-08-23 (segunda pasada, auditoría de preparación `FL-SEG-06`): se detectó que **`ADR-024` mismo** (línea ~89, sección "Options Considered — Pregunta 3") todavía describía este comportamiento superado, sin nota de corrección — una discrepancia real entre un ADR y esta misma entrada `DEC-012`. Corregido agregando una "Nota de corrección (2026-08-23)" al ADR (mismo patrón ya usado en ese documento para su nota de implementación del 2026-08-22: se agrega, no se reescribe el texto original), que remite explícitamente aquí. Ver §12 (discrepancias) para el detalle completo de esta corrección.

### DEC-013 — Idempotencia de desactivar un usuario ya desactivado
**Estado actual:** `CLOSED`
**Historial:**
- 2026-08-23: Confirmado no-op exitoso (204), no `ConflictoDeNegocioError`. Sin precedente directo previo; decisión tomada explícitamente para esta iteración.

### DEC-014 — Inconsistencia de nivel 2 en `AsignarManicuristaASucursalUseCase`/`RemoverManicuristaDeSucursalUseCase`
**Estado actual:** `BLOCKED` (identificada, no corregida, esperando autorización explícita)
**Historial:**
- 2026-08-22: Detectada durante la auditoría de `FL-SEG-04` — ambos casos de uso de Sucursales y Personal comparten el mismo riesgo que motivó el nivel 2 de `FL-SEG-04`, pero nunca lo implementaron.
- 2026-08-22/23: Confirmado en dos iteraciones sucesivas que NO se corrige todavía — requiere autorización explícita, fuera del alcance de las iteraciones de Identidad.

### DEC-015 — Manicurista-cuenta vs. `usuarios_sucursales` vs. recurso agendable
**Estado actual:** `OPEN` (genuinamente sin resolver, sin evidencia en ningún sentido)
**Historial:**
- 2026-08-22: Detectado como hallazgo durante la auditoría de `FL-SEG-04` — ningún documento dice si la cuenta de un usuario con rol Manicurista participa de `usuarios_sucursales` directamente o si su alcance se deriva del recurso agendable (`manicuristas_sucursales`, `RN-SEG-04`). No se ha resuelto desde entonces.

### DEC-016 — Colisión de ID `FL-SEG-02`
**Estado actual:** `CLOSED`
**Historial:**
- 2026-08-22 (dentro de la misma iteración en que se cometió): se reasignó `FL-SEG-02` (ya usado por un flujo excluido del catálogo original) a un flujo nuevo. Detectado por autorevisión antes de implementar, corregido renumerando `FL-SEG-03..07`, documentado con nota de corrección explícita en `decision-flows-catalogo-diseno.md`.

### DEC-017 — Pregunta 11: alcance por defecto de `usuarios_sucursales`
**Estado actual:** `OPEN` — decisión de negocio, pertenece a la Dueña
**Historial:** ver `OWNER_DECISION_LOG.md`, Pregunta 11, para el historial completo — no se duplica aquí. Confirmado repetidamente durante esta sesión (auditorías de `FL-SEG-01/03/04`) que sigue abierta y que **no bloquea empezar** ningún flujo de Identidad, solo bloquea cerrar el modelo de permisos completo.

### DEC-018 — `JWT_SECRET` sin fallback inseguro
**Estado actual:** `CLOSED`
**Historial:**
- 2026-08-11: Detectado como Blocker #3 de la auditoría de pre-arranque. Implementado `resolverJwtSecret()` — falla duro fuera de `NODE_ENV=test`, sin secreto conocido hardcodeado.

### DEC-019 — Mecanismo `@Public()` para el guard global
**Estado actual:** `CLOSED`
**Historial:**
- 2026-08-11: Detectado como Blocker #2. Implementado con `Reflector`, probado con los dos casos exigidos (endpoint público vs. no público).

### DEC-020 — Duración exacta del access token
**Estado actual:** `OPEN` / `DEFERRED`
**Historial:**
- 2026-08-11: Ningún documento fija un valor. Se propuso 15 minutos como cifra provisional (mismo tratamiento que los SLOs de `03-technical-architecture.md` §6.3) — **nunca configurada ni verificada contra el proyecto Supabase real**. Sigue sin cerrarse.

### DEC-021 — Columna de correlación Blanc ↔ Supabase Auth
**Estado actual:** `CLOSED` (decisión técnica de forma/nombre — la columna NO está implementada todavía, ver `OUT_OF_SCOPE` §6)
**Historial:**
- 2026-08-23 (preparación `FL-SEG-06`): se confirma `supabase_user_id UUID UNIQUE NULLABLE` en `identidad_accesos.usuarios`. Verificado sin evidencia contradictoria: `identidad-accesos.schema.ts` línea 7 ya anticipaba este nombre exacto en un comentario desde que se creó el schema (2026-08-22), sin que nadie lo objetara desde entonces. `NULLABLE` porque usuarios administrativos ya existentes (creados por `FL-SEG-01`) no tienen todavía cuenta de Supabase — la vinculación es posterior (ver DEC-025, distinción Provisionar/Sincronizar). Decisión puramente técnica (nombre/tipo de columna), no requiere al owner. **No se crea la columna en esta iteración** — es una decisión de diseño registrada para cuando `FL-SEG-06` se implemente.

### DEC-022 — Integración `FL-SEG-06`: síncrona vs. Outbox
**Estado actual:** `CLOSED`
**Historial:**
- 2026-08-23 (auditado como "Decision Candidate 2" en la auditoría de preparación previa, confirmado explícitamente en esta iteración): `FL-SEG-06` comenzará con integración **síncrona** (la llamada a Supabase ocurre dentro del mismo request HTTP). Razón registrada: menor superficie arquitectónica, consistente con el principio de costo operativo vigente (no introducir Outbox antes de que exista una necesidad real demostrada). Reevaluar únicamente si aparecen problemas reales de disponibilidad/reintentos/consistencia una vez en operación — no se construye Outbox de forma preventiva.

### DEC-023 — Convención de nombres de variables de entorno para la Admin API de Supabase
**Estado actual:** `CLOSED` (convención de nombres — los valores reales NO se agregan en esta iteración)
**Historial:**
- 2026-08-23: se adoptan `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como convención, siguiendo el nombrado estándar del SDK oficial de Supabase (minimiza fricción si se adopta ese SDK más adelante). Verificado sin evidencia contradictoria en `.env.example` ni en ningún código — no existía ninguna convención previa que estos nombres pisen. **No se agregan a `.env.example` en esta iteración** (sin secretos ni placeholders nuevos — ver §11).

### DEC-024 — Fuente de verdad de autorización: Blanc PostgreSQL, no el JWT
**Estado actual:** `CLOSED` (principio arquitectónico — no depende de verificar Supabase real)
**Historial:**
- 2026-08-23: se formaliza explícitamente lo que `ADR-010`/`ADR-024` ya asumían sin nombrarlo así: `identidad_accesos` en PostgreSQL (Blanc) es la única fuente de verdad de identidad administrativa, rol, `activa` y asignaciones de sucursal. Supabase Auth es proveedor de autenticación (credenciales, emisión de tokens, refresh/revocación según el mecanismo que finalmente se apruebe) — nunca fuente de verdad de esos atributos. **El JWT es un snapshot firmado, no una fuente de datos administrativos** — vigente solo hasta su próxima renovación/expiración. Esta decisión es independiente de si el Custom Access Token Hook específico (`DEC-001`) se aprueba o no — es válida para cualquier mecanismo de sincronización que se elija. **No se cierra el mecanismo concreto** (`DEC-001` permanece `OPEN`/`REQUIRES_EXTERNAL_ACCESS`) — solo el principio de qué sistema manda.

### DEC-025 — Alcance de `FL-SEG-06`: Provisionar vs. Sincronizar
**Estado actual:** `CLOSED` — **Decisión: (A) Solo Provisionar**
**Historial:**
- 2026-08-23: se formaliza la distinción entre (A) **Provisionar** — crear/invitar una cuenta nueva de Supabase para un usuario administrativo que ya existe en Blanc (el caso de un alta reciente vía `FL-SEG-01`, todavía sin cuenta de acceso) — y (B) **Sincronizar** — vincular un usuario de Blanc ya existente con una cuenta de Supabase que también ya existe (o se crea en el mismo paso), reconciliando ambos lados. Ambas comparten la misma columna de correlación (`DEC-021`) pero son operaciones distintas con disparadores y casos de fallo distintos (`IDENTIDAD_PRE_ARRANQUE.md` §2 documenta 5 escenarios de fallo, algunos específicos de cada una). **No se decide aquí cuál (o ambas) entra en el primer incremento de implementación de `FL-SEG-06`** — queda explícitamente abierto hasta la siguiente iteración de alcance mínimo confirmado, siguiendo el mismo patrón usado para `FL-SEG-01` a `FL-SEG-05`.
- 2026-08-23 (segunda auditoría, análisis con evidencia — decisión sigue sin tomarse, solo se documenta el análisis): verificado en código (`usuarios.controller.ts`, `crear-usuario.use-case.ts`) que `FL-SEG-01` (`POST /usuarios`, ya implementado) crea el registro administrativo en Blanc **sin ninguna llamada a Supabase**, restringido a `SUPER_ADMIN`/`ADMINISTRADOR`, sin endpoint de auto-registro público en ningún lugar del sistema. Esto establece un hecho estructural, no hipotético: **todo usuario creado desde que `FL-SEG-01` existe (2026-08-22) ya está, por construcción, en el estado que "Provisionar" resolvería** (registro Blanc sin cuenta Supabase) — no existe ningún camino en el código actual que produzca el estado inverso (cuenta Supabase sin registro Blanc, o cuenta Supabase creada independientemente que necesite "Sincronizarse"), porque no hay ningún flujo de auto-registro ni de creación directa en Supabase fuera de Blanc. **Análisis de las 3 opciones, sin elegir:**
  - **(A) Solo Provisionar** — caso de uso que toma un `usuario.id` de Blanc ya existente sin `supabase_user_id`, invita/crea la cuenta en Supabase Admin API, y persiste el `supabase_user_id` devuelto. Endpoint plausible: `POST /usuarios/:id/provisionar-acceso` (o equivalente), separado de `POST /usuarios` para mantener reintentable/idempotente sin reabrir `FL-SEG-01`. Resuelve directamente el backlog estructural ya confirmado arriba. Riesgo principal: los 5 escenarios de fallo de `IDENTIDAD_PRE_ARRANQUE.md` §2 aplican igual, pero acotados a un único sentido de la operación.
  - **(B) Solo Sincronizar** — caso de uso que vincula un `usuario.id` de Blanc con un `supabase_user_id` que se asume ya existente (manualmente aportado, o descubierto vía un mecanismo no construido — webhook, búsqueda por email en Supabase, etc.). **No tiene ningún disparador real hoy**: nada en el sistema crea cuentas de Supabase de forma independiente, por lo que no existe ningún caso concreto que esta opción, sola, resolvería en el estado actual del código. Riesgo principal: construir esta capacidad sola sería infraestructura especulativa (`IMPLEMENTATION_MASTER_PLAN.md` principio 1) — resuelve un escenario sin evidencia de que ocurra.
  - **(C) Provisionar + Sincronizar** — cubre ambos, incluye el mecanismo de reconciliación que `IDENTIDAD_PRE_ARRANQUE.md` §2 explícitamente señala como "no diseñado aquí... exactamente el tipo de infraestructura especulativa que el principio 1 prohíbe construir antes de tener evidencia de que el problema ocurre con frecuencia real". Mayor superficie, mayor cobertura, pero construye una capacidad (B) sin evidencia de necesidad todavía.
  - **Recomendación técnica únicamente (alcance mínimo, no decisión):** **(A) Solo Provisionar** es el incremento mínimo coherente con la arquitectura y el código ya construidos — es la única opción con un disparador estructural ya confirmado en el repositorio (el backlog de `FL-SEG-01`), consistente con `DEC-022` (síncrono, superficie mínima) y con el principio de costo operativo vigente. (B) no tiene caso de uso real que resolver hoy; (C) construiría (B) sin esa evidencia. **Esta es una recomendación técnica — la decisión final de alcance corresponde al owner**, incluida la posibilidad explícita de que se prefiera construir (C) de una vez por razones de negocio no visibles desde el código (p. ej. planeación de una futura vía de registro externo) — esa evaluación no puede hacerse desde este repositorio.
- **2026-08-23 (cierre formal):** **confirmado explícitamente por el cliente: (A) Solo Provisionar.** Alcance del primer incremento de `FL-SEG-06`, registrado sin ambigüedad: crear/invitar/vincular una cuenta de Supabase Auth para un usuario que **ya existe** en `identidad_accesos.usuarios` (coincide exactamente con la recomendación técnica de la entrada anterior — el cliente no se apartó de ella, la ratificó). **Explícitamente excluido de este incremento, registrado para que no se reintroduzca por inercia:**
  - Sincronización de cuentas de Supabase creadas independientemente de Blanc (Opción B, sin disparador real — ver análisis arriba).
  - Importación de usuarios desde Supabase hacia Blanc (dirección inversa a "Provisionar" — no evaluada porque no fue parte de ninguna opción A/B/C original).
  - Reconciliación masiva (job/batch de cualquier tipo) — infraestructura especulativa, ya descartada en `IDENTIDAD_PRE_ARRANQUE.md` §2.
  - Sincronización bidireccional — no se decidió, no se necesita para "Provisionar".
  - Login — pertenece al ciclo de autenticación general, no al alta/provisión de la cuenta.
  - MFA — pertenece a `FL-SEG-07`, dependiente de `FL-SEG-06` pero no parte de él.
  - Outbox — ya descartado por `DEC-022` (síncrono).
  - Cambios a `FL-SEG-01`/`FL-SEG-03`/`FL-SEG-04`/`FL-SEG-05` — ninguno de los cinco casos de uso ya implementados se toca; "Provisionar" es un caso de uso nuevo y separado.
- **2026-09-13 (precisión de mecanismo, sin cambio de alcance):** el análisis del 2026-08-23 describe el flujo como *"invita/crea la cuenta en Supabase Admin API"* — formulación deliberadamente abierta en su momento, porque el mecanismo todavía no estaba elegido. **`DEC-028` lo cierra: `createUser` sin contraseña, no `inviteUserByEmail`.** El alcance de `DEC-025` no cambia; solo deja de estar indeterminado el *cómo*. El texto original no se reescribe.

### DEC-026 — Rediseño de verificación JWT: soporte ES256/JWKS con `jose`, en paralelo a HS256 legacy
**Estado actual:** `IMPLEMENTED` (2026-08-25) — código, tests unitarios y validación parcial contra el proyecto Supabase real (sin login completo, ver historial). `DEC-001` (el hook de claims en sí) **no cambia de estado por esto** — sigue `REQUIRES_REDESIGN`, es una pieza distinta.
**Historial:**
- 2026-08-25: Tras confirmar (`DEC-001`) que el proyecto real de Supabase firma con ES256/JWKS y no con HS256, se auditaron 4 alternativas (mantener HS256 legacy; migrar a ES256/JWKS; verificar vía endpoint remoto por request; híbrido) — la alternativa "verificar vía endpoint remoto" se descartó por reabrir textualmente el rechazo que `ADR-010` ya hizo de "sesión server-side pura... añade acoplamiento a un almacén de sesión para cada verificación" (línea 53 de `ADR-010`). El cliente aprobó conceptualmente la migración a ES256/JWKS, con las siguientes decisiones de diseño cerradas:
  - **Librería:** `jose` (`createRemoteJWKSet`), no una implementación propia de fetch/cache/rotación — verificado empíricamente que una implementación propia con `jsonwebtoken`+Node `crypto`/`fetch` es técnicamente posible (sin dependencia nueva), pero se prefiere `jose` por menor superficie de bug propio en una pieza de seguridad crítica (cache, rotación, protección contra refresco abusivo ya resueltos y auditados por una librería de uso masivo).
  - **Coexistencia:** ambas ramas activas — HS256 legacy (`resolverJwtSecret()`, sin tocar) y ES256/JWKS (nueva), seleccionadas exclusivamente por el header `alg`/`kid` del JWT, nunca por el contenido del payload. La rama HS256 se retira solo cuando el Dashboard de Supabase deje de mostrar una clave `PREVIOUSLY USED` — condición externa verificable, no un plazo arbitrario.
  - **`jwks_uri`:** se deriva de `SUPABASE_URL` (ya decidido en `DEC-023`), sin variable de entorno independiente — confirmado empíricamente que el patrón real es `SUPABASE_URL + /auth/v1/.well-known/jwks.json` (verificado contra el proyecto real, ver `DEC-001`).
  - **Cache/rotación:** sin TTL fijo — invalidación por evento (`kid` desconocido dispara un refresco), con protección contra refresco abusivo (cooldown), y política de last-known-good si el JWKS está temporalmente indisponible (usar el último JWKS válido en cache en vez de rechazar todo). `jose` cubre esto de forma nativa.
  - **Claims a validar en el guard:** `exp`/`nbf` — verificado empíricamente que `jsonwebtoken` ya los valida automáticamente hoy, sin ninguna opción adicional (no es una brecha, no requiere cambio). `issuer` — falta hoy (verificado que el guard no lo valida), se agrega con el valor real confirmado `https://<PROJECT_REF>.supabase.co/auth/v1`. `audience` — pendiente, ver `DEC-027`. `sub`/`rol`/`sucursales` — sin cambio.
  - **Explícitamente fuera de esta decisión:** `RolesGuard`, autorización de negocio (nivel 1/nivel 2), `FL-SEG-05`, `FL-SEG-06`/provisioning — ninguno se modifica, salvo que una dependencia técnica directa se descubra y documente explícitamente.
  - **No implementado en esta iteración** — es un cierre de diseño, no de código. `jose` no se instaló, `JwtAuthGuard` no se modificó.
- 2026-08-25 (autorización explícita de implementación): implementado íntegramente. Archivos: `shared/auth/supabase-url.ts` (nuevo — deriva `issuer`/`jwks_uri` de `SUPABASE_URL`, mismo patrón de `resolverJwtSecret()`); `shared/auth/jwt-auth.guard.ts` (reescrito — selección de rama por `alg` del header, HS256 vía `jsonwebtoken` con `algorithms`/`issuer` explícitos, ES256 vía `jose`/JWKS con las mismas restricciones, claims compartidos entre ambas ramas); `shared/auth/auth.module.ts` (construye `createRemoteJWKSet` una sola vez, con los defaults de `jose` sin overrides). **Hallazgo de implementación menor, resuelto sin cambiar la arquitectura aprobada:** `jose@6` (la versión instalada por defecto) es ESM-only (`"type": "module"`, sin condición `require`) — incompatible con el runtime CommonJS de este proyecto (Jest/`ts-jest`/NestJS), confirmado por error real (`SyntaxError: Unexpected token 'export'`). Se fijó `jose@^5.10.0` (última versión mayor con build CJS real, `exports.require` presente, API idéntica — `createRemoteJWKSet`/`jwtVerify` sin cambios) — no requirió ningún ajuste de diseño, la Decisión de usar `jose` se mantiene intacta. 27 tests nuevos/reescritos en `jwt-auth.guard.spec.ts` (incluye un servidor HTTP local real para probar la resolución de `jose` por `kid` y su refresco automático — sin mockear esa lógica), más ajustes de firma de constructor en `usuarios.e2e.spec.ts`/`sucursales.e2e.spec.ts`. **168/168 tests, `tsc`/`build`/lint/`madge` limpios.** Validación adicional contra el proyecto Supabase real (`<PROJECT_REF>`), sin credenciales, solo lectura: `resolverIssuerSupabase`/`resolverJwksUri` producen exactamente los valores reales ya confirmados en la auditoría anterior, y `createRemoteJWKSet` resuelve exitosamente la clave real por el `kid` real (`0dd96720-c81d-4406-a2de-fe6bed0f4cd8`) contra el JWKS público del proyecto. **No se ejecutó un login real** (sin credenciales de una cuenta de prueba en este entorno) — la verificación end-to-end completa (login → token real → `POST` a un endpoint de Blanc → `200`) queda pendiente, no simulada.
- **2026-09-01/09 — la salvedad de la entrada anterior queda SUPERADA: la compatibilidad real ya fue demostrada empíricamente contra el proyecto Supabase de Blanc.** La entrada del 2026-08-25 se conserva intacta como registro de lo que era cierto ese día; lo que sigue la actualiza, no la reescribe. **Origen de la evidencia:** dos pruebas de integración reales ejecutadas por el cliente en la terminal del proyecto, con el script temporal de este repositorio (`backend/src/__temp_supabase_real_integration.e2e.spec.ts`) y una cuenta de prueba creada manualmente por él en el Dashboard. Claude **no observó** credenciales, access tokens ni refresh tokens en ningún momento — solo recibió los metadatos que el script imprime y que el cliente reportó; lo que sigue es ese reporte, no una observación directa.
  - **Prueba #1 (login real):** login `PASS`; JWT real emitido por Supabase con `alg = ES256`; `kid` real resuelto contra el JWKS real; `iss` correcto (`https://<PROJECT_REF>.supabase.co/auth/v1`); `aud = authenticated` (cerró `DEC-027`); **firma ES256 verificada contra el JWKS real: `PASS`**. El token llegó a `JwtAuthGuard` y el endpoint real de Blanc respondió `401 TOKEN_SIN_ROL_VALIDO`.
  - **Prueba #2 (flujo de refresh real):** refresh HTTP `200`; access token renovado (cambió respecto al inicial); **refresh token rotado** (observado, no solo asumido desde `ADR-024`/`DEC-003`); el JWT renovado conserva `ES256`, `kid` válido, `iss` correcto y `aud = authenticated`; **firma del token renovado verificada contra el JWKS real: `PASS`**; el token renovado llegó al mismo endpoint real de Blanc, que respondió otra vez `401 TOKEN_SIN_ROL_VALIDO`. Test temporal: 1/1 `PASS`.
  - **Lectura correcta del `401` — no es un fallo de `DEC-026`:** el `401 TOKEN_SIN_ROL_VALIDO` se produce **después** de que la firma ES256 fue verificada con éxito vía JWKS; es la validación de *claims* (capa de autorización) la que rechaza el token, porque el JWT real todavía no trae `rol`/`sucursales`. Esa ausencia corresponde íntegramente a `DEC-001` (Custom Access Token Hook, `REQUIRES_REDESIGN`, sin implementar), no a la verificación criptográfica de este `DEC-026`. **El endpoint no llegó a `200` por falta de claims de negocio, no porque la autenticación ES256/JWKS falle** — precisamente al contrario: que el flujo alcance la validación de claims demuestra que la autenticación funcionó.
  - **Conclusión:** `DEC-026` queda validado end-to-end contra el proyecto real en todo su alcance declarado (verificación de firma ES256, resolución por `kid` vía JWKS real, `issuer`, y estabilidad de todo lo anterior a través de una renovación de sesión). Sin cambios de código derivados de estas pruebas — no fue necesario ninguno.

### DEC-027 — `audience` esperado en el JWT de sesión de Supabase
**Estado actual:** `CLOSED` — **`aud = "authenticated"`**, confirmado empíricamente contra JWT reales emitidos por el proyecto Supabase de Blanc (no asumido desde documentación pública). **Nota de alcance:** esta decisión cierra *cuál es el valor real*; **no** autoriza por sí sola agregar la validación de `audience` a `JwtAuthGuard` — ese cambio de código requiere su propia autorización explícita, no se implementó aquí.
**Historial:**
- 2026-08-25: Se intentó confirmar sin crear ningún usuario ni ejecutar ningún login — se consultó el documento completo de `/.well-known/openid-configuration` del proyecto real. Ese documento **no publica un valor fijo de `audience`** para los tokens de sesión: `claims_supported` lista `aud` como un tipo de claim presente en los tokens, pero no su valor, y ese documento describe el flujo OIDC-para-terceros de Supabase (`authorization_endpoint`/`token_endpoint` de OAuth), **no necesariamente el mismo tipo de token de sesión (GoTrue) que emite un login normal de usuario interno** — son flujos distintos dentro del mismo proyecto. La convención públicamente documentada por el ecosistema Supabase es `aud: "authenticated"` (usada extensamente en políticas RLS vía `auth.jwt()`), pero **no está confirmada contra un token real de este proyecto** — confirmarla requeriría decodificar el payload (no el JWT firmado completo, no secretos) de un access token real ya emitido por un login, que no existe todavía sin ejecutar un login real, explícitamente fuera de alcance de esta iteración. **Queda explícitamente pendiente, no asumido.**
- **2026-09-01/08 (prueba de integración real #1 — login):** el cliente creó manualmente una cuenta de prueba en el Dashboard y ejecutó en su propia terminal el script temporal de este repositorio (`backend/src/__temp_supabase_real_integration.e2e.spec.ts`, login por *password grant* contra `${SUPABASE_URL}/auth/v1/token`, sin frontend ni SDK nuevo). Las credenciales nunca entraron al repositorio, a la documentación ni a la conversación; el script solo imprime metadatos, nunca el JWT. **Resultado reportado: `aud = "authenticated"`** en un access token real, junto con `alg = ES256`, `iss = https://<PROJECT_REF>.supabase.co/auth/v1`, `kid` resuelto contra el JWKS real y firma verificada (PASS). El token llegó a `JwtAuthGuard` y Blanc respondió `401 TOKEN_SIN_ROL_VALIDO` — comportamiento esperado, no un fallo: el token real no trae `rol`/`sucursales` porque el Custom Access Token Hook (`DEC-001`) sigue sin implementarse.
- **2026-09-08/09 (prueba de integración real #2 — flujo de refresh):** ejecutada por el cliente con el mismo script temporal, extendido para probar exclusivamente la renovación de sesión (`grant_type=refresh_token`). **Resultado reportado:** login PASS; refresh HTTP `200`; el access token cambió (`true`); **el refresh token fue rotado (`true`)** — coherente con lo que `ADR-024`/`DEC-003` ya asumían documentalmente sobre la rotación nativa de Supabase, ahora observado contra el proyecto real. El **JWT renovado conserva** `aud = "authenticated"`, `iss = https://<PROJECT_REF>.supabase.co/auth/v1`, `alg = ES256` y `kid = 0dd96720-c81d-4406-a2de-fe6bed0f4cd8` (la misma clave `CURRENT` publicada en el JWKS real). Firma del token renovado verificada contra el JWKS real: **PASS**. El token renovado llegó al mismo endpoint real de Blanc (`GET /v1/sucursales-y-personal/sucursales`) y devolvió otra vez `401 TOKEN_SIN_ROL_VALIDO`, por el mismo motivo esperado (`DEC-001`). Test temporal: 1/1 PASS.
- **Cierre (2026-09-09):** con dos JWT reales distintos (emisión inicial y renovación) mostrando el mismo valor, la evidencia se considera suficiente. **`aud = "authenticated"`, `CLOSED`.** Origen de la evidencia registrado con precisión: ejecuciones reales realizadas por el cliente en su propia terminal usando el script de este repositorio — Claude no observó los tokens ni las credenciales, solo recibió los metadatos reportados. **No se modificó `JwtAuthGuard`**: agregar la validación de `audience` al guard sigue siendo un cambio de código pendiente de autorización explícita (ver `DEC-026`, que dejó `audience` deliberadamente fuera del alcance implementado).

### DEC-028 — Mecanismo de provisionamiento de `FL-SEG-06`: `createUser` sin contraseña
**Estado actual:** `CLOSED` (decisión de mecanismo — **no autoriza implementación**, que sigue requiriendo su propia iteración explícita)
**Historial:**
- **2026-09-13:** `DEC-025` ya había acotado `FL-SEG-06` a "Solo Provisionar", excluyendo explícitamente login y MFA de su alcance. **Bajo ese alcance, esta decisión elige el mecanismo concreto: la Admin API de Supabase `createUser`, invocada sin contraseña.** Es una elección de esta DEC, no una consecuencia técnica forzada por `DEC-025`: `DEC-025` define *qué* hace el flujo, `DEC-028` define *cómo*.
  - **Mecanismo:** `createUser` (Admin API, `POST /admin/users`), **no `inviteUserByEmail`**. Razones registradas: (a) `inviteUserByEmail` es por naturaleza una operación de onboarding de credenciales, y su propósito completo —iniciar el camino al primer login— cae dentro de lo que `DEC-025` excluyó del alcance; (b) Blanc no tiene frontend, por lo que una invitación llevaría a la persona a una URL inexistente; (c) el `id` en la respuesta de `createUser` está confirmado por dos fuentes oficiales concordantes (tipos del SDK `auth-js` + ejemplo de respuesta de la referencia REST), mientras que para `inviteUserByEmail` los tipos del SDK y la referencia REST **se contradicen** (`UserResponse` con `id` vs. respuesta documentada `{}`), y `_userResponse` no valida el cuerpo — un cuerpo vacío produciría `undefined` en runtime con TypeScript afirmando `string`.
  - **Sin contraseña:** `password` es opcional en `AdminUserAttributes` (confirmado por los tipos oficiales). Se omite deliberadamente para que ningún administrador conozca la credencial de otra persona — lo contrario debilitaría el no repudio del log de auditoría (`RN-AUD-01`), haciendo indistinguible quién ejecutó una acción.
  - **Definición precisa de "Provisionar":** crear la identidad de autenticación en `auth.users` y **persistir su `id` como `usuarios.supabase_user_id`**. Nada más. El éxito se define exactamente así; no incluye que la persona pueda iniciar sesión.
  - **Precondición:** el usuario de Blanc **ya existe** (creado por `FL-SEG-01`, que no toca Supabase). `FL-SEG-06` nunca crea el registro administrativo.
  - **Origen del identificador:** el `id` devuelto por `createUser` **es** el `supabase_user_id` que se persiste (`DEC-021` fija su forma: `UUID UNIQUE NULLABLE`). Ese mismo identificador es el que aparece como `sub` en los JWT de esa cuenta.
  - **Sin búsqueda por email en el happy path:** tras un `createUser` exitoso, el `id` se toma de la propia respuesta. No se consulta Supabase por email para obtenerlo. (Relevante porque no existe una operación oficial fiable de búsqueda por email: `getUserByEmail` sigue siendo una petición abierta, y el `filter` del servidor usa coincidencia parcial por `LIKE`.)
  - **Sin `provisioning_status`:** no se agrega ninguna columna ni estado adicional en esta etapa. `supabase_user_id IS NOT NULL` **es** el marcador de completitud; un estado propio duplicaría información cuya verdad pertenece a Supabase.
  - **Protección de concurrencia del vínculo local:** la persistencia debe ser defensiva, con una condición equivalente a `... WHERE supabase_user_id IS NULL`, de modo que dos ejecuciones simultáneas no produzcan un doble vínculo. **Alcance explícito de esa protección:** cubre únicamente el lado de Blanc; **no impide cuentas huérfanas del lado de Supabase**.
  - **Frontera transaccional:** la llamada a Supabase ocurre **fuera** de cualquier transacción de PostgreSQL — `UnitOfWork` solo protege atomicidad dentro de PostgreSQL, y una llamada HTTP no es reversible por él (`IDENTIDAD_PRE_ARRANQUE.md` §2, vigente).
  - **Sin atomicidad cross-system:** se asume explícitamente que no existe y que no se va a simular. Los 5 escenarios de fallo de `IDENTIDAD_PRE_ARRANQUE.md` §2 siguen vigentes como catálogo.
  - **Fuera de alcance de esta decisión y de `FL-SEG-06`:** creación/activación de credenciales, login y onboarding. **Supuesto de producto que esto implica, registrado explícitamente para que sea visible y no quede enterrado como detalle técnico:** que "provisionar identidad" y "dar acceso operativo" son dos momentos distintos, y que es aceptable que un usuario tenga identidad creada y vinculada durante un tiempo sin poder iniciar sesión, recibiendo credenciales después por un flujo separado cuando exista interfaz. Hoy el sistema ya opera así de facto (todo usuario creado por `FL-SEG-01` está en ese estado). **Toca la experiencia del personal — corresponde a la Dueña validarlo.**
  - **Explícitamente NO resuelto aquí:** adopción/recuperación cuando Supabase ya tiene una cuenta para ese email (y su caso hermano: cuenta creada en Supabase pero Blanc no logró persistir el `id`); mutabilidad del email tras provisionar; comportamiento ante borrado/recreación de la cuenta; reconciliación; y **C2** (autorización contra PostgreSQL), que sigue sin formalizar y no se decide en esta DEC. Tampoco se decide aquí si se pasa `email_confirm` — detalle de implementación.
  - **Esta DEC no autoriza implementar `FL-SEG-06`.** Bloqueadores de infraestructura vigentes: `identidad_accesos` no existe en ninguna migración ni base de datos real; la columna `supabase_user_id` no existe; `SUPABASE_SERVICE_ROLE_KEY` no está configurada en ningún entorno.

### DEC-029 — Modelo de autorización C2: PostgreSQL de Blanc como fuente de autorización por request
**Estado actual:** `CLOSED` (decisión de arquitectura, 2026-09-14) — **NO autoriza implementación**, que requiere su propia iteración explícita. Sustituye a `DEC-001`.
**Historial:**
- **2026-09-14 (decisión y formalización):** se adopta **C2** como modelo de autorización de Blanc, reemplazando el Custom Access Token Hook (`DEC-001`, ahora `SUPERSEDED`, y con él la Decisión 1 de `ADR-024`).

  **Qué decide C2, en una frase:** el JWT responde *quién eres* (autenticación); PostgreSQL de Blanc responde *qué puedes hacer* (autorización), consultado en cada request, sin que esos datos viajen nunca dentro del token.

  **Coherencia con lo ya decidido:** `DEC-024` (`CLOSED`) ya estableció que PostgreSQL de Blanc es la fuente de verdad de identidad administrativa, rol, `activa` y sucursales, y que el JWT es "un snapshot firmado, no una fuente de datos administrativos". C2 es la consecuencia operativa de ese principio: si la verdad vive en PostgreSQL, se lee de PostgreSQL. El hook era el camino de copiar esa verdad al token; C2 es el de no copiarla.

  **Variante elegida — C2, frente a dos alternativas descartadas por defecto concreto:**
  - `C1` (el propio `JwtAuthGuard` consulta la base de datos): **descartada**. Agravaría el acoplamiento entre autenticación y autorización que este rediseño busca separar, obligaría a inyectar un repositorio en un guard hoy puramente criptográfico y contaminaría sus 27 tests, que no tocan base de datos.
  - `C3` (`RolesGuard` consulta la base de datos): **descartada por un defecto verificado en el código**, no por preferencia. `RolesGuard` hace `return true` de inmediato cuando el endpoint no declara `@Roles` — es el caso real de `GET /v1/sucursales-y-personal/sucursales` (`sucursales.controller.ts`, "cualquier rol autenticado lee"). Si la consulta viviera ahí, esos endpoints nunca poblarían `rol`/`sucursales`, y cualquier caso de uso que reciba `@CurrentUser()` y llame a `tieneAlcanceSucursal()` operaría con datos incompletos.
  - **`C2` (capa de autorización separada, entre ambos guards): elegida.** Cada componente conserva una sola responsabilidad, `JwtAuthGuard` sigue siendo verificable sin base de datos, y es el único punto donde en el futuro podría insertarse un cache —o incluso volver a claims embebidos— sin tocar nada más.

  **Flujo HTTP resultante:**
  ```
  Supabase Auth
      │  emite JWT firmado ES256 (kid, iss, aud) — sin rol ni sucursales
      ▼
  JwtAuthGuard                    AUTENTICACIÓN — sin acceso a base de datos
      │  @Public() → pasa sin token
      │  verifica firma (ES256 vía JWKS / HS256 legacy), issuer, exp/nbf,
      │  algoritmo restringido explícitamente
      │  expone identidad autenticada: { sub }
      ▼
  Capa de Autorización            AUTORIZACIÓN — consulta PostgreSQL de Blanc
      │  sub → identidad_accesos.usuarios.supabase_user_id
      │  lee rol, activa y las filas de usuarios_sucursales
      │  compone request.usuario = { sub, rol, sucursales }
      │  (misma forma que hoy: RolesGuard y los casos de uso no cambian)
      ▼
  RolesGuard                      NIVEL 1 — sin cambios
      │  @Roles(...) contra request.usuario.rol → 403 ROL_SIN_PERMISO
      ▼
  Casos de uso                    NIVEL 2 — sin cambios
         puedeAsignarRol() / tieneAlcanceSucursal()
  ```

  **Qué NO cambia (y es la razón principal por la que C2 es asumible):** `RolesGuard`, `@Roles`, `@CurrentUser`, la interfaz `ClaimsUsuario`, `puedeAsignarRol()`, `tieneAlcanceSucursal()` y los 18 casos de uso existentes **quedan exactamente igual**. Solo cambia *quién* rellena `request.usuario`.

  **Modelo de errores HTTP bajo C2** — resuelve un acoplamiento real: hoy `JwtAuthGuard` devuelve `401 TOKEN_SIN_ROL_VALIDO` ante un JWT legítimo de Supabase que simplemente no trae datos de negocio, mezclando autenticación con autorización.

  | Situación | Código | Categoría | Razonamiento |
  |---|---|---|---|
  | Sin token / `Bearer` malformado | `401` | Autenticación | Autenticarse y reintentar resuelve |
  | Firma inválida, algoritmo no permitido, `issuer` incorrecto | `401` | Autenticación | Ídem |
  | Token expirado | `401` | Autenticación | Refrescar y reintentar resuelve |
  | Autenticado, **sin registro en Blanc** (no provisionado) | `403` | Autorización | El token es impecable; volver a autenticarse no cambia nada. Un `401` mentiría sobre la acción correctiva |
  | Usuario con `activa = false` | `403` | Autorización | Autenticado, denegado deliberadamente |
  | Rol insuficiente | `403` | Autorización | Ya es el comportamiento actual |
  | Sucursal fuera de alcance | `403` | Autorización | Ya es el comportamiento actual |
  | **Fallo de PostgreSQL durante la autorización** | `500`/`503` | Infraestructura (`ADR-013`) | **Nunca `401` ni `403`**: no es una decisión de permisos. Debe ser **fail-closed**: denegar sin asumir ningún rol por defecto |

  **Cambio de contrato a registrar:** el actual `401 TOKEN_SIN_ROL_VALIDO` —el resultado real observado en las dos pruebas de integración con JWT reales— pasaría a ser `403`. Es semánticamente más correcto, pero es un cambio observable del contrato de API.

  **Qué resuelve C2:**
  - Elimina la ventana de staleness por completo: `rol`, `sucursales` y `activa` siempre reflejan el estado actual, no un snapshot de hasta una hora atrás.
  - **`activa = false` surte efecto en el siguiente request**, cerrando en la práctica el `ACCEPTED_RISK` de `FL-SEG-05` en la superficie de API de Blanc, sin depender de `admin.signOut` ni de `FL-SEG-06`.
  - Reduce la dependencia de un mecanismo propietario: la autenticación queda en estándares (JWT/JWKS, ya implementado en `DEC-026`) y la autorización en Blanc.
  - Mantiene toda la autorización en TypeScript, cubierta por la suite de tests existente.

  **Qué NO resuelve C2 — precisión obligatoria, no debe presentarse de otro modo:**
  - **C2 no revoca criptográficamente el JWT.** El access token sigue siendo válido y verificable hasta su `exp` (3600s). Cualquier consumidor que valide ese token por su cuenta lo seguiría aceptando. C2 deja de *confiar* en el contenido del token para autorizar; **no lo invalida**. La revocación real de sesión sigue dependiendo de `admin.signOut`/`ban_duration` de Supabase (`FL-SEG-06`, sin implementar).
  - No resuelve `DEC-017` (Pregunta 11) ni `DEC-015`: solo reubica esas decisiones de negocio en una función TypeScript aislada en lugar de una función SQL. El patrón obligatorio de aislamiento de `IDENTIDAD_PRE_ARRANQUE.md` §4 sigue aplicando.
  - No elimina la necesidad de `FL-SEG-06`: sin `supabase_user_id` poblado no hay forma de resolver `sub` → usuario de Blanc.

  **Costos aceptados conscientemente:**
  - 1-2 consultas adicionales por request autenticado (combinables en una sola con agregación), **reutilizables dentro del mismo request**: se resuelven una vez y todo lo posterior lee de memoria. A la escala de Blanc (3-4 sucursales, un puñado de usuarios internos) el costo es marginal frente a lo que cada endpoint ya consulta.
  - No existe infraestructura de cache en el proyecto, y **no se construye ahora**: sería infraestructura especulativa (`IMPLEMENTATION_MASTER_PLAN.md`, principio 1). La capa de C2 es el único punto donde insertarla si algún día hiciera falta.
  - Exige una **enmienda formal a `ADR-010`** (aplicada el 2026-09-14), no una desviación silenciosa.

  **Prerequisitos duros antes de poder implementar C2** (ninguno resuelto hoy):
  1. `identidad_accesos` no existe en ninguna migración ni base de datos real.
  2. La columna `supabase_user_id` no existe (`DEC-021` decidió su forma, no la creó).
  3. `UsuarioRepository` no tiene método de lectura por `supabase_user_id` ni de las filas de `usuarios_sucursales` (hoy solo las escribe).
  4. `FL-SEG-06` debe estar operativo para que exista algo que correlacionar.

  **Explícitamente NO decidido aquí:** el comportamiento exacto fail-closed ante caída de PostgreSQL más allá del principio (denegar, nunca asumir rol); si se cachea y cómo; la validación de `audience` (`DEC-027`, sigue `PENDING`); y el momento de implementar.

### DEC-030 — Disparador de `completada`: automático por paso del tiempo, sin notificación
**Estado actual:** `CLOSED` (decisión de negocio de la Dueña, 2026-09-30). Cierra `Pregunta 2` de `OWNER_DECISION_LOG.md`.
**Historial:**
- **2026-09-30:** la Dueña responde que la transición a `completada` es **automática por el paso del tiempo** y **no emite notificación a la clienta**. Es la opción (a) de las tres planteadas.

  **Por qué importaba tanto:** `OWNER_DECISION_LOG.md` la calificaba como *"la pregunta de mayor apalancamiento de todo el proyecto"*. Desbloquea en cascada `RN-AGE-14`, la máquina de estados de `Cita`, el evento de dominio `CitaCompletada` y, con él, la entrada a la Fase 5 (Garantías), que depende de ese evento.

  **Consecuencia de diseño:** la transición se **almacena**, no se calcula. Una vista derivada ("si el rango ya pasó, está completada") no emite eventos de dominio, y Garantías necesita el evento. Requiere por tanto un job programado que publique `CitaCompletada` por el Outbox — que nace en esta misma Fase 2.

  **Abierto que esta decisión genera (`N-02`):** `no_show` es manual y `completada` automática, y se pisan. Si el job marca `completada` a las 19:00 y recepción descubre el no-show a la mañana siguiente, la corrección puede ser imposible. Falta decidir entre ventana de gracia o permitir que `no_show` sobrescriba. Afecta a `RN-CRM-06` (sugerencia de lista roja).

  **Detalle completo:** `docs/architecture/FASE_2_AGENDA_ARQUITECTURA.md` §3.

---

### DEC-031 — Capacidad por sucursal: patrón de Sillas Virtuales
**Estado actual:** `CLOSED` (decisión de negocio + diseño de arquitectura, 2026-09-30). Cierra `P4` de `ARCHITECTURE_CLOSURE_PLAN.md`.
**Historial:**
- **2026-09-30:** la Dueña fija un **límite físico estricto por sucursal** — Zibatá 5, Lomas 3, Álamos 1 — y la directriz de que una cita sin manicurista elegida debe apartar el hueco respetando esa capacidad, para que **recepción reasigne a la manicurista real al llegar la clienta**.

  **El defecto que esto evita, y que fallaba en silencio:** la restricción de exclusión anti-doble-booking compara `manicurista_id`. En PostgreSQL `NULL = NULL` evalúa a `NULL`, no a `TRUE`, así que una restricción `EXCLUDE` **nunca se dispara entre dos filas con `NULL`**. Dejar `manicurista_id` nulo para las citas sin preferencia habría permitido **citas simultáneas ilimitadas** sin que la base de datos protestara: sobreventa descubierta el día que llegan siete clientas a un local de tres sillas.

  **El patrón adoptado:** se introduce `agenda.sillas` (estación física; el número de filas por sucursal **es** la capacidad) y se invierte el modelo: **toda cita ocupa exactamente una silla, siempre; la manicurista es opcional.** `silla_id` es `NOT NULL`, de modo que la restricción siempre tiene un valor real que comparar. Dos restricciones distintas para dos escaseces distintas — una sobre `silla_id` (capacidad física) y otra sobre `manicurista_id` con `WHERE manicurista_id IS NOT NULL` explícito (la persona nombrada). La reasignación en mostrador es un `UPDATE` que la segunda restricción valida sola.

  **Alternativas descartadas:** `manicurista_id` nulo (falla en silencio); recurso unificado con sillas y manicuristas como filas hermanas (fuga capacidad: 3 sillas + 3 manicuristas = 6 recursos en un local de 3 sillas); asignar una manicurista real de inmediato (contradice la directriz de que decida recepción al llegar).

  **Prerrequisito técnico ya verificado:** `postgres-de-prueba.smoke.spec.ts` crea esta misma restricción en miniatura contra PostgreSQL real y comprueba que rechaza el solapamiento para el mismo recurso y lo acepta para otro. No es una suposición.

  **Abierto que esta decisión genera (`N-01`):** las sillas no son el único límite. Si Zibatá tiene 5 sillas pero hoy trabajan 3 manicuristas, el modelo aceptaría 5 citas y dos clientas no tendrían quién las atienda. Falta decidir si la capacidad efectiva es `min(sillas, personal en turno)`, si recepción absorbe el desajuste, o si las sillas se configuran a la baja.

  **Detalle completo:** `docs/architecture/FASE_2_AGENDA_ARQUITECTURA.md` §2.

---

### DEC-032 — Baja de manicurista con citas futuras: bloqueo duro
**Estado actual:** `CLOSED` (decisión de negocio de la Dueña, 2026-09-30). Cierra `Pregunta 4` de `OWNER_DECISION_LOG.md`.
**Historial:**
- **2026-09-30:** la Dueña elige la opción (a): el sistema **lanza excepción** si se intenta dar de baja a una manicurista con citas futuras. Nada se cancela ni se reasigna automáticamente.

  **Modifica código de Fase 1 ya entregado.** `DesactivarManicuristaUseCase` existe hoy y **no verifica nada** — su propio comentario deja constancia de que el tratamiento de citas futuras estaba deferido a esta pregunta. No es trabajo en terreno virgen: es un cambio sobre un módulo cerrado y con pruebas escritas. Error nuevo: `MANICURISTA_CON_CITAS_ACTIVAS` (409).

  **Consecuencia arquitectónica — cruza un Bounded Context:** la baja ocurre en Sucursales y Personal; las citas viven en Agenda. `ADR-005` prohíbe FKs entre esquemas y `ADR-001`/`ADR-002` que un módulo consulte las tablas de otro, así que **no puede ser un `JOIN`**: requiere un puerto explícito que Agenda implemente y Sucursales y Personal consuma, mismo patrón que `PERMISOS_USUARIO_PORT` en `DEC-029`. Invierte la dirección de dependencia declarada en `01-domain-discovery.md` §4 (Agenda es consumidor de Sucursales), por lo que debe verificarse con `madge` al implementarlo.

  ~~**Abierto (`N-04`)**~~ **CERRADO (2026-10-14):** "cita futura" = programada a partir de ahora y en un estado que **ocupa** horario. La implementación reutiliza `ESTADOS_QUE_LIBERAN_HORARIO`, la misma lista que alimenta las restricciones de exclusión, de modo que no existe una segunda definición que pueda divergir. El sustituto temporal fue **eliminado**.

  **Detalle completo:** `docs/architecture/FASE_2_AGENDA_ARQUITECTURA.md` §4.

---

### DEC-033 — Diseños especiales: flag `requiere_cotizacion_manual` en vez de parametrizar
**Estado actual:** `CLOSED` (decisión de negocio de la Dueña, 2026-09-30). Cierra **uno de los tres** huecos de `RN-COT-04`.
**Historial:**
- **2026-09-30:** la Dueña decide **no intentar parametrizar** tiempos ni precios de diseños complejos. Se marca el elemento con un flag y la automatización **se detiene**, exigiendo un humano. Es la realización más directa de la directriz de Sistema Híbrido: el sistema reconoce lo que no sabe calcular en vez de inventar un número.

  **Qué cierra y qué NO.** `RN-COT-04` tenía tres huecos: (1) celdas sin valor numérico ("Diseño Especial", `SP`, `CF`, `CC`) — **resuelto por decisión**: no se parametrizan; (2) la ambigüedad del "+15 min" del drill, ¿delta o reemplazo? — **sigue abierto**; (3) la tabla numérica original no está en el repositorio y hay que recuperarla de la reunión — **sigue abierto**. "Ya no bloquea" no es "resuelto".

  **Dónde vive el flag:** en `servicios` y en `modificadores_diseno`, ambos `boolean NOT NULL DEFAULT false`. Regla de propagación: si *cualquier* elemento de la composición lo tiene activo, la cotización completa es manual — disyunción, no media ponderada.

  **Reabre `FL-COT-01`, que figuraba CERRADO.** Exige migración `0004`, cambios en ambas entidades, en los DTO de alta/edición y en el presenter. Son cambios aditivos con `DEFAULT false` y sin romper datos, pero el estado del flujo pasa de `CERRADO` a `REABIERTO (alcance acotado)` — ver §13.

  **Abierto (`N-03`):** el flag dice *que* hay que parar, no *cómo*. Falta definir si la cita queda en un estado propio (`pendiente_cotizacion`) que ocupe el horario mientras un humano cotiza —si no ocupa, el hueco puede venderse dos veces—, si hay límite de tiempo, y si se avisa activamente a recepción.

  **Detalle completo:** `docs/architecture/FASE_2_AGENDA_ARQUITECTURA.md` §5.

---

### DEC-034 — Anticipo expirado libera el horario; lista de estados que ocupan
**Estado actual:** `CLOSED` (decisión de negocio de la Dueña, 2026-09-30). Rellena un hueco concreto de la máquina de estados de `Cita`.
**Historial:**
- **2026-09-30:** la Dueña confirma que si un anticipo expira, el espacio **no se considera agendado y se libera**, priorizando a otras clientas. Esto cierra lo que `DOMAIN_MODEL_REVIEW.md` había señalado como *"no solo una incógnita de negocio, sino una transición de estado sin definir"*.

  **Habilita la restricción de exclusión.** `04-data-model.md` §346 dejó constancia de que, sin saber qué estados ocupan el horario, la restricción *"no puede implementarse literalmente"*. Con `DEC-030` y esta decisión ya hay base para proponer la lista: **liberan `cancelada`, `expirada` y `reprogramada`; todo lo demás ocupa** (`pendiente_confirmacion`, `en_espera_pago`, `confirmada`, `completada`, `no_show`).

  > ⚠️ **CORRECCIÓN (2026-10-14, migración `0007`): `en_espera_pago` NO ocupa.** Esta entrada lo había listado entre los ocupantes con la justificación *"mientras el anticipo no expire, el espacio es suyo"*, lo que **contradice frontalmente a `RN-ANT-03`**, que está `Aprobada` y dice: *"no existe una retención temporal real del horario. Mientras el anticipo esté pendiente, el horario permanece disponible para cualquier otra clienta — el primero en pagar se queda con el cupo, protegido por el invariante de exclusión ya existente"*.
  >
  > Ganó la regla de negocio: era una decisión del negocio y `DEC-034` la contradijo por error al proponer la lista. El propio `RN-ANT-03` describe el mecanismo que esto habilita — la carrera entre dos clientas de lista roja **no se resuelve reteniendo el hueco**, sino al confirmar el pago, cuando la cita pasa a un estado que sí ocupa y la restricción decide quién se queda. Con `en_espera_pago` ocupando, esa carrera no podía ni existir.
  >
  > **Lista definitiva:** liberan `cancelada`, `expirada`, `reprogramada` y `en_espera_pago`. Se formula por la negativa a propósito: un estado nuevo que alguien añada en el futuro ocupará por defecto, que es el lado seguro del error.

  **No cierra `P3`.** Siguen faltando: el estado `pendiente_confirmacion`, que **todavía no existe** en `01-domain-discovery.md` §113 y que la confirmación interactiva ya confirmada (1.23) exige; a qué estado vuelve una cita tras reprogramarse; si `DEC-033` necesita un `pendiente_cotizacion`; y las máquinas de `Conversación` y `TicketEscalamiento` enteras — la segunda ni siquiera tiene valores propuestos. `P3` pasa de `Abierto` a **`Abierto — parcialmente desbloqueado`**.

  **Detalle completo:** `docs/architecture/FASE_2_AGENDA_ARQUITECTURA.md` §6.

---

### DEC-035 — `N-01` capacidad vs. personal: se resuelve en la capa de aplicación, no en la base de datos
**Estado actual:** `CLOSED` (decisión técnica de arquitectura, 2026-09-30). Cierra `N-01` **sin consultar a la Dueña** — es una decisión de implementación, no de negocio.
**Historial:**
- **2026-09-30:** las restricciones `EXCLUDE` de `DEC-031` protegen recursos **físicos** (sillas y personas), pero no saben quién vino a trabajar hoy. Con 5 sillas y 3 manicuristas en turno, aceptarían 5 citas simultáneas.

  **Decisión — reparto de responsabilidades en dos niveles:**

  | Nivel | Garantiza | Mecanismo |
  |---|---|---|
  | Base de datos | Ningún recurso físico se usa dos veces a la vez | `EXCLUDE USING gist`. Invariante duro, no evadible |
  | Aplicación | No se ofrecen más huecos de los que el salón puede atender hoy | Servicio de dominio `MotorDisponibilidad` → `MIN(sillas_libres, manicuristas_activas)` |

  **Por qué no en la base de datos:** "manicuristas activas" cambia por día, por turno y por ausencia de última hora. Expresarlo como restricción exigiría modelar turnos y mantener una tabla de capacidad sincronizada en cada alta, baja y cambio de horario. Es un **cálculo de disponibilidad**, no un invariante de integridad referencial.

  **`MotorDisponibilidad` es un Servicio de Dominio**, no un caso de uso: no orquesta transacciones ni escribe. Lo consumen por igual el flujo conversacional y el panel de recepción, de modo que ambos ven lo mismo.

  ⚠️ **Lo que este reparto NO garantiza, asumido conscientemente:** la comprobación de aplicación es **consultiva, no un invariante**. Entre que `MotorDisponibilidad` responde "quedan 3 huecos" y que la cita se confirma, otra reserva puede colarse: ambas pasan la comprobación, toman sillas **distintas**, y la base de datos las acepta porque ningún recurso físico se duplicó — 4 citas con 3 manicuristas. Mitigarlo exigiría bloqueo pesimista sobre la capacidad de la sucursal, que serializaría todas las reservas del local. Se acepta el desajuste y lo absorbe recepción, coherente con la directriz de Sistema Híbrido.

  **Detalle completo:** `docs/architecture/FASE_2_AGENDA_ARQUITECTURA.md` §2.7.

---

### DEC-036 — Submódulo "Horarios y Ausencias": la fuente de datos que `DEC-035` necesitaba
**Estado actual:** `CLOSED` (decisión de negocio + alcance, 2026-10-09). Cierra el **Hueco A** detectado en la auditoría operativa.
**Historial:**
- **2026-10-09:** `DEC-035` definió la capacidad real como `MIN(sillas_libres, manicuristas_activas)`, pero **no existía ninguna fuente para `manicuristas_activas`** — `Manicurista` solo guarda nombre, `activa` y sucursales asignadas. Era una fórmula sin datos.

  **Respuestas de la Dueña:** las manicuristas tienen **horario fijo**, no rotativo; **todas trabajan al mismo tiempo**, sin entradas escalonadas; **sí pueden cubrir en otra sucursal** un día suelto; y la ausencia *"se tiene que poder capturar en el sistema para tener certeza y exigir reagendar"*.

  **Decisión:** se planea un submódulo **Horarios y Ausencias** (fase posterior, no Fase 2) con dos conceptos separados: el **horario base** por manicurista (fijo, semanal) y la **excepción diaria** (ausencia, salida temprana, cobertura en otra sucursal). `MotorDisponibilidad` cruza sillas libres contra el resultado de aplicar las excepciones del día al horario base.

  **Por qué "horario fijo" NO simplifica tanto como parece:** que todas trabajen a la vez elimina el cálculo de solapamiento de turnos, pero la **cobertura cruzada** sí obliga a que la pertenencia a una sucursal sea *por día*, no estática. Si Ana, de Zibatá, cubre hoy en Lomas, Zibatá pierde una persona **y** Lomas gana una: dos sucursales cambian de capacidad con un solo registro. Es el caso que impide resolverlo con un simple booleano de ausencia.

  **Explícitamente NO decidido:** si la excepción se captura por la Encargada o por la Dueña; con cuánta antelación; y si el sistema debe *exigir* el reagendamiento de las citas afectadas o solo alertar. La Dueña dijo "exigir reagendar o ver la manera de resolverlo" — las dos cosas, sin elegir.

---

### DEC-037 — Walk-ins: registro manual que consume una Silla Virtual
**Estado actual:** `CLOSED` (decisión de negocio, 2026-10-09). Cierra el **Hueco B**.
**Historial:**
- **2026-10-09:** el patrón de Sillas Virtuales (`DEC-031`) asume que **toda** ocupación pasa por el sistema. Una clienta sin cita que se sienta invalida esa premisa: la silla está ocupada físicamente y libre para el sistema.

  **Respuestas de la Dueña:** los walk-ins son **raros** (*"es poco o no pasa"*), pero existen; **se tienen que registrar en el momento**, por la Dueña o la Encargada; y **no tienen prioridad** sobre las citas agendadas.

  **Decisión:** el walk-in se registra manualmente en la plataforma y **consume una Silla Virtual en tiempo real**, igual que cualquier cita. No es un tipo de entidad nuevo: es una cita creada en el momento.

  **Lo que esto preserva:** la garantía anti-doble-booking de la base de datos sigue siendo cierta *sobre la realidad física*, no solo sobre lo agendado — que era exactamente el riesgo.

  **Riesgo residual, aceptado:** la garantía depende de que alguien registre el walk-in **antes** de que la clienta se siente. Si se registra después, o no se registra, el sistema puede haber vendido ese hueco en el intervalo. Es un riesgo de proceso, no de software, y su baja frecuencia lo hace tolerable.

  **Explícitamente NO decidido:** si un walk-in exige dar de alta a la clienta o admite un registro mínimo (sin teléfono, sin historial).

---

### DEC-038 — WhatsApp de doble canal: el mensaje saliente ajeno pausa el bot en esa conversación
**Estado actual:** ~~`CLOSED`~~ **`SUPERSEDED` por `DEC-043` (2026-10-09, mismo día).** El diseño era correcto para el escenario que atendía, pero ese escenario **dejó de existir**: con la Cloud API el número se desconecta de la app móvil, no hay segundo emisor y la colisión se vuelve imposible por construcción, no gestionable. Se conserva el registro porque documenta un problema real y una verificación de plataforma (`N-07`) que fue precisamente la que llevó a tomar la decisión definitiva. Sus pendientes `N-05`, `N-06` y `N-07` quedan **cerrados por no aplicar**.
**Historial:**
- **2026-10-09:** la Dueña confirma que **el personal seguirá usando la app de WhatsApp Business en su celular** y que los **números actuales se conservan** (ya tienen clientas reales). Sin diseño, la clienta recibiría dos respuestas contradictorias el primer día, y la plataforma no se enteraría.

  **Decisión:** la plataforma escucha los eventos de **mensaje saliente** del proveedor. Si sale un mensaje cuyo identificador **no está en el registro de envíos de la plataforma**, lo envió un humano → se fija `bot_pausado = true` **solo en esa conversación**. Es comparación de identificadores, no heurística de contenido.

  **La pausa es por conversación, jamás global** — exigencia literal de la Dueña: *"debe ser individual para que no se queden mensajes sin responder"*. Una pausa global dejaría cuarenta hilos mudos por una sola intervención.

  **Reanudar es siempre manual**, coherente con `RN-ESC-03` ya aprobada.

  ⚠️ **Supuesto sin verificar que puede invalidar el mecanismo:** el eco de mensajes salientes **no existe en todos los proveedores**. Con la **API oficial de Meta en modo clásico**, dar de alta el número en la Cloud API **lo desconecta de la app de WhatsApp Business** — el problema desaparece, pero se incumple la condición de la Dueña de seguir usando el celular. El mecanismo requiere o bien el **modo de coexistencia** de Meta (sin verificar si está disponible para estos números) o bien **Evolution API**. Ver `WHATSAPP_ARQUITECTURA_CANAL.md` §3.

  **Consecuencia:** esta verificación **fuerza la decisión de `ADR-008`**, abierta desde el inicio del proyecto. Deja de ser una preferencia técnica y pasa a ser "qué proveedor permite el modo de trabajo que el negocio dice que va a tener".

  **Detalle completo, con los siete escenarios:** `docs/architecture/WHATSAPP_ARQUITECTURA_CANAL.md`.

---

### DEC-039 — El rol `Gerente` se renombra a `Encargada`
**Estado actual:** `CLOSED` (decisión de negocio, 2026-10-09).
**Historial:**
- **2026-10-09:** *"Cambia el rol de gerente por encargada"*. Hay **una Encargada por sucursal**, y la Dueña puede operar sobre las tres.

  **Es un renombrado, no un rol nuevo:** las capacidades no cambian. Afecta al `enum Rol` (hoy `GERENTE`), a la tabla de roles de `functional-scope.md`, a `RN-SEG-*` y a los textos de interfaz.

  **Por qué importa más de lo que parece:** `DEC-031` dice que *"recepción reasigna la manicurista al llegar la clienta"*. Se preguntó quién hace eso en Álamos, de una sola silla. La respuesta cierra el hueco: **no hay recepcionistas; hay una Encargada en cada sucursal**, y es ella quien asigna. El rol `Recepcionista` sigue existiendo en el modelo pero **no corresponde a ninguna persona real hoy**.

  **Explícitamente NO decidido:** si `Recepcionista` debe eliminarse del modelo o conservarse como rol previsto sin titular.

---

### DEC-040 — El iPad de la manicurista es de solo lectura; el registro real de servicios vive fuera del sistema
**Estado actual:** `CLOSED` (decisión de negocio, 2026-10-09), **con una consecuencia grave aceptada**.
**Historial:**
- **2026-10-09:** un iPad **por manicurista**. Ve **su propia agenda** y **los precios**; **no** ve la lista roja. **No marca llegada ni finalización** — `completada` sigue siendo automática por paso del tiempo (`DEC-030`), sin que ella confirme nada. Sin conexión no opera: *"ellas pueden anotar los servicios que prestaron offline, por medio de Excel"*.

  **Decisión:** el iPad **no produce ninguna mutación de estado en el backend**. Es un consumidor de lectura.

  **Lo bueno:** elimina de raíz el conflicto de dos fuentes de verdad sobre el fin de una cita, que era el riesgo que motivó la pregunta.

  ⚠️ **La consecuencia que hay que asumir con los ojos abiertos:** *"anotar los servicios prestados"* es, literalmente, **el registro de lo que de verdad ocurrió** — y vive en un Excel fuera de la plataforma. Por tanto:
  - El sistema conoce lo **cotizado**, no lo **ejecutado**. Si la clienta añadió un servicio ya sentada (cosa que la Dueña confirma que pasa: *"se hace ahí mismo"*), el sistema nunca se entera.
  - **Cualquier reporte de ingresos o de productividad calculado desde la plataforma será una estimación**, no un hecho. El `cotizacion_snapshot` no es la facturación.
  - El módulo de **Analítica** (Fase 6) hereda este límite. Conviene decidir ahora si eso es aceptable o si en algún momento el Excel debe entrar al sistema.

  Queda registrado como `ACCEPTED_RISK` en §7.

---

### DEC-041 — Sin pasarela de pago: anticipo porcentual por transferencia con confirmación humana
**Estado actual:** `CLOSED` (decisión de negocio, 2026-10-09).
**Historial:**
- **2026-10-09:** *"No, no necesitamos pasarela de pago, el pago es aparte"*. El anticipo es un **porcentaje del servicio** (porcentaje exacto **sin definir**), se cobra por **transferencia manual**, y la confirmación **se escala a un humano**.

  **Decisión:** no se integra ninguna pasarela. El sistema **no cobra**: registra que alguien confirmó que el dinero llegó.

  **Consecuencias de diseño:**
  - El estado `en_espera_pago` **no se resuelve solo**: depende de una acción humana. Combinado con `RN-ANT-03` —el horario *no* se retiene mientras tanto— significa que una clienta de lista roja puede transferir y perder igual el hueco si otra paga y la confirman antes. **Es el comportamiento ya aprobado**, pero conviene que el negocio sepa que ahora tiene una cara visible.
  - El cobro del servicio es **al terminar** y ocurre **fuera del sistema**; las **propinas sí se registran**, lo que implica que algo del cobro sí entra — falta definir dónde y quién.

  **Explícitamente NO decidido:** el porcentaje exacto; dónde se registran las propinas; y qué evidencia se guarda de la transferencia (captura, folio, nada).

---

### DEC-042 — Políticas operativas de citas confirmadas
**Estado actual:** `CLOSED` (decisiones de negocio, 2026-10-09). Varias **modifican reglas ya aprobadas** — ver §15.3.
**Historial:**
- **2026-10-09:** bloque de respuestas operativas de la Dueña. Se registran juntas por pertenecer a un mismo cuerpo de decisión; cada una se propagará a su `RN-` correspondiente en una iteración posterior.

  | Tema | Regla confirmada |
  |---|---|
  | **Tolerancia de retraso** | **15 minutos**, pero **lo decide la Encargada** caso por caso. Pasado el margen **se atiende recortando el servicio**, nunca invadiendo la cita siguiente |
  | **Sobretiempo** | Si un servicio se alarga, **la cita siguiente no se mueve**; se compensa trabajando más rápido. La plataforma **no lo registra** |
  | **Servicio añadido en sitio** | Se hace ahí mismo si queda tiempo. **Invisible para el sistema** (ver `DEC-040`) |
  | **Cancelar** | **Siempre pasa por una persona**, también las clientas normales. Sin penalización si faltan más de 60 min, pero **todas las cancelaciones se registran** para detectar propensión y **sugerir** lista roja |
  | **Cancelar ≠ reagendar** | Son acciones distintas: al cancelar **se pregunta si quiere reagendar** |
  | **Tope de reagendamientos** | **3** por cita |
  | **Lista de espera** | **El bot la ofrece**. Se avisa **a una sola clienta a la vez**, con **1 hora** para responder; sin respuesta, pasa a la siguiente. El plazo debe ser **configurable** |
  | **Compatibilidad de hueco** | Si el hueco liberado es **más corto** que el servicio deseado, **no se ofrece** |
  | **Hueco liberado a <30 min** | Se asume perdido, pero **se avisa a la Dueña** por si quiere aprovecharlo |
  | **Lista roja** | **Solo la Dueña** puede marcarla. Es **interna y silenciosa**: no se avisa a la clienta. Se sale **manualmente** |
  | **Bloqueada** | Se **deriva directamente a un humano** y el bot **no responde absolutamente nada** |
  | **Bot** | Responde **24/7**, pero **no escala 24/7**: fuera de horario, el escalamiento espera a la mañana siguiente |
  | **Temas vedados al bot** | Quejas de servicio mal hecho, reclamos de dinero, precios especiales y clientas en lista roja |
  | **Transparencia** | **No se revela** que es un asistente automático |
  | **Escalamiento** | Llega a la **Dueña o a la Encargada**, y debe poder **reasignarse** entre ellas |
  | **Identidad** | Un mismo número puede corresponder a **varias clientas** (madre e hija). Desde un número nuevo se pide **nombre y número anterior**. La lista roja es **global** entre sucursales |
  | **Citas simultáneas de dos amigas** | **Dos citas independientes**, no un bloque atómico |
  | **Segunda cita futura** | Permitida; **se avisa en el mismo mensaje** que ya tiene otra próxima |
  | **Menores** | Se atienden, **sin autorización** |
  | **Especialización** | **No existe**: todas las manicuristas hacen todos los servicios |
  | **Números de WhatsApp** | **Uno por sucursal**, confirmado. Se **conservan** los actuales (tienen clientas reales); la migración está sin resolver |

---

### DEC-043 — API oficial de Meta en exclusiva y Bandeja Compartida como canal único
**Estado actual:** `CLOSED` (decisión técnica del cliente, 2026-10-09). **Resuelve `ADR-008` y `P7`**, abiertos desde el inicio del proyecto. Sustituye a `DEC-038`.
**Historial:**
- **2026-10-09:** *"el riesgo de baneo por usar APIs no oficiales (como Baileys o Evolution API) es inaceptable. El sistema Blanc utilizará estrictamente la API Oficial de Meta (Cloud API). Entendemos y aceptamos que esto desconecta los números de las apps móviles nativas de WhatsApp Business."*

  **Revierte una petición previa del propio cliente.** El 2026-08-03 (`DISCOVERY_CHECKLIST.md` 1.29) había pedido **dos adaptadores configurables** — *"que exista la posibilidad de usar las dos… en la configuración decidamos"*. Esa petición **queda anulada**: habrá un solo adaptador. Se registra para que nadie reabra el doble adaptador creyendo que sigue vigente. `ADR-008` pasa a `Accepted` con "Enmienda 1" y recupera su `Decision` original sin reescritura.

  **Por qué elimina el problema en vez de resolverlo:** dar de alta un número en la Cloud API **lo desconecta de la app de WhatsApp Business**. Si la app no puede emitir, no existe un segundo emisor: la colisión bot/humano que `DEC-038` detectaba se vuelve **imposible por construcción**. Además, el historial de conversación pasa a ser completo —todo el tráfico cruza el backend— y la autoría de cada mensaje es directa en vez de inferida.

  🔴 **La consecuencia que cambia el plan de entrega:** hasta ahora el handoff humano tenía una red de seguridad implícita — si el panel de Blanc fallaba, el equipo seguía teniendo WhatsApp en el celular. **Esa red desaparece.** El panel queda como el **único lugar desde el que se puede responder a una clienta**. Por tanto:
  - La **Bandeja Compartida** deja de ser una comodidad de Fase 4 y pasa a ser **condición de puesta en marcha**.
  - **Ningún número puede migrarse antes de que la bandeja esté en producción y probada.** El momento de la migración es exactamente aquel en que el celular deja de servir; invertir ese orden deja al salón incomunicado.

  **La ventana de 24 horas pasa a ser restricción dura.** Fuera de ella solo se puede escribir con plantilla preaprobada y de pago. Choca con tres flujos ya aprobados: los recordatorios de 24h (obligatorios según la Dueña), los avisos de lista de espera (`DEC-042`) y los escalamientos que *"esperan a mañana"* — si una clienta escribe el sábado por la noche y se le responde el lunes, la respuesta humana ya no es libre.

  **El historial existente no migra.** No hay mecanismo por API para trasladar los hilos que hoy viven en los celulares. Blanc arranca con historial vacío por clienta. La Dueña había anticipado la duda (*"probablemente se tenga que hacer migración o si no ver la manera"*); la respuesta honesta es que **no hay manera por API**.

  **Riesgo que cambia de naturaleza, no desaparece:** se elimina el riesgo de bloqueo de número por protocolo no oficial —motivo central de `ADR-008`— y a cambio aparece una **dependencia operativa total del panel**. Una caída ya no degrada el servicio: lo interrumpe, porque no queda canal alternativo. Debe tratarse como tal en `ADR-011` y `ADR-012`.

  **Detalle completo:** `docs/architecture/WHATSAPP_ARQUITECTURA_CANAL.md`.

---

### DEC-044 — El Bot es un *principal de sistema*, no un octavo rol
**Estado actual:** `CLOSED` en cuanto a la decisión; **construcción diferida a Fase 4 a propósito** (ver abajo). Resuelve la deuda 6 de §16.
**Historial:**
- **2026-10-14:** al definir el RBAC de las operaciones que ejecutará el Bot de WhatsApp, la opción obvia era añadir `Rol.BOT` al enum. **Se rechazó por dos motivos independientes.**

  **(1) Habría sido una desviación silenciosa de una decisión aceptada.** El catálogo de 7 roles es **cerrado** por `RN-SEG-01` y `functional-scope.md` §2, y `ADR-024` lo ratificó explícitamente al elegir el `Rol` enum estático frente a una tabla de permisos dinámica. Ampliar el enum exige una ADR nueva que modifique esos documentos, nunca un valor más.

  **(2) Es incorrecto de fondo, no solo formalmente.** Los 7 roles describen **personas**: tienen alcance de sucursales, jerarquía de asignación (`puedeAsignarRol`), un registro en `identidad_accesos.usuarios` y alguien a quien responsabilizar. El bot no tiene ninguna de esas cosas. Meterlo en el mismo enum obligaría además a que **cada `@Roles(...)` ya escrito** tuviera que preguntarse si incluye al bot — un coste que se paga en todo el código a cambio de nada.

  **Decisión:** el Bot es un **principal de sistema**, un concepto separado. `shared/auth/principal-de-sistema.ts` fija la lista cerrada de operaciones que podrá ejecutar (`OPERACIONES_PERMITIDAS_AL_BOT`), **todas de lectura**: `DEC-042` establece que ninguna clienta cancela sola y `DEC-040` que la finalización no es automática, así que un bot con capacidad de escritura contradiría ambas. Agendar por WhatsApp llegará, pero es una decisión de negocio que **no está tomada**; cuando se tome, se añade ahí con su propia ADR.

  **Lo que Fase 4 debe construir:** (a) autenticación propia del principal (token de servicio con rotación), separada de Supabase Auth — el bot no es un usuario de Supabase; (b) un guard que lo contraste contra la lista de operaciones y **nunca** contra `@Roles`; (c) auditoría con el principal como `actor`, distinguible de una persona, porque `RN-AUD-01` exige saber quién hizo qué y *"lo hizo el bot"* es una respuesta distinta de *"lo hizo la Encargada"*.

  🔵 **Lo que deliberadamente NO se construyó, y es revocable:** no se emitió credencial ni se abrió ningún endpoint al bot. El canal de WhatsApp es de Fase 4 y no existe; una vía de autenticación viva, sin consumidor y sin nadie ejercitándola en serio, es superficie de ataque a cambio de nada. **La postura efectiva hoy es denegar**, y `shared/auth/principal-de-sistema.spec.ts` lo verifica junto con el cierre del enum de roles — convierte "el catálogo es cerrado" en algo que falla el build, en vez de un comentario. Si se prefiere construir ya el token de servicio, es una orden de trabajo pequeña y aislada, pero debería justificarse con un consumidor real.

---

---

## 6. Elementos explícitamente `OUT_OF_SCOPE` (por incremento, no en general)

No son "no implementados a secas" — son exclusiones deliberadas y ya verificadas contra la documentación/código real:

| Elemento | Fuera de alcance de | Por qué no es simplemente "pendiente" |
|---|---|---|
| Integración con Supabase (invitación, hook, `admin.signOut`) | `FL-SEG-01`, `FL-SEG-03`, `FL-SEG-04`, `FL-SEG-05` | Pertenece íntegramente a `FL-SEG-06` — no es una pieza olvidada, es un flujo distinto por diseño |
| `supabase_user_id` en `usuarios` | Todos los incrementos hasta ahora | Solo tiene sentido cuando exista una llamada real a Supabase que correlacionar (`FL-SEG-06`). Forma ya decidida (`DEC-021`: `UUID UNIQUE NULLABLE`), columna todavía no creada — decisión cerrada, implementación fuera de alcance |
| `refresh_tokens` como tabla propia | Todo el proyecto | `REJECTED`, no `OUT_OF_SCOPE` de un incremento — decisión de arquitectura permanente (`ADR-024`, DEC-003), no "todavía no" |
| Lookup de autorización por request (verificar `activa`/rol contra BD en cada request) | Todo el proyecto, mientras `ADR-010` no cambie | `REJECTED` — reabriría una alternativa ya descartada en `ADR-010` (sesión server-side pura) |
| MFA | `FL-SEG-01` a `FL-SEG-05` | Pertenece a `FL-SEG-07` |
| Reactivar usuario | `FL-SEG-05` | `DEFERRED` (ver DEC-011), distinto de `OUT_OF_SCOPE` — sí se espera construir eventualmente |
| `roles`/`permisos` como tablas | Todo el proyecto | `REJECTED` (DEC-002), decisión permanente, no un incremento futuro |
| `usuarios_sucursales` al crear/editar usuario | `FL-SEG-01`, `FL-SEG-03` | Pertenece a `FL-SEG-04`, ya construido por separado |
| `estado`/`mfa_habilitado` en la tabla `usuarios` al momento de `FL-SEG-01/03` | `FL-SEG-01`, `FL-SEG-03` | `mfa_habilitado` sigue `OUT_OF_SCOPE` (pertenece a `FL-SEG-07`); `estado`(`activa`) ya se incorporó en `FL-SEG-05` |
| Corrección de la inconsistencia de nivel 2 en Manicuristas | Todas las iteraciones de Identidad hasta ahora | `BLOCKED` (DEC-014), no `OUT_OF_SCOPE` — identificada, pendiente de autorización, no descartada |
| Redis, colas, workers, cache, microservicios | Todo el proyecto, mientras Postgres + NestJS resuelvan el problema | Nunca se propuso construirlos — no hay una decisión que registrar más allá del principio de costo operativo ya vigente |

---

## 7. Riesgos `ACCEPTED_RISK`

### Riesgo: desactivación sin revocación efectiva
`FL-SEG-05` establece `activa=false` en `identidad_accesos.usuarios`, pero mientras `FL-SEG-06` no exista, **nada en el sistema consulta esa columna para autorizar** — ni `JwtAuthGuard`, ni ningún hook de claims (que no existe todavía). Un usuario desactivado conserva acceso completo hasta que su access token expire naturalmente, y puede seguir refrescando su sesión indefinidamente.
**Estado:** `ACCEPTED_RISK`, no un bug de `FL-SEG-05` — es una consecuencia explícita y documentada del alcance por etapas, aceptada conscientemente por el cliente (2026-08-23).
**Mitigación futura:** `FL-SEG-06` (y que el mecanismo de claims que ahí se construya efectivamente respete `activa`).

### Riesgo: el sistema conoce lo COTIZADO, no lo EJECUTADO — `ACCEPTED_RISK` (2026-10-09)

`DEC-040` fija que el iPad de la manicurista es de solo lectura y que ella **anota los servicios realmente prestados en un Excel, fuera de la plataforma**. La Dueña confirma además que una clienta puede **añadir un servicio ya sentada** (*"se hace ahí mismo"*) y que el sobretiempo **no se registra**.

**Consecuencia:** el `cotizacion_snapshot` de una cita es lo que se *estimó al agendar*, no lo que se *hizo ni lo que se cobró*. Cualquier cifra de ingresos o productividad que salga de la plataforma es una **estimación**, no un hecho contable.

**Por qué se acepta:** cerrar la brecha exigiría que la manicurista capture en el sistema, lo que la Dueña descartó explícitamente —el iPad no hace mutaciones y el registro offline en Excel es el flujo real del negocio.

**Dónde duele más adelante:** el módulo de **Analítica** (Fase 6) hereda este techo. Antes de construirlo hay que decidir conscientemente si sus reportes se presentan como estimaciones o si el Excel debe incorporarse de alguna forma.

### Riesgo: el bloqueo duro de baja de manicurista no protege nada — ~~`ACCEPTED_RISK`~~ **CERRADO (2026-10-14)**

`DEC-032` exige rechazar la baja de una manicurista con citas futuras, y `DesactivarManicuristaUseCase` ya consulta `VerificarCitasFuturasPort` para hacerlo. Pero el puerto lo satisface `SinAgendaVerificarCitasFuturasAdapter`, un sustituto temporal que **siempre responde `false`**.

**Hoy es inofensivo y literalmente correcto:** el Bounded Context *Agenda* no existe, no hay tabla de citas, luego no puede haber citas futuras. **Deja de serlo en el instante en que Fase 2 cree la primera cita**, y entonces el bloqueo duro queda desactivado en silencio.

**Mitigación:** el riesgo se registró en tres sitios — el comentario del adaptador, su propia prueba (que fijaba el comportamiento a propósito para que sustituirlo rompiera el test) y esta entrada.

> **CERRADO el 2026-10-14.** `AgendaVerificarCitasFuturasAdapter` consulta `agenda.citas` de verdad, vía el puerto que `AgendaModule` expone. El sustituto **se eliminó**, no se conservó de respaldo. Cubierto por 13 pruebas de integración que recorren el camino completo (caso de uso → puerto → repositorio → PostgreSQL), incluida una por cada uno de los nueve estados. `madge --circular`: 0 ciclos pese a la nueva dependencia `SucursalesYPersonal → Agenda`.

### Riesgo: `pg-mem` no revierte transacciones de verdad
Verificado empíricamente (hardening 2026-08-11) — `pg-mem` acepta `BEGIN`/`ROLLBACK` sin error pero no revierte los datos. Las pruebas de atomicidad de este proyecto prueban la orquestación del código (`UnitOfWork`), no que Postgres real revierta.
**Estado:** `ACCEPTED_RISK`, documentado en `03-technical-architecture.md` §8.5.
**Mitigación futura:** validación contra Postgres/Supabase real, sin fecha todavía (requiere credenciales que no existen en este entorno).

### Riesgo: SSL/pooling/Supavisor/migraciones reales sin validar
Ningún `DATABASE_URL` real disponible en este entorno de desarrollo — el código de conexión existe pero no se ha probado contra el proyecto Supabase real.
**Estado:** `ACCEPTED_RISK`, documentado desde el hardening de Sucursales y Personal.
**Mitigación futura:** tarea de verificación de Fase 1, sin bloquear desarrollo (`ARCHITECTURE_CLOSURE_PLAN.md`, P1).

### Riesgo: mecanismo de claims de `ADR-024` sin verificar contra Supabase real — ~~vigente~~ **CERRADO (2026-09-14)**
Ver DEC-001. La recomendación técnica (Custom Access Token Hook) está basada en documentación pública, cruzada por múltiples fuentes, pero nunca confirmada contra el proyecto real de Blanc.
**Estado original:** `ACCEPTED_RISK` temporal — bloquea formalmente cerrar `ADR-024` (sigue `Proposed`), no bloquea el trabajo ya hecho.
**Cierre (2026-09-14):** este riesgo **desaparece**, no se mitiga: `DEC-029` (C2) descarta el Custom Access Token Hook, por lo que ya no existe ningún mecanismo pendiente de verificar. El texto original se conserva como registro. **Riesgo que lo sustituye:** la dependencia de PostgreSQL en el camino de autorización (ver `DEC-029`, costos aceptados, y la Enmienda 1 de `ADR-010`).

---

## 8. Dependencias

```
FL-SEG-05 (activa=false, registro administrativo)
    │
    ▼
FL-SEG-06 (integración real con Supabase Auth — invitación, hook de claims, admin.signOut)
    │
    ▼
Revocación efectiva de acceso (el hook debe leer `activa` al emitir/refrescar el JWT)
```

```
FL-SEG-06 (Supabase real)
    │
    ▼
FL-SEG-07 (MFA — el mecanismo concreto depende de lo que Supabase Auth exponga)
```

```
Corrección de nivel 2 en Manicuristas (DEC-014)
    │
    ▼
Requiere autorización explícita del cliente — no depende de ningún otro flujo técnico, solo de esa autorización
```

```
Pregunta 11 (OWNER_DECISION_LOG.md, DEC-017)
    │
    ▼
Cierre completo del modelo de permisos de Identidad (no bloquea flujos ya implementados)
```

---

## 9. Qué falta para considerar la plataforma lista para entrega

**No se duplica aquí** el detalle de `ARCHITECTURE_CLOSURE_PLAN.md` (P1-P10, general para todo el proyecto, no solo Identidad) — se referencia su estado tal como ya está documentado ahí: P1/P2 `Resueltos`, P3-P9 `Abiertos` (máquinas de estado, invariante de capacidad, ADRs de webhook/retención, sign-off `ADR-008`, contratos de API restantes, columna `manicurista_recurso_id`).

**Específico de Identidad, no cubierto por ese plan:**
- `FL-SEG-06`/`FL-SEG-07` sin construir — Identidad no tiene autenticación real operativa todavía. `FL-SEG-06` ya tiene 5 decisiones técnicas de preparación cerradas (`DEC-021`-`DEC-025`, ver §10) — incluido su alcance exacto (`DEC-025`: Solo Provisionar).
- **Hallazgo crítico 2026-08-24/25:** el proyecto Supabase real de Blanc firma JWT con ES256/JWKS, no con HS256 como `ADR-024` asumía — `DEC-001` (el Custom Access Token Hook) reclasificado de `OPEN`/`REQUIRES_EXTERNAL_ACCESS` a **`REQUIRES_REDESIGN`**, sigue sin cerrar. **`DEC-026` (la capacidad de `JwtAuthGuard` de verificar ES256/JWKS en sí) ya está `IMPLEMENTED`** (2026-08-25) — 168/168 tests, validado parcialmente contra el proyecto real (sin login completo, sin credenciales de prueba disponibles). `audience` real del JWT **ya está confirmado** (`DEC-027`, `CLOSED` 2026-09-09: `aud = "authenticated"`, verificado contra dos JWT reales — emisión inicial y renovación).
- **Modelo de autorización resuelto (2026-09-14):** `DEC-029` adopta **C2** — PostgreSQL de Blanc consultado en cada request para obtener `rol`/`activa`/`sucursales` — y deja `DEC-001` (Custom Access Token Hook) como `SUPERSEDED`. `ADR-010` recibió su **Enmienda 1** formalizando el cambio. **Decidido, NO implementado**: ver `DEC-029` para los 4 prerequisitos duros.
- `ADR-024` sigue `Proposed`. Su **Decisión 1 (el hook) queda superada** por `DEC-029`; sus Decisiones 2 (`Rol` enum) y 3 (sin `refresh_tokens` propia) siguen vigentes e implementadas. El ADR no se reescribe.
- DEC-007 (invariante Super Admin), DEC-011 (reactivar), DEC-014 (Manicuristas), DEC-015 (Manicurista-cuenta), DEC-017 (Pregunta 11), DEC-020 (duración de token) — sin cerrar. `DEC-025` (cerrada 2026-08-23) y `DEC-027` (cerrada 2026-09-09) ya no pertenecen a esta lista.

---

## 10. `FL-SEG-06` — Preparación (2026-08-23)

Esta sección separa explícitamente lo que ya puede verificarse contra el repositorio de lo que solo puede verificarse contra el proyecto Supabase real de Blanc — ninguna fila de la segunda tabla se marca `IMPLEMENTED` ni se asume su resultado.

### 10.1 Ya verificado en el repositorio

| Elemento | Estado verificado |
|---|---|
| `JwtAuthGuard` (verificación de firma/expiración, forma de claims) | `IMPLEMENTED`, probado (155/155 incluye su suite) |
| Estructura esperada de claims (`rol`, `sucursales`, `sub`) | `IMPLEMENTED` en el lado de verificación — `rol.ts`, `jwt-auth.guard.ts` |
| RBAC nivel 1 (`RolesGuard`, `@Roles`) | `IMPLEMENTED` |
| RBAC nivel 2 existente (`puedeAsignarRol`, `tieneAlcanceSucursal`) | `IMPLEMENTED`, usado en `FL-SEG-01/03/04/05` |
| SDK/adapter/provider de Supabase | **Ausente** — cero dependencias `@supabase/*` en `package.json` (verificado por grep) |
| Custom Access Token Hook | **Ausente** — ninguna función Postgres, ninguna migración |
| Admin API de Supabase (invite/`signOut`/`ban_duration`) | **Ausente** — ninguna llamada real, solo menciones en comentarios/documentación |
| `supabase_user_id` | **Ausente** en el schema real — solo anticipado en un comentario (`identidad-accesos.schema.ts:7`) y ahora decidido en forma (`DEC-021`), no implementado |
| `refresh_tokens` (tabla propia) | **Ausente**, por decisión permanente (`DEC-003`, `REJECTED`), no por omisión |
| Estado actual de `FL-SEG-05` | `IMPLEMENTED`, solo `activa=false` administrativo, sin ningún efecto sobre Supabase (confirmado, no toca ninguna API externa) |
| Suite de tests | 155/155, 28 suites |
| `tsc --noEmit` | Limpio |
| `nest build` | Limpio |
| ESLint | Limpio |
| `madge --circular` | 0 ciclos, 103 archivos |

### 10.2 No verificable sin acceso al proyecto Supabase real — `REQUIRES_EXTERNAL_ACCESS`

**Verificación explícita de acceso realizada (2026-08-23, segunda auditoría):** se comprobó activamente, no se asumió, que este entorno no tiene ningún camino hacia el proyecto Supabase real — sin herramientas MCP de Supabase disponibles (`ToolSearch` sin resultados), sin CLI de Supabase instalado, sin variables `SUPABASE_*` en el entorno del shell, sin `.env` real (solo `.env.example` con placeholders), sin `supabase/config.toml` en el repositorio. Los 11 puntos de verificación pedidos (proyecto/entorno, plan/tier, disponibilidad del hook, configuración actual de emisión de JWT, existencia de un hook actual, funciones Postgres de claims, disparo en refresh, mecanismos de revocación reales, comportamiento de `admin.signOut`, disponibilidad de `ban_duration`, limitaciones que invaliden `ADR-024`) permanecen **sin verificar, ninguno parcialmente** — no se simuló ningún resultado.

| Elemento | Por qué no es verificable desde aquí | Qué debe verificarse cuando haya acceso |
|---|---|---|
| Disponibilidad de Auth Hooks en el plan contratado | Depende del plan/tier real de Supabase de Blanc, no documentado ni consultable desde este entorno | Confirmar en el Dashboard del proyecto real antes de aprobar `ADR-024` |
| Configuración real del proyecto (Dashboard/`config.toml`) | No existe proyecto real conectado a este repositorio | Configurar y probar el Custom Access Token Hook contra el proyecto real |
| Comportamiento real del Custom Access Token Hook, incluido su disparo en `token_refresh` | Documentado públicamente (`ADR-024`, fuentes citadas), nunca confirmado contra el proyecto de Blanc | Probar un cambio de rol/sucursal y confirmar que el siguiente refresh trae el claim actualizado |
| `JWT_SECRET` real | Vive en el proyecto Supabase real, no en este repositorio (`.env.example` solo tiene un placeholder) | Nunca debe versionarse — se configura como variable de entorno en Railway/Supabase |
| Admin API real (`admin.signOut`, `ban_duration`) | Sin proyecto real ni credenciales de servicio disponibles aquí | Confirmar comportamiento exacto (alcance `local`/`global`, tiempo de aplicación) contra el proyecto real |
| Comportamiento end-to-end (login → claims → guard → autorización) | Requiere una cuenta y un proyecto Supabase reales | Prueba manual/E2E contra un proyecto Supabase de desarrollo, no simulable con `pg-mem` |
| Latencia real del hook bajo carga | Sin proyecto real que medir | Medir contra el proyecto real antes de asumir el límite documentado (2s) como no-problema |

### 10.3 Alcance confirmado del primer incremento — `DEC-025` CLOSED (2026-08-23)

**Decisión: (A) Solo Provisionar.** Crear/invitar/vincular una cuenta de Supabase Auth para un usuario que **ya existe** en `identidad_accesos.usuarios`. Ver `DEC-025` (§5) para el historial completo, incluida la lista explícita de exclusiones (Sincronizar, importación inversa, reconciliación masiva, sincronización bidireccional, login, MFA, Outbox, cambios a `FL-SEG-01/03/04/05`). **La columna de correlación (`DEC-021`) no se crea en esta iteración** — sigue siendo una decisión de forma, no una implementación.

### 10.4 Fuente de verdad de autorización — cadena confirmada (`DEC-024`)

```
Blanc PostgreSQL (identidad_accesos.usuarios / usuarios_sucursales)  ← fuente de verdad
    │
    ▼
[SUPERADO 2026-09-14] Custom Access Token Hook — DEC-001 SUPERSEDED por DEC-029 (C2).
Bajo C2 este eslabón desaparece: rol/sucursales NO viajan en el JWT; se leen de
PostgreSQL en cada request, en una capa entre JwtAuthGuard y RolesGuard.
    │
    ▼
JWT emitido/refrescado por Supabase  ← snapshot firmado, NO fuente de verdad
    │
    ▼
JwtAuthGuard (IMPLEMENTED — valida firma/expiración/forma, no consulta BD)
    │
    ▼
request.usuario (claims del snapshot)
    │
    ▼
RolesGuard / nivel 2 (IMPLEMENTED — autoriza contra el snapshot, no contra el estado actual de Blanc DB)
```

**Consecuencia ya documentada, no nueva (`PROJECT_STATUS.md` §7, riesgo de revocación):** un cambio en Blanc DB (ej. `activa=false`) no se refleja en `request.usuario` hasta el siguiente snapshot (próximo login/refresh) — y hoy ni siquiera eso ocurre, porque el hook que produciría ese nuevo snapshot no existe. **Esta cadena confirma el principio de dónde vive la verdad, no resuelve por sí sola la revocación efectiva** — eso sigue dependiendo de que `FL-SEG-06` implemente el hook y, potencialmente, una llamada de revocación activa a Supabase. No se declara aquí que `FL-SEG-06` resolverá la revocación de forma definitiva — solo que es la pieza que puede empezar a resolverla, sujeta a verificación contra Supabase real (§10.2).

### 10.5 Checklist operacional — Supabase Auth (para cerrar `DEC-001`)

> **Nota (2026-09-14):** `DEC-001` quedó `SUPERSEDED` por `DEC-029` (C2), por lo que **los puntos 8-11 de esta checklist —los referidos a configurar y probar el hook— ya no aplican**: ese mecanismo no se construirá. Los puntos 1-7 siguen siendo verificaciones útiles del proyecto Supabase y sus resultados registrados abajo conservan su validez. La checklist no se borra: documenta qué se verificó y qué dejó de ser necesario.

**Actualizado 2026-08-24/25 — 6 de 11 puntos ya verificados con evidencia real (Dashboard, por el cliente; endpoints públicos, por Claude vía `WebFetch` de solo lectura), el resto sigue pendiente.**

| # | Verificar | Cómo | Resultado esperado | Resultado real |
|---|---|---|---|---|
| 1 | Proyecto/entorno correcto | Dashboard | Identidad del proyecto confirmada | **PASS** — Proyecto "Blanc", Reference ID `<PROJECT_REF>` |
| 2 | Plan/tier contratado | Dashboard → Settings → Billing | Confirmar si el plan incluye Auth Hooks | **PASS** — Plan Pro |
| 3 | Disponibilidad del Custom Access Token Hook | Dashboard → Authentication → Hooks | Debe aparecer como configurable | **PASS** — disponible, no configurado todavía |
| 4 | Configuración actual de Auth | Dashboard → Authentication → Settings | Documentar el estado actual | Pendiente — no relevado en detalle todavía |
| 5 | Configuración actual de JWT | Dashboard → Authentication → JWT Settings | Confirmar algoritmo | **PASS con hallazgo crítico** — `CURRENT` = ECC P-256 (ES256), no HS256 como se asumía; `PREVIOUSLY USED` = Legacy HS256. Confirmado además vía endpoint público (`jwks.json`): una sola clave publicada, ES256, `kid: 0dd96720-c81d-4406-a2de-fe6bed0f4cd8`. Ver `DEC-001`/`DEC-026` |
| 6 | Existencia de hooks ya configurados | Dashboard → Authentication → Hooks | Ninguno en conflicto | **PASS** — ninguno creado |
| 7 | Funciones Postgres existentes relacionadas con Auth/claims | `SELECT * FROM pg_proc WHERE pronamespace = 'auth'::regnamespace` | Sin función en conflicto | Pendiente — la consulta SQL no se ejecutó (solo se consultaron endpoints públicos HTTP, no SQL Editor) |
| 8 | Capacidad del hook para consultar `identidad_accesos.usuarios`/`usuarios_sucursales` | Función de prueba vía SQL Editor | Permiso `SELECT` confirmado | Pendiente — además requiere que el esquema `identidad_accesos` ya exista en este proyecto real (no confirmado que las migraciones de Blanc se hayan aplicado aquí) |
| 9 | Lectura correcta de `activa` | Parte de la prueba anterior | Tipo/valor legibles sin conversión | Pendiente, depende de 8 |
| 10 | Disparo del hook en login/refresh | Requiere crear un hook de prueba + login/refresh reales | Confirmar `token_refresh` como valor observado | Pendiente — ningún hook creado todavía (correctamente, per instrucción explícita) |
| 11 | Formato real de los claims resultantes | Decodificar un JWT tras el hook | Forma esperada por `JwtAuthGuard`/`rol.ts` | Pendiente, depende de 10 |

**Adicional, no estaba en la lista original, verificado en esta iteración (evidencia nueva, ver `DEC-001`/`DEC-026`):** `issuer` real = `https://<PROJECT_REF>.supabase.co/auth/v1`; `jwks_uri` real confirmado, derivable de `SUPABASE_URL`; `audience` real = **`authenticated`**, confirmado después contra JWT reales (`DEC-027`, `CLOSED` 2026-09-09 — no estaba confirmado cuando se escribió esta línea).

### 10.6 Checklist de verificación — cadena de revocación (`FL-SEG-05 → activa=false → Supabase → acceso revocado`)

Igualmente, ninguna acción ejecutada — solo la definición de cómo probarlo cuando corresponda.

| # | Qué probar | Cómo verificarlo (sin ejecutarlo todavía) | Qué determina |
|---|---|---|---|
| 1 | `admin.signOut` — comportamiento real | Con una cuenta de prueba (no productiva), invocar desde un script aislado fuera de este repositorio y observar el estado de sus tokens antes/después | Si revoca refresh tokens de inmediato, como documenta la Admin API |
| 2 | `ban_duration` — comportamiento real | Igual que arriba, con `admin.updateUserById` | Si bloquea logins nuevos durante la ventana indicada |
| 3 | Scope `local` vs. `global` de `signOut` | Probar ambos scopes con sesiones abiertas en más de un "dispositivo" simulado (dos clientes distintos con el mismo usuario) | Confirmar cuál scope revoca todas las sesiones vs. solo una |
| 4 | Comportamiento de un access token ya emitido tras `signOut`/`ban_duration` | Guardar un access token antes de revocar, intentar usarlo contra un endpoint protegido después | `ADR-024`/`IDENTIDAD_PRE_ARRANQUE.md` predicen que sigue siendo válido hasta expirar — esta prueba lo confirma o lo refuta contra el proyecto real |
| 5 | Comportamiento del refresh token tras revocación | Intentar refrescar con el refresh token ya emitido, después de `signOut` | Debe fallar — confirma que la revocación al menos corta la vía de renovación |
| 6 | Qué ocurre inmediatamente después de `activa=false` en Blanc, sin ninguna llamada a Supabase | Cambiar `activa` directamente en la base de datos de prueba y repetir un request autenticado con un token ya emitido | Confirma (o refuta) que hoy no hay ningún efecto — consistente con el riesgo ya documentado en §7 |
| 7 | Qué ocurre después de una revocación real en Supabase (una vez `FL-SEG-06`/futuro `FL-SEG-05`+integración exista) | Repetir la prueba del punto 4 en el contexto real de desactivación | Confirma el límite real de la mitigación, no solo el documentado públicamente |
| 8 | Qué ocurre cuando el usuario intenta refrescar sesión tras la desactivación | Combinación de los puntos 5 y 6 | Determina si el siguiente refresh (si el hook existe) trae un claim reflejando `activa=false`, o si simplemente el refresh falla por la revocación |
| 9 | Qué ocurre cuando intenta usar un access token previamente emitido tras la desactivación | Combinación de los puntos 4 y 6 | Determina la ventana de exposición real, no la teórica — el número exacto de minutos que un usuario desactivado conserva acceso |

**Nota explícita:** ninguna de estas pruebas debe ejecutarse contra el proyecto de producción de Blanc sin una cuenta de prueba dedicada — no se define aquí el entorno donde correrán (dev/staging de Supabase), porque esa es una decisión de infraestructura que tampoco se toma en esta iteración.

### 10.7 Credenciales y configuración requeridas — sin valores, sin secretos

| Variable | Para qué | Dónde debe configurarse | Qué nunca debe ocurrir |
|---|---|---|---|
| `SUPABASE_URL` (convención `DEC-023`) | Endpoint del proyecto Supabase de Blanc, usado por el futuro cliente Admin API | Variables de entorno del proceso (Railway en producción; `.env` local **no versionado**, ya excluido de git) | Nunca en `.env.example` con un valor real, nunca en ningún archivo versionado, nunca en este documento |
| `SUPABASE_SERVICE_ROLE_KEY` (convención `DEC-023`) | Autenticación de la Admin API (crear/invitar usuarios, `signOut`, `ban_duration`) | Igual que arriba — es el secreto de mayor privilegio del proyecto Supabase, tratar con el mismo rigor que `JWT_SECRET` | Igual que arriba — adicionalmente, nunca debe quedar en logs de aplicación ni en mensajes de error |
| `JWT_SECRET` (ya existente, `resolverJwtSecret()`) | Verificación de firma de los JWT que Supabase emite | Igual que arriba — mecanismo ya implementado (`shared/auth/jwt-secret.ts`), solo falta el valor real | Ya protegido por diseño (`resolverJwtSecret()` falla duro sin él fuera de test) — el riesgo pendiente es solo el valor real, no el mecanismo |

Ninguna de las tres se agrega a `.env.example` con un valor real — ese archivo solo declara nombres, nunca valores. El criterio aplicado es agregar cada placeholder **solo cuando exista código que lo consuma** (mismo principio ya aplicado a `identidad_accesos` en `drizzle.config.ts`, `IDENTIDAD_PRE_ARRANQUE.md` §5). **Estado real (actualizado 2026-09-13):** `DATABASE_URL`, `JWT_SECRET` y `PORT` ya estaban declarados; **`SUPABASE_URL` se agregó como placeholder vacío al implementar `DEC-026`**, que efectivamente lo consume para derivar `issuer` y `jwks_uri`. **`SUPABASE_SERVICE_ROLE_KEY` sigue sin declararse**, porque todavía no existe código que la use — se agregará cuando se implemente `FL-SEG-06`.

### 10.8 Modelo de correlación — funcionamiento conceptual (`DEC-021`, sin implementar)

```
identidad_accesos.usuarios.id (UUID, PK, ya existe)
        │
        │  1:0..1 — un usuario Blanc puede no tener todavía cuenta Supabase
        ▼
identidad_accesos.usuarios.supabase_user_id (UUID, UNIQUE, NULLABLE — DEC-021, no creada)
        │
        │  referencia lógica, sin FK cruzada real (ADR-005: sin FKs entre esquemas/sistemas)
        ▼
auth.users.id (UUID, en el proyecto Supabase — fuera del control de Blanc)
```

**Reglas de integridad a verificar durante la futura implementación (no implementadas aquí):**
- `UNIQUE` en `supabase_user_id` — evita que dos usuarios Blanc apunten a la misma cuenta Supabase (mismo patrón ya usado en `usuarios.email`).
- `NULLABLE` es el estado por defecto — todo usuario creado por `FL-SEG-01` nace sin `supabase_user_id`; la ausencia no es un error, es el estado esperado antes de "Provisionar".
- **No hay FK real hacia `auth.users`** (`ADR-005` ya establece que Blanc no crea FKs cruzadas — aquí el "cruce" es incluso más fuerte, entre sistemas distintos, no solo esquemas) — la integridad referencial hacia Supabase es responsabilidad del caso de uso de Provisionar en el momento de escribir, no de una constraint de base de datos.
- **Idempotencia de la escritura:** el futuro caso de uso debe verificar `supabase_user_id IS NOT NULL` antes de provisionar de nuevo (ver §10.9, punto 12) — la propia columna `UNIQUE` es la última barrera, no la primera.

### 10.9 Flujo futuro de "Provisionar" — descrito, no implementado

1. **Usuario Blanc ya existe** — precondición, verificada por `buscarPorId()` (patrón ya usado en los 5 casos de uso existentes).
2. **Validaciones de autorización** — mismo patrón nivel 1 (`@Roles(SUPER_ADMIN, ADMINISTRADOR)`) + nivel 2 si aplica (a evaluar en la futura auditoría de alcance mínimo — no decidido aquí si Provisionar necesita `tieneAlcanceSucursal`).
3. **Verificación de estado** — ¿se puede provisionar un usuario con `activa=false`? No decidido — candidato a decisión explícita en la futura auditoría, no asumido aquí.
4. **Verificación de `supabase_user_id` existente** — si ya tiene uno, la operación debe ser un no-op idempotente (mismo patrón que `DesactivarUsuarioUseCase`, `DEC-013`) o un error explícito — tampoco decidido cuál de los dos, a definir en la futura auditoría.
5. **Llamada a Supabase Admin API** — **`createUser`, sin contraseña (`DEC-028`, 2026-09-13)**; la alternativa `inviteUserByEmail` quedó descartada, ver esa entrada. Ocurre fuera de cualquier transacción de PostgreSQL, por la misma razón ya documentada en `IDENTIDAD_PRE_ARRANQUE.md` §2 (`UnitOfWork` no cubre llamadas HTTP externas).
6. **Manejo de la respuesta** — éxito devuelve el `id` de `auth.users` a persistir; fallo no debe dejar ningún cambio a medias en Blanc.
7. **Persistencia de `supabase_user_id`** — `UPDATE` simple sobre el registro ya existente, dentro de `unitOfWork.ejecutar` (solo la parte de Blanc).
8. **Auditoría** — mismo patrón ya usado en los 5 casos de uso existentes (`shared/auditoria/`), sin incluir el email en el detalle (mismo criterio de minimización ya aplicado en `FL-SEG-01`).
9. **Manejo de errores cross-system** — ver §10.10, no se inventan garantías transaccionales que no existen.
10. **Idempotencia** — el punto 4 es la primera barrera; un reintento tras un fallo de red en el paso 5 no debe crear una segunda cuenta de Supabase para el mismo usuario. **Precisado por `DEC-028` (2026-09-13): el happy path NO consulta Supabase por email** — el `id` se toma de la respuesta de `createUser`. La política de adopción/recuperación para el camino no feliz (cuenta ya existente en Supabase, o creada pero sin persistir en Blanc) queda **`PENDIENTE`**, deliberadamente fuera de `DEC-028`.
11. **Si Supabase crea el usuario pero Blanc falla al guardar `supabase_user_id`:** queda una cuenta de Supabase "huérfana" (sin `supabase_user_id` persistido en Blanc) — exactamente el Escenario 1 ya identificado en `IDENTIDAD_PRE_ARRANQUE.md` §2, sin solución de reconciliación automática construida (deliberado, ver §10.10).
12. **Si Blanc ya tiene `supabase_user_id`:** ver punto 4 — no se decide aquí si es no-op o error.
13. **Si Supabase ya tiene una cuenta asociada al mismo email** (creada por otro medio, sin que Blanc lo sepa): la Admin API de Supabase probablemente rechace un `createUser` duplicado — existen códigos de error oficiales para esa condición (`email_exists`, `user_already_exists`), y el caso de uso debe interpretar ese rechazo específico, no tratarlo como un error genérico; el comportamiento exacto de la API en ese caso es parte de la checklist §10.5 (punto 11, forma de la respuesta), no se asume aquí. **`DEC-028` deja explícitamente `PENDIENTE` la política de qué hacer ante ese rechazo (adoptar la cuenta existente vs. fallar).**

**No se diseña aquí ninguna infraestructura especulativa** — sin Outbox (ya descartado, `DEC-022`), sin colas, sin compensación automática para el Escenario 11 (reconciliación manual/detectable por consulta, como ya recomienda `IDENTIDAD_PRE_ARRANQUE.md` §2, no un job).

### 10.10 Riesgos cross-system

| Error | Recuperable? | Requiere intervención administrativa | Debe auditarse | Debe ser idempotente |
|---|---|---|---|---|
| Supabase crea la cuenta, Blanc falla al persistir `supabase_user_id` (Escenario 1, `IDENTIDAD_PRE_ARRANQUE.md` §2) | Sí, detectable por consulta cruzada (`auth.users` vs. `usuarios.supabase_user_id IS NULL`) | Sí — reconciliación manual, sin job automático (ver §10.9) | Sí — el intento fallido debe quedar registrado, no solo el éxito | El reintento del caso de uso debe ser seguro (punto 4/10 de §10.9) |
| Llamada a Supabase falla completamente (red, timeout, Admin API caída) | Sí — no se persiste nada en Blanc, el usuario permanece exactamente como antes de intentar provisionar | No necesariamente — un reintento simple puede bastar | Sí — cualquier intento, exitoso o no, debe quedar trazado | Sí — reintentar debe dar el mismo resultado final |
| Email ya existe en Supabase (cuenta creada por otro medio, no por Blanc) | Depende del comportamiento real de la Admin API (§10.5, punto 11) — no verificable sin acceso real | Probablemente sí — es exactamente el tipo de caso "Sincronizar" que `DEC-025` excluyó de este incremento; si ocurre, hoy no hay flujo automático para resolverlo | Sí | No aplica — no es un reintento, es un estado de conflicto distinto |
| Supabase Admin API deja de estar disponible / plan sin Auth Hooks (`DEC-001` sin verificar) | No es un error de una sola operación — es un riesgo de que la Decisión 1 de `ADR-024` sea inviable | Sí — requeriría rediseño (`ADR-024` Future Revisit Criteria) | No aplica a nivel de una sola operación | No aplica |

**No se inventan garantías transaccionales que Supabase + PostgreSQL no pueden dar:** ningún escenario de esta tabla asume que un fallo parcial se revierte automáticamente — todos son "detectable y reconciliable manualmente" en el mejor caso, consistente con lo que `IDENTIDAD_PRE_ARRANQUE.md` §2 ya estableció y esta iteración no contradice.

### 10.11 `ADR-024` — vigente vs. pendiente, tras el cierre de `DEC-025`

Revisión explícita solicitada — **no se modificó `ADR-024` en esta iteración**, no se encontró ninguna contradicción crítica que lo exigiera. Verificado por búsqueda directa en el texto del ADR: **ninguna mención de "Provisionar", "Sincronizar" o "invitar"** — el ADR nunca abordó la forma del flujo de alta/vinculación, solo el mecanismo de claims (Decisión 1), el modelo de permisos (Decisión 2) y `refresh_tokens` (Decisión 3). Por lo tanto, cerrar `DEC-025` no vuelve vigente ni invalida nada de lo que `ADR-024` ya decía — son preguntas ortogonales.

1. **Qué sigue vigente:** las tres decisiones completas — `Rol` enum estático (Decisión 2, `CLOSED` vía `DEC-002`) y sin `refresh_tokens` propia (Decisión 3, `CLOSED` vía `DEC-003`) no dependen de Supabase real y no cambian. La Decisión 1 (Custom Access Token Hook) sigue vigente **como propuesta**, sin aprobar.
2. **Qué depende todavía de `DEC-001`:** únicamente la Decisión 1 — el resto del ADR no depende de ella.
3. **Qué deberá probarse contra Supabase:** exactamente lo listado en §10.5/§10.6 — el propio ADR ya lo señala en su sección "Future Revisit Criteria", sin cambios.
4. **Contradicción adicional encontrada:** ninguna nueva. La única ya conocida (línea ~89, `FL-SEG-05`/`admin.signOut`) fue corregida en la iteración anterior (`DEC-012`, nota de corrección ya aplicada).
5. **Documentación que debería actualizarse antes de implementar (no ahora):** cuando se apruebe `DEC-001` con evidencia real, `ADR-024` debe pasar de `Proposed` a `Accepted` (cambio de `Status`, no de contenido) — eso sí requeriría editar el ADR, pero no en esta iteración.

> **Actualización (2026-09-14):** esta revisión quedó parcialmente superada. `DEC-001` no se aprobó: quedó **`SUPERSEDED` por `DEC-029` (C2)**, y con ella la Decisión 1 de `ADR-024`. Por tanto el punto 2 ya no tiene objeto (nada depende de `DEC-001`), el punto 3 se reduce a lo que sigue siendo útil de §10.5 (puntos 1-7), y el punto 5 cambia de sentido: `ADR-024` no pasará a `Accepted` por aprobación de su Decisión 1. Las Decisiones 2 y 3 del ADR siguen vigentes e implementadas. El ADR no se reescribe; la formalización del cambio vive en `DEC-029` y en la Enmienda 1 de `ADR-010`.

---

## 11. Documentation drift registrado en esta iteración

| # | Drift | Clasificación | Acción tomada |
|---|---|---|---|
| 1 | `ADR-024` (línea ~89) describía a `FL-SEG-05` llamando `admin.signOut` — superado desde 2026-08-23 (`DEC-012`) | `DOCUMENTATION DRIFT` | **Corregido en esta iteración** — nota de corrección agregada a `ADR-024` (texto original conservado, no reescrito), remite a `DEC-012` |
| 2 | `IDENTIDAD_PRE_ARRANQUE.md` §1/§3 usaban `usuarios.estado`/`inactivo` — la columna real es `activa: boolean` | `DOCUMENTATION DRIFT` | **Corregido en esta iteración** — anotaciones puntuales agregadas donde el nombre desactualizado generaba ambigüedad; la recomendación operativa superada de §3 se marca explícitamente `SUPERADA`, sin borrar su contenido |
| 3 | `decision-flows-catalogo-diseno.md` nota (c) usaba `usuarios.estado`, mientras la nota (h) (más reciente, mismo archivo) ya usa `activa` | `DOCUMENTATION DRIFT` | **Corregido en esta iteración** — anotación puntual agregada a la nota (c), remite a la (h) |
| 4 | `CLAUDE.md` describe `05-api-design.md` como "pendiente de redactar" — el archivo ya existe, parcialmente (`ARCHITECTURE_CLOSURE_PLAN.md` P8 lo confirma) | `DOCUMENTATION DRIFT` | **NO corregido** — `CLAUDE.md` es el archivo de instrucciones del proyecto, fuera del alcance de esta iteración por instrucción explícita. Queda registrado aquí como la fuente de verdad de que el drift existe y su corrección queda pendiente para cuando se autorice tocar `CLAUDE.md` |

---

## 12. Documentos revisados para construir esta fuente maestra

`decision-flows-catalogo-diseno.md`, `OWNER_DECISION_LOG.md`, `ADR-024`, `ADR-010`, `IDENTIDAD_PRE_ARRANQUE.md`, `04-data-model.md`, `functional-scope.md`, `01-domain-discovery.md`, `ARCHITECTURE_CLOSURE_PLAN.md`, `05-api-design.md`, `HANDOFF.md`/`ARCHITECTURE-HANDOFF.md`/`DESIGN-PHASE-HANDOFF.md` (históricos), y el código real de `src/modules/identidad-y-accesos/`, `src/shared/auth/`, `src/database/` y `src/modules/sucursales-y-personal/` (verificado directamente, no asumido desde handoffs previos).


---

## 13. `FL-COT-01` — Catálogo y Cotización (**REABIERTO con alcance acotado**, 2026-09-30)

> **Reapertura (2026-09-30) — `DEC-033`.** Este flujo se cerró el 2026-09-14 y vuelve a abrirse con
> alcance acotado: la Dueña decidió no parametrizar los diseños especiales y marcarlos con un flag
> `requiere_cotizacion_manual`, lo que exige dos columnas nuevas (migración `0004`), cambios en
> ambas entidades, en los DTO de alta/edición y en el presenter. Son cambios **aditivos**
> (`DEFAULT false`, sin romper datos existentes), pero marcar el flujo como cerrado y modificarlo
> igual sería justo la deriva que este registro existe para evitar.

### 13.1 Estado por flujo

| Flow ID | Nombre | Estado | Notas |
|---|---|---|---|
| `FL-COT-01` | Gestionar Catálogo de Servicios | **IMPLEMENTED — ALCANCE CERRADO.** CRUD administrativo (alta, listado, edición parcial, baja lógica) para `Servicio` y `ModificadorDiseno`, **más la relación N:M entre ambos**, con superficie HTTP completa | Nada pendiente dentro del flujo. `DELETE` de un servicio/modificador no existe a propósito (baja lógica). Endpoints: `POST`/`GET`/`PATCH :id`/`POST :id/desactivar` en ambos recursos, más `GET`/`POST`/`DELETE /servicios/:id/modificadores[/:modificadorId]` |
| `FL-COT-02` | Calcular Duración de Servicio Compuesto | **NOT_IMPLEMENTED** — pospuesto deliberadamente | `RN-COT-01`: la duración de un compuesto sale de una tabla de combinaciones, **nunca de sumar** duraciones individuales. `duracionBaseMinutos` es dato de catálogo, no operando de una suma |
| `FL-COT-03` | Cotizar Servicio | **NOT_IMPLEMENTED** — pospuesto deliberadamente | Incluye `RN-COT-03` (diseño cobrado por uña, no por servicio) y el Value Object `ComposicionPorUña`, que `04-data-model.md` §5.2 define como **no persistido** |

### 13.2 Qué existe en código (verificado, no asumido)

- `domain/value-objects/centavos.ts` — tipo de marca `Centavos = number & { readonly __unidad: 'centavos' }` y `validarImporteEnCentavos()`, **única puerta de entrada** al tipo. Impone `RN-COT-07` (dinero como entero en centavos) por compilador, no por convención.
- `domain/entities/servicio.entity.ts`, `domain/entities/modificador-diseno.entity.ts` — dos aggregates raíz **independientes**; ninguno contiene al otro (01-domain-discovery.md §5.2). Ambos con `crear()`, `reconstruir()`, `actualizarDatos()` (parcial, revalidando cada campo provisto), `desactivar()`/`activar()` y `activo: boolean`.
- `domain/ports/servicio.repository.ts`, `domain/ports/modificador-diseno.repository.ts` — puertos **separados**, uno por aggregate. Base: `guardar` / `buscarPorId` / `listar`. `ServicioRepository` administra además la tabla de unión (`vincularModificador`, `desvincularModificador`, `listarModificadoresDeServicio` → **ids**, `estaModificadorVinculado`); `ModificadorDisenoRepository` hidrata esos ids con `listarPorIds` (una sola consulta, sin N+1).
- `infrastructure/persistence/drizzle-*.repository.ts` — adaptadores con `TransactionContext.obtenerConexionActiva() ?? dbPorDefecto` (participan del `UnitOfWork`) y mapeadores bidireccionales. El mapeo de lectura **revalida el importe** vía `validarImporteEnCentavos()` en vez de castear: el tipo de marca no se rompe justo en la frontera donde entra dato externo.
- `application/use-cases/` — **11 casos de uso**. Las 8 escrituras (`Crear`/`Actualizar`/`Desactivar` × `Servicio`/`ModificadorDiseno`, más `Vincular`/`Desvincular`) corren **dentro de `UnitOfWork` + `AuditoriaPort`** (`RN-AUD-01`); las 3 lecturas (las 2 de catálogo y `ObtenerModificadoresDeServicioUseCase`) son puras, sin transacción ni auditoría. Las bajas son **idempotentes** (desactivar algo ya inactivo no falla). La auditoría de una actualización registra los campos solicitados **y el valor resultante** de precio y duración: "alguien cambió el precio" sin decir a cuánto es un registro inútil en un catálogo del que salen los cobros.
- `infrastructure/http/` — `ServiciosController` y `ModificadoresDisenoController`, cada uno con `POST` (201, devuelve el recurso), `GET` (200, envoltura `{ servicios: [...] }` / `{ modificadoresDiseno: [...] }`), `PATCH :id` (200) y `POST :id/desactivar` (204). **RBAC mixto declarado por método** (ver §13.4). DTOs con `class-validator` (`@IsInt()` + `@Min(0)`; los de actualización con `@IsOptional()` **sin relajar** la exigencia de los campos presentes) y presenter `catalogo.presenter.ts`.
- `catalogo-y-cotizacion.module.ts` — cableado en `app.module.ts` con ambos controladores.
- Esquema `catalogo_cotizacion` (4 tablas), migración `0002_aspiring_storm.sql` (creación) y `0003_absurd_bill_hollister.sql` (`ALTER TABLE ... ADD COLUMN "activo" boolean DEFAULT true NOT NULL` en `modificadores_diseno`) — **generadas, NO aplicadas a ninguna base real**.

### 13.3 `OUT_OF_SCOPE` — fuera de `FL-COT-01` (explícito, no olvido)

| Elemento | Razón |
|---|---|
| `DELETE` (borrado físico) | **Decisión, no omisión**: la baja es lógica. Borrar un servicio falsearía las citas ya cotizadas con él y dejaría cotizaciones apuntando a la nada |
| `POST /:id/activar` (reactivar) | No ordenado. La entidad **sí** tiene `activar()`, sin ruta que lo invoque — mismo hueco deliberado que en `FL-SEG-05` (ver `DEC-011`) |
| `GET /servicios/:id` (consulta individual) | No ordenado. El puerto **sí** expone `buscarPorId()`, usado por los casos de uso de edición/baja y las pruebas |
| Filtrar el listado por `activo` | `listar()` devuelve activos e inactivos a propósito: un servicio dado de baja sigue apareciendo en citas ya cotizadas. Filtrar por disponibilidad para agendar es decisión de `FL-COT-02`/`FL-COT-03` |
| `servicio_sucursal_override` | Tabla **modelada sin uso** — `RN-COT-06`/`RN-COT-08` establecen catálogo global sin override por sucursal. Existe como punto de extensión, sin código que la toque |
| Tablas `cotizaciones` / `composiciones_por_una` | **No deben crearse**: son Value Objects que se congelan en `agenda.citas.cotizacion_snapshot` (`04-data-model.md` §5.2) |

### 13.4 RBAC del catálogo — mixto, por método (resuelto 2026-09-14)

Un `@Roles` a nivel de controlador habría bloqueado el `GET` a Recepción y Gerencia, rompiendo
`FL-COT-03` (Cotizar) en el momento de implementarlo. Se corrigió antes de que llegara:

| Ruta | Roles | Por qué |
|---|---|---|
| `GET /` | Super Admin, Administrador, **Gerente, Recepcionista** | Recepción y Gerencia necesitan leer el catálogo para cotizar (`FL-COT-03`) |
| `POST /` | Super Admin, Administrador | De estos datos salen los cobros reales |
| `PATCH /:id` | Super Admin, Administrador | ídem |
| `POST /:id/desactivar` | Super Admin, Administrador | ídem |

**Consecuencia a vigilar:** al no haber ya un `@Roles` de clase que sirva de red, una ruta nueva sin
decorador queda abierta a cualquier autenticado — `RolesGuard` solo restringe cuando encuentra
metadata. Está documentado en el comentario de cabecera de ambos controladores. Es el precio
consciente de tener permisos distintos para leer y para administrar.

**Baja lógica, no borrado (aplica a ambos aggregates).** `activo=false` en lugar de `DELETE`, porque
un servicio o un modificador retirado sigue apareciendo en las citas ya cotizadas con él. Esto
motivó la migración `0003`: `ModificadorDiseno` **no tenía** columna `activo` — se agregó por
consistencia con `servicios.activo` y con el mismo argumento de preservación del historial.

---

### 13.5 Relación N:M servicio ↔ modificador (cerrada 2026-09-14)

Existe porque el Domain Discovery dice que un `Servicio` "incluye referencia a modificadores
aplicables": **no** es cierto que cualquier modificador aplique a cualquier servicio. Sin esta tabla,
`FL-COT-03` podría cotizar combinaciones que el salón no realiza.

| Situación | Respuesta | Por qué |
|---|---|---|
| Servicio o modificador inexistente | `404 RECURSO_NO_ENCONTRADO` (`details.recurso` dice cuál) | La existencia se evalúa **antes** que el estado activo: un id falso da 404, no 409 |
| Modificador dado de baja | `409 MODIFICADOR_INACTIVO` | Habilitar algo que el catálogo ya retiró crearía una oferta fantasma |
| Servicio dado de baja (al vincular) | `409 SERVICIO_INACTIVO` | ídem |
| Vínculo duplicado | `409 MODIFICADOR_YA_VINCULADO` | Pre-chequeo en el caso de uso **y** traducción del `23505` en el adaptador: el pre-chequeo da el error legible, el constraint lo garantiza ante la carrera (TOCTOU) |
| Desvincular algo no vinculado | `204` (no-op) | Mismo criterio que `RemoverManicuristaDeSucursalUseCase` |
| Desvincular de un servicio **inactivo** | `204`, permitido | **Asimetría deliberada:** exigir `activo` aquí dejaría vínculos imposibles de limpiar tras una baja |
| `DELETE` sobre un servicio inexistente | `404`, no `204` | El servicio es el recurso de la URL; un `204` engañoso ocultaría el error del cliente |

`GET /servicios/:id/modificadores` devuelve los modificadores completos, **activos e inactivos**:
uno dado de baja que quedó vinculado sigue siendo parte de la configuración real del servicio, y
ocultarlo impediría al administrador verlo para desvincularlo.

---

### 13.6 Nota de trazabilidad

Este incremento **no abrió ningún `DEC-XXX` nuevo**: no hubo ninguna bifurcación arquitectónica que decidir. Todas las elecciones se derivan de reglas ya aprobadas (`RN-COT-01/02/03/06/07/08`, `RN-AUD-01`) o de patrones ya establecidos en `Sucursales y Personal` / `Identidad y Accesos` (puerto + adaptador Drizzle + `UnitOfWork` + auditoría). Si una futura iteración necesita apartarse de alguno, eso sí exige un `DEC-XXX`.

La única decisión con efecto en el esquema fue **agregar `activo` a `modificadores_diseno`** (migración `0003`), autorizada explícitamente por el arquitecto el 2026-09-14 tras señalarse que la orden de trabajo presuponía una columna que no existía.

---

---

## 14. Fase 2 — Agenda: estado tras las respuestas de la Dueña (2026-09-30)

**Documento de diseño:** `docs/architecture/FASE_2_AGENDA_ARQUITECTURA.md`. Nada de lo que sigue está implementado — ni esquema, ni migración, ni código.

### 14.1 Directriz rectora: Sistema Híbrido

> Automatizar la agenda básica; que el sistema **se apoye en recepción y gerencia** para casos complejos, diseños y cotizaciones.

No es una preferencia de producto sino una restricción de diseño: el sistema debe poder **detenerse y pedir que decida un humano** sin dejar la cita en estado inconsistente ni el horario bloqueado indefinidamente. `DEC-031` (recepción reasigna la manicurista al llegar) y `DEC-033` (la cotización manual pausa la automatización) son sus dos realizaciones concretas.

### 14.2 Bloqueos cerrados y abiertos

| Antes | Ahora |
|---|---|
| `Pregunta 2` — disparador de `completada` | ✅ `DEC-030` |
| `P4` — capacidad sin manicurista | ✅ `DEC-031` |
| `Pregunta 4` — baja de manicurista | ✅ `DEC-032` |
| `RN-COT-04` — celdas sin valor numérico | ✅ `DEC-033` (solo ese hueco; el "+15 min" y la tabla original siguen abiertos) |
| Expiración de anticipo sin transición | ✅ `DEC-034` |
| `P3` — máquinas de estado | ⚠️ **parcialmente desbloqueado** — `Cita` sí; `Conversación` y `TicketEscalamiento` no |

### 14.3 Pendientes NUEVOS que esta ronda abrió

Cinco respuestas cerraron tres bloqueos y abrieron cuatro preguntas más pequeñas. **`N-01` se cerró el mismo día** como decisión técnica (`DEC-035`); quedan tres.

| # | Pregunta | Responde | Bloquea |
|---|---|---|---|
| ~~`N-01`~~ | ~~Capacidad física vs. personal en turno~~ | — | **CERRADO el 2026-09-30** por `DEC-035`: se resuelve en la capa de aplicación (`MotorDisponibilidad`), no en la base de datos |
| ~~`N-02`~~ | ~~Carrera `completada`/`no_show`~~ | — | **CERRADO (2026-10-14)**: se habilita `completada → no_show` como corrección administrativa. Sin ventana de gracia: el job marca cuando toca y la Encargada corrige si hace falta |
| `N-03` | Qué significa operativamente "la automatización se detiene" | Dueña + Arquitectura | Estado `pendiente_cotizacion` |
| ~~`N-04`~~ | ~~Qué estados cuentan como "cita futura"~~ | — | **CERRADO (2026-10-14)**: reutiliza `ESTADOS_QUE_LIBERAN_HORARIO`, la misma lista que alimenta las restricciones de exclusión |

### 14.4 Lo que sigue bloqueado, sin cambio

- **`RN-COT-04`**: la ambigüedad del "+15 min" del drill (¿delta o reemplazo?) y, sobre todo, que **la tabla numérica original no está en el repositorio** — hay que recuperarla de la reunión. Sin ella no hay motor de duración preciso aunque se responda todo lo demás.
- **`Pregunta 11`** — alcance por defecto de sucursales por rol. El código hoy se comporta de **dos maneras contradictorias**: las escrituras implementan "sin filas = sin acceso", las lecturas no filtran nada.
- **Máquinas de `Conversación` y `TicketEscalamiento`** (Fase 4). La segunda ni siquiera tiene valores de estado propuestos.

### 14.5 Prerrequisito técnico — ya resuelto

El invariante anti-doble-booking exige `btree_gist`, `tstzrange` y `EXCLUDE USING gist`. `pg-mem` no soporta ninguno de los tres, lo que habría hecho imposible probar el módulo. Desde el 2026-09-15 las pruebas corren contra **PostgreSQL real** (Testcontainers) y `postgres-de-prueba.smoke.spec.ts` verifica la restricción en miniatura. Fase 2 puede empezar a construirse con pruebas reales desde el primer día.

---

## 15. Contexto operativo confirmado — ronda de la Dueña (2026-10-09)

Cierre de la auditoría de contexto operativo. Las respuestas se registran como `DEC-036`..`DEC-042`. Esta sección recoge lo que **no cabe en una decisión aislada**: qué reglas previas quedan modificadas, qué preguntas se cerraron de paso, y qué se abrió.

### 15.1 La directriz que lo gobierna todo

> **Cero superficie web para la clienta.** Todo ocurre dentro de la conversación de WhatsApp: no hay liga de agendamiento, no hay liga de pago, no hay portal.

Hasta ahora esto se mencionaba de palabra pero **no estaba escrito en ningún documento**. Queda asentado. Define el alcance del frontend: el panel administrativo es la **única** interfaz web, y es interna.

### 15.1-bis Addendum (2026-10-09, mismo día) — canal único por API oficial

Posterior a esta ronda, el cliente tomó una decisión técnica que **reemplaza parte de lo diseñado arriba**: la API oficial de Meta en exclusiva (`DEC-043`). Dos efectos que hay que leer junto con lo anterior:

- **`DEC-038` (ecos) queda `SUPERSEDED`.** El personal **no** seguirá usando la app móvil, porque la Cloud API desconecta el número. El problema que ese diseño resolvía deja de existir.
- **La Bandeja Compartida pasa a ser condición de puesta en marcha**, no una comodidad de Fase 4: sin app móvil, el panel es el único canal para hablar con una clienta.

### 15.2 Preguntas abiertas que estas respuestas cerraron de paso

| Pregunta | Resolución |
|---|---|
| **`Pregunta 1` / `PA-15`** — ¿cuándo vuelve el control al bot tras inactividad? *(estaba marcada como la de **mayor riesgo de negocio** de toda la lista)* | **Opción (b)**: el modo permanece en humano **indefinidamente** hasta que alguien lo libere. Literal: *"si una conversación queda muda, se queda así hasta que haya respuesta o se le pase al bot por medio del humano"* |
| **`Pregunta 10` / `PA-23`** — ¿FIFO estricto en lista de espera? | Sí, pero con **mecánica distinta a la supuesta** — ver §15.3 |
| **Rol de la Encargada** | Es el `Gerente` renombrado (`DEC-039`) |
| **Tolerancia de retraso** | 15 minutos, criterio de la Encargada (`DEC-042`) |
| **Pasarela de pago** | No se necesita (`DEC-041`) |

### 15.3 ⚠️ Reglas ya aprobadas que estas respuestas MODIFICAN

No son adiciones: cambian el contenido de reglas que ya estaban en `Aprobada`. Propagar a sus `RN-` es trabajo pendiente.

| Regla | Decía | Ahora |
|---|---|---|
| **`RN-AGE-13`** | FIFO, *"gana la primera en confirmar"* — mecánica de **carrera**, implica avisar a varias a la vez | **Oferta secuencial**: se avisa a **una sola**, con **1 hora** para responder. El orden FIFO sobrevive; **la carrera desaparece**. Cambia el diseño de notificaciones y elimina el costo de marca de decepcionar a nueve |
| **`RN-AGE-07`** | La solicitud de lista de espera expira **por evento** (se llena el cupo) | Coexisten **dos** expiraciones: por evento **y** por plazo de 1 hora. Gana la primera. El plazo debe ser **configurable en la plataforma** |
| **`RN-CRM-03`** | La cancelación de una clienta en **lista roja** requiere aprobación de un empleado — lo que implicaba que las demás **sí** podían cancelar solas | **Ninguna clienta cancela sola.** Todas pasan por una persona. La distinción de `RN-CRM-03` **pierde su sentido operativo** y debe revisarse |
| **`RN-ANT-03`** | El horario no se retiene mientras el anticipo está pendiente | Sin cambio, **pero ahora tiene cara visible**: como no hay pasarela y la confirmación es humana (`DEC-041`), una clienta puede transferir y aun así perder el hueco. Conviene confirmar que el negocio lo asume |

### 15.4 Tres consecuencias incómodas que conviene mirar de frente

Ninguna es un error: las tres se derivan correctamente de decisiones que la Dueña tomó. Pero no son evidentes hasta que se combinan.

- **Una clienta bloqueada que escriba de madrugada recibe silencio absoluto.** `DEC-042` dice que a las bloqueadas el bot **no les responde nada** y las deriva a un humano, y que **no se escala fuera de horario**. A las 3am eso suma cero respuesta hasta la mañana. Puede ser exactamente lo deseado —es una clienta bloqueada— pero conviene que sea una elección, no un descubrimiento.
- **El silencio de la lista roja tiene una fuga.** Es interna y no se avisa a la clienta (`DEC-042`), pero a una clienta recién marcada **se le empieza a pedir anticipo** (`RN-ANT-01`) cuando antes no se le pedía. El cambio de trato es perceptible aunque la etiqueta no se mencione.
- **El recorte de servicio por retraso no tiene precio definido.** `DEC-042` establece que a quien llega tarde *"se le atiende recortando el servicio"*. No está definido si paga completo, si se recotiza, ni qué pasa con el `cotizacion_snapshot`, que es inmutable por diseño (`RN-AGE-08`). Queda como pendiente.

### 15.5 Pendientes nuevos

| # | Pendiente | Responde | Bloquea |
|---|---|---|---|
| ~~`N-05`~~ | ~~Qué eventos salientes cuentan como intervención humana~~ | — | **CERRADO: no aplica** (`DEC-043`) |
| ~~`N-06`~~ | ~~Demora deliberada para mitigar la carrera bot/humano~~ | — | **CERRADO: no aplica** (`DEC-043`) |
| ~~`N-07`~~ | ~~Verificar coexistencia app + API en Meta~~ | — | **CERRADO: no aplica** — la decisión de usar Cloud API en exclusiva lo vuelve irrelevante (`DEC-043`) |
| `N-13` | **Verificar el modelo de precios vigente de Meta** y correr escenarios de costo | Externa + Dueña | `Pregunta 8`, diseño de notificaciones |
| `N-14` | Inventario y redacción de las **plantillas**, con sus variables, para someterlas a aprobación de Meta | Dueña + Arquitectura | Fase 4 |
| `N-15` | Plan de **migración de los 3 números**, con ventana de corte y aviso a clientas | Dueña | Puesta en marcha |
| `N-16` | Alcance mínimo de la **Bandeja Compartida** necesario para poder migrar | Arquitectura | **Puesta en marcha** |
| `N-08` | Porcentaje exacto del anticipo | Dueña | `RN-ANT-01` |
| `N-09` | Qué se cobra cuando se recorta un servicio por retraso (§15.4) | Dueña | `RN-AGE-08` |
| `N-10` | Dónde se registran las propinas, si el cobro ocurre fuera del sistema | Dueña + Arquitectura | Analítica |
| `N-11` | Palabras con las que una clienta pide hablar con un humano — *la Dueña la dejó explícitamente como `PENDIENTE`* | Dueña | `RN-ESC-01` |
| `N-12` | Si el rol `Recepcionista` se elimina del modelo o se conserva sin titular | Arquitectura | `enum Rol` |

### 15.6 Sigue bloqueado, sin cambio

- **`RN-COT-04`**: la ambigüedad del "+15 min" del drill y, sobre todo, que **la tabla numérica original no está en el repositorio**.
- **`Pregunta 11`**: alcance por defecto de sucursales por rol. El código sigue comportándose de dos maneras contradictorias según si lee o escribe.
- **`Pregunta 8`** (presupuesto de WhatsApp): sigue abierta, pero **ya no es aplazable** tras `DEC-043`. Con una integración no oficial el costo por mensaje no existía; con la Cloud API condiciona cuántos recordatorios son viables. La Dueña dio dirección —*"sí se asume el costo, pero que sea el menor posible"*, con recordatorios **obligatorios**— pero hace falta el análisis de precios y escenarios (`N-13`), no una cifra a ojo.
- **`Pregunta 9` / `PA-14`**: umbral exacto de "clienta molesta".
- **Máquinas de `Conversación` y `TicketEscalamiento`**: `Conversación` avanza mucho con la resolución de `Pregunta 1` y con `DEC-038`; `TicketEscalamiento` sigue sin valores de estado propuestos.

---

## 16. Handoff / Trabajo Asíncrono

> Bitácora por sesión para el equipo asíncrono. Cada entrada responde tres cosas: **qué toqué**, **qué queda probado** y **con qué te vas a tropezar**. La más reciente arriba.

### 2026-10-15 (d) — Fase 4 Parte 1: saneamiento del arnés (≈12 % → ≈1,6 %) y Planificador Operativo (`ADR-025`)

Dos pendientes críticos, uno de ellos con una causa raíz que no era la que yo sospechaba.

#### 1. 🔴 La causa raíz del `401` intermitente: el ciclo de vida del servidor en supertest

**No era PostgreSQL, ni el pool, ni el paralelismo.** Era supertest.

`request(app.getHttpServer())` sobre un servidor que **no está escuchando** hace que supertest ejecute `listen(0)` **y `close()` en cada petición**. Con `await app.init()` a secas —que crea el servidor pero no lo pone a escuchar— eso ocurría en las ~700 peticiones de la suite E2E, y abría una carrera:

> Una petición encuentra el servidor **ya escuchando**, porque la anterior lo abrió y su `close()` todavía no terminó de completarse. Al no ver `address() === null`, **no crea el suyo**. Entonces el `close()` pendiente de la anterior se completa y le mata el socket a mitad del intercambio.

Los dos síntomas, ambos observados y ambos ahora explicados:

- **`read ECONNRESET`** — el socket muere antes de la respuesta.
- **El `401` imposible** — la petición llega al guard **sin su cabecera `Authorization`**, porque nunca se terminó de recibir. La instrumentación lo confirmó: `header=undefined`, `headersPresentes=["host","accept-encoding","connection"]`.

**Por qué el `401` era la pista decisiva y a la vez la más engañosa.** Descarté el producto por eliminación: `AuthorizationGuard` nunca devuelve 401 (403 por permisos, 503 por infraestructura), así que solo podía venir de `JwtAuthGuard` — que es criptografía pura, con secreto y emisor constantes y tokens de prueba firmados **sin `exp` ni `nbf`**, sin caché ni dependencia del reloj. Un 401 ahí es **imposible de forma determinista**. Eso probaba que el token no era el problema: el problema era que la petición llegaba incompleta.

**Por qué no se reproducía aislando el spec** (20 de 20 limpias): la carrera necesita que el `close()` de una petición solape con el `listen()` de la siguiente. Con la máquina descargada, el cierre termina antes. Y **por eso fallaba igual con `--runInBand`**, lo que descartó el paralelismo: la carrera es **dentro** de la secuencia de peticiones de un mismo archivo.

**La corrección:** `await app.listen(0)` en el `beforeAll` de los 9 specs E2E. Con el servidor escuchando, `address()` nunca es `null` y **supertest no toca su ciclo de vida**: usa el que ya hay. El puerto `0` deja que el sistema elija, así que no hay colisiones entre archivos ni workers; `app.close()` del `afterAll` lo cierra.

#### Y dos defectos más que salieron por el camino

**(a) El arnés recreaba la base de datos una vez por archivo de spec, no por worker.** `conexionDelWorker` es estado de módulo y **Jest reinicia el registro de módulos en cada archivo**: un worker con 30 archivos lo veía `null` 30 veces y volvía a provisionar. Provisionar hacía `DROP DATABASE ... WITH (FORCE)`, que **termina a la fuerza todas las conexiones abiertas a esa base**, no solo las propias — 30 ventanas por worker en las que una conexión no drenada era cortada de raíz. La marca vive ahora en `process.env` (lo único que sobrevive al reinicio del registro; `globalThis` no, porque `testEnvironment: 'node'` crea un contexto nuevo por archivo). Efecto secundario: las migraciones se aplican **una vez por worker** en vez de una por archivo, y la suite es notablemente más rápida.

**(b) Una aserción de tiempo frágil.** El health check comparaba el timestamp contra `Date.now()` con 10 segundos de margen, lo que hacía la prueba dependiente de **lo rápido que vaya la máquina**. Ahora se acota con los instantes de antes y después de la petición: afirma lo que importa —que el timestamp se genera al atender— y es determinista a cualquier velocidad.

**`forceExit: true` eliminado de `jest.config.js`.** Su única justificación era un handle que dejaba `pg-mem`, **eliminado del proyecto hace varias fases**: el comentario describía una dependencia que ya no existía. Mantenerlo era activamente malo — `forceExit` mata el proceso en cuanto terminan las pruebas y **oculta cualquier fuga de handles futura**, justo la señal que hacía falta para este diagnóstico. Verificado que la suite sale sola con código 0 y que `--detectOpenHandles` no reporta ninguno.

> **Nota de método, porque afectó a la medición:** una tanda de 20 corridas intermedia dio 1 fallo, y era **artefacto mío**: estaba editando el código fuente mientras el bucle corría. La medición definitiva se hizo con el árbol quieto. Si en el futuro alguien mide estabilidad, no edite durante la medición.

#### 2. Planificador Operativo (`ADR-025`)

**ADR nueva: `docs/architecture/adr/ADR-025-planificador-operativo.md`** (`Accepted`).

Cron en proceso con `@nestjs/schedule`, sobre jobs que **son casos de uso invocables también por HTTP**, protegidos por `pg_try_advisory_lock`.

| Decisión | Por qué |
|---|---|
| Cron **en proceso**, no worker aparte | Blanc es un Modular Monolith en un solo servicio de Railway; un worker duplicaría despliegue, configuración y secretos para cuatro barridos de milisegundos |
| `@nestjs/schedule` fijado en **`^4.1.2`** | La 12 exige NestJS 11/12 y el proyecto está en 10.4. Forzarla con `--legacy-peer-deps` habría metido una incompatibilidad silenciosa, el mismo error que se evitó dejando `jose` en v5 |
| **El cron no contiene lógica** | Cada job es un caso de uso. Se puede disparar a mano (imprescindible mientras no haya WhatsApp), se prueba sin relojes con un `ahora` explícito, y mover esto a un worker cambiaría **quién llama, no qué se ejecuta** |
| `pg_try_advisory_lock`, **no bloqueante** | Si Railway escala a dos instancias, las dos disparan a la misma hora: dos avances de la fila podrían ofrecer el mismo hueco a dos clientas. `try` y no espera — un barrido que se salta se repite en el siguiente tick; uno que espera **apila ejecuciones** |
| `PLANIFICADOR_ACTIVO=false` en pruebas | Un tick disparándose mientras una prueba monta su escenario lo corrompería de forma intermitente: **exactamente la clase de intermitencia que esta misma fase acabó de erradicar** |

#### 🐛 Un defecto real de mi primera implementación del cerrojo

Los advisory locks de PostgreSQL son **por sesión**, y `postgres-js` trabaja con un **pool de 5**. Mi primera versión pedía el cerrojo por el pool, así que `pg_try_advisory_lock` podía ejecutarse en la conexión A y el `pg_advisory_unlock` del `finally` en la B. Consecuencia: **el cerrojo de A queda tomado hasta que muera el proceso y el barrido deja de correr en silencio**, mientras el `unlock` sobre B devuelve `false` con un aviso que nadie mira.

Se corrige con `reserve()`, que toma una conexión **dedicada** para toda la vida del cerrojo. Hay una prueba de 10 ciclos consecutivos —con un pool de 5, basta para que las conexiones roten y el fallo aparezca— y otra que toma el cerrojo desde una sesión distinta y verifica que el barrido **no se ejecuta**, no solo que devuelva `null`.

No se usa `pg_advisory_xact_lock` porque un barrido abre **una transacción por elemento** para aislar fallos: el cerrojo se liberaría en la primera.

#### Los cuatro barridos

| # | Barrido | Cada | Qué hace |
|---|---|---|---|
| a | `lista_espera` | 5 min | Cierra ofertas vencidas y avanza el FIFO (`DEC-039`) |
| b | `anticipos` | 5 min | Expira anticipos `pendiente` cuya cita ya llegó a su hora (`RN-ANT-03`) |
| c | `cierre_de_citas` | 5 min | Pasa a `completada` las citas activas ya terminadas (`DEC-030`) |
| d | `recordatorios` | 1 h | Pasa a `pendiente_confirmacion` las citas a ≤24 h y emite el aviso (`RN-NOT-02`) |

**Ante fallos parciales:** `procesarLote()` itera capturando **por elemento**, registra el id y sigue. Es la regla que más importa y la más fácil de olvidar al escribir el cuarto barrido: con el orden por antigüedad, detenerse en el primer error dejaría sin procesar **justo lo más urgente**, y una cita con datos corruptos podría bloquear el cierre de todas las demás indefinidamente. Cada ejecución devuelve `{procesados, fallidos, idsFallidos}`.

**Ante ejecuciones repetidas:** idempotencia **por estado, no por bandera**. Cada barrido selecciona por estado de origen y la acción cambia ese estado, así que una segunda corrida inmediata no encuentra nada. No hay columna de "ya procesado" que mantener sincronizada — la misma propiedad que ya protege las transiciones de `Cita`. Hay una prueba de doble corrida para cada uno de los cuatro.

**Dos decisiones de los barridos que conviene conocer:**

- **El cierre automático es aceptable porque `completada → no_show` sigue siendo legal** (`N-02`). El sistema no puede saber si la clienta entró por la puerta; esa salida es la que permite que la Encargada lo corrija más tarde. Hay una prueba que lo fija.
- **El recordatorio usa una ventana `[ahora, ahora+24h]`, no un instante.** Un barrido que buscara citas que empiecen "exactamente en 24 h" no encontraría nunca nada: corre cada hora y la probabilidad de caer en el instante justo es cero. La ventana además recupera lo que quedó sin recordar si el servicio estuvo caído.
- **El envío va FUERA de la transacción** y su fallo no revierte la transición: mejor una cita en `pendiente_confirmacion` sin aviso —visible para la Encargada, que puede llamar— que una clienta avisada de algo que se revirtió. Un mensaje enviado no se deshace con un `ROLLBACK`.

#### Archivos

| Archivo | Qué es |
|---|---|
| `docs/architecture/adr/ADR-025-planificador-operativo.md` | ADR del planificador |
| `shared/persistence/advisory-lock.ts` | `CerrojoDeBarrido` con sesión reservada |
| `modules/planificador/application/planificador.service.ts` | Los 4 `@Cron` + despacho por nombre |
| `modules/planificador/application/barrido-de-anticipos.use-case.ts` | Barrido (b), cruza Agenda y Anticipos |
| `modules/planificador/infrastructure/http/planificador.controller.ts` | 2 endpoints administrativos |
| `modules/planificador/planificador.module.ts` | Composición; `ScheduleModule.forRoot()` |
| `modules/planificador/planificador.spec.ts` | **23 pruebas de integración** |
| `agenda/application/use-cases/barridos-de-agenda.use-cases.ts` | Barridos (c) y (d) + `procesarLote` |
| `agenda/domain/ports/notificador-recordatorio.port.ts` | Puerto de salida del recordatorio |
| `agenda/infrastructure/notificacion/recordatorio-solo-log.adapter.ts` | **Provisional: no envía nada** |

**Sin migraciones.** Ningún barrido necesitó esquema nuevo: se apoyan en los estados que ya existen, que es precisamente lo que hace la idempotencia gratuita.

> **El planificador importa dos Bounded Contexts, y no viola la regla que cerró `P5`.** No es un BC: es un **adaptador conductor**, de la misma familia que un controlador HTTP, y orquestar es su función. La distinción frente a `IntegracionModule` es la dirección — aquel aloja adaptadores *conducidos* (un BC pregunta, otro responde, ninguno conoce al otro); este es quien **conduce**, y no introduce dependencia alguna entre los contextos que invoca. `madge` sigue en **0 ciclos**.

#### Endpoints

| Método y ruta | Roles |
|---|---|
| `GET /v1/planificador` | **Solo Super Admin y Administrador** |
| `POST /v1/planificador/barridos/:nombre` | ídem |

Más estrecho que la operación diaria, a propósito: un barrido actúa **sobre las tres sucursales a la vez**, así que no es una acción de turno y no tiene alcance de sucursal que respetar. La `GERENTE` recibe `403`.

#### Pruebas: **+29** (959 → **988**, 68 suites)

23 de integración del planificador (los 4 barridos, aislamiento de fallos por elemento, idempotencia de doble corrida, lote acotado y las 4 del cerrojo) · 6 E2E HTTP del endpoint administrativo.

#### Validación

`tsc --noEmit` 0 · `tsc -p tsconfig.eslint.json` 0 · `lint` 0 errores 0 avisos · `build` OK · `drizzle-kit check` OK · `madge --circular` 0 ciclos · **988/988 pruebas** en 68 suites.

#### 🟡 Estabilidad del arnés: mejorada mucho, **no erradicada**

| Medición (suite completa, árbol quieto) | Corridas con fallo |
|---|---|
| **Antes** de esta entrega | ~1 de cada 8 · 1 de 4 con `--runInBand` · 1 de 6 con `--maxWorkers=4` |
| **Después**, tanda de medición | 1 de 30 |
| **Después**, tanda de caza del residuo | **0 de 34** |
| **Después**, total | **1 de 64 (≈1,6 %)**, frente a ≈12 % antes |

El residuo **no se reprodujo en 34 corridas consecutivas** con instrumentación lista para capturarlo, así que no hay datos sobre su naturaleza más allá de su frecuencia.

**No puedo declarar el problema erradicado, y la orden pedía erradicarlo.** Las tres causas encontradas eran reales y están corregidas —la de supertest explicaba los dos síntomas observados (`ECONNRESET` y el `401` sin cabecera), que es la evidencia más fuerte de que era *la* causa principal— pero queda un residuo de frecuencia mucho menor cuya naturaleza **todavía no está identificada**.

Lo que **sí** se puede afirmar con los datos: el fallo ya no depende del número de workers, ya no se reproduce por recreación de la base entre archivos, y ninguna de las aserciones frágiles de tiempo sigue en pie.

**Qué NO se hizo, deliberadamente:** no se añadió `jest.retryTimes` ni ningún reintento. La orden lo prohibía y tiene razón — convertiría la suite en un detector de ruido y enterraría la señal que falta.

**Siguiente paso para quien lo retome:** la instrumentación que funcionó está descrita arriba (`console.error` temporal en las cuatro ramas de 401 de `JwtAuthGuard`, con método, URL y cabeceras presentes, y bucle de corridas completas rompiendo al primer fallo). Aplicada al residuo, debería identificarlo igual que identificó este. **Dato de método que costó una tanda entera: no editar el código fuente mientras se mide** — una medición intermedia de 20 corridas dio 1 fallo que era artefacto de mis propias ediciones concurrentes.

#### Listo para Fase 4 Parte 2

- **Canal WhatsApp Cloud API:** los puntos de enganche están construidos y son **tres** puertos con adaptador de solo-log, cada uno nombrado para no confundirse con el definitivo: `NotificacionListaEsperaPort`, `NotificadorRecordatorioPort` y (pendiente de crear) el de avisos de anticipo. En Fase 4 se sustituye el proveedor en el módulo y **no se toca ningún caso de uso**.
- **El recordatorio ya funciona de extremo a extremo salvo el envío:** la cita pasa a `pendiente_confirmacion` y la Encargada lo ve en la agenda. Solo falta que el mensaje salga.
- **Máquina de estados de Conversación y `TicketEscalamiento`** — es lo que queda de `P3`, más `P6`. Ninguna está empezada.
- **`RN-ESC-03`** (retorno de control siempre explícito) y `RN-ESC-02` (revalidación de modo antes de cada respuesta del bot) exigirán un puerto desde Conversación hacia el bot; el patrón de `P5` ya está cerrado para eso.
- **`DEC-044`** ya fijó que el Bot es un *principal de sistema* con lista cerrada de operaciones de **solo lectura**, y que su credencial se construye en Fase 4. Sigue sin emitirse.

#### Deuda nueva que deja esta entrega

1. **Una cita en `en_espera_pago` sin fila de anticipo no la expira nadie.** Ocurre con `DEC-033` (servicio de cotización manual) si la Encargada no registra el anticipo a mano: el barrido (b) busca el anticipo y, al no encontrarlo, se salta la cita — correctamente, porque no hay nada que expirar, pero la cita se queda ahí para siempre. Hay que decidir si el barrido expira también las citas sin anticipo o si se obliga a registrarlo al agendar.
2. **Si el proceso está caído, no se dispara nada.** Asumido en `ADR-025`: las cuatro tareas son recuperables y al volver el siguiente tick procesa lo atrasado. La alternativa (cron externo de Railway) **ya es posible sin reescribir nada**, porque los endpoints existen.
3. **Los barridos comparten CPU y pool con las peticiones HTTP.** Despreciable con el volumen de tres sucursales; deja de serlo con lotes de miles de filas, y entonces toca el worker.

---

### 2026-10-15 (c) — Fase 3 Parte 2: Anticipos por transferencia manual. **🏁 FASE 3 CERRADA**

Cierra Fase 3. El ciclo completo de `RN-ANT-01` a `RN-ANT-04` queda conectado con Agenda y CRM, y el último parámetro temporal de la plataforma desaparece.

#### 1. ⚠️ El porcentaje: la orden decía 50%, pero la Dueña ya había dicho 40%

La orden pedía *"por defecto 50% mientras la Dueña define el número final"*. **Ya lo definió.** `DISCOVERY_CHECKLIST.md` 1.13 (2026-08-04): *"se pide el 40% del servicio como anticipo"*, y las Notas de `RN-ANT-01` lo registran como *"dato crítico que no existía en ningún documento previo"*.

**Implementado al 40%**, parametrizable como pedía la orden (`GenerarAnticipoUseCase` acepta otro porcentaje). Poner 50% habría sustituido en silencio una decisión de negocio ya tomada — exactamente lo que el proyecto prohíbe. Si el 50% viene de una conversación posterior que no está en los documentos, **es un cambio de una constante**, pero debería actualizar `RN-ANT-01`.

El porcentaje aplicado se **congela en cada fila**, igual que `cotizacion_snapshot` (`RN-AGE-08`): si mañana cambia a 50, los anticipos ya calculados siguen siendo lo que se le dijo a la clienta, y un reporte histórico no dividirá montos viejos por el porcentaje nuevo.

#### 2. Cómo se resuelve la carrera de `RN-ANT-03`

La regla fue corregida por la Dueña: *"Hasta que se dé el anticipo se agenda, si no el espacio sigue libre"*. **No hay retención.** Mientras el anticipo está `pendiente`, la cita vive en `en_espera_pago`, que libera silla y manicurista — **dos citas en ese estado coexisten sobre la misma silla**.

El cupo se decide al confirmar el pago, en tres capas:

1. `MotorDisponibilidad` comprueba horario y capacidad (consultivo).
2. Se busca silla libre **y se reasigna si la suya está ocupada** — la clienta nunca eligió silla (`DEC-031`), así que moverla es invisible, y rechazar una transferencia ya hecha teniendo la silla de al lado vacía sería absurdo.
3. La restricción `EXCLUDE` de PostgreSQL es la **autoridad final** ante dos confirmaciones simultáneas.

> **Todo en una sola transacción.** Confirmar el pago y activar la cita comparten transacción porque `DrizzleUnitOfWork` se une a la abierta. Si la cita no se puede activar, **la confirmación se deshace entera**. La alternativa —confirmar primero, activar después— dejaría dinero registrado contra una cita que no existe en firme: el "anticipo confirmado huérfano" que había que evitar.
>
> **Consecuencia real, señalada en el mensaje de error:** la transferencia ya se hizo en el banco pero el sistema no la deja registrar. No es un agujero, es la secuencia correcta — la Encargada reprograma la cita a un horario libre y vuelve a confirmar. El dinero no se devuelve (`RN-ANT-04`) y sigue válido.

#### 3. 🐛 Mi propia prueba de atomicidad no probaba nada

Escribí la prueba de *"el pago perdedor no queda confirmado"* usando `crearUnitOfWorkFalso()`, que **solo ejecuta el callback y no hace rollback**. La prueba falló —el anticipo quedaba `pagado`— y eso destapó algo peor que un test roto: **con el doble, la prueba habría certificado una atomicidad que no existe.** Habría pasado en verde dando por buena la garantía central de este entregable.

`agenda-anticipos.spec.ts` usa ahora el **`DrizzleUnitOfWork` real**. Es el único archivo que lo necesita, y la nota en el código explica por qué.

**Segundo hallazgo de la misma tanda:** el mensaje de error útil era inalcanzable. `MotorDisponibilidad` lanzaba su `HORARIO_NO_DISPONIBLE` genérico ("no queda lugar") antes de llegar al mío, así que quien confirma un pago recibía un mensaje correcto para alguien que busca horario e inútil para alguien con una transferencia en la mano. Ahora se reescribe con instrucciones: reprogramar y volver a confirmar.

#### 4. `RN-ANT-04` en `ReprogramarCitaUseCase`: el parámetro desaparece

El parámetro `anticipoPagado` lo aportaba quien llamaba, y eso tenía un problema que no era teórico: **cualquier cliente podía saltarse la ventana de 48 horas enviando `anticipoPagado: false`**. Una regla de negocio no puede depender de que el llamante diga la verdad sobre sí mismo.

**Se eliminó, no se complementó.** Mantenerlo habría dejado la puerta abierta. Lo sustituye `AnticipoPort.estadoDe(citaId)`, consultado contra la base. Lo único que aporta ahora el llamante es `confirmacionDeEmpleado`, que es la *"alerta de confirmación explícita"* que `RN-ANT-04` pide: sin ella, `409 REPROGRAMACION_REQUIERE_CONFIRMACION` describiendo que reagendar no devuelve el anticipo.

#### 5. Cómo queda cubierta `RN-CRM-03`

La regla dice que *"cualquier cancelación de una clienta en lista roja requiere aprobación de un empleado, no se ejecuta directamente"*. Nació pensando en un bot que cancelara solo — el ejemplo del mockup es una clienta escribiendo *"quiero cancelar"* y el bot escalando.

**La parte de "la ejecuta un empleado" ya estaba cubierta estructuralmente:** no hay interfaz de clienta (cero links) y `POST /:id/cancelar` exige JWT con rol `SUPER_ADMIN`, `ADMINISTRADOR` o `GERENTE`.

**Lo que faltaba era la aprobación consciente**, y es lo que se añadió: que el empleado no cancele de corrido sin saber que esa clienta es de riesgo o que hay dinero que no se devuelve. La primera llamada sin `confirmacionDeEmpleado` recibe un `409` que describe la consecuencia; hay que reintentar confirmando. **Solo se exige cuando hay algo que advertir** (lista roja o anticipo pagado): pedirlo en toda cancelación habría convertido la advertencia en un trámite que nadie lee.

#### Migración y archivos

**`0012_anticipos.sql`** — esquema `anticipos`, tabla `anticipos`, 4 `CHECK` y 1 índice único a mano.

| Invariante en PostgreSQL | Por qué no basta el código |
|---|---|
| `anticipos_cita_unq` (único por cita) | Dos peticiones simultáneas crearían dos anticipos: la clienta podría pagar dos veces, o confirmarse uno y quedar el otro pendiente con la cita atascada en `en_espera_pago` para siempre |
| `anticipos_confirmacion_coherente` | Un `pagado` sin referencia es un pago que nadie puede verificar — y es el dato que hace falta cuando la clienta afirme que sí pagó. Sin `confirmado_por`, `RN-AUD-01` queda sin respuesta a *"quién lo dio por bueno"* |
| `anticipos_monto_positivo` | Un anticipo de cero no es un anticipo |
| `anticipos_porcentaje_valido` | `NULL` = lo fijó una persona (`DEC-033`), distinto de `0` |

| Archivo | Qué es |
|---|---|
| `anticipos/domain/entities/anticipo.entity.ts` | Aggregate raíz, máquina de 4 estados, cálculo del 40% |
| `anticipos/domain/ports/anticipo.repository.ts` | Puerto de persistencia |
| `anticipos/domain/ports/transicion-de-cita.port.ts` | **Anticipos → Agenda** (el sentido que `P5` señalaba) |
| `anticipos/application/use-cases/anticipos.use-cases.ts` | **5 casos de uso** |
| `anticipos/infrastructure/http/anticipos.controller.ts` | 5 endpoints |
| `agenda/domain/ports/anticipo.port.ts` | **Agenda → Anticipos** |
| `agenda/application/use-cases/transicionar-cita-por-anticipo.use-case.ts` | `activar` y `expirar`; **aquí se resuelve la carrera** |
| `integracion/anticipo.adapter.ts` · `integracion/transicion-de-cita.adapter.ts` | El par cruzado |
| `integracion/agenda-anticipos.spec.ts` | **26 pruebas con adaptadores reales y UoW real** |
| `database/schema/deriva-restricciones-anticipos.spec.ts` | Detector de deriva |

**`Cita.reasignarSilla()`** es nuevo: legítimo porque la clienta nunca eligió silla.

#### Endpoints y RBAC

| Método y ruta | Roles |
|---|---|
| `GET /v1/anticipos?estado=` | Super Admin, Administrador, Gerente |
| `GET /v1/anticipos/de-cita/:citaId` | ídem |
| `POST /v1/anticipos` (alta manual, `DEC-033`) | ídem |
| `POST /v1/anticipos/:id/confirmar-pago` | ídem |
| `POST /v1/anticipos/:id/expirar` | ídem |

> **La `MANICURISTA` recibe `403` en todas, y el motivo es más fino que "no es asunto suyo": saber que una clienta pagó anticipo es saber que está en lista roja.** Solo las de lista roja pagan (`RN-ANT-01`), así que la existencia de un anticipo **revela el estado de riesgo por inferencia**. Dejarle ver anticipos haría deducible justo el dato que el presenter de la agenda protege (`DEC-040`) — una fuga indirecta. Hay una prueba E2E que recorre las cuatro rutas.

#### Generación automática, y por qué

El alta **no es un endpoint del flujo normal**: `AgendarCitaUseCase` genera el anticipo en el mismo acto de crear la cita, dentro de la misma transacción. Una cita `en_espera_pago` **sin** fila de anticipo sería una cita que nadie sabe cuánto cobrar — aparecería en la agenda como pendiente de pago sin monto y la Encargada tendría que calcular el 40% a mano.

`POST /v1/anticipos` existe solo para `DEC-033`: un servicio cuyo precio lo fija una persona no tiene base sobre la que aplicar el porcentaje, así que la generación automática **devuelve `false` sin fallar** y la Encargada registra el monto explícito. Si lanzara, ningún servicio de precio variable podría venderse a una clienta de lista roja.

#### Pruebas: **+46** (913 → **959**, 67 suites)

26 de integración Agenda↔Anticipos con adaptadores y transacciones reales · 14 E2E HTTP · 6 del detector de deriva.

Casos borde que la orden pidió: **la carrera con una sola silla** (la primera en confirmar gana, la segunda recibe `409` y su pago **no queda confirmado**) · **con dos sillas ganan las dos** por reasignación · **una clienta normal puede ganarle el hueco** · **bloqueo a <48h con anticipo pagado vía puerto real**, más la verificación de que **ya no se puede saltar** porque el parámetro no existe · **`403` para `Manicurista`** en las cuatro rutas.

#### Validación

`tsc --noEmit` 0 · `tsc -p tsconfig.eslint.json` 0 · `lint` 0 errores 0 avisos · `build` OK · `drizzle-kit check` OK · `madge --circular` 0 ciclos con **ocho puertos** cruzados · **959/959 pruebas** en 67 suites.

> ## 🔴 INTERMITENCIA DEL ARNÉS DE PRUEBAS — preexistente, sin resolver
>
> **La suite completa falla aproximadamente 1 de cada 8–10 corridas**, con una o dos pruebas. No es un fallo de este entregable, y conviene saberlo antes de confiar en un `959/959` como garantía.
>
> **Lo que se midió, no lo que se supone:**
>
> | Experimento | Resultado |
> |---|---|
> | Suite completa, por defecto (~9 workers) | ~1 de 8 corridas falla |
> | Suite completa con `--maxWorkers=4` | **Sigue fallando** (1 de 6) |
> | Suite completa con `--runInBand` (un solo proceso, secuencial) | **Sigue fallando** (1 de 4) |
> | El spec afectado **aislado** | **20 de 20 limpias** |
>
> **Que falle con `--runInBand` descarta el paralelismo**, que era la hipótesis inicial. Y el spec aislado nunca falla, así que tampoco es su lógica.
>
> **La prueba que falla cambia de corrida en corrida, y alcanza specs de Fase 1 que esta entrega no tocó** (`servicios.e2e`, `usuarios.e2e`, `excepciones-personal.e2e`, además de `citas.e2e`).
>
> **El síntoma más informativo es un `401` donde se esperaba `404`/`201`.** Eso descarta lógica de producto: los tokens de prueba se firman sin `exp` ni `nbf`, con secreto y emisor constantes, y `JwtAuthGuard` no tiene caché ni dependencia del reloj — **ese 401 es imposible de forma determinista**. Apunta al arnés, no al guard.
>
> **Hipótesis principal para quien lo retome:** `postgres-de-prueba.ts` mantiene `conexionDelWorker` como estado de módulo y la base por worker se **recrea entre archivos de spec**; si el pool de `postgres-js` del archivo anterior no está completamente cerrado cuando el siguiente provisiona la base, hay una ventana de carrera. El `afterAll` de `setup-after-env.js` cierra la conexión, pero no hay garantía de que el `app.close()` de cada E2E haya drenado sus peticiones en vuelo antes.
>
> **Merece una orden de trabajo propia.** No se arregló aquí para no mezclar un cambio de infraestructura de pruebas con el cierre de Fase 3, y porque diagnosticarlo bien exige instrumentar el ciclo de vida de la conexión, no adivinar. **Lo que NO se debe hacer es añadir reintentos a las pruebas**: eso esconde el problema y convierte la suite en un detector de ruido.

---

### 🏁 Cierre de Fase 3 — CRM, Lista Roja y Anticipos

| Pendiente | Estado |
|---|---|
| `P5` (circularidad entre contextos) | **Cerrado** — `IntegracionModule`, 8 puertos, `madge` en 0 |
| Bounded Context de CRM / Clientas | **Cerrado** |
| Adaptador permisivo de `clientaId` | **Retirado** |
| Lista Roja (`RN-CRM-02..07`) | **Cerrada**, con la separación sugerir/marcar |
| Anticipos (`RN-ANT-01..04`) | **Cerrados** |
| `RN-CRM-03` (aprobación de cancelación) | **Cubierta** — ver §5 arriba |
| Parámetro temporal `anticipoPagado` | **Eliminado** |

**El flujo de una clienta de riesgo funciona de punta a punta:** se marca lista roja (solo la Dueña) → su siguiente cita nace `en_espera_pago` con anticipo del 40% generado → el hueco sigue libre para otras → una persona confirma la transferencia con referencia → la cita pasa a `agendada` resolviendo la carrera → si no paga, expira y el hueco se libera → si cancela o no se presenta, el dinero queda `retenido` → reagendar exige 48 h y confirmación explícita.

#### Lo que Fase 3 deja abierto a propósito

1. **No hay planificador, y ahora son dos cosas las que lo esperan:** `avanzar-turno` de la Lista de Espera y `expirar` de los anticipos. **Si nadie los invoca, las ofertas no caducan y los anticipos no expiran** — las citas se quedan en `en_espera_pago` indefinidamente. Es la decisión de arquitectura más inmediata que queda.
2. **`vip` sigue sin modelar.** `RN-CRM-02` lo define; se dejó fuera por ser clasificación de beneficio, ortogonal al riesgo.
3. **Ningún aviso sale del sistema.** La clienta no se entera por WhatsApp de que se le pide anticipo: hoy se le dice a mano.
4. **Ninguna migración aplicada a base real.** Las 12 se ejecutan íntegras contra PostgreSQL en cada corrida; falta el entorno (Fase 7).
5. **Cero conciliación bancaria automática.** La referencia se teclea; nada la verifica contra el banco. Es lo que *"cero pasarela de pagos"* implica, y conviene que la Dueña lo sepa: **un empleado puede marcar como pagado un anticipo que nunca llegó**. El `CHECK` garantiza que quede registrado quién lo hizo, no que sea cierto.

#### Listo para Kick-off de Fase 4

- **Canal de WhatsApp (Cloud API, `DEC-043`):** `ADR-008` `Accepted`; el trámite con Meta es camino crítico y **la Bandeja Compartida es condición de puesta en marcha** — al migrar un número, el celular deja de poder responder. Los puntos de enganche ya existen: `NotificacionListaEsperaPort` (su adaptador solo escribe en el log) y los avisos de anticipo, que hoy no existen.
- **Scheduler / Jobs:** dos consumidores concretos esperándolo (punto 1 arriba), más los recordatorios de `RN-NOT-02`. `02-architecture-principles.md` prevé event-driven + outbox; falta decidir mecanismo (`@nestjs/schedule` en proceso frente a worker aparte en Railway) y si el outbox entra ya. **Merece ADR propia.**
- **Agente Bot IA:** `RN-CONV-01` es tajante — *la IA interpreta, nunca decide*. El terreno está preparado: toda regla vive en el dominio y ningún caso de uso acepta decisiones del llamante. Los dos parámetros que sí las aceptaban (`anticipoPagado` y el `fin` de la cita) **se eliminaron en Fase 2 y 3 precisamente por eso**. `DEC-044` ya fijó que el Bot es un *principal de sistema* con lista cerrada de operaciones de solo lectura, y que su credencial se construye en Fase 4.
- **`P6` y las dos máquinas de estado restantes de `P3`** (`Conversación`, `TicketEscalamiento`) son de Fase 4 y toca resolverlos en su kick-off.

---

### 2026-10-15 (b) — Kick-off Fase 3 Parte 1: `P5` cerrado y Bounded Context de CRM / Clientas

Arranca Fase 3. Con esto **el adaptador permisivo de `clientaId` desaparece** y `P5` —uno de los tres bloqueadores no negociables del Closure Plan— queda resuelto.

#### 1. `P5` cerrado: el diagnóstico original era incompleto

El plan lo planteaba como *"una fila del catálogo"*: `FL-ANT-01` invocaba `FL-AGE-09` directamente, y la corrección propuesta era publicar `AnticipoExpirado` por Outbox. Al construir Fase 2 y 3 resultó que **la circularidad no es una anomalía de Anticipos: es la forma normal de las fronteras de este dominio**, y aparece tres veces — Agenda↔Personal, Agenda↔CRM y Agenda↔Anticipos. **Un Outbox resuelve un sentido de un par; no resuelve el patrón.**

Se cierra con `IntegracionModule`, que ya estaba probado en producción: **ningún BC importa a otro, ni su código ni sus tipos**; cada uno declara el puerto que necesita en su propio dominio y la integración provee los adaptadores. Hoy cablea **seis puertos en los dos sentidos**, y el criterio de cierre es mecánico: `madge --circular` da **0 ciclos** en cada corrida. Si alguien añade un `import` directo entre contextos, el comando falla.

**La parte de la decisión que no es "todo atómico":**

- La **anotación de un incidente** va *dentro* de la transacción —perderla quita a la Dueña la alerta que `RN-CRM-06` le promete—, pero **su fallo no propaga**: cancelar es el acto, el incidente es la anotación. Si propagara, un CRM caído desharía la cancelación que la clienta pidió. Hay una prueba que simula CRM caído y verifica que la cita queda cancelada.
- El **aviso de lista de espera** va *fuera*: es una llamada de red, una transacción abierta esperando a un tercero mantiene bloqueos sobre la agenda, y un mensaje enviado no se deshace con un `ROLLBACK`.

El Outbox **sigue siendo compatible** (un adaptador puede leer de él en lugar de llamar a un caso de uso) pero **deja de ser condición de cierre**, porque exige el planificador que el proyecto todavía no tiene.

#### 2. Cómo se concilian `RN-CRM-06` y la facultad exclusiva de la Dueña

**No se contradicen: la orden de trabajo las describió como si chocaran, y leyendo las reglas no chocan.** `RN-CRM-06` dice que un incidente *"activa la sugerencia"*. `RN-CRM-05` dice que la asignación *"es manual... el sistema solo sugiere, nunca decide por sí mismo"*. Hablan de dos cosas distintas, y por eso en el modelo son **dos campos separados**:

| Campo | Quién lo cambia |
|---|---|
| `sugerida_lista_roja` | **El sistema**, solo, ante cualquier incidente. Es una alerta |
| `estado_de_riesgo` | **Solo una persona**, y el RBAC lo restringe a `SUPER_ADMIN`/`ADMINISTRADOR` |

Fusionarlos *sería* la asignación automática que `RN-CRM-05` prohíbe. Tener dos es lo que permite que el sistema avise sin decidir. `RegistrarIncidenteClientaUseCase` **nunca** toca `estado_de_riesgo`, y hay una prueba que lo fija: tras un no-show la clienta queda `sugeridaListaRoja: true` y `estadoDeRiesgo: 'normal'`.

Marcar lista roja **apaga** la sugerencia (ya se atendió; dejarla encendida haría reaparecer la alerta para siempre sobre una decisión tomada), y **rehabilitar no borra el historial** — es una decisión sobre el presente, no una amnesia: si vuelve a fallar, la Dueña tiene que poder ver que ya había pasado.

#### 3. Tres puntos donde la orden roza reglas ya `Aprobada`

Los tres se implementaron como pedía la orden; se registran porque tocan reglas aprobadas y el proyecto exige dejar constancia en vez de reinterpretar en silencio.

**(a) `RN-CRM-01` decía que el teléfono es "clave única de identidad". No lo es.** La orden establece que mamá e hija son dos clientas que comparten número, y eso contradice la unicidad. La regla estaba marcada como *supuesto de trabajo*, así que **la realidad del salón la supera**. Si el teléfono fuera único, la segunda no podría existir — o peor, se fusionarían los dos historiales de incidentes y **una lista roja de la hija caería sobre la madre**. Lo único que se impide es el duplicado real: mismo nombre **y** mismo teléfono.

**(b) `RN-CRM-02` define CUATRO estados; se construyeron tres.** Falta `vip`, y no por olvido: es una clasificación de *beneficio*, ortogonal al riesgo, y meterla en el mismo campo obligaría a decidir qué significa una clienta que sería VIP y además acumula incidentes. **Queda como pendiente**, y el `CHECK` se escribió con `text` precisamente para poder añadirlo.

**(c) La orden pedía "conteo de cancelaciones ordinarias (> 60 min) para encender un indicador de `sugerida_lista_roja`".** Leído así contradiría `RN-CRM-06`, que es explícita: el disparador *"**no** es un umbral acumulado (no se cuentan N cancelaciones en una ventana de días)"*. **Resolución:** las cancelaciones ordinarias **se cuentan** —`RN-CRM-05` sugiere *"con base en historial de cancelaciones"* y la Dueña necesita ese contexto— pero **no encienden la sugerencia por sí solas**. Hay una prueba con cinco cancelaciones ordinarias que verifica `sugeridaListaRoja: false`. Si la intención era el umbral acumulado, es un cambio de una línea, pero exigiría modificar `RN-CRM-06`.

#### 4. 🐛 Dos fallos encontrados por las pruebas de esta entrega

**Las citas pendientes de anticipo eran invisibles en la agenda.** Una cita de clienta en lista roja nace `en_espera_pago`, que **libera horario** (`RN-ANT-03`), y `listarParaConsulta` filtraba por *"estados que ocupan"*. Resultado: **justo las citas que hay que perseguir para cobrar el anticipo no se veían**. Son dos preguntas distintas —"¿consume capacidad?" y "¿tiene que aparecer en pantalla?"— y estaban respondidas con el mismo array. Se añadió `ESTADOS_VISIBLES_EN_AGENDA`, que excluye solo lo anulado o sustituido (`cancelada`, `expirada`, `reprogramada`).

**El teléfono normalizado no unificaba el formato internacional.** Mi primera versión quitaba solo los símbolos, así que `+52 442 111 2233` (12 dígitos) y `442 111 2233` (10) eran números distintos. No es hipotético: **WhatsApp entrega siempre formato internacional** y recepción teclea 10 dígitos, así que la misma clienta habría tenido **dos expedientes —uno del bot y otro del mostrador— con el historial de incidentes partido en dos**, que es el dato del que depende si se le pide anticipo. Ahora se conservan los últimos 10 dígitos, lo que absorbe el `52` y el `1` heredado de los móviles. Limitación asumida y anotada: un número extranjero se truncaría.

#### Migración y archivos

**`0011_crm_clientas.sql`** — esquema `crm`, tablas `clientas` e `incidentes_clienta`, 4 `CHECK` y 2 índices únicos a mano.

| Decisión de modelo | Por qué |
|---|---|
| Identidad **global**, sin `sucursal_id` | `RN-CRM-01`: la misma clienta en las tres sucursales, historial que las cruza |
| **Sin** único sobre `telefono` | Mamá e hija. El detector de deriva vigila que nadie lo añada |
| `incidentes_clienta` es **tabla, no contador** | `RN-CRM-05` exige que la sugerencia sea *revisable*. Un "3" no deja juzgar si tres cancelaciones con aviso valen lo mismo que tres no-shows |
| Único `(cita_id, tipo)` | Un reintento no infla el historial: es la base de una decisión que perjudica a la clienta |

| Archivo | Qué es |
|---|---|
| `crm-y-clientas/domain/entities/clienta.entity.ts` | Aggregate raíz, normalización de teléfono |
| `crm-y-clientas/domain/ports/clienta.repository.ts` | Puerto; `buscarPorTelefono` devuelve **lista** |
| `crm-y-clientas/infrastructure/persistence/drizzle-clienta.repository.ts` | Adaptador |
| `crm-y-clientas/application/use-cases/clientas.use-cases.ts` | **8 casos de uso** |
| `crm-y-clientas/infrastructure/http/clientas.controller.ts` | 6 endpoints |
| `agenda/domain/ports/contexto-clienta.port.ts` | Sustituye a `VerificarClientaPort` |
| `agenda/domain/ports/registro-de-incidentes.port.ts` | Agenda → CRM |
| `integracion/contexto-clienta.adapter.ts` | Adaptador **real** |
| `integracion/registro-de-incidentes.adapter.ts` | Adaptador **real** |
| `integracion/agenda-crm.spec.ts` | **16 pruebas con adaptadores reales** |
| `database/schema/deriva-restricciones-crm.spec.ts` | Detector de deriva de `crm` |

**Eliminados:** `verificar-clienta.port.ts` y `crm-no-construido-verificar-clienta.adapter.ts`.

#### Endpoints y RBAC

| Método y ruta | Roles |
|---|---|
| `GET /v1/crm/clientas?telefono=` | Super Admin, Administrador, Gerente |
| `GET /v1/crm/clientas/por-telefono-anterior` | ídem |
| `GET /v1/crm/clientas/:id` (detalle + incidentes) | ídem |
| `POST /v1/crm/clientas` | ídem |
| `POST /v1/crm/clientas/:id/telefono` | ídem |
| `POST /v1/crm/clientas/:id/estado-de-riesgo` | **Solo Super Admin y Administrador** |

La `MANICURISTA` **no entra en ninguna ruta**: la Dueña fue explícita en que no ve lista roja (`DEC-040`) y aquí todo es información de clientas. La `RECEPCIONISTA` tampoco, por coherencia con el resto de la plataforma.

**El `enListaRoja` de la agenda no se filtra: no se consulta.** Para una `MANICURISTA`, `ConsultarAgendaUseCase` **no llama a CRM en absoluto**. La diferencia con consultarlo y no enviarlo no es sutil: si el dato nunca entra en el proceso, no puede escaparse por un presenter futuro, por un log ni por un mensaje de error.

#### Integración `Agenda ↔ CRM`: los tres resultados distintos

| Estado de la clienta | Qué pasa al agendar |
|---|---|
| No existe | **404** — antes se agendaba igual con un uuid inventado |
| `bloqueada` | **409 `CLIENTA_BLOQUEADA`** (`RN-CRM-04`), para escalar a una persona |
| `lista_roja` | La cita **nace `en_espera_pago`** (`RN-ANT-01`), no `agendada` |
| `normal` | `agendada` |

El puerto se llama `obtener` y no `puedeAgendar` a propósito: **la decisión es de Agenda, no de CRM**. Un booleano habría metido la política de reservas dentro de CRM y habría hecho imposible distinguir `bloqueada` de `lista_roja`, que llevan a resultados opuestos.

Incidentes conectados: `MarcarNoShowUseCase` → `no_show`; `CancelarCitaUseCase` → `cancelacion_tardia` (≤60 min) o contador ordinario (>60); `ReprogramarCitaUseCase` → `reprogramacion_tardia` (≤60 min). El umbral se **importa** de `CancelarCitaUseCase` en vez de redefinirse: es una sola regla de negocio y dos constantes acabarían divergiendo.

#### Pruebas: **+75** (837 → **912**, 65 suites)

24 de CRM por integración · 22 E2E HTTP de CRM · 16 de integración Agenda↔CRM con adaptadores reales · 7 del detector de deriva de `crm` · 6 E2E HTTP de la integración en la API de citas.

Casos borde que la orden pidió, todos verificados: **dos clientas con el mismo teléfono** (integración y HTTP) · **`clientaId` inexistente rechazado** en Agenda · **cita de lista roja naciendo `en_espera_pago`** (y visible en la agenda, y sin retener el horario) · **`Gerente` y `Manicurista` reciben 403** al marcar y al retirar lista roja.

#### Validación

`tsc --noEmit` 0 · `tsc -p tsconfig.eslint.json` 0 · `lint` 0 errores 0 avisos · `build` OK · `drizzle-kit check` OK · `madge --circular` 0 ciclos · **912/912 pruebas** en 65 suites.

#### Terreno listo para Anticipos (Fase 3 Parte 2)

- **`en_espera_pago` ya se produce de verdad**, no en teoría: lo crea `AgendarCitaUseCase` cuando la clienta está en lista roja, y **no retiene el horario** (`RN-ANT-03`) — hay una prueba en la que otra clienta toma el mismo hueco con una sola silla. La carrera se resuelve **al confirmar el pago**, que es exactamente lo que falta construir.
- La **transición que falta** es `en_espera_pago → agendada`/`confirmada`, ya legal en `TRANSICIONES_LEGALES`. Confirmar el pago es lo que la dispara, y es ahí donde puede fallar con `SILLA_OCUPADA` si alguien se adelantó: **ese 409 es el comportamiento aprobado**, no un fallo.
- `ReprogramarCitaUseCase` ya tiene el parámetro `anticipoPagado` y la ventana de 48 h de `RN-ANT-04`, **hoy aportado por quien llama**. Pasa a puerto cuando exista el contexto de Anticipos — es el siguiente adaptador de `IntegracionModule`, con el patrón de `P5` ya cerrado.
- **Pendientes que Anticipos tendrá que mirar:** `RN-CRM-03` exige que *"cualquier cancelación de una clienta en lista roja requiera aprobación de un empleado"*, y eso **no está implementado** — hoy la Encargada cancela sin paso de aprobación. Y `RN-ANT-04` no se reembolsa nunca, lo que choca con la expiración de `en_espera_pago`: hay que decidir qué pasa con una cita cuyo anticipo nunca se paga.

---

### 2026-10-15 — Fase 2 (parte 7): Lista de Espera y reprogramación de servicio descontinuado. **🏁 FASE 2 CERRADA**

Último entregable del Motor de Agenda. Con esto Fase 2 queda completa y el proyecto puede abrir Fase 3.

#### 1. Reprogramación de servicio descontinuado — la tensión que quedó abierta

`ResolutorDeServicio` distingue ahora **vender** de **mover algo ya vendido**:

- `AgendarCitaUseCase` → `resolver()`, que sigue exigiendo `activo`. No se abren ventas nuevas de un servicio retirado.
- `ReprogramarCitaUseCase` → `resolverParaMoverCita()`, que **solo exige que exista y tenga duración**.

Lo que esto arregla: la clienta de un servicio descontinuado solo podía **cancelar**. Y la que había pagado anticipo quedaba atrapada entre un horario que ya no le servía y una cancelación que puede costarle el anticipo, por una decisión de catálogo tomada *después* de su compra. La duración sí se sigue validando, porque de ahí sale el tamaño del nuevo hueco. El `cotizacion_snapshot` sigue inmutable (`RN-AGE-08`). Hay una prueba que fija también la **asimetría**: si `resolver` y `resolverParaMoverCita` llegaran a comportarse igual, la distinción se habría perdido sin que nadie lo notara.

#### 2. 🐛 Un bloqueo mutuo latente, encontrado antes de usarlo

`AceptarOfertaListaEsperaUseCase` invoca a `AgendarCitaUseCase`, y cada uno declara su propia unidad de trabajo. `DrizzleUnitOfWork` abría **una segunda transacción sobre otra conexión del pool**. Las consecuencias no eran teóricas: la interna no vería lo escrito por la externa (sin commit todavía), podía quedarse esperando filas que la externa tenía bloqueadas —**un bloqueo mutuo entre dos transacciones de la misma petición**— y si la externa fallaba después, lo que la interna ya había confirmado quedaba escrito. **Un rollback a medias es peor que no tener transacciones.**

`ejecutar()` ahora **se une a la transacción en curso** si hay una. La frontera transaccional pasa a ser la del caso de uso más externo, que es lo que "Unit of Work" significa: una unidad por operación de negocio, no una por capa. Cuatro pruebas de integración lo fijan, incluida la que demuestra que **el rollback externo deshace lo escrito por la interna**.

No era deuda declarada de nadie: estaba esperando al primer caso de uso que llamara a otro.

#### 3. Lista de Espera

**Migración `0010_lista_espera.sql`** — tabla `agenda.lista_espera`, 12 columnas, 2 índices normales, **2 índices únicos parciales** y 3 `CHECK` escritos a mano.

| Decisión de modelo | Por qué |
|---|---|
| Vive en el BC **Agenda** | Habla de huecos y de citas: decidir candidatas exige cruzar `MotorDisponibilidad`, y aceptar una oferta **es** agendar. Un contexto aparte preguntaría a Agenda en cada paso |
| **Sin columna `posicion`** | El FIFO es `creado_en`. Una columna de posición habría que recalcularla en cada alta, baja y expiración, y un fallo a medio camino dejaría dos personas en el mismo puesto. El reloj no se desordena |
| **No copia la duración** del servicio | Se resuelve por `ContextoCatalogoPort`. Copiarla crearía un segundo lugar donde vive la verdad del catálogo — el error que la parte 6 acabó de corregir en `citas` |
| `fecha` como `date`, no `timestamptz` | La clienta pide "el jueves". Y un hueco que se libera a las 23:30 de Querétaro es del jueves aunque en UTC ya sea viernes: `fechaLocal()` lo resuelve en la zona del negocio |

**El invariante central vive en PostgreSQL, no en el código.** `lista_espera_una_notificada_por_fila` es un **índice único parcial** `(sucursal_id, fecha) WHERE estado = 'notificada'`. Es la regla *"se avisa a una sola clienta a la vez"*, y vale lo mismo que para el no-doble-booking: si solo la cumpliera la aplicación, dos liberaciones simultáneas —una cancelación y una reprogramación en el mismo segundo— pasarían las dos la comprobación previa y avisarían a dos clientas del mismo horario. Que sea **parcial** importa: sin el `WHERE` impediría tener dos solicitudes cualesquiera en la misma fila, es decir rompería la lista de espera entera. El detector de deriva comprueba las dos cosas.

Otro índice parcial impide que una clienta se apunte dos veces a lo mismo **mientras su solicitud siga viva**, dejando fuera las terminadas a propósito: tiene que poder volver a apuntarse después.

#### Archivos creados

| Archivo | Qué es |
|---|---|
| `database/migrations/0010_lista_espera.sql` | Tabla + índices parciales + `CHECK` |
| `agenda/domain/entities/solicitud-lista-espera.entity.ts` | Entidad y máquina de estados |
| `agenda/domain/ports/lista-espera.repository.ts` | Puerto de persistencia |
| `agenda/domain/ports/notificacion-lista-espera.port.ts` | Puerto de salida del aviso |
| `agenda/infrastructure/persistence/drizzle-lista-espera.repository.ts` | Adaptador Drizzle |
| `agenda/infrastructure/notificacion/lista-espera-solo-log.adapter.ts` | **Provisional: no envía nada** |
| `agenda/application/use-cases/lista-espera.use-cases.ts` | 6 casos de uso |
| `agenda/application/use-cases/lista-espera.spec.ts` | **28 pruebas de integración** |
| `agenda/infrastructure/http/lista-espera.controller.ts` | 5 endpoints |
| `agenda/infrastructure/http/dto/lista-espera.dto.ts` | 4 DTOs |
| `agenda/test-utils/lista-espera-inerte.ts` | Doble para las pruebas del ciclo de vida |
| `shared/persistence/drizzle-unit-of-work.spec.ts` | 4 pruebas del anidamiento |

#### Casos de uso y endpoints

| Método y ruta | Caso de uso | Roles |
|---|---|---|
| `GET /v1/agenda/lista-espera` | `ConsultarListaEsperaUseCase` | Super Admin, Administrador, Gerente |
| `POST /v1/agenda/lista-espera` | `InscribirEnListaEsperaUseCase` | ídem |
| `POST /v1/agenda/lista-espera/:id/aceptar` | `AceptarOfertaListaEsperaUseCase` | ídem |
| `POST /v1/agenda/lista-espera/avanzar-turno` | `AvanzarTurnoListaEsperaUseCase` | ídem |
| `DELETE /v1/agenda/lista-espera/:id` | `CancelarSolicitudListaEsperaUseCase` | ídem |
| *(interno)* | `ProcesarListaEsperaUseCase` | lo invocan Cancelar y Reprogramar |

**La `MANICURISTA` queda fuera por completo, incluso de la lectura.** La fila contiene `clientaId` de personas que no son sus clientas, y su vista de iPad no transporta datos de clientas por diseño (`DEC-040`). La `RECEPCIONISTA` también, por coherencia con el resto de la API de Agenda, donde no agenda ni cancela.

#### Las dos decisiones de diseño que la orden fijó, y cómo quedaron en código

**La oferta NO retiene el hueco** (`RN-AGE-13`, coherente con `RN-ANT-03`). Notificar no bloquea ninguna silla: la ventana solo gobierna *a quién se avisa primero*, para no escribir a diez personas del mismo horario. **La carrera se resuelve al agendar**, en `AceptarOfertaListaEsperaUseCase`: si otra clienta tomó el horario mientras la oferta estaba abierta, devuelve `409 HORARIO_NO_DISPONIBLE` y la solicitud **se queda `notificada`** — no se da por aceptada ni se expira, así que la clienta sigue en su turno y puede aceptar otro hueco. Hay una prueba que lo reproduce literalmente.

**Desacoplado del planificador y de WhatsApp.** `AvanzarTurnoListaEsperaUseCase` es un caso de uso invocable por HTTP, no un daemon: Blanc no tiene planificador y montarlo es una decisión de arquitectura con su propia ADR. Hoy lo dispara la Encargada o un job runner externo; cuando exista el planificador, **solo cambia quién llama**. El aviso sale por `NotificacionListaEsperaPort`, cuyo adaptador actual solo escribe en el log.

> ⚠️ **HOY NINGÚN MENSAJE SALE DEL SISTEMA.** El canal es de Fase 4 (`DEC-043`). La oferta queda registrada con su ventana corriendo y **la Encargada avisa a mano** mirando `GET /v1/agenda/lista-espera`. Ese `GET` no es una comodidad: es la única forma de saber a quién llamar. El adaptador se llama `ListaEsperaSoloLogAdapter` a propósito, por la lección de `SinAgendaVerificarCitasFuturasAdapter`.

#### 🐛 Un fallo encontrado por una prueba de la propia orden

La orden exigía probar *"la expiración de la ventana de 1h pasando a la siguiente en FIFO"*. **Esa prueba falló**, y el motivo era de fondo: al expirar un turno hay que reofrecer el hueco a la siguiente, pero la tabla solo guardaba `notificada_en` —*cuándo se avisó*— y no *qué se ofreció*. El código reevaluaba la hora del aviso, que está en el pasado, el umbral de 30 minutos lo descartaba como hueco perdido y **el turno nunca pasaba a la siguiente**. El avance FIFO, que es el corazón de `DEC-039`, estaba roto en silencio.

Mi primer impulso fue documentarlo como limitación conocida para no ampliar el alcance. Era la decisión equivocada: rompía un requisito explícito de la orden. Se añadió la columna **`hueco_inicio`** y el `CHECK` que exige que una oferta `notificada` la tenga — una oferta de la que no se sabe qué se ofreció no sirve para nada. Hay una prueba que fija que `huecoInicio` y `notificadaEn` son datos distintos y que la reoferta es del mismo hueco.

#### Casos borde que la orden pidió, todos verificados

| Caso | Resultado |
|---|---|
| **1h liberada, primera de la fila quiere 2h** | Se la salta (`descartadasPorNoCaber: 1`) y ofrece a la de 1h. La de 2h **conserva su lugar**, en `en_espera` sin penalización. Probado por integración **y por HTTP** |
| **2h liberadas, primera quiere 2h** | Sí es candidata, `descartadasPorNoCaber: 0` |
| **Nadie cabe** | No se inventa oferta: `ofrecida: null` |
| **30 min vs 60 min** | A los **45 min** hay `incidenteTardio: true` **y** `huecoPerdidoCortoPlazo: false` a la vez. Son dos umbrales de cosas distintas y la prueba fija ambas constantes |
| **≤30 min** | `huecoPerdidoCortoPlazo: true`, **nadie es avisado**, la solicitud sigue `en_espera` y queda la bandera auditada para la Dueña. El umbral es inclusivo: a 30 exactos ya se da por perdido |
| **Expiración de la ventana** | La primera pasa a `expirada`, la segunda recibe `notificada`, y el hueco reofrecido es **el mismo** |
| **Ventana parametrizable** | Con 10 min: a los 5 no ha vencido, a los 11 sí |
| **Dos huecos seguidos** | Se avisa **solo a una**: ya hay oferta abierta en esa fila |
| **Reprogramar libera hueco** | Ofrece el horario de la cita original a la fila |

**El hueco real se calcula cruzando `MotorDisponibilidad`, no el rango de la cita liberada.** `cabeUnServicio()` pregunta si el rango *completo* que ocuparía el servicio tiene capacidad, así que si se cancela la cita de 10:00–11:00 pero la de 11:00–12:00 sigue en pie, un servicio de dos horas no cabe — el solape deja la capacidad en cero. Comparar duraciones contra el rango liberado habría dado la respuesta equivocada.

#### Decisión transaccional en Cancelar y Reprogramar

La fila se procesa **después** de que la cancelación esté confirmada y **en su propia transacción**, por dos motivos: el hueco solo está libre una vez persistido el estado, y **la cancelación no puede depender de la fila** — en una sola transacción, un fallo al buscar candidatas desharía la cancelación y la clienta que llamó para cancelar seguiría con su cita.

Si procesar la fila falla, **no se propaga**: devolvería un 500 sobre una cancelación ya confirmada, y quien lo viera reintentaría para recibir un 409 de transición inválida. Se registra en el log, el resultado viaja como `listaEspera: null` —distinto de `{ofrecida: null}`, que sí significa "no había candidata"— y `avanzar-turno` recoge esa fila más tarde.

#### Pruebas: **+46** (791 → **837**, 61 suites)

28 de integración de Lista de Espera · 14 E2E HTTP · 4 del anidamiento de `UnitOfWork` · 4 de `resolverParaMoverCita` · 4 nuevas en el detector de deriva, ahora extendido a `agenda.lista_espera`.

#### Validación

`tsc --noEmit` 0 · `tsc -p tsconfig.eslint.json` 0 · `lint` 0 errores 0 avisos · `build` OK · `drizzle-kit check` OK · `madge --circular` 0 ciclos · **837/837 pruebas** en 61 suites.

---

### 🏁 Cierre de Fase 2 — Motor de Agenda

Lo que el motor hace hoy, de punta a punta: **sillas virtuales** con el no-doble-booking garantizado por dos `EXCLUDE USING gist` en PostgreSQL · **capacidad efectiva** `MIN(sillas, manicuristas)` · **horario de sucursal** con corte de mediodía y domingo como configuración · **máquina de estados** formal de 9 estados · **ciclo de vida completo** incluida la reprogramación con cadena trazable y tope de 3 · **ausencias y coberturas** con aviso de citas comprometidas por franja · **integración con Catálogo** que valida servicio y deriva duración · **cotización congelada** por el backend · **API HTTP** con RBAC por método y vista de iPad filtrada · **Lista de Espera** con FIFO, encaje por duración y ventana configurable.

| Pendiente de Fase 2 | Estado |
|---|---|
| Bloqueos 1–7 de §16 (kick-off) | **Todos cerrados o reclasificados** |
| Deudas 1–6 de §16 (parte 5) | **5 cerradas**; `clientaId` parcial por diseño (gancho de Fase 3) |
| Tensión de reprogramación de servicio de baja | **Cerrada** |
| Lista de Espera | **Cerrada** en dominio, persistencia y API |
| `P3` (máquina de estados de `Cita`) | **Cerrado**; quedan las dos de Fase 4 |
| `P9` (`usuarios ↔ manicuristas`) | **Cerrado** |

#### Lo que Fase 2 deja abierto a propósito, y hay que tener presente al planificar

1. **No existe planificador.** `avanzar-turno` se invoca a mano o por un job runner externo. **Si nadie lo llama, las ofertas vencidas no caducan y la fila no avanza.** Es la decisión de arquitectura más inmediata que queda — `02-architecture-principles.md` prevé event-driven + outbox, pero el disparador temporal no está construido.
2. **Ningún aviso sale del sistema.** Lista de Espera y confirmaciones dependen del canal de Fase 4. Hoy todo aviso es manual.
3. **`clientaId` no se valida.** El adaptador provisional acepta cualquier uuid. Es lo primero que Fase 3 cierra, sustituyendo un solo proveedor.
4. **Ninguna migración se ha aplicado a una base real.** Las 11 se ejecutan íntegras contra PostgreSQL en cada corrida de pruebas, así que están verificadas; lo que no existe es el entorno. Es actividad de Fase 7.
5. **`expirada` es terminal: quien deja pasar su turno pierde su lugar en la fila para esa fecha.** Es la mecánica que fijó la orden de trabajo y está implementada así. **Pregunta para la Dueña:** si la intención era que solo perdiera *ese hueco* y siguiera esperando otro del mismo día, es un cambio de una línea en `TRANSICIONES_LISTA_ESPERA` más decidir dónde la recoloca el FIFO.
6. **El `no_show` no se marca solo**, y la cita tampoco se completa sola (`DEC-040`): las dos son acciones de una persona. Sin planificador no hay nada que las dispare por tiempo, y eso es deliberado.

#### Listo para Kick-off de Fase 3

El Bounded Context de **CRM / Clientas** tiene su costura ya construida y ejercitada en producción:

- **`VerificarClientaPort`** — `AgendarCitaUseCase`, `ReprogramarCitaUseCase` e `InscribirEnListaEsperaUseCase` ya lo llaman. Fase 3 sustituye `CrmNoConstruidoVerificarClientaAdapter` en `IntegracionModule` y **no toca ningún caso de uso**.
- **Lista Roja** — el mismo puerto es su punto natural: una clienta en lista roja no deja de existir, pero su reserva exige anticipo. Por eso el método se llama `existe` y no `puedeAgendar`.
- **Anticipos** — `en_espera_pago` ya existe como estado y **libera horario** (`RN-ANT-03` por encima de `DEC-034`, corregido en la migración `0007`): la carrera se resuelve al confirmar el pago, no reteniendo el hueco. `ReprogramarCitaUseCase` ya tiene el parámetro `anticipoPagado` y la regla de 48 horas de `RN-ANT-04`, hoy aportado por quien llama y **pendiente de pasar a un puerto** cuando exista el contexto.
- **Incidentes** — `CancelarCitaUseCase` ya devuelve `incidenteTardio` (`RN-CRM-06`) **sin marcar lista roja**: `DEC-042` reserva esa decisión a la Dueña.
- `P5` (circularidad Agenda↔Anticipos) **sigue abierto** y es el único de los tres bloqueadores originales que falta. No ha estorbado porque Anticipos no se ha construido, pero **bloquea Fase 3**: conviene resolverlo en el kick-off.

---

### 2026-10-14 (e) — Fase 2 (parte 6): integración Agenda ↔ Catálogo y saneamiento de §16. **4 de 6 deudas cerradas**

**Lista de Espera NO entra en este commit.** La orden autorizaba priorizar explícitamente, y se priorizó: es un submódulo completo (esquema, migración, entidad, repositorio, FIFO con ventana de expiración y su enganche en cancelar/reprogramar) con **dos dependencias de infraestructura que hoy no existen**. Diseño preciso al final de esta entrada.

#### El cambio de fondo: la duración de la cita ya no la decide el cliente

Hasta ahora `inicio` y `fin` llegaban libres por HTTP. Se podía **reservar una hora para un servicio de dos** —y la silla quedaba libre a mitad del trabajo, lista para venderse otra vez— o **tres horas para uno de una**, bloqueando capacidad que el salón podía vender. El único filtro sobre `servicioId` era el formato del uuid, así que también se podía agendar **un servicio inexistente o dado de baja**.

Ahora el `fin` se **deriva** de `inicio + duración del catálogo`. Si el cliente lo envía, tiene que coincidir al minuto o recibe `409 DURACION_NO_COINCIDE_CON_SERVICIO` con el `finEsperado` en el detalle, para que pueda corregirse solo. `ReprogramarCitaUseCase` **también** revalida el catálogo: antes no lo hacía, así que una cita de un servicio de baja se podía mover indefinidamente.

#### `cotizacion_snapshot` lo construye el backend (cierra el bloqueo 6 por completo)

`ResolutorDeServicio.construirSnapshot()` congela nombre, categoría, duración y precio **desde el catálogo oficial**. El DTO sigue sin aceptar el campo, así que un cliente que lo envíe recibe `400`: los precios no entran desde fuera, igual que no los decide OpenAI.

Tres decisiones del snapshot que conviene conocer antes de tocarlo:

- **`DEC-033`: con `requiereCotizacionManual`, `totalCentavos` es `null`, no `0`.** Un cero diría "cuesta nada"; `null` dice "nadie lo ha cotizado todavía", que es la verdad. El precio de referencia del catálogo sí se conserva, para quien vaya a cotizar a mano.
- **`incluyeModificadores: false`, explícito.** Una `Cita` transporta un solo `servicioId` y ninguna composición por uña, así que no hay de dónde sacarlos — y sumar duraciones o precios de modificadores **contradiría `RN-COT-01`**, que exige una tabla de combinaciones específicas y *nunca* una suma. Ese cálculo es de `FL-COT-03`.
- **Lleva `version: 1`.** Cuando `FL-COT-03` amplíe la forma, los snapshots ya congelados seguirán siendo legibles sin adivinar su estructura.
- **Reprogramar NO recotiza.** `RN-AGE-08` declara el snapshot inmutable y `DEC-042` separa reprogramar de cancelar: mover la hora no es una venta nueva. Si el catálogo subió de precio entretanto, la clienta conserva el que se le dijo. Hay una prueba E2E que sube el precio del catálogo entre agendar y reprogramar y verifica que el snapshot no cambia.

#### Archivos creados

| Archivo | Qué es |
|---|---|
| `agenda/domain/ports/contexto-catalogo.port.ts` | Lo que Agenda pregunta a Catálogo (6 campos, no la entidad) |
| `agenda/domain/ports/verificar-clienta.port.ts` | **El gancho exacto de Fase 3** para CRM/Clientas |
| `agenda/domain/services/resolutor-de-servicio.ts` | Resolver + derivar rango + congelar snapshot |
| `agenda/domain/services/resolutor-de-servicio.spec.ts` | 14 pruebas unitarias |
| `agenda/test-utils/contexto-catalogo-falso.ts` | Dobles, incluido un catálogo con un servicio por duración |
| `integracion/contexto-catalogo.adapter.ts` | Traduce `Servicio` → `ServicioAgendable` |
| `integracion/crm-no-construido-verificar-clienta.adapter.ts` | **Provisional y a la vista** — ver abajo |
| `shared/tiempo/zona-horaria-negocio.ts` | `ZONA_HORARIA_NEGOCIO` y helpers de hora de pared |
| `shared/auth/principal-de-sistema.ts` | Decisión de RBAC del Bot (`DEC-044`) |
| `shared/auth/principal-de-sistema.spec.ts` | Guardia del catálogo cerrado de 7 roles |

#### Archivos modificados de forma relevante

- `agenda/application/use-cases/agendar-cita.use-case.ts` — `rangoHorario` → `inicio` + `fin?`; valida catálogo y clienta; congela el snapshot **fuera del bucle** de reintento de sillas (reintentar en otra silla no recotiza nada).
- `agenda/application/use-cases/reprogramar-cita.use-case.ts` — `nuevoRangoHorario` → `nuevoInicio` + `nuevoFin?`; revalida catálogo; **arrastra** el snapshot original.
- `agenda/application/use-cases/consultar-agenda.use-case.ts` — paginación y tope de rango; devuelve `PaginaDeAgenda`.
- `agenda/domain/ports/cita.repository.ts` + adaptador Drizzle — `listarParaConsulta` con `LIMIT`/`OFFSET`, `ORDER BY` estable y **filtro de manicurista en SQL**.
- `integracion/consulta-agenda.adapter.ts` — déficit **por franja**, ver abajo.
- `sucursales-y-personal/domain/entities/excepcion-personal.entity.ts` — `MAXIMO_DIAS_DE_EXCEPCION = 90`.
- `sucursales-y-personal/application/use-cases/registrar-excepcion-personal.use-case.ts` — valida que el destino de una cobertura esté abierto.
- `catalogo-y-cotizacion.module.ts` — exporta `SERVICIO_REPOSITORY` para que la integración construya el adaptador.
- `agenda/domain/services/motor-disponibilidad.ts` — los helpers de zona horaria se movieron a `shared/tiempo` y se reexportan desde aquí.

**Sin migraciones nuevas.** Nada de esta entrega cambió el esquema: `cotizacion_snapshot` ya existía desde la migración `0009`.

#### Las 6 deudas de §16

| # | Deuda | Estado |
|---|---|---|
| **1** | `servicioId` y `clientaId` sin validar | **`servicioId` CERRADA. `clientaId` PARCIAL** — ver abajo |
| **2** | Duración sin validar contra el servicio | **CERRADA** |
| **3** | Ruido del aviso de sobrecupo | **CERRADA** — era un bug, no ruido |
| **4** | Rango de excepción sin validar | **CERRADA** |
| **5** | `GET` de agenda sin paginar ni acotar | **CERRADA** |
| **6** | Principal del Bot | **DECIDIDA (`DEC-044`), construcción en Fase 4 a propósito** |

**Deuda 3 — era un bug, no ruido.** El déficit se calculaba sobre **todo el rango de la excepción**. Una ausencia de un día agregaba las citas de las 9:00 con las de las 17:00 y las comparaba contra el personal del día entero. Eso producía **dos errores a la vez**: señalaba citas de horas tranquilas que nadie iba a dejar sin atender *y podía ocultar un sobrecupo real de una franja concreta* dentro de un promedio diario que cuadraba. **La capacidad es por instante, no por día.** Ahora el déficit se mide en el rango de cada cita, con caché por rango para no repetir la consulta. La prueba se verificó midiendo sobre el rango de la excepción: falla.

**Deuda 4 — dos validaciones distintas.** (a) `MAXIMO_DIAS_DE_EXCEPCION = 90`: un `2027` por `2026` creaba una ausencia de siglos que el motor respetaba en silencio — la sucursal empezaba a rechazar citas y el registro culpable estaba en una fecha que nadie iba a mirar. Noventa días es holgado para una incapacidad larga y corto frente a un error de año; más que eso no es un dato operativo, es una baja. (b) El destino de una cobertura debe estar **abierto en algún momento del rango**: una cobertura es un *movimiento*, así que con el destino cerrado la resta en la sucursal base ocurre igual y la suma no sirve de nada. Se exige solape con **algún** bloque y no que quepa en uno, porque cubrir el lunes entero cruza el corte de las 12:00 por definición. **Una ausencia no se valida contra ningún horario**: avisar que no vienes el domingo es información válida aunque el salón esté cerrado.

**Deuda 5 — y un fallo que la paginación habría introducido.** `ConsultarAgendaDto` exige `sucursalId` uuid, fechas ISO-8601, tope de **31 días** y `limite ≤ 200`. El tope de rango se comprueba **también en el caso de uso**, no solo en el DTO: el DTO protege la ruta HTTP, pero la regla tiene que valer igual para el bot y para cualquier job futuro.

> ⚠️ **El filtro de manicurista tuvo que bajar a SQL.** Filtraba en memoria *después* de traer las filas. Con un `LIMIT` eso da resultados falsos: una manicurista con sus citas en la página 2 vería la página 1 vacía y concluiría que no tiene trabajo. Quién decide el `manicuristaId` sigue siendo el caso de uso a partir de los permisos (`P9`), nunca la petición — lo que cambió es que ese filtro viaja a la consulta. Hay una prueba E2E específica. La consulta lleva `ORDER BY` estable (inicio, luego id) porque sin él PostgreSQL no garantiza el mismo orden entre páginas y una cita podría salir dos veces o ninguna.

**Efecto lateral deseable:** al tener DTO, el `GET` ahora **rechaza con 400** un `manicuristaId` en la query, en vez de ignorarlo. Es más fuerte que ignorarlo — quien lo intenta se entera de que ese filtro no se acepta en lugar de creer que se aplicó.

**Deuda 6 — `DEC-044`: el Bot no es un octavo rol.** Era la opción obvia y es la incorrecta. El catálogo de 7 roles es **cerrado** por `RN-SEG-01`/`functional-scope.md` §2 y `ADR-024` lo ratificó al elegir el enum estático; añadir un valor habría sido una desviación silenciosa de una decisión aceptada. Y es incorrecto de fondo: los 7 roles describen personas con alcance de sucursales, jerarquía (`puedeAsignarRol`) y registro en `usuarios` — el bot no tiene nada de eso, y meterlo en el enum obligaría a **cada `@Roles(...)` existente** a preguntarse si lo incluye.

Se fija en código la lista de operaciones (`OPERACIONES_PERMITIDAS_AL_BOT`), **todas de lectura**: `DEC-042` dice que ninguna clienta cancela sola y `DEC-040` que la finalización no es automática, así que un bot con escritura contradiría ambas.

> **Decisión consciente, señalada para que pueda revocarse:** **no se emitió credencial ni se abrió ningún endpoint al bot.** El canal de WhatsApp es de Fase 4 y no existe; una vía de autenticación viva, sin consumidor y sin nadie ejercitándola en serio, es superficie de ataque a cambio de nada. La postura efectiva hoy es **denegar**. Si se prefiere construir ya el token de servicio, es una orden de trabajo pequeña y aislada — pero debería justificarse con un consumidor real.

`principal-de-sistema.spec.ts` convierte "el catálogo es cerrado" en algo exigible: falla si el enum `Rol` crece. Mismo criterio que el detector de deriva de `agenda.citas` — una regla que solo vive en un comentario no falla el build.

#### `clientaId`: el gancho de Fase 3, y lo que hoy NO protege

`VerificarClientaPort` existe y `AgendarCitaUseCase` **ya lo llama en producción**, así que la costura está ejercitada: al construir Fase 3 solo se sustituye el proveedor en `IntegracionModule`, sin tocar los casos de uso.

> ⚠️ **`CrmNoConstruidoVerificarClientaAdapter` acepta cualquier uuid no vacío. Se sigue pudiendo agendar para una clienta inexistente.** Está dicho en el nombre de la clase, en el encabezado del puerto y con un `Logger.warn` en el primer arranque. El precedente es `SinAgendaVerificarCitasFuturasAdapter`, que respondía siempre `false` y durante un tiempo **pareció** proteger la baja de manicuristas. La lección no fue "no usar adaptadores provisionales" sino que tienen que ser imposibles de confundir con el definitivo.

Cuando exista CRM, este puerto es también el punto natural de la **lista roja** (`RN-CRM-06`, `DEC-042`): una clienta en lista roja no deja de existir, pero su reserva exige anticipo. Por eso el método se llama `existe` y no `puedeAgendar` — esa distinción es de Fase 3.

#### Tensión de negocio que esta entrega introduce, sin resolver

**Un servicio dado de baja deja sus citas existentes sin poder moverse.** La orden pedía validar `activo` en reprogramar y así se implementó, pero la consecuencia es que una cita ya vendida de un servicio que el salón descontinuó **solo se puede cancelar, no reagendar**. Puede ser lo correcto (si ya no se ofrece, no se reagenda) o puede dejar tirada a una clienta que pagó. **Es una pregunta para la Dueña**, no una decisión técnica. Si la respuesta es "déjame moverla", el cambio es una línea: validar `activo` solo al agendar.

#### Pruebas: **+42** (741 → **783**, 59 suites)

- 14 unitarias de `ResolutorDeServicio` (404/409/derivación/snapshot/`DEC-033`).
- 16 E2E HTTP nuevas en `citas.e2e.spec.ts`: servicio inexistente, servicio de baja, derivación del fin, duración que no coincide, snapshot congelado, `400` al enviar `cotizacionSnapshot`, cotización manual, reprogramar sin recotizar, y la tanda de acotación/paginación.
- 6 de integración en `registrar-excepcion-personal.use-case.spec.ts`: déficit por franja, excepción demasiado larga, destino cerrado en domingo y en el corte, cobertura que cruza el corte (aceptada) y ausencia en domingo (aceptada).
- 4 de `principal-de-sistema.spec.ts`.
- Los E2E ahora siembran un **`Servicio` real** del catálogo: `servicioId` ya no puede ser un uuid cualquiera, y eso es precisamente lo que se arregló.

#### Validación

`tsc --noEmit` 0 · `tsc -p tsconfig.eslint.json` 0 · `lint` 0 errores 0 avisos · `build` OK · `drizzle-kit check` OK · `madge --circular` 0 ciclos · **783/783 pruebas** en 59 suites.

---

### Lista de Espera — diseño para el siguiente turno (único punto restante de Fase 2)

Las reglas de la orden (`DEC-039`, reglas 2.2/2.3) están claras. Lo que hay que decidir antes de escribir código son **dos dependencias de infraestructura que el proyecto no tiene todavía**, y por eso esto no se improvisó.

#### 🔴 Dependencia 1 — hace falta un planificador (no existe ninguno)

La mecánica FIFO escalonada exige **que algo pase cuando no pasa nada**: se avisa a una clienta, y si no contesta en una hora hay que pasar a la siguiente. Si la expiración se evaluara solo de forma perezosa (al abrirse otro hueco o al consultar), una oferta caducada **se quedaría caducada para siempre** y la fila no avanzaría hasta que alguien cancelara otra cita por casualidad.

Blanc **no tiene hoy** ni cron, ni worker, ni scheduler. `02-architecture-principles.md` prevé *event-driven en proceso + outbox*, que es la base natural, pero el disparador temporal no está construido. **Lista de Espera es la primera funcionalidad que lo necesita**, así que ese es el verdadero primer paso: decidir el mecanismo (`@nestjs/schedule` en proceso frente a un worker aparte en Railway) y si el outbox entra ya. Es una decisión de arquitectura con ADR propia, no un detalle.

#### 🔴 Dependencia 2 — no se puede avisar a nadie hasta Fase 4

El aviso viaja por WhatsApp, y el canal es de Fase 4 (`DEC-043`, Cloud API, pendiente del trámite con Meta). Hasta entonces la lógica de dominio se puede construir y probar **completa**, pero el mensaje no sale: la oferta quedaría registrada y la Encargada tendría que avisar a mano.

**Consecuencia para planificar:** Lista de Espera se puede entregar en dos tramos — dominio + persistencia + FIFO ahora, emisión real en Fase 4 — pero **no se puede dar por terminada** antes de Fase 4. Conviene decidir si se construye ahora con aviso manual o se agrupa con el canal.

#### Modelo propuesto

Pertenece al Bounded Context **Agenda**: habla de huecos y de citas, y necesita leer la agenda en cada liberación.

`agenda.solicitudes_lista_espera`:

| Columna | Notas |
|---|---|
| `id` | uuid, PK |
| `sucursal_id` | uuid sin FK (`ADR-005`) |
| `clienta_id` | uuid sin FK |
| `servicio_id` | uuid sin FK — la duración se resuelve por `ContextoCatalogoPort`, **no se copia** |
| `fecha` | `date`. **Fecha de pared en `America/Mexico_City`**, no un instante: la clienta quiere "el jueves", no un rango UTC |
| `estado` | `text` + `CHECK`, igual que `citas` (ver abajo) |
| `creado_en` | `timestamptz` — **es la posición en la fila**; no hace falta columna `posicion` |
| `ofrecida_en`, `oferta_expira_en` | `timestamptz` nullable, solo mientras el estado es `ofrecida` |

Estados: `en_espera` → `ofrecida` → `aceptada` \| `rechazada` \| `oferta_expirada` (vuelve a `en_espera` o pasa a `descartada`), más `cancelada` y `caducada` (pasó la fecha). Mismo patrón que `Cita`: `text` + `CHECK`, máquina de transiciones explícita en la entidad, y **el detector de deriva se extiende a esta tabla**.

#### Reglas, con las trampas que esconden

1. **El servicio tiene que caber en el hueco.** Se compara la duración del catálogo contra la del hueco liberado. *Trampa:* el hueco liberado **no es** el rango de la cita cancelada. Si se cancela una cita de 10:00–11:00 y la de 11:00–12:00 sigue en pie, un servicio de dos horas no cabe aunque "se liberó una hora a las 10". El hueco real hay que calcularlo contra la agenda, y `MotorDisponibilidad` ya sabe hacerlo — **conviene reutilizarlo, no recalcular**.
2. **Cancelación a ≤30 minutos del inicio: hueco perdido, solo bandera.** `MINUTOS_MINIMOS_PARA_AVISO = 30`. *Ojo:* ya existe `MINUTOS_DE_INCIDENTE_TARDIO = 60` en `CancelarCitaUseCase`, y **son dos umbrales distintos de cosas distintas** — 60 es "esto sugiere lista roja" (`RN-CRM-06`), 30 es "este hueco ya no se puede aprovechar". Deben seguir separados; unificarlos por parecer redundantes sería un error.
3. **Una sola clienta a la vez, FIFO, ventana configurable (1 h por defecto).** La ventana es **configuración de cliente**, no una constante: por el modelo de 4 capas va en *Client Specification*, no en *Core Platform*.
4. **Reprogramar también libera un hueco**, no solo cancelar. Es fácil de olvidar porque la regla habla de cancelaciones: en `ReprogramarCitaUseCase` la cita original pasa a `reprogramada` y **libera su horario**. Ese hueco es igual de ofrecible.

#### Pregunta de negocio abierta, para la Dueña

**¿Qué pasa si la clienta avisada acepta y, mientras contestaba, otra persona ya tomó el hueco?** `RN-ANT-03` resolvió la carrera equivalente en anticipos con "el primero en pagar se queda con el cupo" y sin retención real. Aplicar el mismo criterio sería coherente —la oferta no congela el hueco— pero significa que una clienta puede recibir un aviso y encontrarse con que ya no hay lugar. La alternativa (retener el hueco durante la ventana) **resta capacidad vendible una hora por cada aviso**. No es una decisión técnica.

---

### 2026-10-14 (d) — Fase 2 (parte 5): API HTTP de Agenda, excepciones operables y RBAC de iPad. **Bloqueos 2 y 6 CERRADOS**

Con esta entrega **todo lo construido en Fase 2 es alcanzable desde fuera del backend** y `DEC-036` pasa de "construido" a **operable**: ya se puede capturar una ausencia.

#### 🐛 El defecto de fondo: el aviso de sobrecupo no se emitía nunca

`ConsultaAgendaAdapter` debía devolver **dos** clases de cita afectada al registrar una ausencia. La segunda —`sobrecupo_en_sucursal`— estaba escrita pero era **código muerto**: su guardia era `capacidad >= 0`, y `calcularCapacidad` recorta con `Math.max(0, …)`, así que la condición era **siempre verdadera** y el bucle nunca entraba.

**Por qué importaba.** Esa clase es la única que detecta el caso en el que *ninguna cita lleva el nombre de la manicurista ausente*: 2 citas sin asignar, 2 manicuristas, falta una → a las 10:00 hay dos clientas y una sola persona. Una detección ingenua reporta "cero afectadas" y la Encargada se enteraría al llegar la segunda clienta.

**Causa raíz, y es un patrón a vigilar:** `capacidad` se recorta a `0` porque responde *"¿cabe otra?"*, y ahí no hay diferencia entre "justo lleno" y "pasado de rosca". Pero esa diferencia **es toda la pregunta** al registrar una ausencia. El clamp destruía la información justo antes de usarla.

**Arreglo:** `CapacidadEfectiva` expone ahora `deficitDePersonal` — cuántas citas ya vendidas se quedarían sin manos, **sin recortar**. El adaptador usa ese campo y la rama convolucionada (`cupoDisponible`) desapareció.

#### Archivos creados

| Archivo | Qué es |
|---|---|
| `agenda/application/use-cases/consultar-agenda.use-case.ts` | Lectura de agenda **con el filtro de iPad dentro del caso de uso** |
| `agenda/application/use-cases/gestionar-sillas.use-case.ts` | Alta/baja/listado de sillas — auditado como cambio de configuración |
| `agenda/infrastructure/http/citas.controller.ts` | `/v1/agenda/citas` — ciclo de vida completo |
| `agenda/infrastructure/http/sillas.controller.ts` | `/v1/agenda/sillas` y `/v1/agenda/disponibilidad` |
| `agenda/infrastructure/http/cita.presenter.ts` | DTO **dependiente del rol** |
| `agenda/infrastructure/http/dto/agendar-cita.dto.ts` | 6 DTOs con validación estricta |
| `agenda/infrastructure/http/citas.e2e.spec.ts` | **24 pruebas E2E HTTP** |
| `sucursales-y-personal/application/use-cases/registrar-excepcion-personal.use-case.ts` | `registrarAusencia` / `registrarCobertura` / `revocar` |
| `sucursales-y-personal/application/use-cases/registrar-excepcion-personal.use-case.spec.ts` | **11 pruebas de integración** con adaptadores reales |
| `sucursales-y-personal/domain/ports/consulta-agenda.port.ts` | Lo que Personal pregunta a Agenda |
| `sucursales-y-personal/infrastructure/http/excepciones-personal.controller.ts` | `/v1/sucursales-y-personal/excepciones` |
| `sucursales-y-personal/infrastructure/http/excepciones-personal.e2e.spec.ts` | **17 pruebas E2E HTTP** |
| `integracion/consulta-agenda.adapter.ts` | Implementa el puerto viendo los dos BC |
| `database/schema/deriva-restricciones-agenda.spec.ts` | **Detector de deriva (cierra el bloqueo 2)** |
| `database/migrations/0009_vinculo_usuario_manicurista_y_snapshot.sql` | `usuarios.manicurista_id` + `citas.cotizacion_snapshot` |
| `app.module.spec.ts` | **Prueba de humo del contenedor completo** |

#### `P9` resuelto por necesidad

La orden pedía que una `Manicurista` viera *"únicamente sus propias citas"*. **No existía ningún vínculo `usuarios ↔ manicuristas`**, así que esa regla no era implementable de forma segura: el único id disponible venía de la petición, y aceptarlo dejaría leer la agenda ajena cambiando un uuid.

`manicurista_id` se añadió a `usuarios` (migración `0009`) y viaja por `PermisosUsuario` → `AuthorizationGuard` → `ClaimsUsuario`. **El filtro vive en `ConsultarAgendaUseCase`, no en el controlador**, para que viaje con la agenda a cualquier adaptador futuro (el bot, un job). Una usuaria con rol `MANICURISTA` y sin vínculo **no ve nada** — el lado seguro del error.

#### API HTTP y RBAC

| Método y ruta | Roles |
|---|---|
| `GET /v1/agenda/citas` | Super Admin, Administrador, Gerente, **Manicurista (solo las suyas)** |
| `POST /v1/agenda/citas` | Super Admin, Administrador, Gerente |
| `POST /v1/agenda/citas/:id/{manicurista,solicitar-confirmacion,confirmar,cancelar,no-show,completar}` | Super Admin, Administrador, Gerente |
| `POST /v1/agenda/citas/:id/reprogramar` | Super Admin, Administrador, Gerente |
| `GET /v1/agenda/sillas` | Super Admin, Administrador, Gerente |
| `POST /v1/agenda/sillas`, `POST /v1/agenda/sillas/:id/desactivar` | Super Admin, Administrador |
| `GET /v1/agenda/disponibilidad` | Super Admin, Administrador, Gerente |
| `POST /v1/sucursales-y-personal/excepciones/{ausencias,coberturas}`, `DELETE …/:id` | Super Admin, Administrador, **Gerente** |

Tres decisiones de RBAC que conviene conocer antes de cambiarlas:

- **Las sillas son configuración de capacidad, no operación diaria** — solo Administración. El número de filas *es* la capacidad vendible de la sucursal; la Encargada opera la agenda del día pero no redefine cuántas estaciones tiene el local.
- **Las excepciones sí las captura la `GERENTE`.** Es un registro *del día*: si solo pudiera capturarlo Administración, nadie lo anotaría a las 8 de la mañana cuando alguien avisa que no viene, y el motor seguiría vendiendo huecos imposibles.
- **El `@Roles` va por método, no por clase.** El precio es que **toda ruta nueva debe declarar el suyo**: sin decorador, `RolesGuard` la deja pasar a cualquier autenticado.

#### Códigos HTTP corregidos

Solo `POST /citas` y `POST /:id/reprogramar` devuelven `201`, porque son los únicos donde nace una cita. Las demás son transiciones de estado sobre algo que ya existe y devuelven `200`: un `201 Created` le diría al cliente que se creó un recurso nuevo en otra URL.

#### Pruebas: **+117** (624 → **741**, 57 suites)

Destacan las que prueban algo que podría romperse en silencio:

- **La Manicurista no ve `clientaId`** — es la llave con la que se consultaría el historial y la clasificación de la clienta, lista roja incluida. El `cita.presenter.ts` separa las dos formas **antes de que exista el BC de CRM**, porque el día que exista va a ser tentador adjuntar ese dato a la respuesta de la agenda.
- **El filtro no se toma de la query** — hay una prueba que pasa explícitamente el id de otra manicurista y espera `[]`.
- **403 al cancelar y al completar** (`DEC-040`: la manicurista no marca llegada ni finalización), al agendar, al reprogramar, al marcar no-show y al dar de alta una silla.
- **Desactivar una silla reduce la capacidad vendible**, no solo cambia una bandera: tras desactivar una de dos, la segunda cita simultánea recibe `409`.
- **La cobertura es un movimiento**: sacar a una manicurista deja 2 sillas libres y `capacidad 1`; la segunda cita se rechaza aunque la silla esté físicamente vacía.
- **Prueba de humo de `AppModule`** — `npm run build` compila tipos pero no resuelve el grafo de inyección. Sin esto, un cableado roto que solo `AppModule` monta pasaba el build y las 740 pruebas, y fallaba al arrancar en producción. Se detectó justo así: al registrar el caso de uso nuevo, `sucursales.e2e.spec.ts` dejó de resolver `CONSULTA_AGENDA_PORT`.

#### Bloqueos de Fase 2 — estado final

| # | Estado |
|---|---|
| **1** Faltaban estados de `Cita` | **RESUELTO** (parte 2) |
| **2** `EXCLUDE`/`CHECK` fuera del snapshot de Drizzle | **CERRADO** — ver abajo |
| **3** Entidades anémicas | **RESUELTO** (parte 3, `P3`) |
| **4** `MotorDisponibilidad` no existía | **RESUELTO** (parte 4) |
| **5** `VerificarCitasFuturasPort` sin implementar | **RESUELTO** (parte 2) |
| **6** Sin `cotizacion_snapshot` | **CERRADO en su parte estructural** — ver abajo |
| **7** Ninguna migración aplicada a base real | **NO ES DEUDA DE FASE 2** — ver abajo |

**Bloqueo 2 — cerrado con un detector de deriva, no con un comentario.** `deriva-restricciones-agenda.spec.ts` consulta `pg_constraint` en la base migrada y compara los literales del `CHECK` y de los dos `WHERE` de las `EXCLUDE` contra `ESTADOS_CITA` y `ESTADOS_QUE_LIBERAN_HORARIO`. Antes, la regla "edita cuatro sitios" la sostenía solo un comentario, y un comentario no falla el build. Lo que atrapa:

- *Olvidar el `CHECK`*: PostgreSQL rechaza el insert — molesto pero ruidoso.
- *Olvidar un `WHERE`*: **silencioso y grave**. Si el estado nuevo debía liberar y la `EXCLUDE` no lo sabe, el hueco queda ocupado por una cita muerta. Si debía ocupar y no lo cuenta, **se puede sobrevender la misma silla y la invariante física deja de ser invariante**.

Incluye dos guardias que una comparación de listas no daría: que el predicado **siga siendo una negación** (con `= ANY` la misma lista significaría lo contrario) y que `en_espera_pago` siga liberando (`RN-ANT-03` por encima de `DEC-034`). **El detector se verificó introduciendo deriva deliberada**: falla.

**Bloqueo 6 — la columna y la tubería están; producir el valor es de `FL-COT-03`.** `cotizacion_snapshot` existe (migración `0009`), la entidad la transporta, el repositorio la persiste y el presenter la expone — la Manicurista **sí ve precios**, confirmado por la Dueña.

> **Lo que deliberadamente NO se hizo: `cotizacionSnapshot` no se aceptó como campo del DTO HTTP.** Si el cliente pudiera enviar el snapshot, estaría fijando precios desde fuera del backend. Es el mismo error de clase que la arquitectura ya prohíbe para OpenAI: *el backend y el dominio son la única autoridad sobre reglas de negocio*. El snapshot tiene que **calcularlo el motor de cotización** (`FL-COT-03`) a partir del catálogo. Hasta entonces la columna queda en `null`, que es honesto; aceptarla por HTTP sería una puerta difícil de cerrar después.

**Bloqueo 7 — no es deuda de Fase 2.** Aplicar migraciones a una base real es una actividad de despliegue (Fase 7) y está fuera de alcance por restricción explícita y repetida de todas las órdenes. Las 10 migraciones se ejecutan íntegras contra PostgreSQL real (Testcontainers) en cada corrida, así que **están verificadas; lo que no existe todavía es el entorno al que aplicarlas**. Se reclasifica como tarea de Fase 7, no como bloqueo abierto.

#### Validación

`tsc --noEmit` 0 · `tsc -p tsconfig.eslint.json` 0 · `lint` 0 errores 0 avisos · `build` OK · `drizzle-kit check` OK · `madge --circular` 0 ciclos · **741/741 pruebas** en 57 suites.

#### 🔴 Deuda nueva y riesgos para el siguiente turno

1. **`servicioId` y `clientaId` no se validan contra nada.** Llegan como uuid y el DTO solo comprueba el formato: `ADR-005` prohíbe la FK cruzada, y los puertos hacia Catálogo y CRM no existen. **Hoy se puede agendar una cita de un servicio inexistente para una clienta inexistente.** Es el hueco más grande que queda en la API de Agenda.
2. **La duración de la cita no se valida contra el servicio.** El cliente manda `inicio` y `fin` libres; nada obliga a que correspondan a la duración del catálogo (`FL-COT-02`, pospuesto).
3. **El aviso de sobrecupo reporta TODAS las citas sin asignar de la sucursal**, no solo las `deficitDePersonal` que se quedarán sin atender. Es deliberado —el déficit dice *cuántas*, no *cuáles*, porque ninguna tiene dueña— pero en una sucursal muy cargada la lista será ruidosa. Si molesta, la decisión correcta es ordenarlas, no recortarlas al azar.
4. **El rango de una excepción no se valida contra el horario de la sucursal** (deuda heredada de la parte 4, sigue abierta).
5. **`GET /v1/agenda/citas` no pagina ni acota el rango.** Un rango de un año devolvería todas las citas de la sucursal en un solo JSON.
6. **El `GET` de disponibilidad no está abierto al bot todavía.** Cuando exista el canal de WhatsApp necesitará un principal propio; hoy solo lo alcanzan roles humanos.

---

### 2026-10-14 (c) — Fase 2 (parte 4): horarios, ausencias y `MotorDisponibilidad`. **Bloqueo 4 CERRADO**

#### 🔴 El problema estructural que había que resolver primero

Agenda y Sucursales y Personal se necesitan **en los dos sentidos**: Personal pregunta por citas futuras (`DEC-032`), Agenda pregunta por personal operativo (`DEC-035`/`DEC-036`). Si cada módulo importara al otro habría un **ciclo de módulos** — que `madge` marcaría y que NestJS solo resolvería con `forwardRef`, una solución que no quita el ciclo, lo esconde.

**Solución: `IntegracionModule`** (`@Global`, mismo mecanismo que `DatabaseModule`). **Ninguno de los dos BC importa al otro**: cada uno declara el puerto que necesita y la integración provee ambos adaptadores. `AgendaVerificarCitasFuturasAdapter` se movió ahí desde Sucursales.

> **Regla para quien añada una dependencia cruzada nueva:** el puerto se define en el módulo que **consume**; el adaptador vive en `IntegracionModule`. Nunca un `import` directo entre dos Bounded Contexts.

#### Archivos creados

| Archivo | Qué es |
|---|---|
| `src/database/schema/tipos-rango.ts` | `tstzrange` extraído, ahora lo comparten Agenda y Personal |
| `src/database/migrations/0008_excepciones_personal.sql` | Tabla + `CHECK` que liga `tipo` con `sucursal_id` |
| `…/sucursales-y-personal/domain/entities/excepcion-personal.entity.ts` | Ausencias y coberturas |
| `…/domain/ports/excepcion-personal.repository.ts` + adaptador Drizzle | Persistencia |
| `…/agenda/domain/ports/contexto-personal.port.ts` | Lo que Agenda pregunta a Personal |
| `…/agenda/domain/services/motor-disponibilidad.ts` | **`MIN(sillas, manicuristas)` + `RN-AGE-10`/`RN-AGE-12`** |
| `…/agenda/application/use-cases/consultar-disponibilidad.use-case.ts` | Lectura para el futuro bot |
| `…/agenda/test-utils/contexto-personal-falso.ts` | Dobles + horario real de Blanc |
| `src/modules/integracion/` | `IntegracionModule`, `ContextoPersonalAdapter` y el adaptador movido |

#### Archivos modificados

- `cita.entity.ts` — **`completada → no_show`** (`N-02`); `completada` deja de ser terminal.
- `agenda.schema.ts` / `sucursales-personal.schema.ts` — tipo compartido; tabla de excepciones.
- `agendar-cita.use-case.ts`, `reprogramar-cita.use-case.ts` — invocan el motor.
- `sucursales-y-personal.module.ts` — pierde `imports: [AgendaModule]`, gana el repositorio de excepciones y `exports`.
- `app.module.ts` — `IntegracionModule`.
- Tres specs ajustados; `sucursales.e2e.spec.ts` ahora provee el puerto en su `TestInfraModule`.

#### Pruebas: **30 nuevas** (648 → **678**, 52 suites)

- **16 de `MotorDisponibilidad`**, con horas **locales** de Querétaro. Incluye el escenario clave que pedía la orden: **3 sillas, 3 manicuristas, 1 ausente → entran 2 citas y la 3ª se rechaza aunque la silla 3 esté físicamente vacía**.
- **`RN-AGE-10`**: rechaza una cita de 11:00 a 13:00 por cruzar el corte de las 12:00 — el ejemplo literal de la Dueña.
- **`RN-AGE-12`**: rechaza el domingo. Y **no por una regla en código**: por un día con cero bloques en la configuración. Si mañana abren en domingo, se configura.
- **12 del `ContextoPersonalAdapter`**: una cobertura **resta en la base y suma en el destino**; una ausencia gana sobre una cobertura; una salida anticipada cuenta por la mañana y no por la tarde; y el `CHECK` rechaza coberturas sin destino.
- **2 de `N-02`**: `completada → no_show` corrige, y `no_show → completada` **no** es legal.

#### ⚠️ Decisión de diseño que conviene conocer

**Una cita sin manicurista asignada también descuenta una persona.** No descuenta a nadie en concreto, pero alguien tendrá que atenderla cuando la clienta llegue. Ignorarlo haría que el motor ofreciera más huecos de los que hay manos — exactamente lo que `DEC-035` existe para evitar.

**Zona horaria explícita.** El horario de sucursal es **hora de pared**; `tstzrange` guarda **instantes**. Sin fijar `America/Mexico_City` el error no aparecería en pruebas: aparecería en producción, desplazado las horas que separan al servidor de Querétaro.

#### ✅ Bloqueos resueltos

| # | Estado |
|---|---|
| **4** `MotorDisponibilidad` no existía | **RESUELTO** — `DEC-035` y `DEC-036` implementados |
| `N-02` | **CERRADO** — corrección `completada → no_show`, sin ventana de gracia |

#### ⏳ Bloqueos abiertos para el siguiente turno

| # | Sigue pendiente |
|---|---|
| **2** | Las `EXCLUDE` y los `CHECK` **no están en el snapshot de Drizzle** — ya son tres migraciones con SQL a mano |
| **6** | Sin `cotizacion_snapshot` |
| **7** | Ninguna migración aplicada a base real |

#### Deuda nueva

- **No hay casos de uso para registrar ausencias/coberturas.** El repositorio y la entidad existen y están probados, pero **nadie puede capturarlas todavía**: falta `RegistrarAusenciaUseCase` / `RegistrarCoberturaUseCase` con su auditoría. Sin eso, `DEC-036` está construido pero no es operable.
- **Sin controladores HTTP en Agenda.** Nada de Fase 2 es alcanzable desde fuera del backend.
- **El horario base no se valida contra el de la sucursal**: una cobertura puede registrarse en un rango en que la sucursal destino está cerrada. Hoy el motor lo frena al agendar, pero el dato quedaría raro.

---

### 2026-10-14 (b) — Fase 2 (parte 3): máquina de estados y ciclo de vida. **`P3` CERRADO**

#### 🔴 Hallazgo de fondo: `DEC-034` contradecía a `RN-ANT-03`

`DEC-034` listaba `en_espera_pago` entre los estados que **ocupan** horario (*"mientras el anticipo no expire, el espacio es suyo"*). `RN-ANT-03`, que está **`Aprobada`**, dice exactamente lo contrario:

> *"no existe una retención temporal real del horario. Mientras el anticipo esté pendiente, el horario permanece disponible para cualquier otra clienta — el primero en pagar se queda con el cupo, protegido por el invariante de exclusión ya existente."*

**Ganó la regla de negocio.** `DEC-034` era una propuesta mía al redactar la lista y contradijo una decisión del negocio. La migración `0007` reescribe **ambos** predicados `EXCLUDE` para que `en_espera_pago` libere.

Lo interesante: `RN-ANT-03` ya describía el mecanismo que esto habilita. La carrera entre dos clientas de lista roja **no se resuelve reteniendo el hueco**, sino al confirmar el pago — ahí la cita pasa a ocupar y la restricción decide. Con `en_espera_pago` ocupando, esa carrera **no podía ni existir**. Hay dos pruebas que la recorren de principio a fin.

#### Archivos creados

| Archivo | Qué es |
|---|---|
| `src/database/migrations/0007_maquina_estados_cita.sql` | Columnas de reprogramación + FK a sí misma + **corrección de ambos predicados `EXCLUDE`** |
| `…/use-cases/transicion-cita.base.ts` | Mecánica compartida (buscar, mover, persistir, auditar) |
| `…/use-cases/solicitar-confirmacion-cita.use-case.ts` | `agendada → pendiente_confirmacion` |
| `…/use-cases/confirmar-cita.use-case.ts` | `→ confirmada`. **Aquí se resuelve la carrera de `RN-ANT-03`** |
| `…/use-cases/cancelar-cita.use-case.ts` | `→ cancelada` + indicador de incidente tardío (`RN-CRM-06`) |
| `…/use-cases/reprogramar-cita.use-case.ts` | Original `reprogramada` + cita nueva enlazada, en una transacción |
| `…/use-cases/marcar-no-show.use-case.ts` | `→ no_show` (manual) |
| `…/use-cases/completar-cita.use-case.ts` | `→ completada` (`DEC-030`) |
| `…/use-cases/ciclo-de-vida-cita.spec.ts` | 24 pruebas de integración |

#### Archivos modificados

- `src/database/schema/agenda.schema.ts` — `en_espera_pago` movido a los que liberan; columnas `citaOrigenId` y `numeroDeReprogramaciones`.
- `…/domain/entities/cita.entity.ts` — **`TRANSICIONES_LEGALES`, `ESTADOS_INICIALES`, `esTerminal`**; `cambiarEstado` valida la transición.
- `…/infrastructure/persistence/drizzle-cita.repository.ts` — persiste las columnas nuevas.
- `…/agenda.module.ts` — los 6 casos de uso.
- Tres specs ajustados a la nueva realidad (ver abajo).

#### Pruebas: **133 nuevas** (514 → **647**, 50 suites)

- **Matriz completa de transiciones: 81 pruebas** (9 estados × 9 destinos). Cada par se verifica contra la tabla, y en los ilegales se comprueba además que **el estado no se movió a medias**.
- **24 de integración del ciclo de vida**, incluidas las que la orden pedía explícitamente: **`cancelada` y `reprogramada` liberan la silla** para una reserva nueva en el mismo horario, demostrado con **una sola silla** para que no pueda pasar por casualidad.
- **2 sobre la carrera de `RN-ANT-03`**: dos citas en `en_espera_pago` conviven sobre el mismo hueco, y la segunda recibe `SILLA_OCUPADA` al confirmar el pago.
- **`no_show` OCUPA**, verificado a nivel SQL y de caso de uso: es la diferencia con cancelar — cancelar avisa y libera; no presentarse no libera nada porque nadie pudo aprovechar el hueco.

#### 🐛 Dos defectos cazados por TDD

1. **`ReprogramarCitaUseCase` chocaba consigo mismo.** La cita original aún ocupa su silla cuando se elige candidata, así que reprogramar al mismo horario —para cambiar de manicurista— fallaba, y en una sucursal de **una sola silla** era imposible reprogramar nada. Corregido excluyendo la cita original del cálculo.
2. **Un bug en mi propia prueba:** `2027-03-0${8+i}` generaba `2027-03-010`. Corregido con aritmética de fechas.

#### ✅ Bloqueos resueltos

| # | Estado |
|---|---|
| **3** Entidades sin transiciones legales | **RESUELTO** — `P3` cerrado |

#### ⏳ Bloqueos que siguen abiertos

| # | Sigue pendiente |
|---|---|
| **2** | Las `EXCLUDE` y el `CHECK` **no están en el snapshot de Drizzle**. `0007` lo volvió a confirmar: hubo que reescribir ambos predicados a mano |
| **4** | **`MotorDisponibilidad` no existe** — falta el submódulo de Horarios y Ausencias (`DEC-036`). **Es el siguiente turno** |
| **6** | Sin `cotizacion_snapshot` |
| **7** | Ninguna migración aplicada a base real |

#### Deuda nueva de este turno

- **`N-02` ahora tiene consecuencia concreta.** `completada` es terminal y `no_show` es manual: si el job marca `completada` y la Encargada descubre el no-show al día siguiente, **ya no puede corregir**. Hasta decidir entre ventana de gracia o permitir la sobrescritura, **el job de `CompletarCitaUseCase` no debería ejecutarse de forma agresiva**. Está anotado en el propio caso de uso.
- **`RN-ANT-04` (48h) se valida con un parámetro de entrada**, no consultando el estado del anticipo: el Bounded Context de Anticipos es Fase 3. Cuando exista, debe pasar por un puerto y ese parámetro desaparecer.
- **`AgendarCitaUseCase` sigue sin validar** horario de sucursal, corte de mediodía (`RN-AGE-10`) ni duración según catálogo.
- **`agendada → confirmada` no es legal** por diseño. Si el negocio confirma sin recordatorio previo, hay que añadir esa transición conscientemente.

---

### 2026-10-14 — Fase 2 (parte 2): estados alineados, puerto real y primeros casos de uso

**Alcance:** cerrar la deuda inmediata antes de exponer endpoints. Sin controladores HTTP, por restricción de la orden.

#### Archivos creados

| Archivo | Qué es |
|---|---|
| `src/database/migrations/0006_alinear_estados_cita.sql` | `CHECK` de estado ampliado de 6 a 9 valores |
| `src/modules/sucursales-y-personal/infrastructure/agenda/agenda-verificar-citas-futuras.adapter.ts` | **Implementación real** de `VerificarCitasFuturasPort` |
| `…/agenda-verificar-citas-futuras.adapter.spec.ts` | 13 pruebas de integración del camino completo |
| `src/modules/agenda/application/use-cases/agendar-cita.use-case.ts` | Reserva sobre Silla Virtual |
| `src/modules/agenda/application/use-cases/asignar-manicurista-en-sucursal.use-case.ts` | Asignación en mostrador |
| `…/agendar-cita.use-case.spec.ts` | 18 pruebas de integración de ambos casos de uso |

#### Archivos eliminados

- `…/infrastructure/agenda/sin-agenda-verificar-citas-futuras.adapter.ts` **y su spec**. El sustituto que respondía siempre `false` **ya no existe**; no se dejó de respaldo, como exigía su propia nota.

#### Archivos modificados

- `src/database/schema/agenda.schema.ts` — `ESTADOS_CITA` de 6 a 9.
- `src/database/migrations/restricciones-agenda.spec.ts` — +6 pruebas (24 en total).
- `src/modules/agenda/domain/entities/cita.entity.ts` — `validarRangoHorario` exportado (ver el defecto, abajo).
- `src/modules/agenda/agenda.module.ts` — los dos casos de uso.
- `src/modules/sucursales-y-personal/sucursales-y-personal.module.ts` — importa `AgendaModule`, proveedor real.
- `…/desactivar-manicurista.use-case.ts` y `…/verificar-citas-futuras.port.ts` — comentarios que afirmaban que la verificación "no protege nada": ya era falso.

#### Pruebas: **35 nuevas** (479 → **514**, 49 suites)

- **+6 sobre las restricciones SQL** (24 en ese archivo): que los tres estados nuevos pasan el `CHECK`; que **`no_show` OCUPA** —es la diferencia con `cancelada`: cancelar avisa y libera, no presentarse no libera nada porque nadie pudo aprovechar el hueco—; y una que inspecciona `pg_get_constraintdef` para comprobar que **ampliar la lista no tocó las restricciones**.
- **+13 del puerto real**, con una por cada uno de los nueve estados.
- **+18 de los casos de uso**, incluida la capacidad de la sucursal respetada extremo a extremo y que `MANICURISTA_OCUPADA` **no** se reintenta en otra silla.

#### 🐛 Defecto encontrado (lo cazó una prueba TDD)

`AgendarCitaUseCase` consultaba la base **antes** de validar el rango. Con un rango invertido, PostgreSQL rechazaba el `tstzrange` de la consulta con un error crudo (*"range lower bound must be less than or equal to range upper bound"*) en lugar del `CITA_RANGO_INVALIDO` que corresponde. Corregido exportando `validarRangoHorario` desde la entidad —una sola definición— y llamándolo al inicio del caso de uso.

#### ✅ Bloqueos del turno anterior resueltos

| # | Estado |
|---|---|
| **1** Faltaban `no_show`, `pendiente_confirmacion`, `confirmada` | **RESUELTO** — migración `0006` |
| **5** `tieneCitasFuturasQueOcupan` sin conectar; adaptador temporal sin proteger nada | **RESUELTO** — adaptador real, sustituto eliminado, `ACCEPTED_RISK` cerrado, `N-04` cerrado |

#### ⏳ Bloqueos que siguen abiertos

| # | Sigue pendiente |
|---|---|
| **2** | Las `EXCLUDE` y el `CHECK` **no están en el snapshot de Drizzle**. La ampliación de estados lo confirmó: hubo que editar **dos sitios** (el array de TS y el `CHECK` de `0006`). Nada lo obliga salvo las pruebas |
| **3** | Entidades aún sin **transiciones legales** entre estados (`P3` sigue abierto). `cambiarEstado` valida que el valor exista, no que la transición sea legal |
| **4** | **`MotorDisponibilidad` no existe.** `AgendarCitaUseCase` reparte sillas pero **no cruza contra personal en turno** (`DEC-035`): falta el submódulo de Horarios y Ausencias (`DEC-036`) |
| **6** | Sin `cotizacion_snapshot` |
| **7** | Ninguna migración aplicada a base real |

#### Deuda nueva de este turno

- **La semántica de `agendada` / `pendiente_confirmacion` / `confirmada` no está decidida.** Se documentó una lectura *propuesta* en `agenda.schema.ts`, pero las transiciones legales son `P3`. Hoy toda cita nace `agendada` y nada la mueve.
- **`AgendarCitaUseCase` no valida horario de sucursal, corte de mediodía (`RN-AGE-10`) ni duración según catálogo.** Lo primero necesita un puerto hacia Sucursales; lo último, `FL-COT-02`.
- **La carrera de `DEC-035` sigue viva, y ahora tiene mitigación parcial:** el caso de uso **recorre las sillas candidatas** y reintenta si la base rechaza una. No elimina la carrera —la autoridad sigue siendo la restricción `EXCLUDE`— pero evita fallar cuando sí quedaba lugar.

---

### 2026-10-09 — Kick-off Fase 2: capa de datos de Agenda

**Alcance cubierto:** esquema, migración y repositorios base del patrón de Sillas Virtuales. **Sin casos de uso ni controladores**, por restricción de la orden.

#### Archivos creados

| Archivo | Qué es |
|---|---|
| `src/database/schema/agenda.schema.ts` | Esquema `agenda`: `sillas`, `citas`, `customType` de `tstzrange`, `ESTADOS_CITA`, `ESTADOS_QUE_LIBERAN_HORARIO` |
| `src/database/migrations/0005_zippy_rawhide_kid.sql` | Tablas + `btree_gist` + `CHECK` de estado + **las dos `EXCLUDE USING gist`** |
| `src/database/migrations/restricciones-agenda.spec.ts` | **18 pruebas sobre el SQL**, no sobre código de Blanc |
| `src/modules/agenda/domain/entities/{silla,cita}.entity.ts` | Entidades (deliberadamente anémicas, ver más abajo) |
| `src/modules/agenda/domain/entities/cita.entity.spec.ts` | 15 pruebas unitarias |
| `src/modules/agenda/domain/ports/{silla,cita}.repository.ts` | Puertos |
| `src/modules/agenda/infrastructure/persistence/drizzle-{silla,cita}.repository.ts` | Adaptadores Drizzle |
| `src/modules/agenda/infrastructure/persistence/drizzle-cita.repository.spec.ts` | 12 pruebas de integración |
| `src/modules/agenda/agenda.module.ts` | Módulo (solo repositorios; exporta los puertos) |

#### Archivos modificados

- `src/database/schema/index.ts` — exporta el esquema de agenda.
- `drizzle.config.ts` — `agenda` añadido al `schemaFilter`.
- `src/app.module.ts` — `AgendaModule` cableado (para que el contenedor valide el arranque).
- `src/shared/errors/postgres-error.ts` — `esViolacionDeExclusion` (`23P01`) y `nombreDeRestriccion`.
- `src/database/test-utils/postgres-de-prueba.ts` — **ver el defecto encontrado, abajo**.

#### Pruebas implementadas: **45 nuevas** (434 → **479**, 48 suites)

- **18 sobre las restricciones SQL** — el corazón del entregable. Verifican contra PostgreSQL real que se rechaza el solapamiento en la misma silla; que se acepta en sillas distintas; que **las citas consecutivas no chocan** (el rango es `[inicio, fin)`, con fin exclusivo — con `]` el salón no podría encadenar citas); que con 3 sillas la cuarta cita simultánea se rechaza **sin ningún contador en la aplicación**; que la misma manicurista no puede estar en dos sillas a la vez; que **asignar manicurista por `UPDATE` también queda validado**; y que cada estado ocupa o libera según `DEC-034`.
- **12 de integración de repositorios** — incluido que el `23P01` crudo **nunca** sale: se traduce a `SILLA_OCUPADA` o `MANICURISTA_OCUPADA` según cuál restricción saltó.
- **15 unitarias de entidades**.

#### 🐛 Defecto encontrado y corregido (no estaba en la orden)

Las pruebas de exclusión fallaron de forma desconcertante: *"manicuristas distintas en el mismo horario"* se rechazaba, cuando no debía. La causa **no era la restricción** sino el helper de pruebas: `ESQUEMAS_DE_NEGOCIO` era una lista escrita a mano y **nadie añadió `agenda`**, así que sus tablas no se vaciaban entre pruebas y las filas se acumulaban dentro del mismo worker.

**Arreglado de raíz:** la lista de esquemas a vaciar ahora **se descubre consultando la base**, excluyendo solo `drizzle`, `public`, `information_schema` y los `pg_*`. Un esquema nuevo queda cubierto sin tocar ese archivo. Era un pie de fallo que habría mordido a quien añadiera el próximo Bounded Context.

#### ⚠️ Divergencias respecto a la orden — decididas a favor de lo ya aprobado

Tres puntos de la orden chocaban con arquitectura ya documentada. Resolví a favor de lo documentado; **si discrepas, los tres son de cambio barato ahora y caro después**.

| La orden decía | Implementado | Por qué |
|---|---|---|
| `rango_horario` **`tsrange`** | **`tstzrange`** | `DEC-031` lo fija así y todo el resto del esquema usa `timestamp with time zone`. Mezclar un rango sin zona obligaría a castear en cada comparación y abre la puerta a comparar una hora "de pared" con un instante absoluto |
| `estado` como **`enum`** | **`text` + `CHECK`** | Añadir un valor a un `enum` exige `ALTER TYPE … ADD VALUE`, que **no corre dentro de la transacción** en la que Drizzle envuelve cada migración. Y la lista de estados está demostrablemente incompleta (ver abajo), así que se van a añadir valores |
| `sucursal_id (FK)`, `servicio_id (FK Catálogo)` | **uuid sin FK** | `ADR-005` prohíbe claves foráneas entre esquemas. Solo `silla_id` lleva FK real, porque `sillas` vive en el mismo esquema `agenda` |

#### 🔴 Bloqueos y deuda para el siguiente turno

1. **Faltan 2–3 estados de `Cita`.** La orden fijó seis; `DEC-034` aprobó ocho. **Falta `no_show`**, que `RN-CRM-06` necesita para disparar la sugerencia de lista roja, y el par `pendiente_confirmacion`/`confirmada` que `RN-CONV-11` exige por ser la confirmación interactiva. Añadirlos es editar el `CHECK` y el array `ESTADOS_CITA` — trivial **gracias a** haber evitado el `enum`. **Decidir antes de escribir casos de uso.**
2. **Las restricciones `EXCLUDE` y el `CHECK` no están en el snapshot de Drizzle.** Drizzle no sabe expresarlos, así que están escritos a mano en `0005`. Consecuencia: `drizzle-kit generate` **no los conoce** y la migración es su única fuente de verdad. Quien cambie la lista de estados debe editar **dos sitios**: el array de TypeScript y el `CHECK` de la migración. No hay nada que lo obligue salvo esta nota y las pruebas.
3. **Las entidades son anémicas a propósito.** `Cita` no tiene transiciones de estado legales (`P3` sigue sin cerrar), ni valida horario de sucursal, ni corte de mediodía (`RN-AGE-10`), ni duración según catálogo. Existen para que los repositorios tengan algo que mapear.
4. **`MotorDisponibilidad` no existe.** `SillaRepository.contarActivasPorSucursal()` ya entrega la mitad izquierda de `MIN(sillas_libres, manicuristas_activas)` (`DEC-035`); la mitad derecha **no tiene fuente de datos** hasta que exista el submódulo de Horarios y Ausencias (`DEC-036`).
5. **`CitaRepository.tieneCitasFuturasQueOcupan()` ya está lista** para que *Sucursales y Personal* sustituya `SinAgendaVerificarCitasFuturasAdapter` (`DEC-032`), que hoy **responde siempre `false` y por tanto no protege nada**. Es un cambio pequeño y de alto valor: buen primer ticket. Antes hay que cerrar `N-04` (qué estados cuentan como "cita futura") — la respuesta probable es reutilizar `ESTADOS_QUE_LIBERAN_HORARIO`, que es justo lo que el repositorio ya hace.
6. **Sin `cotizacion_snapshot`.** La columna que congelará la cotización (`04-data-model.md` §5.2) no se creó: no estaba en el alcance y depende del motor de cotización (`FL-COT-03`).
7. **Ninguna migración aplicada a base real.** `0000`–`0005` solo se ejecutan contra el PostgreSQL efímero de las pruebas.
