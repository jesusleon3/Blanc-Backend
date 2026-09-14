# Implementation Readiness Review — Blanc

> **Rol de este documento:** determinar, con evidencia documental verificable y no con suposiciones, si el proyecto está preparado para pasar de diseño a construcción.
> **Alcance revisado:** el repositorio completo — `docs/requirements/`, `docs/architecture/` (incluyendo los 22 ADRs y las dos revisiones adversariales), `docs/domain-discovery/`, `docs/business-rules/`, los tres documentos de Decision Flows, `docs/functional-scope.md`, `docs/presentacion-cliente.md`, `mockup/`, y los tres HANDOFF de la raíz.
> **Fecha:** 2026-07-15.
> **Regla seguida:** no se reabre Domain Discovery, no se reabren Business Rules, no se reabre el catálogo de Decision Flows. Donde estos documentos ya identificaron un vacío, se cita esa fuente en vez de re-analizarlo.

---

## 1. Estado del proyecto por capa

Escala usada, deliberadamente cualitativa: **Completo** (el documento/artefacto existe y cubre su alcance declarado) · **Casi completo** (existe y es utilizable, con vacíos acotados y ya nombrados) · **Parcial** (existe una base real, pero falta una porción sustancial) · **Iniciado** (existe evidencia parcial, no un documento/artefacto formal) · **No iniciado** (no existe ningún artefacto).

