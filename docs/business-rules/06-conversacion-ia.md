# Categoría: Conversación e IA (`RN-CONV`)

> Gobierna el comportamiento de la inteligencia artificial en la conversación con la clienta. Contiene el principio rector de todo el sistema: la IA interpreta, nunca decide.

---

### RN-CONV-01 — La IA interpreta, nunca decide

| Campo | Valor |
|---|---|
| Rule ID | RN-CONV-01 |
| Nombre | La IA interpreta, nunca decide |
| Objetivo | Garantizar que ninguna decisión de negocio (precio, disponibilidad, políticas de clienta, excepciones) quede en manos de la interpretación libre de un modelo de lenguaje. |
| Descripción | La inteligencia artificial interpreta el lenguaje de la clienta, pero nunca decide por sí sola sobre precios, disponibilidad, políticas de la clienta (lista roja, bloqueo) ni excepciones — toda acción de negocio pasa siempre por las reglas ya definidas del sistema. |
| Categoría | Conversación e IA |
| Alcance | Global |
| Disparador | Cualquier interacción de la IA con una clienta. |
| Precondiciones | Ninguna — es un principio rector sin excepciones. |
| Entradas requeridas | Mensaje de la clienta, contexto de la conversación. |
| Lógica de negocio | La IA extrae intención y datos estructurados; toda decisión de negocio se resuelve consultando las reglas de este repositorio (u otro mecanismo determinista), nunca por generación libre del modelo. |
| Resultado esperado | Ninguna decisión de negocio queda expuesta a alucinación o interpretación libre del modelo de lenguaje. |
| Ejemplos | La IA interpreta "quiero gelish y dos uñas con diseño francés", pero el precio/duración se calcula con `RN-COT-01`, no con lo que el modelo "cree" que cuesta. |
| Excepciones | Ninguna. |
| Prioridad | Critical |
| Consumidores | IA, Backend, QA |
| Dependencias | Es dependencia de: RN-CONV-02, RN-CONV-03, RN-CONV-05, RN-CONV-08, RN-CONV-09, RN-ESC-01, RN-ESC-02 |
| Fuente | `01-domain-discovery.md` (principio "la IA interpreta, no decide"); `02-architecture-principles.md` (Principios para IA) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | Este es, en la práctica, el principio que justifica la existencia misma de este Business Rules Engine: si la IA nunca debe inventar reglas, debe existir un lugar determinista donde consultarlas — esta carpeta es ese lugar. |

---

### RN-CONV-02 — Validación estructurada antes de tener efecto

| Campo | Valor |
|---|---|
| Rule ID | RN-CONV-02 |
| Nombre | Validación estructurada antes de tener efecto |
| Objetivo | Evitar que una alucinación del modelo de lenguaje se traduzca directamente en un cobro o una acción de negocio. |
| Descripción | Toda interpretación que determine un precio o una composición de servicio debe validarse contra un formato estructurado antes de tener efecto — nunca se actúa sobre una interpretación de texto libre sin validar. |
| Categoría | Conversación e IA |
| Alcance | Global |
| Disparador | La IA genera una interpretación con efecto de precio o composición de servicio. |
| Precondiciones | La interpretación involucra dinero o composición de servicio. |
| Entradas requeridas | Salida estructurada de la IA (no solo texto libre). |
| Lógica de negocio | Antes de calcular precio/duración, la interpretación de la IA debe pasar por un esquema de validación estructurado; si no valida, no se actúa sobre ella. |
| Resultado esperado | Ningún cobro o cálculo se basa en texto libre sin validar. |
| Ejemplos | Interpretar "gelish y dos uñas con diseño francés" debe producir una estructura validable (servicio, modificador, conteo de uñas), no solo una oración. |
| Excepciones | Ninguna. |
| Prioridad | Critical |
| Consumidores | Backend, QA |
| Dependencias | Depende de: RN-CONV-01 |
| Fuente | `02-architecture-principles.md` (Principios para IA) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-CONV-03 — Clarificación ante respuesta ambigua

