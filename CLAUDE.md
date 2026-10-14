# CLAUDE.md

Este archivo guía a Claude Code (claude.ai/code) al trabajar en este repositorio.

## Estado del proyecto

Blanc es una plataforma de agendamiento de citas para un salón de uñas de 3 sucursales (próximamente 4), impulsada por WhatsApp y asistida por IA. El diseño de dominio está hecho y **la implementación está en curso**: existe un backend real en `backend/` (ver la sección *Trabajar en el código* más abajo). La documentación de `docs/` sigue siendo autoritativa sobre el código en materia de reglas de negocio y decisiones de arquitectura.

**Arquitectura:** propuesta y en gran parte congelada, pero **no cerrada formalmente todavía**. `docs/ARCHITECTURE_CLOSURE_PLAN.md` define los pendientes exactos (P1-P10) que faltan para el cierre — a la fecha (2026-10-14) están `Resueltos` `P1`, `P2`, `P4`, `P7` y `P9`; `P3` está cerrado para la máquina de estados de `Cita` y solo le quedan las dos de Fase 4 (`Conversación`, `TicketEscalamiento`); siguen `Abierto` `P5`, `P6`, `P8` y `P10`. No debe iniciarse implementación (Fase 1) hasta que ese documento lo autorice (su propia "Definition of Ready" es la autorización formal, no se requiere un documento adicional).

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

**Stack tecnológico principal ya cerrado (`P1`, 2026-08-04):** TypeScript, NestJS, Modular Monolith, PostgreSQL, Supabase como proveedor de BD/Auth/Storage/Realtime, Drizzle ORM, Railway como hosting, OpenAI exclusivamente como intérprete con salida estructurada (nunca decide reglas de negocio — backend/dominio son la única autoridad). La elección de Supabase Auth y de Railway está cerrada, pero su **validación en producción** (rotación de refresh token con detección de reuso; despliegue rolling/blue-green) sigue pendiente como tarea de verificación de Fase 1, no como decisión abierta. Ningún modelo de datos definitivo (DDL ejecutable) ni diseño de API ha sido cerrado todavía — ver `04-data-model.md` (modelo lógico) y P8 de `ARCHITECTURE_CLOSURE_PLAN.md` (`05-api-design.md`, pendiente de redactar). **WhatsApp (`P7` resuelto, 2026-10-09):** se usa la **API Oficial de Meta (Cloud API) en exclusiva** (`DEC-043`, `ADR-008` `Accepted` con Enmienda 1). Esto **revierte** la petición previa de doble adaptador: las APIs no oficiales (Baileys, Evolution API) quedan descartadas por riesgo de baneo inaceptable. El canal sigue sin construir (Fase 4) y el trámite con Meta es camino crítico. Ver `docs/architecture/WHATSAPP_ARQUITECTURA_CANAL.md`.

## Trabajar en el código (`backend/`)

NestJS + TypeScript, Modular Monolith (`ADR-001`), Hexagonal + Clean + Vertical Slices (`ADR-002`), Drizzle ORM sobre PostgreSQL. **Todo comando se corre desde `backend/`.**

| Qué | Comando |
|---|---|
| Compilar | `npm run build` |
| Tipos sin emitir | `npx tsc --noEmit` |
| Tipos incluyendo config y specs | `npx tsc -p tsconfig.eslint.json` |
| Lint | `npm run lint` |
| Todas las pruebas | `npm test` |
| **Un archivo** | `npx jest ruta/al/archivo.spec.ts` |
| **Una prueba** | `npx jest ruta/al/archivo.spec.ts -t "fragmento del nombre"` |
| Generar migración | `npm run db:generate` |
| Verificar migraciones | `npx drizzle-kit check` |
| Ciclos de dependencias | `npx madge --circular --extensions ts src/` |

**Las pruebas necesitan Docker.** No hay base en memoria: `pg-mem` se eliminó tras comprobar que no soporta `tstzrange`, `EXCLUDE USING gist` ni `btree_gist` — es decir, no puede ejecutar el invariante central del sistema. Se usan **Testcontainers** con `postgres:16-alpine`: un contenedor por corrida, **una base por worker de Jest**, y **las migraciones son el DDL**. Si Docker no corre, las pruebas fallan con *"Could not find a working container runtime strategy"*; `test/global-setup.js` sondea los sockets de OrbStack/Colima/Rancher/Docker Desktop además de `/var/run/docker.sock`.

### Convenciones no obvias

- **Todo en español**: nombres de clases, métodos, variables, comentarios, mensajes de error y nombres de pruebas. Solo los términos técnicos aceptados quedan en inglés.
- **Un esquema de PostgreSQL por Bounded Context, y NUNCA una FK cruzada entre esquemas** (`ADR-005`). Las referencias entre contextos son `uuid` sin FK. Dentro del mismo esquema, las FK sí son legítimas.
- **Ningún Bounded Context importa a otro.** El puerto se define en el módulo que **consume** y el adaptador vive en `modules/integracion/` (`@Global`). Un `import` directo crearía un ciclo que `madge` marca.
- **Las `EXCLUDE USING gist` y los `CHECK` están escritos a mano en las migraciones** porque Drizzle no sabe expresarlos, y **no están en su snapshot**. Quien cambie la lista de estados de `Cita` debe editar el array de TypeScript, el `CHECK` y el `WHERE` de las dos `EXCLUDE`. Lo vigila `src/database/schema/deriva-restricciones-agenda.spec.ts`, que compara `pg_constraint` contra los arrays de TS — si deriva, falla.
- **Los rangos horarios son `tstzrange` con fin exclusivo `[inicio, fin)`**, para que dos citas consecutivas no choquen.
- **El horario del negocio es hora de pared**, no instantes: ver `ZONA_HORARIA_NEGOCIO` en `motor-disponibilidad.ts`.
- **Toda escritura va dentro de `UnitOfWork` y registra en `AuditoriaPort`** (`RN-AUD-01`). El `detalle` de auditoría **nunca** lleva PII de la clienta. Las llamadas HTTP van **fuera** de la transacción.
- **`@Roles` se declara por método, no por clase.** Sin decorador, `RolesGuard` deja pasar a cualquier autenticado: **toda ruta nueva debe declarar el suyo**.
- **Los errores de dominio son `DomainError`** y los traduce `HttpExceptionFilter` (`ADR-013`). Nunca se deja escapar un error crudo de PostgreSQL: se traduce por SQLSTATE (`23505` → unicidad, `23P01` → exclusión).
- **El dinero son `Centavos`**, un *branded type* (`RN-COT-07`). Nunca un `number` suelto ni coma flotante.
- `jose` está fijado en `^5.10.0` **a propósito**: la v6 es solo ESM y rompe el runtime CommonJS.

### Antes de dar por terminado un cambio

`npx tsc --noEmit`, `npm run lint`, `npm run build`, `npx drizzle-kit check`, `npx madge --circular --extensions ts src/` y `npm test` — los seis en verde. **No apliques migraciones a ninguna base de datos real**: eso es actividad de despliegue (Fase 7).
