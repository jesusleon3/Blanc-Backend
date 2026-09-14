# ARCHITECTURE & DOCUMENTATION HANDOFF - Blanc Project

> Registro de transferencia enfocado exclusivamente en **documentación y arquitectura**. Complementa a `HANDOFF.md` (que cubre el estado general del proyecto, incluyendo la constatación de que no existe código de producción). Este documento existe porque, en la fase actual, **la documentación y las decisiones de arquitectura/dominio son el principal activo de trabajo del proyecto** — no hay backend, frontend real, ni base de datos que documentar como "código en producción".
>
> Fecha de creación: 2026-07-13.

---

## 1. Propósito de este documento

Permitir que cualquier persona (desarrollador, arquitecto, Product Owner, agente de IA) entienda, sin leer el historial completo de decisiones:

- Qué documentos existen, cuál es la fuente oficial de cada tipo de información, y en qué estado está cada uno.
- Qué decisiones de arquitectura y de dominio ya están cerradas y no deben reabrirse sin evidencia objetiva.
- Qué decisiones siguen abiertas y bloquean qué.
- Qué inconsistencias documentales ya se detectaron y siguen sin resolverse.
- En qué orden debe continuarse el trabajo de consolidación documental ya aprobado.

---

## 2. Estado general de la fase de diseño

El proyecto completó un ciclo extenso de diseño de dominio y arquitectura, con múltiples rondas de revisión adversarial en cada documento clave. Las fases de **Domain Discovery**, **Architecture Principles**, **arquitectura técnica**, **modelo de datos** y **decisiones DDD** se consideran oficialmente cerradas y aprobadas. El proyecto entró después en una fase de **documentación funcional y consolidación**, todavía en curso.

Existe, sin embargo, un **desfase real entre lo aprobado y lo formalmente consolidado**: hay decisiones y funcionalidades ya aprobadas (una sesión de descubrimiento de negocio completa, y un análisis de diseño de dominio extenso sobre una funcionalidad nueva) que **todavía no se han fusionado** en el documento fuente de verdad del dominio (`01-domain-discovery.md`). Este es el desfase más importante que cualquier persona que continúe el proyecto debe conocer — se detalla en la Sección 9.

---

## 3. Inventario completo de documentos

| Documento | Fuente oficial de | Estado |
|---|---|---|
| `docs/requirements/blanc-requisitos-negocio.md` | Requisitos originales del cliente (stack de referencia, lista de features pedidas) | Histórico — no se modifica |
| `docs/architecture/01-domain-discovery.md` | Modelo de dominio: subdominios, Bounded Contexts, aggregates, entidades, Value Objects, domain events, casos de uso | **Vivo — pendiente de una consolidación** (ver Sección 9) |
| `docs/domain-discovery/02-domain-discovery-session-02.md` | Hallazgos de una sesión de descubrimiento de negocio adicional (motor de duración por combinación, etiquetas, Garantías, manicurista exclusiva, fallback de disponibilidad, conflicto de confirmación, clarificación conversacional, cortesía en recordatorios) | Aprobado e implementado parcialmente en el mockup; **no fusionado formalmente en `01`** |
| `docs/domain-discovery/03-domain-discovery-session-03.md` | Hallazgo de negocio sobre "cambio a horario anterior para una cita ya confirmada" | **No existe todavía** — su creación fue aprobada como paso de proceso pendiente de ejecutar |
| `docs/architecture/02-architecture-principles.md` | Principios arquitectónicos transversales (DDD como base, Hexagonal+Clean+Vertical Slices, CQRS-lite, Event-Driven, Modular Monolith, principios de IA/API/BD/seguridad/escalabilidad/observabilidad) | Cerrado, salvo una aclaración menor pendiente (principio 9.6, ver Sección 5) |
| `docs/architecture/ADR_INDEX.md` + `docs/architecture/adr/ADR-001` a `ADR-022` | Las 22 decisiones arquitectónicas individuales congeladas | Cerrados — `Status: Proposed`, pendiente de aprobación ejecutiva formal del cliente (ver nota en Sección 9) |
| `docs/architecture/ARCHITECTURE_REVIEW.md` | Registro histórico de una revisión adversarial de los 22 ADRs (28 hallazgos, F-01 a F-28) | Histórico — nunca se modifica |
| `docs/architecture/DOMAIN_MODEL_REVIEW.md` | Registro histórico de una revisión adversarial del modelo de dominio (17 hallazgos, DM-01 a DM-17) | Histórico — nunca se modifica |
| `docs/architecture/03-technical-architecture.md` | Selección de stack técnico y arquitectura de componentes/despliegue | Cerrado formalmente, con varias decisiones marcadas `Decision Pending` dentro de él (ver Sección 5) |
| `docs/architecture/04-data-model.md` | Modelo de datos lógico y físico | Cerrado formalmente, **pero desactualizado respecto a lo ya aprobado** en la Sesión 02 y en el análisis de cambio de horario (ver Sección 9) |
| `docs/presentacion-cliente.md` | Presentación comercial del producto, lenguaje de negocio | Vivo — su roadmap menciona el cambio de horario como "en evaluación", frase que ya no es del todo precisa (ver Sección 9) |
| `docs/functional-scope.md` | Referencia funcional oficial del alcance del producto (para cliente, PO, BA, QA, desarrolladores) | Vivo — completo para todo lo ya aprobado hasta su fecha de redacción, incluyendo el cambio de horario en lenguaje funcional |
| `mockup/` | Demostración visual del producto (sin backend) | Congelado como entregable comercial, salvo por las funcionalidades de la Sesión 02 ya implementadas visualmente |
| `HANDOFF.md` | Estado general del proyecto (código, mockup, mapa completo) | Vivo, generado en esta misma sesión de trabajo |
| `ARCHITECTURE-HANDOFF.md` (este documento) | Estado de documentación y arquitectura | Vivo |