| Capa | Estado | Evidencia (qué existe) | Qué falta |
|---|---|---|---|
| **Requisitos originales** | Completo (histórico) | `docs/requirements/blanc-requisitos-negocio.md` — no se modifica, es la fuente original | Nada — es un documento cerrado por naturaleza |
| **Functional Scope** | Completo | `docs/functional-scope.md` — 9 módulos, estructura de 9 secciones cada uno, glosario, trazabilidad | Nada estructural; se actualiza solo si cambia el alcance de negocio |
| **Domain Discovery** | Casi completo | `01-domain-discovery.md` (11 Bounded Contexts, aggregates, eventos, 18 preguntas abiertas originales), `02-domain-discovery-session-02.md` (aprobada) | El propio encabezado de `01` todavía dice "Borrador v0.1"; Sesión 02 nunca se fusionó formalmente; Sesión 03 (cambio de horario) nunca se creó — vacío ya documentado en los tres HANDOFF |
| **Principios de Arquitectura** | Completo | `02-architecture-principles.md` — 17 secciones, ADRs iniciales embebidos | Aclaración menor de redacción del principio 9.6 (ya identificada, no aplicada) |
| **ADRs** | Completo en contenido, pendiente en gobernanza | 22 ADRs + `ADR_INDEX.md` + `ARCHITECTURE_REVIEW.md` (veredicto: *Approved with Changes*) | Ningún ADR individual cambió su campo `Status` de `Proposed` a `Accepted`; `ADR-008` (WhatsApp oficial) sigue explícitamente pendiente de sign-off del cliente (señalado en `CLAUDE.md`) |
| **Domain Model (táctico)** | Parcial | `DOMAIN_MODEL_REVIEW.md` — 10 de 17 hallazgos incorporados a `01-domain-discovery.md` (Sección 5.11 consistencia entre aggregates, Sección 5.12 Notificaciones, 6 nuevas Preguntas Abiertas) | Las tres máquinas de estado (`Cita`, `Conversación`, `TicketEscalamiento`) siguen **deliberadamente sin diseñar** — es una restricción de alcance explícita del cliente, repetida en cada documento posterior, y ahora es el bloqueo más consecuente para pasar a DDL ejecutable (ver Sección 3) |
| **Business Rules** | Completo en estructura, parcial en contenido | `docs/business-rules/` — 73 reglas, 12 categorías, gobernanza activa, `99-open-questions.md` con 24 preguntas | 58 reglas `Aprobada`/`Aprobada con matiz`; 15 `Faltante`/`Pendiente`/`Asumida` — ya clasificadas, no es un vacío de proceso, es negocio pendiente de responder |
| **Decision Flows — catálogo** | Completo (congelado) | `decision-flows-catalogo-diseno.md`, `-revision-critica.md`, `-trazabilidad.md` — 21 macro-flows + 15 micro-flows, tres matrices de trazabilidad sin inconsistencias estructurales | Ninguno a nivel de catálogo |
| **Decision Flows — redacción detallada** | **No iniciado** | — | `docs/decision-flows/` **no existe como carpeta todavía** (verificado directamente); cero de los 36 flujos está redactado con la plantilla ya definida |
| **Arquitectura Técnica** | Completo en decisiones firmes, con `Decision Pending` explícitos | `03-technical-architecture.md` — stack firme en 7 de 16 subsecciones (NestJS, Next.js, Redis, Responses API, `googleapis`, GitHub Actions), 9 `Decision Pending` con recomendación razonada cada una | Cierre real de: proveedor de BD, ORM, cola de jobs, canal realtime, storage, autenticación, BSP de WhatsApp, hosting, observabilidad — todos con recomendación, ninguno cerrado en firme |
| **Diseño de Base de Datos** | Completo en modelo lógico, no iniciado en DDL | `04-data-model.md` — 11+3 esquemas, mecanismos transversales completos (Outbox, idempotencia, auditoría, feature flags, prompts), clasificación de retención | Cero sentencias `CREATE TABLE`/migraciones (fuera de alcance por diseño de ese documento); la restricción de exclusión de `agenda.citas` **no puede escribirse literalmente** hasta que exista la máquina de estados de `Cita` (riesgo 6 del propio documento, §9) |
| **APIs** | No iniciado | — | `05-api-design.md` no existe. Es el documento explícitamente señalado como "siguiente" por `03` y `04`, nunca escrito |
| **Frontend** | Iniciado (prototipo visual, sin backend) | `mockup/` — 17 pantallas HTML/CSS/JS completas, con lógica de cotización real en JS, PWA funcional | Verificado directamente en handoffs previos: `confirmarCita()` no persiste la cita creada; `HORA_SLOTS` es fijo, no calculado contra datos reales — es una demo congelada, no una base de código a extender directamente |
| **Backend** | No iniciado | — | Cero líneas de código de backend en el repositorio (confirmado: no hay `package.json`, `Dockerfile`, ni carpeta `src/`/`backend/`) |
| **Integraciones** | No iniciado en código, decidido en arquitectura | ADR-006 (Calendar), ADR-007 (IA), ADR-008 (WhatsApp) — decisión de fondo firme | Proveedor de BSP de WhatsApp sin elegir; validación en vivo de Responses API pendiente; ningún adaptador implementado |
| **Testing** | No iniciado en código, completo en estrategia | ADR-019 (pirámide + golden set), `03` §8 (aterrizaje concreto, incluye F-17 resuelto) | Cero pruebas escritas (no hay código que probar todavía); el golden set en sí no existe como artefacto (depende de que existan prompts, ADR-015) |
| **DevOps** | Parcial | CI/CD firme (GitHub Actions), 3 entornos definidos (ADR-012) | Hosting `Decision Pending`; ningún pipeline real configurado; ningún entorno aprovisionado |
| **Deployment** | No iniciado | Topología de despliegue descrita (`03` §4.3) | Cero despliegues; proveedor de hosting sin elegir |
| **Observabilidad** | Parcial (diseño) | ADR-011 + SLOs numéricos provisionales ya propuestos (`03` §6.3) | Backend de observabilidad sin elegir; cero instrumentación real; los SLOs son cifras de arquitecto, no validadas con tráfico |
| **Seguridad** | Parcial (diseño avanzado, sin implementar) | ADR-010 detallado, modelo de tokens concreto (`03` §5), segregación de secretos ya resuelta (F-13) | Cero código; `RN-SEG-03` (alcance RBAC Analista/Solo lectura) sigue `Faltante` y bloquea cerrar el modelo completo de permisos; proveedor de autenticación `Decision Pending` |

---

## 2. Inventario de documentación pendiente

Solo se incluye lo que aporta valor real de aquí a poder implementar con confianza — no se infla la lista.

