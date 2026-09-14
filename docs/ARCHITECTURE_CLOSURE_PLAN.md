# Architecture Closure Plan — Blanc

> **Pregunta única que responde este documento:** ¿Qué falta exactamente para declarar la arquitectura oficialmente cerrada y autorizar el inicio de la implementación?
> **Método:** síntesis y cierre, no investigación nueva. Todo pendiente listado aquí ya estaba evidenciado en `IMPLEMENTATION_READINESS_REVIEW.md`, `IMPLEMENTATION_MASTER_PLAN.md`, o en la revisión adversarial más reciente del proyecto — ninguno se descubre en este documento. Donde se intentó refutar un pendiente y no se pudo, se dice explícitamente por qué no.
> **Fecha:** 2026-07-16.

---

## 0. Intento de cierre inmediato

Antes de listar pendientes, se intentó demostrar que el proyecto ya puede cerrarse hoy. No se pudo, por evidencia textual directa, no por precaución:

- ~~`03-technical-architecture.md` §3.3, §3.4, §3.9 y §3.16 siguen marcados `Decision Pending` en el propio documento — no es una interpretación, es el texto literal.~~ **Resuelto (2026-08-04):** §3.3 (BD, Supabase), §3.4 (ORM, Drizzle), §3.7 (Realtime, Supabase Realtime), §3.8 (Storage, Supabase Storage), §3.9 (Auth, Supabase Auth), §3.13 (Hosting, Railway) y §3.16 (síntesis) ya son decisiones firmes. Ver `P1`, ahora `Resuelto`. La validación en producción de Auth (rotación de refresh token) y de Railway (rolling/blue-green) queda explícitamente pendiente como tarea de verificación de Fase 1, no como parte de este cierre documental.
- `04-data-model.md` §9, riesgo 6, dice textualmente que la ausencia de las 3 máquinas de estado "es un bloqueante real para pasar de este modelo lógico a DDL ejecutable".
- ~~`docs/business-rules/99-open-questions.md#PA-19` sigue `Abierta`~~ **Resuelta (2026-08-03), transcrita en `99-open-questions.md` en el Paso 11 del roadmap de propagación** — evidencia en `RN-SEG-03` (`docs/business-rules/10-identidad-seguridad.md`, `Estado: Aprobada`) y `DISCOVERY_CHECKLIST.md` 1.26. Ver P2, `Resuelto`.
- `CLAUDE.md` señala explícitamente que ADR-008 es "un open deviation awaiting explicit client sign-off".
- La revisión adversarial más reciente encontró una dependencia circular real entre Agenda y Anticipos en `decision-flows-catalogo-diseno.md`, y un vacío real de invariante de capacidad para citas sin manicurista — ambos ya reducidos a correcciones puntuales, no a un rediseño.

Ningún otro intento de cierre sobrevive: todo lo demás (73 Business Rules, 36 Decision Flows, 22 ADRs con contenido completo, modelo de datos lógico completo, roadmap de fases) ya está cerrado y no se reabre.

---

## 1. Pendientes — uno por uno

### P1 — Cerrar la pregunta-paraguas "conjunto Supabase" + proveedor de BD + ORM + proveedor de autenticación — ~~Abierto~~ **Resuelto (2026-08-04)**

- **¿Por qué sigue abierto?** ~~`03-technical-architecture.md` §3.16 es explícito: estas cuatro decisiones están acopladas y no deben cerrarse por separado sin resolver primero la pregunta-paraguas. Ninguna se cerró.~~
  **→ Resuelto:** se adoptó el conjunto Supabase completo (BD + Auth + Storage + Realtime) como una sola decisión coherente, más Drizzle como ORM y Railway como hosting. Arquitectura completa: TypeScript, NestJS, Modular Monolith, PostgreSQL/Supabase, Drizzle ORM, Supabase Auth, Supabase Storage, Supabase Realtime, Railway, OpenAI como intérprete (structured output), backend/reglas de dominio como única autoridad de negocio.
- **¿Quién debe resolverlo?** ~~Desarrollo (elección técnica) + Cliente (presupuesto, si aplica a Supabase vs. alternativas).~~ Resuelto por decisión técnica — sin dependencia de presupuesto formalmente confirmado, aceptado como parte de este cierre.
- **Documento que cambia:** `03-technical-architecture.md` §3.3/§3.4/§3.7/§3.8/§3.9/§3.13/§3.16 — ya actualizado.
- **Criterio de cierre:** las decisiones acopladas pasan de `Decision Pending` a firme. **Cumplido**, con una salvedad explícita: la elección de proveedor (Supabase Auth, Railway) está cerrada, pero **su validación en producción no lo está** — ver Sección "Riesgos aceptados deliberadamente" y las notas ya agregadas en `03-technical-architecture.md` §3.9/§3.13.
- **¿Bloquea implementación?** ~~Sí.~~ No, ya no bloquea.
- **Fase que bloquea:** ~~Fase 1 completa~~ Ninguna — desbloqueado. Dos tareas de verificación (rotación de refresh token en Supabase Auth; despliegue rolling/blue-green en Railway) quedan como parte de la Definition of Done de Fase 1, no como bloqueo de su inicio.
- **¿Puede resolverse durante desarrollo?** N/A — ya resuelto documentalmente. Las dos validaciones en producción sí se resuelven durante Fase 1, por diseño.

