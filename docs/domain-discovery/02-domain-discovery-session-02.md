# Domain Discovery — Sesión 02 (Segunda Iteración)

> **Fuente:** Sesión de descubrimiento adicional con la dueña de Blanc (2026-07-12).
> **Estado:** Borrador v0.1 — pendiente de revisión y aprobación explícita antes de tocar ningún documento existente.
> **Naturaleza de este documento:** se trata como una **segunda iteración de Domain Discovery**, no como una actualización directa de `01-domain-discovery.md`. Este documento consolida, clasifica y evalúa el impacto de la información nueva — no modifica ningún documento existente. La actualización de `01-domain-discovery.md`, `02-architecture-principles.md`, ADRs, `03-technical-architecture.md` y `04-data-model.md` ocurre **después** de que este documento sea aprobado, uno por uno, en ese orden.
> **Regla de gobernanza (heredada, sin cambios):** la información de esta sesión tiene prioridad sobre cualquier supuesto de trabajo previo donde exista conflicto directo — pero eso no significa que se asuma automáticamente que todo lo dicho aquí es una decisión final; donde falta información para cerrar un punto, se documenta como pregunta abierta, no se inventa una respuesta.

---

## 1. Resumen de la sesión

La dueña de Blanc identificó un conjunto de problemas operativos reales del negocio actual (antes de cualquier automatización) y aportó información de negocio nueva y muy concreta sobre dos áreas: **garantía de servicio** y **duración exacta de combinaciones de servicios** (retiro + aplicación). En términos generales, la sesión confirma que:

- El **Core Domain de cotización** (`Catálogo y Cotización`, ya identificado en `01-domain-discovery.md` como el subdominio de mayor complejidad) es más complejo de lo que el modelo actual describe: la duración de un servicio compuesto **no es una suma de tiempos individuales**, sino el resultado de una tabla de combinaciones específicas entre método de retiro y servicio nuevo a aplicar. Esto es, con diferencia, el hallazgo de mayor impacto de la sesión.
- Existe un problema operativo real y frecuente de **sobreagendamiento/confusión por alta demanda**, que valida (con urgencia de negocio, no solo de arquitectura) un hallazgo ya identificado en `ARCHITECTURE_REVIEW.md` (F-04) que nunca llegó a resolverse como caso de uso.
- Aparece un dominio de negocio **completamente nuevo**: la **garantía de servicio** (7 días), que no tiene representación en ningún documento actual.
- Aparecen matices operativos concretos sobre **agenda** (manicurista exclusiva, fallback ante falta de espacio), **CRM** (etiquetas de cliente), y **conversación con IA** (clarificación ante respuestas ambiguas, antes de escalar a humano).
- Se reconfirmó información ya cubierta (3 sucursales con 3 números de WhatsApp, diseño como extra por uña) sin contradicción.
- Queda al menos un punto ("pautas") sin suficiente contexto para clasificar.

---

## 2. Nuevos requisitos

### 2.1 Funcionales

| # | Requisito | Descripción |
|---|---|---|
| F1 | Bandeja de chats sin contestar | Vista/filtro dedicado en el panel administrativo que muestre conversaciones donde el último mensaje es del cliente y no ha sido respondido (por bot ni por humano) más allá de un umbral de tiempo (pendiente de definir, ver Sección 4). |
| F2 | Sistema de etiquetas de cliente | Mecanismo flexible de etiquetado por clienta, adicional al `estado` ya existente (normal/VIP/lista roja/bloqueada). Gobernanza (catálogo cerrado vs. libre, alcance global vs. por sucursal) pendiente de definir. |
| F3 | Registro y validación de solicitudes de garantía | Flujo para que una clienta reporte un problema con el producto aplicado (se cayó/maltrató) dentro de los 7 días posteriores al servicio, con validación de que la fecha y el servicio reportado coinciden con el servicio realmente realizado. |
| F4 | Contenido promocional en recordatorio de 24h | El recordatorio automático ya existente debe poder portar un mensaje de cortesía configurable (ej. "tienes exfoliante y café gratis"), no solo fecha/hora de la cita. |

### 2.2 Reglas de negocio

| # | Regla | Descripción |
|---|---|---|
| N1 | Garantía de servicio de 7 días | Si el producto aplicado se cae o se maltrata dentro de los 7 días posteriores al servicio, y el reclamo coincide con el servicio efectivamente realizado, aplica garantía. El beneficio exacto (reposición gratuita, descuento, etc.) y quién aprueba (automático vs. humano) no fueron especificados — ver Sección 4. |
| N2 | Contenido de cortesía en recordatorio | El recordatorio de 24h antes debe incluir explícitamente la mención de exfoliante y café gratis. No se especificó si es una cortesía permanente o una promoción con vigencia limitada — ver Sección 4. |