| # | Documento sugerido | Propósito | Prioridad | Consume | Alimenta a | ¿Bloquea implementación? |
|---|---|---|---|---|---|---|
| 1 | **Diseño formal de las 3 máquinas de estado** (`Cita`, `Conversación`, `TicketEscalamiento`) — probablemente como adenda a `01-domain-discovery.md`, no un documento nuevo | Definir transiciones legales, disparadores, y guardas — hoy son solo enumeraciones de valores | **Crítica** | `01-domain-discovery.md`, `DOMAIN_MODEL_REVIEW.md` §4 (ya documenta *por qué* cada una la necesita, sin diseñarla) | `04-data-model.md` (restricción de exclusión ejecutable), `05-api-design.md`, todo el backend de Agenda/Conversación/Escalamiento | **Sí — bloquea implementación real de los tres módulos Core** |
| 2 | `docs/domain-discovery/03-domain-discovery-session-03.md` (cambio de horario) + fusión de Sesión 02/03 en `01` | Cerrar el desfase documental ya señalado en los tres HANDOFF | Alta | Conversación ya sostenida con la dueña (según handoffs) | `01-domain-discovery.md` consolidado | No bloquea módulos que no dependan de `SolicitudDeCambioDeHorario` — sí bloquea la aprobación plena de `FL-AGE-02`/`FL-AGE-03` |
| 3 | **`05-api-design.md`** | Contratos de request/response, versionado, autenticación de webhooks, formato de error | Alta | `03-technical-architecture.md`, `04-data-model.md` | Backend, frontend, integraciones | **Sí — sin esto no hay contrato entre frontend/backend/integraciones** |
| 4 | **`06-development-plan.md`** | Backlog/secuencia de sprints, dimensionar las 4 herramientas internas ya señaladas por F-15 | Alta | Este mismo documento (Secciones 5 y 7), `05-api-design.md` | Ejecución | No bloquea empezar los módulos de la Sección 4, sí bloquea comprometer un calendario de entregas real |
| 5 | Actualización de `04-data-model.md` con tablas de etiquetas, garantías y `SolicitudDeCambioDeHorario` | Cerrar el desfase ya señalado en `ARCHITECTURE-HANDOFF.md`/`DESIGN-PHASE-HANDOFF.md` — **verificado en esta revisión: sigue sin hacerse**, `04-data-model.md` no menciona ninguna de las tres | Media-Alta | Sesión 02 (ya aprobada), Business Rules `RN-GAR-*`, `RN-CRM-08/09` | Implementación de CRM/Garantías | No bloquea el núcleo de Agenda; sí bloquea implementar Garantías y Etiquetas con esquema real |
| 6 | Formalización de `Status: Proposed → Accepted` en los 22 ADRs, con sign-off explícito de `ADR-008` | Gobernanza — hoy el conjunto se trata como cerrado en la práctica sin que ningún archivo lo refleje | Media | `ARCHITECTURE_REVIEW.md` (veredicto ya emitido) | Ninguno técnicamente, pero es la autorización formal para construir sobre ellos | No bloquea el código en sí, sí es la autorización formal que falta |
| 7 | Los **7 candidatos a ADR/enmienda** de `03-technical-architecture.md` §11 + los **2** de `04-data-model.md` §11 (9 en total: patrón de webhook, reclamo de Outbox, retención diferenciada de IA, límite de gasto de IA, canal SSE, segregación de secretos, pruebas de fallo inyectado, reconciliación entre aggregates, frontera de `Notificacion`) | Ratificar formalmente decisiones ya recomendadas con alta confianza | Alta (los 2 marcados Critical/High en su hallazgo de origen: webhook, retención de IA) | Ambas revisiones adversariales + `03`/`04` | Implementación de Conversación, Outbox, Notificaciones | **Sí, para el patrón de webhook (F-27) y la retención de IA (F-14)** — el resto no bloquea, se puede implementar directamente contra la recomendación ya dada |
| 8 | Redacción detallada de los 36 Decision Flows en `docs/decision-flows/` | Es el objetivo ya acordado de la fase siguiente | Alta (secuenciada, no todo de golpe) | El catálogo ya congelado | Backend (casos de uso), IA (prompts), manual operativo, testing | Bloquea que "el catálogo" se convierta en comportamiento verificable — no bloquea empezar a codificar los módulos con reglas ya `Aprobadas` sin ambigüedad |
| 9 | Prompts de IA versionados (artefacto de ADR-015) | El pipeline de IA no puede operar sin al menos una versión inicial | Alta, pero solo cuando se llegue a la Fase de Conversación (Sección 7) | Business Rules `RN-CONV-*`, Decision Flows de `FL-CONV-*` una vez redactados | Módulo Conversación | Sí, pero solo para ese módulo específico — no bloquea nada anterior |
| 10 | Manual operativo | Documentación de cara al personal, generada desde los Decision Flows ya redactados | Baja | Decision Flows redactados | Capacitación de personal | No — es posterior a la implementación, no un bloqueante de diseño |

---

## 3. Decisiones abiertas

### Bloquean implementación

