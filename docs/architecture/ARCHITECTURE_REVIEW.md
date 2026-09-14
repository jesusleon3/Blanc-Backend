# Architecture Design Review — Blanc

> **Rol del revisor:** Principal Engineer independiente, sin participación en el diseño original. Mandato explícito: encontrar errores, riesgos, sobreingeniería y decisiones cuestionables — no defender los 22 ADRs existentes.
> **Alcance revisado:** `docs/requirements/blanc-requisitos-negocio.md`, `docs/architecture/01-domain-discovery.md`, `docs/architecture/02-architecture-principles.md`, `docs/architecture/ADR_INDEX.md` y los 22 ADRs en `docs/architecture/adr/`.
> **Este documento no modifica ningún ADR ni ninguna decisión existente.** Es un input de revisión para que el equipo/cliente decida qué hacer con cada hallazgo.
> **Fecha de revisión:** 2026-07-07.

---

## 1. Resumen ejecutivo

El diseño estratégico de fondo es sólido: los límites de Bounded Context están bien razonados, el rechazo de Event Sourcing y de microservicios prematuros es correcto para la escala real, y ADR-008 (rechazo de Evolution API) es una decisión valiente y bien argumentada que va contra la propuesta original del cliente. Dicho esto, esta revisión encuentra **2 riesgos Critical, 6 High y 20 Medium/Low** que no deberían pasar desapercibidos antes de iniciar desarrollo:

- El conjunto de 22 ADRs adopta simultáneamente cinco patrones arquitectónicos (Hexagonal, Clean, Vertical Slice, CQRS-lite, Event-driven+Outbox) más DDD táctico y 10 esquemas lógicos de base de datos, para un sistema de un solo cliente con 3–4 sucursales. Esto es una cantidad de maquinaria arquitectónica que **ningún ADR individual justifica de forma incorrecta, pero que en conjunto nadie evaluó como acumulación** (hallazgo F-01, Critical).
- **Ningún ADR especifica que el webhook de WhatsApp debe responderse de inmediato (ack) antes de procesar el mensaje de forma asíncrona.** Si el procesamiento (incluida la llamada al LLM) ocurre de forma síncrona dentro del ciclo de request/response del webhook, es casi seguro que se produzcan reintentos de Meta por timeout y mensajes duplicados desde el primer día de producción (F-27, Critical).
- Un patrón se repite en la inmensa mayoría de los 22 ADRs como mitigación principal: **"revisión de arquitectura obligatoria en PR"**. Es un control humano, no automatizado, exactamente del tipo que los propios ADRs identifican como el que se degrada bajo presión de entrega (F-02, High).
- Hay una **contradicción no resuelta entre ADR-007** (exige trazabilidad total de decisiones de IA, lo cual en la práctica incluye contenido conversacional) **y ADR-017/ADR-022** (exigen minimización y retención acotada de datos personales sobre ese mismo contenido) (F-14, High).

**Veredicto: Approved with Changes.** Ver sección 4 para el detalle y la justificación completa.

---

## 2. Metodología y meta-hallazgo transversal

Se revisó cada ADR buscando activamente: (a) lo que el ADR no dice, (b) supuestos no verificados presentados con la misma confianza que hechos confirmados, (c) tensión entre ADRs que individualmente son razonables pero que en conjunto generan un problema, y (d) el patrón de mitigación usado repetidamente, que suele ser una señal de un problema estructural, no 22 problemas independientes.

**Meta-hallazgo:** de los 22 ADRs, **15 usan "revisión de código/arquitectura obligatoria en PR" como su mitigación primaria o única** ante el riesgo de erosión de una regla de diseño (límites de módulo, separación de esquemas, clasificación de errores, uso indebido de feature flags, disciplina de idempotencia, etc.). Un Architecture Review Board debería tratar esto como un solo riesgo sistémico, no como 15 riesgos independientes ya "mitigados". Se registra como F-02 y se referencia desde cada categoría donde aplica, en vez de repetirse 15 veces.

---

## 3. Hallazgos por categoría

