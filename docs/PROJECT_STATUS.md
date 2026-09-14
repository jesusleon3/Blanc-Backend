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

## 13. `FL-COT-01` — Catálogo y Cotización (**flujo CERRADO**, 2026-09-14)

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