| Decisión | Dónde aparece | Quién debe responderla | Impacto | Prioridad |
|---|---|---|---|---|
| Diseño de las 3 máquinas de estado (`Cita`, `Conversación`, `TicketEscalamiento`) | `01-domain-discovery.md` (restricción de alcance), `DOMAIN_MODEL_REVIEW.md` §4, `04-data-model.md` §9 riesgo 6 | Arquitecto + negocio (transiciones reales) | Bloquea Agenda, Conversación, Escalamiento — los tres módulos Core | Crítica |
| `RN-SEG-03` — alcance de sucursales para Analista/Solo lectura | `99-open-questions.md#PA-19`, señalada como la de mayor impacto estructural en `DESIGN-PHASE-HANDOFF.md` | Cliente | Bloquea el modelo RBAC completo | Crítica |
| Ratificación formal del patrón de ingesta de webhook de WhatsApp (F-27) | `ARCHITECTURE_REVIEW.md` (Critical, "no negociable"), `03` §4.4, §11 candidato #1 | Arquitecto/cliente (aprobar el ADR nuevo ya recomendado) | Bloquea toda integración de WhatsApp/Conversación | Crítica |
| Política de retención diferenciada del registro de auditoría de IA (F-14) | `ARCHITECTURE_REVIEW.md` (High), `03` §6.4, §11 candidato #3 | Cliente + arquitecto (enmienda conjunta ADR-007/017/022) | Bloquea implementar el logging de decisiones de IA sin fijar una política por accidente | Alta |
| ORM (Prisma vs. Drizzle) | `03` §3.4, explícitamente diferido "al inicio de `04`" — sigue sin cerrarse | Equipo técnico | Bloquea escribir cualquier código de acceso a datos | Alta |
| Proveedor de base de datos + pregunta-paraguas del "conjunto Supabase" (§3.16) | `03` §3.3, §3.7–3.9, §3.16 | Cliente (presupuesto) + equipo | Bloquea aprovisionar el entorno de desarrollo real | Alta |
| Proveedor de autenticación | `03` §3.9 | Equipo técnico, validado contra ADR-010 | Bloquea Identidad y Accesos, y la forma final de `identidad_accesos.refresh_tokens` | Alta |
| Frontera del aggregate `Notificacion` | `04-data-model.md` §5.8, §11 candidato #2 — ambigüedad de **vehículo** de cierre (¿adenda a Domain Discovery o queda solo aquí?) | Cliente (decide el vehículo) | Bloquea implementar Notificaciones con esquema real | Media-Alta |
| Sign-off formal de `ADR-008` (WhatsApp oficial vs. Evolution API) | `CLAUDE.md`, `ADR_INDEX.md` | Cliente | Bloquea iniciar cualquier trabajo de integración de WhatsApp | Alta |

### Bloquean producción (no bloquean desarrollo)

| Decisión | Dónde aparece | Quién debe responderla | Impacto | Prioridad |
|---|---|---|---|---|
| Validación de capacidad de recepción ante escalamiento masivo simultáneo (F-05) | `ARCHITECTURE_REVIEW.md` (High), `03` §7.2 | Cliente (dato operativo real) | Sin esto, una caída de OpenAI puede colapsar la atención humana | Alta, antes de producción |
| SLOs numéricos validados con tráfico real | `03` §6.3 (valores provisionales ya dados) | Equipo, con datos de las primeras semanas | Alertas mal calibradas | Media |
| Plan de migración de los 3 números de WhatsApp existentes (F-08) | `ARCHITECTURE_REVIEW.md`, `03` §9.2 | Negocio + equipo | Riesgo de interrupción del único canal de una sucursal | Alta, antes de producción |
| Aprobación de plantillas de mensaje por Meta (F-09) | `ARCHITECTURE_REVIEW.md`, `03` §9.2 | Equipo (proceso con Meta) | Recordatorio/confirmación automática podrían no funcionar al lanzamiento si no se envía con anticipación | Media, iniciar en paralelo al desarrollo |
| Marco regulatorio de datos personales aplicable (PA-20) | `01-domain-discovery.md` Pregunta #12, `99-open-questions.md` | Cliente (asesoría legal) | Afecta plazos exactos de retención (`04` §8) — se puede desarrollar con valores conservadores provisionales | Media |
| Ventanas exactas (anticipo PA-06, lista de espera PA-23, cambio de horario PA-22, cortesía PA-24) | `99-open-questions.md` | Cliente | Se puede desarrollar con valores por defecto documentados como provisionales, sin bloquear código | Media-Baja |
| Estimación de costo de mensajería de WhatsApp oficial (F-18) | `ARCHITECTURE_REVIEW.md` | Equipo (cotización real) | Validación de presupuesto, no de arquitectura | Media |

### No bloquean nada