### 3.1 Escalabilidad

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-26 | Contención de recursos entre `Conversación` (alto volumen de mensajes) y `Agenda` (transaccional crítico) en la misma instancia de PostgreSQL (ADR-005). La mitigación declarada ("monitorear por esquema") detecta el problema después de que ocurre, no lo previene. | Medium | Medium — degradación de latencia en horas pico, no pérdida de datos | Media, a mediano plazo según volumen real de conversaciones | Definir de antemano un plan concreto de mitigación activado por el monitoreo (ej. mover `Conversación` a su propio pool de conexiones o esquema con recursos reservados), no solo "monitorear y ya se verá". | No aún — sí cuando haya evidencia real (consistente con el propio gatillo de revisión de ADR-005). |
| F-27 | **Ningún ADR especifica que el procesamiento de un mensaje de WhatsApp (incluida la llamada al LLM) debe desacoplarse del acknowledgment del webhook.** Procesar de forma síncrona dentro del request del webhook es el error más común y mejor documentado en integraciones de este tipo: genera timeouts, reintentos de Meta, y mensajes duplicados desde el primer día. | **Critical** | Alto — duplicación de conversaciones/citas, degradación de confiabilidad del canal único de agendamiento por sucursal | Alta si no se diseña explícitamente | El endpoint de webhook debe hacer ack inmediato (HTTP 200) y encolar el procesamiento real como background job (ADR-018), no procesar el mensaje en el mismo ciclo de request. Esto también reduce la superficie de duplicados que ADR-021 tiene que absorber. | **Sí** — ninguno de los 22 ADRs lo cubre explícitamente; se recomienda un ADR dedicado en la fase de arquitectura técnica, no una modificación de los existentes. |

### 3.2 Complejidad innecesaria

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-01 | El conjunto acumulado de patrones (Hexagonal + Clean + Vertical Slice + CQRS-lite + Domain Events/Outbox + Modular Monolith con 10 esquemas lógicos + DDD táctico completo) es individualmente defendible en cada ADR, pero **nadie evaluó el costo acumulado** de exigir que un equipo (de tamaño no confirmado, probablemente pequeño) domine las cinco disciplinas simultáneamente desde el primer sprint, para un sistema de un solo cliente y 3–4 sucursales. | **Critical** | Alto — sobrecosto real de tiempo de desarrollo, curva de aprendizaje, riesgo de que el equipo implemente los patrones de forma incorrecta bajo presión (peor que no usarlos) | Alta | No se recomienda descartar ningún ADR individual (cada uno está bien justificado por separado) — se recomienda una decisión explícita de **secuenciación**: implementar primero el núcleo transaccional (Agenda, Catálogo, Clientas) con Hexagonal+Vertical Slice simple, y diferir la implementación completa de CQRS-lite/Outbox hasta que el primer sprint de Analítica/Notificaciones lo requiera realmente, en vez de construir toda la maquinaria por adelantado. | No a los ADRs existentes — sí se recomienda un documento de secuenciación de implementación (fuera del alcance de esta revisión). |
| F-19 | El footprint de infraestructura implícito (10 esquemas, dispatcher de Outbox, cola de background jobs, 3 entornos completos cada uno con credenciales propias de WhatsApp/IA/Calendar) es considerablemente mayor que el de un MVP mínimo, sin que ningún ADR contraste ese costo contra el valor de negocio esperado a esta escala. | Medium | Medio — costo de infraestructura y operación mayor al necesario en los primeros meses | Alta | Ver F-01 — es consecuencia directa de la misma causa raíz. | No — consecuencia de F-01, no una decisión independiente. |

### 3.3 Riesgos técnicos

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-27 | Ver sección 3.1 — procesamiento síncrono de webhook. Se repite aquí porque es, ante todo, un riesgo técnico de integración, no solo de escalabilidad. | Critical | Alto | Alta | Ver 3.1. | Sí — ver 3.1. |
| F-28 | El snapshot inmutable de cotización dentro de `Cita` (ADR-005) no contempla ningún mecanismo de corrección si el precio/duración congelado resulta erróneo por un error de captura en el catálogo. No hay caso de uso ni ADR para "enmendar" una cita ya confirmada sin violar el principio de inmutabilidad. | Low-Medium | Bajo-Medio — disputas ocasionales con clientas por un precio mal cargado que no se puede corregir limpiamente | Baja | Definir un caso de uso explícito de "corrección administrativa" que genere un nuevo registro de ajuste auditado, en vez de editar el snapshot original — mantiene la inmutabilidad y resuelve el caso real. | No a los ADRs — es un caso de uso a diseñar, no una decisión arquitectónica nueva. |

