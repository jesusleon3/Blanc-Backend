# Domain Discovery — Blanc

> **Fuente:** `docs/requirements/blanc-requisitos-negocio.md`
> **Estado:** Borrador v0.1 — pendiente de validación de las Preguntas Abiertas antes de congelar el modelo.
> **Alcance de este documento:** Solo dominio (DDD). No hay decisiones de tecnología, esquema de base de datos ni diseño de API todavía.
> **Actualización 2026-08-03 (propagación desde `DISCOVERY_CHECKLIST.md`):** 15 de las 18 Preguntas Abiertas de la Sección 2 (y su espejo en la Sección 9) recibieron respuesta total o parcial de la Dueña en una reunión real — cada una queda marcada inline con su resultado exacto, sin eliminar el contenido original, por trazabilidad histórica (mismo criterio ya usado en `99-open-questions.md`). Fuente exclusiva de esta actualización: `DISCOVERY_CHECKLIST.md`, clasificada según el modelo ya congelado en `PLATFORM_ARCHITECTURE_MODEL.md`. **No se agregó Garantías como Bounded Context en esta pasada** — el vacío ya está confirmado (`PLATFORM_ARCHITECTURE_MODEL.md` §10), pero diseñar su modelo de dominio (Entidades/Aggregates/Value Objects/Domain Events) exigiría inventar arquitectura nueva sin una fuente que la especifique, fuera del alcance de una propagación pura — queda como pendiente real, ver `MASTER_PROPAGATION_PLAN.md`. Las Preguntas #2, #6 y #7 de la Sección 2 no formaron parte de esta ronda de respuestas — sin cambios.

---

## 1. Dominio principal

**Automatización conversacional del ciclo de vida de citas y relación con clientas en un salón de manicura multi-sucursal, donde la inteligencia artificial sostiene la conversación en lenguaje natural (incluida la composición de servicios variable por uña) y todas las reglas de negocio se ejecutan de forma determinista en código.**

Dos características hacen a este dominio no trivial y merecedoras de diseño cuidadoso:

1. La **cotización no es de catálogo fijo**: se compone dinámicamente por uña/mano a partir de una descripción en lenguaje natural.
2. La **IA es un componente de interpretación, no de decisión**: la intención se extrae vía LLM, pero disponibilidad, precios, políticas de lista roja, anticipos, etc. son invariantes de negocio que debe garantizar el dominio, no el modelo de lenguaje.

---

## 2. Preguntas abiertas (revisar antes de congelar el modelo)

Estas preguntas condicionan decisiones de modelado que ya tomé como **supuesto de trabajo** en las secciones siguientes (marcado explícitamente donde aplica). Recomiendo resolverlas antes de pasar a modelo de datos y arquitectura técnica, porque cambiarlas después implica retrabajo real, no cosmético.

