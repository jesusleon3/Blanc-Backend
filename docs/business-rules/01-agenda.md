# Categoría: Agenda y Disponibilidad (`RN-AGE`)

> Gobierna la asignación de horarios, la resolución de conflictos y la disponibilidad real del negocio. Contiene las reglas de mayor prioridad de todo el repositorio — es donde vive el invariante de no-doble-booking.

---

### RN-AGE-01 — No doble-booking de profesional

| Campo | Valor |
|---|---|
| Rule ID | RN-AGE-01 |
| Nombre | No doble-booking de profesional |
| Objetivo | Garantizar que ningún recurso agendable (manicurista) tenga dos citas confirmadas que se superpongan en el tiempo. |
| Descripción | Una manicurista no puede tener dos citas confirmadas superpuestas en ninguna sucursal. Es el invariante central de todo el Bounded Context de Agenda. |
| Categoría | Agenda y Disponibilidad |
| Alcance | Global |
| Disparador | Cualquier intento de confirmar una cita con una manicurista y rango horario específicos. |
| Precondiciones | Existe al menos una cita ya confirmada para esa manicurista. |
| Entradas requeridas | `manicurista_id`, rango horario propuesto, estado de las citas existentes de esa manicurista. |
| Lógica de negocio | Si el rango horario propuesto se solapa con el rango horario de otra cita ya confirmada de la misma manicurista → rechazar la confirmación. |
| Resultado esperado | La cita no se confirma; el sistema debe ofrecer una alternativa (ver `RN-AGE-04`, `RN-AGE-05`). |
| Ejemplos | Dos clientas intentan tomar el mismo horario con la misma manicurista casi al mismo tiempo — el sistema resuelve el conflicto sin duplicar la reserva. |
| Excepciones | Ninguna — es un invariante sin excepciones de negocio conocidas. |
| Prioridad | Critical |
| Consumidores | IA, Backend, Recepción, QA |
| Dependencias | Es dependencia de: RN-AGE-02, RN-AGE-04, RN-AGE-05, RN-AGE-09, RN-ANT-03, RN-NOT-01, RN-NOT-02 |
| Fuente | `01-domain-discovery.md` §5.1 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada — heredada de la aprobación general del Domain Discovery |
| Notas | El mecanismo técnico concreto (restricción de exclusión en base de datos) vive en `04-data-model.md` §5.1 — esta regla describe el comportamiento de negocio, no la implementación. |

---

### RN-AGE-02 — Revalidación de disponibilidad al confirmar

| Campo | Valor |
|---|---|
| Rule ID | RN-AGE-02 |
| Nombre | Revalidación de disponibilidad al confirmar |
| Objetivo | Evitar que un horario mostrado como disponible durante la conversación deje de estarlo al momento real de confirmar. |
| Descripción | La confirmación de una cita siempre revalida la disponibilidad real en el momento exacto de confirmar, incluso si el horario se mostró como disponible momentos antes. |
| Categoría | Agenda y Disponibilidad |
| Alcance | Global |
| Disparador | Acción de confirmar una cita (por la clienta vía IA, o por un empleado). |
| Precondiciones | Un horario fue previamente mostrado como disponible en la conversación. |
| Entradas requeridas | Estado actual de disponibilidad de la manicurista/sucursal al momento exacto de la confirmación. |
| Lógica de negocio | Antes de persistir la confirmación, re-consultar disponibilidad real; si ya no está disponible, no confirmar y activar `RN-AGE-05`. |
| Resultado esperado | Ninguna cita se confirma sobre un horario que ya no está disponible. |
| Ejemplos | Alta demanda de sábado: el horario mostrado a una clienta minutos antes ya fue tomado por otra al momento de confirmar. |
| Excepciones | Ninguna conocida. |
| Prioridad | Critical |
| Consumidores | IA, Backend, QA |
| Dependencias | Depende de: RN-AGE-01. Es dependencia de: RN-AGE-05 |
| Fuente | `functional-scope.md` §3.1, Restricciones |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-AGE-03 — Manicurista exclusiva