### 3.4 Riesgos operativos

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-02 | Meta-hallazgo transversal — ver sección 2. Se cuenta aquí como riesgo operativo porque el fallo se manifiesta cuando el equipo está bajo presión de entrega, que es precisamente el escenario operativo normal de cualquier proyecto real. | High | Medio-Alto — erosión gradual de la disciplina de diseño, acumulativa, difícil de detectar hasta que ya causó daño | Alta | Reemplazar, donde sea viable, la revisión manual por controles automatizados: linting de límites de módulo/dependencias (ej. dependency-cruiser o equivalente), linter de migraciones para el patrón expand/contract, pruebas de contrato en CI para las tres integraciones externas. La revisión humana debe ser la segunda línea de defensa, no la única. | Sí — no cambia ninguna decisión, pero varios ADRs (001, 002, 004, 005, 012, 013, 020, 021) deberían anotar el control automatizado específico cuando se defina en la arquitectura técnica. |
| F-08 | Migrar los 3 números de WhatsApp existentes (ADR-008), presumiblemente en uso activo con historial de conversaciones y contactos reales, es un evento disruptivo de negocio, no solo un cambio técnico. ADR-008 reconoce el costo pero no cuantifica el riesgo de interrupción real durante la ventana de migración. | High | Alto — posible interrupción del único canal de agendamiento de una sucursal durante la transición | Media | Diseñar un plan de migración por sucursal (no las 4 simultáneamente), con ventana de baja demanda, y un canal de respaldo temporal (ej. número de contingencia comunicado a clientas recientes) durante la transición de cada sucursal. | No — es un plan de ejecución, refuerza ADR-008 sin contradecirlo. |
| F-15 | El backlog implícito incluye al menos 4 herramientas internas no triviales (gestión/versionado de prompts con sandbox, consola de feature flags, panel de administración RBAC/usuarios, panel de "entrenar al bot" para personal no técnico) además del producto orientado a clientas. Ningún ADR dimensiona esto como superficie de ingeniería propia. | Medium-High | Medio — riesgo real de subestimar el esfuerzo total en la planificación de sprints | Alta | Tratar estas 4 herramientas como entregables de backlog explícitos y priorizados, no como "efectos secundarios" de los ADRs de IA/seguridad/flags — deben aparecer en el plan de sprints con su propio esfuerzo estimado. | No — es un tema de alcance/planificación, no de arquitectura. |

### 3.5 Riesgos de IA

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-05 | No existe un proveedor de IA de respaldo implementado (solo el puerto que lo permitiría, ADR-007). Ante una caída de OpenAI, el diseño actual escala **todas** las conversaciones a humano simultáneamente (ADR-016). Ningún documento evalúa si el personal de recepción de 3–4 sucursales puede absorber ese volumen sin colapsar. | High | Alto — una falla parcial de un proveedor externo se convierte en un colapso operativo total del canal de agendamiento | Media (depende de la frecuencia de incidentes de OpenAI, fuera de control del proyecto) | Antes de operar en producción, obtener del negocio una estimación de capacidad de atención manual simultánea por sucursal, y diseñar una degradación escalonada (ej. mensaje automático de "estamos con demanda alta, te contactamos en breve" combinado con priorización) en vez de escalar todo indiscriminadamente. | No a los 22 ADRs — es una validación de negocio pendiente que podría, más adelante, ameritar un ADR de "degradación escalonada". |
| F-06 | La validación de salida estructurada (ADR-007, ADR-015) protege contra alucinaciones de **formato**, no de **contenido**: el LLM puede devolver una salida perfectamente válida según el esquema que igual malinterpreta lo que la clienta pidió (ej. contar mal cuántas uñas llevan diseño). Ningún ADR distingue estos dos tipos de error. | Medium | Medio — cotizaciones incorrectas que sí pasan la validación de esquema, con dinero real de por medio | Media | El golden-set de regresión conversacional (ADR-019) debe incluir explícitamente casos de "salida válida pero semánticamente incorrecta", no solo casos de formato inválido — esto es una aclaración de alcance, no una decisión nueva. | No — matiza el alcance de ADR-019, no lo contradice. |
| F-07 | Ningún ADR (007, 011, 015) fija un número concreto de límite de gasto de IA, ni define quién lo revisa, ni qué hace el sistema al alcanzarlo (¿el bot se detiene? ¿escala todo a humano, agravando F-05?). El principio de "gobernanza de costo" está declarado, pero sin mecanismo operativo. | High | Medio-Alto — gasto no acotado es, por diseño, garantizado que ocurra sin un límite duro real | Alta | Definir, antes de producción: (1) el número de límite diario/por sucursal, (2) el dueño de revisarlo, (3) el comportamiento exacto al alcanzarlo — y que ese comportamiento no sea "escalar todo a humano" sin considerar F-05. | Sí — ADR-007 u 011 deberían registrar el mecanismo (no el número, que es decisión de negocio) cuando se defina. |

