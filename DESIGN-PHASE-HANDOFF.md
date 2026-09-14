# Handoff Final — Fase de Descubrimiento, Arquitectura y Modelado de Reglas

> **Propósito de este documento:** cierre definitivo de la primera gran fase del proyecto Blanc. Está escrito para que una conversación completamente nueva (humana o de IA) pueda continuar el trabajo sin releer el historial completo. Complementa, sin repetir en detalle, a `/HANDOFF.md` (estado general del proyecto y del código) y `/ARCHITECTURE-HANDOFF.md` (snapshot previo de documentación/arquitectura, ahora parcialmente superado en vigencia por este documento).
> **Fecha de cierre de fase:** 2026-07-15.
> **Regla de lectura:** este documento no propone nada nuevo — es un reporte fiel del estado ya decidido. Ninguna decisión aquí descrita fue tomada en este documento; todas ya estaban aprobadas antes de escribirlo.

---

## 1. Estado actual del proyecto

- **No existe código de producción.** El repositorio contiene únicamente documentación (`docs/`) y un mockup estático sin backend (`mockup/`, HTML/CSS/JS vanilla, sin build step).
- La fase de **diseño de dominio, arquitectura y modelado de reglas de negocio** se da por **oficialmente cerrada** con este documento.
- Se completaron, en orden: Domain Discovery inicial → 22 ADRs → Arquitectura Técnica → Modelo de Datos → una segunda sesión de descubrimiento de negocio (Sesión 02, con hallazgos ya implementados en el mockup) → un análisis DDD completo de una funcionalidad nueva (cambio a horario anterior) → una consolidación funcional completa (`functional-scope.md`) → una revisión estratégica de generalización para una futura plataforma SaaS → la construcción completa del **Business Rules Engine** (73 reglas).
- El proyecto entra ahora en la fase siguiente: cerrar preguntas de negocio pendientes con el cliente y avanzar hacia consolidación documental final e implementación real.

---

## 2. Documentos existentes y propósito de cada uno

| Documento | Propósito | Estado |
|---|---|---|
| `docs/requirements/blanc-requisitos-negocio.md` | Requisitos originales del cliente | Histórico, no se modifica |
| `docs/architecture/01-domain-discovery.md` | **Fuente oficial del modelo de dominio** (subdominios, Bounded Contexts, aggregates, eventos, invariantes) | Cerrado por instrucción del cliente. Su encabezado interno todavía dice "Borrador v0.1" (inconsistencia de forma conocida, no de fondo — ver §11). Pendiente de fusionar Sesión 02 y la sesión de cambio de horario (nunca escrita como Sesión 03). |
| `docs/domain-discovery/02-domain-discovery-session-02.md` | Hallazgos de la segunda sesión de descubrimiento de negocio | Aprobado, implementado en el mockup, **no fusionado formalmente** en `01-domain-discovery.md` |
| `docs/domain-discovery/03-domain-discovery-session-03.md` | Sesión sobre cambio a horario anterior | **No existe.** Su creación está aprobada como paso de proceso, nunca ejecutada |
| `docs/architecture/02-architecture-principles.md` | **Fuente oficial de principios arquitectónicos transversales** | Cerrado; aclaración de redacción pendiente en el principio 9.6 (distinguir clarificación conversacional de escalada por baja confianza) |
| `docs/architecture/ADR_INDEX.md` + `docs/architecture/adr/ADR-001` a `ADR-022` | Las 22 decisiones arquitectónicas individuales | Tratadas como cerradas en la práctica; el campo `Status` de cada archivo individual sigue diciendo `Proposed` — nunca se actualizó formalmente a `Accepted` (ver §11) |
| `docs/architecture/ARCHITECTURE_REVIEW.md` | Revisión adversarial histórica de los ADRs (28 hallazgos, F-01 a F-28) | Histórico, nunca se modifica |
| `docs/architecture/DOMAIN_MODEL_REVIEW.md` | Revisión adversarial histórica del modelo de dominio (17 hallazgos, DM-01 a DM-17) | Histórico, nunca se modifica |
| `docs/architecture/03-technical-architecture.md` | **Fuente oficial del stack técnico y arquitectura de componentes** | Cerrado, con varios `Decision Pending` internos (ver §3) |
| `docs/architecture/04-data-model.md` | **Fuente oficial del modelo de datos** lógico/físico | Cerrado; desactualizado respecto a la Sesión 02 y al cambio de horario (tablas nuevas aprobadas aún no incorporadas) |
| `docs/functional-scope.md` | **Referencia funcional oficial** del comportamiento observable del sistema, sin lenguaje DDD/arquitectura | Vivo, completo hasta su fecha de redacción, incluye el cambio de horario como capacidad aprobada-pendiente |
| `docs/presentacion-cliente.md` | Presentación comercial del producto | Vivo; el wording de su roadmap sobre cambio de horario ("en evaluación") quedó desactualizado |
| `docs/business-rules/` (14 archivos: `00-index.md`, `01`–`12` por categoría, `99-open-questions.md`) | **Fuente única oficial de las reglas operativas del negocio** | Vivo — 73 reglas, ver §9 |
| `mockup/` | Prototipo visual sin backend | Congelado, salvo las funcionalidades de la Sesión 02 ya implementadas visualmente |
| `/HANDOFF.md` | Estado general del proyecto (código + mockup + docs) | Vivo, snapshot del 2026-07-13 |
| `/ARCHITECTURE-HANDOFF.md` | Estado de documentación y arquitectura | Vivo, snapshot del 2026-07-13 — su contenido detallado (alternativas de diseño descartadas, inventario completo) sigue siendo válido; este documento lo complementa, no lo reemplaza |
| `/DESIGN-PHASE-HANDOFF.md` (este documento) | Cierre definitivo de la fase de diseño | Vivo, snapshot del 2026-07-15 |

