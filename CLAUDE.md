# CLAUDE.md

Este archivo guía a Claude Code (claude.ai/code) al trabajar en este repositorio.

## Estado del proyecto

Este repositorio está en la **fase de diseño de dominio** para "Blanc," una plataforma de agendamiento de citas para un salón de uñas de 3 sucursales (próximamente 4), impulsada por WhatsApp y asistida por IA. Todavía no existe código fuente — no hay comandos de build, lint ni test.

**Arquitectura:** propuesta y en gran parte congelada, pero **no cerrada formalmente todavía**. `docs/ARCHITECTURE_CLOSURE_PLAN.md` define los pendientes exactos (P1-P10) que faltan para el cierre — a la fecha, `P1` y `P2` están `Resueltos`; `P3`-`P10` siguen `Abierto`. No debe iniciarse implementación (Fase 1) hasta que ese documento lo autorice (su propia "Definition of Ready" es la autorización formal, no se requiere un documento adicional).

**Propagación de Discovery Checklist:** el proyecto completó una ronda de validación con la Dueña (`DISCOVERY_CHECKLIST.md`, 2026-08-03/04) que respondió 31 preguntas de negocio pendientes. Esas respuestas se están propagando sistemáticamente hacia el resto de la documentación siguiendo `docs/MASTER_PROPAGATION_PLAN.md` (documento de trabajo temporal, no funcional) — 11 de 12 pasos de ese roadmap ya están completos.

Documentación vigente (leer antes de proponer cualquier diseño o código):
- `docs/requirements/blanc-requisitos-negocio.md` — fuente oficial de requisitos de negocio/funcionales. Tratar como autoritativa; no reinterpretar sin registrar el cambio.
- `docs/architecture/01-domain-discovery.md` — DDD domain discovery (subdominios, Bounded Contexts, entidades, aggregates, domain events, preguntas abiertas). Varias decisiones de modelado siguen marcadas como preguntas abiertas — consultar la sección 2/9 de ese documento antes de asumir una respuesta.
- `docs/architecture/02-architecture-principles.md` — principios de arquitectura rectores (Modular Monolith, Hexagonal+Clean+Vertical Slices, CQRS-lite, event-driven en proceso + outbox, principios de IA/API/BD/seguridad).
- `docs/PLATFORM_ARCHITECTURE_MODEL.md` — modelo de plataforma reutilizable de 4 capas (Core Platform / Domain Policies / Client Specification / Extension Points), **congelado**, formalizado en `ADR-023`. Léase antes de clasificar cualquier regla, mecanismo o campo de configuración nuevo — el criterio de creación de una Domain Policy nueva (§3) es exigente a propósito.
- `docs/architecture/ADR_INDEX.md` y `docs/architecture/adr/ADR-001..023-*.md` — 23 Architecture Decision Records formales. La mayoría `Proposed`, pendientes de aprobación explícita del cliente, salvo `ADR-006` (`Accepted`, confirmado 2026-08-03) y `ADR-023` (`Accepted`, modelo de plataforma). **`ADR-008`** (integración de WhatsApp): la Dueña respondió (2026-08-03) pidiendo ambos proveedores (API oficial y Evolution API) disponibles como adaptadores configurables, no simultáneos — esto **no aprueba** la Decision original de esta ADR (que rechazaba Evolution API como integración principal); sigue `Proposed`, **pendiente de rediseño formal con autorización explícita**, no de una simple ratificación de `Status`. Cualquier código que viole una ADR `Accepted` necesita una ADR nueva, nunca una desviación silenciosa.
- `docs/business-rules/*.md` — Business Rules Engine (73 reglas de negocio, 12 categorías). `docs/business-rules/99-open-questions.md` consolida las preguntas de negocio que todavía bloquean el estado `Aprobada` de una o más reglas — la mayoría ya resueltas tras la validación con la Dueña.
- `docs/decision-flows-catalogo-diseno.md` — catálogo de Decision Flows (macro/micro-flujos de orquestación, `FL-XXX-NN`).
- `docs/architecture/04-data-model.md` — modelo de datos lógico.

**Stack tecnológico principal ya cerrado (`P1`, 2026-08-04):** TypeScript, NestJS, Modular Monolith, PostgreSQL, Supabase como proveedor de BD/Auth/Storage/Realtime, Drizzle ORM, Railway como hosting, OpenAI exclusivamente como intérprete con salida estructurada (nunca decide reglas de negocio — backend/dominio son la única autoridad). La elección de Supabase Auth y de Railway está cerrada, pero su **validación en producción** (rotación de refresh token con detección de reuso; despliegue rolling/blue-green) sigue pendiente como tarea de verificación de Fase 1, no como decisión abierta. Ningún modelo de datos definitivo (DDL ejecutable) ni diseño de API ha sido cerrado todavía — ver `04-data-model.md` (modelo lógico) y P8 de `ARCHITECTURE_CLOSURE_PLAN.md` (`05-api-design.md`, pendiente de redactar). La integración de WhatsApp vía BSP externo permanece sin diseñar (Fase 4, no resuelta por el cierre de `P1`) — ver `ADR-008` para la desviación (doble adaptador oficial/Evolution API) actualmente en rediseño.

Cuando inicie la implementación, reemplazar esta sección con:
- Comandos de build, lint y test (incluyendo cómo correr un test individual)
- La arquitectura de alto nivel — componentes/módulos principales y cómo interactúan
- Cualquier convención no obvia de la que dependa el código