| Campo | Valor |
|---|---|
| Rule ID | RN-CONV-03 |
| Nombre | Clarificación ante respuesta ambigua |
| Objetivo | Evitar interpretar mal una respuesta ambigua y evitar escaladas innecesarias a humano. |
| Descripción | Si el cliente responde de forma ambigua a una pregunta compuesta (ej. "sí" a dos preguntas), el bot debe re-preguntar para clarificar antes de considerar escalar a humano. |
| Categoría | Conversación e IA |
| Alcance | Global |
| Disparador | La IA detecta una respuesta ambigua frente a una pregunta compuesta que hizo. |
| Precondiciones | La IA formuló más de una pregunta en el mismo mensaje. |
| Entradas requeridas | Historial de la pregunta compuesta, respuesta de la clienta. |
| Lógica de negocio | Si la respuesta no permite determinar a cuál pregunta responde → re-preguntar explícitamente antes de continuar o de escalar. |
| Resultado esperado | La clienta recibe una pregunta de clarificación en vez de una interpretación asumida o una escalada innecesaria. |
| Ejemplos | `conv-9` en el mockup: "¿Podrías confirmarme a cuál de las dos preguntas te refieres — el día de tu cita o si tu cumpleaños es esta semana?" |
| Excepciones | Ninguna conocida. |
| Prioridad | High |
| Consumidores | IA, QA |
| Dependencias | Depende de: RN-CONV-01. Relacionada con: RN-CONV-05 |
| Fuente | Sesión 02 de Domain Discovery, regla C1 |
| Estado | Aprobada (aclaración de redacción del principio 9.6 de `02-architecture-principles.md` aún sin aplicar en ese documento) |
| Versión | 1 |
| Fecha de aprobación | 2026-07-12 |
| Notas | Esta regla matiza el principio 9.6 existente sin cambiar su decisión de fondo — la IA sigue escalando ante ambigüedad genuina tras clarificar. |

---

### RN-CONV-04 — Trazabilidad de toda decisión de IA

| Campo | Valor |
|---|---|
| Rule ID | RN-CONV-04 |
| Nombre | Trazabilidad de toda decisión de IA |
| Objetivo | Poder auditar cualquier decisión con efecto de negocio tomada por la inteligencia artificial. |
| Descripción | Toda decisión tomada por la inteligencia artificial con efecto de negocio queda registrada para trazabilidad y auditoría posterior. |
| Categoría | Conversación e IA |
| Alcance | Global |
| Disparador | Cualquier decisión de la IA con efecto de negocio (cotización, confirmación, detección de intención). |
| Precondiciones | Ninguna. |
| Entradas requeridas | Intención detectada, resultado, metadatos del modelo (versión de prompt, tokens, costo). |
| Lógica de negocio | Toda decisión con efecto de negocio se registra en el log de auditoría, con su metadata completa. |
| Resultado esperado | Cualquier decisión de la IA puede reconstruirse y auditarse después. |
| Ejemplos | `aud-1`, `aud-5` en el mockup: registro de intención detectada, sentimiento, tokens y costo por cada decisión relevante. |
| Excepciones | Ninguna. |
| Prioridad | High |
| Consumidores | Backend, Auditoría, QA |
| Dependencias | Es dependencia de: RN-AUD-01, RN-REP-02 |
| Fuente | `01-domain-discovery.md` (principio de trazabilidad de decisiones de IA) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-CONV-05 — Degradación a escalamiento humano

| Campo | Valor |
|---|---|
| Rule ID | RN-CONV-05 |
| Nombre | Degradación a escalamiento humano ante baja confianza |
| Objetivo | Evitar que la IA continúe una conversación cuando no puede resolverla con confianza suficiente. |
| Descripción | Si la inteligencia artificial no puede resolver la solicitud con confianza suficiente, o se presenta una situación sensible, la conversación se detiene y se escala a una persona, en vez de continuar con una interpretación dudosa. |
| Categoría | Conversación e IA |
| Alcance | Global |
| Disparador | Confianza insuficiente de la IA, o detección de una situación sensible. |
| Precondiciones | La IA no pudo resolver con confianza tras aplicar `RN-CONV-03` (clarificación) cuando aplicaba. |
| Entradas requeridas | Nivel de confianza de la interpretación, tipo de situación detectada. |
| Lógica de negocio | Ante baja confianza o situación sensible → detener respuesta automática y activar `RN-ESC-01`. |
| Resultado esperado | Ninguna conversación continúa con una interpretación dudosa sin intervención humana. |
| Ejemplos | Ver casos de `RN-ESC-01` (imagen, audio, queja, palabra prohibida). |
| Excepciones | Se intenta clarificar primero (`RN-CONV-03`) antes de escalar por ambigüedad. |
| Prioridad | Critical |
| Consumidores | IA, Backend |
| Dependencias | Depende de: RN-CONV-01, RN-CONV-03. Es dependencia de: RN-ESC-01 |
| Fuente | `01-domain-discovery.md` (principio de degradación a escalamiento humano) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-CONV-06 — No se procesan notas de voz

