# Categoría: Duración y Cotización (`RN-COT`)

> Gobierna el cálculo de tiempo y precio de servicios simples y compuestos. Es el Core Domain diferenciador de Blanc — el hallazgo de mayor impacto de la Sesión 02 de Domain Discovery vive aquí.

---

### RN-COT-01 — Motor de duración por combinación

| Campo | Valor |
|---|---|
| Rule ID | RN-COT-01 |
| Nombre | Motor de duración por combinación |
| Objetivo | Calcular correctamente el tiempo y precio real de un servicio compuesto, evitando el error operativo más citado por el negocio (agendar tiempo incorrecto). |
| Descripción | La duración de un servicio compuesto (retiro + aplicación, o combinación de aplicaciones) es el resultado de una tabla de combinaciones específicas, no la suma de las duraciones individuales de cada servicio por separado. |
| Categoría | Duración y Cotización |
| Alcance | Global |
| Disparador | La clienta solicita una combinación de retiro y/o aplicación de servicios. |
| Precondiciones | Los servicios involucrados existen en el catálogo (`RN-COT-02`). |
| Entradas requeridas | Servicio a retirar (si aplica), método de retiro (si aplica), servicio(s) de aplicación. |
| Lógica de negocio | Buscar la combinación exacta en `tablaDuracionRetiro`/`tablaDuracionAplicacion`; si existe, usar esa duración; nunca sumar duraciones individuales de cada servicio. |
| Resultado esperado | Duración y precio total exactos según la tabla de combinación, no una suma ingenua. |
| Ejemplos | "Rubber + gel + Manicure = 1 hora" (no la suma de los tres tiempos individuales); "Retiro de gel con drill + Acrílico = 1h 15min". |
| Excepciones | Combinaciones no listadas en la tabla (ver `99-open-questions.md#PA-02`) — sin regla definida para ese caso. |
| Prioridad | Critical |
| Consumidores | IA, Backend, Recepción, QA |
| Dependencias | Depende de: RN-COT-02, RN-COT-03. Es dependencia de: RN-AGE-08 |
| Fuente | Sesión 02 de Domain Discovery, reglas Q1/Q2/Q3; `mockup/js/data.js` (`tablaDuracionRetiro`, `tablaDuracionAplicacion`) |
| Estado | Aprobada — estructura firme, tablas incompletas |
| Versión | 1 |
| Fecha de aprobación | 2026-07-12 |
| Notas | Las tablas se transcribieron textualmente de lo aportado por la dueña, sin completar los huecos que ella misma dejó sin especificar. |

---

### RN-COT-02 — "Retiro" como categoría propia

| Campo | Valor |
|---|---|
| Rule ID | RN-COT-02 |
| Nombre | "Retiro" como categoría de servicio propia |
| Objetivo | Reconocer que el retiro de un servicio anterior tiene su propio tiempo, distinto de la aplicación de un servicio nuevo. |
| Descripción | Existe un servicio de retiro (de gel/acrílico/rubber existente), distinto del servicio de aplicación nueva, con su propio tiempo según el método usado (drill o acetona). |
| Categoría | Duración y Cotización |
| Alcance | Global |
| Disparador | La clienta tiene un servicio previo que debe retirarse antes de aplicar uno nuevo. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Servicio a retirar, método de retiro. |
| Lógica de negocio | El retiro se trata como categoría de servicio independiente (`tipo: "retiro"` en el catálogo), con su propio tiempo por método. |
| Resultado esperado | El tiempo de retiro se calcula según el método usado, no como un valor fijo genérico. |
| Ejemplos | Retiro de gel con drill vs. retiro de gel con acetona tienen duraciones distintas (1h 15min vs. 1h). |
| Excepciones | Quién decide el método de retiro no está definido (ver `PA-03`). |
| Prioridad | High |
| Consumidores | IA, Recepción, Backend |
| Dependencias | Es dependencia de: RN-COT-01 |
| Fuente | Sesión 02 de Domain Discovery, regla Q1 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-07-12 |
| Notas | — |

---

### RN-COT-03 — Diseño como extra por uña

