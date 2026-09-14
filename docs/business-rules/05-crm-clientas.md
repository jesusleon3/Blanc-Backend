# Categoría: CRM / Clientas (`RN-CRM`)

> Gobierna la identidad, clasificación y trato personalizado de cada clienta.

---

### RN-CRM-01 — Identidad global de clienta por teléfono

| Campo | Valor |
|---|---|
| Rule ID | RN-CRM-01 |
| Nombre | Identidad global de clienta por número de teléfono |
| Objetivo | Reconocer a la misma clienta sin importar en qué sucursal se presente. |
| Descripción | La identidad de una clienta es global por número de teléfono, no se duplica por sucursal — su historial y estadísticas cruzan todas las sucursales que visite. |
| Categoría | CRM / Clientas |
| Alcance | Global |
| Disparador | Cualquier interacción nueva por WhatsApp. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Número de teléfono. |
| Lógica de negocio | El número de teléfono es la clave única de identidad de la clienta en todo el sistema, sin importar la sucursal de contacto. |
| Resultado esperado | El historial de una clienta se mantiene consistente sin importar qué sucursal visite. |
| Ejemplos | Una clienta con "sucursal favorita" puede haber visitado otras — su historial las cruza todas. |
| Excepciones | Ninguna conocida. |
| Prioridad | Medium |
| Consumidores | IA, Backend, CRM, Reportes |
| Dependencias | Es dependencia de: RN-AUD-02 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #6 (supuesto de trabajo) |
| Estado | Aprobada como supuesto de trabajo |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-CRM-02 — Clasificación de clienta

| Campo | Valor |
|---|---|
| Rule ID | RN-CRM-02 |
| Nombre | Clasificación normal / VIP / lista roja / bloqueada |
| Objetivo | Reflejar el estado operativo de una clienta para dar el trato correspondiente. |
| Descripción | Toda clienta tiene un estado de clasificación: normal, VIP, lista roja o bloqueada. |
| Categoría | CRM / Clientas |
| Alcance | Global |
| Disparador | Alta de la clienta (estado inicial `normal`) o acción explícita de un empleado. |
| Precondiciones | Ninguna para el estado inicial; para los demás, una acción de un empleado con permiso. |
| Entradas requeridas | Estado actual, acción solicitada. |
| Lógica de negocio | El estado determina el trato aplicable: VIP (prioridad/beneficios), lista roja (`RN-CRM-03`), bloqueada (`RN-CRM-04`). |
| Resultado esperado | El sistema aplica consistentemente las reglas asociadas al estado vigente de la clienta. |
| Ejemplos | Andrea Sofía Ramírez Castillo: `vip`. Lucía Martínez Aguilar: `lista_roja`. Ximena Morales Peña: `bloqueada`. |
| Excepciones | Ninguna conocida. |
| Prioridad | Medium |
| Consumidores | IA, Recepción, Backend, Dashboard |
| Dependencias | Es dependencia de: RN-CRM-03, RN-CRM-04, RN-ANT-01 |
| Fuente | `01-domain-discovery.md` §5.5 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-CRM-03 — Lista roja exige anticipo y aprobación de cancelación

| Campo | Valor |
|---|---|
| Rule ID | RN-CRM-03 |
| Nombre | Lista roja exige anticipo y aprobación de cancelación |
| Objetivo | Mitigar el riesgo de cancelaciones frecuentes sin bloquear del todo a la clienta. |
| Descripción | Una clienta marcada en lista roja requiere el pago de un anticipo antes de que su cita quede confirmada en firme, y cualquier cancelación de su parte requiere aprobación de un empleado. |
| Categoría | CRM / Clientas |
| Alcance | Global |
| Disparador | Clienta en `lista_roja` intenta agendar o cancelar una cita. |
| Precondiciones | `estado = lista_roja`. |
| Entradas requeridas | Estado de la clienta, acción solicitada (agendar/cancelar). |
| Lógica de negocio | Al agendar → activa `RN-ANT-01`. Al intentar cancelar → la acción queda pendiente de aprobación de un empleado, no se ejecuta directamente. |
| Resultado esperado | Ninguna cancelación de una clienta en lista roja se ejecuta sin revisión humana. |
| Ejemplos | `conv-5` en el mockup: Renata Salazar Nava intenta cancelar; el bot indica que su cuenta requiere confirmación de un empleado y escala. |
| Excepciones | Ninguna conocida. |
| Prioridad | High |
| Consumidores | IA, Recepción, Backend |
| Dependencias | Depende de: RN-CRM-02. Es dependencia de: RN-ANT-01 |
| Fuente | `01-domain-discovery.md` §5.5/§5.6 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-CRM-04 — Clienta bloqueada no puede agendar