| Campo | Valor |
|---|---|
| Rule ID | RN-CONV-06 |
| Nombre | No se procesan notas de voz |
| Objetivo | Evitar interpretar mal un mensaje de audio sin capacidad real de procesarlo. |
| Descripción | El sistema no procesa notas de voz — las detecta y las escala directamente a una persona. |
| Categoría | Conversación e IA |
| Alcance | Global |
| Disparador | La clienta envía un mensaje de tipo audio. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Tipo de mensaje recibido. |
| Lógica de negocio | Si `tipo_mensaje = audio` → escalar directamente, sin intento de interpretación automática. |
| Resultado esperado | Ninguna nota de voz se interpreta automáticamente; siempre se escala. |
| Ejemplos | `conv-7` en el mockup: "Audio recibido. Por ahora el sistema no procesa audios — conversación escalada." |
| Excepciones | Ninguna. |
| Prioridad | High |
| Consumidores | IA, Backend |
| Dependencias | Es dependencia de: RN-ESC-01 |
| Fuente | `functional-scope.md` §3.2, Restricciones |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-CONV-07 — Tono personal, sin sonar a bot

| Campo | Valor |
|---|---|
| Rule ID | RN-CONV-07 |
| Nombre | Tono personal y de fidelización |
| Objetivo | Sostener la percepción de trato cercano que el negocio ya valora en su operación actual. |
| Descripción | El bot debe sostener un trato cercano y personal, coherente con el requisito de que "no se note como bot". |
| Categoría | Conversación e IA |
| Alcance | Global |
| Disparador | Cualquier respuesta generada por el bot. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Ninguna estructurada — es una cualidad del estilo de respuesta, no una lógica condicional. |
| Lógica de negocio | El estilo de redacción de toda respuesta automática debe sostener cercanía y personalización, evitando lenguaje mecánico o genérico. |
| Resultado esperado | Las clientas perciben continuidad con el trato personal que ya valoran del negocio. |
| Ejemplos | "¡Hola Paulina! Notamos que sueles pedir pedicure junto con tu gelish 💅" (`conv-4`). |
| Excepciones | Ninguna. |
| Prioridad | Medium |
| Consumidores | IA, QA |
| Dependencias | Ninguna identificada |
| Fuente | Domain Discovery original; reforzado en Sesión 02 (regla C2) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada (refuerzo: 2026-07-12) |
| Notas | Relevante para el futuro golden set de pruebas conversacionales (ADR-019) — evaluar tono, no solo corrección funcional. |

---

### RN-CONV-08 — Criterio de "cliente molesto"

| Campo | Valor |
|---|---|
| Rule ID | RN-CONV-08 |
| Nombre | Criterio de detección de "cliente molesto" |
| Objetivo | Detectar de forma confiable cuándo una clienta está molesta, para poder escalar oportunamente. |
| Descripción | El criterio combina el sentimiento devuelto por el modelo de lenguaje y una lista de palabras clave configurables como respaldo determinista. |
| Categoría | Conversación e IA |
| Alcance | Global |
| Disparador | Cualquier mensaje de la clienta. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Sentimiento detectado por el modelo, coincidencia con palabras clave. |
| Lógica de negocio | Señal híbrida: sentimiento negativo del modelo + palabras clave configurables; el umbral exacto de activación no está definido. |
| Resultado esperado | Detección de clienta molesta activa `RN-ESC-01`. |
| Ejemplos | `conv-1`: "ya me tienen hasta el gorro, esto es pésimo servicio" → sentimiento negativo detectado, escalamiento automático. |
| Excepciones | Umbral exacto no definido (ver `PA-14`). |
| Prioridad | High |
| Consumidores | IA, Backend |
| Dependencias | Es dependencia de: RN-ESC-01 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #8 |
| Estado | Mecanismo aprobado, umbral exacto faltante |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-CONV-09 — Gobernanza de "palabra prohibida"

| Campo | Valor |
|---|---|
| Rule ID | RN-CONV-09 |
| Nombre | Gobernanza de "palabra prohibida" |
| Objetivo | Permitir que el negocio defina y ajuste qué lenguaje dispara escalamiento automático. |
| Descripción | La lista de palabras consideradas sensibles es configurable por Administrador/Gerente, con alcance global a todas las sucursales (supuesto de trabajo). |
| Categoría | Conversación e IA |
| Alcance | Global (supuesto de trabajo) |
| Disparador | Un mensaje de la clienta contiene una palabra de la lista configurada. |
| Precondiciones | Existe una lista de palabras configurada. |
| Entradas requeridas | Contenido del mensaje, lista de palabras configuradas. |
| Lógica de negocio | Si el mensaje contiene una palabra de la lista → activar `RN-ESC-01` de inmediato. |
| Resultado esperado | Ningún mensaje con lenguaje sensible continúa siendo atendido por el bot. |
| Ejemplos | `conv-5`/`tkt-2` en el mockup: escalamiento por `palabra_prohibida`. |
| Excepciones | Ninguna conocida sobre el mecanismo — el alcance (global vs. por sucursal) es un supuesto de trabajo, no confirmado. |
| Prioridad | High |
| Consumidores | IA, Backend, Administrador |
| Dependencias | Es dependencia de: RN-ESC-01 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #7 |
| Estado | Aprobada como supuesto de trabajo |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-CONV-10 — Cierre y reapertura de conversación

