# Implementation Master Plan — Blanc

> **Estándar de este documento:** el mismo de `ARCHITECTURE_REVIEW.md`, `DOMAIN_MODEL_REVIEW.md` e `IMPLEMENTATION_READINESS_REVIEW.md` — evidencia documental, intento explícito de refutación antes de cada recomendación, ningún hallazgo aceptado por comodidad.
> **Fecha:** 2026-07-16.
> **Relación con el resto del repositorio:** este documento no reabre Domain Discovery, Business Rules, ni el catálogo de Decision Flows — los consume como entrada. Sí **corrige** la secuenciación implícita de `IMPLEMENTATION_READINESS_REVIEW.md` §7 donde el análisis adversarial de este documento encuentra evidencia de que esa secuencia era subóptima (ver Sección 5).
> **Este documento resuelve formalmente F-01** (`ARCHITECTURE_REVIEW.md`, Critical: "el conjunto acumulado de patrones... nadie evaluó el costo acumulado... se recomienda una decisión de secuenciación de implementación") — es, en la práctica, el artefacto que F-01 pedía y que ningún documento anterior había producido todavía.
> **Revisión 2026-08-04 — Arranque parcial controlado:** ver enmienda completa al final de la descripción de Fase 0 (Sección 6). Autoriza explícitamente que **Sucursales y Personal, Identidad y Accesos, y Catálogo y Cotización** inicien construcción en paralelo al cierre del resto de Fase 0 — no reordena ni omite ninguna fase de la Sección 6, no declara Fase 0 cerrada, no cierra ninguna decisión todavía pendiente. Esta revisión **es** la nueva versión de este documento que la propia Declaración de cierre exige antes de desviarse del orden original.

---

## 1. Objetivo del documento

**Qué gobierna:** el orden exacto, las dependencias, los criterios de entrada/salida de cada fase, y las reglas de decisión durante toda la construcción de Blanc, desde el primer commit hasta la primera sucursal en producción real.

**Qué NO gobierna:** no redefine ninguna decisión de dominio (`01-domain-discovery.md`), ninguna regla de negocio (`docs/business-rules/`), ningún flujo del catálogo congelado (`docs/decision-flows-catalogo-diseno.md`), ni ninguna decisión arquitectónica ya cerrada en firme por un ADR. Donde este documento necesita una decisión que ningún ADR cerró (ej. secuenciación), lo señala explícitamente como una decisión nueva de este documento, no como una reinterpretación de uno existente.

**Cómo debe usarse durante el desarrollo:** es la referencia obligatoria antes de empezar cualquier módulo nuevo. Un desarrollador o equipo no decide por su cuenta "qué construyo ahora" — lo consulta aquí. Si la realidad del desarrollo contradice una fase o un orden de este documento, **el documento se actualiza primero** (o se abre un ADR si la contradicción es arquitectónica), y solo después continúa el trabajo — nunca al revés.

---

## 2. Principios de implementación

Derivados de la arquitectura ya congelada, no copiados de una lista genérica — cada uno cita el ADR/principio del que se deriva.