| Campo | Valor |
|---|---|
| Rule ID | RN-AGE-03 |
| Nombre | Manicurista exclusiva |
| Objetivo | Respetar la preferencia de una clienta que exige ser atendida únicamente por una manicurista específica. |
| Descripción | Si la clienta solicita una manicurista de forma exclusiva, el sistema nunca ofrece otra manicurista como alternativa — solo puede ofrecer un horario distinto con la misma persona. |
| Categoría | Agenda y Disponibilidad |
| Alcance | Global |
| Disparador | La clienta marca preferencia de manicurista como "exclusiva" (no solo "preferida"). |
| Precondiciones | La manicurista solicitada no tiene disponibilidad exacta en el horario pedido. |
| Entradas requeridas | Indicador de exclusividad, agenda real de esa manicurista. |
| Lógica de negocio | Si `exclusiva = true` y no hay disponibilidad exacta → ofrecer solo horarios alternativos de la misma manicurista, nunca otra persona. |
| Resultado esperado | La clienta recibe alternativas de horario, nunca de manicurista. |
| Ejemplos | Clienta VIP que siempre pide a la misma manicurista de forma exclusiva; el sistema no debe sugerir a otra persona aunque esté libre de inmediato. |
| Excepciones | Caso sin resolver: si no hay ningún horario disponible con esa manicurista en un rango razonable, no está definido si se ofrece lista de espera o simplemente se informa que no hay disponibilidad (ver `99-open-questions.md`, relacionado con `PA-01`). |
| Prioridad | High |
| Consumidores | IA, Recepción, Backend |
| Dependencias | Depende de: RN-AGE-01. Relacionada con: RN-SEG-04, RN-AGE-04 |
| Fuente | Sesión 02 de Domain Discovery, regla A2 |
| Estado | Aprobada (caso límite del párrafo de Excepciones sin resolver) |
| Versión | 1 |
| Fecha de aprobación | 2026-07-12 |
| Notas | — |

---

### RN-AGE-04 — Fallback de disponibilidad

| Campo | Valor |
|---|---|
| Rule ID | RN-AGE-04 |
| Nombre | Fallback de disponibilidad |
| Objetivo | Evitar perder una reserva cuando no hay disponibilidad exacta, ofreciendo alternativas razonables. |
| Descripción | Si no hay espacio con la manicurista/horario solicitado y la preferencia no es exclusiva, el sistema debe proponer una manicurista alterna o un horario alterno. |
| Categoría | Agenda y Disponibilidad |
| Alcance | Global |
| Disparador | Solicitud de cita sin disponibilidad exacta. |
| Precondiciones | La preferencia de manicurista, si existe, no está marcada como exclusiva (`RN-AGE-03`). |
| Entradas requeridas | Preferencia de manicurista/horario, disponibilidad real de la sucursal. |
| Lógica de negocio | Si no hay disponibilidad exacta y no aplica exclusividad → sugerir manicurista alterna u horario alterno. |
| Resultado esperado | La clienta recibe al menos una alternativa razonable en vez de un simple "no hay disponibilidad". |
| Ejemplos | Clienta pide 5pm con cualquier manicurista disponible; el sistema ofrece 5:30pm o una manicurista distinta a las 5pm. |
| Excepciones | No aplica si la preferencia es exclusiva (ver `RN-AGE-03`). |
| Prioridad | High |
| Consumidores | IA, Recepción |
| Dependencias | Depende de: RN-AGE-01, RN-AGE-03 |
| Fuente | Sesión 02 de Domain Discovery, regla A1 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-07-12 |
| Notas | — |

---

### RN-AGE-05 — Conflicto de confirmación tardía

| Campo | Valor |
|---|---|
| Rule ID | RN-AGE-05 |
| Nombre | Conflicto de confirmación tardía |
| Objetivo | Dar una respuesta conversacional clara ante alta concurrencia, en vez de un error genérico. |
| Descripción | Cuando el horario mostrado durante la conversación ya no está disponible al momento de confirmar (por alta concurrencia), el bot debe tener una respuesta conversacional definida. |
| Categoría | Agenda y Disponibilidad |
| Alcance | Global |
| Disparador | `RN-AGE-02` detecta que el horario ya no está disponible. |
| Precondiciones | Un horario fue mostrado como disponible y luego tomado por otra persona antes de la confirmación. |
| Entradas requeridas | Resultado de la revalidación de `RN-AGE-02`. |
| Lógica de negocio | Ante conflicto detectado → informar el conflicto de forma clara y ofrecer continuar con otra opción, nunca un error genérico. |
| Resultado esperado | La clienta recibe un mensaje conversacional claro y una alternativa, no un error técnico. |
| Ejemplos | "Alta demanda con pocos espacios disponibles" — reactivación del hallazgo F-04 de `ARCHITECTURE_REVIEW.md`, validado como dolor operativo real y frecuente. |
| Excepciones | Ninguna conocida. |
| Prioridad | High |
| Consumidores | IA, Recepción, QA |
| Dependencias | Depende de: RN-AGE-01, RN-AGE-02 |
| Fuente | Sesión 02 de Domain Discovery, regla A3 (reactiva hallazgo F-04 de `ARCHITECTURE_REVIEW.md`) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-07-12 |
| Notas | — |