---

## 3. Arquitectura ya congelada

**Patrones/decisiones estructurales (22 ADRs):**

| ADR | Decisión |
|---|---|
| 001 | Modular Monolith, no microservicios |
| 002 | Hexagonal + Clean Architecture + Vertical Slice |
| 003 | CQRS-lite limitado a Analítica y disponibilidad de Agenda |
| 004 | Domain Events en proceso + Transactional Outbox |
| 005 | PostgreSQL único, esquema por Bounded Context, sin FKs cruzadas |
| 006 | Google Calendar como proyección de solo lectura |
| 007 | OpenAI exclusivamente para interpretación, nunca decisión |
| 008 | API oficial de WhatsApp Business Platform (rechaza Evolution API) — **ver §11, pendiente de sign-off del cliente** |
| 009 | Single-tenant en despliegue; `Sucursal` tenant-ready; modelo Silo si aparece un segundo cliente |
| 010 | RBAC + JWT + Refresh Token rotable + MFA + auditoría append-only |
| 011 | OpenTelemetry, observabilidad de IA como categoría propia |
| 012 | 3 entornos, rolling/blue-green, migraciones expand/contract |
| 013 | 3 categorías de error, circuit breaker, degradación a humano |
| 014 | Versionado de API por URI, contract-first |
| 015 | Prompts como artefacto versionado independiente del código |
| 016 | Human Handoff con revalidación de modo + escalamiento-de-escalamiento |
| 017 | Object storage privado, URLs firmadas, retención acotada |
| 018 | Cola de background jobs durable, idempotente, dead-letter |
| 019 | Pirámide de testing + golden set conversacional |
| 020 | Feature flags acotados a kill-switch/rollout, nunca configuración de negocio |
| 021 | Idempotencia de dos capas (clave en entrada + invariante de negocio) |
| 022 | Backup/DR: RPO ≤15min/RTO ≤4h provisional, retención diferenciada |

**Stack técnico firme (`03-technical-architecture.md`):** NestJS, Next.js, Redis, `googleapis`, GitHub Actions, OpenAI Responses API (no Assistants API).