| Campo | Valor |
|---|---|
| Rule ID | RN-CONV-10 |
| Nombre | Disparador de cierre y reapertura de conversación |
| Objetivo | Definir el modelo de identidad de conversación y su alcance de memoria. |
| Descripción | **Parcialmente respondido.** Cada conversación se trata como una identidad de clienta persistente — no hay un ciclo clásico de cierre/reapertura. El contexto que usa la IA se limita a la cita que se está gestionando, no al historial completo de citas pasadas en la misma conversación. **El disparador exacto que resetea el `modo` (bot/humano) tras un período de inactividad sigue sin resolverse** — es el punto que la revisión adversarial ya identificó como ruta directa al peor escenario de negocio (DM-C: clienta sin respuesta de nadie). |
| Categoría | Conversación e IA |
| Alcance | Global |
| Disparador | Nueva interacción de una clienta ya conocida. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Identidad de la clienta (teléfono), cita en gestión actual (si existe). |
| Lógica de negocio | La conversación persiste por identidad de clienta; el contexto de IA se acota a la cita en gestión. **No definido:** qué dispara el reseteo de `modo` tras inactividad — ver `99-open-questions.md#PA-15`. |
| Resultado esperado | La clienta no pierde su identidad entre interacciones; el `modo` humano/bot no queda resuelto de forma confiable tras inactividad hasta que se responda el punto pendiente. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.22 (2026-08-04): *"Cada conversación se va a tomar como un cliente... solo se toma el contexto de la cita que se agende, no de las citas pasadas."* |
| Excepciones | No aplica. |
| Prioridad | Critical |
| Consumidores | IA, Backend |
| Dependencias | Relacionada con: RN-ESC-02 (revalidación de modo) |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #16; `DISCOVERY_CHECKLIST.md` 1.22 |
| Estado | Parcialmente aprobada — modelo de identidad y memoria confirmados; disparador de reseteo de `modo` sigue faltante |
| Versión | 1 |
| Fecha de aprobación | N/A — pendiente el punto crítico |
| Notas | La propia Dueña invitó explícitamente a repreguntar ("si hay dudas quiero que me las preguntes") — se recomienda una pregunta puntual: "¿qué debe pasar con el modo humano/bot si pasó mucho tiempo de inactividad?" No se diseña la máquina de estados formal aquí (reservado a Fase 0, P3 de `ARCHITECTURE_CLOSURE_PLAN.md`). |

---

### RN-CONV-11 — Confirmación automática: ¿push o requiere respuesta?

| Campo | Valor |
|---|---|
| Rule ID | RN-CONV-11 |
| Nombre | Naturaleza de la confirmación automática |
| Objetivo | Definir si la confirmación de cita requiere respuesta de la clienta. |
| Descripción | Confirmado: la confirmación es **interactiva** — la clienta debe dar una respuesta afirmativa explícita a un horario propuesto; el sistema nunca asume una confirmación sin esa respuesta. Contrario a la recomendación original (push unidireccional). |
| Categoría | Conversación e IA |
| Alcance | Global |
| Disparador | El sistema propone un horario a la clienta. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Respuesta de la clienta al horario propuesto. |
| Lógica de negocio | Un horario propuesto nunca se considera confirmado hasta recibir una respuesta afirmativa explícita de la clienta; si es necesario, se pide confirmación de forma explícita, nunca se asume. |
| Resultado esperado | Ninguna cita se confirma sin una respuesta afirmativa real de la clienta. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.23 (2026-08-04): *"El cliente elige un horario de los que se propuso. Tiene que ser una respuesta afirmativa... nunca asumas nada."* |
| Excepciones | Ninguna. |
| Prioridad | High |
| Consumidores | IA, Backend |
| Dependencias | Relacionada con: RN-NOT-01 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #17; `DISCOVERY_CHECKLIST.md` 1.23 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | **Impacto no resuelto en esta propagación:** esto requiere un estado intermedio nuevo en la máquina de estados de `Cita` (ej. "propuesta"/"pendiente de confirmación"), que el modelo de datos actual no contempla — la restricción original ("mientras no se resuelva, no se introducen nuevos estados") queda superada por esta respuesta, pero el diseño formal del estado nuevo no se ejecuta aquí (reservado a Fase 0, P3 de `ARCHITECTURE_CLOSURE_PLAN.md` — requeriría autorización explícita por tratarse de diseño de estructura nueva). |