---

## 4. Decisiones arquitectónicas ya cerradas (resumen de los 22 ADRs)

| ADR | Decisión |
|---|---|
| ADR-001 | Modular Monolith, no microservicios |
| ADR-002 | Hexagonal + Clean Architecture + Vertical Slice Architecture combinados |
| ADR-003 | CQRS-lite, limitado a Analítica y disponibilidad de Agenda; sin Event Sourcing |
| ADR-004 | Domain events en proceso (bus en memoria) + patrón Transactional Outbox para efectos externos críticos |
| ADR-005 | PostgreSQL como único motor, separación lógica estricta por esquema por Bounded Context, sin FKs entre esquemas de distinto contexto |
| ADR-006 | La plataforma es la fuente de verdad de disponibilidad; Google Calendar es una proyección de solo lectura |
| ADR-007 | OpenAI exclusivamente para interpretación conversacional; nunca para decisiones de negocio |
| ADR-008 | API oficial de WhatsApp Business Platform; rechaza Evolution API como integración principal |
| ADR-009 | Single-tenant en despliegue, con `Sucursal` como límite ya "tenant-ready" para una eventual expansión |
| ADR-010 | RBAC con alcance por sucursal, JWT de corta duración + Refresh Token revocable, MFA obligatorio para roles elevados, auditoría append-only |
| ADR-011 | Observabilidad basada en OpenTelemetry, con IA como categoría de instrumentación propia |
| ADR-012 | Entornos Development/Sandbox/Production, despliegue rolling/blue-green, migraciones expand/contract |
| ADR-013 | Tres categorías de error (dominio, integración externa, inesperado), circuit breaker por dependencia externa |
| ADR-014 | Versionado de API por URI, contract-first, contratos internos y públicos diferenciados |
| ADR-015 | Prompts de IA como artefacto versionado, independiente del despliegue de código |
| ADR-016 | Human Handoff: modo de conversación autoritativo revalidado antes de cada respuesta, notificación con entrega garantizada |
| ADR-017 | Object storage privado con URLs firmadas y retención acotada para archivos |
| ADR-018 | Cola de background jobs durable, at-least-once, con handlers idempotentes y dead-letter alertable |
| ADR-019 | Pirámide de testing alineada a capas arquitectónicas + golden set de regresión conversacional para IA |
| ADR-020 | Feature flags de propósito acotado (kill-switch y rollout gradual), no configuración de negocio |
| ADR-021 | Estrategia unificada de idempotencia (clave en puntos de entrada) + invariante de negocio como respaldo |
| ADR-022 | Backup/DR con RPO ≤15min/RTO ≤4h provisional, retención diferenciada por clase de dato |

