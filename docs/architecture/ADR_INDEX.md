# Índice de Architecture Decision Records — Blanc

> **Estado general:** Todos los ADRs listados abajo tienen status **Proposed**, salvo `ADR-006` (**Accepted**, confirmado por la Dueña el 2026-08-03) — ninguno de los demás se considera `Accepted` hasta que el cliente los apruebe explícitamente (individualmente o como conjunto). `ADR-008` recibió respuesta parcial del cliente que cambia su alcance; sigue `Proposed`, pendiente de rediseño formal (ver nota abajo). No se debe continuar con la arquitectura técnica (`03-technical-architecture.md`) ni con implementación hasta que este índice quede aprobado.
>
> **Fuentes:** `docs/requirements/blanc-requisitos-negocio.md`, `docs/architecture/01-domain-discovery.md`, `docs/architecture/02-architecture-principles.md`.
>
> Cada ADR completo vive en `docs/architecture/adr/ADR-0XX-*.md` con la estructura: Title, Status, Context, Problem Statement, Constraints, Options Considered, Decision, Consequences (Positive/Negative), Risks, Alternatives Rejected, Future Revisit Criteria.

## Decisiones que requieren aprobación prioritaria

Estas tres decisiones tienen el mayor impacto si están mal calibradas, o dependen de una confirmación de negocio que aún no existe formalmente. Se recomienda revisarlas primero.

| ADR | Por qué es prioritaria |
|---|---|
| [ADR-006](adr/ADR-006-google-calendar-integration-strategy.md) | **Resuelto (2026-08-03).** Confirmada por la Dueña la opción que el arquitecto ya recomendaba — `Status: Accepted`. |
| [ADR-008](adr/ADR-008-evolution-api-whatsapp-integration.md) | **Respuesta recibida (2026-08-03), pendiente de rediseño.** La Dueña no aprobó la Opción B exclusiva — pidió ambos proveedores configurables. Se aparta del stack de referencia original en un sentido distinto al previsto; sigue `Proposed` hasta reescribir `Decision` con autorización. |
| [ADR-022](adr/ADR-022-backup-disaster-recovery-strategy.md) | Propone objetivos de RPO/RTO por defecto en ausencia de una definición de negocio formal — son un supuesto de arquitecto, no una cifra confirmada. |

## Índice completo