| Campo | Valor |
|---|---|
| Rule ID | RN-CRM-04 |
| Nombre | Clienta bloqueada no puede agendar |
| Objetivo | Impedir que una clienta con comportamiento inaceptable siga usando el servicio hasta una revisión explícita. |
| Descripción | Una clienta bloqueada no puede agendar citas hasta que un empleado la desbloquee explícitamente. |
| Categoría | CRM / Clientas |
| Alcance | Global |
| Disparador | Clienta en `estado = bloqueada` intenta agendar. |
| Precondiciones | `estado = bloqueada`. |
| Entradas requeridas | Estado de la clienta. |
| Lógica de negocio | Si `estado = bloqueada` → rechazar cualquier intento de agendamiento hasta un desbloqueo explícito. |
| Resultado esperado | Ninguna clienta bloqueada logra agendar sin intervención humana previa. |
| Ejemplos | Ximena Morales Peña: bloqueada por lenguaje ofensivo hacia el personal. |
| Excepciones | Ninguna conocida. |
| Prioridad | High |
| Consumidores | IA, Backend |
| Dependencias | Depende de: RN-CRM-02 |
| Fuente | `01-domain-discovery.md` §5.5 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-CRM-05 — Asignación manual a lista roja

| Campo | Valor |
|---|---|
| Rule ID | RN-CRM-05 |
| Nombre | Asignación manual a lista roja |
| Objetivo | Mantener control humano sobre una decisión con impacto económico directo en la clienta. |
| Descripción | La asignación a lista roja es manual, realizada por un empleado; el sistema solo sugiere candidatas con base en historial de cancelaciones, nunca decide por sí mismo. |
| Categoría | CRM / Clientas |
| Alcance | Global |
| Disparador | Historial de cancelaciones de una clienta supera un patrón observable. |
| Precondiciones | Ninguna automática — requiere acción explícita de un empleado. |
| Entradas requeridas | Historial de cancelaciones. |
| Lógica de negocio | El sistema puede sugerir, nunca asignar `lista_roja` de forma automática. |
| Resultado esperado | Toda asignación a lista roja queda atribuida a la decisión de un empleado específico. |
| Ejemplos | `aud-3` en el mockup: "Mariana Cid marcó a Renata Salazar Nava como lista roja tras 3 cancelaciones" — acción de un empleado, registrada en auditoría. |
| Excepciones | Umbral exacto de sugerencia no definido (ver `RN-CRM-06`). |
| Prioridad | High |
| Consumidores | Backend, Gerente, Recepción |
| Dependencias | Depende de: RN-CRM-02. Relacionada con: RN-CRM-06, RN-CRM-07, RN-AUD-01 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #3 (supuesto de trabajo) |
| Estado | Aprobada como supuesto de trabajo |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-CRM-06 — Umbral exacto para sugerir lista roja

| Campo | Valor |
|---|---|
| Rule ID | RN-CRM-06 |
| Nombre | Umbral exacto para sugerir lista roja |
| Objetivo | Definir con precisión qué activa la sugerencia automática de lista roja. |
| Descripción | El disparador **no es un umbral acumulado** (no se cuentan N cancelaciones en una ventana de días) — es un **disparador por incidente individual**: cualquier cancelación o solicitud de reagendo dentro de los 60 a 0 minutos antes de la cita, o cualquier no-show, activa la sugerencia. El sistema solo sugiere (`RN-CRM-05`); la Dueña debe aceptar la sugerencia explícitamente. |
| Categoría | CRM / Clientas |
| Alcance | Global |
| Disparador | Una clienta cancela o solicita reagendar dentro de los 60-0 minutos antes de su cita, o no se presenta (no-show). |
| Precondiciones | **No aplica cuando ya hay anticipo pagado sobre esa cita específica** — en ese caso rige `RN-ANT-04` (ventana de 48h), una regla distinta y paralela que no debe confundirse con esta. |
| Entradas requeridas | Hora de la cita, hora de la cancelación/solicitud de reagendo, o marca de no-show. |
| Lógica de negocio | Si `hora_cancelacion >= hora_cita - 60min` (o después de la hora de la cita), o si la cita se marca `no_show` → generar sugerencia de lista roja para revisión de la Dueña. Nunca se asigna automáticamente (`RN-CRM-05`). |
| Resultado esperado | Toda cancelación/reagendo tardío o no-show genera una sugerencia revisable, sin excepción y sin necesitar historial acumulado previo. |
| Ejemplos | Consolida tres respuestas independientes y consistentes de la Dueña: `DISCOVERY_CHECKLIST.md` 1.6 — *"si el cliente pide reagendar o cancelar la cita de 59 minutos para abajo antes de la cita... se manda la sugerencia de agregar a lista roja"*; 1.7 — *"de 60 a 0 minutos antes de la cita se manda sugerencia de lista roja"*; 1.18 — *"se da la sugerencia en cancelaciones a menos de una hora, o petición de reagendar a menos de una hora... y también cuando no se aparezca la persona (no show)."* |
| Excepciones | No aplica cuando la cita tiene anticipo pagado — ver `RN-ANT-04` (ventana de 48h, regla distinta). |
| Prioridad | High |
| Consumidores | Backend, Gerente, Recepción |
| Dependencias | Depende de: RN-CRM-05. Relacionada con: RN-ANT-04 (no confundir — ver Precondiciones) |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #3; `DISCOVERY_CHECKLIST.md` 1.6 + 1.7 + 1.18 (tres fuentes independientes, mismo patrón) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | **Consolidación 2026-08-04:** esta es la única definición de la "regla de 59-60 minutos" en todo el repositorio — no se duplica en `RN-AGE-*` ni en ningún otro Rule ID. Cambia la forma de la regla respecto a lo asumido originalmente (de umbral acumulado a disparador por incidente), no solo rellena un valor. |