---

### RN-AGE-06 — Cambio a horario anterior

| Campo | Valor |
|---|---|
| Rule ID | RN-AGE-06 |
| Nombre | Cambio a horario anterior (aviso de mejora de horario) |
| Objetivo | Permitir que una clienta con cita ya confirmada aproveche un horario más conveniente si se libera antes de su cita. |
| Descripción | Una clienta con una cita ya confirmada puede solicitar que se le avise si se libera un horario anterior a esa cita. Si acepta la nueva opción ofrecida, su cita se mueve automáticamente al nuevo horario (reprogramación de la misma cita, no cancelación + creación); si rechaza o no responde en la ventana definida, conserva su cita original sin cambio. |
| Categoría | Agenda y Disponibilidad |
| Alcance | Global |
| Disparador | Se libera un horario compatible anterior a la cita ya confirmada de una clienta con esta solicitud activa. |
| Precondiciones | La clienta tiene una cita confirmada y activó explícitamente el aviso de cambio de horario. |
| Entradas requeridas | Cita original, horario liberado, ventana de respuesta definida por el negocio. |
| Lógica de negocio | Al liberarse un horario compatible → ofrecer a la clienta; si acepta dentro de la ventana → reprogramar la cita original (misma identidad); si rechaza o no responde en la ventana → conservar la cita original sin cambio. |
| Resultado esperado | La cita se mueve al nuevo horario solo con aceptación explícita y dentro de la ventana; en cualquier otro caso, permanece intacta. |
| Ejemplos | Clienta con cita confirmada en dos días pide aviso si se libera algo antes; se libera un horario compatible, se le ofrece, acepta y su cita se mueve automáticamente. |
| Excepciones | ~~No definido: ventana exacta de expiración de la oferta (ver `PA-22`).~~ **Respondido (`DISCOVERY_CHECKLIST.md` 1.4, 2026-08-04):** no hay ventana de tiempo fija — la oferta permanece vigente hasta que el cupo se llena (por esa clienta u otra); si la clienta acepta y el cupo ya se llenó, se le avisa explícitamente que ya no está disponible. |
| Prioridad | High |
| Consumidores | IA, Recepción, Backend |
| Dependencias | Depende de: RN-AGE-01, RN-AGE-02, RN-AGE-05 (mensaje de "ya se llenó"). Relacionada con: RN-AGE-07, RN-AGE-13 |
| Fuente | Sesión de descubrimiento adicional sobre cambio de horario — decisión aprobada conceptualmente, **no consolidada aún en `01-domain-discovery.md`**; `DISCOVERY_CHECKLIST.md` 1.4 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada — aprobación conceptual en conversación, pendiente de sesión formal (`03-domain-discovery-session-03.md`, aún no creada) |
| Notas | Reutiliza los eventos `CitaCancelada`/`HorarioDesbloqueado` ya existentes como disparadores de coincidencia; no introduce Saga, Process Manager ni Value Object de criterios de aceptación (decisión explícita de simplicidad). **Actualizado 2026-08-04:** el mecanismo de expiración es por evento, no por temporizador — no se requiere job de expiración para esta regla. Hallazgo sin resolver, no incorporado aquí: la Dueña sugirió etiquetas de ubicación geográfica de clientas para ofrecer citas por cercanía — es una idea abierta, no una decisión, queda fuera de esta propagación. |

---

### RN-AGE-07 — Lista de espera