| Campo | Valor |
|---|---|
| Rule ID | RN-COT-03 |
| Nombre | Diseño como extra por uña |
| Objetivo | Cobrar y calcular tiempo correctamente cuando un diseño se aplica solo a un subconjunto de uñas. |
| Descripción | El servicio base (ej. Gelish) cubre las 10 uñas; un diseño en un subconjunto de uñas es un costo/tiempo adicional específico de esas uñas, no un servicio aparte. |
| Categoría | Duración y Cotización |
| Alcance | Global |
| Disparador | La clienta solicita diseño en una parte de las uñas. |
| Precondiciones | Existe un servicio base de aplicación ya cotizado. |
| Entradas requeridas | Servicio base, modificador de diseño, número de uñas afectadas. |
| Lógica de negocio | El modificador de diseño se suma al servicio base solo por las uñas donde se aplica, no se cobra ni se calcula como si aplicara a las 10. |
| Resultado esperado | Precio y tiempo reflejan exactamente el alcance real del diseño solicitado. |
| Ejemplos | "Gelish en las manos y dos uñas con diseño francés y una con piedras" → 55 min, $400 (ejemplo real de `mockup/js/data.js`, `conv-2`). |
| Excepciones | Ninguna conocida. |
| Prioridad | High |
| Consumidores | IA, Backend |
| Dependencias | Es dependencia de: RN-COT-01 |
| Fuente | `01-domain-discovery.md` §5.2, confirmado sin cambios en Sesión 02 (regla R2) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada (confirmación en Sesión 02: 2026-07-12) |
| Notas | El Value Object `ComposicionPorUña` que modela esto permanece deliberadamente específico de Blanc (ver memoria de proyecto "SaaS multi-tenant vision") — no se generaliza. |

---

### RN-COT-04 — Combinaciones no listadas en la tabla

| Campo | Valor |
|---|---|
| Rule ID | RN-COT-04 |
| Nombre | Combinaciones de duración no listadas |
| Objetivo | Completar el motor de duración con las combinaciones que las tablas originales no cubrían. |
| Descripción | La Dueña aportó una tabla extensa con docenas de combinaciones de duración antes faltantes, más una regla nueva: el uso de drill en retiro de gel agrega 15 minutos. Persisten dos vacíos: (a) varias celdas específicas (ej. "Diseño Especial", "SP", "CF", "CC") siguen sin valor numérico o con valor cualitativo ("dentro de la hora dependiendo del diseño"); (b) **no está resuelto si "drill +15 min" reemplaza los valores fijos ya recibidos para combinaciones con drill, o si es un delta que se suma sobre ellos**. |
| Categoría | Duración y Cotización |
| Alcance | Global |
| Disparador | La clienta solicita una combinación de retiro/aplicación. |
| Precondiciones | La combinación no está cubierta por un valor exacto ya confirmado. |
| Entradas requeridas | Tabla de combinaciones (parcialmente recibida), regla de modificador de drill. |
| Lógica de negocio | **Parcial:** para combinaciones sin valor confirmado, usar el fallback aditivo ya definido (suma de tiempos individuales), marcado explícitamente como estimado — ver Notas sobre el detalle numérico pendiente. |
| Resultado esperado | Cotización correcta para las combinaciones ya confirmadas; estimado marcado como tal para las que siguen sin valor. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.9 (2026-08-04): *"retiro de gel con drill se agregan 15 minutos al usar el drill."* |
| Excepciones | Celdas sin valor numérico (ver Descripción) — usar fallback aditivo marcado como estimado. |
| Prioridad | Critical |
| Consumidores | IA, Backend, Recepción, QA |
| Dependencias | Relacionada con: RN-COT-01 |
| Fuente | Sesión 02 de Domain Discovery, pregunta abierta 5; `DISCOVERY_CHECKLIST.md` 1.9 |
| Estado | Parcialmente aprobada — estructura y regla general recibidas, tabla detallada incompleta |
| Versión | 1 |
| Fecha de aprobación | N/A — pendiente de completar |
| Notas | **Hallazgo de auditoría (2026-08-04), no resuelto en esta propagación:** el detalle numérico línea por línea de la tabla recibida **no está disponible en ninguna de las 4 fuentes autorizadas de este proceso** (`MASTER_PROPAGATION_PLAN.md`, `DISCOVERY_CHECKLIST.md`, `PLATFORM_ARCHITECTURE_MODEL.md`, `ADR-023`) — `DISCOVERY_CHECKLIST.md` solo resume que se recibió la tabla, sin reproducir los valores. Completar esta regla requiere recuperar el documento/imagen original de la reunión. La ambigüedad de "drill +15min" (delta vs. reemplazo) **requiere una decisión/aclaración explícita**, no se asume ninguna de las dos opciones aquí. |