### 2.3 Restricciones

| # | Restricción | Descripción |
|---|---|---|
| R1 | Un número de WhatsApp por sucursal (3 sucursales, 3 números) | Ya cubierto por `01-domain-discovery.md` (`Sucursal.numero_whatsapp`) — se confirma sin cambios. |
| R2 | Diseño es un extra por uña, no un servicio aparte | El servicio base (ej. Gelish) cubre las 10 uñas; un diseño en un subconjunto de uñas es un costo/tiempo adicional específico de esas uñas. Ya cubierto por `ModificadorDeDiseño`/`ComposicionPorUña` (DD §5.2) — se confirma sin cambios. |

### 2.4 Problemas operativos (contexto de negocio, no requisitos de diseño directos)

| # | Problema | Descripción |
|---|---|---|
| O1 | Colaboradores no agendan correctamente tiempo/servicio por uña | Causa raíz de errores de agendamiento hoy — motiva directamente las reglas de cotización 2.6 (duración por combinación). |
| O2 | Alta demanda con pocos espacios disponibles | Motiva la regla de agenda A1 (fallback de disponibilidad). |
| O3 | Chats se pierden sin contestar | Motiva el requisito funcional F1. |
| O4 | Confusión de citas por alta demanda / sobreagendamiento | Motiva la regla de agenda A3 y reactiva el hallazgo F-04 de `ARCHITECTURE_REVIEW.md`. |
| O5 | Trato personal / customer service / fidelidad percibidos como insuficientes hoy | No genera un requisito estructural nuevo — refuerza la prioridad de un principio de tono ya existente. |

### 2.5 Reglas conversacionales

| # | Regla | Descripción |
|---|---|---|
| C1 | Clarificación ante respuesta ambigua | Si el cliente responde de forma ambigua a una pregunta compuesta (ej. "sí" a dos preguntas), el bot debe re-preguntar para clarificar **antes** de considerar escalar a humano. Matiza el alcance del principio 9.6 (`02-architecture-principles.md`), que hoy no distingue explícitamente este caso de una escalada por baja confianza. |
| C2 | Refuerzo de tono personal / fidelización | El bot debe sostener un trato cercano y personal, coherente con lo ya definido en el Domain Discovery original ("que no se note como bot") — se reafirma, no se redefine. |

### 2.6 Reglas de agenda

| # | Regla | Descripción |
|---|---|---|
| A1 | Fallback ante falta de disponibilidad | Si no hay espacio con la manicurista/horario solicitado, el sistema debe proponer una manicurista alterna o un horario alterno. |
| A2 | Manicurista exclusiva | Algunas clientas solicitan una manicurista específica de forma exclusiva — si no está disponible, no debe ofrecerse automáticamente otra manicurista como sustituto (a diferencia de A1, que sí lo permite cuando no hay preferencia exclusiva). |
| A3 | Manejo de conflicto de confirmación tardía | Cuando el horario mostrado durante la conversación ya no está disponible al momento de confirmar (por alta concurrencia), el bot debe tener una respuesta conversacional definida, no un error genérico — reactiva el hallazgo F-04 (`ARCHITECTURE_REVIEW.md`). |

### 2.7 Reglas de cotización

| # | Regla | Descripción |
|---|---|---|
| Q1 | "Retiro" como categoría de servicio propia | Existe un servicio de retiro (de gel/acrílico/rubber existente), distinto del servicio de aplicación nueva, con su propio tiempo según el método usado (drill o acetona). |
| Q2 | Duración por combinación, no por suma | La duración total de un servicio compuesto (retiro + aplicación, o combinación de aplicaciones) es una **tabla de combinaciones específicas**, no la suma de las duraciones individuales de cada servicio. Ejemplo explícito de la sesión: "Rubber + gel + Manicure = 1 hora" (no la suma de los tres tiempos individuales). |
| Q3 | Tablas de tiempo aportadas por la dueña | Se recibieron tablas concretas de duración para combinaciones de Retiro (con drill o acetona) + servicio nuevo, y de Aplicación pura — ver detalle abajo. |

**Tablas de tiempo recibidas (registradas aquí textualmente, sin reinterpretar):**