| # | ADR | Título | Decisión en una línea |
|---|---|---|---|
| 001 | [ADR-001](adr/ADR-001-modular-monolith-vs-microservices.md) | Modular Monolith vs. Microservices | Modular Monolith con fronteras estrictas por Bounded Context; gatillos explícitos de revisión hacia microservicios. |
| 002 | [ADR-002](adr/ADR-002-hexagonal-clean-vertical-slice.md) | Hexagonal + Clean Architecture + Vertical Slice | Dominio aislado vía puertos/adaptadores, regla de dependencia hacia adentro, capa de aplicación organizada por caso de uso. |
| 003 | [ADR-003](adr/ADR-003-cqrs-lite.md) | CQRS Lite | Modelo de lectura separado solo para Analítica y disponibilidad de Agenda; sin CQRS global; Event Sourcing rechazado explícitamente. |
| 004 | [ADR-004](adr/ADR-004-domain-events-transactional-outbox.md) | Domain Events + Transactional Outbox | Bus de eventos en memoria dentro del monolito; Outbox obligatorio para eventos con efectos externos críticos. |
| 005 | [ADR-005](adr/ADR-005-postgresql-single-database.md) | PostgreSQL como única base de datos | Un motor de base de datos, esquemas separados por Bounded Context, sin FKs entre esquemas. |
| 006 | [ADR-006](adr/ADR-006-google-calendar-integration-strategy.md) | Estrategia de integración con Google Calendar | La plataforma es la fuente de verdad; Google Calendar es una proyección de solo lectura (push unidireccional). |
| 007 | [ADR-007](adr/ADR-007-openai-as-ai-provider.md) | OpenAI como proveedor de IA | GPT/OpenAI exclusivamente para interpretación conversacional, nunca para decisiones de negocio; aislado detrás de un puerto. |
| 008 | [ADR-008](adr/ADR-008-evolution-api-whatsapp-integration.md) | Integración de WhatsApp | API oficial de WhatsApp Business Platform recomendada como primaria; Evolution API rechazada como integración principal por riesgo de continuidad. |
| 009 | [ADR-009](adr/ADR-009-multi-tenant-strategy.md) | Estrategia Multi-Tenant | Single-tenant en despliegue hoy; dominio ya "tenant-ready" vía `Sucursal`; modelo Silo como estrategia por defecto si aparece un segundo cliente. |
| 010 | [ADR-010](adr/ADR-010-security-rbac-jwt-audit.md) | Seguridad (RBAC, JWT, Audit Logs) | JWT de corta duración + Refresh Token revocable con rotación; RBAC en dos niveles; MFA obligatorio para roles elevados; auditoría append-only. |
| 011 | [ADR-011](adr/ADR-011-observability-strategy.md) | Observabilidad | OpenTelemetry como estándar vendor-neutral; correlación end-to-end; observabilidad de IA como categoría propia. |
| 012 | [ADR-012](adr/ADR-012-deployment-strategy.md) | Estrategia de despliegue | Entornos Development/Sandbox/Production; despliegue rolling/blue-green; migraciones expand/contract sin downtime. |
| 013 | [ADR-013](adr/ADR-013-error-handling-strategy.md) | Manejo de errores | Tres categorías de error (dominio, integración externa, inesperado); circuit breaker por dependencia externa; degradación a escalamiento humano. |
| 014 | [ADR-014](adr/ADR-014-api-versioning-strategy.md) | Versionado de APIs | Versionado por URI desde el primer endpoint; contratos interno y público diferenciados desde el inicio; contract-first. |
| 015 | [ADR-015](adr/ADR-015-ai-prompt-strategy.md) | Estrategia de prompts de IA | Prompts como artefacto versionado independiente del despliegue de código; sandbox y rollback obligatorios; acoplado a versión de esquema de salida. |
| 016 | [ADR-016](adr/ADR-016-human-handoff-strategy.md) | Human Handoff | Modo de conversación autoritativo revalidado antes de cada respuesta de IA; notificación con Outbox + escalamiento-de-escalamiento ante fallo de entrega. |
| 017 | [ADR-017](adr/ADR-017-file-storage-strategy.md) | Almacenamiento de archivos | Object storage privado con URLs firmadas de expiración corta; retención acotada alineada a minimización de datos personales. |
| 018 | [ADR-018](adr/ADR-018-background-jobs-strategy.md) | Background Jobs | Cola durable at-least-once, con reintento, programación/retraso, handlers idempotentes y dead-letter alertable. |
| 019 | [ADR-019](adr/ADR-019-testing-strategy.md) | Testing | Pirámide alineada a capas arquitectónicas; golden set de conversaciones de referencia para validar cambios de prompt. |
| 020 | [ADR-020](adr/ADR-020-feature-flags-strategy.md) | Feature Flags | Uso acotado a kill-switch de emergencia y rollout gradual; explícitamente no usado para configuración de negocio por sucursal. |
| 021 | [ADR-021](adr/ADR-021-idempotency-concurrency-strategy.md) | Idempotencia y Concurrencia *(agregado)* | Estrategia unificada de dos capas: idempotency key en puntos de entrada + invariante de negocio como backstop en base de datos. |
| 022 | [ADR-022](adr/ADR-022-backup-disaster-recovery-strategy.md) | Backup, DR y Retención *(agregado)* | RPO ≤ 15 min / RTO ≤ 4h como objetivo provisional; restauración probada periódicamente; retención diferenciada por clase de dato. |
| 023 | [ADR-023](adr/ADR-023-platform-architecture-model.md) | Modelo de Plataforma *(agregado)* — `Accepted` | Cuatro capas: Core Platform, Domain Policies, Client Specification, Extension Points; Core Platform depende solo de interfaces de Domain Policy; creación de Domain Policy nueva requiere criterio de evidencia explícito. |
| 024 | [ADR-024](adr/ADR-024-identidad-supabase-integration.md) | Integración de Identidad con Supabase Auth *(agregado)* | Custom Access Token Hook de Supabase para claims `rol`/`sucursales` (sin cambios a `JwtAuthGuard`); `Rol` enum estático confirmado sobre tabla `permisos` dinámica; sin tabla `refresh_tokens` propia (Supabase Auth ya gestiona rotación/revocación) — pendiente de verificar contra el proyecto Supabase real. |