### 3.6 Riesgos de WhatsApp

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-08 | Ver 3.4 — migración disruptiva de números existentes. | High | Alto | Media | Ver 3.4. | No. |
| F-09 | Las plantillas de mensaje requeridas para recordatorio 24h y confirmación automática fuera de ventana (ambos pedidos explícitamente por el cliente) requieren aprobación de Meta, que puede rechazarse o demorarse por razones de redacción/categoría fuera del control del equipo. ADR-008 no cuantifica este riesgo. | Medium | Medio — dos funcionalidades explícitamente pedidas podrían no funcionar al lanzamiento si la plantilla no está aprobada a tiempo | Media | Enviar las plantillas a aprobación de Meta en paralelo a las primeras fases de desarrollo (no al final, mismo principio que ADR-008 ya aplica al aprovisionamiento de números), con una plantilla de respaldo más genérica pre-aprobada como contingencia. | No — refuerza ADR-008. |

### 3.7 Riesgos de Google Calendar

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-10 | ADR-006 ya identifica el riesgo de que el negocio siga editando directamente en Google Calendar por hábito, pero lo trata como un riesgo más entre varios. En la práctica, el cambio de hábito operativo de un equipo no técnico es, estadísticamente, una de las causas más frecuentes de fracaso de adopción en sistemas de reemplazo de calendario/agenda — debería tratarse como el riesgo dominante de ADR-006, no uno secundario. | **High** *(reclasificado desde el nivel implícito de ADR-006)* | Medio-Alto — fuente de verdad dividida de facto pese al diseño unidireccional, con impacto directo en el invariante de no-doble-booking | Alta | Plan de gestión de cambio explícito antes del rollout (no solo capacitación puntual): considerar marcar los eventos como "gestionados por Blanc, no editar aquí" desde el día 1, y monitoreo activo de ediciones manuales detectadas en Google Calendar como señal de alerta temprana de incumplimiento de proceso. | No a ADR-006 — se recomienda elevar la prioridad de esta mitigación en la ejecución, no cambiar la decisión. |

### 3.8 Riesgos de concurrencia

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-03 | **ADR-004 no especifica cómo el dispatcher del Transactional Outbox evita el despacho duplicado si el sistema corre más de una instancia** (explícitamente permitido por la estrategia de escalabilidad para alta disponibilidad, `02-architecture-principles.md` sección 13). Sin un mecanismo de reclamo exclusivo de fila (ej. `SELECT FOR UPDATE SKIP LOCKED` o equivalente), dos instancias podrían despachar la misma notificación dos veces. | High | Medio — duplicación de notificaciones (mitigable por idempotencia del lado receptor, pero no diseñado explícitamente para este caso) | Baja hoy (despliegue de una sola instancia), Media si crece a multi-instancia por disponibilidad | ADR-004 debe especificar explícitamente el mecanismo de reclamo exclusivo de filas del Outbox antes de que el sistema corra en más de una instancia. | **Sí** — gap concreto en ADR-004, no cubierto por ningún otro ADR. |
| F-04 | La búsqueda de disponibilidad vía el modelo de lectura de CQRS-lite (ADR-003) puede mostrar un horario como disponible que ya no lo está al momento de confirmar (staleness). El invariante de base de datos (ADR-005) evita la reserva inválida correctamente, pero **ningún ADR ni caso de uso define qué le dice el bot a la clienta** cuando eso ocurre. | Medium | Medio — experiencia de clienta confusa ("me dijiste que sí había ese horario") si no se maneja conversacionalmente | Media | Diseñar explícitamente el caso de uso de "conflicto de confirmación tardía" como parte del flujo de agendamiento, con una respuesta conversacional predefinida, no como un error genérico. | No a los ADRs — es un caso de uso a especificar en la fase de diseño de casos de uso/UX conversacional. |

### 3.9 Riesgos de consistencia

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-03 | Ver 3.8 — despacho duplicado del Outbox también es, en esencia, un riesgo de consistencia entre lo que el sistema cree que notificó y lo que realmente notificó. | High | Medio | Baja–Media | Ver 3.8. | Sí — ver 3.8. |
| F-24 (parcial) | El modelo de lectura de Analítica (CQRS-lite, ADR-003) es eventualmente consistente por diseño, pero ningún ADR define un límite máximo aceptable de rezago — si el dispatcher de eventos se atrasa o falla parcialmente, el dashboard de KPIs podría mostrar cifras desactualizadas por tiempo indefinido sin que exista una alerta que lo detecte, porque el umbral nunca se definió (ver también 3.16). | Medium | Medio — decisiones de negocio basadas en un dashboard silenciosamente desactualizado | Media | Definir un SLO numérico de rezago máximo aceptable del read-model de Analítica y alertar activamente si se excede — no dejarlo como "se monitoreará". | No — es un parámetro operativo pendiente de ADR-011, no una decisión nueva. |