*Retiro:*
- Retiro de gel con drill + Acrílico / Rubber / Gel = 1h 15min (los tres)
- Retiro de gel con acetona + Acrílico / Rubber / Gel = 1h (los tres)
- Retiro Gel + Rubber / Gel / Manicure = 1h (los tres)
- Retiro Acrílico + Rubber / Gel / Manicure = 2h (los tres); Retiro Rubber + Rubber / Gel / Manicure = 2h (los tres)
- Retiro Acrílico + extensiones / Baño = 3h; Retiro Rubber + extensiones / Baño = 3h
- Retiro Acrílico + extensiones + Manicure = 3h; Retiro Acrílico + Baño de acrílico + Manicure = 3h; Retiro Rubber + extensiones + Manicure = 3h; Retiro Rubber + baño de acrílico + extensiones = 3h

*Aplicación:*
- Solo Gel = 1h; Solo Rubber = 1h; Solo Manicure = 1h
- Rubber + Gel + Manicure = 1h (combinado, no suma)
- Extensiones + Gel = 2h (aparece dos veces en la sesión, con la misma duración)
- Baño de Acrílico = 2h
- Baño de Acrílico + Gel + Manicure = 2h

**Nota de fidelidad a la fuente:** estas tablas se transcriben tal como se recibieron. No cubren todas las combinaciones posibles (ej. no aparece "Retiro + Manicure" como combinación de retiro, ni "Baño de Acrílico" como servicio de retiro) — ver Sección 4.

---

## 3. Impacto en el dominio

| # | Qué cambia | Documentos impactados | Agrega / Modifica / Elimina / Contradice |
|---|---|---|---|
| R1, R2 | Nada — confirman supuestos ya adoptados | Ninguno | Ninguno de los tres — información ya reflejada tal cual. |
| F1 (chats sin contestar) | Nuevo caso de uso de panel administrativo | `01-domain-discovery.md` §6 (nuevo caso de uso); posible nota en §5.3; Mockup (pantalla nueva, **congelado, no se toca sin autorización explícita**) | **Agrega.** No modifica ni contradice nada existente. |
| F2 / N/A (etiquetas) | Nuevo mecanismo de datos para `Clienta`, adicional a `estado` | `01-domain-discovery.md` §5.5; `04-data-model.md` §5.5 (nueva tabla de etiquetas + tabla de unión) | **Agrega.** No modifica `EstadoClienta`, que permanece igual. |
| F3 / N1 (garantía) | Dominio de negocio completamente nuevo — sin representación previa | `01-domain-discovery.md` (nuevo subdominio/Bounded Context o extensión de uno existente, nueva entidad, nuevo caso de uso); posiblemente ADR-001/ADR-005 (solo actualización de conteo de Bounded Contexts, no de la decisión de fondo); `04-data-model.md` (nuevo esquema/tablas); Mockup (pantalla nueva, congelado) | **Agrega** en su totalidad — no hay nada previo que modificar, eliminar o contradecir. |
| F4 / N2 (cortesía en recordatorio) | Contenido de negocio nuevo sobre una estructura ya existente | `01-domain-discovery.md` §5.12 (nota de contenido); `04-data-model.md` (posible ajuste menor, sin cambio estructural si `Notificacion` ya soporta contenido libre) | **Agrega.** No modifica el mecanismo de recordatorio de 24h ya definido (ADR-008), solo su contenido. |
| A1 (fallback disponibilidad) | Explicita una regla que antes era implícita en un caso de uso genérico | `01-domain-discovery.md` §6 (especificar caso de uso 3) | **Agrega/especifica.** No contradice el caso de uso genérico existente, lo hace concreto. |
| A2 (manicurista exclusiva) | Matiza una estructura ya existente (`Cita.manicurista`, opcional) | `01-domain-discovery.md` §5.1 (nota de diseño); `04-data-model.md` §5.1 (posible columna nueva) | **Agrega/modifica** la interpretación de negocio de un campo ya existente — no cambia el campo en sí. |
| A3 (conflicto de confirmación tardía) | Cierra un vacío ya identificado (F-04) que nunca se convirtió en caso de uso | `01-domain-discovery.md` §6 (nuevo caso de uso) | **Agrega.** Reactiva, no contradice, un hallazgo ya registrado en `ARCHITECTURE_REVIEW.md`. |
| C1 (clarificación ante ambigüedad) | Aclara el alcance de un principio ya aprobado | `02-architecture-principles.md` §9, principio 9.6; `01-domain-discovery.md` §6 (posible caso de uso) | **Modifica la redacción** de 9.6 para distinguir clarificación conversacional de escalada por baja confianza — no cambia la decisión de fondo del principio (la IA interpreta, no decide; se sigue escalando ante ambigüedad genuina tras clarificar). |
| C2 (refuerzo de tono) | Sin cambio estructural | Ninguno de forma directa (relevante para un futuro golden set de pruebas, `06-development-plan.md`, fuera de esta serie) | Ninguno — refuerzo de prioridad, no información nueva. |
| Q1/Q2/Q3 (motor de duración) | El cambio de mayor impacto de la sesión — introduce "Retiro" como concepto y revela que la duración es una tabla de combinaciones, no una suma | `01-domain-discovery.md` §5.2 (ampliar modelo de `Catálogo y Cotización`); `04-data-model.md` §5.2 (nueva tabla de reglas de combinación de duración) | **Agrega** una estructura que no existía (tabla de combinaciones). **No contradice** ninguna decisión ya cerrada — ningún documento afirmaba explícitamente que la duración fuera una suma; era un vacío, no una decisión. Se documenta así para que quede explícito que no se está reabriendo nada, solo completando información que antes no existía. |