- Las 15 reglas `Faltante`/`Pendiente` de menor impacto del Business Rules Engine (`RN-COT-04/05/06`, `RN-GAR-04/05/06`, `RN-CRM-06/07/09`, `RN-CONV-10/11`, `RN-SUC-03`, `RN-NOT-04`) — se implementa el comportamiento ya `Aprobado` como base, y se ajusta cuando lleguen las respuestas.
- Proveedor de hosting, backend de observabilidad y BSP de WhatsApp específicos — decisiones de bajo riesgo y reversibles (`03` ya lo marca así explícitamente).
- Los tres renames diferidos (`Clienta`→`Cliente`, etc.) — explícitamente pospuestos hasta un segundo cliente real.
- Gap de "versionar/revertir prompts de IA" y exclusión de "Marcar VIP" del catálogo de Decision Flows — ya evaluados y correctamente fuera de alcance.
- Viabilidad económica del modelo Silo para futuros clientes pequeños (F-22) — especulativo, sin datos que puedan existir hoy.

---

## 4. Implementación inmediata — qué puede empezar hoy mismo

Con la documentación ya congelada, y sin esperar ninguna respuesta adicional del cliente:

- **Mecanismos transversales de plataforma**: patrón Outbox genérico (`04-data-model.md` §4.1, con `FOR UPDATE SKIP LOCKED` desde el inicio, ya recomendado), tabla y lógica de idempotencia (§4.2), log de auditoría append-only (§4.3, `FL-AUD-01`), feature flags (§4.4, ADR-020). Ninguno depende de una regla de negocio pendiente.
- **Módulo Sucursales y Personal** (`sucursales_personal`): `FL-SUC-01` (Configurar Horario y Festivos) y `FL-SUC-03` (Gestionar Personal) están al 100% de completitud en la Matriz 3 de `decision-flows-trazabilidad.md`, sin ninguna pregunta abierta que los bloquee.
- **Módulo Identidad y Accesos** (`identidad_accesos`), con una salvedad acotada: los 7 roles (`RN-SEG-01`), MFA para roles críticos (`RN-SEG-02`) y el modelo de tokens (`03` §5.1) están completamente especificados — se puede implementar todo excepto el alcance exacto de sucursales para Analista/Solo lectura (`RN-SEG-03`), que se puede tratar temporalmente como "todas las sucursales" sin bloquear el resto del módulo.
- **Módulo CRM/Clientas** (`clientas`): `FL-CRM-01` (Registrar Cliente) y `FL-CRM-03` (Bloquear/Desbloquear Cliente) están al 100%; `FL-CRM-02` (Lista Roja) y `FL-CRM-04` (Etiquetas) se pueden implementar con sus huecos ya documentados como comportamiento pendiente de ajuste, no como bloqueo.
- **Módulo Escalamiento** (`escalamiento`): `FL-ESC-02` (Atender Ticket) está al 100%; la mecánica de Human Handoff (ADR-016) está completamente diseñada.
- **Catálogo de Servicios** (`catalogo_cotizacion`, estructura base): las tablas `servicios`, `modificadores_diseno` y su relación ya están modeladas (`04` §5.2) sin bloqueo — el motor de duración por combinación específico (`RN-COT-01/02`) puede esperar a la Fase 2, pero el CRUD de catálogo no depende de nada pendiente.

**Explícitamente no listo para empezar todavía**: el núcleo transaccional de `Cita` (bloqueado por las 3 máquinas de estado), Anticipos (depende de `Cita`), Conversación/IA (depende de F-27 ratificado y de prompts versionados), Notificaciones (depende de resolver la frontera de su aggregate), Garantías (depende de que exista el evento `CitaCompletada`, es decir, de resolver primero el vacío de `RN-AGE-14`).

---

## 5. Dependencias entre módulos — roadmap técnico