---

### RN-COT-05 — Quién decide el método de retiro

| Campo | Valor |
|---|---|
| Rule ID | RN-COT-05 |
| Nombre | Decisor del método de retiro |
| Objetivo | Permitir que la IA cotice de forma autónoma sin preguntar el método en cada caso. |
| Descripción | La clienta decide el método de retiro al agendar. Solo se pregunta por el drill cuando el retiro es de gel — es el único producto que admite ese método (acrílico/rubber usan otro método, sin opción de drill). |
| Categoría | Duración y Cotización |
| Alcance | Global |
| Disparador | La clienta solicita un retiro. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Producto a retirar, preferencia de método (si aplica). |
| Lógica de negocio | Si el producto a retirar es gel → preguntar/registrar método (drill o acetona). Si es otro producto → no se pregunta, el drill no aplica. **Excepción:** una solicitud de retiro-de-gel-puro (sin aplicación nueva) se agenda manualmente, fuera del flujo automático estándar. |
| Resultado esperado | La IA cotiza sin preguntar el método salvo cuando el producto es gel. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.10 (2026-08-04): *"La clienta lo decide cuando agenda... solo se pregunta sobre el drill cuando es retiro de gel... si alguien pide puro retiro de gel, que se agende manualmente."* |
| Excepciones | Retiro-de-gel-puro se agenda manualmente, no por el flujo automático. |
| Prioridad | High |
| Consumidores | IA, Recepción, Backend |
| Dependencias | Relacionada con: RN-COT-02, RN-COT-04 |
| Fuente | Sesión 02 de Domain Discovery, pregunta abierta 5; `DISCOVERY_CHECKLIST.md` 1.10 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | La IA ya puede cotizar de forma autónoma para todos los productos salvo gel, y para gel puede preguntar el método sin ambigüedad. |

---

### RN-COT-06 — ¿Duraciones varían por sucursal?

| Campo | Valor |
|---|---|
| Rule ID | RN-COT-06 |
| Nombre | Variación de duración por sucursal |
| Objetivo | Determinar si el catálogo necesita un mecanismo de override por sucursal. |
| Descripción | Confirmado: las duraciones (y precios) son globales, iguales en las 3 (4) sucursales — no varían entre ellas. |
| Categoría | Duración y Cotización |
| Alcance | Global |
| Disparador | Cotización de cualquier servicio, en cualquier sucursal. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Ninguna adicional — el catálogo global aplica siempre. |
| Lógica de negocio | La duración/precio de un servicio es idéntica en todas las sucursales; no se consulta override alguno. |
| Resultado esperado | Ninguna sucursal cotiza distinto para el mismo servicio. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.11 (2026-08-04): *"Sí es lo mismo."* |
| Excepciones | Ninguna. |
| Prioridad | Medium |
| Consumidores | IA, Backend, Recepción |
| Dependencias | Relacionada con: RN-COT-08 (queda confirmada sin uso) |
| Fuente | Sesión 02 de Domain Discovery, pregunta abierta 5; `DISCOVERY_CHECKLIST.md` 1.11 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | Cierra también `RN-COT-08` — ver esa regla. |

---

### RN-COT-07 — Dinero como entero (centavos)

| Campo | Valor |
|---|---|
| Rule ID | RN-COT-07 |
| Nombre | Dinero como entero, nunca flotante |
| Objetivo | Eliminar cualquier ambigüedad de redondeo en cobros y cotizaciones. |
| Descripción | Todo valor monetario (precio base, modificadores, anticipos) se representa como entero en la unidad mínima de la moneda (centavos), nunca como número de punto flotante. |
| Categoría | Duración y Cotización |
| Alcance | Global |
| Disparador | Cualquier cálculo o almacenamiento de un valor monetario. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Cualquier campo de precio/monto. |
| Lógica de negocio | Todo campo monetario se almacena y calcula como entero en centavos. |
| Resultado esperado | Ningún cálculo de precio sufre error de redondeo por representación de punto flotante. |
| Ejemplos | `precioBase: 350` representa $3.50 o $350 según la unidad definida — el punto es que nunca es `350.5` como flotante ambiguo. |
| Excepciones | Ninguna. |
| Prioridad | Critical |
| Consumidores | Backend, QA, Auditoría |
| Dependencias | Es dependencia de: RN-AGE-08, RN-ANT-01, RN-ANT-02 |
| Fuente | `04-data-model.md` §2.4 (principio de arquitectura con efecto de negocio directo) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | Es la única regla de esta categoría cuya fuente primaria es un documento de arquitectura, no de negocio — se incluye aquí porque su efecto es directamente sobre cobros reales a clientas. |