| Campo | Valor |
|---|---|
| Rule ID | RN-AGE-07 |
| Nombre | Lista de espera |
| Objetivo | No perder una clienta interesada cuando no hay disponibilidad inmediata. |
| Descripción | Una clienta sin horario disponible puede quedar en lista de espera y ser notificada automáticamente cuando se libera un cupo compatible. |
| Categoría | Agenda y Disponibilidad |
| Alcance | Global |
| Disparador | No hay disponibilidad exacta ni alternativa razonable para la solicitud de la clienta. |
| Precondiciones | La clienta acepta ser agregada a la lista de espera. |
| Entradas requeridas | Servicio deseado, ventana de fechas preferida. |
| Lógica de negocio | Al no haber disponibilidad → ofrecer lista de espera; al liberarse un cupo compatible → notificar automáticamente. |
| Resultado esperado | La clienta recibe notificación automática ante un cupo compatible liberado. |
| Ejemplos | "¡Hola Camila! El sábado tenemos alta demanda, ahorita no hay espacio disponible en la mañana. ¿Te agrego a la lista de espera?" |
| Excepciones | ~~Sin definir: tiempo de expiración exacto y si es FIFO estricto o hay prioridad VIP (ver `PA-23`).~~ **Parcialmente respondido (`DISCOVERY_CHECKLIST.md` 1.5, 2026-08-04):** la entrada expira por evento — cuando se agenda una cita a la clienta, o cuando se completa la cita que ya tenía — no por un tiempo fijo. La prioridad exacta entre varias entradas **no fue reconfirmada explícitamente** para lista de espera; se infiere FIFO por consistencia con `RN-AGE-13` (1.2), sin confirmación literal — sigue pendiente de repregunta puntual. |
| Prioridad | Medium |
| Consumidores | IA, Recepción, Backend |
| Dependencias | Depende de: RN-AGE-01. Relacionada con: RN-AGE-06, RN-AGE-13 |
| Fuente | `01-domain-discovery.md` §5.1/§6; `DISCOVERY_CHECKLIST.md` 1.5 |
| Estado | Aprobada (expiración por evento confirmada; prioridad exacta sin reconfirmar) |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-AGE-08 — Snapshot inmutable de cotización

| Campo | Valor |
|---|---|
| Rule ID | RN-AGE-08 |
| Nombre | Snapshot inmutable de cotización |
| Objetivo | Proteger a la clienta y al negocio de disputas de precio ante cambios posteriores del catálogo. |
| Descripción | El precio y la duración de una cita quedan fijos en el momento de la confirmación y no cambian aunque el catálogo de precios se actualice después. |
| Categoría | Agenda y Disponibilidad |
| Alcance | Global |
| Disparador | Confirmación de una cita. |
| Precondiciones | Existe una cotización calculada para la composición de servicios solicitada. |
| Entradas requeridas | Resultado del motor de duración/cotización (`RN-COT-01`), convención de dinero como entero (`RN-COT-07`). |
| Lógica de negocio | Al confirmarse la cita → congelar precio y duración calculados; cambios posteriores del catálogo nunca alteran una cita ya confirmada. |
| Resultado esperado | Ninguna cita ya confirmada cambia de precio/duración por un cambio de catálogo posterior. |
| Ejemplos | Un precio de servicio sube la próxima semana; una cita ya confirmada esta semana conserva su precio original. |
| Excepciones | No definido: tratamiento de un snapshot que fue erróneo desde el inicio por error humano de captura (distinto de un cambio legítimo posterior del catálogo). |
| Prioridad | Critical |
| Consumidores | Backend, QA, Auditoría |
| Dependencias | Depende de: RN-COT-01, RN-COT-07 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #13 (supuesto de trabajo) |
| Estado | Aprobada como supuesto de trabajo |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | El tratamiento de un snapshot erróneo por error humano es un caso de uso todavía sin diseñar (ver `04-data-model.md` §7.2) — no es una pregunta de esta carpeta, es de diseño de caso de uso. |

---

### RN-AGE-09 — Google Calendar como vista de solo lectura