```
Infraestructura
(hosting, proveedor de BD, ORM, gestor de secretos, CI/CD ya elegido)
        ↓
Mecanismos transversales
(Outbox genérico, Idempotencia, Auditoría, Feature Flags)
— no dependen de ninguna regla de negocio, solo de que exista un proceso NestJS desplegable
        ↓
Módulos de configuración base
(Sucursales y Personal, Identidad y Accesos, Catálogo — estructura)
— sin dependencias de otros módulos de negocio entre sí
        ↓
Diseño formal de las 3 máquinas de estado
(Cita, Conversación, TicketEscalamiento)
— prerrequisito explícito antes de tocar Agenda; es lógica de negocio, no de infraestructura,
  por eso se coloca aquí y no antes
        ↓
Núcleo transaccional de Agenda + Motor de Cotización completo
(Cita, no-doble-booking, disponibilidad, RN-COT-01/02 una vez resueltas PA-02/03/04)
— depende de las máquinas de estado del paso anterior para la restricción de exclusión real
        ↓
Anticipos + CRM completo
— Anticipos depende directamente de que Cita ya exista (retiene un horario real);
  CRM (clasificación) ya puede estar listo antes, pero su consecuencia sobre Agenda (RN-ANT-01) requiere que Agenda exista primero
        ↓
Notificaciones + Sincronización con Google Calendar
— ambas son consumidoras de eventos de Agenda (CitaConfirmada, CitaReagendada, CitaCancelada);
  no tiene sentido implementarlas antes de que existan esos eventos reales
        ↓
Conversación e IA
— deliberadamente después del núcleo transaccional, consistente con la recomendación de
  secuenciación de ARCHITECTURE_REVIEW.md (F-01): el bot orquesta casos de uso ya existentes,
  no tiene sentido construir el pipeline de IA antes de tener qué orquestar
        ↓
Escalamiento Humano
— depende de que Conversación exista (el modo bot/humano vive ahí)
        ↓
Garantías
— depende de que exista el evento CitaCompletada (bloqueado hoy por el mismo vacío de RN-AGE-14
  identificado en decision-flows-trazabilidad.md)
        ↓
Analítica / Dashboard
— CQRS-lite puro; solo tiene sentido una vez que TODOS los módulos anteriores ya emiten
  eventos de dominio de forma estable — construirlo antes significa proyectar datos que no existen
        ↓
Frontend completo
— puede avanzar en paralelo desde que el primer módulo expone su API (no es estrictamente
  el último paso, pero su integración final depende de que todos los endpoints existan)
        ↓
Producción
— hardening de seguridad final, SLOs validados con datos reales, plan de migración de
  WhatsApp ejecutado sucursal por sucursal (F-08), plantillas aprobadas por Meta (F-09),
  backups probados con restauración real (ADR-022, principio 12.7)
```

**Justificación de por qué esta secuencia y no otra:** cada flecha representa una dependencia real de datos o de evento de dominio, no una preferencia arbitraria — Anticipos no puede retener un horario que no existe; Notificaciones no puede reaccionar a un evento que Agenda todavía no emite; Conversación no tiene qué orquestar sin que Agenda/Catálogo/CRM ya expongan sus casos de uso; Garantías depende literalmente de un evento (`CitaCompletada`) que hoy nadie produce. Esta secuencia coincide, además, con la recomendación explícita de `ARCHITECTURE_REVIEW.md` (F-01): construir primero el núcleo transaccional simple, diferir la maquinaria de IA/Analítica hasta que haya algo real que orquestar/proyectar.

---

## 6. Riesgos técnicos

Por categoría solicitada — cada uno marcado como ya cubierto (con cita) o como hallazgo nuevo de esta revisión.