---

### RN-COT-08 — Override de precio/duración por sucursal

| Campo | Valor |
|---|---|
| Rule ID | RN-COT-08 |
| Nombre | Override de precio/duración por sucursal |
| Objetivo | Permitir que una sucursal cobre o dure distinto para el mismo servicio, si el negocio lo requiere. |
| Descripción | El catálogo de servicios es global, con posibilidad de override de precio, duración o estado activo por sucursal. |
| Categoría | Duración y Cotización |
| Alcance | Decision Pending |
| Disparador | Cotización de un servicio en una sucursal específica. |
| Precondiciones | Existe un override configurado para esa combinación servicio/sucursal. |
| Entradas requeridas | Servicio, sucursal, valores de override (si existen). |
| Lógica de negocio | Si existe override para esa sucursal → usar el valor de override; si no → heredar el valor global del servicio. |
| Resultado esperado | Cada sucursal puede cobrar/durar distinto sin duplicar el catálogo completo. |
| Ejemplos | Sin ejemplo real — modelada preventivamente, confirmada sin uso. |
| Excepciones | Confirmado (`DISCOVERY_CHECKLIST.md` 1.11, 2026-08-04): no hay override por sucursal — esta regla queda sin uso. |
| Prioridad | Medium |
| Consumidores | Ninguno — capacidad confirmada sin uso |
| Dependencias | Relacionada con: RN-COT-06 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #10; `04-data-model.md` §5.2 (`servicio_sucursal_override`, Decision Pending); `DISCOVERY_CHECKLIST.md` 1.11 |
| Estado | Confirmada sin uso — se mantiene modelada preventivamente en `04-data-model.md`, sin activar |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 (confirmación de que no aplica) |
| Notas | Costo de haberla modelado fue bajo; no genera inconsistencia, solo trabajo de modelado no aprovechado (ya evaluado así en `04-data-model.md` §9). Es un ejemplo real de flexibilidad especulativa evitada — citado como tal en `PLATFORM_ARCHITECTURE_MODEL.md` §3.3. |

---

### RN-COT-09 — Vigencia de cotización antes de confirmar

| Campo | Valor |
|---|---|
| Rule ID | RN-COT-09 |
| Nombre | Vigencia de una cotización calculada |
| Objetivo | Determinar si una cotización calculada expira antes de que la clienta confirme. |
| Descripción | Una cotización calculada sigue vigente indefinidamente, sin expirar por tiempo, siempre y cuando la clienta no agregue ni retire nada de la composición solicitada. |
| Categoría | Duración y Cotización |
| Alcance | Global |
| Disparador | La clienta tarda en confirmar después de recibir una cotización. |
| Precondiciones | La composición del servicio no cambió desde el cálculo. |
| Entradas requeridas | Composición original cotizada, composición al momento de confirmar. |
| Lógica de negocio | Si la composición no cambió → la cotización sigue vigente sin importar el tiempo transcurrido. Si cambió → se recalcula. |
| Resultado esperado | Ninguna cotización se invalida solo por el paso del tiempo. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.12 (2026-08-04): *"Sigue vigente siempre y cuando no agregue o retire algo, los precios se mantienen siempre."* |
| Excepciones | Cambio de composición invalida la cotización previa. |
| Prioridad | Medium |
| Consumidores | IA, Backend |
| Dependencias | Relacionada con: RN-AGE-08 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #18; `DISCOVERY_CHECKLIST.md` 1.12 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | Distinto del snapshot ya congelado en una cita confirmada (`RN-AGE-08`) — aquí el tema es la ventana entre el cálculo durante la conversación y la confirmación. Respuesta más simple que la recomendación original (que sugería revalidar siempre contra el catálogo vigente). |