### P2 — Resolver `PA-19` (alcance RBAC de Analista y Solo lectura) — ~~Abierto~~ **Resuelto (2026-08-04)**

- **¿Por qué sigue abierto?** ~~Pregunta de negocio nunca respondida por el cliente (`01-domain-discovery.md` Pregunta Abierta #11, heredada sin cambios).~~
  **→ Resuelto (`DISCOVERY_CHECKLIST.md` 1.26, validación con la Dueña 2026-08-03):** el alcance de Analista y Solo lectura quedó confirmado. `RN-SEG-03` (`docs/business-rules/10-identidad-seguridad.md`) se actualizó de `Faltante` a `Estado: Aprobada` durante el Paso 3 del roadmap de propagación (`MASTER_PROPAGATION_PLAN.md`). El criterio de cierre de este pendiente queda satisfecho por evidencia directa, no por interpretación.
- **¿Quién debe resolverlo?** ~~Cliente.~~ Resuelto — sin acción pendiente.
- **Documento que cambia:** `docs/business-rules/10-identidad-seguridad.md` (`RN-SEG-03`) — actualizado en Paso 3. `99-open-questions.md` (`PA-19`) — actualizado en Paso 11 (2026-08-04) del roadmap de propagación (`MASTER_PROPAGATION_PLAN.md`).
- **Criterio de cierre:** `RN-SEG-03` pasa de `Faltante` a `Aprobada`. **Cumplido.**
- **¿Bloquea implementación?** ~~Sí, del modelo de permisos completo.~~ No, ya no bloquea.
- **Fase que bloquea:** ~~Fase 1 (Identidad y Accesos) y la sección de autenticación de `05-api-design.md`.~~ Ninguna — desbloqueado.
- **¿Puede resolverse durante desarrollo?** N/A — ya resuelto documentalmente. Nota: la implementación del modelo de claims sobre esta base (`ARCHITECTURE_REVIEW.md` F-12) sigue siendo trabajo de Fase 1, no de este documento.

### P3 — Diseño formal de las 3 máquinas de estado (`Cita`, `Conversación`, `TicketEscalamiento`)

- **¿Por qué sigue abierto?** Restricción de alcance explícita del cliente desde el Domain Discovery original, nunca levantada. La revisión adversarial más reciente ya precisó dos requisitos adicionales que este mismo entregable debe resolver (no son pendientes nuevos, son parte de este): el destino del valor de `estado` tras una reprogramación, y la gestión de `modo` al cerrar/reabrir una `Conversación`.
- **¿Quién debe resolverlo?** Arquitectura, con dos insumos de negocio: Domain Discovery Pregunta Abierta #15 (disparador de `completada`/`no_show`, sin `PA-NN` asignado todavía) y `PA-15` (disparador de cierre/reapertura de conversación).
- **Documento que cambia:** `01-domain-discovery.md` (adenda), `docs/business-rules/01-agenda.md` (crear `RN-AGE-14`), `04-data-model.md` §5.1/§5.3.
- **Criterio de cierre:** las tres máquinas tienen tabla de transiciones legales documentada, incluyendo qué estados de `Cita` cuentan como "ocupando" el horario para la restricción de exclusión.
- **¿Bloquea implementación?** Sí.
- **Fase que bloquea:** Fase 2 (Agenda) y Fase 4 (Conversación/Escalamiento).
- **¿Puede resolverse durante desarrollo?** No — `04-data-model.md` ya declara que sin esto la restricción de exclusión "no puede implementarse literalmente".
- **Avance documental, sin cierre (`DISCOVERY_CHECKLIST.md`, validación 2026-08-03):** tres insumos de negocio de los que depende este diseño avanzaron, pero ninguno completa por sí solo el criterio de cierre (tabla de transiciones legales de las tres máquinas):
  - 1.23 confirma que la confirmación de cita es **interactiva** (la clienta responde a un recordatorio) — implica un estado o mecanismo intermedio en `Cita` todavía no diseñado.
  - 1.6 confirma que el marcado de `no_show` es **manual** (staff, no automático); el disparador de `completada` sigue sin definición explícita.
  - 1.22 confirma que la identidad de `Conversación` es **persistente por clienta** (no por hilo); la gestión de `modo` en cierre/reapertura (`PA-15`) sigue sin resolver.
  Ninguno de estos tres puntos se traduce aquí en una tabla de transiciones ni en un nuevo estado formal — eso sigue siendo diseño de arquitectura pendiente de ejecución, no de insumo. P3 permanece `Abierto`.

### P4 — Invariante de capacidad para citas sin manicurista asignada

- **¿Por qué sigue abierto?** `DOMAIN_MODEL_REVIEW.md` (DM-11) identificó el vacío y lo revirtió explícitamente por falta de base textual para elegir entre 5+ modelos igualmente válidos — nunca se resolvió, solo se descartó una incorporación apresurada.
- **¿Quién debe resolverlo?** Cliente (decisión de negocio: ¿asignación automática, cola de espera, u otra política?) + Arquitectura (modelarla una vez decidida).
- **Documento que cambia:** `01-domain-discovery.md` §5.1, `decision-flows-catalogo-diseno.md` (`FL-AGE-10`).
- **Criterio de cierre:** existe una regla explícita (Rule ID) que cubre el caso "sin preferencia de manicurista" sin dejar un hueco de capacidad.
- **¿Bloquea implementación?** Sí — es el invariante Critical de mayor prioridad del sistema (`RN-AGE-01`) en un camino mainstream, no en un edge case.
- **Fase que bloquea:** Fase 2 (Agenda).
- **¿Puede resolverse durante desarrollo?** No.

### P5 — Corregir la dependencia circular Agenda↔Anticipos en el catálogo de Decision Flows

- **¿Por qué sigue abierto?** `FL-ANT-01` invoca `FL-AGE-09` directamente, contradiciendo tanto `01-domain-discovery.md` §4 ("Anticipos: Consumidor... de Agenda") como el diagrama unidireccional de `03-technical-architecture.md` §4.1.
- **¿Quién debe resolverlo?** Arquitectura.
- **Documento que cambia:** `decision-flows-catalogo-diseno.md` (una fila: `FL-ANT-01` pasa de invocar `FL-AGE-09` a publicar `AnticipoExpirado`, consumido por Agenda vía Outbox).
- **Criterio de cierre:** el catálogo no tiene ninguna invocación directa en sentido Anticipos→Agenda.
- **¿Bloquea implementación?** Sí, en su forma actual — pero es la corrección más barata de todo este documento.
- **Fase que bloquea:** Fase 2/3.
- **¿Puede resolverse durante desarrollo?** Sí, técnicamente podría corregirse al momento de codificar, pero no hay ninguna razón para no cerrarlo ahora — no depende de ningún insumo externo.

### P6 — Ratificar F-27 (patrón de ingesta de webhook) y F-14 (retención diferenciada de IA) como ADR/enmienda formal

- **¿Por qué sigue abierto?** Ambos tienen recomendación de alta confianza ya escrita en `03-technical-architecture.md` (§4.4, §6.4), pero `ARCHITECTURE_REVIEW.md` los clasificó Critical/High y pidió explícitamente que se ratifiquen como decisión formal, no que se asuman silenciosamente.
- **¿Quién debe resolverlo?** Arquitectura (redactar) + Cliente (aprobar, dado que F-14 es una enmienda conjunta a tres ADRs ya aceptados en la práctica).
- **Documento que cambia:** ADR nuevo (webhook) y enmienda conjunta a `ADR-007`/`ADR-017`/`ADR-022`.
- **Criterio de cierre:** ambos documentos existen con `Status: Accepted`.
- **¿Bloquea implementación?** Sí.
- **Fase que bloquea:** Fase 4 (Conversación) — no bloquea Fase 1/2/3.
- **¿Puede resolverse durante desarrollo?** No sin riesgo: `ARCHITECTURE_REVIEW.md` califica F-27 como "no negociable" antes de escribir código de integración con WhatsApp.

**Nota de trazabilidad (2026-08-04) — alcance de `P6` incompleto respecto a su propia fuente.** `03-technical-architecture.md` §11 ("ADRs candidatos identificados") lista **7** candidatos a ADR o enmienda, no 2. Además de F-27 y F-14 (ya cubiertos arriba), los otros cinco son: **F-03** (mecanismo de reclamo exclusivo de filas del Outbox, `FOR UPDATE SKIP LOCKED` — enmienda a `ADR-004`), **F-07** (mecanismo técnico de límite de gasto de IA — enmienda conjunta a `ADR-007`/`ADR-011`), **F-11** (canal de transporte y autenticación del panel de handoff humano — ADR nuevo), **F-13** (segregación de secretos de WhatsApp por sucursal — aclaración a `ADR-010`), y **F-17** (pruebas de fallo inyectado sobre Outbox y cola de jobs — anexo a `ADR-019`). Ninguno de estos cinco está rastreado en ningún `P` de este documento. Se deja constancia del vacío de cobertura — **no se crea ningún ADR aquí, no se ratifica ninguno, no se decide si `P6` debe ampliarse para cubrirlos o si merecen su(s) propio(s) punto(s) nuevo(s)** — esa es una decisión de gobernanza pendiente de autorización explícita, igual que la formalización de los Hallazgos A/B/C ya registrada más abajo en este documento.

### P7 — Sign-off formal de ADR-008 (WhatsApp oficial vs. Evolution API)

- **¿Por qué sigue abierto?** Es una desviación explícita del stack de referencia del cliente, señalada como tal desde `CLAUDE.md` y nunca confirmada formalmente.
- **¿Quién debe resolverlo?** Cliente.
- **Documento que cambia:** `docs/architecture/adr/ADR-008-*.md` (`Status: Proposed → Accepted`, con constancia explícita de aprobación).
- **Criterio de cierre:** firma/aprobación explícita registrada.
- **¿Bloquea implementación?** Sí.
- **Fase que bloquea:** Fase 4 — y además dispara el trámite de verificación de negocio ante Meta, que el propio `ADR-008` pide iniciar "en paralelo a las primeras fases de desarrollo, no al final".
- **¿Puede resolverse durante desarrollo?** No debería posponerse — cuanto más tarde se firme, más tarde puede iniciar el trámite de Meta, que es de plazo largo.

### P8 — Redactar `05-api-design.md` — Abierto, **parcialmente iniciado (2026-08-04)**

- **¿Por qué sigue abierto?** ~~Nunca se escribió~~ **→ Ya existe (`05-api-design.md`), pero con alcance deliberadamente parcial**: solo las convenciones transversales (versionado, formato de error, autenticación, RBAC, claims, idempotencia, validación, códigos HTTP, nombres, compatibilidad) necesarias para el arranque parcial controlado de Sucursales, Identidad y Catálogo (`IMPLEMENTATION_MASTER_PLAN.md`, Enmienda 2026-08-04). No contiene ningún contrato de endpoint específico de ningún módulo — sigue sin cerrar en ese sentido.
- **¿Quién debe resolverlo?** Arquitectura.
- **Documento que cambia:** `05-api-design.md` — ya creado, requiere iteraciones futuras módulo por módulo.
- **Criterio de cierre:** existe, con contratos versionados por URI, formato de error consistente (`ADR-013`), y contrato de autenticación acorde a lo que P1/P2 ya cerraron. **Parcialmente cumplido:** las convenciones transversales están definidas; los contratos concretos de cada módulo, no.
- **¿Bloquea implementación?** No para Sucursales/Identidad/Catálogo (las convenciones que necesitan ya existen) — sí para cualquier otro módulo, hasta que se redacte su contrato específico.
- **Fase que bloquea:** Ya no bloquea el arranque parcial autorizado. Sigue bloqueando el resto de Fase 1/2+ hasta que cada módulo tenga su contrato.
- **¿Puede resolverse durante desarrollo?** Las convenciones transversales, no (ya cerradas antes de empezar). Los contratos específicos, sí — módulo por módulo, mismo principio ya aplicado a los Decision Flows (`IMPLEMENTATION_MASTER_PLAN.md` §11).

### P9 — Agregar la referencia `usuarios ↔ manicuristas_recurso`

- **¿Por qué sigue abierto?** Vacío verificado directamente en `04-data-model.md` §5.10 — ninguna tabla conecta a un usuario con rol Manicurista con su recurso agendable.
- **¿Quién debe resolverlo?** Arquitectura.
- **Documento que cambia:** `04-data-model.md` §5.10 (agregar `manicurista_recurso_id` a `usuarios`).
- **Criterio de cierre:** la columna existe y está documentada.
- **¿Bloquea implementación?** Sí, del requisito funcional específico "Manicurista consulta su propia agenda" (`functional-scope.md` §2).
- **Fase que bloquea:** Solo esa funcionalidad puntual dentro de Fase 1/2 — no bloquea el resto del módulo.
- **¿Puede resolverse durante desarrollo?** Sí, sin riesgo real — es una columna aditiva sin dependencias.

### P10 — Formalización del Bounded Context de Garantías

- **Problema:** Garantías tiene Business Rules ya aprobadas (`RN-GAR-01..06`) y una Domain Policy ya aceptada en `ADR-023` (`PoliticaDeGarantia`), pero actualmente no existe: Bounded Context, subdominio definido, aggregate, entidades, value objects, eventos de dominio, ni modelo de datos asociado.
- **Evidencia:**
  - `RN-GAR-01..06` (`docs/business-rules/04-garantias.md`), todas `Aprobada`.
  - `ADR-023` referencia `PoliticaDeGarantia` como una de las 4 Domain Policies aceptadas.
  - `PLATFORM_ARCHITECTURE_MODEL.md` §10 identifica el vacío explícitamente ("Garantías no tiene Bounded Context").
  - `01-domain-discovery.md` no contiene Garantías como subdominio (§3), Bounded Context (§4) ni modelo (§5) — verificado por búsqueda exhaustiva del documento completo.
  - `04-data-model.md` no contiene ninguna tabla relacionada con Garantías — verificado por búsqueda directa.
- **Alcance:** resolver únicamente antes de implementar el módulo de Garantías — no antes.
- **No bloquear:** este punto **no bloquea Fase 1 ni ningún módulo actualmente en curso**. Ningún módulo de Fase 1 (Identidad y Accesos) ni de Fase 2 (Agenda) depende de Garantías.
- **Definition of Ready (de este punto):** debe existir decisión aprobada sobre: Bounded Context, Aggregate(s), Entidades, Value Objects, Domain Events, y modelo de persistencia.
- **Definition of Done (de este punto):** documentos actualizados: `01-domain-discovery.md`, `04-data-model.md`, y cualquier documento dependiente autorizado en el momento de resolverlo (ej. `PLATFORM_ARCHITECTURE_MODEL.md` §7, sujeto a su propia reapertura autorizada por estar congelado).

### Hallazgos posteriores a este documento (2026-08-04) — pendientes de clasificación, no son P1-P9 todavía

Este documento se escribió el 2026-07-16, antes de que existieran `PLATFORM_ARCHITECTURE_MODEL.md` y `ADR-023` (2026-08-03) y antes de la validación de consistencia posterior al cierre del roadmap de propagación (2026-08-04). Los tres hallazgos siguientes surgieron de ese trabajo posterior — ninguno estaba disponible cuando se redactaron los P1-P9 originales, por eso no aparecían ahí. Uno de los tres (Hallazgo A) ya se formalizó como `P10` (ver Sección 1) — los otros dos permanecen aquí, **sin agregarse todavía a la Matriz de cierre (Sección 2) ni a la Definition of Ready/Done**, en espera de la misma decisión de gobernanza explícita.

**Hallazgo A — Garantías no tiene Bounded Context** — ~~pendiente de clasificación~~ **→ Formalizado como `P10` (2026-08-04). Ver Sección 1, "P10 — Formalización del Bounded Context de Garantías".** El análisis y la evidencia completa que sustentaron esta clasificación ahora viven en la ficha de P10, para no duplicar contenido entre dos secciones del mismo documento.

**Hallazgo B — Conflicto potencial entre el SLO de rezago del Outbox y la sincronización "en tiempo real" de Google Calendar**
- **Qué es:** `RN-AGE-09` (`Aprobada`) registra que la Dueña exige sincronización con Google Calendar "en tiempo real o cerca de eso" (2026-08-04); `03-technical-architecture.md` §6.3 ya define un SLO de rezago para el Outbox que podría no cumplir ese requisito — no se ha cotejado el valor numérico exacto, no se sabe hoy si hay conflicto real.
- **Por qué no es diseño nuevo registrarlo aquí:** ambos hechos ya están documentados por separado desde el Paso 3 (`RN-AGE-09`) y el Paso 6 (`ADR-006`) de la propagación — no se investiga ni se resuelve el conflicto aquí, solo se deja constancia de que nadie lo ha cotejado todavía.
- **Por qué corresponde a este documento:** mismo razonamiento que el Hallazgo A.
- **¿Bloquea Fase 1?** No — es un requisito de sincronización de Agenda (Fase 2) contra una integración externa que ya depende de `ADR-006` (`Accepted`), no de la infraestructura base de Fase 1.
- **Autorización necesaria si se formaliza:** cotejar el valor numérico exacto del SLO contra "tiempo real o cerca de eso" es trabajo de arquitectura técnica (`03-technical-architecture.md`), explícitamente fuera del alcance de esta clasificación. Aquí solo se decidiría si amerita un `P11` que **rastree la verificación pendiente**, no que la resuelva.
- **Clasificación provisional:** riesgo técnico de fase tardía (Fase 2), de menor severidad que el Hallazgo A porque es una verificación pendiente (puede resultar en "no hay conflicto real"), no una ausencia estructural ya confirmada.

**Hallazgo C — `RN-SUC-04`: modelo exacto de Google Calendar sin confirmar**
- **Qué es:** confirmado que las sucursales se diferencian por color en Google Calendar; no confirmado si eso implica un calendario de Google *independiente* por sucursal o uno *compartido* con eventos coloreados internamente — dos modelos técnicos distintos, con distinto costo de sincronización.
- **Por qué no es diseño nuevo registrarlo aquí:** la ambigüedad y la repregunta puntual exacta ya están redactadas dentro de `RN-SUC-04` desde el Paso 3 — no se decide aquí cuál de los dos modelos es correcto, solo se traslada la existencia de la ambigüedad a este documento.
- **Por qué corresponde a este documento:** mismo razonamiento que los anteriores.
- **¿Bloquea Fase 1?** No. La propia `RN-SUC-04` ya acota el riesgo a Fase 4 ("el esquema de sincronización uno-a-uno debe rediseñarse antes de Fase 4") — es, en los hechos, un prerrequisito de Fase 4, ya autoclasificado como tal por el propio Rule ID, no de Fase 1.
- **Autorización necesaria si se formaliza:** ninguna de diseño — solo repreguntar a la Dueña la pregunta ya redactada en `RN-SUC-04`. La única decisión de gobernanza pendiente es si se formaliza como `P12` (o se fusiona con el Hallazgo B, ambos sobre Google Calendar).
- **Clasificación provisional:** riesgo de fase tardía (Fase 4), ya correctamente clasificado por su propio Rule ID como tal — el de menor urgencia de los tres: no bloquea Fase 1, tiene fecha límite conocida (antes de Fase 4) y una acción concreta de bajo costo (una repregunta puntual) para resolverse.

**Estado (2026-08-04):** Hallazgo A formalizado como `P10` (ver Sección 1). Hallazgos B y C permanecen aquí — ninguno bloquea Fase 1, ambos tienen destino de resolución ya identificado (B en `03-technical-architecture.md`, C en `RN-SUC-04`/`99-open-questions.md`), ninguno requiere diseño para *registrarse*, solo para *resolverse*. La decisión de si B o C ameritan tratamiento adicional sigue sin tomarse en este documento sin autorización explícita.

---

## 2. Matriz de cierre

| Pendiente | Responsable | Documento | Bloquea | Estado | Acción |
|---|---|---|---|---|---|
| P1 — Conjunto Supabase / BD / ORM / Auth | Desarrollo | `03-technical-architecture.md` | ~~Fase 1 completa~~ Ninguna | **Resuelto (2026-08-04)** | Ninguna — Supabase (BD/Auth/Storage/Realtime) + Drizzle + Railway. Validación en producción de Auth/Railway pendiente como tarea de Fase 1 |
| P2 — `PA-19` (alcance RBAC) | Cliente | `RN-SEG-03`, `99-open-questions.md` | ~~Fase 1 (modelo de permisos), `05-api-design.md`~~ Ninguna | **Resuelto (2026-08-04)** | Ninguna — `RN-SEG-03: Aprobada`, transcrito a `99-open-questions.md` en Paso 11 |
| P3 — 3 máquinas de estado | Arquitectura (+ negocio para 2 disparadores) | `01-domain-discovery.md`, `RN-AGE-14`, `04-data-model.md` | Fase 2, Fase 4 | Abierto (con avance documental — ver §1) | Diseñar con las precisiones ya identificadas |
| P4 — Invariante de capacidad sin manicurista | Cliente + Arquitectura | `01-domain-discovery.md`, `decision-flows-catalogo-diseno.md` | Fase 2 | Abierto | Decisión de negocio + modelado |
| P5 — Circular Agenda↔Anticipos | Arquitectura | `decision-flows-catalogo-diseno.md` | Fase 2/3 | Abierto | Corregir una fila del catálogo |
| P6 — Ratificar F-27 y F-14 | Arquitectura + Cliente | ADR nuevo + enmienda ADR-007/017/022 | Fase 4 | Abierto | Redactar y aprobar |
| P7 — Sign-off ADR-008 | Cliente | `ADR-008-*.md` | Fase 4 + trámite Meta | Abierto | Aprobación explícita |
| P8 — `05-api-design.md` | Arquitectura | `05-api-design.md` (ya existe, parcial) | Módulos sin contrato específico todavía | Abierto (parcialmente iniciado) | Redactar contratos módulo por módulo |
| P9 — `usuarios↔manicuristas_recurso` | Arquitectura | `04-data-model.md` | Rol Manicurista (Fase 1/2) | Abierto | Agregar columna |

---

## Orden óptimo de cierre

Por dependencias reales, no por importancia:

1. **P1** (conjunto Supabase/BD/ORM/Auth) — no depende de nada, y todo lo demás técnico depende de esto. **✅ Resuelto (2026-08-04).**
2. **P2** (`PA-19`) y **P9** (`usuarios↔manicuristas`) — en paralelo con P1, no dependen de él ni entre sí.
3. **Domain Discovery Pregunta #15 y `PA-15`** (insumos de negocio) — en paralelo con 1-2, condición previa de P3.
4. **P3** (3 máquinas de estado) — depende del paso 3.
5. **P4** (invariante de capacidad) — puede correr en paralelo con P3, depende solo de la decisión de negocio propia.
6. **P5** (corrección circular) — sin dependencias, debería cerrarse ya, en cualquier punto de la secuencia.
7. **P6** (ratificar F-27/F-14) y **P7** (sign-off ADR-008) — en paralelo entre sí; no dependen de 1-5, pero P7 dispara el trámite de Meta, por lo que cuanto antes se resuelva mejor, independientemente de su posición en esta secuencia técnica.
8. **P8** (`05-api-design.md`) — al final: depende de P1 (proveedor/ORM), P2 (contrato de auth) y P9 (para el endpoint de agenda de manicurista); consume el catálogo de Decision Flows ya congelado, no necesita esperar a P3/P4/P5/P6/P7 porque esos no afectan la forma del contrato, solo su contenido de negocio.

---

## Definition of Architecture Done

Construida desde la documentación existente, no copiada de una lista genérica:

1. Ninguna de las cuatro decisiones técnicas acopladas de `03-technical-architecture.md` §3.16 permanece en `Decision Pending`. **Cumplido (2026-08-04)** — ver P1.
2. `RN-SEG-03` tiene `Estado: Aprobada`, no `Faltante`. **Cumplido (2026-08-04)** — ver P2.
3. Las tres máquinas de estado (`Cita`, `Conversación`, `TicketEscalamiento`) tienen tabla de transiciones legales documentada, incluyendo qué estados de `Cita` ocupan el horario a efectos de la restricción de exclusión.
4. Existe una regla aprobada que cubre la capacidad de citas sin manicurista asignada.
5. El catálogo de Decision Flows no contiene ninguna invocación directa en sentido Anticipos→Agenda (verificable leyendo `decision-flows-catalogo-diseno.md`).
6. `identidad_accesos.usuarios` tiene una referencia hacia el recurso agendable correspondiente.
7. F-27 y F-14 están ratificados como ADR/enmienda con `Status: Accepted`.
8. `ADR-008` tiene `Status: Accepted` con sign-off explícito del cliente registrado.
9. `05-api-design.md` existe y es consistente con `04-data-model.md` y con el catálogo de Decision Flows congelado.

Cuando estas nueve condiciones se cumplen, la arquitectura está oficialmente cerrada — no antes, y no se exige nada adicional a esto.

---

## Definition of Ready para iniciar implementación

- [x] Proveedor de base de datos elegido y documentado (P1) — **cumplido 2026-08-04**, Supabase
- [x] ORM elegido y documentado (P1) — **cumplido 2026-08-04**, Drizzle
- [x] Proveedor de autenticación elegido y documentado (P1) — **cumplido 2026-08-04**, Supabase Auth (elección cerrada; validación en producción de rotación de refresh token pendiente como tarea de Fase 1, no como parte de este punto)
- [x] `PA-19` resuelta (P2) — **cumplido 2026-08-04**, `RN-SEG-03: Aprobada`
- [ ] Máquina de estados de `Cita` documentada, incluyendo clasificación de estados que ocupan horario y destino del valor tras reprogramación (P3)
- [ ] Máquina de estados de `Conversación` documentada, incluyendo gestión de `modo` en cierre/reapertura (P3)
- [ ] Máquina de estados de `TicketEscalamiento` documentada (P3)
- [ ] Invariante de capacidad para citas sin manicurista resuelta (P4)
- [ ] `FL-ANT-01` corregido en el catálogo de Decision Flows (P5)
- [ ] `usuarios.manicurista_recurso_id` agregado a `04-data-model.md` (P9)
- [ ] F-27 ratificado como ADR (P6)
- [ ] F-14 ratificado como enmienda (P6)
- [ ] `ADR-008` con sign-off explícito del cliente (P7)
- [ ] `05-api-design.md` redactado (P8)
- [x] Proveedor de hosting elegido (bajo rigor mínimo, ya recomendado en `03` §3.13 — no requiere deliberación adicional) — **cumplido 2026-08-04**, Railway (elección cerrada; validación en producción de despliegue rolling/blue-green pendiente como tarea de Fase 1, no como parte de este punto)

Cuando los quince puntos están en verde, el proyecto puede empezar a programarse — no antes, y no se requiere nada fuera de esta lista.

---

## Riesgos aceptados deliberadamente

- **15 reglas `Faltante`/`Pendiente` de prioridad no-Critical del Business Rules Engine.** Se implementa el comportamiento ya `Aprobado` como base y se ajusta cuando lleguen las respuestas. Razonable porque cada una ya tiene su hueco documentado explícitamente (`99-open-questions.md`) — no es un olvido, es una decisión de gobernanza ya adoptada desde que se congeló el Business Rules Engine.
- **SLOs numéricos provisionales sin validar con tráfico real** (`03` §6.3). Razonable porque sigue el mismo patrón ya aceptado por el cliente para RPO/RTO en `ADR-022` — cifras de arquitecto, explícitamente revisables con datos reales.
- **Golden set de IA inicialmente débil** (`ARCHITECTURE_REVIEW.md`, F-16). Razonable porque no puede ser de otra forma antes de tener tráfico real, y ya existe un plan explícito de alimentarlo activamente desde el día 1 de producción.
- **Proveedor de hosting/observabilidad/BSP de WhatsApp específicos sin la máxima deliberación posible.** Razonable porque `03-technical-architecture.md` ya los clasifica como decisiones de bajo riesgo y reversibles — invertir más tiempo de arquitecto ahí no cambiaría la recomendación.
- **Frontera del aggregate `Notificacion` con el "vehículo" de cierre formal todavía sin decidir** (adenda a Domain Discovery vs. quedar solo en `04-data-model.md`). Razonable porque no bloquea ningún módulo antes de Fase 4, y la estructura de datos recomendada ya es utilizable mientras tanto.
- **Marco regulatorio de datos personales (`PA-20`) sin confirmar.** Razonable porque `ADR-017`/`ADR-022` ya adoptan una postura conservadora explícita mientras se confirma, consistente con el principio de minimización ya vigente.
- **Capacidad de recepción humana ante escalamiento masivo (F-05) sin validar.** Razonable porque es una validación de producción con datos reales, no una decisión de arquitectura — no puede cerrarse antes de operar.
- **Los 7 candidatos a ADR/enmienda de severidad Medium restantes** (mecanismo de reclamo de Outbox, segregación de secretos, pruebas de fallo inyectado, límite de gasto de IA, canal SSE de handoff, mecanismo de reconciliación entre aggregates). Razonable porque cada uno ya tiene una recomendación de alta confianza sin alternativa seria competidora — se implementan directamente con esa recomendación y se documentan como ADR *después*, sin que eso represente un riesgo real de calidad.
- **Consolidación documental pendiente** (Sesión 03 de Domain Discovery, fusión con Sesión 02, actualización de `04-data-model.md` con tablas de etiquetas/garantías/`SolicitudDeCambioDeHorario`, 3 adiciones menores al Business Rules Engine ya identificadas). Razonable porque el contenido real ya está aprobado y es utilizable directamente desde `docs/business-rules/` y `docs/decision-flows-catalogo-diseno.md` — lo pendiente es sincronizar el texto narrativo de `01-domain-discovery.md`, no una decisión de fondo sin tomar.

---

## Riesgos que NO deben aceptarse

Los siete pendientes abiertos de la Sección 1/2 (P3-P9) — sin excepción; P1 y P2 ya están resueltos (ver §1). Ninguno se pospone a "durante desarrollo" sin las salvedades ya indicadas explícitamente en cada uno (P5 y P9 son de bajo riesgo real pero no hay motivo para no cerrarlos ya, dado su bajo costo). Los verdaderos bloqueadores no negociables antes de escribir el primer módulo de dominio real (Fase 2, Agenda) son **P3, P4 y P5** — sin ellos, el invariante central del sistema (no-doble-booking) queda con huecos ya demostrados, no hipotéticos.

---

## Respuestas finales

**1. ¿Puede comenzar Fase 1 inmediatamente?**
**Actualizado 2026-08-04:** `P1` ya está `Resuelto` — `03-technical-architecture.md` §3.3/§3.4/§3.7/§3.8/§3.9/§3.13/§3.16 ya no están `Decision Pending`. Esto elimina el único bloqueador que este documento identificaba como propio de Fase 1 en sentido estricto.
`IMPLEMENTATION_MASTER_PLAN.md` §6 exige, como criterio de entrada de Fase 1 completa, que **Fase 0 esté cerrada** — y Fase 0 sigue abierta: 2 de las 3 máquinas de estado (`P3`, `Cita` y `Conversación`) siguen bloqueadas por decisiones de negocio sin responder, `05-api-design.md` sigue sin contratos específicos de módulo, y los 9 candidatos a ADR (`P6`) no están ratificados.

**Actualizado 2026-08-04 — Enmienda de Arranque Parcial Controlado:** `IMPLEMENTATION_MASTER_PLAN.md` fue formalmente revisado (Sección 6, tras la descripción de Fase 0) para autorizar explícitamente que **Sucursales y Personal, Identidad y Accesos, y Catálogo y Cotización** inicien construcción ahora, en paralelo al cierre del resto de Fase 0 — con base en la ausencia de dependencia real ya documentada en las Secciones 4 y 7 de ese mismo plan, y con `05-api-design.md` ya cubriendo las convenciones transversales que esos tres módulos necesitan (`P8`, parcial). Esto no es una reinterpretación de este documento ni una declaración de que Fase 0/Fase 1 completa estén cerradas — es una decisión de secuenciación explícita, registrada en la fuente que la gobierna. Para esos tres módulos específicamente, la respuesta a esta pregunta es **Sí**; para el resto del sistema (Agenda en adelante), sigue siendo **No**.

**2. ¿Puede comenzar Fase 2 inmediatamente?**
No. Hereda el bloqueo de Fase 1 y agrega tres propios con evidencia directa: `04-data-model.md` §9 (máquinas de estado, P3), `DOMAIN_MODEL_REVIEW.md` DM-11 (invariante de capacidad, P4), y `decision-flows-catalogo-diseno.md` (dependencia circular, P5).

**3. ¿Puede comenzar Fase 3 inmediatamente?**
No, por la misma razón que Fase 2: `IMPLEMENTATION_MASTER_PLAN.md` §4/§7 ya establece que Fase 3 (Anticipos/CRM) depende transitivamente de que Fase 2 cierre primero. No tiene bloqueadores propios adicionales más allá de heredar los de Fase 2.

**4. ¿Qué evento marca oficialmente el fin de la arquitectura?**
La verificación explícita, por el cliente y el arquitecto, de que la Definition of Architecture Done (Sección 3) está completamente satisfecha — no la creación de un documento adicional.

**5. ¿Qué documento representa la autorización formal para comenzar a escribir código?**
Este mismo documento, `ARCHITECTURE_CLOSURE_PLAN.md`, en el momento en que su Definition of Ready (Sección 4) quede con los quince puntos en verde. No se requiere un documento nuevo de "autorización" — su función es esta.

**6. Si mañana un nuevo arquitecto llegara al proyecto, ¿tendría suficiente información para construir el sistema sin tomar decisiones de arquitectura adicionales?**
Hoy, no — dependería exactamente de los nueve pendientes de este documento, ni uno más ni uno menos. Una vez cerrados, sí: el conjunto ya existente (`01-domain-discovery.md`, 73 Business Rules, 36 Decision Flows con sus tres matrices de trazabilidad, 22 ADRs con contenido completo, `03-technical-architecture.md`, `04-data-model.md`, `05-api-design.md` una vez escrito, e `IMPLEMENTATION_MASTER_PLAN.md` con el orden exacto de módulos y fases) ya cubre, con evidencia extensa y ya verificada en tres rondas de revisión adversarial, todo lo demás que un arquitecto nuevo necesitaría — no quedaría ninguna decisión de arquitectura de fondo por tomar, solo trabajo de implementación siguiendo lo ya definido.