**Ninguno de estos 22 ADRs debe reabrirse** sin una contradicción objetiva y demostrable contra otro documento ya aprobado — ya se verificó exhaustivamente, en más de una ronda de revisión, que ninguno se contradice con las decisiones de dominio más recientes (incluyendo la incorporación de `SolicitudDeCambioDeHorario`).

---

## 5. Decisiones técnicas todavía pendientes (`Decision Pending`)

Documentadas explícitamente como tales dentro de `03-technical-architecture.md` y `04-data-model.md` — no son ambigüedades accidentales, son vacíos identificados y dejados abiertos a propósito:

- Proveedor específico de base de datos (PostgreSQL gestionado: Supabase, Neon u otro).
- ORM / capa de acceso a datos (Prisma vs. Drizzle).
- Proveedor de autenticación (gestionado vs. implementación propia sobre JWT).
- Proveedor de storage de archivos (S3-compatible vs. Supabase Storage).
- Canal realtime del panel de handoff (recomendación: Server-Sent Events).
- Business Solution Provider de WhatsApp (acceso directo a Meta vs. un BSP comercial).
- Proveedor de hosting (Railway, Render o Fly.io).
- Backend de observabilidad (proveedor gestionado compatible con OpenTelemetry).
- Mecanismo exacto de reclamo de filas del Outbox (`FOR UPDATE SKIP LOCKED` recomendado, no ratificado formalmente).
- Aclaración de redacción pendiente en el principio 9.6 de `02-architecture-principles.md` (distinguir clarificación conversacional de escalada por baja confianza — identificada en la Sesión 02, nunca aplicada).

Ninguna de estas bloquea seguir documentando; todas bloquean iniciar implementación real de backend.

---

## 6. Modelo de dominio — resumen

- **11 Bounded Contexts** (no 10 — corrección ya aplicada en `03`/`04`, pendiente de reflejarse también en `01` si se reabre esa sección): Agenda, Catálogo y Cotización, Conversación, Escalamiento, Clientas/CRM, Anticipos, Sucursales y Personal, Notificaciones, Sincronización de Calendario, Identidad y Accesos, Analítica.
- **Aggregates principales ya documentados:** `Cita`, `ListaDeEsperaEntrada` (Agenda); `Servicio`, `ModificadorDeDiseño` (Catálogo); `Conversacion` (Conversación); `TicketEscalamiento` (Escalamiento); `Clienta` (CRM); `SolicitudAnticipo` (Anticipos); `Sucursal`, `Manicurista` (Sucursales y Personal); `Usuario` (Identidad y Accesos).
- **Cuatro pares de consistencia eventual** (tres ya en `01-domain-discovery.md` §5.11; el cuarto aprobado en conversación, pendiente de escribirse): `Cita ↔ SolicitudAnticipo`, `Conversacion ↔ TicketEscalamiento`, `Cita ↔ ListaDeEsperaEntrada`, y **`Cita ↔ SolicitudDeCambioDeHorario`** (nuevo, pendiente de consolidación formal).
- **`SolicitudDeCambioDeHorario`** — aggregate independiente aprobado, dentro del Bounded Context Agenda. Referencia la `Cita` protegida por identificador simple. No introduce Value Object de criterios de aceptación adicionales (decisión explícita, descartada por sobreingeniería — ver `HANDOFF.md` §7). El resultado de aceptar una oferta debe modelarse como reprogramación de la misma cita, no como cancelación más una cita nueva (precisión pendiente de fijar al redactar).
- **Tres máquinas de estado deliberadamente sin diseño formal:** `Cita`, `Conversacion`, `TicketEscalamiento` — se conoce el conjunto de estados observables, no las reglas exactas de transición. Esta restricción sigue vigente y no debe resolverse por iniciativa propia.

---

## 7. Modelo de datos — resumen