| Categoría | Estado | Evidencia / hallazgo |
|---|---|---|
| Escalabilidad | Cubierto | `02-architecture-principles.md` §13, gatillos de revisión de ADR-001; `F-26` (contención Conversación/Agenda) ya identificado, con mitigación diferida a evidencia real |
| Concurrencia | Cubierto, decisión firme | `04-data-model.md` §5.1 — restricción de exclusión + bloqueo optimista, marcada firme, no `Decision Pending` |
| Idempotencia | Cubierto | ADR-021, aterrizado en `03` §4.4 (clave = ID de mensaje de WhatsApp) y `04` §4.2 |
| Versionado | Cubierto | ADR-014 (API), ADR-015 (prompts de IA como artefacto independiente) |
| Migraciones | Cubierto | ADR-012 (expand/contract); `F-25` (falta de verificación automatizada) ya resuelto como recomendación en `03` §3.15 |
| Observabilidad | Cubierto (diseño) | ADR-011 + SLOs provisionales ya propuestos (`03` §6.3); pendiente de validación real, no de diseño |
| Resiliencia | Cubierto | ADR-013 — circuit breaker por dependencia externa, degradación a escalamiento humano |
| Manejo de errores | Cubierto | ADR-013 — tres categorías, aterrizadas en `03` §7.1 |
| Consistencia eventual | Cubierto | `01-domain-discovery.md` §5.11 (DM-01), mecanismo de reconciliación propuesto en `04` §7.1 (`Decision Pending`, candidato a ADR) |
| Seguridad | Cubierto | ADR-010, con `F-12`/`F-13` ya identificados y `F-13` ya resuelto directamente |
| Recuperación ante fallos | Cubierto | ADR-022 (RPO/RTO provisional, restauración probada periódicamente) |
| Límites de WhatsApp (costo y migración) | Cubierto | `F-08` (migración disruptiva), `F-09` (aprobación de plantillas), `F-18` (costo no estimado) |
| **Límites de WhatsApp (tasa de mensajería / tier de calidad)** | **No documentado — hallazgo nuevo** | La API oficial de WhatsApp Business Platform impone un límite de mensajes salientes por número que escala según el *tier* de calidad del número (determinado por tasa de bloqueos/quejas de clientas) — ningún documento (ADR-008, `03` §3.11, ni ningún hallazgo de `ARCHITECTURE_REVIEW.md`) menciona este límite, distinto del costo por conversación (`F-18`) ya cubierto. Es relevante porque recordatorios y confirmaciones automáticas son exactamente la categoría de mensaje "iniciado por el negocio" que consume ese cupo. **Recomendación:** documentarlo como parte del candidato a ADR de BSP (`03` §3.11) antes de estimar volumen de envío. |
| Límites de Google Calendar (adopción/hábito) | Cubierto | `F-10` (riesgo de adopción, reclasificado a High) |
| **Límites de Google Calendar (cuota de API)** | **No documentado — hallazgo nuevo** | La API de Google Calendar impone cuotas de solicitudes por proyecto/usuario en una ventana de tiempo. Ningún documento evalúa si sincronizar cada evento de `Cita` (confirmación, reprogramación, cancelación) hacia hasta 4 calendarios se acerca a esa cuota, ni define un backoff específico para un `429` de Calendar distinto del circuit breaker genérico ya cubierto por ADR-013. **Recomendación:** evaluarlo al implementar el adaptador de `sincronizacion_calendario` (`04` §5.9), no bloquea el diseño actual. |
| **Mecanismo de borrado/exportación de datos personales** | **No documentado — hallazgo nuevo** | Distinto del marco regulatorio en sí (`PA-20`, ya identificado): incluso una vez resuelto el marco legal, ningún documento diseña **cómo** se ejecutaría un borrado o exportación de los datos de una clienta específica a través de los 11+3 esquemas — la propia regla de "sin FKs cruzadas" (ADR-005) significa que un borrado en cascada no puede apoyarse en `ON DELETE CASCADE` nativo, necesitaría un mecanismo orquestado similar al job de reconciliación ya propuesto en `04` §7.1. **Recomendación:** diseñarlo junto con la resolución de `PA-20`, no antes — hoy no bloquea nada porque el marco regulatorio tampoco está confirmado. |

**No se inventaron riesgos adicionales** — la lista de categorías pedida está completa arriba; donde ya existía cobertura documental se cita la fuente exacta en vez de repetir el análisis.

---

## 7. Roadmap de implementación (fases)

### Fase 0 — Preparación
- **Objetivo:** cerrar los bloqueos reales de implementación antes de escribir código de producto.
- **Documentos de entrada:** este documento (Secciones 2 y 3), `03-technical-architecture.md`, `04-data-model.md`.
- **Entregables:** diseño formal de las 3 máquinas de estado; `05-api-design.md`; ORM y proveedor de BD elegidos; los 22 ADRs con `Status: Accepted` (incluyendo sign-off de ADR-008); resolución de `PA-19` (RBAC).
- **Criterio de salida:** cero decisiones de la columna "Bloquean implementación" (Sección 3) sin resolver.

### Fase 1 — Infraestructura y mecanismos transversales
- **Objetivo:** tener un esqueleto desplegable con los mecanismos de plataforma funcionando end-to-end.
- **Documentos de entrada:** Fase 0 ya cerrada.
- **Entregables:** proyecto NestJS desplegado en Sandbox; Outbox genérico con reclamo `FOR UPDATE SKIP LOCKED`; idempotencia; auditoría append-only; feature flags.
- **Criterio de salida:** un caso de uso de prueba (dummy) demuestra el ciclo completo: comando → evento → Outbox → efecto externo simulado → auditoría registrada.

### Fase 2 — Core del dominio (transaccional, sin IA)
- **Objetivo:** agendamiento funcional completo, operable desde el panel administrativo o una API directa, sin conversación ni IA todavía.
- **Documentos de entrada:** Decision Flows de Agenda/Catálogo/Anticipos/CRM ya redactados en detalle (priorizando los ya al 100% según `decision-flows-trazabilidad.md`).
- **Entregables:** Sucursales y Personal, Identidad y Accesos, Catálogo, Agenda (con máquina de estados ya implementada), Anticipos, CRM.
- **Criterio de salida:** una cita puede crearse, confirmarse, reprogramarse y cancelarse sin doble-booking, verificable con pruebas automatizadas contra la base de datos real.