**`Decision Pending` heredados, sin cerrar (no bloquean seguir documentando; sí bloquean implementación real):** proveedor de base de datos, ORM (Prisma vs. Drizzle), acoplamiento cache/cola (BullMQ vs. pg-boss), canal realtime (SSE recomendado), proveedor de storage de archivos, proveedor de autenticación, BSP de WhatsApp, proveedor de hosting, backend de observabilidad, ubicación del almacén de idempotencia, mecanismo de materialización del read-model de disponibilidad, frontera del aggregate `Notificacion`.

---

## 4. Decisiones irreversibles tomadas

No reabrir estas sin una contradicción objetiva y demostrable:

1. **11 Bounded Contexts** (no 10 — `Notificaciones` se agregó post-hoc vía hallazgo DM-07).
2. **`SolicitudDeCambioDeHorario`**: aggregate independiente dentro de Agenda, referencia simple a `cita_id` (sin Value Object de criterios de aceptación), aceptar una oferta es una reprogramación de la misma cita (nunca cancelar+crear). Dos alternativas de diseño evaluadas y **rechazadas explícitamente**: nombrarlo "SolicitudDeHorarioAnterior" (fija una dirección incorrecta) y dividirlo en `Interés`+`Oferta` (sobreingeniería sin evidencia real de negocio).
3. **Las tres máquinas de estado deliberadamente sin diseñar** (`Cita`, `Conversacion`, `TicketEscalamiento`) — se conocen los estados observables, no las transiciones formales. No diseñarlas por iniciativa propia.
4. **Gobernanza de límites documentales**: cada documento conserva su propósito íntegro; el Business Rules Engine no fuerza migración de `01-domain-discovery.md`/`04-data-model.md` hacia referencias de Rule ID.
5. **Visión SaaS multi-tenant**: Blanc es el primer cliente de una futura plataforma; principio "generalizar el modelo, no las funcionalidades"; modelo de expansión Silo (ADR-009). Tres renames identificados como deseables (`Clienta`→`Cliente`, `Manicurista`→`Profesional` como concepto, `ModificadorDeDiseño`→`Modificador de Servicio`) están **explícitamente diferidos** — no aplicarlos especulativamente; se decidirán cuando exista un segundo cliente real.
6. **`ComposicionPorUña` y el contenido de las 73 reglas de negocio permanecen específicos de Blanc**, sin generalizar — solo la infraestructura del Business Rules Engine (taxonomía, template, gobernanza) es agnóstica de industria.
7. **Business Rules Engine como fuente única de las reglas operativas** — ninguna lógica de negocio debe duplicarse en prompts, frontend, backend o documentación fuera de `docs/business-rules/`.

---

## 5. ADRs relevantes para continuar

Los 22 ya están congelados (§3). Atención especial si se retoma trabajo de arquitectura:
- **ADR-008** (WhatsApp): es la única desviación explícita del stack de referencia del cliente — pendiente de aprobación formal (ver §11).
- **ADR-009** (Multi-tenant): directamente relevante para cualquier decisión futura relacionada con la visión SaaS (§4.5).
- **ADR-006** y **ADR-022**: marcadas desde el índice original como prioritarias de revisión por depender de supuestos del arquitecto, no de confirmación explícita del cliente.

---

## 6. Estado del Domain Discovery

- 11 Bounded Contexts, 3 Core Subdomains (Motor de Cotización, Motor de Disponibilidad, Orquestación Conversacional), Supporting y Generic Subdomains ya clasificados.
- Aggregates y Domain Events documentados por contexto (`01-domain-discovery.md` §5).
- **4 pares de consistencia eventual**: `Cita↔SolicitudAnticipo`, `Conversacion↔TicketEscalamiento`, `Cita↔ListaDeEsperaEntrada` (los tres ya en el documento) + `Cita↔SolicitudDeCambioDeHorario` (aprobado, **no escrito aún** en el documento).
- **18 preguntas abiertas originales** (`01-domain-discovery.md` §2/§9) siguen sin resolver formalmente, aunque varias ya tienen un supuesto de trabajo adoptado.
- Sesión 02 y la sesión de cambio de horario están aprobadas conceptualmente pero **no fusionadas** en este documento — es el desfase documental más importante pendiente.

---

## 7. Estado del Data Model