| Campo | Valor |
|---|---|
| Rule ID | RN-AGE-09 |
| Nombre | Google Calendar como vista de solo lectura |
| Objetivo | Evitar una fuente de verdad dividida sobre la disponibilidad real. |
| Descripción | La plataforma es la única fuente de verdad sobre la disponibilidad real de horarios; Google Calendar es una vista de consulta para el negocio, no el lugar donde se decide si hay espacio disponible. |
| Categoría | Agenda y Disponibilidad |
| Alcance | Global |
| Disparador | Cualquier cambio de estado de una cita (confirmación, reprogramación, cancelación). |
| Precondiciones | Ninguna. |
| Entradas requeridas | Estado de la cita en la plataforma. |
| Lógica de negocio | Toda decisión de disponibilidad se resuelve contra el modelo interno de la plataforma; la sincronización hacia Google Calendar es unidireccional (push), nunca al revés. |
| Resultado esperado | Google Calendar refleja el estado de la plataforma; nunca decide disponibilidad por sí mismo. |
| Ejemplos | Toda cita confirmada, reprogramada o cancelada se refleja automáticamente en el calendario visual de la sucursal correspondiente. |
| Excepciones | Ninguna conocida — riesgo documentado si el negocio edita directamente en Google Calendar fuera de la plataforma. |
| Prioridad | High |
| Consumidores | Backend, Recepción, Gerente |
| Dependencias | Depende de: RN-AGE-01. Relacionada con: RN-SUC-04 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #1 (supuesto de trabajo); ADR-006; `DISCOVERY_CHECKLIST.md` 1.1 |
| Estado | Aprobada — **confirmada explícitamente por la Dueña (2026-08-03)** |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 (confirmación explícita) |
| Notas | **Actualizado 2026-08-04:** la Dueña exige además que la sincronización sea "en tiempo real o cerca de eso" — requisito de latencia no capturado antes, pendiente de cotejar contra el SLO de rezago de Outbox en `03-technical-architecture.md` §6.3 (fuera de alcance de esta propagación, Paso 3 no toca ese documento). |

---

### RN-AGE-10 — Horario y festivos por sucursal

| Campo | Valor |
|---|---|
| Rule ID | RN-AGE-10 |
| Nombre | Horario y festivos por sucursal |
| Objetivo | Reflejar la operación real de cada sucursal en la disponibilidad calculada. |
| Descripción | Cada sucursal configura su propio horario semanal, descansos y días festivos. El horario semanal es **partido por bloques discontinuos** (ej. mañana y tarde con un corte de mediodía), no un rango continuo. |
| Categoría | Agenda y Disponibilidad |
| Alcance | Por sucursal |
| Disparador | Cálculo de disponibilidad para cualquier solicitud de cita. |
| Precondiciones | La sucursal tiene un horario semanal y festivos configurados. |
| Entradas requeridas | Horario semanal (por bloques), festivos, sucursal. |
| Lógica de negocio | Ninguna cita puede agendarse fuera del horario configurado de la sucursal, en un día festivo configurado, ni **cruzando el corte entre dos bloques del horario partido** (ej. una cita de 2 horas no puede iniciar de forma que termine después del corte de mediodía). |
| Resultado esperado | La disponibilidad ofrecida siempre respeta el horario real de la sucursal, incluidos sus bloques internos. |
| Ejemplos | Confirmado por la Dueña (`DISCOVERY_CHECKLIST.md` 1.3, 2026-08-04): lunes a viernes 9am-12pm y 3pm-6pm; sábado 9am-3pm; domingo cerrado. Una cita de 2 horas no puede agendarse a las 11am porque cruzaría el corte de las 12pm. |
| Excepciones | Bloqueos manuales (`RN-AGE-11`) restringen aún más la disponibilidad dentro del horario configurado. |
| Prioridad | Medium |
| Consumidores | IA, Backend, Recepción |
| Dependencias | Depende de: RN-SUC-01. Es dependencia de: RN-AGE-01, RN-AGE-02 |
| Fuente | `01-domain-discovery.md` §5.7; `DISCOVERY_CHECKLIST.md` 1.3 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | **Actualizado 2026-08-04:** el invariante de "no cruzar el corte" es consecuencia directa de modelar el horario como bloques discontinuos — no requiere un mecanismo nuevo, solo que el motor de disponibilidad trate cada bloque como un rango independiente al calcular si un servicio compuesto cabe. |

---

### RN-AGE-11 — Bloqueo manual de horarios

| Campo | Valor |
|---|---|
| Rule ID | RN-AGE-11 |
| Nombre | Bloqueo manual de horarios |
| Objetivo | Permitir que el negocio reserve tiempo fuera de la disponibilidad ofrecida a clientas (mantenimiento, eventos, ausencias). |
| Descripción | Un administrador puede bloquear un horario o configurar un día festivo, con motivo, por sucursal y/o manicurista. |
| Categoría | Agenda y Disponibilidad |
| Alcance | Por sucursal |
| Disparador | Acción explícita de un administrador. |
| Precondiciones | Rol con permiso de configuración (`RN-SEG-01`). |
| Entradas requeridas | Rango horario, sucursal, manicurista (opcional), motivo. |
| Lógica de negocio | Un rango bloqueado nunca se ofrece como disponible, independientemente del horario general configurado. |
| Resultado esperado | El rango bloqueado queda excluido de toda oferta de disponibilidad. |
| Ejemplos | Un administrador bloquea un horario o configura un día festivo para una sucursal. |
| Excepciones | Ninguna conocida. |
| Prioridad | Medium |
| Consumidores | Backend, Administrador |
| Dependencias | Depende de: RN-AGE-10 |
| Fuente | `01-domain-discovery.md` §5.1 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-AGE-12 — Domingo cerrado