**Conclusión de impacto:** ningún punto de esta sesión contradice de forma objetiva una decisión ya cerrada en `01-domain-discovery.md`, `02-architecture-principles.md`, un ADR, `03-technical-architecture.md` o `04-data-model.md`. El impacto es, en todos los casos, de **adición** o de **especificación de un vacío ya existente** — con la única aclaración de redacción necesaria en el principio 9.6.

---

## 4. Preguntas abiertas

1. **"Pautas"** — mencionado sin desarrollo en la sesión. Sin contexto suficiente para clasificar ni para generar un requisito.
2. **Garantía:**
   - ¿La aprobación es automática (si ventana + servicio coinciden) o siempre requiere validación de un empleado?
   - ¿Qué pasa ante una coincidencia parcial (ej. se cayó una uña con diseño, pero el servicio de referencia fue solo un retiro)?
   - ¿Cuál es el beneficio exacto de la garantía (reposición gratuita, descuento, otro)?
   - ¿La política es igual en las 3 sucursales o puede variar?
3. **Etiquetas de cliente:** ¿catálogo cerrado definido por administración o libres/texto abierto? ¿Alcance global o por sucursal?
4. **Manicurista exclusiva:** si no hay ningún horario disponible con esa manicurista en un rango razonable, ¿se ofrece lista de espera o simplemente se informa que no hay disponibilidad?
5. **Motor de duración (Retiro/Aplicación):**
   - Las tablas no cubren todas las combinaciones posibles (ej. "Retiro + Manicure" sin especificar, "Baño de Acrílico" como servicio de retiro) — ¿qué duración aplica a combinaciones no listadas?
   - ¿Quién decide el método de retiro (drill vs. acetona) — la manicurista, el cliente, o depende del producto a retirar?
   - ¿Estas duraciones son fijas para las tres sucursales o pueden variar por sucursal (relevante para el override ya modelado en `04-data-model.md` §5.2)?
6. **Chats sin contestar:** ¿cuál es el umbral de tiempo para considerarlo "sin contestar"?
7. **Cortesía en recordatorio:** ¿es permanente o una promoción con vigencia limitada? Afecta si el contenido va fijo en la plantilla de WhatsApp (ADR-008) o debe ser editable sin republicar la plantilla.
8. **Alta demanda / priorización:** cuando dos personas compiten por el mismo horario, ¿existe algún criterio de prioridad de negocio (VIP primero, orden de llegada, etc.) más allá de "quien confirma primero, se queda con el horario"?

---

## 5. Recomendaciones del arquitecto