- 11 esquemas por Bounded Context + 3 transversales (`auditoria`, `feature_flags`, `prompts_ia`).
- Mecanismos transversales definidos: Outbox por esquema, idempotencia (ubicación `Decision Pending`), auditoría append-only con retención diferenciada, feature flags, versionado de prompts.
- Control de concurrencia de `Cita` ya firme (restricción de exclusión + bloqueo optimista).
- **Pendiente de incorporar**: tablas de etiquetas de cliente, garantías, motor de duración por combinación (retiro/aplicación), y la tabla de `SolicitudDeCambioDeHorario` — todas aprobadas en Sesión 02 / sesión de cambio de horario, ninguna escrita aún en este documento.
- `Decision Pending` sin cerrar: ORM (heredado, no se cierra en este documento por instrucción explícita), frontera del aggregate `Notificacion`, mecanismo de reconciliación entre pares de consistencia eventual, estructura de corrección de snapshot erróneo.

---

## 8. Estado del Functional Scope

- `docs/functional-scope.md` completo: 9 módulos funcionales (Agenda, WhatsApp/IA, Escalamiento, CRM, Anticipos, Garantías, Notificaciones, Administración, Reportes), cada uno con la estructura de 9 partes (Objetivo/Descripción/Funcionalidades/Reglas de negocio/Restricciones/Casos de uso/Automatizaciones/Integraciones/Indicadores).
- Cero lenguaje DDD/arquitectura — es la referencia para cliente, PO, BA, QA y desarrollo.
- Incluye el cambio de horario como capacidad ya aprobada, con nota explícita de que aún no está consolidada formalmente en el Domain Discovery.
- Es, junto con `docs/presentacion-cliente.md`, el documento que mejor refleja el estado real del negocio hoy — más al día que `01-domain-discovery.md` en este momento.

---

## 9. Estado del Business Rules Engine

- `docs/business-rules/`: 14 archivos, **73 reglas** en 12 categorías (Agenda, Duración y Cotización, Anticipos, Garantías, CRM/Clientas, Conversación e IA, Escalamiento, Notificaciones, Sucursales y Configuración, Identidad/Seguridad, Auditoría/Cumplimiento, Reportes).
- Template de 21 campos por regla (Rule ID, Nombre, Objetivo, Descripción, Categoría, Alcance, Disparador, Precondiciones, Entradas requeridas, Lógica de negocio, Resultado esperado, Ejemplos, Excepciones, Prioridad, Consumidores, Dependencias, Fuente, Estado, Versión, Fecha de aprobación, Notas).
- **58 reglas en `Aprobada`** (o aprobada con matiz), **15 en `Faltante`/`Pendiente`/`Asumida`**.
- Gobernanza activa: Rule IDs permanentes y no reutilizables, ningún campo inventado, `Estado` como fuente de verdad de confiabilidad, dependencias declaradas por Rule ID.
- Es la **fuente única oficial de las reglas operativas** — ninguna otra documento debe duplicar su contenido; documentos nuevos pueden referenciar un Rule ID.

---

## 10. Preguntas abiertas

- **`docs/business-rules/99-open-questions.md`** es, de aquí en adelante, el **punto de entrada práctico** para cualquier pregunta de negocio pendiente — consolida 24 preguntas (`PA-01` a `PA-24`), cada una cruzada con los Rule IDs que bloquea.
- Las 18 preguntas originales de `01-domain-discovery.md` §2/§9 siguen siendo la fuente formal de las que aún no tienen supuesto de trabajo adoptado — varias ya están reflejadas dentro de `99-open-questions.md` bajo su Rule ID correspondiente.
- La pregunta de mayor impacto estructural: **alcance de sucursales por rol para Analista y Solo lectura** (`PA-19`/`RN-SEG-03`) — es la única que bloquea un módulo completo (RBAC), no solo un valor puntual.

---

## 11. Riesgos conocidos

**Inconsistencias documentales (de forma, no de fondo — no bloquean nada, pero deben conocerse):**
- `01-domain-discovery.md` dice internamente "Borrador v0.1" pese a tratarse como cerrado.
- Los 22 ADRs siguen con `Status: Proposed` en su archivo individual pese a tratarse como aprobados en la práctica.
- `mockup/README.md` afirma que `01-domain-discovery.md` está "cerrado", lo cual es cierto en la práctica pero contradice el propio encabezado del documento.

