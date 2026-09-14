# Domain Model Review — Blanc

> **Rol del revisor:** Principal Engineer independiente, enfocado exclusivamente en modelado de dominio (DDD táctico). No se revisa infraestructura, tecnología ni despliegue — eso ya fue cubierto por `ARCHITECTURE_REVIEW.md` y queda fuera de alcance aquí.
> **Alcance revisado:** `docs/architecture/01-domain-discovery.md` (fuente principal), contrastado contra las partes tácticas de los 22 ADRs donde tocan aggregates, eventos o consistencia (principalmente ADR-003, ADR-004, ADR-005, ADR-016, ADR-021).
> **Este documento no modifica ni crea ningún ADR.** Es un insumo de revisión de modelado, previo a la aprobación formal del conjunto de ADRs.
> **Restricción explícita del cliente:** donde se identifica la necesidad de una máquina de estados explícita, se documenta **por qué** debería existir — no se diseña.
> **Fecha de revisión:** 2026-07-07.
> **Estado (actualización post-auditoría, 2026-07-08):** Los 17 hallazgos numerados (DM-01 a DM-17), los 6 escenarios de ruptura (DM-A a DM-F) y dos hallazgos adicionales detectados durante la auditoría ("huérfanos", nunca numerados en la versión original) fueron revalidados uno por uno contra el estado actual de `01-domain-discovery.md` y los ADRs, con intento explícito de refutación en cada caso. **Resultado: 10 de los 17 hallazgos numerados fueron incorporados al Domain Discovery; 7 fueron descartados.** Cada hallazgo queda marcado abajo con su **Estado final**. Este documento se conserva como registro histórico del proceso de revisión — las conclusiones vigentes son las marcadas **RESUELTO**, **PARCIAL** o **DESCARTADO**, no el análisis original sin anotar. El detalle hallazgo por hallazgo está en la Sección 10.

---

## 1. Resumen ejecutivo

El Domain Discovery invirtió rigor real en la capa **estratégica** de DDD: los Bounded Contexts están bien delimitados, el lenguaje ubicuo es consistente, y la clasificación Core/Supporting/Generic es defendible. La capa **táctica**, en cambio, quedó menos madura de lo que su nivel de detalle aparente sugiere: los estados de `Cita`, `Conversacion` y `TicketEscalamiento` existen como enumeraciones de valores, no como máquinas de estado con transiciones legales definidas — y **ningún documento declara la regla más básica de consistencia de DDD táctico: que una transacción modifica, como máximo, una instancia de un aggregate**. Esa omisión no es teórica: se identificaron al menos tres flujos de negocio reales (emparejamiento de lista de espera, escalamiento humano, retención por anticipo) que necesitan coordinar dos aggregates y que hoy dependen enteramente de que quien implemente el código "adivine" la disciplina necesaria, porque el modelo no se la exige.

Hallazgos principales (texto original, sin editar — ver estado final de cada uno en la Sección 10):
- **DM-01 (Fundacional):** la regla "una transacción, un aggregate" nunca se declaró explícitamente, pese a que al menos 3 flujos de negocio la necesitan.
- **DM-02 a DM-06:** sí se justifica una máquina de estados explícita para `Cita`, `Conversacion` y `TicketEscalamiento` (Human Handoff); `Recordatorios` y `Confirmaciones` ni siquiera existen como concepto de dominio propio todavía — son efectos colaterales de un job, no un estado que el negocio pueda consultar.
- Se identificaron **6 escenarios concretos donde el modelo puede romperse en producción**, incluyendo un escenario donde una clienta queda sin respuesta de nadie (ni bot ni humano) de forma silenciosa — el mismo peor-caso ya señalado como crítico en el Domain Discovery original, pero ahora con la causa raíz de modelado identificada.

> **Nota post-auditoría:** de los tres flujos citados como ejemplo en el primer párrafo, los tres mantienen su necesidad de política de consistencia general (resuelta vía Sección 5.11 de `01-domain-discovery.md`, DM-01), pero las alternativas de fusión de aggregates sugeridas más adelante en este documento (Sección 7) para dos de ellos fueron descartadas tras revisión adversarial — tenían mitigación de confiabilidad ya diseñada en ADR-016, ADR-004 y ADR-018, no eran un defecto de frontera. Ver Sección 10 para el estado final de cada hallazgo.

---

## 2. Hallazgo fundacional: la regla de consistencia transaccional nunca se declaró

Ningún documento (`01-domain-discovery.md`, `02-architecture-principles.md`, ni los 22 ADRs) establece explícitamente la regla táctica más fundamental de DDD: **una transacción debe modificar, como máximo, una instancia de un aggregate; la consistencia entre aggregates distintos es siempre eventual, nunca transaccional.** ADR-004 (Domain Events + Outbox) la usa implícitamente — el propio patrón Outbox existe precisamente porque hay efectos que cruzan aggregates — pero en ningún lugar se dice "esto es una regla general del sistema, no una solución puntual para notificaciones".