1. **Domain First, Infrastructure Just-In-Time (no "Infrastructure Last" a secas).** ADR-002 exige que el dominio no dependa de infraestructura. Pero ADR-004 es explícito en que la clasificación de qué evento necesita Outbox "se revisa explícitamente en el diseño técnico de cada caso de uso, no se asume por defecto" — es decir, el propio ADR-004 rechaza que el Outbox se construya de forma especulativa antes de que exista un caso de uso real que lo necesite. Este documento adopta el principio con esa precisión: la infraestructura transversal (Outbox, idempotencia, auditoría) se construye **la primera vez que un módulo real la necesita**, no como una fase previa contra un caso de uso ficticio (ver Sección 5, hallazgo adversarial #1).
2. **Vertical Slice también en el proceso, no solo en el código.** ADR-002 organiza la capa de aplicación por caso de uso. Este documento extiende el mismo principio a la planificación: cada módulo se completa de punta a punta (dominio → aplicación → adaptador → prueba) antes de pasar al siguiente, en vez de construir "todo el dominio de todos los módulos" y después "toda la infraestructura de todos los módulos".
3. **Contract First dentro de cada módulo, no antes de que exista ningún módulo.** ADR-014 exige contract-first — pero un contrato de API sin un caso de uso real detrás es un contrato inventado. Este documento define contract-first como: el contrato de un módulo se diseña antes de escribir su implementación, no antes de que exista el módulo (ver Sección 10).
4. **Ningún patrón se construye dos veces contra el vacío.** Si un mecanismo (máquina de estados, Outbox, idempotencia) puede diseñarse una sola vez bien, en vez de una vez especulativa y otra vez real, se posterga hasta el punto donde solo hace falta diseñarlo una vez (Sección 5).
5. **CI/CD y observabilidad desde el primer commit, sin excepción.** ADR-011 es explícito: "instrumentar después... es costosa e incompleta". A diferencia del Outbox (que espera al primer caso de uso real que lo necesite), la instrumentación (logs estructurados, ID de correlación, métricas) se exige desde el primer módulo, aunque ese módulo no tenga todavía un backend de observabilidad conectado (ADR-011 ya lo desacopla: vendor-neutral, se conecta el backend después sin reinstrumentar).
6. **Migraciones expand/contract desde la primera migración, no desde que "empiece a doler".** ADR-012 lo exige de forma transversal; no hay una fase donde esto no aplique.
7. **Idempotencia por defecto en todo punto de entrada con efecto de estado, desde su primera versión.** ADR-021 declara "at-least-once" como la norma, no la excepción — ningún caso de uso se construye asumiendo "esto no se va a duplicar", ni siquiera en su primera versión interna sin IA ni webhooks todavía.
8. **Feature flags solo para kill-switch y rollout gradual — nunca como atajo de secuenciación.** ADR-020 ya lo prohíbe explícitamente para configuración de negocio; este documento añade: tampoco se usan flags para "activar un módulo a medio construir" como sustituto de terminarlo — un módulo entra a Sandbox terminado, o no entra.
9. **Ninguna fase se cierra con una máquina de estados, un invariante crítico o una idempotency key "pendiente de después".** Es exactamente el patrón que `DOMAIN_MODEL_REVIEW.md` y `ARCHITECTURE_REVIEW.md` (F-01, F-02) ya identificaron como el riesgo sistémico de este proyecto — el "de después" bajo presión de entrega es donde ya se sabe que la disciplina se erosiona.
10. **Todo Decision Flow se redacta lo más tarde posible sin bloquear su propia implementación, nunca antes.** Desarrollado en la Sección 11 — es el principio con más tensión respecto al instinto de "documentar todo primero", y por eso se justifica aparte con detalle.

---

## 3. Estado actual del proyecto — evaluación ejecutiva

(Detalle completo ya está en `IMPLEMENTATION_READINESS_REVIEW.md` §1 — no se repite aquí, solo el resumen que este documento necesita para decidir secuencia.)

- **Diseño de dominio y reglas:** congelado (Domain Discovery con vacíos ya acotados, 73 Business Rules, 36 Decision Flows). Ningún hueco restante es estructural — todos son preguntas de negocio o decisiones técnicas ya identificadas.
- **Arquitectura:** 22 ADRs con contenido completo y veredicto *Approved with Changes*; ninguno formalmente `Accepted` todavía; 9 candidatos a ADR/enmienda sin ratificar.
- **Diseño técnico y de datos:** completos en su nivel lógico (`03`, `04`), con `Decision Pending` explícitos y acotados.
- **Construcción real:** cero — sin backend, sin frontend real, sin infraestructura desplegada, sin `docs/decision-flows/` redactado, sin `05-api-design.md`.
- **Conclusión ejecutiva:** el proyecto tiene el diseño más maduro posible para el punto donde "cero código" sigue siendo cierto. El riesgo ya no es de diseño — es de **secuenciación de la construcción**, que es exactamente lo que este documento resuelve.

---

## 4. Mapa completo de dependencias

### 4.1 Dependencias funcionales (módulo → módulo)

```
Sucursales y Personal ──┐
                         ├──> Catálogo y Cotización (override por sucursal, RN-COT-08)
Identidad y Accesos ─────┘

Sucursales y Personal ──┐
Catálogo y Cotización ──┼──> Agenda (Cita) ──┬──> Anticipos (integración vía eventos)
Identidad y Accesos ─────┘   (requiere las    │
                              3 máquinas de   ├──> Notificaciones (consume CitaConfirmada/
                              estado, §5)      │     Reagendada/Cancelada)
                                               │
                                               ├──> Sincronización de Calendario (consume
                                               │     los mismos eventos)
                                               │
                                               └──> Conversación e IA (adaptador driving
                                                     SOBRE los casos de uso de Agenda/
                                                     Catálogo/CRM — ADR-002, dependencia
                                                     estructural, no de conveniencia)

Agenda + Conversación ──> Escalamiento Humano (el modo bot/humano vive en Conversación,
                           ADR-016)

Agenda + Conversación ──> Garantías (necesita CitaCompletada [bloqueado hasta resolver
                           DD-Pregunta#15] Y el canal conversacional para el reporte)

TODOS los módulos anteriores ──> Analítica (CQRS-lite puro, proyecta eventos ya estables)
```

### 4.2 Dependencias técnicas (decisión → módulo)

| Decisión técnica | Bloquea |
|---|---|
| ORM + proveedor de BD | Cualquier módulo con persistencia — es decir, todos |
| Máquinas de estado de `Cita`/`Conversación`/`TicketEscalamiento` | Agenda, Conversación, Escalamiento respectivamente |
| Proveedor de autenticación | Identidad y Accesos, y la sección de auth de `05-api-design.md` |
| Ratificación de F-27 (webhook) + cola de background jobs | Conversación (integración real de WhatsApp) |
| Prompts versionados (ADR-015) + golden set (ADR-019) | Conversación (sin esto, no hay pipeline de IA funcional que probar) |
| `RN-SEG-03` (alcance RBAC, `PA-19`) | Identidad y Accesos (modelo de permisos completo), `05-api-design.md` (claims de token) |
| Trámite de verificación de negocio ante Meta | Conversación — **pero el trámite en sí no depende de nada técnico y debe iniciarse mucho antes de que el módulo se construya** (ver Sección 5, hallazgo adversarial #4) |

### 4.3 Lo que el mapa anterior (`IMPLEMENTATION_READINESS_REVIEW.md` §5) no hizo explícito

El mapa de esa revisión era una **cadena lineal estricta** (Infraestructura → transversales → configuración → Agenda → Anticipos/CRM → Notificaciones/Calendar → Conversación → Escalamiento → Garantías → Analítica → Frontend → Producción). El análisis de dependencias de arriba muestra que **no es una cadena, es un grafo con ramas paralelas reales** — corregido en la Sección 5.

---

## 5. Estrategia completa de implementación — con destrucción adversarial del roadmap anterior

Cuatro intentos de refutación contra la secuencia ya propuesta, cada uno con su resultado (algunos sobreviven, algunos no):

### Hallazgo adversarial #1 — "Infraestructura primero" contradice a ADR-004, se elimina como fase propia

El roadmap anterior proponía una Fase 1 de "mecanismos transversales" (Outbox, idempotencia, auditoría) construida contra "un caso de uso de prueba (dummy)" antes de tocar ningún módulo real. Esto **contradice directamente ADR-004**, que exige que la clasificación de qué necesita Outbox se decida "en el diseño técnico de cada caso de uso... no se asume por defecto". Construir el patrón contra un caso ficticio arriesga exactamente lo que ADR-004 marca como riesgo: una abstracción que no se valida contra una necesidad real hasta que ya está "terminada" y hay que retocarla.

**Corrección:** no existe una fase de "infraestructura transversal" aislada. Outbox, idempotencia y auditoría se construyen **la primera vez que un módulo real los necesita** — que resulta ser, casi de inmediato, al construir Agenda (porque `CitaConfirmada` dispara notificación y sincronización de calendario, los efectos externos críticos que ADR-004 nombra explícitamente). Sucursales/Identidad/Catálogo, que van antes, **no necesitan Outbox real** (no producen efectos externos críticos) — solo necesitan la conexión a base de datos y el logging estructurado (ADR-011, exigido desde el commit 1, sin excepción). Esto **elimina una fase completa** del roadmap anterior sin perder nada — el trabajo se hace una sola vez, en el lugar donde de verdad se necesita.

### Hallazgo adversarial #2 — Catálogo depende de Sucursales, no es independiente

El roadmap anterior trataba "Sucursales y Personal, Identidad y Accesos, Catálogo" como un bloque intercambiable. `04-data-model.md` §5.2 modela `servicio_sucursal_override` con referencia a `sucursal_id` — aunque no hay FK cruzada (ADR-005), la tabla no tiene sentido de negocio sin que `Sucursales` ya exista y tenga datos reales. **Corrección:** dentro del "núcleo de configuración", el orden real es Sucursales y Personal → (Identidad, en paralelo) → Catálogo, no los tres en cualquier orden.

### Hallazgo adversarial #3 — Intenté refutar el orden "Core antes que IA" y sobrevivió, pero por una razón más fuerte que la ya dada

Se intentó proponer una alternativa de "slices verticales de negocio completos" (ej. construir "Agendar Cita" de punta a punta, incluyendo IA, antes que Anticipos/Notificaciones) para reducir el riesgo de descubrir tarde problemas de integración con IA. **La alternativa se descarta, pero no por preferencia — por una dependencia estructural real**: ADR-002 declara explícitamente que `Conversación` es "un adaptador *driving* sobre los casos de uso de `Agenda`, `Catálogo y Cotización`, `Clientas`, etc. — nunca al revés". Esto no es una recomendación de orden, es una relación de dependencia arquitectónica: `Conversación` invoca casos de uso que deben existir primero. El orden **Core (sin IA) → Conversación (IA)** sobrevive esta revisión, con una razón más sólida que la que tenía el documento anterior.

**Pero el ejercicio sí encontró algo real:** el roadmap anterior implicaba que *todo* "Core" (Agenda + Anticipos + CRM + Notificaciones + Calendar + Garantías) debía completarse antes de empezar Conversación. El mapa de dependencias (Sección 4.1) muestra que **eso es falso** — la primera capacidad de Conversación ("Agendar Cita Nueva") solo depende de Agenda + Catálogo + CRM (registrar cliente) + un esqueleto de Escalamiento (para el camino de interrupción). **Notificaciones y Sincronización de Calendario pueden construirse en paralelo con las primeras semanas de Conversación**, no antes — reduce el camino crítico real. **Garantías no puede paralelizarse con Conversación** porque depende de Conversación misma (el canal de reporte, según `FL-GAR-01` invoca `FL-CONV-01`) además de depender de `CitaCompletada`.

### Hallazgo adversarial #4 — el roadmap anterior no distinguió "cuándo se necesita" de "cuándo se debe iniciar el trámite"

`ADR-008` dice textualmente: *"se recomienda iniciar el proceso de verificación de negocio en paralelo a las primeras fases de desarrollo, no al final"*. `ARCHITECTURE_REVIEW.md` (F-09) dice lo mismo de las plantillas de mensaje de Meta. El roadmap anterior colocaba ambos trámites dentro de la Fase 3 (Conversación), donde se **necesitan técnicamente** — pero un trámite de aprovisionamiento con Meta toma semanas y no depende de que exista una sola línea de código. **Corrección:** el trámite de verificación de negocio ante Meta y el envío de plantillas a aprobación se inician en la Fase 0/1 de este documento, en paralelo con el diseño de las máquinas de estado — no cuando Conversación empieza a construirse. Es, con diferencia, el cuello de botella de mayor duración real de todo el proyecto que no es técnico.

**Conclusión de la destrucción adversarial:** el roadmap anterior no estaba mal en su forma general (fases, ir de lo simple a lo complejo), pero sí en tres puntos concretos: una fase de infraestructura especulativa que se elimina, un orden interno del núcleo de configuración no explicitado, y dos trámites de plazo largo colocados demasiado tarde. Ninguno de los tres invalida la arquitectura de fondo — los tres se corrigen en el roadmap de la Sección 6.

---

## 6. Roadmap definitivo

*(Fase 0 ya fue diseñada con detalle operativo en la sesión de Architecture Review Board previa a este documento — se referencia, no se repite palabra por palabra, y se corrige donde la Sección 5 encontró algo nuevo.)*

### Fase 0 — Cierre de artefactos arquitectónicos
- **Objetivo:** que ningún artefacto de diseño quede pendiente antes de escribir el primer módulo.
- **Prerrequisitos:** ninguno — es el punto de partida.
- **Entregables:** las 3 máquinas de estado diseñadas (con la corrección de que `TicketEscalamiento` se diseña primero, sin esperar nada — hallazgo ya identificado en la sesión de ARB anterior); `05-api-design.md`; ORM y proveedor de BD cerrados; `RN-SEG-03` resuelta; ADRs candidatos ratificados; **inicio del trámite de verificación de negocio ante Meta y envío de plantillas a aprobación** (corrección de esta sesión, hallazgo #4).
- **Criterios de entrada:** ninguno.
- **Criterios de salida:** cero decisiones "Bloquean implementación" abiertas (`IMPLEMENTATION_READINESS_REVIEW.md` §3); trámite de Meta ya iniciado (no necesariamente completado).
- **Riesgos:** que el cliente tarde en responder las preguntas de negocio y el equipo sienta presión de empezar a codificar Agenda sin las máquinas de estado cerradas — **prohibido explícitamente por este documento** (ver declaración de cierre).
- **Documentos afectados:** todos los de arquitectura; ninguno de dominio/reglas/flujos se reabre.
- **Paralelización:** alta — la mayoría de los ítems de Fase 0 son independientes entre sí (ya detallado en la sesión de ARB previa).

#### Enmienda 2026-08-04 — Arranque parcial controlado

**Naturaleza de esta enmienda:** no reordena la Sección 6, no omite ninguna fase, no declara Fase 0 cerrada, no cierra ninguna decisión de negocio ni de arquitectura pendiente. Formaliza, con evidencia ya verificada de ausencia de dependencia real (Secciones 4 y 7 de este mismo documento), que tres módulos de Fase 1 pueden iniciar construcción **en paralelo** al resto de Fase 0, en vez de esperar su cierre completo. Es la revisión que la Declaración de cierre de este documento exige antes de desviarse del orden original.

**Qué partes de Fase 0 siguen pendientes (sin cambio por esta enmienda):**
- Máquina de estados de `Cita` — bloqueada por una decisión de negocio todavía sin responder (disparador exacto de `completada`, `OWNER_DECISION_LOG.md` Pregunta 2).
- Máquina de estados de `Conversación` — bloqueada por otra decisión de negocio todavía sin responder (reseteo de `modo` tras inactividad, `OWNER_DECISION_LOG.md` Pregunta 1).
- Máquina de estados de `TicketEscalamiento` — sin decisión de negocio pendiente, pero **todavía sin diseñar**; esta enmienda no la diseña ni la da por hecha.
- `05-api-design.md` — existe ya como documento (ver Sección 10 actualizada), pero solo con las convenciones transversales necesarias para los tres módulos de esta enmienda; los contratos de Agenda, Conversación, WhatsApp, Notificaciones, Sincronización de Calendario y Garantías siguen sin diseñarse, por diseño.
- Los 9 candidatos a ADR/enmienda (`03-technical-architecture.md` §11, `04-data-model.md` §11) — ninguno ratificado.
- Sign-off formal de `ADR-008` — sigue pendiente de rediseño con autorización explícita.
- Inicio del trámite de verificación de negocio ante Meta — estado no confirmado por ningún documento.

**Qué módulos pueden comenzar independientemente (autorizado por esta enmienda):** **Sucursales y Personal**, **Identidad y Accesos** (capa de dominio y aplicación; el adaptador de infraestructura ya tiene proveedor elegido — `P1` — aunque su validación en producción sigue pendiente como tarea de esta misma fase, no como bloqueo de inicio) y **Catálogo y Cotización** (CRUD completo más el motor de duración con el fallback aditivo ya documentado para las celdas todavía sin valor exacto de `RN-COT-04`). Los tres ya estaban identificados en la Sección 7 como los únicos sin dependencia de ningún otro módulo de negocio — esta enmienda no cambia esa Sección, solo autoriza actuar sobre ella sin esperar el resto de Fase 0.

**Qué módulos siguen bloqueados:** Agenda (depende de la máquina de estados de `Cita`), Anticipos y CRM (dependen de que Agenda exista, Sección 7), Conversación e IA (depende de Agenda/Catálogo/CRM y de `ADR-008`), Notificaciones y Sincronización de Calendario (dependen de eventos de Agenda), Escalamiento Humano (depende de Conversación), Garantías (depende de Conversación y del evento `CitaCompletada`), Analítica (depende de que todos los anteriores emitan eventos estables).

**Decisiones que siguen siendo necesarias antes de Agenda:**
- Pregunta 2 (`OWNER_DECISION_LOG.md`) — disparador de `completada`, para cerrar la máquina de estados de `Cita`.
- `P4` de `ARCHITECTURE_CLOSURE_PLAN.md` — invariante de capacidad para citas sin manicurista asignada (decisión de negocio todavía sin una pregunta formal en `OWNER_DECISION_LOG.md` — se señala aquí como hallazgo, no se agrega a ese documento en esta enmienda).
- Ratificación de F-03 (mecanismo de reclamo del Outbox) — nace exactamente en este módulo, según el hallazgo adversarial #1 de la Sección 5.
- `P5` — corrección de la fila circular `FL-ANT-01`↔`FL-AGE-09` en `decision-flows-catalogo-diseno.md`, relevante antes de que Anticipos consuma la disponibilidad de Agenda.

**Decisiones que siguen siendo necesarias antes de Conversación/WhatsApp:**
- Pregunta 1 (`OWNER_DECISION_LOG.md`) — reseteo de `modo`, para cerrar la máquina de estados de `Conversación`.
- Sign-off/rediseño formal de `ADR-008` (doble adaptador WhatsApp).
- Ratificación de F-27 (webhook), F-14 (retención de IA), F-07 (límite de gasto de IA), F-11 (canal de handoff — su contenido debe actualizarse para reflejar Supabase Realtime, ya elegido en `P1`).
- Prompts de IA versionados (`ADR-015`) y avance suficiente del trámite de verificación ante Meta.

### Fase 1 — Núcleo de configuración
- **Objetivo:** un backend real, desplegado en Sandbox, con los módulos que no dependen de nada más.
- **Prerrequisitos:** Fase 0 cerrada — **con la excepción explícita de la Enmienda 2026-08-04** (arriba): Sucursales y Personal, Identidad y Accesos, y Catálogo y Cotización pueden iniciar sin esperar el cierre completo de Fase 0. El resto de los entregables de Fase 1 (si los hubiera más allá de estos tres módulos) sigue sujeto al prerrequisito original.
- **Entregables:** Sucursales y Personal → Identidad y Accesos (en paralelo con Sucursales) → Catálogo (después de Sucursales, hallazgo #2). Logging estructurado con ID de correlación desde el primer commit (principio 5). Sin Outbox real todavía (hallazgo #1) — no hace falta.
- **Criterios de entrada:** Fase 0 cerrada; proveedor de hosting elegido (bajo rigor, ver `IMPLEMENTATION_READINESS_REVIEW.md`).
- **Criterios de salida:** los tres módulos operables vía API/admin directo (sin IA), con pruebas de dominio pasando, desplegados en Sandbox.
- **Riesgos:** ninguno arquitectónico significativo — es, deliberadamente, la fase de menor riesgo del proyecto.
- **Paralelización:** Identidad y Personal en paralelo; Catálogo después de Personal.

### Fase 2 — Núcleo transaccional de Agenda
- **Objetivo:** agendamiento completo, sin doble-booking, operable manualmente (sin IA).
- **Prerrequisitos:** Fase 1 cerrada; máquina de estados de `Cita` cerrada en Fase 0.
- **Entregables:** módulo Agenda completo (`FL-AGE-*` redactados justo antes, Sección 11); Outbox real (nace aquí, hallazgo #1); restricción de exclusión + bloqueo optimista implementados y probados con concurrencia real (no solo unitarios).
- **Criterios de entrada:** máquina de estados de `Cita` existe y está documentada.
- **Criterios de salida:** una cita puede crearse, confirmarse, reprogramarse y cancelarse por API/panel manual, sin doble-booking verificado con pruebas de concurrencia reales.
- **Riesgos:** es el módulo de mayor riesgo técnico puro (concurrencia) — mitigado por ADR-005 ya dar el mecanismo firme.
- **Paralelización:** ninguna — es secuencial por definición (todo lo posterior depende de este módulo).

### Fase 3 — Anticipos y CRM
- **Objetivo:** cerrar el ciclo económico y de clasificación de clientas sobre Agenda ya funcional.
- **Prerrequisitos:** Fase 2 cerrada.
- **Entregables:** Anticipos (integración vía eventos con Agenda ya reales); CRM completo (clasificación, etiquetas).
- **Criterios de salida:** un cliente de riesgo puede agendar con anticipo, con liberación automática si no paga, verificado end-to-end.
- **Paralelización:** Anticipos y CRM pueden avanzar en paralelo entre sí (esquemas distintos, sin dependencia mutua directa más allá de consultar clasificación).

### Fase 4 — Conversación e IA (inicio) + Notificaciones/Calendar en paralelo
- **Objetivo:** el mismo agendamiento, ahora por WhatsApp con IA — y, en paralelo, cerrar la mecánica de notificaciones y calendario que no dependen de IA (hallazgo #3).
- **Prerrequisitos:** Fase 2 cerrada (no hace falta Fase 3 completa — ver Sección 4.1); ratificación de F-27; prompts versionados + golden set inicial; trámite de Meta ya avanzado desde Fase 0.
- **Entregables:** webhook con ack inmediato + cola idempotente; pipeline de interpretación; Escalamiento Humano; **en paralelo:** Notificaciones (recordatorio/confirmación) y Sincronización con Google Calendar, consumiendo eventos de Agenda ya estables desde la Fase 2.
- **Criterios de salida:** una clienta agenda una cita completa por WhatsApp de principio a fin; en paralelo, las citas ya se reflejan en Google Calendar y generan recordatorios, de forma independiente de si la cita se originó por IA o por panel manual.
- **Riesgos:** es donde más candidatos a ADR convergen (F-27, F-14, límite de gasto) — deben estar ratificados desde Fase 0, no descubrirse aquí.
- **Paralelización:** alta, entre Conversación/Escalamiento por un lado y Notificaciones/Calendar por otro.

### Fase 5 — Garantías
- **Objetivo:** cerrar el ciclo de vida completo de una cita.
- **Prerrequisitos:** Fase 4 completa (Conversación **y** el evento `CitaCompletada` ya resuelto en Fase 0/2 — es el único módulo que depende de Conversación misma, hallazgo #3).
- **Entregables:** módulo Garantías completo.
- **Criterios de salida:** un reclamo de garantía se valida automáticamente y se envía a revisión humana, verificado end-to-end.

### Fase 6 — Analítica / Dashboard
- **Objetivo:** visibilidad centralizada.
- **Prerrequisitos:** todos los módulos anteriores emitiendo eventos estables.
- **Entregables:** read-model de Analítica, dashboard de KPIs.
- **Criterios de salida:** KPIs coinciden con datos reales dentro del SLO de rezago provisional (15 min).

### Fase 7 — Frontend completo y hardening de Producción
- **Objetivo:** operar con clientas reales.
- **Prerrequisitos:** todos los módulos con API expuesta; SLOs validados; plan de migración de números ejecutado; backups probados.
- **Entregables:** frontend completo conectado a todos los módulos; primera sucursal en producción, resto siguiendo en ventanas de baja demanda (F-08).
- **Criterios de salida:** una sucursal opera de principio a fin sin intervención de desarrollo directa durante al menos una semana.

*(Nota: el frontend, aunque aparece como entregable principal en Fase 7, se construye de forma incremental desde la Fase 1 — cada módulo expone su API y el frontend correspondiente puede avanzar en paralelo desde ese momento; Fase 7 es su integración y hardening final, no el único punto donde se escribe código de frontend.)*

---

## 7. Orden exacto de implementación de módulos

Derivado estrictamente del grafo de la Sección 4, no de intuición:

1. **Sucursales y Personal** — no depende de nada; todo lo demás depende de que existan sucursales reales.
2. **Identidad y Accesos** — en paralelo con (1); no depende de datos de negocio, solo de la infraestructura de auth ya elegida en Fase 0.
3. **Catálogo y Cotización** — depende de (1) por la referencia de override de sucursal.
4. **Agenda** — depende de (1), (2), (3), y de la máquina de estados de `Cita` (Fase 0). Es el módulo bisagra: todo lo posterior depende de él.
5. **Anticipos** y **CRM** — en paralelo entre sí; ambos dependen de (4).
6. **Conversación e IA** — depende de (4) y de (3)/(5) para tener casos de uso reales que orquestar (ADR-002); no depende de Notificaciones ni de Calendar.
7. **Notificaciones** y **Sincronización de Calendario** — en paralelo entre sí y en paralelo con (6); dependen solo de (4), no de (6).
8. **Escalamiento Humano** — depende de (6) (el modo bot/humano vive en `Conversación`).
9. **Garantías** — depende de (6) y de que `CitaCompletada` ya exista (resuelto en Fase 0/2); es el único módulo con dependencia directa sobre Conversación además de Agenda.
10. **Analítica** — depende de que (1)–(9) ya emitan eventos estables; va al final por definición (CQRS-lite puro).

---

## 8. Strategy by Module

| Módulo | Objetivo | Dependencias | Orden | Riesgos | Definition of Done | Pruebas mínimas |
|---|---|---|---|---|---|---|
| Sucursales y Personal | Configuración real por sucursal | Ninguna | 1 | Bajo | CRUD completo, `FL-SUC-*` implementados, auditado | Unitarias de dominio; integración de API |
| Identidad y Accesos | Auth + RBAC + MFA | Proveedor de auth (Fase 0) | 2 (paralelo con 1) | Medio (riesgo asimétrico ya señalado en ADR-010) | Login, roles, MFA para roles críticos, revocación de refresh token verificada en vivo | Unitarias; prueba de revocación/rotación real contra el proveedor elegido |
| Catálogo y Cotización | Servicios/modificadores + overrides | (1) | 3 | Bajo (motor de duración completo espera `PA-02/03/04`, no bloquea el CRUD base) | CRUD de catálogo funcional; motor de duración con las tablas ya conocidas, huecos marcados explícitamente | Unitarias exhaustivas del cálculo de cotización (Domain, sin infra) |
| Agenda | No-doble-booking, ciclo de vida de `Cita` | (1)(2)(3) + máquina de estados | 4 | **Alto** — concurrencia real | Restricción de exclusión probada bajo concurrencia real (no solo mockeada); Outbox real operando | Unitarias de invariantes; integración con concurrencia simulada (dos requests simultáneos al mismo slot) |
| Anticipos | Retención y cobro condicionado | (4) | 5 (paralelo con CRM) | Medio (dinero real) | Ciclo completo solicitar→pagar/expirar→liberar horario, verificado con el job de expiración real | Integración con el job de expiración; prueba de no-doble-cobro (idempotencia) |
| CRM/Clientas | Clasificación e identidad global | (4) | 5 (paralelo con Anticipos) | Bajo | Clasificación, bloqueo, etiquetas funcionando; consulta de clasificación usada por Agenda | Unitarias; integración con Agenda (consulta real, no mock) |
| Conversación e IA | Interpretación + orquestación | (4)(3)(5) + F-27 ratificado + prompts | 6 | **Alto** (F-27, F-14, límite de gasto, golden set débil al inicio — ya señalado por F-16) | Pipeline completo con ack inmediato, salida estructurada validada, golden set inicial pasando | Contrato contra respuestas grabadas de OpenAI; e2e reducido del camino crítico contra Sandbox |
| Notificaciones | Recordatorio/confirmación | (4) | 7 (paralelo con 6) | Bajo | Envío real por WhatsApp verificado en Sandbox, con registro de fallos | Integración con la cola de jobs; prueba de idempotencia de envío |
| Sincronización de Calendario | ACL hacia Google Calendar | (4) | 7 (paralelo con 6) | Medio (cuota de API, hallazgo de `IMPLEMENTATION_READINESS_REVIEW.md` §6) | Push unidireccional verificado, sin lectura de vuelta | Contrato contra la API de Google Calendar grabada; prueba de reintento ante 429 |
| Escalamiento Humano | Handoff bot↔humano | (6) | 8 | **Alto** (peor escenario de negocio ya identificado, DM-C) | Revalidación de modo antes de cada respuesta probada explícitamente; escalamiento-de-escalamiento probado | Prueba de condición de carrera (respuesta de bot justo tras toma de control humano) |
| Garantías | Reclamos de servicio | (6) + `CitaCompletada` | 9 | Bajo (lógica simple, huecos de negocio ya documentados) | Validación automática + envío a revisión humana funcionando | Unitarias de ventana de vigencia; integración con el evento `CitaCompletada` |
| Analítica | Dashboard de KPIs | (1)–(9) | 10 | Bajo | KPIs dentro del SLO de rezago provisional | Prueba de consistencia eventual (rezago medido contra el umbral) |

---

## 9. Estrategia de base de datos

No es "crear tablas" — es una regla de cuándo aparece cada pieza:

- **Esquemas (namespaces):** un esquema de Bounded Context se crea **solo cuando ese módulo entra en desarrollo activo** (Sección 7), nunca los 11+3 de una vez el día 1 — crearlos todos por adelantado sería exactamente la especulación que el principio de simplicidad proporcional ya rechaza en otras partes del proyecto.
- **Tablas:** dentro de un esquema, la tabla del aggregate raíz nace en la primera migración de ese módulo; las tablas de entidades hijas se agregan en el mismo commit que el caso de uso que las necesita, no antes.
- **Índices y constraints de invariantes críticos:** nacen en la **misma migración** que crea la tabla — nunca "se añaden después". El caso más importante: la restricción de exclusión de `agenda.citas` (§5.1 de `04-data-model.md`) se escribe en la migración inicial de Agenda, ya con la máquina de estados de `Cita` resuelta (si se escribe antes, se estaría escribiendo sobre un enum incompleto — exactamente el riesgo que `04-data-model.md` §9.6 ya señaló).
- **Eventos de dominio:** el código que produce un evento nace en el mismo commit que el caso de uso que lo dispara (ADR-011, instrumentación desde el día 1, aplicado a nivel de evento también) — nunca se retrasa "lo agregamos cuando alguien lo consuma".
- **Outbox:** la tabla de outbox de un esquema nace **la primera vez que ese esquema produce un evento con efecto externo crítico** (hallazgo adversarial #1) — para Sucursales/Identidad/Catálogo, probablemente nunca la necesiten en su forma completa; para Agenda, nace en su primera migración.
- **Idempotencia:** la tabla de idempotencia de un esquema nace junto con el primer punto de entrada de ese esquema que tiene efecto de estado y puede recibir un duplicado — para Agenda, desde el primer commit (confirmar cita ya es idempotente por diseño, ADR-021).
- **Seeds:** los datos semilla (7 roles fijos, las sucursales reales de Blanc, un catálogo de servicios de ejemplo) se cargan en Sandbox **tan pronto el esquema correspondiente existe** — nunca se espera a "cuando todo el sistema esté listo" para poder empezar a probar contra datos reales.

---

## 10. Estrategia de APIs

No se diseñan las APIs aquí. Se define únicamente el momento correcto:

`05-api-design.md` se redacta **en Fase 0**, después de que ORM/proveedor de BD y `PA-19` (RBAC) estén cerrados (dependen de ellos, Sección 4.2), y **usando como entrada el catálogo de Decision Flows ya congelado** (36 flujos son suficiente insumo para enumerar endpoints y sus códigos de error de negocio, ADR-013) — **no** hace falta esperar a que los 36 flujos estén redactados en prosa completa para diseñar el contrato, porque el contrato depende de la forma del flujo (qué entra, qué sale, qué códigos de error existen), no de su redacción detallada paso a paso.

**Por qué ese momento y no otro:** diseñarlo antes de cerrar ORM/BD arriesga un contrato que asuma capacidades de una tecnología que después cambia; diseñarlo después de empezar a construir Agenda (como haría la Opción C de la Sección 11 si se aplicara aquí) arriesga que el primer módulo se construya sin contrato y haya que retrofit — exactamente el antipatrón que ADR-014 ya advierte.

---

## 11. Estrategia de Decision Flows — evaluación crítica de las 4 opciones

**Opción A (redactar los 36 antes de implementar cualquier cosa) — rechazada.** Invertiría esfuerzo completo en `FL-CRM-02`/`FL-AGE-02`/`FL-AGE-03` (40-55% de completitud, `decision-flows-trazabilidad.md`) sin garantía de que las respuestas de negocio no cambien su forma antes de llegar a implementarlos — es la misma sobre-anticipación que este proyecto ya rechazó explícitamente en otros puntos (ej. Intento 2 de `SolicitudDeCambioDeHorario`, `HANDOFF.md` §7).

**Opción C (redactarlos después de `05-api-design.md`) — rechazada como orden estricto.** Invertiría el orden real de dependencia: `05-api-design.md` necesita el **catálogo** (ya congelado) para enumerar endpoints, pero no necesita la prosa completa de cada flujo — exigir eso como prerrequisito retrasaría el contrato de API sin necesidad real.

**Opción B (redactarlos módulo por módulo, justo antes de implementarlo) — la base correcta, pero incompleta por sí sola.** Reduce el riesgo de que un flujo quede desactualizado por una respuesta de negocio que llega después de escribirlo, y sigue el mismo principio de Vertical Slice ya aplicado al proceso (Sección 2, principio 2). El problema: escribir el primer flujo real de un módulo complejo (Agenda, con 13 micro-flows) sin haber validado antes que la plantilla del catálogo realmente funciona en la práctica es un riesgo de rehacer trabajo si la plantilla resulta insuficiente.

**Opción D (adoptada) — B, con un piloto deliberado adelantado.** Se redactan primero los 4 macro-flows ya al 100% de completitud (`FL-AGE-07`, `FL-CRM-03`, `FL-ESC-02`, `FL-SUC-01`, con sus micro-flows asociados) **en Fase 0, en paralelo con `05-api-design.md`** — no porque sean el primer módulo a implementar en un sentido estricto de dependencia, sino porque son los de menor riesgo de contenido (sin preguntas abiertas) y sirven como **plantilla validada** antes de comprometerse a escribir los 32 restantes, y como entrada real (no hipotética) para el diseño de `05-api-design.md`. El resto de los 32 flujos se redactan estrictamente módulo por módulo, en el orden de la Sección 7, justo antes de implementar cada uno.

---

## 12. Estrategia de pruebas

Aterrizaje de ADR-019 a esta secuencia concreta:

| Tipo de prueba | Cuándo aparece |
|---|---|
| Unit tests (dominio) | Desde el primer módulo (Fase 1) — sin infraestructura ni IA, la mayor cobertura exigida en todo momento |
| Integration tests (aplicación, adaptadores falsos) | Desde el primer módulo con un caso de uso real (Fase 1) |
| Contract tests (adaptadores externos) | Cuando cada integración externa se construye: Google Calendar y WhatsApp en Fase 4, OpenAI en Fase 4 — nunca contra el servicio real en cada corrida de CI |
| End-to-end (camino crítico reducido) | A partir de Fase 2 (Agenda), contra Sandbox — crece con cada fase, nunca contra Producción |
| Chaos/failure tests (Outbox, cola de jobs) | En el momento en que cada uno nace (Fase 2 para Outbox, Fase 4 para la cola de WhatsApp) — como parte de su propia definición de "terminado" (ya resuelto así en `03` §8.4, F-17), no como fase de testing aparte |
| Performance tests | Solo cuando exista tráfico real o proyectado con evidencia (gatillo de revisión ya definido en varios ADRs) — no antes, sería medir contra una carga inventada |

---

## 13. Estrategia de despliegue

**Corrección necesaria antes de responder esto:** el enunciado de esta sección en la instrucción original menciona "Sandbox / QA / Producción" — pero **ADR-012 define tres entornos: Development, Sandbox, Production**. No existe un cuarto entorno "QA" en ningún ADR, y crear uno aquí contradiría una decisión ya cerrada sin una razón nueva que lo justifique. Este documento **no introduce un entorno QA** — el rol que "QA" cumpliría (validación antes de producción) ya lo cumple Sandbox, incluyendo el golden set de regresión conversacional (ADR-019) y las pruebas e2e del camino crítico (Sección 12).

- **Development:** existe desde la Fase 1 — cambios en curso, sin credenciales reales de ninguna integración externa.
- **Sandbox:** debe existir **antes** de que la Fase 2 (Agenda) tenga su primer despliegue verificable — con credenciales de WhatsApp/IA/Calendar completamente aisladas de Producción (ya exigido explícitamente por ADR-012, riesgo ya señalado: "Sandbox mal aislado... anularía su propósito").
- **Production:** solo se aprovisiona al final de la Fase 7, y solo después de que los criterios de la Sección 16 se cumplan — nunca antes, ni siquiera para "solo mirar cómo se ve".

---

## 14. Riesgos arquitectónicos — revisión adversarial del plan mismo

Intento explícito de demostrar que este plan falla, no de confirmarlo:

**"¿Y si el cliente no responde las preguntas de Fase 0 a tiempo?"** Es el riesgo más real de todo el plan — este proyecto ya tiene un historial documentado de preguntas abiertas que se acumulan (24 en `99-open-questions.md`, 18 originales del Domain Discovery). Si Fase 0 se estanca, la presión natural es empezar Agenda sin la máquina de estados de `Cita` cerrada — exactamente el patrón que `DOMAIN_MODEL_REVIEW.md` ya identificó como la causa raíz de los escenarios de ruptura más graves (DM-A, DM-C). **Mitigación de este documento:** el trabajo de Fase 0 que no depende del cliente (diseñar `TicketEscalamiento`, cerrar ORM/BD/hosting, redactar `05-api-design.md` en lo que sí se puede avanzar) se ejecuta en paralelo mientras se espera al cliente — nunca se avanza a Fase 2 sin el criterio de salida cumplido, sin excepción (ver declaración de cierre).

**"¿El principio de 'Outbox just-in-time' no es, en el fondo, la misma sobre-confianza en la disciplina humana que F-02 ya señaló como riesgo sistémico?"** Objeción tomada en serio. La diferencia real: F-02 señala la sobre-dependencia de "revisión de PR" como *único* control ante erosión de disciplina. Aquí, el control no es "confiar en que alguien construya el Outbox a tiempo" — es que **el criterio de salida de Fase 2 exige explícitamente que Outbox esté operando y probado con fallo inyectado** (Sección 12) antes de que Agenda se considere terminada. No es disciplina sin verificación, es un gate con criterio objetivo.

**"¿La Fase 4 (Conversación + Notificaciones/Calendar en paralelo) no reintroduce el riesgo F-26 (contención de recursos entre Conversación y Agenda) antes de tiempo?"** Revisado: F-26 es un riesgo de **volumen real de tráfico**, no de construcción simultánea de código. Construir dos módulos en paralelo en el repositorio no genera contención de base de datos — la contención aparecería en producción con tráfico real, que es exactamente el gatillo de revisión que ADR-005 ya define. No es un riesgo nuevo de este plan.

**"¿Qué pasa si el golden set (Fase 4) sigue siendo débil (F-16) para cuando Garantías (Fase 5) necesita que la IA interprete correctamente un reclamo de garantía por WhatsApp?"** Riesgo real no completamente mitigado por este documento — se hereda de F-16 (`ARCHITECTURE_REVIEW.md`), que ya recomienda alimentar el golden set activamente desde el día 1 de producción real, no antes. Fase 5 debe incluir explícitamente casos de garantía en el golden set antes de considerarse cerrada — se agrega aquí como criterio de salida adicional de Fase 5, no estaba explícito antes de este análisis.

**Conclusión de la revisión adversarial:** el plan no falla en su estructura — sobrevivió los cuatro intentos de refutación, con un ajuste real incorporado (criterio de golden set en Fase 5) y una mitigación explícita para el riesgo más serio (estancamiento de Fase 0).

---

## 15. Backlog deliberadamente postergado

| Ítem | Por qué se posterga |
|---|---|
| Modelo Pool multi-tenant (vs. Silo ya decidido, ADR-009) | No hay segundo cliente real; se evalúa solo si aparece uno (Future Revisit Criteria de ADR-009) |
| Proveedor de IA de respaldo activo | ADR-007 ya lo deja como puerto preparado, no como implementación — se revisita ante un incidente real medible |
| Integración pública con POS/inventario | Fuera de alcance funcional explícito (`functional-scope.md` §6); sin API pública real todavía (ADR-014 la deja diseñada conceptualmente, no construida) |
| Procesamiento de notas de voz | Fuera de alcance explícito (`RN-CONV-06`); se escala directamente a humano por diseño |
| Reconstrucción histórica exacta de Analítica (más allá de eventos + auditoría) | Future Revisit Criteria de ADR-003 — sin necesidad demostrada hoy |
| Particionamiento físico de `conversacion.mensajes` | El propio Domain Discovery ya lo deja para cuando exista volumen real, no antes |
| Entornos efímeros por Pull Request | ADR-012 los deja como mejora incremental razonable, no parte de esta primera versión |
| Segunda capa de autenticación para API pública (API keys/OAuth de aplicación) | Future Revisit Criteria de ADR-010/ADR-014 — sin integrador externo real todavía |
| Política formal de deprecación de versiones de API | ADR-014 — no aplica sin al menos un consumidor externo real |
| Renames diferidos (`Clienta`→`Cliente`, etc.) | Ya explícitamente pospuestos hasta un segundo cliente real (memoria de proyecto, `DESIGN-PHASE-HANDOFF.md` §4) |
| Reglas `Faltante`/`Pendiente` de baja prioridad (15 en Business Rules) | Se implementa el comportamiento ya `Aprobado` como base; se ajusta cuando lleguen las respuestas, sin bloquear ninguna fase |
| Marcar VIP y versionar/revertir prompts como Decision Flows propios | Ya evaluados y excluidos del catálogo congelado — no se reabre esa decisión aquí |

---

## 16. Definition of Done del proyecto completo

Blanc se considera listo para producción real cuando **todas** las siguientes condiciones se cumplen simultáneamente — no es una lista de "nice to have", es la condición conjunta:

1. Los 36 Decision Flows redactados, con `Estado ≥ Aprobado` para todo flujo `Critical`/`High`; los de prioridad menor documentados con su comportamiento provisional explícito.
2. Las 3 máquinas de estado implementadas, con pruebas explícitas de transiciones ilegales rechazadas.
3. Los 22 ADRs en `Status: Accepted`, incluyendo el sign-off explícito de ADR-008.
4. Los tres canales externos (WhatsApp oficial con números migrados y plantillas aprobadas; IA con golden set cubriendo al menos agendamiento, escalamiento y garantías; Google Calendar sincronizando) verificados en Sandbox de extremo a extremo.
5. SLOs (rezago de Outbox, rezago de Analítica, tasa de error de integraciones, dead-letter, notificación de escalamiento) validados con al menos 2–4 semanas de datos reales de operación piloto, no solo con los valores provisionales de `03-technical-architecture.md` §6.3.
6. Backups con al menos una restauración real probada exitosamente (no solo verificación de que el archivo existe, per ADR-022).
7. Plan de migración de los 3 números de WhatsApp ejecutado sucursal por sucursal, sin interrupción de canal reportada.
8. Capacidad de recepción humana ante escalamiento masivo validada con el negocio (F-05) — no asumida.
9. Al menos una sucursal operando en Producción real durante una semana completa sin intervención de desarrollo directa.

---

## Declaración de cierre

A partir de la aprobación de este documento:

- **Ningún módulo se desarrolla fuera del orden de la Sección 7**, salvo que este documento se actualice primero con la justificación correspondiente.
- **Ninguna fase de la Sección 6 se omite ni se reordena** sin una nueva versión de este documento.
- **Ningún cambio arquitectónico significativo se hace sin, o bien modificar este documento, o bien crear un ADR nuevo** — lo que corresponda según si el cambio es de secuenciación (este documento) o de decisión técnica de fondo (ADR).
- Este documento es ahora la fuente oficial que gobierna la transición de diseño a construcción de Blanc.

**Registro de revisiones:**
- **2026-08-04 — Arranque parcial controlado:** se agregó la enmienda a Fase 0 (Sección 6) autorizando el inicio de Sucursales y Personal, Identidad y Accesos, y Catálogo y Cotización en paralelo al cierre del resto de Fase 0, con base en la ausencia de dependencia real ya documentada en las Secciones 4 y 7. No se reordenó ni se omitió ninguna fase; no se cerró ninguna decisión pendiente.