**Riesgo de negocio no resuelto:**
- **ADR-008 (WhatsApp)** es una desviación explícita del stack de referencia del cliente, señalada desde `CLAUDE.md` como pendiente de aprobación formal — no debe asumirse cerrada solo porque el resto de la arquitectura se trata como tal.
- Dependencia total de WhatsApp como único canal por sucursal (riesgo de continuidad si un número es bloqueado).
- Manejo de datos personales sensibles sin marco regulatorio confirmado (`PA-20`).
- Ambigüedad de anticipos/reembolsos como fuente potencial de disputas (`PA-06`, `PA-07`).

**Riesgo técnico documentado (sin acción requerida ahora):**
- Interpretación de composición de servicios vía LLM (riesgo de alucinación, mitigado por `RN-CONV-02`).
- Condiciones de carrera en reservas de alta demanda (mitigado por `RN-AGE-01`/`RN-AGE-02`).
- Costo de IA no acotado a nivel de control técnico (solo monitoreo hoy).

**Limitaciones conocidas del mockup:**
- `confirmarCita()` no persiste la cita en `DB.citas` (confirmación cosmética).
- `HORA_SLOTS` es un arreglo fijo, nunca cruzado contra horario/festivos/citas reales (disponibilidad simulada, no calculada).

---

## 12. Qué NO debe replantearse

- Ninguno de los 22 ADRs, salvo contradicción objetiva demostrable.
- Los 11 Bounded Contexts y sus aggregates ya modelados.
- El diseño de `SolicitudDeCambioDeHorario` y sus dos alternativas ya rechazadas.
- Las tres máquinas de estado deliberadamente no diseñadas.
- La gobernanza de límites documentales (ningún documento cerrado se migra a Rule IDs).
- Las reglas de gobernanza del Business Rules Engine (§9).
- Los tres renames diferidos (§4.5) — no aplicarlos ni volver a debatirlos sin un segundo cliente real.
- `ComposicionPorUña` y el contenido de las reglas de negocio — no generalizarlos especulativamente.

---

## 13. Qué sigue exactamente después de este handoff

En orden recomendado:

1. **Resolver con el cliente las preguntas de `docs/business-rules/99-open-questions.md`** para promover reglas de `Faltante`/`Pendiente` a `Aprobada` — es el trabajo de mayor valor inmediato, no requiere tocar arquitectura.
2. **Crear `docs/domain-discovery/03-domain-discovery-session-03.md`** (cambio a horario anterior) — paso de proceso ya aprobado, nunca ejecutado.
3. **Fusionar Sesión 02 y Sesión 03 en `01-domain-discovery.md`**, en ese orden.
4. **Aplicar la aclaración de redacción del principio 9.6** en `02-architecture-principles.md`.
5. **Actualizar `04-data-model.md`** con las tablas de etiquetas, garantías, motor de duración y `SolicitudDeCambioDeHorario`.
6. **Actualizar el wording del roadmap de `docs/presentacion-cliente.md`** sobre cambio de horario.
7. **Decidir sobre `docs/documentation-governance.md`** (estructura propuesta, nunca aprobada ni escrita).
8. **Formalizar la aprobación de los 22 ADRs** (cambiar `Status: Proposed` → `Accepted` archivo por archivo), incluyendo específicamente el sign-off pendiente de ADR-008.
9. **Cerrar los `Decision Pending` de stack técnico** (proveedor de BD, ORM, autenticación, BSP de WhatsApp, hosting, observabilidad) — es el paso que realmente habilita empezar a escribir código de producción.
10. Opcional, sin aprobar todavía: funcionalidades de mockup diferidas de la Sesión 02 (KPIs de dashboard adicionales, secciones de administración) y las dos limitaciones conocidas del mockup (§11) — solo si se decide seguir invirtiendo en el mockup antes de implementación real.

Con este documento, la fase de descubrimiento, arquitectura y modelado de reglas queda formalmente cerrada.