## ADRs agregados fuera de la lista original

El cliente pidió señalar cualquier ADR importante que faltara en su lista de 20. Se identificaron y agregaron tres:

- **ADR-021 (Idempotencia y Concurrencia)**: el tema aparecía disperso en al menos cuatro ADRs distintos (007, 014, 005, 018) sin una decisión única que los gobernara de forma consistente — riesgo real de que cada parte del sistema resolviera "duplicados" de forma distinta.
- **ADR-022 (Backup, Disaster Recovery y Retención)**: el cliente pidió backups como parte de su inversión en seguridad, pero el Domain Discovery no obtuvo una definición de negocio de RPO/RTO. Se decidió no dejar esto implícito y proponer valores por defecto explícitos, marcados como provisionales.
- **ADR-023 (Modelo de Plataforma)**: el tema del modelo de plataforma reutilizable estaba disperso en cuatro ADRs (002, 009, 015, 020) sin una decisión única que los gobernara — mismo patrón de fragmentación que ya justificó ADR-021/ADR-022. Documento de detalle: `PLATFORM_ARCHITECTURE_MODEL.md`.
- **ADR-024 (Integración de Identidad con Supabase Auth)**: surgió de la auditoría de pre-arranque del módulo Identidad y Accesos (2026-08-11) — `ADR-010` y el código ya construido (`JwtAuthGuard`) asumían que el JWT llegaba enriquecido con `rol`/`sucursales` "emitido por Supabase Auth", sin que ningún documento explicara el mecanismo concreto. No cabía como enmienda de `ADR-010` porque resuelve tres preguntas técnicas distintas (mecanismo de claims, modelo de permisos estático vs. dinámico, destino de `refresh_tokens`) con evidencia externa propia (documentación pública de Supabase) que `ADR-010` nunca tuvo que evaluar.

## Dependencias entre ADRs (para revisión rápida)

- ADR-001 (Modular Monolith) es la base de la que dependen ADR-004 (bus en memoria en vez de broker distribuido) y ADR-005 (una sola base de datos física).
- ADR-002 (Hexagonal/Clean/Vertical Slice) es la base de la que dependen ADR-006, ADR-007 y ADR-008 (los tres puertos de integración externa) y de ADR-019 (testing sin infraestructura real).
- ADR-004 (Outbox) es reutilizado explícitamente por ADR-006 (sincronización de calendario), ADR-016 (notificación de escalamiento) y ADR-018 (background jobs).
- ADR-007 (OpenAI), ADR-015 (prompts) y ADR-016 (human handoff) forman, en conjunto, la estrategia completa de IA — deben leerse juntos, no de forma aislada.
- ADR-010 (Seguridad) y ADR-021 (Idempotencia) son transversales: no gobiernan un contexto específico, sino una propiedad exigida a todos los casos de uso con efecto de estado.
- ADR-023 (Modelo de Plataforma) extiende ADR-002 (segunda familia de puertos) y opera el "Future Revisit Criteria" de ADR-009 (concepto de Organización) — ver nota de extensión agregada en ambos.

## Próximos pasos

1. El cliente revisa y aprueba (o cuestiona) cada ADR — con atención especial a los tres marcados como prioritarios arriba.
2. Los ADRs aprobados cambian su Status de `Proposed` a `Accepted` en su archivo individual.
3. Solo entonces se continúa con `03-technical-architecture.md`, donde se seleccionan las piezas de stack técnico específico aún no decididas en este conjunto (backend de observabilidad, proveedor de hosting, librería de cola de jobs, etc.), todas ya acotadas por las decisiones congeladas aquí.