| Campo | Valor |
|---|---|
| Rule ID | RN-AGE-12 |
| Nombre | Domingo cerrado en las 3 sucursales |
| Objetivo | Reflejar que el negocio no opera los domingos, sin dejar a la clienta sin respuesta. |
| Descripción | Confirmado como regla de negocio real (no solo dato de mockup): las sucursales cierran los domingos — no se agendan citas ese día — pero **sí se responden mensajes de WhatsApp** con normalidad. |
| Categoría | Agenda y Disponibilidad |
| Alcance | Global |
| Disparador | Cálculo de disponibilidad o recepción de un mensaje en domingo. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Día de la semana. |
| Lógica de negocio | Domingo nunca ofrece disponibilidad de citas; los mensajes entrantes en domingo se responden con normalidad (no hay modo silencio). |
| Resultado esperado | Ninguna cita se agenda en domingo; ninguna clienta que escribe en domingo queda sin respuesta. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.3 (2026-08-04): *"si alguien manda mensaje en domingo igual se le conteste, pero no se trabaja, no se pueden poner citas en domingo."* |
| Excepciones | Ninguna conocida. |
| Prioridad | Low |
| Consumidores | IA, Backend, Recepción |
| Dependencias | Relacionada con: RN-AGE-10 |
| Fuente | `mockup/js/data.js` (dato original); `DISCOVERY_CHECKLIST.md` 1.3 (confirmación real) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | **Actualizado 2026-08-04:** deja de ser un dato asumido del mockup — es una regla de negocio confirmada por la Dueña. Ver `RN-AGE-10` para el horario completo por sucursal. |

---

### RN-AGE-13 — Prioridad entre candidatas a horario liberado

| Campo | Valor |
|---|---|
| Rule ID | RN-AGE-13 |
| Nombre | Prioridad entre candidatas a un horario liberado |
| Objetivo | Definir a quién se ofrece primero un horario liberado cuando hay más de una clienta interesada (lista de espera y/o cambio de horario). |
| Descripción | Gana la primera clienta que confirme (FIFO) — no hay criterio de prioridad VIP ni de otro tipo. |
| Categoría | Agenda y Disponibilidad |
| Alcance | Global |
| Disparador | Se libera un horario con más de una clienta candidata (lista de espera y/o cambio de horario). |
| Precondiciones | Más de una clienta candidata al mismo horario liberado. |
| Entradas requeridas | Orden de confirmación de las clientas candidatas. |
| Lógica de negocio | Se ofrece a todas las candidatas; la primera en confirmar se queda con el horario; al resto se les informa que ya no está disponible. |
| Resultado esperado | El horario se asigna sin ambigüedad a la primera clienta que confirma. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.2 (2026-08-04): *"El primero que conteste."* |
| Excepciones | No aplica. |
| Prioridad | High |
| Consumidores | IA, Recepción, Backend |
| Dependencias | Es dependencia de: RN-AGE-06, RN-AGE-07 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #9; Sesión 02, pregunta abierta 8; `DISCOVERY_CHECKLIST.md` 1.2 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | Es la única pregunta de esta categoría que bloqueaba directamente dos mecanismos distintos (`RN-AGE-06` y `RN-AGE-07`) al mismo tiempo — ambos quedan desbloqueados. **Hallazgo sin propagar (requiere autorización):** la respuesta también reveló una capacidad nueva sin Rule ID — ofrecer horario en **otra sucursal** cuando no hay disponibilidad en la solicitada — no se crea un Rule ID nuevo en esta pasada. **Nota de auditoría (`PLATFORM_ARCHITECTURE_MODEL.md` §7):** ese documento asocia este Rule ID con `PoliticaDeRiesgoCliente`, pero su contenido real (FIFO de agenda) no corresponde a esa Domain Policy — discrepancia ya señalada en `MASTER_PROPAGATION_PLAN.md`, no corregida aquí por tratarse de un documento congelado. |