Esto importa porque se encontraron **tres flujos de negocio reales** que coordinan dos aggregates y que hoy no tienen ninguna guía de diseño que obligue a tratarlos con la disciplina de consistencia eventual que realmente necesitan:

1. **Emparejamiento de lista de espera**: liberar un cupo (cambio en `Cita`) y asignarlo a una entrada de `ListaDeEsperaEntrada` para crear una nueva `Cita` son, como mínimo, dos aggregates distintos (`Cita` y `ListaDeEsperaEntrada`) coordinados en una operación que el negocio percibe como una sola acción atómica ("se le dio el cupo a la siguiente clienta en la lista").
2. **Escalamiento humano**: `TicketEscalamiento.estado` y `Conversacion.modo` son dos aggregates distintos (Escalamiento y Conversación) que deben permanecer causalmente sincronizados, pero solo se sincronizan vía eventos (ADR-004), es decir, de forma eventual, no transaccional.
3. **Retención por anticipo**: `SolicitudAnticipo.estado` (Anticipos) y `Cita.estado = en_espera_pago` (Agenda) son dos aggregates distintos que deben permanecer sincronizados de la misma forma eventual.

En los tres casos, la arquitectura ya tiene la pieza técnica correcta para manejar esto (domain events + Outbox, ADR-004) — el problema no es de infraestructura, es que **el modelo de dominio nunca identificó estos tres puntos como casos especiales que requieren diseño explícito de "qué pasa si el evento de sincronización se pierde o se retrasa"**. Se limitan a heredar la garantía genérica de Outbox sin que nadie haya preguntado, aggregate por aggregate, "¿qué estado inconsistente temporal es tolerable aquí, y por cuánto tiempo?".

**¿Requiere una decisión de modelado?** Sí — se recomienda que, antes de implementar estos tres flujos, cada uno tenga documentado explícitamente su ventana de inconsistencia tolerable y su acción compensatoria si la sincronización falla — no como tres soluciones distintas, sino aplicando una única política de "consistencia eventual entre aggregates" que hoy no existe ni siquiera como principio declarado.

> **Estado final: RESUELTO (DM-01).** Incorporado como Sección 5.11 ("Consistencia entre Aggregates") de `01-domain-discovery.md`, con el principio general y los tres pares listados. La ventana de inconsistencia y la acción compensatoria específicas de cada par quedan explícitamente diferidas a una iteración posterior, por decisión explícita de alcance, no por omisión.

---

## 3. Estados del negocio, por entidad

### 3.1 `Cita`

Estado actual (`EstadoCita`, Domain Discovery): `pendiente | confirmada | en_espera_pago | cancelada | reprogramada | completada | no_show`.

Problemas de modelado detectados:

- **`reprogramada` es un estado ambiguo.** No queda definido si es un estado terminal de la `Cita` original (y se crea una `Cita` nueva sin enlace formal entre ambas — Domain Discovery no define ningún campo tipo `reprogramadaDe`/`reprogramadaA`), o si la misma `Cita` muta su horario y vuelve a `confirmada`. Son dos modelos de dominio distintos con implicaciones distintas para el historial de la clienta (`EstadisticasClienta`) y para los KPIs de cancelaciones/reprogramaciones del dashboard — hoy el enum permite ambas lecturas simultáneamente, lo cual en la práctica significa que **nadie decidió esto todavía**.
- **Transiciones automáticas vs. manuales sin definir.** ¿Qué convierte una `Cita` `confirmada` en `completada`? ¿El paso del tiempo (automático), o una acción explícita de un empleado? Lo mismo para `no_show`: requiere que *algo* detecte, después de la hora de la cita, que nunca se marcó como completada ni se canceló con anticipación. Sin un disparador temporal explícito, estas dos transiciones dependen de que alguien recuerde implementarlas como un job — que es exactamente el tipo de responsabilidad que una máquina de estados explícita haría visible y verificable, y que hoy vive implícita.
- **No existe una tabla de transiciones legales.** Nada impide, en el modelo actual, que código nuevo transicione `completada` → `cancelada`, o `no_show` → `confirmada`, porque `EstadoCita` es solo un valor, no una máquina con reglas de qué transición es válida desde qué estado.
- **Sincronización con `SolicitudAnticipo`** (ver sección 2): `en_espera_pago` depende de un aggregate externo para salir de ese estado, sin que se haya definido qué pasa si esa señal nunca llega.