### Fase 3 — Conversación e IA
- **Objetivo:** el mismo agendamiento de la Fase 2, ahora accesible por WhatsApp con interpretación de IA.
- **Documentos de entrada:** ratificación de F-27 (webhook) y F-14 (retención de IA) ya cerradas en Fase 0; prompts de IA versionados (ADR-015); Decision Flows de `FL-CONV-*`/`FL-ESC-*` redactados.
- **Entregables:** webhook con ack inmediato + cola idempotente; pipeline de interpretación con salida estructurada; escalamiento humano funcional; golden set inicial.
- **Criterio de salida:** una clienta puede agendar una cita completa por WhatsApp de principio a fin, con al menos un caso de escalamiento probado.

### Fase 4 — Ciclo de vida completo de la cita
- **Objetivo:** cerrar el ciclo de vida completo, no solo la confirmación.
- **Documentos de entrada:** resolución de `RN-AGE-14` (completada/no-show); frontera de `Notificacion` ya decidida.
- **Entregables:** Notificaciones (recordatorio, confirmación), Sincronización con Google Calendar, Garantías.
- **Criterio de salida:** una cita puede completarse, generar un reclamo de garantía válido, y el negocio ve el resultado reflejado en su calendario de Google.

### Fase 5 — Dashboard
- **Objetivo:** visibilidad centralizada del negocio.
- **Documentos de entrada:** todos los módulos anteriores emitiendo eventos de dominio de forma estable.
- **Entregables:** read-model de Analítica poblado, panel de KPIs.
- **Criterio de salida:** los indicadores del dashboard coinciden con los datos transaccionales reales, dentro del SLO de rezago ya definido (15 minutos, provisional).

### Fase 6 — Producción
- **Objetivo:** operar con clientas reales.
- **Documentos de entrada:** validación de capacidad humana (F-05), SLOs confirmados con datos reales, plan de migración de números ejecutado (F-08), plantillas aprobadas por Meta (F-09), backups probados.
- **Entregables:** primera sucursal en producción real, con las demás siguiendo en ventanas de baja demanda (recomendación ya dada para F-08).
- **Criterio de salida:** una sucursal opera de principio a fin sin intervención de desarrollo directa durante al menos una semana.

---

## 8. Veredicto final

### B) El proyecto necesita completar algunos documentos antes de comenzar implementación.

**Justificación con evidencia:**

No es **A)** porque existen bloqueos concretos y ya evidenciados, no hipotéticos: las tres máquinas de estado siguen sin diseño formal (restricción de alcance explícita del cliente que hoy es, literalmente, lo que impide escribir la restricción de exclusión de `agenda.citas` — `04-data-model.md` lo declara en su propio riesgo §9.6); `05-api-design.md` no existe; el ORM y el proveedor de base de datos siguen `Decision Pending` pese a que `03-technical-architecture.md` ya pidió cerrarlos "al inicio de `04`"; y `docs/decision-flows/` está vacío — verificado directamente, no asumido.

No es **C)** porque ninguno de esos vacíos es un hueco de diseño real — todos están **ya identificados, acotados y con recomendación dada** por el propio proyecto (`ARCHITECTURE_REVIEW.md`, `DOMAIN_MODEL_REVIEW.md`, y los `Decision Pending` explícitos de `03`/`04`). El razonamiento estratégico de fondo ya recibió veredicto **Approved with Changes**, no *Rejected*; el modelo de dominio táctico ya resolvió 10 de 17 hallazgos con rigor demostrado; el Business Rules Engine y el catálogo de Decision Flows están congelados sin inconsistencias estructurales. No hay evidencia de un problema de fondo — hay una lista corta y concreta de documentos/decisiones pendientes antes de empezar con coherencia.

**Matiz importante, no binario:** esto no significa que nada pueda avanzar hoy. La Sección 4 identifica módulos concretos (Sucursales y Personal, Identidad y Accesos con una salvedad acotada, CRM, Escalamiento, mecanismos transversales) que pueden empezar a construirse sin esperar ninguna respuesta adicional. Lo que bloquea un **inicio coherente del sistema completo** es una lista corta: diseñar las 3 máquinas de estado, escribir `05-api-design.md`, y cerrar ORM/proveedor de BD/autenticación — exactamente los ítems de la columna "Bloquean implementación" de la Sección 3, no una revisión adicional de lo ya diseñado.