| # | Pregunta | Por qué importa | Supuesto usado mientras tanto |
|---|----------|------------------|-------------------------------|
| 1 | ¿Quién es la **fuente de verdad** del calendario: la plataforma o Google Calendar? El cliente dijo "Google Calendar se mantiene tal cual, es la vista que usa el negocio" pero también "la plataforma sincroniza con Google Calendar", lo cual es ambiguo sobre quién gana en un conflicto. | Define dónde vive el invariante "no doble-booking", quién resuelve conflictos, y qué pasa si el negocio edita directamente en Google Calendar. Es la decisión de mayor impacto en todo el Bounded Context de Agenda. | La plataforma es la fuente de verdad interna; Google Calendar es una **proyección de solo lectura para el negocio** (push unidireccional plataforma → Google Calendar). Confirmar. **→ Confirmado (`DISCOVERY_CHECKLIST.md` 1.1, 2026-08-03):** la Dueña confirma la plataforma como fuente de verdad. Hallazgo nuevo: exige sincronización "en tiempo real o cerca de eso" — cotejar contra el SLO de rezago de Outbox en `03-technical-architecture.md` §6.3 (pendiente, fuera de esta pasada). |
| 2 | ¿"Manicurista" como **recurso agendable** (Agenda) y "Usuario con rol Manicurista" (acceso a la plataforma) son la **misma entidad** o dos entidades vinculadas? | Afecta si dar de baja a una empleada implica un solo flujo o dos, y si todas las manicuristas necesitan login. | Se modelan como dos conceptos distintos en dos Bounded Contexts, vinculados por referencia (una manicurista puede no tener usuario si nunca usa la plataforma directamente). |
| 3 | ¿La "lista roja" se asigna **manualmente** por un empleado, o el sistema la propone/asigna **automáticamente** tras N cancelaciones? ¿Cuál es N? ¿Y qué tratamiento reciben las citas ya confirmadas de esa clienta al momento de marcarse? | Es una regla de negocio con dinero de por medio (dispara cobro de anticipo); el tratamiento de citas ya confirmadas es parte de la misma política. Automatizarla mal genera fricción con clientas. | Asignación manual por un empleado (Recepcionista+); el sistema solo **sugiere** candidatas con base en historial de cancelaciones, no decide. Sin definir el tratamiento de citas ya confirmadas. **→ Respondido (`DISCOVERY_CHECKLIST.md` 1.18/1.19, 2026-08-03):** el disparador es por **incidente individual** (cancelación/reagendo <60 min, o no-show) — no un umbral acumulado como se asumía. Citas ya confirmadas **no** quedan afectadas retroactivamente; solo futuras solicitudes. |
| 4 | Si se solicita un anticipo y la clienta **no paga**, ¿se libera el horario? ¿Con qué ventana de gracia? | Sin esto no se puede definir el ciclo de vida del agregado `SolicitudAnticipo` ni el invariante de reserva temporal de horario. | Reserva temporal (hold) del horario con expiración configurable (valor por definir); al expirar, se libera el slot automáticamente. **→ Respondido (`DISCOVERY_CHECKLIST.md` 1.13, 2026-08-03):** no existe una retención temporal real — el horario permanece disponible hasta que el anticipo se paga (protegido por el invariante de exclusión de `RN-AGE-01`, sin mecanismo nuevo). Dato nuevo: el anticipo es el **40% del valor del servicio**. |
| 5 | ¿Existe una **ventana mínima** para cancelar/reprogramar sin penalización (ej. no se puede cancelar con &lt;2h de anticipación)? No se mencionó en el descubrimiento. | Afecta el invariante de `Cita.cancelar()` y si "lista roja" es la única variable que restringe la autogestión. | Sin restricción de ventana temporal por ahora; solo la condición de lista roja bloquea autogestión. **→ Respondido (`DISCOVERY_CHECKLIST.md` 1.7, 2026-08-03):** confirmado sin ventana dura de bloqueo, pero de 60 a 0 minutos antes de la cita se activa una sugerencia automática de lista roja. |
| 6 | El **historial/CRM de una clienta**, ¿es global (todas las sucursales) o aislado por sucursal? El campo "sucursal favorita" sugiere que una clienta puede visitar varias. | Define el aggregate boundary de `Clienta` y si el reconocimiento de "cliente frecuente" cruza sucursales. | `Clienta` es una identidad **global** (por número de teléfono), con historial y estadísticas cruzando las 3(4) sucursales. |
| 7 | ¿Qué define exactamente **"palabra prohibida"**? ¿Lista estática, configurable por quién, y con qué alcance (global o por sucursal)? | Es un disparador de escalamiento; sin definición operativa no se puede diseñar el caso de uso ni el panel de "entrenar al bot". | Lista configurable por Administrador/Gerente, global a todas las sucursales. |
| 8 | ¿Cuál es el criterio de **"cliente molesto"**: score de sentimiento del LLM, palabras clave, o ambos? ¿Hay umbral configurable? | Afecta si la detección vive en el BC de Conversación (como parte del pipeline de IA) o como una regla de negocio separada y auditable. | Señal híbrida: sentimiento devuelto por el LLM + lista de palabras clave como respaldo determinista, ambos configurables. **→ Sigue sin respuesta (`DISCOVERY_CHECKLIST.md` 1.21, 2026-08-03):** la Dueña aplazó explícitamente esta pregunta ("se define después"). El supuesto de esta fila se mantiene vigente como valor provisional. |
| 9 | Lista de espera: ¿tiene **tiempo de expiración**? ¿Orden estricto FIFO o hay prioridad (ej. VIP primero)? | Define el aggregate `ListaDeEspera` y el evento de notificación cuando se libera un cupo. | FIFO simple con expiración configurable; sin prioridad VIP salvo que se confirme lo contrario. **→ Parcialmente respondido (`DISCOVERY_CHECKLIST.md` 1.5, 2026-08-03):** expira por evento (al agendarse una cita, o al completarse la que ya tenía la clienta), no por un tiempo fijo. La prioridad exacta no fue reconfirmada explícitamente para lista de espera — se infiere por consistencia con 1.2, sin confirmación literal. |
| 10 | ¿Los precios/duraciones de servicios y modificadores son **globales** o pueden variar por sucursal? El documento menciona "configuración editable por sucursal (horarios, servicios, precios, personal)", lo cual sugiere override por sucursal. | Define si `Servicio` es un aggregate único o si necesita un mecanismo de override (`ServicioSucursal`). | Catálogo global con posibilidad de **override por sucursal** (precio/duración/activo), heredando del valor global si no hay override. **→ Respondido (`DISCOVERY_CHECKLIST.md` 1.11, 2026-08-03):** confirmado catálogo **global**, sin variación por sucursal. El override queda modelado preventivamente en `04-data-model.md` §5.2, confirmado sin uso. |
| 11 | ¿"Analista" y "Solo lectura" tienen acceso a **todas las sucursales** o limitado a una? No se especificó alcance por rol. | Afecta el modelo de permisos (RBAC) — si el scope es por sucursal o global por rol. | Pendiente de definir; se modela `Usuario` con posible lista de sucursales asignadas, aplicable a todos los roles salvo Super Admin. **→ Respondido (`DISCOVERY_CHECKLIST.md` 1.26, 2026-08-03):** confirmado alcance **global** (todas las sucursales) para Analista y Solo lectura — contrario a la recomendación conservadora original, pero respuesta clara e inequívoca. Resuelve también el Pendiente P2 de `ARCHITECTURE_CLOSURE_PLAN.md`. |
| 12 | ¿Existe alguna obligación regulatoria de protección de datos personales aplicable (ej. LFPDPPP en México) que condicione el manejo de fotos, teléfonos y hábitos de consumo? | Afecta retención de datos, consentimiento, y diseño de auditoría/backups. | No confirmado — se marca como riesgo, no como requisito todavía. **→ Parcialmente respondido (`DISCOVERY_CHECKLIST.md` 1.27, 2026-08-03):** postura informal de la Dueña — a su conocimiento, no aplica ninguna obligación hoy. No es una validación jurídica formal; se mantiene la recomendación de consultar a un abogado antes de operar con clientas reales. |
| 13 | Si el precio/duración de un servicio cambia en el catálogo, ¿las citas **ya agendadas** conservan el precio original o se recalculan? | Determina si `Cita` debe guardar un snapshot inmutable de la cotización o una referencia viva al catálogo. | Snapshot inmutable en el momento de la cotización (estándar en sistemas de reservas/facturación) frente a cambios **legítimos** de catálogo. Esto no resuelve qué ocurre si el snapshot original fue **erróneo** (ej. error humano de captura de precio o servicio) — es un escenario distinto, cuyo proceso de corrección queda sin definir. **→ Segunda parte respondida (`DISCOVERY_CHECKLIST.md` 1.8, 2026-08-03):** la corrección de un snapshot erróneo la autoriza la Dueña y se aplica por medio de la plataforma — nunca de forma automática. |
| 14 | ¿Google Calendar de cada sucursal es **un calendario por sucursal** (mi lectura de la respuesta a la pregunta 9) o hay otro esquema de organización por color? | Afecta el diseño del adaptador de sincronización (ACL) hacia Google Calendar. | Un calendario de Google por sucursal, diferenciado por color. Confirmar. **→ Parcialmente respondido (`DISCOVERY_CHECKLIST.md` 1.25, 2026-08-03):** confirma diferenciación por color; no queda claro si es un calendario independiente por sucursal o uno compartido con colores internos — dos modelos técnicos distintos, requiere repregunta puntual antes de Fase 4. |
| 15 | ¿Las transiciones de `Cita` hacia `completada` y `no_show` requieren un disparador **manual** (acción de un empleado), **automático** (temporal, por paso del horario) u otro mecanismo? | Estas transiciones no ocurren de forma implícita — afectan directamente la evolución del estado de `Cita` y quedan pendientes hasta definir su disparador. | Sin definir — no se asume ningún disparador por defecto. **→ Parcialmente respondido (`DISCOVERY_CHECKLIST.md` 1.6, 2026-08-03):** `no_show` es un disparador **manual** por un empleado. El disparador exacto de `completada` sigue ambiguo (¿automático por defecto o también manual?) — es la pregunta de mayor apalancamiento del proyecto, pendiente de una repregunta literal antes de cerrar el diseño formal de esta máquina de estados. |
| 16 | ¿Qué evento o ventana de inactividad cierra una `Conversacion` (`estado` → `cerrada`), y si la clienta escribe después de cerrada, se reabre la misma `Conversacion` o se crea una nueva? | Afecta la continuidad de `modo`/`estado` entre interacciones; el requisito de "recordar conversaciones anteriores" ya está parcialmente cubierto por `MemoriaDeConversacion` (persiste por clienta, no por `Conversacion`), pero la identidad del hilo sigue sin definirse. | Sin definir — no se asume ningún disparador ni política de reapertura por defecto. **→ Parcialmente respondido (`DISCOVERY_CHECKLIST.md` 1.22, 2026-08-03):** la conversación se modela como una identidad persistente por clienta, sin un ciclo clásico de cierre/reapertura; el contexto de la IA se limita a la cita en gestión, no al historial completo. El mecanismo exacto de reseteo de `modo` (bot/humano) tras inactividad sigue sin resolverse — ruta directa al peor escenario de negocio ya identificado (DM-C). |
| 17 | ¿La confirmación automática de una `Cita` es un mensaje informativo de una sola vía (push), o es una interacción donde la clienta debe responder para que la cita se considere confirmada? | Determina si `Notificacion` (Sección 5.12) necesita representar una respuesta de la clienta además del estado de envío, y si `EstadoCita` requiere un estado intermedio distinto de `confirmada` mientras se espera esa respuesta. | Sin definir — no se asume push ni interacción por defecto. Mientras no se resuelva, no se introducen nuevos estados, eventos, aggregates ni pares de consistencia en `Notificacion` (5.12) ni en `Cita` (5.1/5.11). **→ Respondido (`DISCOVERY_CHECKLIST.md` 1.23, 2026-08-03):** la confirmación es **interactiva** — requiere una respuesta afirmativa explícita de la clienta, contrario al supuesto de push unidireccional. Esto habilita, en la próxima iteración formal de este modelo, introducir el estado intermedio en `Cita` que esta fila explícitamente había diferido — no se diseña todavía en esta pasada (fuera de alcance de propagación pura). |
| 18 | ¿Durante cuánto tiempo permanece vigente una cotización calculada (`CotizacionServicio`) antes de que deba recalcularse, si la clienta tarda en confirmar? | Distinto del snapshot ya congelado en una `Cita` (Pregunta #13): aquí el tema es la ventana entre el cálculo de la cotización durante la conversación y su congelamiento al confirmar — no está definido si existe un límite de tiempo o si siempre se revalida contra el catálogo vigente al confirmar. | Sin definir — no se asume ninguna ventana de vigencia por defecto. **→ Respondido (`DISCOVERY_CHECKLIST.md` 1.12, 2026-08-03):** sin expiración por tiempo — la cotización sigue vigente indefinidamente mientras no cambie la composición del servicio. |

No voy a diseñar aggregates ni invariantes de forma definitiva sobre puntos que dependen de estas respuestas — lo que sigue es un modelo v0.1 razonado, explícitamente marcado donde depende de un supuesto.

---

## 3. Subdominios

### Core Domain (donde vive la ventaja competitiva y la complejidad real)

| Subdominio | Por qué es Core |
|---|---|
| **Motor de Cotización y Composición de Servicios** | El propio cliente lo señaló como el punto de mayor complejidad: traducir "gelish en las manos y dos uñas con diseño francés y una con piedras" en tiempo y precio exactos, por uña, es lógica de negocio no trivial y es el corazón del valor (automatizar lo que hoy hace una recepcionista mentalmente). |
| **Motor de Disponibilidad y Agendamiento** | Reglas de horarios por sucursal, descansos, festivos, bloqueos, asignación opcional de manicurista, prevención de doble-booking y sincronización externa. Es donde vive la mayoría de invariantes críticos del negocio. |
| **Orquestación Conversacional con IA** | Memoria de conversación, reconocimiento de clientas frecuentes, venta cruzada contextual, detección de sentimiento/intención de cancelar, disparo de escalamiento. Es el diferenciador frente a un bot de agendamiento genérico. |

### Supporting Domains (necesarios, con lógica propia del negocio, pero no el diferenciador)

| Subdominio | Rol |
|---|---|
| **CRM de Clientas** | Segmentación (VIP, lista roja, bloqueada), historial, favoritos, notas. Da contexto a los tres dominios Core. |
| **Escalamiento Humano** | Tickets de handoff bot↔humano, notificación, transferencia de control. |
| **Gestión de Sucursales y Personal** | Configuración de horarios, festivos, manicuristas, número de WhatsApp por sucursal. |
| **Notificaciones Salientes** | Confirmaciones, recordatorios, alertas de escalamiento vía WhatsApp. |
| **Anticipos** | Cobro condicionado (solo lista roja), retención temporal de horario. |
| **Sincronización de Calendario** | Traducción entre el modelo interno de Agenda y Google Calendar. |

### Generic Domains (problemas resueltos, sin ventaja competitiva en resolverlos distinto)

- **Identidad y Accesos** (usuarios internos, roles, RBAC, MFA)
- **Auditoría y Cumplimiento** (logs, versionado, trazabilidad de decisiones de IA)
- **Analítica y Reporting** (dashboard de KPIs)
- **Almacenamiento de Medios** (imágenes de referencia de uñas)
- **Observabilidad e Infraestructura** (secrets, monitoreo — cross-cutting, apenas es "dominio")

---

## 4. Bounded Contexts

| Bounded Context | Subdominio(s) que cubre | Relación con otros contextos |
|---|---|---|
| **Conversación** | Orquestación Conversacional con IA | Upstream de Agenda (genera intención de reservar), Escalamiento (dispara tickets) y CRM (alimenta reconocimiento de clienta). Consume Catálogo/Cotización como servicio. |
| **Catálogo y Cotización** | Motor de Cotización y Composición de Servicios | Proveedor (Customer-Supplier) para Conversación y Agenda: expone cotización, no decide disponibilidad. |
| **Agenda** | Motor de Disponibilidad y Agendamiento | Consumidor de Catálogo/Cotización, de Sucursales/Personal (horarios, festivos, manicuristas) y de Anticipos (si aplica retención). Productor hacia Sincronización de Calendario y Notificaciones. |
| **Clientas (CRM)** | CRM de Clientas | Fuente de verdad del estado de la clienta (VIP/lista roja/bloqueada), consultado por Agenda (autogestión sí/no), Anticipos (dispara cobro) y Conversación (personalización). |
| **Escalamiento** | Escalamiento Humano | Consumidor de eventos de Conversación; productor de notificaciones. |
| **Anticipos** | Anticipos | Consumidor de estado de Clienta y de Agenda (slot a retener); no conoce detalles de cotización más allá del monto. |
| **Sucursales y Personal** | Gestión de Sucursales y Personal | Contexto de configuración; upstream de Agenda y de Catálogo (overrides por sucursal). |
| **Notificaciones** | Notificaciones Salientes | Consumidor de eventos de Agenda, Escalamiento y CRM; no tiene lógica de negocio propia, solo orquesta envíos. |
| **Sincronización de Calendario** | Sincronización de Calendario | Anti-Corruption Layer entre Agenda y Google Calendar; traduce el modelo interno a eventos de Google Calendar y viceversa (alcance exacto depende de la Pregunta Abierta #1). |
| **Identidad y Accesos** | Identidad y Accesos | Genérico, usado transversalmente por todos los contextos de "back office" (no por Conversación, que interactúa con clientas, no usuarios internos). |
| **Analítica** | Analítica y Reporting | Puramente consumidor (read-model) de eventos de dominio de todos los demás contextos; no debe tener lógica de negocio propia. |

**Nota de diseño:** "Manicurista" aparece en dos contextos con significado distinto — en **Sucursales y Personal** es un registro administrativo (empleada activa/inactiva, sucursal asignada); en **Agenda** es un recurso agendable cuya disponibilidad debe verificarse en tiempo real. Esto es intencional en DDD (mismo término, distinto modelo por contexto) y no un error — pero el equipo debe tener claro que **no** se debe crear una única tabla/entidad "Manicurista" compartida entre ambos si se busca desacoplamiento real (ver Pregunta Abierta #2).

---

## 5. Modelo por Bounded Context

### 5.1 Agenda

**Entidades**
- `Cita` — sucursal, clienta, manicurista (opcional), composición de servicios cotizada (snapshot, inmutable tras confirmarse), estado, horaInicio/horaFin (mutables mediante una reprogramación, que preserva la identidad de la `Cita` en vez de crear una nueva), indicador de anticipo requerido/pagado.
- `Manicurista` (como recurso agendable, no como usuario) — referencia a la sucursal, activa/inactiva.
- `BloqueoHorario` — sucursal, manicurista (opcional), rango, motivo.
- `ListaDeEsperaEntrada` — clienta, servicio deseado, ventana de fechas preferida, estado, expiración.

**Value Objects**
- `RangoHorario` (inicio, fin)
- `EstadoCita` (pendiente | confirmada | en_espera_pago | cancelada | reprogramada | completada | no_show). `reprogramada` señala que la `Cita` fue reprogramada preservando su propia identidad — no se crea una `Cita` nueva. Las transiciones hacia `completada` y `no_show` tampoco ocurren de forma implícita: requieren un disparador definido, cuya naturaleza se documentará explícitamente en una iteración posterior de este modelo (ver Pregunta Abierta #15). `EstadoCita` representa el ciclo de vida de una `Cita`, gobernado por transiciones válidas entre sus valores — no cualquier valor es alcanzable desde cualquier otro; el diseño formal de esa máquina de estados no se aborda en este documento.
- `Duracion` (minutos)

**Aggregates**
- **`Cita`** (raíz) — encapsula el invariante "una manicurista no puede tener dos citas superpuestas" y "no se agenda fuera de horario/festivo/bloqueo". Contiene la cotización como snapshot inmutable (no referencia viva — ver Pregunta Abierta #13). La inmutabilidad del snapshot protege frente a cambios posteriores del catálogo y no define el tratamiento de un snapshot originalmente incorrecto por error humano; dicho tratamiento queda pendiente de definición (ver Pregunta Abierta #13).
- **`ListaDeEsperaEntrada`** (raíz independiente).

> `Cita` coordina con `SolicitudAnticipo` (5.6) y con `ListaDeEsperaEntrada` mediante consistencia eventual, no transaccional — ver Sección 5.11.

> **Actualización 2026-08-03 (`DISCOVERY_CHECKLIST.md`):** tres hallazgos nuevos sobre `Cita`, ninguno resuelve todavía el diseño formal de la máquina de estados (sigue reservado a Fase 0, P3 de `ARCHITECTURE_CLOSURE_PLAN.md`): (1) la confirmación de cita es **interactiva** — requiere una respuesta afirmativa explícita de la clienta, no es un push unidireccional como asumía la Pregunta Abierta #17 — esto implica que `EstadoCita` necesitará un estado intermedio nuevo (ej. "propuesta"/"pendiente de confirmación") una vez se diseñe formalmente (1.23); (2) `no_show` es un disparador **manual** por un empleado; el disparador exacto de `completada` sigue sin resolver del todo (1.6); (3) ninguna cita puede cruzar el corte de mediodía (12pm-3pm) del horario partido de las sucursales — nuevo invariante del motor de disponibilidad, no modelado todavía (1.3).

**Domain Events**
- `CitaSolicitada`, `CitaConfirmada`, `CitaReagendada`, `CitaCancelada`, `CitaCompletada`, `ClienteNoShow`
- `HorarioBloqueado`, `HorarioDesbloqueado`
- `EntradaListaEsperaCreada`, `CupoDisponibleParaListaEspera`, `EntradaListaEsperaExpirada`

> `CitaReagendada` representa una mutación de `horaInicio`/`horaFin` sobre la misma `Cita` — no crea una `Cita` nueva ni equivale a una cancelación.

### 5.2 Catálogo y Cotización

**Entidades**
- `Servicio` — nombre, categoría, duración base, precio base, activo.
- `ModificadorDeDiseño` — nombre, minutos adicionales, precio adicional (reutilizable entre servicios, ej. "diseño francés" aplica a Gelish y Acrílico por igual).
- `ServicioSucursalOverride` — sucursal, servicio, precio/duración/activo (si se confirma la Pregunta Abierta #10). **→ Respondida (`DISCOVERY_CHECKLIST.md` 1.11, 2026-08-03):** confirmado que no se usa — catálogo global sin override. La entidad se mantiene modelada preventivamente, sin activar (`04-data-model.md` §5.2).

**Value Objects**
- `ComposicionPorUña` — mapeo de qué servicio/modificador aplica a qué uña o grupo de uñas dentro de una solicitud.
- `CotizacionServicio` — resultado calculado: duración total, precio total, desglose por ítem. No se persiste como entidad propia; se **congela dentro de `Cita`** al confirmarse. La política de vigencia de una `CotizacionServicio` entre su cálculo y su confirmación queda pendiente de definición (ver Pregunta Abierta #18). **→ Respondida (`DISCOVERY_CHECKLIST.md` 1.12, 2026-08-03):** sin expiración por tiempo, vigente mientras no cambie la composición.

**Aggregates**
- **`Servicio`** (raíz, incluye referencia a modificadores aplicables).
- **`ModificadorDeDiseño`** (raíz independiente, reutilizable).

**Domain Events**
- `ServicioCreado`, `ServicioActualizado`, `ServicioDesactivado`
- `ModificadorDeDiseñoCreado`, `ModificadorDeDiseñoActualizado`
- `CotizacionCalculada` (útil para trazabilidad/analítica, no solo para persistencia transaccional)

### 5.3 Conversación

**Entidades**
- `Conversacion` — clienta (o número aún no identificado), sucursal (derivada del número de WhatsApp receptor), modo (bot | humano) y estado (activa | cerrada), que representan aspectos distintos de la conversación: el modo indica quién responde en un momento dado (ver ADR-016) y el estado indica si el hilo sigue abierto.
- `Mensaje` — remitente, tipo (texto/imagen), contenido, timestamp, metadatos de IA (intención detectada, sentimiento, tokens, costo).
- `MemoriaDeConversacion` — resumen persistente de contexto relevante de la clienta a través del tiempo (distinto del log crudo de mensajes).

**Value Objects**
- `Sentimiento`, `CostoIA` (tokens + costo), `ModoConversacion`, `IntencionDetectada`

**Aggregates**
- **`Conversacion`** (raíz, con `Mensaje` como entidad hija). *Nota técnica para la fase de arquitectura (no ahora): el volumen de mensajes probablemente exija particionamiento de almacenamiento aunque el límite de consistencia del aggregate se mantenga lógico.*

> `Conversacion` coordina con `TicketEscalamiento` (5.4) mediante consistencia eventual, no transaccional — ver Sección 5.11.
> El disparador de cierre (`activa` → `cerrada`) y la política de reapertura de una `Conversacion` no están definidos — ver Pregunta Abierta #16.
> **Actualización 2026-08-03 (`DISCOVERY_CHECKLIST.md` 1.22):** la Dueña confirma que cada conversación se trata como una identidad de clienta persistente (no hay un ciclo clásico de cierre/reapertura), y que el contexto de la IA debe limitarse a la cita que se está gestionando, no al historial completo de citas pasadas en la misma conversación. El mecanismo exacto de reseteo de `modo` (bot/humano) tras un período de inactividad — el punto que la revisión adversarial ya identificó como ruta directa al peor escenario de negocio (DM-C) — sigue sin resolverse; la Pregunta Abierta #16 permanece parcialmente abierta.

**Domain Events**
- `ConversacionIniciada`, `MensajeRecibido`, `MensajeEnviado`
- `ClienteFrecuenteReconocido`, `VentaCruzadaSugerida`
- `ClienteMoletoDetectado`, `IntencionDeCancelacionDetectada`
- `EscalamientoSolicitado`, `ConversacionDevueltaABot`
- `ImagenRecibida`, `CostoIARegistrado`

### 5.4 Escalamiento

**Entidades**
- `TicketEscalamiento` — conversación relacionada, motivo, empleado asignado, estado.

**Value Objects**
- `MotivoEscalamiento` (imagen | audio_complicado | queja | palabra_prohibida)

**Aggregates**
- **`TicketEscalamiento`** (raíz).

> `TicketEscalamiento` coordina con `Conversacion` (5.3) mediante consistencia eventual, no transaccional — ver Sección 5.11.

**Domain Events**
- `TicketCreado`, `EmpleadoNotificado`, `TicketTomado`, `ControlDevueltoABot`, `TicketCerrado`

### 5.5 Clientas (CRM)

**Entidades**
- `Clienta` — identidad global (por teléfono), nombre, sucursal favorita, manicurista favorita, notas internas, cumpleaños, estado (normal | vip | lista_roja | bloqueada), estadísticas derivadas (última visita, ticket promedio, servicios favoritos).

**Value Objects**
- `EstadoClienta`, `EstadisticasClienta` (calculadas, no editables directamente)

**Aggregates**
- **`Clienta`** (raíz).

**Domain Events**
- `ClientaCreada`, `ClientaMarcadaVIP`, `ClientaMarcadaListaRoja`, `ClientaDesmarcadaListaRoja`, `ClientaBloqueada`, `NotaInternaAgregada`, `VisitaRegistrada`

### 5.6 Anticipos

**Entidades**
- `SolicitudAnticipo` — cita relacionada, clienta, monto, estado (pendiente | pagado | expirado | reembolsado).

**Value Objects**
- `Monto` (cantidad + moneda)

**Aggregates**
- **`SolicitudAnticipo`** (raíz).

> `SolicitudAnticipo` coordina con `Cita` (5.1) mediante consistencia eventual, no transaccional — ver Sección 5.11.

**Domain Events**
- `AnticipoSolicitado`, `AnticipoPagado`, `AnticipoExpirado`, `AnticipoReembolsado`

### 5.7 Sucursales y Personal

**Entidades**
- `Sucursal` — nombre, número de WhatsApp, horario semanal, descansos, festivos.
- `Manicurista` (registro administrativo) — nombre, sucursal(es), activa/inactiva.

**Value Objects**
- `HorarioSemanal`, `DiaFestivo`

**Aggregates**
- **`Sucursal`** (raíz, incluye horario y festivos).
- **`Manicurista`** (raíz independiente, ciclo de vida propio de alta/baja).

**Domain Events**
- `SucursalCreada`, `HorarioActualizado`, `DiaFestivoConfigurado`, `ManicuristaAgregada`, `ManicuristaDesactivada`

### 5.8 Identidad y Accesos

**Entidades**
- `Usuario` — email, rol, sucursal(es) asignadas, MFA habilitado, estado.
- `Rol` — Super Admin, Administrador, Gerente, Recepcionista, Manicurista, Analista, Solo lectura.

**Value Objects**
- `Permiso`

**Aggregates**
- **`Usuario`** (raíz).

**Domain Events**
- `UsuarioCreado`, `RolAsignado`, `MFAHabilitado`, `AccesoDenegado`

### 5.9 Analítica

Contexto de solo lectura (read-model), sin aggregates de negocio propios. Se alimenta de eventos de dominio de todos los contextos anteriores (conversaciones, citas, cancelaciones, costos de IA, tickets, etc.).

### 5.10 Sincronización de Calendario

Contexto de traducción (Anti-Corruption Layer) entre `Cita` (Agenda) y el modelo de eventos de Google Calendar. No introduce entidades de negocio propias; su responsabilidad es no dejar que el modelo de Google Calendar (colores, formato de evento) contamine el dominio interno.

### 5.11 Consistencia entre Aggregates

> Añadido en consolidación posterior, a partir de `DOMAIN_MODEL_REVIEW.md` (hallazgo DM-01). No estaba declarado en la versión anterior de este documento pese a que varios de los modelos de la Sección 5 ya lo requerían.

**Principio general:** una transacción modifica, como máximo, una instancia de un aggregate. La consistencia entre aggregates distintos —incluso dentro del mismo Bounded Context— es siempre eventual, nunca transaccional. El mecanismo de coordinación entre aggregates es Domain Events y el patrón Transactional Outbox (ADR-004) como mecanismo de publicación confiable desacoplado de la transacción que modifica cada aggregate.

Se identificaron tres pares de aggregates que requieren esta coordinación:

- **`Cita` ↔ `SolicitudAnticipo`** (Agenda ↔ Anticipos — secciones 5.1 y 5.6).
- **`Conversacion` ↔ `TicketEscalamiento`** (Conversación ↔ Escalamiento — secciones 5.3 y 5.4).
- **`Cita` ↔ `ListaDeEsperaEntrada`** (ambos dentro de Agenda — sección 5.1).

Para cada uno de estos tres pares queda pendiente, en una iteración posterior de este documento, definir la ventana de inconsistencia tolerable y la acción compensatoria si la sincronización falla o se retrasa. Ninguna de estas dos decisiones se toma en esta versión.

### 5.12 Notificaciones

> Añadido en consolidación posterior (hallazgo DM-07). El Bounded Context "Notificaciones" ya existía en las Secciones 3 y 4, pero no tenía modelo propio en esta sección — recordatorio y confirmación solo existían como efecto de un job (ADR-018), sin representación de dominio.

**Entidades**
- `Notificacion` — cita relacionada, clienta, tipo (recordatorio | confirmación), canal (WhatsApp), estado.

**Value Objects**
- `TipoNotificacion` (recordatorio | confirmación)

**Aggregates**
- La frontera del aggregate de `Notificacion` queda pendiente de definirse en una iteración posterior del modelo.

**Domain Events**
- `NotificacionProgramada`, `NotificacionEnviada`, `NotificacionFallida`

---

## 6. Casos de uso principales

1. Clienta escribe por WhatsApp y el bot identifica intención de agendar.
2. Clienta describe una composición de servicio en lenguaje libre y el sistema calcula precio/duración automáticamente, por uña.
3. Sistema propone horarios disponibles según sucursal, manicurista (si se especifica) y duración total del servicio compuesto.
4. Clienta confirma cita; si está en lista roja, se solicita anticipo antes de confirmar en firme (el horario no se retiene de forma temporal — permanece disponible hasta que el anticipo se paga; confirmado en `DISCOVERY_CHECKLIST.md` 1.13, 2026-08-03).
5. Clienta cancela o reprograma; si está en lista roja, la acción queda pendiente de aprobación de un empleado.
6. Sistema agrega a clienta a lista de espera cuando no hay horario disponible y notifica automáticamente al liberarse un cupo.
7. Sistema envía confirmación automática 24h antes y recordatorios.
8. Sistema reconoce cliente frecuente y sugiere venta cruzada contextual (ej. pedicure habitual).
9. Sistema detecta imagen, audio complicado, queja o palabra prohibida → detiene IA, crea ticket, notifica al empleado por WhatsApp.
10. Empleado toma control de la conversación desde la plataforma y responde manualmente.
11. Empleado devuelve el control al bot de forma explícita.
12. Administrador configura horarios, servicios, precios y personal por sucursal.
13. Administrador bloquea un horario o configura un día festivo.
14. Plataforma sincroniza citas hacia Google Calendar para la vista operativa del negocio.
15. Gerente/Analista consulta el dashboard de KPIs (ventas, ocupación, cancelaciones, satisfacción, costo de IA).
16. Un empleado marca (o el sistema sugiere marcar) a una clienta como lista roja tras historial de cancelaciones.
17. Super Admin activa modo mantenimiento para detener uno o todos los bots.
18. Administrador entrena al bot agregando respuestas frecuentes sin programar.
19. Administrador versiona prompts de IA y revierte a una versión anterior.
20. El sistema registra auditoría de todas las decisiones tomadas por la IA.

---

## 7. Riesgos de negocio

- **Dependencia total de un solo canal (WhatsApp)** y de un número por sucursal: si un número es bloqueado o suspendido, esa sucursal pierde su único canal de agendamiento. No hay canal de respaldo declarado.
- **Confianza en una IA para interacción directa con clientas**: una mala interpretación de intención o un tono inapropiado tiene impacto reputacional inmediato, sobre todo dado que se pidió explícitamente que no "se note como bot".
- **Configuración autoservicio por sucursal** (horarios, precios, personal) en manos de usuarios no necesariamente técnicos: riesgo de mala configuración que bloquee el agendamiento sin que nadie lo note a tiempo (relevante para el "entorno sandbox" que el cliente ya propuso).
- **Manejo de datos personales sensibles** (teléfono, fotos, hábitos de consumo) sin marco regulatorio confirmado (Pregunta Abierta #12). **→ Parcialmente informado (`DISCOVERY_CHECKLIST.md` 1.27, 2026-08-03):** postura informal de la Dueña sin obligación aplicable conocida — sigue sin validación jurídica formal, el riesgo permanece hasta esa validación.
- **Anticipos y reembolsos**: cualquier ambigüedad en expiración de retención de horario o política de reembolso puede generar disputas directas con clientas. **→ Parcialmente mitigado (`DISCOVERY_CHECKLIST.md` 1.13/1.14, 2026-08-03):** no hay retención temporal que expire (ver Pregunta Abierta #4) y la política de reembolso quedó definida (nunca hay reembolso) — el riesgo residual es solo de comunicación clara a la clienta, no de ambigüedad de diseño.
- **Dependencia de un solo proveedor de IA** para una función central del negocio (interpretación conversacional): un cambio de pricing, disponibilidad o comportamiento del modelo afecta la operación completa.

## 8. Riesgos técnicos

- **Proveedor de WhatsApp no oficial** (mencionado en el stack de referencia): las integraciones no oficiales de WhatsApp (basadas en el protocolo de WhatsApp Web) están sujetas a bloqueo del número por parte de Meta sin garantía contractual ni SLA. Dado que cada sucursal depende de un único número, este es un riesgo de continuidad operativa real, no solo técnico. **Se retomará como decisión formal en la fase de arquitectura técnica**, pero se marca aquí porque es un riesgo de negocio con causa técnica.
- **Interpretación de composición de servicios vía LLM**: riesgo de alucinación al mapear lenguaje libre a uñas/modificadores específicos (ej. contar mal cuántas uñas llevan diseño). Requiere que la salida del LLM sea estructurada y validada por código antes de calcular precio — no se puede confiar en parseo de texto libre para algo que involucra dinero.
- **Condiciones de carrera en reservas**: dos clientas solicitando el mismo horario simultáneamente es un escenario esperable dado el volumen de WhatsApp; el invariante de "no doble-booking" debe garantizarse a nivel de dominio/transacción, no solo validarse en el bot conversacional.
- **Sincronización bidireccional (o no) con Google Calendar**: si el negocio edita directamente en Google Calendar fuera de la plataforma (cosa probable dado que hoy es su herramienta de trabajo), puede surgir una fuente de verdad dividida de facto incluso si se diseña como unidireccional. Depende de la Pregunta Abierta #1. **→ Pregunta Abierta #1 confirmada (`DISCOVERY_CHECKLIST.md` 1.1, 2026-08-03):** la plataforma es la fuente de verdad, sincronización unidireccional confirmada. El riesgo de edición directa en Google Calendar por parte del negocio permanece vigente como riesgo operativo, no de diseño.
- **Costo de IA no acotado**: conversaciones largas o crecimiento a más sucursales pueden disparar costo de tokens; ya está contemplado como KPI, pero debe existir un control técnico (no solo de monitoreo) que limite gasto.
- **Acoplamiento implícito a WhatsApp como único canal**: aunque hoy solo se requiere WhatsApp, si el modelo de `Conversacion` se diseña asumiendo el formato de mensajes de WhatsApp en el núcleo del dominio (en vez de en el Bounded Context de Integraciones), extender a otro canal en el futuro será costoso. No implica construir soporte multicanal ahora — implica no cerrar la puerta al diseñar el límite del contexto.

## 9. Decisiones arquitectónicas pendientes

(Consolidado de las Preguntas Abiertas de la sección 2, listadas aquí como decisiones a tomar formalmente antes de avanzar a modelo de datos y arquitectura técnica)

1. Fuente de verdad del calendario (plataforma vs. Google Calendar) y estrategia de resolución de conflictos. **[Confirmado — `DISCOVERY_CHECKLIST.md` 1.1]**
2. Relación entre "Manicurista" como recurso agendable y "Usuario" con rol Manicurista.
3. Regla de asignación a lista roja (manual, automática o híbrida), umbral, y tratamiento de citas ya confirmadas al momento de marcarse. **[Umbral y tratamiento retroactivo respondidos — `DISCOVERY_CHECKLIST.md` 1.18/1.19]**
4. Política de expiración de retención de horario cuando se solicita anticipo y no se paga. **[Respondido — `DISCOVERY_CHECKLIST.md` 1.13: sin retención real, anticipo = 40%]**
5. Ventana mínima (si existe) para cancelar/reprogramar sin restricción adicional. **[Respondido — `DISCOVERY_CHECKLIST.md` 1.7: sin ventana dura, 60-0 min activa sugerencia de lista roja]**
6. Alcance del historial de clienta: global vs. por sucursal.
7. Definición operativa y gobernanza de "palabra prohibida".
8. Criterio y umbral de detección de "cliente molesto". **[Sigue sin respuesta — `DISCOVERY_CHECKLIST.md` 1.21, aplazada explícitamente]**
9. Reglas de expiración y prioridad de la lista de espera. **[Parcialmente respondido — `DISCOVERY_CHECKLIST.md` 1.5: expiración por evento, prioridad sin reconfirmar]**
10. Mecanismo de override de precio/duración de servicios por sucursal. **[Respondido — `DISCOVERY_CHECKLIST.md` 1.11: catálogo global, sin override]**
11. Alcance de sucursales por rol para Analista y Solo lectura (y en general, el modelo de scope de RBAC). **[Respondido — `DISCOVERY_CHECKLIST.md` 1.26: alcance global]**
12. Marco regulatorio de protección de datos personales aplicable. **[Parcialmente respondido — `DISCOVERY_CHECKLIST.md` 1.27: postura informal, sin validación jurídica formal]**
13. Política de snapshot de cotización: si una cita ya agendada conserva el precio original cuando el catálogo cambia (supuesto de trabajo: sí, se congela) — distinto de qué ocurre si el snapshot original fue erróneo, aún sin definir. **[Segunda parte respondida — `DISCOVERY_CHECKLIST.md` 1.8: corrección autorizada por la Dueña, nunca automática]**
14. Confirmación de que cada sucursal corresponde a un calendario de Google independiente. **[Parcialmente respondido — `DISCOVERY_CHECKLIST.md` 1.25: color confirmado, modelo técnico (uno vs. varios calendarios) sin resolver]**
15. Disparador (manual, automático u otro) de las transiciones de `Cita` hacia `completada` y `no_show`. **[Parcialmente respondido — `DISCOVERY_CHECKLIST.md` 1.6: no_show manual, completada sigue ambiguo]**
16. Disparador de cierre de una `Conversacion` y política de reapertura (misma conversación vs. nueva). **[Parcialmente respondido — `DISCOVERY_CHECKLIST.md` 1.22: identidad persistente confirmada, reseteo de modo sin resolver]**
17. Si la confirmación automática de `Cita` es informativa (push) o requiere respuesta de la clienta — mientras esté abierta, no se introducen nuevos estados/eventos/aggregates en `Notificacion` ni en `Cita`. **[Respondido — `DISCOVERY_CHECKLIST.md` 1.23: interactiva, requiere estado intermedio nuevo en Cita]**
18. Ventana de vigencia de una cotización calculada (`CotizacionServicio`) antes de confirmarse (o si se revalida siempre contra el catálogo vigente al confirmar). **[Respondido — `DISCOVERY_CHECKLIST.md` 1.12: sin expiración por tiempo]**

---

## 10. Siguiente paso propuesto

Antes de escribir modelo de datos, diseño de API o elegir stack técnico, propongo que resolvamos las 14 decisiones pendientes de la sección 9 — varias son baratas de responder (son preguntas de negocio, no técnicas) y evitan retrabajo real en el diseño de aggregates e invariantes. Puedo proponer una respuesta razonada para cada una si prefieres que actúe primero como arquitecto y luego confirmes/corrijas, en vez de resolver las 14 una por una — dime cuál prefieres.