> **Estado final:** `reprogramada` ambiguo → **RESUELTO** (DM-02: Modelo 2, mutación in-place, misma identidad preservada). Transiciones automáticas/manuales → **RESUELTO** (DM-03: Pregunta Abierta #15). Sin tabla de transiciones legales → **RESUELTO** (DM-04: `EstadoCita` declarado como ciclo de vida gobernado por transiciones válidas, sin diseñar la tabla). Sincronización con `SolicitudAnticipo` → **RESUELTO** de forma general (DM-01, Sección 5.11); la acción compensatoria específica sigue diferida por diseño.

### 3.2 `Conversacion`

Estado actual: dos dimensiones independientes — `ModoConversacion` (`bot | humano`) y `Conversacion.estado` (`activa | cerrada`).

Problemas de modelado detectados:

- **Dos dimensiones de estado no compuestas explícitamente.** ¿Qué significa `cerrada` + `humano` simultáneamente? ¿Es un estado alcanzable? Si no lo es, el modelo debería impedirlo estructuralmente, no dejarlo como una combinación posible por accidente de tener dos campos independientes.
- **El disparador de `activa` → `cerrada` no está definido.** ¿Inactividad por tiempo? ¿Cierre explícito de un empleado? ¿Finalización de un flujo de agendamiento? Ninguno de los documentos lo define.
- **Reapertura no está modelada.** WhatsApp es asíncrono por naturaleza — una clienta puede escribir de nuevo días o semanas después de que su conversación se marcó `cerrada`. ¿Se reabre la misma `Conversacion` (preservando `MemoriaDeConversacion`) o se crea una nueva (perdiendo continuidad)? Esto no es un detalle menor: el requisito explícito del cliente de "recordar conversaciones anteriores" depende directamente de esta decisión.
- **Disparadores de escalamiento concurrentes no están resueltos a nivel de estado.** Si llega un segundo disparador de escalamiento (ej. una segunda queja) mientras la conversación ya está en `modo = humano`, ¿qué pasa? ¿Se ignora por ya estar escalada, se crea un segundo ticket, se actualiza el existente? ADR-021 resuelve la idempotencia a nivel de mensaje duplicado, pero esto es distinto: es una pregunta de **legalidad de transición de estado de dominio**, no de deduplicación técnica.

> **Estado final:** Dos dimensiones no compuestas → **RESUELTO** (DM-05: aclarado como atributos distintos con responsabilidades distintas). Disparador de cierre y reapertura → **RESUELTO** (DM-05: Pregunta Abierta #16). Disparadores de escalamiento concurrentes → **DESCARTADO** (hallazgo huérfano, nunca numerado en la versión original; identificado y revalidado en la auditoría posterior): ninguna de las respuestas posibles cambia algún aggregate/entidad/evento del modelo — es una decisión operativa sin impacto en el dominio, no una Pregunta Abierta de `01-domain-discovery.md`.

### 3.3 `TicketEscalamiento` (Human Handoff)

Estado actual: `abierto | en_atención | cerrado/devuelto` (tal como quedó registrado en el Domain Discovery — nótese que el propio Domain Discovery ya escribió el tercer valor como un solo término compuesto).

Problema de modelado detectado: **`cerrado/devuelto` conflacionó dos resultados de negocio distintos en un solo valor de estado.** "Cerrado" sugiere que el caso quedó resuelto y no requiere más acción. "Devuelto" (control devuelto al bot) es un evento operativo específico que **debería** disparar la transición de `Conversacion.modo` de vuelta a `bot` (ver ADR-016). Si son el mismo valor de estado, no hay forma de distinguir en el propio ticket "¿ya se le devolvió el control a la conversación?" de "¿este ticket está simplemente cerrado por otra razón (ej. la clienta dejó de responder)?" — dos preguntas de negocio distintas que hoy comparten una sola respuesta.

> **Estado final: DESCARTADO (DM-06).** El enum `abierto | en_atención | cerrado/devuelto` citado arriba **nunca existió** en `01-domain-discovery.md` — es una cita errónea de esta review. El documento fuente nunca enumeró valores de `TicketEscalamiento.estado`, y sus Domain Events ya distinguen correctamente `ControlDevueltoABot` de `TicketCerrado` como eventos separados.

### 3.4 `SolicitudAnticipo`

Estado actual: `pendiente | pagado | expirado | reembolsado`. Es, de los cuatro modelos revisados, el más completo — pero su relación de sincronización con `Cita.estado` es la debilidad, no el enum en sí mismo (ver sección 2 y sección 6).

> **Estado final:** Relación de sincronización con `Cita.estado` → **RESUELTO** de forma general (DM-01, Sección 5.11). La alternativa de fusión de aggregates evaluada en la Sección 7 de este documento → **DESCARTADA** (DM-17).

### 3.5 `ListaDeEsperaEntrada`

Estado actual: no se definió explícitamente un enum de estados en el Domain Discovery más allá de mencionar "estado, expiración". No hay invariante declarada de qué impide que **dos** entradas de lista de espera reclamen el mismo cupo liberado simultáneamente — ver escenario de ruptura DM-B en la sección 8.

> **Estado final: DESCARTADO (DM-13).** La exclusividad de emparejamiento ya está implícita en la política FIFO (Pregunta Abierta #9 de `01-domain-discovery.md`); el mecanismo técnico de concurrencia queda fuera del alcance "Solo dominio" declarado por el propio documento.

---

## 4. ¿El dominio necesita State Machines explícitas?

Análisis dedicado, tal como se solicitó, para los cinco candidatos. **No se diseña ninguna máquina aquí — solo se documenta el veredicto y su justificación.**

| Candidato | ¿Necesita State Machine explícita? | Justificación |
|---|---|---|
| **Citas** | **Sí** | El enum actual ya tiene un estado semánticamente ambiguo (`reprogramada`, sección 3.1), transiciones con disparadores no definidos (temporal vs. manual), y ninguna tabla de transiciones legales. Sin una máquina explícita, cualquier caso de uso nuevo puede escribir cualquier estado en cualquier momento — el riesgo no es hipotético, ya se identificaron ambigüedades concretas hoy, antes de escribir una sola línea de código. |
| **Conversaciones** | **Sí** | Tiene dos dimensiones de estado no compuestas explícitamente (`modo` y `estado`), un disparador de cierre no definido, y un caso de reapertura no modelado que afecta directamente un requisito explícito del cliente (memoria de conversación). Además, ADR-016 ya depende implícitamente de que `modo` sea un campo confiable y revalidado — una máquina de estados explícita es lo que le daría a esa dependencia una base formal en vez de una convención de código. |
| **Human Handoff (`TicketEscalamiento`)** | **Sí** | El propio Domain Discovery ya produjo un estado conflacionado (`cerrado/devuelto`, sección 3.3) que oculta una distinción de negocio real. Además, este es el aggregate cuya falla de sincronización con `Conversacion.modo` produce el peor escenario de negocio ya identificado en documentos anteriores (clienta molesta sin respuesta) — es, de los cinco candidatos, el que más justifica una máquina de estados explícita con transiciones y guardas bien definidas, precisamente porque el costo de una transición ilegal aquí es el más alto de todo el sistema. |
| **Recordatorios** | **Sí, pero primero necesita existir como concepto de dominio.** | Hoy `Recordatorio` no es una entidad ni un aggregate en el Domain Discovery — es un efecto colateral de un background job (ADR-018) disparado por una regla temporal ("24h antes"). Esto significa que el negocio no tiene forma de responder, como pregunta de dominio, "¿se le envió el recordatorio a esta clienta?" o "¿falló el envío?" — solo existe como un log técnico de ejecución de job, no como un estado de negocio consultable. Antes de diseñar una máquina de estados para Recordatorios, hace falta primero decidir si "Recordatorio" merece ser un concepto de dominio propio (con estados como `programado → enviado → fallido → confirmado_por_cliente`) en vez de un efecto secundario invisible. |
| **Confirmaciones** | **Sí, con una ambigüedad de negocio previa sin resolver.** | Mismo problema estructural que Recordatorios (no existe como entidad propia), más una ambigüedad adicional no explorada en el Domain Discovery: **¿"confirmación automática" es un mensaje saliente de una sola vía (el sistema le avisa a la clienta), o es un flujo interactivo donde la clienta debe responder para que la cita se considere confirmada?** Si es lo segundo, `Cita` necesitaría un estado intermedio tipo `pendiente_confirmacion_cliente`, distinto de `confirmada`, con su propio vencimiento si la clienta no responde — un sub-flujo completo que hoy no está modelado en absoluto. Esta pregunta debe resolverse con el negocio **antes** de que tenga sentido diseñar la máquina de estados, porque cambia qué estados existen. |

> **Estado final:** los veredictos de "necesidad de máquina de estados" siguen siendo válidos como diagnóstico, pero ninguno recibió el diseño completo de su máquina — por decisión explícita de alcance, no por omisión. Lo que cada candidato sí recibió: **Citas** → aclaraciones + Pregunta #15 (RESUELTO parcialmente, diseño formal diferido). **Conversaciones** → aclaración + Pregunta #16 (RESUELTO parcialmente, diseño formal diferido). **Human Handoff** → la justificación citando el estado conflacionado quedó **DESCARTADA** (DM-06, cita errónea); la necesidad general de definir su ciclo de vida sigue vigente pero sin cambios aplicados. **Recordatorios** → **RESUELTO**: elevado a concepto de dominio explícito (Sección 5.12, DM-07). **Confirmaciones** → **RESUELTO**: entidad creada (5.12) y ambigüedad push/interactiva formalizada (Pregunta #17, DM-08).

---

## 5. Invariantes del dominio

### 5.1 Invariantes bien declaradas
- No-doble-booking de una manicurista específica (`Cita`, restricción única manicurista+rango horario) — bien identificada desde el Domain Discovery y reforzada en ADR-005.
- Inmutabilidad del snapshot de cotización dentro de `Cita` — bien declarada como principio, aunque incompleta (ver 5.2).

*(Sin cambios — esta evaluación se mantiene vigente.)*

### 5.2 Invariantes declaradas pero incompletas

- **Snapshot inmutable sin proceso de corrección.** La regla dice qué *no puede* cambiar, pero no qué hacer cuando un precio se cargó mal en el catálogo y ya hay citas confirmadas con el snapshot erróneo. Una invariante de dominio completa define también el camino sancionado de excepción (ej. un ajuste explícito y auditado, no una edición directa), no solo la regla general.
- **Ventana de validez de una cotización no definida.** Si el catálogo cambia (por override de sucursal, pregunta abierta #10 del Domain Discovery) mientras una clienta está a mitad de conversación con una cotización ya verbalizada por el bot, no hay ninguna regla que defina si esa cotización sigue siendo válida al momento de confirmar, o si debe recalcularse. Sin esta regla, el comportamiento real dependerá de un accidente de implementación, no de una decisión de negocio.

> **Estado final:** Snapshot sin proceso de corrección → **RESUELTO** (DM-09: Pregunta Abierta #13 extendida). Ventana de validez de cotización → **RESUELTO** (DM-10: Pregunta Abierta #18).

### 5.3 Invariantes ausentes que deberían existir

- **Capacidad de sucursal para citas sin manicurista asignada.** El Domain Discovery permite explícitamente citas sin manicurista (clientas sin preferencia). La única invariante de no-doble-booking definida (ADR-005) es "manicurista + rango horario", que **no aplica cuando no hay manicurista asignada**. Esto deja un vacío real: nada impide, tal como está descrito hoy, que se acepten más citas simultáneas sin manicurista que manicuristas disponibles en la sucursal en ese horario. Esta es una invariante de **capacidad de recurso compartido** (cuántas citas sin asignar caben dado el número de manicuristas libres en ese momento), fundamentalmente distinta y más difícil de aplicar que una restricción de unicidad simple — y no está identificada en ningún documento.
- **Consistencia de `Clienta.estado` con citas ya existentes.** Si una clienta se marca `lista_roja` mientras ya tiene una `Cita` `confirmada` sin anticipo pagado, no hay ninguna regla que defina si esa cita, ya en curso, queda retroactivamente sujeta a la política de anticipo. El comportamiento por defecto (probablemente "no aplica retroactivamente") es una decisión de negocio real que nadie tomó explícitamente.
- **Exclusividad de emparejamiento de lista de espera.** No hay invariante declarada que impida que dos entradas de `ListaDeEsperaEntrada` reclamen el mismo cupo liberado simultáneamente (ver escenario DM-B, sección 8).

> **Estado final:** Capacidad de citas sin manicurista → **DESCARTADO (DM-11)**: introducía una decisión de negocio nueva no derivada del texto (existen 5+ modelos igualmente válidos: sobreventa, asignación inmediata, bloqueo, cola de espera, aceptación de riesgo); el cambio aplicado fue revertido. Consistencia de `Clienta.estado` con citas ya existentes → **RESUELTO (DM-12)**: Pregunta Abierta #3 extendida. Exclusividad de lista de espera → **DESCARTADO (DM-13)**.

---

## 6. Reglas de negocio críticas mal modeladas o subespecificadas

- **"Reconocer clientes frecuentes" está modelado como una señal detectada por IA (`ClienteFrecuenteReconocido`), no como una regla determinista sobre `EstadisticasClienta`.** Esto es una tensión directa con el principio arquitectónico ya adoptado de "la IA interpreta, no decide" (ADR-007, `02-architecture-principles.md`): si "frecuente" no tiene un umbral y una fórmula definidos como parte del dominio (ej. "N visitas en los últimos M meses"), entonces quien decide qué es "frecuente" es, de hecho, el criterio implícito del modelo de lenguaje en cada conversación — no una regla de negocio auditable y consistente entre conversaciones. Debería ser un cálculo determinista sobre `EstadisticasClienta` que la IA simplemente consulta, no algo que la IA "detecte" de forma heurística.
- **Regla de expiración de retención de horario por anticipo no pagado** — ya identificada como pregunta abierta de negocio en el Domain Discovery (pregunta #4), pero desde la óptica de modelado es, en realidad, una **transición de estado sin definir** (¿a qué estado pasa `Cita` cuando expira el hold?, ¿vuelve a estar disponible de inmediato o pasa por un estado intermedio?) — no es solo una incógnita de negocio, es un hueco concreto en la máquina de estados de `Cita` (reforzando el veredicto de la sección 4).

> **Estado final:** "Cliente frecuente" determinista vs. IA → **DESCARTADO (DM-14)**: ningún aggregate/entidad/evento cambia según la respuesta (verificado explícitamente); es una decisión de la capa de IA/orquestación (ADR-015), fuera del alcance "Solo dominio" de este documento. Transición de estado al expirar retención de anticipo → **PARCIAL**: ya cubierto de forma general por la Pregunta Abierta #4 preexistente (con su propio supuesto de trabajo) y por la Sección 5.11 (DM-01); nunca se procesó como hallazgo numerado independiente.

---

## 7. Agregados: reevaluación de fronteras

- **`Conversacion` + `Mensaje` como un solo aggregate merece reconsiderarse.** El Domain Discovery ya señaló que el volumen de mensajes probablemente requiere particionamiento técnico, pero nunca cuestionó si `Mensaje` pertenece realmente al mismo límite de consistencia transaccional que `Conversacion`. La única invariante que de verdad necesita atomicidad fuerte es la revalidación de `modo` inmediatamente antes de responder (ADR-016) — no cada inserción de mensaje individual. Esto sugiere que `Conversacion` (con solo `modo`/`estado`) podría ser el aggregate pequeño real, y `Mensaje` un registro independiente correlacionado por `conversacionId`, no una entidad hija dentro del límite transaccional del aggregate. Vale la pena reconsiderar esta frontera antes de implementar, no solo planificar el particionamiento técnico de algo cuyo límite de consistencia ya podría estar mal trazado.
- **`TicketEscalamiento` como aggregate separado de `Conversacion` es la causa raíz del riesgo de sincronización perdida (sección 2, punto 2).** Vale la pena evaluar, como alternativa real (no como rediseño definitivo), si el estado de escalamiento debería vivir como parte del aggregate `Conversacion` mismo (ej. un campo/VO `EscalamientoActivo` dentro de `Conversacion`) en vez de un aggregate independiente — eliminaría la necesidad de sincronización eventual entre dos aggregates para la transición más crítica del sistema (bot ⇄ humano), al costo de que `Conversacion` crezca ligeramente en responsabilidad.
- **`SolicitudAnticipo` como aggregate separado de `Cita` genera la misma clase de riesgo (sección 2, punto 3).** Alternativa a evaluar: que `Cita` sea dueña de su propio "hold" con expiración (un campo de vencimiento nativo en `Cita`), y que `SolicitudAnticipo` sea puramente un registro de pago sin autoridad sobre el estado de la cita — así `Cita` no depende de una señal externa para saber cuándo liberar su propio horario.
- **`Cita` como aggregate root con el snapshot de composición por uña embebido está bien dimensionado** — no se encontró un problema aquí. Se menciona explícitamente para dejar claro que la revisión no encontró solo defectos: este límite de aggregate es coherente con el tamaño recomendado por DDD (todo lo que participa en el mismo invariante transaccional, y nada más).

> **Estado final:** Frontera `Conversacion`+`Mensaje` → **DESCARTADO (DM-15)**: decisión de arquitectura ya explícita en el documento (línea sobre "el límite de consistencia del aggregate se mantiene lógico"), no un vacío. `TicketEscalamiento` como aggregate separado → **DESCARTADO (DM-16)**: alternativa de arquitectura ya mitigada por ADR-016 (Outbox, reintentos, escalamiento-de-escalamiento), no un defecto. `SolicitudAnticipo` como aggregate separado → **DESCARTADO (DM-17)**: mismo patrón, mitigado por ADR-004/ADR-018. La evaluación de `Cita` como bien dimensionado se mantiene sin cambios.

---

## 8. Límites transaccionales y casos donde el modelo puede romperse

**Principio que debería declararse explícitamente:** en todo el flujo de agendamiento, **la única transacción que realmente garantiza el invariante de negocio es la escritura final del aggregate `Cita`** (protegida por la restricción de base de datos, ADR-005). Todo lo anterior — búsqueda de disponibilidad, cotización, sugerencia del bot — es *asesorías*, no una reserva. Ningún documento lo dice en estos términos hoy; debería ser un principio explícito para que ningún futuro desarrollador asuma que "mostrar disponibilidad" equivale a "reservarla".

> **Estado final del principio citado arriba: DESCARTADO por ahora (hallazgo huérfano, nunca numerado; clasificación C tras auditoría).** Depende de cómo se resuelva la Pregunta Abierta #18 de `01-domain-discovery.md` (vigencia de cotización) — afirmarlo hoy como regla absoluta arriesgaría contradecir una resolución futura válida de esa pregunta (ej. un hold temporal durante la conversación, compatible con el texto actual). No incorporado.

A continuación, escenarios concretos de ruptura derivados de los hallazgos anteriores:

**DM-A — Cita atascada en `en_espera_pago` para siempre.** El evento de expiración de `SolicitudAnticipo` se pierde o se retrasa (falla de sincronización, sección 2). Como `Cita` no tiene su propia invariante de expiración de hold (sección 7), el horario queda bloqueado indefinidamente — nadie más puede reservarlo, y la clienta original no sabe que, en la práctica, perdió su cita sin haberlo hecho explícitamente.

**DM-B — Doble asignación de un cupo de lista de espera.** Dos entradas de `ListaDeEsperaEntrada` compiten por el mismo cupo liberado sin una invariante de exclusividad declarada (sección 5.3) — el resultado depende enteramente de si quien implementa el matching se le ocurre agregar un lock, no de una regla que el modelo exija.

**DM-C — Clienta sin respuesta de nadie.** `TicketEscalamiento` pasa a `cerrado/devuelto` (estado conflacionado, sección 3.3) pero el evento que debería devolver `Conversacion.modo` a `bot` se pierde. La conversación queda en `modo = humano` para siempre, de forma silenciosa — el bot no vuelve a responder porque cree que un humano sigue a cargo, y ningún humano está realmente atendiendo. Es el mismo peor-caso de negocio ya señalado como crítico desde el Domain Discovery original, ahora con causa raíz de modelado identificada con precisión.

**DM-D — Citas fantasma por reprogramación.** Si `reprogramada` se trata como estado terminal y se crea una `Cita` nueva sin un campo de enlace explícito (sección 3.1), el historial de la clienta y los KPIs de cancelación/reprogramación del dashboard pueden contar una reprogramación como dos eventos independientes, distorsionando `EstadisticasClienta` y las métricas de negocio sin que nadie lo note hasta auditar los números.

**DM-E — Cobro con precio distinto al cotizado verbalmente.** Sin ventana de validez de cotización definida (sección 5.2), un cambio de precio de catálogo a mitad de conversación puede resultar en que la clienta confirme a un precio distinto del que el bot le comunicó — indeterminado, no por diseño, sino por ausencia de regla.

**DM-F — Política de anticipo no aplicada a una cita ya confirmada.** Una clienta se marca `lista_roja` después de tener ya una `Cita` `confirmada` sin anticipo pagado (sección 5.3) — sin una regla explícita, esa cita probablemente queda exenta por accidente de implementación, no por decisión de negocio, contradiciendo el propósito mismo de la política de lista roja.

> **Estado final de los escenarios de ruptura:** DM-A → **PARCIAL** (par reconocido en Sección 5.11; acción compensatoria específica diferida por diseño). DM-B → **DESCARTADO** (ver DM-13). DM-C → **RESUELTO** (Sección 5.11 + mitigación ya diseñada en ADR-016). DM-D → **RESUELTO** (Modelo 2, DM-02 — la identidad preservada elimina la posibilidad estructural del escenario). DM-E → **RESUELTO** (Pregunta Abierta #18, DM-10). DM-F → **RESUELTO** (Pregunta Abierta #3 extendida, DM-12).

---

## 9. Consistencia global del modelo — evaluación

El modelo estratégico (subdominios, bounded contexts, lenguaje ubicuo) es sólido y no requiere cambios. El modelo táctico tiene una asimetría clara: **los aggregates y sus invariantes de escritura individual están bien pensados (`Cita`, `SolicitudAnticipo` en aislamiento); las máquinas de estado que gobiernan su evolución en el tiempo, y la coordinación entre aggregates distintos, están sub-especificadas de forma consistente en los mismos tres puntos** (Cita↔Anticipo, Conversacion↔TicketEscalamiento, y la propia máquina de estados interna de cada aggregate). No es un problema disperso — es un patrón único que se repite: **el modelo definió bien "qué es cada cosa" y "qué no debe romperse dentro de una sola transacción", pero no terminó de definir "cómo cambia de estado en el tiempo" ni "qué se tolera cuando dos cosas relacionadas se desincronizan temporalmente".**

> **Nota post-auditoría:** este diagnóstico se mantiene válido en cuanto a la necesidad de coordinación entre aggregates (DM-01, **RESUELTO** vía Sección 5.11) y a la necesidad de definir ciclos de vida internos (DM-02 a DM-05, **RESUELTOS** parcial o totalmente). La sugerencia implícita de que esa sub-especificación se resolvería mejor **reconsiderando las fronteras de aggregate** (Cita↔Anticipo, Conversacion↔TicketEscalamiento) fue evaluada y **descartada** (DM-16, DM-17): ambos pares ya tienen mecanismos de confiabilidad diseñados en ADR-016, ADR-004 y ADR-018 — el patrón que sub-especificaba una política de consistencia se resolvió sin necesidad de fusionar ningún aggregate.

---

## 10. Resumen de hallazgos — estado final tras auditoría completa

| ID | Hallazgo (original) | Estado final | Motivo / dónde quedó incorporado |
|---|---|---|---|
| DM-01 | Regla "una transacción, un aggregate" nunca declarada explícitamente; 3 flujos reales la necesitan | **RESUELTO** | Sección 5.11 de `01-domain-discovery.md` |
| DM-02 | `Cita.estado = reprogramada` es ambiguo (¿terminal con nueva Cita, o mutación in-place?) | **RESUELTO** | Modelo 2 (mutación in-place) documentado en 5.1 |
| DM-03 | Transiciones automáticas vs. manuales de `Cita` (completada, no_show) sin disparador definido | **RESUELTO** | Pregunta Abierta #15 |
| DM-04 | Sin tabla de transiciones legales para `Cita` | **RESUELTO** | `EstadoCita` declarado como ciclo de vida gobernado por transiciones válidas (5.1) |
| DM-05 | `Conversacion` tiene dos dimensiones de estado no compuestas, cierre/reapertura no definidos | **RESUELTO** | Aclaración modo/estado + Pregunta Abierta #16 |
| DM-06 | `TicketEscalamiento.estado = cerrado/devuelto` conflaciona dos resultados de negocio distintos | **DESCARTADO** | Cita errónea — ese enum nunca existió en `01-domain-discovery.md` |
| DM-07 | Recordatorios y Confirmaciones no existen como conceptos de dominio, solo como efecto de job | **RESUELTO** | Sección 5.12 (Notificaciones) nueva |
| DM-08 | Ambigüedad de negocio no resuelta: ¿confirmación es push unidireccional o requiere respuesta de la clienta? | **RESUELTO** | Pregunta Abierta #17 |
| DM-09 | Snapshot de cotización inmutable sin proceso de corrección sancionado | **RESUELTO** | Pregunta Abierta #13 extendida |
| DM-10 | Sin ventana de validez de cotización ante cambio de catálogo a mitad de conversación | **RESUELTO** | Pregunta Abierta #18 |
| DM-11 | Sin invariante de capacidad para citas sin manicurista asignada | **DESCARTADO** | Introducía una decisión de negocio nueva, no derivada del texto (5+ modelos igualmente válidos); cambio aplicado y revertido |
| DM-12 | Sin regla de aplicación retroactiva de política de lista roja a citas ya confirmadas | **RESUELTO** | Pregunta Abierta #3 extendida |
| DM-13 | Sin invariante de exclusividad en emparejamiento de lista de espera | **DESCARTADO** | Ya implícito en la política FIFO (Pregunta #9); resto es concurrencia/implementación fuera de alcance |
| DM-14 | "Cliente frecuente" detectado por IA en vez de calculado determinísticamente | **DESCARTADO** | Sin impacto en ningún aggregate/entidad/evento; pertenece a la capa de IA/orquestación (ADR-015) |
| DM-15 | Frontera de aggregate `Conversacion`+`Mensaje` no cuestionada | **DESCARTADO** | Decisión de arquitectura ya explícita en el documento |
| DM-16 | `TicketEscalamiento` como aggregate separado genera riesgo de sincronización (ver DM-C) | **DESCARTADO** | Ya mitigado en ADR-016 |
| DM-17 | `SolicitudAnticipo` como aggregate separado de `Cita` genera el mismo patrón de riesgo (ver DM-A) | **DESCARTADO** | Ya mitigado en ADR-004/ADR-018 |

**Total: 10 RESUELTOS, 7 DESCARTADOS.**

| ID | Escenario de ruptura | Estado final |
|---|---|---|
| DM-A | Cita atascada en `en_espera_pago` | **PARCIAL** — par reconocido en 5.11, acción compensatoria diferida |
| DM-B | Doble asignación de cupo de lista de espera | **DESCARTADO** — ver DM-13 |
| DM-C | Clienta sin respuesta de nadie | **RESUELTO** — 5.11 + mitigación en ADR-016 |
| DM-D | Citas fantasma por reprogramación | **RESUELTO** — ver DM-02 |
| DM-E | Cobro con precio distinto al cotizado | **RESUELTO** — ver DM-10 |
| DM-F | Política de anticipo no aplicada a cita ya confirmada | **RESUELTO** — ver DM-12 |

**Hallazgos huérfanos** (mencionados en el cuerpo de la review original, nunca numerados ni incluidos en su tabla de resumen; detectados y procesados en la auditoría posterior):

| Hallazgo | Estado final | Motivo |
|---|---|---|
| Disparadores de escalamiento concurrentes (sección 3.2) | **DESCARTADO** | Sin impacto en ningún aggregate/entidad/evento; decisión operativa fuera de alcance |
| Principio de "única transacción real" (apertura sección 8) | **DESCARTADO por ahora** | Depende de la resolución pendiente de la Pregunta Abierta #18; afirmarlo hoy arriesga contradecir una resolución futura válida |

---

## 11. Cierre

*(Texto original, conservado como referencia histórica:)* No se emite un veredicto de aprobación en este documento — no fue solicitado y excede su alcance (modelado, no gobernanza de ADRs). Lo que sí se puede afirmar con confianza: **los 22 ADRs no necesitan cambiar por estos hallazgos** (ninguno contradice una decisión arquitectónica ya tomada), pero **el modelo táctico de dominio no está listo para implementarse tal como está documentado hoy** — específicamente, las máquinas de estado de `Cita`, `Conversacion` y `TicketEscalamiento`, y la política de consistencia eventual entre los tres pares de aggregates identificados en la sección 2, deberían diseñarse explícitamente antes de escribir el primer caso de uso que las toque. Eso es trabajo de modelado pendiente, no una revisión adicional de arquitectura.

**Cierre post-auditoría (2026-07-08):** de los 17 hallazgos numerados, **10 fueron incorporados** a `01-domain-discovery.md` (como aclaraciones directas o como nuevas Preguntas Abiertas #3 extendida, #13 extendida, #15, #16, #17, #18) y **7 fueron descartados** tras aplicar un protocolo de refutación activa a cada uno — la mayoría por conflacionar una preocupación de arquitectura/implementación con un vacío de dominio, o por proponer una alternativa de diseño ya mitigada de otra forma en los ADRs. De los dos hallazgos adicionales detectados durante la propia auditoría (nunca numerados en la versión original), ninguno se incorporó. La afirmación original de que "los 22 ADRs no necesitan cambiar" se mantiene vigente — ningún hallazgo, resuelto o descartado, requirió modificar un ADR. La afirmación de que "el modelo táctico no está listo para implementarse" queda matizada: las ambigüedades de modelado genuinas (identidad de `Cita`, gobernanza de `EstadoCita`, ciclo de vida de `Conversacion`, existencia de `Notificacion`) ya están resueltas o formalizadas como Preguntas Abiertas explícitas; lo que queda pendiente es el diseño formal de las máquinas de estado — deliberadamente fuera de alcance de este documento — y la resolución de negocio de las Preguntas Abiertas correspondientes, no una revisión adicional de modelado.