### 3.10 Riesgos de seguridad

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-11 | Ningún ADR define el mecanismo de transporte (¿polling? ¿WebSocket? ¿SSE?) para que un empleado vea mensajes casi en tiempo real mientras tiene control de una conversación escalada (ADR-016), y por tanto tampoco el modelo de autenticación/autorización de ese canal específico. ADR-016 diseña la garantía de entrega de la notificación de escalamiento, pero no el canal de trabajo del humano una vez que toma control. | Medium | Medio — superficie de autenticación no diseñada es, por definición, una superficie no revisada | Media | Definir explícitamente el mecanismo de transporte y su modelo de autenticación (reutilizando el esquema de JWT/refresh de ADR-010, no uno nuevo) antes de implementar el panel de handoff. | Sí — gap real, probablemente amerita un ADR nuevo en la fase técnica, no modificar ADR-016. |
| F-12 | El modelo de RBAC con alcance por sucursal (ADR-010) se construye sobre un supuesto de diseño ("scope por sucursal asignada") para una pregunta de negocio que el Domain Discovery dejó explícitamente sin confirmar (pregunta abierta #11: ¿Analista y Solo lectura tienen alcance global o por sucursal?). Construir el modelo completo de permisos sobre un supuesto no confirmado es un riesgo de diseño de seguridad, no solo un detalle pendiente. | Medium | Medio-Alto — un modelo de permisos mal calibrado puede sobre-exponer o sub-exponer datos entre sucursales | Media | Confirmar la respuesta de negocio antes de implementar el modelo de claims de sucursal en los tokens, no después. | Sí — ADR-010 debería actualizarse (no en esta revisión) una vez exista la confirmación de negocio. |
| F-13 | Las credenciales de WhatsApp de las 3–4 sucursales, tratadas como secretos (ADR-010), no tienen segregación de alcance definida. Si el gestor de secretos no aísla el acceso por sucursal, el compromiso de una sola credencial de aplicación podría exponer las credenciales de las 4 sucursales simultáneamente en vez de solo una. | Medium | Alto si ocurre (blast radius de 1 a 4 sucursales) | Baja-Media | Exigir segregación de secretos por sucursal en el gestor de secretos desde el diseño técnico, no solo "todo secreto vive en un gestor de secretos" de forma genérica. | Sí — aclaración a ADR-010, no cambio de decisión. |

### 3.11 Riesgos de mantenibilidad

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-01 | Ver 3.2 — acumulación de patrones arquitectónicos como riesgo de mantenibilidad: un ingeniero nuevo debe entender 5 patrones simultáneos para poder tocar casi cualquier parte del sistema con confianza. | Critical | Alto | Alta | Ver 3.2. | Ver 3.2. |
| F-02 | Ver sección 2 — sobre-dependencia de revisión manual como control de mantenibilidad a largo plazo. | High | Medio-Alto | Alta | Ver sección 2. | Ver sección 2. |

### 3.12 Riesgos de testing

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-16 | El "golden set" de conversaciones de referencia (ADR-019), pieza central de la validación de calidad de prompts, será necesariamente sintético y delgado en el lanzamiento porque no existe tráfico real todavía — es más débil exactamente en el momento en que más se necesita (antes del primer despliegue a producción). | Medium | Medio — regresiones de tono/calidad conversacional no detectadas en el primer lanzamiento | Alta | Reconocer explícitamente esta limitación en el plan de lanzamiento: primeras semanas con supervisión humana más cercana de las conversaciones reales, alimentando el golden-set activamente desde el día 1 en vez de asumir cobertura completa desde el inicio. | No — matiza la ejecución de ADR-019, no la decisión. |
| F-17 | Ningún ADR menciona pruebas de carga/rendimiento ni pruebas de fallo inyectado (chaos testing) sobre el Outbox o la cola de background jobs, pese a que son los componentes nuevos con mayor riesgo de falla silenciosa de todo el sistema (F-03, F-24). | Medium | Medio | Media | Incluir pruebas de fallo inyectado sobre el Outbox/cola como parte de la definición de "terminado" de esos componentes específicos, no del testing general. | Sí — podría añadirse como criterio explícito a ADR-019 en su momento. |

### 3.13 Riesgos de costos

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-07 | Ver 3.5 — sin límite de gasto de IA concreto. | High | Medio-Alto | Alta | Ver 3.5. | Ver 3.5. |
| F-18 | El costo recurrente de mensajería de la API oficial de WhatsApp (ADR-008, cobrado por conversación/categoría) no está estimado en ningún documento, pese a que recordatorios y confirmaciones automáticas — ambos pedidos explícitamente — son exactamente la categoría de conversación "proactiva" que Meta cobra por unidad. | Medium | Medio — el ADR-008 ya acepta este costo como tradeoff consciente, pero sin cifra no se puede validar contra presupuesto real | Alta | Estimar el volumen mensual esperado de conversaciones proactivas (recordatorios + confirmaciones) × costo por categoría antes de la aprobación final de ADR-008. | No a la decisión — sí se recomienda anexar la estimación como evidencia de soporte antes de aprobar ADR-008. |
| F-19 | Ver 3.2 — footprint de infraestructura mayor al de un MVP. | Medium | Medio | Alta | Ver 3.2. | Ver 3.2. |

### 3.14 Riesgos de vendor lock-in

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-20 | ADR-007 asume que el puerto de IA hace "reemplazable" al proveedor sin fricción relevante, pero los esquemas de salida estructurada / function-calling difieren de forma no trivial entre proveedores (OpenAI vs. Claude vs. Gemini). Cambiar de proveedor requeriría rediseñar y re-validar prompts y esquemas contra el golden-set (ADR-019), no solo implementar un adaptador nuevo — el ADR subestima el costo real de esta mitigación. | Medium | Medio — falsa sensación de portabilidad de bajo costo | Media | Ajustar la expectativa documentada en ADR-007: el puerto reduce el acoplamiento de código, pero no elimina el costo de re-validación conversacional de un cambio de proveedor. | No cambia la decisión — sí se recomienda ajustar el texto de "Consecuencias" de ADR-007 para no sobrevender la portabilidad. |
| F-21 | ADR-008 introduce un segundo nivel de posible lock-in no discutido: el *Business Solution Provider* (BSP) específico usado para acceder a la API oficial de WhatsApp (aún no elegido en `03-technical-architecture.md`) tiene su propia superficie de acoplamiento — API propia, pricing propio, fricción de migración entre BSPs — además del acoplamiento a Meta mismo. | Medium | Medio | Media | Evaluar el BSP en la fase de arquitectura técnica con el mismo rigor con que ADR-008 evaluó Evolution API vs. oficial — no asumir que "API oficial" es una decisión de un solo nivel. | No a ADR-008 — es un tema para `03-technical-architecture.md`. |

### 3.15 Riesgos para evolucionar a SaaS

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-22 | El modelo "Silo" elegido por ADR-009 (una instalación completa por cliente futuro) puede no ser económicamente viable si los clientes potenciales de una eventual comercialización son salones tan pequeños como Blanc o menores — el costo de infraestructura por cliente en modelo Silo no se reduce proporcionalmente para clientes muy pequeños. ADR-009 no contrasta esto porque la información de negocio (tamaño esperado de futuros clientes) no existe todavía, pero la arquitectura ya apuesta implícitamente por Silo sin esa validación. | Medium | Alto si la comercialización ocurre y el perfil de cliente es pequeño | Baja hoy (especulativo), pero el costo de haber elegido mal solo se conoce cuando ya es tarde para cambiarlo barato | No cambiar la decisión hoy (sigue siendo correcta para el caso de un solo cliente) — pero registrar explícitamente que la validación de Silo vs. Pool para un segundo cliente debe hacerse con datos reales de ese cliente antes de replicar el patrón Silo automáticamente. | No — ya está cubierto por el "Future Revisit Criteria" de ADR-009, pero merece más énfasis. |
| F-23 | ADR-009 describe introducir un futuro concepto de "Organización" por encima de `Sucursal` como "una migración aditiva, no una reescritura". Esto es optimista: aunque no requiere reescribir el modelo de dominio, sí requiere tocar los 10 esquemas/contextos para introducir el nuevo nivel de scope — incremental en **tipo** de cambio, no necesariamente en **esfuerzo**. | Low-Medium | Medio | Media | Ajustar la expectativa documentada, no la decisión: la extracción es arquitectónicamente limpia pero no gratuita en tiempo de implementación. | No — matiza el texto de "Consecuencias" de ADR-009. |

### 3.16 Riesgos de observabilidad

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-24 | Ningún ADR define un umbral numérico concreto de alerta (ej. "rezago del Outbox > X minutos", "tasa de error > Y%", "rezago del read-model de Analítica > Z minutos"). La filosofía de observabilidad está bien definida (ADR-011) pero cero SLOs reales existen — aceptable para iniciar desarrollo, pero bloqueante antes de operar con clientas reales. | Medium | Medio — sin umbral, "alertar" es una intención, no un control operativo | Alta (se notará exactamente cuando ya sea tarde, en el primer incidente real) | Definir los SLOs numéricos como parte de la salida de `03-technical-architecture.md`, con dueño explícito de revisarlos con datos reales de las primeras semanas de producción. | No a ADR-011 — son parámetros operativos, no una decisión arquitectónica distinta. |
| F-14 | **Contradicción no resuelta entre ADR-007 y ADR-017/ADR-022.** ADR-007 exige "trazabilidad total" y "grabación de todas las decisiones de la IA" — en la práctica, esto incluye fragmentos reales de conversación (lo que la clienta escribió, lo que el modelo interpretó). ADR-017 y ADR-022 exigen minimización y retención acotada de datos personales sobre ese mismo contenido conversacional. **Ningún ADR resuelve cuál principio prevalece cuando el mismo dato es, a la vez, un registro de auditoría de IA y un dato personal sujeto a minimización.** | **High** | Alto — quien implemente esto primero decidirá la política por defecto sin que haya una decisión arquitectónica que lo respalde, con riesgo regulatorio dado que el marco legal de datos personales (Domain Discovery, pregunta abierta #12) tampoco está confirmado | Alta — se materializa en la primera implementación del logging de decisiones de IA | Resolver explícitamente antes de implementar: probablemente mediante una política de retención diferenciada dentro del mismo registro de auditoría (ej. metadatos de la decisión con retención larga, contenido conversacional textual con retención corta y ligado a la política de ADR-022), no eliminando ninguno de los dos requisitos. | **Sí** — requiere una decisión explícita que hoy no existe en ningún ADR; se recomienda resolverla antes de `03-technical-architecture.md`, posiblemente como enmienda conjunta a ADR-007/ADR-017/ADR-022. |

### 3.17 Riesgos de despliegue

| ID | Riesgo | Severidad | Impacto | Probabilidad | Mitigación propuesta | ¿Modificar ADR? |
|---|---|---|---|---|---|---|
| F-03 | Ver 3.8 — despacho duplicado del Outbox bajo despliegue multi-instancia. Se repite aquí porque el gatillo real es una decisión de despliegue (correr más de una instancia por disponibilidad), no solo de diseño del Outbox. | High | Medio | Baja–Media | Ver 3.8. | Sí — ver 3.8. |
| F-25 | El patrón de migración expand/contract (ADR-012) se declara como política sin mecanismo de verificación automatizada (ej. linter de migraciones en CI). Mismo patrón de sobre-confianza en disciplina humana que F-02. | Medium | Medio — una migración destructiva desplegada por error causaría exactamente el downtime que ADR-012 busca evitar | Media | Añadir verificación automatizada de compatibilidad de migraciones como gate de CI antes de permitir el merge, no solo como buena práctica documentada. | No a ADR-012 — es un mecanismo de ejecución, no una decisión distinta. |

---

## 4. Registro consolidado de riesgos (ordenado por severidad)

| ID | Riesgo (resumen) | Severidad | ¿Modificar ADR? |
|---|---|---|---|
| F-01 | Acumulación de 5 patrones arquitectónicos sin evaluar el costo conjunto para el tamaño real del proyecto | **Critical** | No a los ADRs — sí a la secuenciación de implementación |
| F-27 | Sin diseño explícito de ack inmediato de webhook + procesamiento asíncrono | **Critical** | Sí — gap nuevo |
| F-02 | Sobre-dependencia sistémica de "revisión de PR obligatoria" como control primario (15 de 22 ADRs) | High | Sí — anotar controles automatizados |
| F-03 | Outbox sin mecanismo de reclamo exclusivo ante despliegue multi-instancia | High | Sí — ADR-004 |
| F-05 | Sin proveedor de IA de respaldo ni validación de capacidad humana ante saturación de escalamiento | High | No aún — falta dato de negocio |
| F-07 | Sin límite de gasto de IA concreto ni comportamiento definido al alcanzarlo | High | Sí — ADR-007/011 |
| F-10 | Riesgo de adopción de Google Calendar subestimado en severidad relativa | High *(reclasificado)* | No — énfasis de ejecución |
| F-14 | Contradicción no resuelta: trazabilidad total de IA vs. minimización/retención de datos personales | High | **Sí — enmienda conjunta pendiente** |
| F-08 | Migración disruptiva de números de WhatsApp existentes | High | No — plan de ejecución |
| F-11 | Canal de handoff humano sin mecanismo de transporte ni autenticación definidos | Medium | Sí — ADR nuevo en fase técnica |
| F-12 | RBAC por sucursal construido sobre pregunta de negocio no confirmada | Medium | Sí — cuando se confirme |
| F-13 | Sin segregación de secretos de WhatsApp por sucursal | Medium | Sí — aclaración a ADR-010 |
| F-15 | 4 herramientas internas no dimensionadas en el backlog | Medium-High | No — planificación |
| F-04 | Staleness de disponibilidad sin caso de uso conversacional de fallo definido | Medium | No — caso de uso pendiente |
| F-06 | Validación de esquema no cubre error semántico de interpretación | Medium | No — matiza ADR-019 |
| F-09 | Riesgo de rechazo/demora de plantillas de WhatsApp por Meta | Medium | No — refuerza ADR-008 |
| F-16 | Golden-set débil en el momento del lanzamiento | Medium | No — matiza ejecución |
| F-17 | Sin pruebas de carga/chaos sobre Outbox y cola de jobs | Medium | Sí — futuro criterio de ADR-019 |
| F-18 | Costo de mensajería de WhatsApp oficial no estimado | Medium | No — anexar estimación |
| F-19 | Footprint de infraestructura mayor al de un MVP | Medium | No — consecuencia de F-01 |
| F-20 | Optimismo sobre portabilidad de proveedor de IA | Medium | No — ajuste de texto |
| F-21 | Lock-in de Business Solution Provider de WhatsApp no discutido | Medium | No — tema técnico pendiente |
| F-22 | Viabilidad económica del modelo Silo para futuros clientes pequeños sin validar | Medium | No — falta dato de negocio |
| F-24 | Sin SLOs numéricos de observabilidad definidos | Medium | No — parámetros pendientes |
| F-25 | Migraciones sin verificación automatizada de compatibilidad | Medium | No — mecanismo de CI pendiente |
| F-23 | Optimismo sobre costo de introducir "Organización" en el futuro | Low-Medium | No — ajuste de texto |
| F-28 | Sin mecanismo de corrección de cotización congelada errónea | Low-Medium | No — caso de uso pendiente |

---

## 5. Decisión

### Approved with Changes

**Justificación:**

El razonamiento estratégico de fondo — límites de Bounded Context, rechazo de Event Sourcing y de microservicios prematuros, rechazo fundamentado de Evolution API, CQRS selectivo en vez de global — está bien construido y no se recomienda deshacer ninguna de esas decisiones. No se emite un **Rejected** porque ninguno de los hallazgos invalida la dirección arquitectónica de fondo, y todos son abordables sin descartar trabajo ya hecho.

No se emite un **Approved** liso porque existen dos hallazgos **Critical** (F-01, F-27) y seis **High** (F-02, F-03, F-05, F-07, F-10, F-14, F-08) que, si se ignoran, tienen consecuencias reales y probables: sobrecosto de desarrollo por complejidad acumulada no gestionada (F-01), mensajes/citas duplicadas desde el primer día por un patrón de integración no diseñado explícitamente (F-27), y una contradicción de política de datos que alguien va a resolver por accidente en vez de por decisión (F-14).

**Condiciones para pasar a `03-technical-architecture.md`:**

1. **F-27 debe resolverse antes de escribir cualquier código de integración con WhatsApp** — no es negociable ni requiere más análisis, es un patrón de integración estándar que falta declarar explícitamente.
2. **F-14 debe resolverse con una decisión explícita** (probablemente una enmienda conjunta a ADR-007/017/022) antes de implementar el logging de decisiones de IA — de lo contrario la primera implementación fijará la política por accidente.
3. **F-01 no bloquea el inicio de desarrollo, pero sí exige una decisión de secuenciación explícita** (qué se construye primero, qué se difiere) antes de planificar el primer sprint — no se recomienda seguir agregando ADRs de patrones adicionales sin esa secuenciación.
4. **F-03, F-05, F-07, F-10 y F-08** no bloquean el inicio de desarrollo del núcleo transaccional, pero sí deben resolverse antes de operar con clientas reales en producción.

El resto de los hallazgos (Medium/Low) se registran como backlog de arquitectura técnica y de ejecución, sin bloquear el avance.