`04-data-model.md` documenta 11 esquemas (uno por Bounded Context) más 3 esquemas transversales (`auditoria`, `feature_flags`, `prompts_ia`), con mecanismos transversales ya definidos (Outbox por esquema, idempotencia, auditoría append-only con retención diferenciada, convenciones de tipos). **Pendiente de agregar a este documento:**

- Tablas derivadas de la Sesión 02: etiquetas de cliente, garantías, reglas de duración por combinación (retiro/aplicación).
- Tabla de `SolicitudDeCambioDeHorario`, con referencia real (FK, mismo esquema) a `agenda.citas`, y el cuarto par de consistencia eventual en la sección correspondiente.

Ninguna de estas adiciones contradice el modelo de datos ya cerrado — son estrictamente aditivas.

---

## 8. Preguntas de negocio abiertas (consolidado)

Heredadas de `01-domain-discovery.md` (numeradas como preguntas abiertas originales) más las que surgieron después:

- Fuente de verdad del calendario y resolución de conflictos con Google Calendar (Pregunta #1).
- Relación exacta entre "Manicurista" como recurso agendable y como usuario (Pregunta #2).
- Criterio y umbral exacto para asignar a una clienta en lista roja (Pregunta #3).
- Ventana de expiración de la retención de horario cuando se solicita un anticipo (Pregunta #4).
- Alcance del historial de clienta, global vs. por sucursal (Pregunta #6 — ya adoptado como supuesto de trabajo: global).
- Alcance exacto de RBAC por sucursal, en particular para los roles Analista y Solo lectura (Pregunta #11).
- Marco regulatorio de protección de datos personales aplicable (Pregunta #12).
- Confirmación de un calendario de Google por sucursal (Pregunta #14).
- Prioridad entre varias clientas candidatas a un mismo horario liberado (relevante tanto para Lista de Espera como para Cambio de Horario) — pregunta nueva, sin número asignado todavía en `01`.
- Ventana exacta de respuesta antes de considerar que una clienta no aceptó una oferta de cambio de horario — pregunta nueva.
- Beneficio exacto de una garantía válida (reposición, descuento, otro) — pregunta nueva de la Sesión 02.
- Gobernanza exacta de las etiquetas de cliente (catálogo cerrado vs. libre, alcance por sucursal) — pregunta nueva de la Sesión 02.

Ninguna de estas bloquea seguir documentando — se documentan como pendientes, no se resuelven por iniciativa propia.

---

## 9. Inconsistencias documentales conocidas (con evidencia)

1. **`mockup/README.md`** afirma que `01-domain-discovery.md` está *"ya auditado y cerrado"*; el propio encabezado de `01-domain-discovery.md` dice *"Borrador v0.1 — pendiente de validación de las Preguntas Abiertas antes de congelar el modelo."* Verificable directamente en ambos archivos.
2. **La Sesión 02 y el análisis de cambio de horario están aprobados pero no consolidados en `01-domain-discovery.md`.** Esto significa que `01` (la fuente oficial del dominio) está, hoy, desactualizado respecto a lo que ya existe en el mockup y a lo que ya se aprobó conceptualmente.
3. **`04-data-model.md`** no refleja las tablas de la Sesión 02 ni de `SolicitudDeCambioDeHorario`, pese a que ambas ya están aprobadas.
4. **`docs/presentacion-cliente.md`** describe correctamente las funcionalidades de la Sesión 02 (porque se redactó a partir del mockup real), pero su mención del cambio de horario como "en evaluación, no incluido todavía" ya no es del todo precisa — la decisión conceptual está aprobada, aunque no implementada. Es, en la práctica, el documento que **mejor refleja el estado real del mockup**, incluso por encima de `01-domain-discovery.md`, que debería ser la fuente primaria.
5. **Los 22 ADRs siguen con `Status: Proposed`** en su encabezado individual, pese a que el conjunto se trata como cerrado y aprobado desde hace varias fases del proyecto — ningún ADR fue actualizado a `Accepted` tras la aprobación del cliente.

Ninguna de estas es una contradicción de contenido (nada se dice de forma incompatible) — todas son **desfases de sincronización**, exactamente el riesgo que la Sección 11 busca prevenir.

---

## 10. Intentos de diseño descartados

(Mismo contenido que `HANDOFF.md` §7, repetido aquí por ser información específicamente de arquitectura/dominio.)

- **"SolicitudDeHorarioAnterior"** como nombre del aggregate de cambio de horario — descartado por fijar una dirección (solo horarios más tempranos) que se vuelve falsa si el negocio acepta otras condiciones en el futuro. Reemplazado por `SolicitudDeCambioDeHorario`.
- **Separación en dos aggregates ("Interés" de larga duración + "Oferta" repetible)** — descartada tras una revisión YAGNI/Occam explícita: no había evidencia real del negocio de que se necesitaran múltiples intentos de oferta por cita. Se mantiene como una alternativa a reconsiderar **solo si** el negocio confirma explícitamente esa necesidad — no antes.
- **Extender `ListaDeEsperaEntrada`** para cubrir también el caso de cambio de horario (en vez de un aggregate nuevo) — evaluada como alternativa seria en más de una ronda; no se encontró un invariante de negocio que la descartara de forma dura, pero se prefirió un aggregate separado por una razón de historia de diseño: `ListaDeEsperaEntrada` nunca fue pensada para proteger una cita con anticipo/garantía ya asociados. Es la decisión más cercana a un empate real de todo el proceso de diseño.

---

## 11. Plan de actualización pendiente — orden recomendado

Ya aprobado, pendiente de ejecutarse:

1. Crear `docs/domain-discovery/03-domain-discovery-session-03.md` (consolidar el hallazgo de cambio de horario).
2. Actualizar `docs/architecture/01-domain-discovery.md` — fusionar la Sesión 02 y luego la Sesión 03, en ese orden cronológico.
3. Marcar `02-domain-discovery-session-02.md` (y la nueva 03) con una nota de estado "fusionado en `01`".
4. Aclarar el principio 9.6 de `02-architecture-principles.md`.
5. Agregar, si se desea, una fila de trazabilidad opcional en `03-technical-architecture.md`.
6. Actualizar `04-data-model.md` con las tablas nuevas.
7. Actualizar el roadmap de `docs/presentacion-cliente.md`.
8. Verificar que `docs/functional-scope.md` siga siendo consistente con lo anterior (ya lo es, a la fecha de este documento).

---

## 12. Fuente oficial de cada tipo de información

| Tipo de información | Documento fuente |
|---|---|
| Modelo de dominio (aggregates, eventos, casos de uso) | `01-domain-discovery.md` |
| Hallazgos de negocio todavía no consolidados | `0X-domain-discovery-session-0X.md` |
| Principios arquitectónicos transversales | `02-architecture-principles.md` |
| Stack técnico y componentes | `03-technical-architecture.md` |
| Modelo de datos | `04-data-model.md` |
| Decisiones arquitectónicas individuales | ADRs |
| Revisiones históricas | `ARCHITECTURE_REVIEW.md`, `DOMAIN_MODEL_REVIEW.md` (nunca se modifican) |
| Alcance funcional para negocio/QA/desarrollo | `docs/functional-scope.md` |
| Presentación comercial | `docs/presentacion-cliente.md` |
| Estado general del proyecto (código + docs) | `HANDOFF.md` |
| Estado de documentación y arquitectura | `ARCHITECTURE-HANDOFF.md` (este documento) |

---

## 13. Contexto para quien continúe

- No reabrir ningún ADR ni la decisión de `SolicitudDeCambioDeHorario` sin una contradicción objetiva y demostrable — ya fueron sometidos a varias rondas de revisión adversarial.
- No diseñar las máquinas de estado de `Cita`, `Conversacion` o `TicketEscalamiento` por iniciativa propia.
- Antes de escribir código de backend real, cerrar como mínimo: proveedor de base de datos, ORM, proveedor de autenticación (los tres bloquean directamente el primer módulo que se implemente).
- El orden de la Sección 11 existe para evitar que la documentación se desincronice más de lo que ya está — seguirlo en ese orden, no en paralelo desordenado.
- Ante cualquier duda sobre cuál documento es la fuente oficial de un dato, consultar la tabla de la Sección 12 antes de asumir.