---

### RN-CRM-07 — Tratamiento de citas confirmadas al marcar lista roja

| Campo | Valor |
|---|---|
| Rule ID | RN-CRM-07 |
| Nombre | Tratamiento de citas ya confirmadas al marcar lista roja |
| Objetivo | Definir el tratamiento de citas ya confirmadas al marcar lista roja. |
| Descripción | No aplica retroactivamente: una cita ya confirmada conserva su condición sin cambio; solo las solicitudes futuras (nueva cita a agendar) quedan sujetas a la política de lista roja (sugerencia de anticipo). |
| Categoría | CRM / Clientas |
| Alcance | Global |
| Disparador | Una clienta con cita(s) ya confirmada(s) es marcada en lista roja. |
| Precondiciones | Existe al menos una cita confirmada previa a la marca de lista roja. |
| Entradas requeridas | Estado de la(s) cita(s) existente(s), momento de la marca de lista roja. |
| Lógica de negocio | Si la cita fue confirmada antes de la marca de lista roja → conserva su condición, sin exigir anticipo retroactivo. Si la clienta agenda de nuevo después de la marca → aplica `RN-ANT-01`/`RN-CRM-03`. |
| Resultado esperado | Ninguna cita ya confirmada cambia de condición por una marca de lista roja posterior. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.19 (2026-08-04): *"Si ya tenía una cita hecha no es lista roja, pero si es para volver a agendar, o algo después de eso, se da sugerencia y se pide anticipo."* |
| Excepciones | Ninguna. |
| Prioridad | High |
| Consumidores | Backend, Recepción |
| Dependencias | Depende de: RN-CRM-05. Relacionada con: RN-AGE-08 (mismo principio de no retroactividad ya usado en el snapshot de cotización) |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #3 (segunda parte); `DISCOVERY_CHECKLIST.md` 1.19 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | Coincide exactamente con la recomendación original — consistente con `RN-AGE-08`. |

---

### RN-CRM-08 — Etiquetas de texto libre

| Campo | Valor |
|---|---|
| Rule ID | RN-CRM-08 |
| Nombre | Etiquetas de cliente de texto libre |
| Objetivo | Permitir trato personalizado más allá de la clasificación formal de estado. |
| Descripción | Las etiquetas de clienta son de texto libre, definidas por el personal según lo consideren útil, sin limitarse a una lista predefinida. |
| Categoría | CRM / Clientas |
| Alcance | Global |
| Disparador | Acción explícita de un empleado sobre el perfil de una clienta. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Texto de la etiqueta. |
| Lógica de negocio | Cualquier empleado con acceso al perfil de clienta puede agregar o quitar etiquetas de texto libre. |
| Resultado esperado | El perfil de la clienta refleja las etiquetas asignadas por el personal. |
| Ejemplos | "Alergia", "VIP", "Cliente conflictiva", "Frecuente", "Influencer" (etiquetas reales del mockup). |
| Excepciones | Ninguna conocida sobre el mecanismo en sí — ver `RN-CRM-09` para gobernanza de alcance/permisos. |
| Prioridad | Medium |
| Consumidores | IA, Recepción, CRM, Dashboard |
| Dependencias | Relacionada con: RN-CRM-09 |
| Fuente | Sesión 02 de Domain Discovery, regla F2 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-07-12 |
| Notas | — |

---

### RN-CRM-09 — Gobernanza de etiquetas

| Campo | Valor |
|---|---|
| Rule ID | RN-CRM-09 |
| Nombre | Gobernanza de etiquetas de cliente |
| Objetivo | Definir el alcance y los permisos de las etiquetas de clienta. |
| Descripción | Confirmado: texto libre, sin catálogo cerrado; alcance **global** (no por sucursal); **ninguna** etiqueta requiere permiso especial para asignarse. |
| Categoría | CRM / Clientas |
| Alcance | Global |
| Disparador | Acción explícita de un empleado sobre el perfil de una clienta. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Texto de la etiqueta. |
| Lógica de negocio | Cualquier empleado con acceso al perfil de clienta puede agregar/quitar etiquetas de texto libre, con alcance global, sin restricción de permiso. |
| Resultado esperado | El sistema permite gestión de etiquetas sin fricción de permisos ni de catálogo cerrado. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.20 (2026-08-04): *"No requieren permiso especial, el alcance sería global."* |
| Excepciones | Ninguna. |
| Prioridad | Medium |
| Consumidores | IA, Recepción, CRM, Dashboard |
| Dependencias | Depende de: RN-CRM-08 |
| Fuente | Sesión 02 de Domain Discovery, pregunta abierta 3; `DISCOVERY_CHECKLIST.md` 1.20 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | Coincide exactamente con la recomendación original. La Dueña aclaró que hoy no se usan etiquetas operativamente — es una capacidad disponible, no prioritaria. |