**Incorporar ahora (en la próxima ronda de actualización documental):**
- **Q1/Q2/Q3 (motor de duración por combinación)** — es el hallazgo de mayor impacto y toca directamente el Core Domain ya identificado como el de mayor complejidad del negocio. Postergarlo dejaría el documento de dominio desactualizado en su parte más crítica. Se recomienda incorporar la **estructura** (tabla de combinaciones) ahora, aun sabiendo que faltan combinaciones por confirmar (pregunta abierta #5) — mismo tratamiento que ya se dio a otros vacíos de datos exactos en este proyecto (ej. RPO/RTO de ADR-022): estructura firme, valores exactos pendientes.
- **A1, A2, A3 (reglas de agenda)** — bajo costo de modelado, alto valor de negocio, sin preguntas abiertas que las bloqueen estructuralmente (A2 tiene una pregunta abierta sobre el caso límite, pero no bloquea modelar la exclusividad en sí).
- **C1 (clarificación conversacional)** — es una aclaración de redacción de un principio ya aprobado, no una decisión nueva; bajo riesgo, alto valor para evitar escaladas innecesarias a humano.
- **F4/N2 (contenido de recordatorio)** — bajo costo, aunque la pregunta abierta #7 sobre editabilidad debe resolverse antes de fijar el mecanismo técnico exacto.
- **F2 (etiquetas de cliente)** — se recomienda incorporar la **capacidad** (estructura de datos) ahora, dejando la gobernanza exacta (pregunta abierta #3) para cuando se confirme — mismo patrón que `servicio_sucursal_override` en `04-data-model.md`.

**Dejar para una versión futura (no bloquean el cierre de esta ronda, pero tampoco se descartan):**
- **F3/N1 (Garantía)** — es un dominio de negocio genuinamente nuevo con preguntas abiertas que **sí** bloquean un diseño completo (¿quién aprueba?, ¿qué pasa ante coincidencia parcial?, ¿qué beneficio exacto?). Se recomienda **registrar su existencia** en `01-domain-discovery.md` (para no perder la información) marcado explícitamente como pendiente de diseño completo, sin construir el aggregate/caso de uso completo hasta tener las respuestas de la pregunta abierta #2. Esto evita tanto perder la información como diseñar sobre supuestos no confirmados en un dominio nuevo.
- **F1 (chats sin contestar)** — es una funcionalidad de panel/reporting, no de modelado de dominio central; se recomienda registrar el caso de uso ahora (costo casi nulo) pero tratar su implementación como parte de `06-development-plan.md` más adelante, no como algo que deba mover `04-data-model.md` en esta ronda salvo que se confirme que requiere un cambio de esquema (ver pregunta abierta #6, de la cual depende el diseño exacto).
- **C2 (refuerzo de tono)** — no requiere ningún cambio documental estructural; se recomienda simplemente tenerlo presente para el futuro golden set de pruebas conversacionales (ADR-019), en la fase de implementación.

---

## 6. Matriz de prioridades

| Requisito | Prioridad | Justificación |
|---|---|---|
| Q1/Q2/Q3 — Motor de duración por combinación | **Must Have** | Corazón del Core Domain de cotización; sin esto, el sistema no puede cotizar correctamente combinaciones reales ya identificadas como el problema operativo más citado en la sesión (O1). |
| A3 — Conflicto de confirmación tardía | **Must Have** | Cierra un hallazgo ya clasificado como riesgo (F-04) y validado ahora como dolor operativo real y frecuente (O4), no solo teórico. |
| A2 — Manicurista exclusiva | **Must Have** | Mencionado explícitamente como requisito de negocio recurrente; afecta el motor de agenda central. |
| A1 — Fallback de disponibilidad | **Must Have** | Bajo costo, alto valor, sin bloqueos — completa un caso de uso ya existente de forma genérica. |
| C1 — Clarificación conversacional | **Must Have** | Afecta la calidad de interpretación de IA, que es parte del Core Domain conversacional; bajo riesgo de implementación. |
| F2 — Etiquetas de cliente | **Should Have** | Mejora real de CRM, pero no bloquea el flujo central de agendamiento/cotización. |
| F3/N1 — Garantía | **Should Have** | Importante para el negocio (impacto reputacional y de confianza), pero con preguntas abiertas que impiden un diseño completo hoy — se incorpora su existencia, no su diseño final. |
| F4/N2 — Cortesía en recordatorio | **Should Have** | Bajo riesgo y valor claro, pero depende de una respuesta pendiente (editabilidad) antes de fijar el mecanismo técnico. |
| F1 — Chats sin contestar | **Should Have** | Valor operativo real, pero es una funcionalidad de panel, no un cambio de modelo de dominio central. |
| C2 — Refuerzo de tono personal | **Could Have** | Relevante para negocio, pero no genera un requisito estructural nuevo — es énfasis, no diseño. |
| "Pautas" | **Won't Have (por ahora)** | No hay información suficiente para priorizar ni diseñar; requiere clarificación antes de poder clasificarse. |

---

Este documento queda pendiente de tu revisión y aprobación explícita. Ningún documento existente (`01-domain-discovery.md`, `02-architecture-principles.md`, ADRs, `03-technical-architecture.md`, `04-data-model.md`) fue modificado.
