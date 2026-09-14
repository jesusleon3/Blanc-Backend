# Discovery Checklist — Blanc

> **Propósito:** guía oficial para toda reunión con la dueña de Blanc de aquí en adelante. Cada pregunta de este documento está respaldada por evidencia documental exacta — ninguna se agregó por intuición. Cuando todas las preguntas de la Sección 1 tengan respuesta, la etapa de Discovery puede declararse formalmente cerrada.
> **Método:** síntesis, no investigación nueva. Consolida las 18 Preguntas Abiertas originales de `01-domain-discovery.md` §2/§9, las 24 de `docs/business-rules/99-open-questions.md`, y las que la revisión adversarial de este proyecto encontró sin registrar en ningún documento (Sección 4).
> **Fecha:** 2026-07-16.
> **Actualización 2026-08-03:** la Dueña respondió las 31 preguntas de la Sección 1 en una reunión real (transcrita en "Notas Blanc.pdf"). Cada pregunta fue comparada contra esa transcripción y quedó marcada con su resultado (`→ Resultado reunión con la Dueña`) directamente debajo de su ficha original, sin borrar el contenido previo, por trazabilidad histórica. Ver Sección 5 para el registro de cierre de esta ronda y el veredicto de si es razonable iniciar desarrollo. **Esta actualización toca únicamente este documento** — Domain Discovery, Business Rules, ADRs, Data Model y Decision Flows se actualizarán en una pasada posterior, una vez validado este cierre.

---

## 1. Preguntas que deben responderse

### Categoría: Agenda

#### 1.1 — Fuente de verdad del calendario (Google Calendar vs. plataforma)
- **Pregunta exacta:** ¿Confirmas que la plataforma es la única fuente de verdad de disponibilidad, y que Google Calendar es solo una vista de consulta que tu equipo no debe editar directamente?
- **Por qué existe:** `01-domain-discovery.md` Pregunta Abierta #1; `ADR-006` la llama textualmente *"la más urgente... debe resolverse formalmente antes de construir el módulo de sincronización"*.
- **Documentos que dependen:** `ADR-006`, `RN-AGE-09`, `04-data-model.md` §5.9.
- **Módulos que dependen:** Agenda, Sincronización de Calendario.
- **Fases que bloquea:** Fase 4 (Sincronización de Calendario) — no bloquea Fase 1/2.
- **Criticidad:** Crítica — es, según el propio ADR-006, la pregunta de mayor urgencia de todo el Domain Discovery, y **hoy no tiene ni siquiera un número `PA-NN` asignado** en `99-open-questions.md` — se quedó fuera de esa consolidación pese a su propia urgencia declarada.
- **¿Valor provisional aceptable?** Sí — la plataforma como fuente de verdad ya es el supuesto de trabajo implementado en todo el diseño; se puede seguir construyendo con este supuesto.
- **Riesgo de asumir:** Si el negocio en realidad necesita seguir editando en Google Calendar como flujo válido, la arquitectura completa de sincronización unidireccional (ADR-006) debe rediseñarse.
- **Recomendación arquitectónica:** Confirmar el supuesto ya adoptado — es la opción que ya recomendó el consultor de negocio y la que sostiene el invariante de no-doble-booking sin depender de una API externa.
- **Quién responde:** Dueña.
- **Documento a modificar:** `ADR-006` (Status → Accepted con esta confirmación), `99-open-questions.md` (agregar como `PA-25` para que quede trazada formalmente).

**→ Resultado reunión con la Dueña (actualizado 2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"Que la fuente sea la plataforma. Mientras se sincronice con Google Calendar en tiempo real o cerca de eso no hay problema."*
- **Cierre oficial:** Sí — confirma exactamente el supuesto ya adoptado (la plataforma es la fuente de verdad).
- **Hallazgo adicional:** introduce un requisito de latencia no capturado antes ("tiempo real o cerca de eso"). Debe cotejarse explícitamente contra el SLO provisional ya existente ("rezago de Outbox > 5 min" en `03-technical-architecture.md` §6.3) en la próxima pasada sobre `ADR-006`/`03`. A simple vista son compatibles, pero no se ha confirmado formalmente.

#### 1.2 — Prioridad entre candidatas a un horario liberado (`PA-01`)
- **Pregunta exacta:** Cuando se libera un horario y hay varias clientas interesadas (lista de espera o cambio de horario), ¿existe un criterio de prioridad (VIP primero, orden de llegada, otro), o gana quien confirme primero?
- **Por qué existe:** `RN-AGE-06`, `RN-AGE-07`, `RN-AGE-13` (Faltante).
- **Documentos que dependen:** `docs/business-rules/01-agenda.md`, `decision-flows-catalogo-diseno.md` (`FL-AGE-03`, `FL-AGE-06`).
- **Módulos que dependen:** Agenda.
- **Fases que bloquea:** Fase 2 (completitud de `FL-AGE-03`/`FL-AGE-06`, hoy en 45-63%).
- **Criticidad:** Alta.
- **¿Valor provisional aceptable?** Sí — "quien confirme primero" como regla por defecto, documentada como provisional.
- **Riesgo de asumir:** Fricción con clientas VIP si esperaban prioridad implícita.
- **Recomendación arquitectónica:** FIFO simple como default, dado que no hay evidencia de que el negocio ya opere con prioridad VIP hoy.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-AGE-13` (Faltante → Aprobada).

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"El primero que conteste. (Cuando alguien confirma ella elimina el mensaje de las que no contestaron.) Cuando no hay, le ofrece horarios en otra sucursal."*
- **Cierre oficial:** Sí — confirma FIFO como regla de prioridad, exactamente la recomendación arquitectónica.
- **Hallazgo adicional:** aparece una capacidad **no documentada en ningún Rule ID ni Decision Flow**: ofrecer horario en OTRA sucursal cuando no hay disponibilidad en la solicitada. Ningún `RN-AGE-04/06/07/13` cubre hoy un fallback entre sucursales. Candidato a nueva regla de negocio — fuera de alcance de esta actualización, debe evaluarse en la siguiente pasada sobre Business Rules.

#### 1.3 — ¿El cierre dominical es una regla real? (`PA-21`)
- **Pregunta exacta:** ¿Las 3 (4) sucursales cierran los domingos como regla de negocio real, o es solo un dato ilustrativo del mockup?
- **Por qué existe:** `RN-AGE-12` — "Asumida, no documentada", tomada únicamente de `mockup/js/data.js`.
- **Documentos que dependen:** `docs/business-rules/01-agenda.md`, `04-data-model.md` §5.7 (`horario_semanal`).
- **Módulos que dependen:** Sucursales y Personal, Agenda.
- **Fases que bloquea:** Ninguna de forma dura — pero afecta directamente los datos semilla (seeds) de Fase 1.
- **Criticidad:** Baja.
- **¿Valor provisional aceptable?** Sí — se puede sembrar con el horario del mockup y corregir después sin costo real.
- **Riesgo de asumir:** Bajo — es solo un dato de configuración, no un invariante.
- **Recomendación arquitectónica:** Confirmar el dato real por sucursal, no asumir que las tres tienen el mismo horario.
- **Quién responde:** Dueña u operación de cada sucursal.
- **Documento a modificar:** `RN-AGE-12` (Asumida → Aprobada), datos semilla.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** horario completo: lunes a viernes 9am-12pm y 3pm-6pm; sábado 9am-3pm; domingo cerrado para citas pero **sí se responden mensajes** ("si alguien manda mensaje en domingo igual se le conteste, pero no se trabaja, no se pueden poner citas en domingo"). Además: *"en caso de que haya citas que necesiten dos o más horas para completarse, deben agendarse de manera que no sobrepasen las 12pm o las 6pm... no se puede agendar una cita de 2 horas a las 11am porque después de las 12 no se trabaja."*
- **Cierre oficial:** Sí — confirma que el cierre dominical es una regla de negocio real, con horario partido completo por día.
- **Hallazgo adicional (importante):** revela un **invariante nuevo no modelado**: ninguna cita puede cruzar el corte de mediodía (12pm-3pm) ni el cierre de las 6pm/3pm. Esto afecta directamente el motor de disponibilidad para servicios de 2+ horas — no es solo un dato semilla, es una restricción de negocio candidata a `RN-AGE-10`/`RN-AGE-12` y al diseño del motor de disponibilidad (Fase 2).

#### 1.4 — Ventana de respuesta para oferta de cambio de horario (`PA-22`)
- **Pregunta exacta:** ¿Cuánto tiempo tiene una clienta para responder a un aviso de "se liberó un horario mejor" antes de que se considere que no le interesó?
- **Por qué existe:** `RN-AGE-06`, sin ventana definida.
- **Documentos que dependen:** `docs/business-rules/01-agenda.md`, `decision-flows-catalogo-diseno.md` (`FL-AGE-03`).
- **Módulos que dependen:** Agenda.
- **Fases que bloquea:** Fase 2 (completitud de `FL-AGE-02`/`FL-AGE-03`, hoy 45-55%).
- **Criticidad:** Alta.
- **¿Valor provisional aceptable?** Sí — un valor conservador (ej. 30-60 min) documentado como provisional, mismo patrón que RPO/RTO.
- **Riesgo de asumir:** Bajo si se documenta como provisional y se ajusta con datos reales.
- **Recomendación arquitectónica:** Valor corto (minutos, no horas) dado que compite con otras clientas por el mismo cupo.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-AGE-06`.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"La oferta queda hasta que se llene ese espacio disponible, ya sea por esa misma persona o por otra persona. En caso de que ella conteste y el espacio ya está ocupado se le tiene que avisar que se llenó en ese tiempo."*
- **Cierre oficial:** Sí — responde la pregunta, con un mecanismo distinto al recomendado: basado en el **evento** "se llenó el cupo", no en una ventana de tiempo fija. Debe agregarse el mensaje explícito de "ya se llenó" al flujo (conecta con `RN-AGE-05`, manejo de conflicto).
- **Hallazgo adicional:** sugiere una funcionalidad nueva no contemplada — *"que tengan etiquetas de donde viven... por que luego también se les ofrecen citas dependiendo del lugar donde viven"*. Es una sugerencia abierta de la Dueña, no una decisión ya tomada; candidata a evaluar en una fase posterior, fuera de alcance de esta actualización.

#### 1.5 — Lista de espera: expiración y prioridad (`PA-23`)
- **Pregunta exacta:** ¿Una entrada en lista de espera expira después de cierto tiempo? ¿Es estrictamente FIFO o hay prioridad (ej. VIP primero)?
- **Por qué existe:** `RN-AGE-07`.
- **Documentos que dependen:** `docs/business-rules/01-agenda.md`, `04-data-model.md` §5.1 (`lista_espera_entradas.expira_en`).
- **Módulos que dependen:** Agenda.
- **Fases que bloquea:** Fase 2 (`FL-AGE-05`/`FL-AGE-06`, hoy 63-67%).
- **Criticidad:** Alta.
- **¿Valor provisional aceptable?** Sí.
- **Riesgo de asumir:** Medio — una entrada que nunca expira puede acumular lista de espera obsoleta.
- **Recomendación arquitectónica:** FIFO con expiración conservadora (ej. 48-72h), documentada como provisional.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-AGE-07`.

#### 1.6 — Disparador de `completada`/`no_show` (Domain Discovery Pregunta #15, sin `PA-NN`)
- **Pregunta exacta:** ¿Cuándo se considera que una cita "se completó" o que la clienta "no se presentó" — lo marca un empleado manualmente, o el sistema lo infiere automáticamente por el paso del tiempo?
- **Por qué existe:** `01-domain-discovery.md` Pregunta Abierta #15. **Nunca se promovió a `PA-NN`** — es la misma naturaleza de vacío que `PA-19`, pero sin trazabilidad formal en el Business Rules Engine. `decision-flows-trazabilidad.md` ya identificó que esto bloquea, en cascada, la creación de `RN-AGE-14`, el cierre de la máquina de estados de `Cita`, la existencia del evento `CitaCompletada`, y el propio Decision Flow "Completada/No-Show" excluido del catálogo congelado.
- **Documentos que dependen:** `01-domain-discovery.md`, `docs/business-rules/01-agenda.md` (crear `RN-AGE-14`), `decision-flows-catalogo-diseno.md`, `04-data-model.md` §5.1.
- **Módulos que dependen:** Agenda, Garantías (depende del evento `CitaCompletada`).
- **Fases que bloquea:** Fase 2 (máquina de estados de `Cita`) y Fase 5 (Garantías).
- **Criticidad:** Crítica — es el hallazgo de mayor apalancamiento de todo el proyecto: una sola respuesta desbloquea cuatro pendientes simultáneamente.
- **¿Valor provisional aceptable?** No para el diseño formal de la máquina de estados — se necesita una respuesta real, no un valor de relleno.
- **Riesgo de asumir:** Alto — cualquier supuesto no confirmado aquí definiría directamente qué invariante puede o no implementarse en `agenda.citas`.
- **Recomendación arquitectónica:** Disparador manual por el empleado para `completada` (consistente con "control humano sobre decisiones sensibles"); `no_show` con un disparador temporal automático tras la hora de la cita más una ventana de gracia — pero es una recomendación, no una decisión aceptable sin confirmación.
- **Quién responde:** Dueña.
- **Documento a modificar:** `01-domain-discovery.md` (adenda), `RN-AGE-14` (nueva regla), `decision-flows-catalogo-diseno.md` (reincorporar el flujo excluido).

**→ Resultado reunión con la Dueña (2026-08-03):** 🟡 **B — Parcialmente respondida.**
- **Respuesta registrada:** *"Sí, el 'no show' es manual y se toma como completado cuando no haya un inconveniente con la cita... Si el cliente pide reagendar o cancelar la cita de 59 minutos para abajo antes de la cita, o después de la hora que tenía la cita que van a cancelar, se manda la sugerencia de agregar a lista roja."*
- **Qué queda resuelto:** `no_show` es un disparador **manual** (lo marca un empleado); aparece, además, una regla nueva de alto valor: cancelar/reagendar dentro de los 59-60 minutos previos (o después de la hora de la cita) dispara automáticamente una sugerencia de lista roja — ver también 1.7 y 1.18, mismo patrón en las tres respuestas.
- **Qué sigue sin resolver:** el mecanismo exacto de `completada` sigue ambiguo — la redacción *"se toma como completado cuando no haya un inconveniente"* admite dos lecturas distintas: (a) es un estado por defecto que el sistema asigna automáticamente si nadie marca lo contrario tras el paso del tiempo, o (b) también requiere una acción manual del empleado, igual que `no_show`. Esta es la pregunta de mayor apalancamiento del proyecto (bloquea en cascada `RN-AGE-14`, el evento `CitaCompletada` y Garantías) y merece una repregunta literal y puntual antes de cerrarse.
- **¿Se cierra oficialmente?** No — se mantiene abierta solo para el punto exacto de `completada` automática vs. manual. El resto (no_show manual, regla de 59 min) se da por resuelto.
- **Riesgo de asumir sin ese punto:** Alto — define directamente el invariante de la máquina de estados de `Cita`, en diseño activo (Fase 0).

#### 1.7 — Ventana mínima para cancelar/reprogramar sin penalización (Domain Discovery Pregunta #5)
- **Pregunta exacta:** ¿Existe un tiempo mínimo antes de la cita (ej. 2 horas) para poder cancelar o reprogramar sin ninguna restricción adicional?
- **Por qué existe:** `01-domain-discovery.md` Pregunta Abierta #5 — nunca se promovió a `PA-NN`, supuesto de trabajo: sin restricción.
- **Documentos que dependen:** `01-domain-discovery.md`, `docs/business-rules/01-agenda.md`.
- **Módulos que dependen:** Agenda.
- **Fases que bloquea:** Ninguna de forma dura — el supuesto actual (sin restricción) es funcional.
- **Criticidad:** Media.
- **¿Valor provisional aceptable?** Sí — ya es el supuesto vigente.
- **Riesgo de asumir:** Bajo-medio — sin ventana, una clienta podría cancelar minutos antes sin consecuencia, lo cual podría no reflejar la operación real del negocio.
- **Recomendación arquitectónica:** Mantener el supuesto de "sin restricción" salvo que la Dueña confirme que sí existe una política real hoy en el negocio.
- **Quién responde:** Dueña.
- **Documento a modificar:** `01-domain-discovery.md`, nuevo Rule ID si aplica.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"Sí se puede reagendar o cancelar hasta la hora de la cita, pero de 60 a 0 minutos antes de la cita se manda sugerencia de lista roja. Si quiere reagendar 20 minutos antes, si se pide anticipo, pero depende la situación."*
- **Cierre oficial:** Sí — responde con precisión numérica: no hay ventana dura de bloqueo, pero 60-0 min antes activa la sugerencia de lista roja. Confirma y amplía la "regla de 59-60 minutos" ya vista en 1.6 (y en 1.18) — patrón consistente en tres respuestas independientes, alta confianza.
- **Nota:** el matiz sobre pedir anticipo al reagendar ~20 min antes ("depende la situación") es explícitamente discrecional, no una regla determinista — consistente con el principio de control humano en decisiones sensibles ya adoptado en el proyecto; no requiere una regla formal adicional.

#### 1.8 — Tratamiento de un snapshot de cotización erróneo por error humano (Domain Discovery Pregunta #13, segunda parte)
- **Pregunta exacta:** Si el precio/tiempo de una cita ya confirmada se calculó mal por un error de captura (no por un cambio legítimo de catálogo), ¿cómo se corrige? ¿Quién lo autoriza?
- **Por qué existe:** `RN-AGE-08` nota explícita: *"no es una pregunta de esta carpeta, es de diseño de caso de uso"* — es decir, deliberadamente nunca se registró como `PA-NN`. `ARCHITECTURE_REVIEW.md` (F-28) y `04-data-model.md` §7.2 ya lo señalan como vacío conocido.
- **Documentos que dependen:** `04-data-model.md` §7.2 (`agenda.ajustes_cotizacion`, ya propuesta como estructura aditiva).
- **Módulos que dependen:** Agenda.
- **Fases que bloquea:** No bloquea el inicio de Fase 2 — solo bloquea diseñar el caso de uso de corrección administrativa.
- **Criticidad:** Baja-Media.
- **¿Valor provisional aceptable?** Sí — se puede diferir el caso de uso completo hasta que ocurra la primera necesidad real.
- **Riesgo de asumir:** Bajo — la estructura de datos aditiva ya está propuesta, sin activarse.
- **Recomendación arquitectónica:** Diferir el diseño del caso de uso hasta que se necesite, manteniendo la tabla de ajustes ya propuesta como estructura preventiva de bajo costo.
- **Quién responde:** Dueña (cuándo y quién autoriza la corrección).
- **Documento a modificar:** `01-domain-discovery.md` (si se decide formalizar), `04-data-model.md` §7.2 (activar).

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"Lo autoriza la dueña y se corrige por medio de la plataforma, se manda sugerencia de modificación para que esto se modifique, pero no se hace automático."*
- **Cierre oficial:** Sí — coincide exactamente con la recomendación arquitectónica (autoriza la Dueña, se corrige en plataforma, nunca de forma automática).

### Categoría: Duración y Cotización

#### 1.9 — Combinaciones de retiro/aplicación no listadas (`PA-02`)
- **Pregunta exacta:** Para combinaciones que no aparecen en las tablas ya recibidas (ej. "Retiro + Manicure" sin especificar, "Baño de Acrílico" como servicio de retiro), ¿qué duración/precio aplica?
- **Por qué existe:** `RN-COT-04`, Sesión 02 de Domain Discovery.
- **Documentos que dependen:** `docs/business-rules/02-duracion-cotizacion.md`, `04-data-model.md` §5.2.
- **Módulos que dependen:** Catálogo y Cotización.
- **Fases que bloquea:** Fase 1 (motor de duración completo) — no bloquea el CRUD base de catálogo.
- **Criticidad:** Crítica — es el Core Domain diferenciador del negocio.
- **¿Valor provisional aceptable?** Sí, con un fallback aditivo (suma de tiempos individuales) marcado explícitamente como estimado, mientras se completan las tablas.
- **Riesgo de asumir:** Alto si no se marca visiblemente como estimado — cotizaciones incorrectas con dinero real de por medio.
- **Recomendación arquitectónica:** Completar las tablas con la Dueña combinación por combinación — es información que solo ella tiene.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-COT-04` (Faltante → Aprobada), tablas de `04-data-model.md` §5.2.

**→ Resultado reunión con la Dueña (2026-08-03):** 🟡 **B — Parcialmente respondida.**
- **Respuesta registrada:** tabla extensa con docenas de combinaciones de duración antes faltantes, más una regla nueva: *"retiro de gel con drill se agregan 15 minutos al usar el drill."*
- **Qué queda resuelto:** la gran mayoría de las combinaciones que antes no tenían dato — avance muy grande frente al estado anterior.
- **Qué sigue sin resolver:** (1) la regla "drill = +15 min" debe reconciliarse con los valores fijos ya recibidos previamente para combinaciones con drill — no está claro si esto reemplaza esos valores absolutos o es un delta aplicado sobre ellos; (2) varias celdas de la tabla recibida (ej. "Diseño Especial", "SP", "CF", "CC") quedaron sin valor numérico o con valor cualitativo ("dentro de la hora dependiendo del diseño").
- **¿Se cierra oficialmente?** No completo — se cierra la mayoría de las combinaciones, se mantiene abierto el punto de reconciliación drill y las celdas faltantes.
- **Riesgo de asumir sin resolver ese resto:** Alto si se despliega sin marcar visiblemente las celdas faltantes como estimadas — hay dinero real de por medio (ya lo advertía la recomendación original).

#### 1.10 — Quién decide el método de retiro (`PA-03`)
- **Pregunta exacta:** ¿El método de retiro (drill o acetona) lo decide la manicurista, la clienta, o depende del producto a retirar?
- **Por qué existe:** `RN-COT-05`.
- **Documentos que dependen:** `docs/business-rules/02-duracion-cotizacion.md`, `decision-flows-catalogo-diseno.md` (`FL-COT-02`, hueco recién agregado en la verificación de trazabilidad).
- **Módulos que dependen:** Catálogo y Cotización, Conversación (la IA necesita saberlo para cotizar sin preguntar siempre).
- **Fases que bloquea:** Fase 1 (motor de duración), Fase 4 (la IA no puede cotizar de forma autónoma sin esto).
- **Criticidad:** Alta.
- **¿Valor provisional aceptable?** Sí — "la IA siempre pregunta el método" como fallback conservador si no hay respuesta.
- **Riesgo de asumir:** Medio — asumir un método fijo por defecto podría cotizar mal si el producto real requiere otro método.
- **Recomendación arquitectónica:** Que dependa del producto a retirar (regla determinista) en vez de dejarlo a discreción humana en cada caso — más consistente con el objetivo de eliminar errores de cálculo manual.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-COT-05`.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"La clienta lo decide cuando agenda... Solo se pregunta sobre el drill cuando es retiro de gel, ya que nada más el gel se puede retirar con drill."*
- **Cierre oficial:** Sí — coincide con la recomendación (regla determinista ligada al producto: solo el gel admite drill).
- **Hallazgo adicional:** revela una excepción operativa nueva: *"si alguien pide puro retiro de gel, que se agende manualmente"* — las solicitudes de retiro-de-gel-puro no deben pasar por el flujo automático estándar. Candidata a excepción documentada en la siguiente pasada sobre `RN-COT-05`/Decision Flows.

#### 1.11 — Precios/duraciones: ¿globales o por sucursal? (`PA-04`)
- **Pregunta exacta:** ¿El precio y la duración de un servicio son los mismos en las 3 (4) sucursales, o pueden variar entre ellas?
- **Por qué existe:** `RN-COT-06`, `RN-COT-08` (modelada preventivamente en `04-data-model.md` §5.2, sin confirmar si se usa).
- **Documentos que dependen:** `docs/business-rules/02-duracion-cotizacion.md`, `04-data-model.md` §5.2 (`servicio_sucursal_override`).
- **Módulos que dependen:** Catálogo y Cotización.
- **Fases que bloquea:** No bloquea Fase 1 (la tabla ya existe modelada preventivamente, sin activarse) — solo determina si se usa o queda vacía.
- **Criticidad:** Media.
- **¿Valor provisional aceptable?** Sí — se puede lanzar con catálogo global y activar el override si la respuesta lo confirma, sin rediseño.
- **Riesgo de asumir:** Bajo — el costo de haber modelado la tabla sin usarla es mínimo.
- **Recomendación arquitectónica:** Ninguna con fuerza particular — es genuinamente una decisión de negocio sin sesgo arquitectónico.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-COT-06`/`RN-COT-08`.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"Sí es lo mismo."*
- **Cierre oficial:** Sí — confirma catálogo global, sin variación por sucursal. Cierra también el uso de `RN-COT-08`: la tabla de override queda modelada pero confirmada como no necesaria (consistente con el plan de contingencia ya diseñado, sin costo de rediseño).

#### 1.12 — Vigencia de una cotización antes de confirmar (`PA-05`)
- **Pregunta exacta:** Si una clienta tarda en confirmar después de recibir una cotización, ¿por cuánto tiempo sigue siendo válida esa cotización antes de recalcularse?
- **Por qué existe:** `RN-COT-09`.
- **Documentos que dependen:** `docs/business-rules/02-duracion-cotizacion.md`, `decision-flows-catalogo-diseno.md` (`FL-COT-03`, `FL-AGE-08`).
- **Módulos que dependen:** Catálogo y Cotización, Agenda.
- **Fases que bloquea:** Fase 2 (`FL-AGE-01`, hoy ~80% de completitud, este es uno de los huecos).
- **Criticidad:** Media.
- **¿Valor provisional aceptable?** Sí — revalidar siempre contra el catálogo vigente al confirmar (sin ventana de gracia) es un default seguro.
- **Riesgo de asumir:** Bajo si se opta por "siempre revalidar" — el riesgo solo aparece si se asume una ventana de vigencia sin confirmarla.
- **Recomendación arquitectónica:** Revalidar siempre contra el catálogo vigente al momento de confirmar, sin ventana de vigencia — es la opción más simple y más segura ante disputas de precio.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-COT-09`.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"Sigue vigente siempre y cuando no agregue o retire algo, los precios se mantienen siempre."*
- **Cierre oficial:** Sí — responde con un mecanismo más simple que el recomendado: la cotización no expira por tiempo, solo se invalida si cambia la composición del servicio (no por cambios posteriores del catálogo general).

### Categoría: Anticipos

#### 1.13 — Ventana de gracia del anticipo (`PA-06`)
- **Pregunta exacta:** Si se solicita un anticipo y la clienta no paga, ¿cuánto tiempo se retiene el horario antes de liberarlo automáticamente?
- **Por qué existe:** `RN-ANT-03`, Domain Discovery Pregunta Abierta #4.
- **Documentos que dependen:** `docs/business-rules/03-anticipos.md`, `04-data-model.md` §5.6 (`solicitudes_anticipo.expira_en`).
- **Módulos que dependen:** Anticipos, Agenda.
- **Fases que bloquea:** Fase 3 (Anticipos, hoy ~87% de completitud).
- **Criticidad:** Alta.
- **¿Valor provisional aceptable?** Sí — un valor conservador (ej. 2 horas) documentado como provisional.
- **Riesgo de asumir:** Medio — muy corto genera fricción, muy largo bloquea el horario innecesariamente para otras clientas.
- **Recomendación arquitectónica:** Ventana corta (1-2h), consistente con que la retención de horario compite con otras clientas reales.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-ANT-03`.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"Hasta que se dé el anticipo se agenda, si no el espacio sigue libre. Se pide que el bot saque la cotización y se pide el 40% del servicio como anticipo."*
- **Cierre oficial:** Sí — responde la pregunta de fondo con un mecanismo más simple que el asumido: no existe una retención temporal real; el cupo nunca se bloquea hasta que el pago se confirma (no hay "ventana de gracia" que expire, porque nunca hubo un hold). El escenario de dos personas decidiendo pagar al mismo tiempo queda cubierto por el invariante de exclusión ya existente (`RN-AGE-01`), sin necesitar mecanismo nuevo.
- **Hallazgo adicional (dato crítico nuevo):** el monto del anticipo queda definido por primera vez: **40% del valor del servicio**. Este dato no existía en ningún documento previo.

#### 1.14 — Criterio de reembolso "justificado" (`PA-07`)
- **Pregunta exacta:** ¿Qué hace que una cancelación se considere "justificada" para ameritar el reembolso de un anticipo ya pagado?
- **Por qué existe:** `RN-ANT-04` — inferida solo de un dato del mockup, sin ninguna regla documentada detrás.
- **Documentos que dependen:** `docs/business-rules/03-anticipos.md`.
- **Módulos que dependen:** Anticipos.
- **Fases que bloquea:** Fase 2 (`FL-AGE-04`, Cancelar Cita, donde el reembolso vive en línea).
- **Criticidad:** Media-Alta (dinero real de por medio).
- **¿Valor provisional aceptable?** Sí — "todo reembolso requiere aprobación manual de un empleado, sin criterio automático" como default seguro (consistente con el patrón ya usado en Garantías).
- **Riesgo de asumir:** Alto si se automatiza sin criterio confirmado — riesgo financiero directo.
- **Recomendación arquitectónica:** Nunca automatizar el reembolso sin revisión humana, mismo principio ya aplicado a Garantías (`RN-GAR-03`).
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-ANT-04` (Asumida → Aprobada).

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"No hay devolución de anticipos. Si alguien no llega a su cita habiendo pagado anticipo, ya no se devuelve, y si quiere volver a agendar después igual se le vuelve a pedir anticipo aunque ya haya pagado una vez. Solo pueden reagendar con 48 horas de anticipación cuando ya está pagado el anticipo, levantando una alerta para confirmar el reagendamiento."*
- **Cierre oficial:** Sí — respuesta más simple y tajante que lo que el documento anticipaba: no existe ningún criterio de "justificación", nunca hay reembolso.
- **Hallazgo adicional:** introduce una ventana de **48 horas** para reagendar citas CON anticipo pagado (con alerta de confirmación) — distinta de la regla general de 59-60 minutos de 1.6/1.7, que aplica quizá a citas sin anticipo. Ambas reglas deben coexistir sin contradecirse en la siguiente pasada sobre `RN-ANT-04`.

### Categoría: Garantías

#### 1.15 — Beneficio exacto de una garantía válida (`PA-08`)
- **Pregunta exacta:** Cuando una garantía es válida, ¿qué recibe la clienta — reposición gratuita del servicio, descuento, otro beneficio?
- **Por qué existe:** `RN-GAR-04`, Sesión 02 de Domain Discovery.
- **Documentos que dependen:** `docs/business-rules/04-garantias.md`.
- **Módulos que dependen:** Garantías.
- **Fases que bloquea:** Fase 5 (Garantías, hoy ~70% de completitud).
- **Criticidad:** Alta.
- **¿Valor provisional aceptable?** No de forma segura — el beneficio afecta directamente el resultado que se comunica a la clienta.
- **Riesgo de asumir:** Alto — un beneficio incorrecto comunicado automáticamente genera una expectativa que el negocio no pactó.
- **Recomendación arquitectónica:** Ninguna con sesgo particular — es una decisión de política comercial pura.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-GAR-04`.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"La garantía la va a manejar manualmente la dueña y la persona que interactúe con la plataforma."*
- **Cierre oficial:** Sí — se interpreta como una decisión de negocio válida: no habrá un beneficio fijo automatizado, es 100% discrecional caso por caso, consistente con `RN-GAR-03` (nunca aprobación automática). Misma respuesta consolidada para 1.15/1.16/1.17.

#### 1.16 — Coincidencia parcial en garantías (`PA-09`)
- **Pregunta exacta:** Si el problema reportado no corresponde exactamente al servicio realizado (ej. se cayó una uña con diseño, pero la cita registrada fue solo un retiro), ¿qué tratamiento recibe?
- **Por qué existe:** `RN-GAR-05`.
- **Documentos que dependen:** `docs/business-rules/04-garantias.md`.
- **Módulos que dependen:** Garantías.
- **Fases que bloquea:** Fase 5.
- **Criticidad:** Media.
- **¿Valor provisional aceptable?** Sí — enviar siempre a revisión humana con la discrepancia marcada explícitamente (ya es el comportamiento por defecto de `RN-GAR-03`).
- **Riesgo de asumir:** Bajo, dado que `RN-GAR-03` ya garantiza revisión humana siempre.
- **Recomendación arquitectónica:** Ninguna acción adicional urgente — el comportamiento por defecto ya es seguro.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-GAR-05`.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** misma respuesta que 1.15 — *"la garantía la va a manejar manualmente la dueña y la persona que interactúe con la plataforma."*
- **Cierre oficial:** Sí — confirma el comportamiento por defecto ya seguro de `RN-GAR-03` (siempre revisión humana), sin necesidad de una regla de coincidencia parcial automatizada.

#### 1.17 — ¿La política de garantía varía por sucursal? (`PA-10`)
- **Pregunta exacta:** ¿La ventana de 7 días y el criterio de aprobación de garantías son iguales en las 3 (4) sucursales, o pueden variar?
- **Por qué existe:** `RN-GAR-06`.
- **Documentos que dependen:** `docs/business-rules/04-garantias.md`.
- **Módulos que dependen:** Garantías.
- **Fases que bloquea:** Fase 5.
- **Criticidad:** Baja-Media.
- **¿Valor provisional aceptable?** Sí — política única global mientras no se confirme lo contrario.
- **Riesgo de asumir:** Bajo.
- **Recomendación arquitectónica:** Política global única, salvo evidencia de negocio en contra.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-GAR-06`.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** misma respuesta que 1.15/1.16 — gestión manual y discrecional.
- **Cierre oficial:** Sí — se interpreta que no hay variación formal por sucursal, dado que todo el módulo se trata como discrecional caso por caso (política global de facto).

### Categoría: CRM / Clientas

#### 1.18 — Umbral exacto para sugerir lista roja (`PA-11`)
- **Pregunta exacta:** ¿Cuántas cancelaciones, en qué ventana de tiempo, activan la sugerencia automática de marcar a una clienta en lista roja?
- **Por qué existe:** `RN-CRM-06`, Domain Discovery Pregunta Abierta #3.
- **Documentos que dependen:** `docs/business-rules/05-crm-clientas.md`.
- **Módulos que dependen:** CRM/Clientas.
- **Fases que bloquea:** Fase 3 (`FL-CRM-02`, hoy ~40% de completitud — el más bajo del catálogo).
- **Criticidad:** Alta.
- **¿Valor provisional aceptable?** Sí — un umbral conservador (ej. 2-3 cancelaciones en 30 días) documentado como provisional.
- **Riesgo de asumir:** Medio — un umbral mal calibrado genera fricción o no protege al negocio a tiempo.
- **Recomendación arquitectónica:** El sistema solo sugiere, nunca asigna automáticamente (`RN-CRM-05` ya lo garantiza) — el riesgo de un umbral provisional mal calibrado es bajo porque siempre hay un empleado decidiendo.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-CRM-06`.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"Queremos que el programa dé la sugerencia y la dueña la tiene que aceptar. Se da la sugerencia en cancelaciones a menos de una hora, o petición de reagendar a menos de una hora. Y también cuando no se aparezca la persona (no show) se da la sugerencia."*
- **Cierre oficial:** Sí — responde la pregunta, pero con un modelo distinto al asumido: no es un **umbral acumulado** (ej. "N cancelaciones en X días"), es un **disparador por incidente individual** (cualquier cancelación/reagendo <1h, o cualquier no-show). Coherente con la "regla de 59-60 minutos" ya vista en 1.6/1.7 — tres respuestas independientes confirmando el mismo patrón. Cambia la forma de `RN-CRM-06` (de umbral acumulado a disparador por evento), no su cierre.

#### 1.19 — Tratamiento de citas ya confirmadas al marcar lista roja (`PA-12`)
- **Pregunta exacta:** Si una clienta ya tiene una cita confirmada sin anticipo pagado y en ese momento se le marca lista roja, ¿esa cita queda exenta de la nueva política, o se le exige anticipo retroactivamente?
- **Por qué existe:** `RN-CRM-07`; también identificado como escenario de ruptura DM-F en `DOMAIN_MODEL_REVIEW.md`.
- **Documentos que dependen:** `docs/business-rules/05-crm-clientas.md`, `decision-flows-catalogo-diseno.md` (`FL-CRM-02`).
- **Módulos que dependen:** CRM/Clientas, Agenda.
- **Fases que bloquea:** Fase 3.
- **Criticidad:** Alta.
- **¿Valor provisional aceptable?** Sí — "no aplica retroactivamente" (la cita ya confirmada conserva su condición) como default seguro y consistente con la inmutabilidad de snapshot ya adoptada en otras partes del diseño.
- **Riesgo de asumir:** Bajo si se documenta explícitamente, para que no sea un accidente de implementación.
- **Recomendación arquitectónica:** No retroactivo — consistente con el principio ya usado para el snapshot de cotización (`RN-AGE-08`).
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-CRM-07`.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"Si ya tenía una cita hecha no es lista roja, pero si es para volver a agendar, o algo después de eso, se da sugerencia y se pide anticipo."*
- **Cierre oficial:** Sí — coincide exactamente con la recomendación (no aplica retroactivamente; solo afecta futuras solicitudes).

#### 1.20 — Gobernanza de etiquetas de cliente (`PA-13`)
- **Pregunta exacta:** ¿Las etiquetas son de texto completamente libre, o deberían venir de un catálogo cerrado? ¿Su alcance es global o por sucursal? ¿Alguna etiqueta requiere un permiso especial para asignarse?
- **Por qué existe:** `RN-CRM-09`, Sesión 02 de Domain Discovery.
- **Documentos que dependen:** `docs/business-rules/05-crm-clientas.md`.
- **Módulos que dependen:** CRM/Clientas.
- **Fases que bloquea:** Fase 3 (`FL-CRM-04`, hoy ~67%).
- **Criticidad:** Media.
- **¿Valor provisional aceptable?** Sí — texto libre, alcance global, sin restricción de permiso, como ya opera el mockup.
- **Riesgo de asumir:** Bajo.
- **Recomendación arquitectónica:** Mantener texto libre — es lo que ya está construido y validado en el mockup sin objeción previa.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-CRM-09`.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"No se usa el tema de etiquetas por cliente... lo que quiero es que me des la opción de crear etiquetas en caso de que la dueña las quiera usar. No requieren permiso especial, el alcance sería global."*
- **Cierre oficial:** Sí — coincide exactamente con la recomendación (texto libre, alcance global, sin permiso especial). Aclara que hoy no se usan etiquetas operativamente — es una capacidad "por si acaso", no prioritaria.

### Categoría: Conversación e IA

#### 1.21 — Umbral exacto de "cliente molesto" (`PA-14`)
- **Pregunta exacta:** Además del sentimiento detectado por la IA, ¿qué palabras clave específicas deberían activar por sí solas la detección de "cliente molesto"?
- **Por qué existe:** `RN-CONV-08`, Domain Discovery Pregunta Abierta #8.
- **Documentos que dependen:** `docs/business-rules/06-conversacion-ia.md`.
- **Módulos que dependen:** Conversación e IA, Escalamiento.
- **Fases que bloquea:** Fase 4 (`FL-CONV-03`).
- **Criticidad:** Alta.
- **¿Valor provisional aceptable?** Sí — un umbral de sentimiento conservador + lista base de palabras clave genéricas, ajustable con datos reales del golden set.
- **Riesgo de asumir:** Medio — un umbral mal calibrado genera falsos positivos (escalamiento innecesario) o falsos negativos (clienta molesta sin atención).
- **Recomendación arquitectónica:** Empezar conservador (umbral bajo, prefiere escalar de más) y calibrar con datos reales — consistente con el principio de "nunca cometer errores humanos simulados".
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-CONV-08`.

**→ Resultado reunión con la Dueña (2026-08-03):** 🔴 **C — Sigue sin respuesta.**
- **Respuesta registrada:** *"Estas se definen después, sin definir."*
- **¿Se cierra oficialmente?** No — permanece abierta; la Dueña la aplazó explícitamente.
- **¿Convertir en supuesto provisional?** Sí — se mantiene vigente el valor ya recomendado (umbral de sentimiento conservador + lista base de palabras clave genéricas), ajustable con datos reales del golden set.
- **Riesgo de asumir sin resolver:** Medio — igual que en la evaluación original, un umbral mal calibrado genera falsos positivos o negativos, pero al ser ajustable no bloquea el desarrollo.

#### 1.22 — Cierre y reapertura de conversación (`PA-15`)
- **Pregunta exacta:** ¿Qué evento o ventana de inactividad cierra una conversación? Si la clienta escribe después de que se cerró, ¿se reabre la misma conversación (conservando memoria) o se crea una nueva?
- **Por qué existe:** `RN-CONV-10`, Domain Discovery Pregunta Abierta #16.
- **Documentos que dependen:** `01-domain-discovery.md` §5.3 (máquina de estados de `Conversación`).
- **Módulos que dependen:** Conversación e IA.
- **Fases que bloquea:** Fase 4 — es, además, parte del mismo entregable ya identificado como necesario para prevenir el peor escenario de negocio (DM-C: clienta sin respuesta de nadie).
- **Criticidad:** Crítica.
- **¿Valor provisional aceptable?** No sin cuidado — la revisión adversarial ya encontró que, sin resolver esto explícitamente, una conversación puede quedar en `modo = humano` de forma silenciosa incluso después de reabrirse.
- **Riesgo de asumir:** Alto — es la ruta directa hacia el peor escenario de negocio ya identificado en `DOMAIN_MODEL_REVIEW.md`.
- **Recomendación arquitectónica:** Reabrir la misma conversación (preservando `MemoriaDeConversacion`, requisito explícito del cliente), con `modo` reseteado a `bot` en el momento de la reapertura, no del cierre.
- **Quién responde:** Dueña (el disparador exacto de cierre, ej. horas de inactividad) + Arquitectura (la mecánica de `modo`).
- **Documento a modificar:** `01-domain-discovery.md` (adenda formal, máquina de estados de `Conversación`).

**→ Resultado reunión con la Dueña (2026-08-03):** 🟡 **B — Parcialmente respondida.**
- **Respuesta registrada:** *"Se mantienen las conversaciones con las personas. Cada conversación se va a tomar como un cliente, entonces en esa conversación se busca que se agenden las citas de esa persona o de acompañantes... solo se toma el contexto de la cita que se agende, no de las citas pasadas en esa misma conversación. Si hay dudas quiero que me las preguntes."*
- **Qué queda resuelto:** el modelo de identidad de conversación — es persistente por clienta, no tiene un ciclo clásico de cierre/reapertura — y el alcance de memoria contextual para la IA (limitado a la cita que se está gestionando, no al historial completo).
- **Qué sigue sin resolver:** el mecanismo exacto de reseteo de `modo` (bot/humano) tras un período de inactividad — el punto específico que la revisión adversarial identificó como la ruta directa hacia el peor escenario de negocio (DM-C: clienta sin respuesta de nadie) sigue sin abordarse.
- **¿Se cierra oficialmente?** No — sigue Crítica y forma parte del entregable activo de Fase 0 (diseño formal de la máquina de estados de `Conversación`). La propia Dueña invitó explícitamente a repreguntar ("si hay dudas quiero que me las preguntes"): se recomienda una pregunta puntual en la siguiente reunión — *"¿qué debe pasar con el modo humano/bot si pasó mucho tiempo de inactividad: el bot retoma el control solo, o siempre requiere que un empleado lo libere explícitamente?"*
- **Riesgo de asumir sin ese punto:** Alto — es la ruta directa hacia el peor escenario de negocio ya identificado en `DOMAIN_MODEL_REVIEW.md`.

#### 1.23 — Confirmación automática: ¿push o requiere respuesta? (`PA-16`)
- **Pregunta exacta:** Cuando el sistema confirma una cita automáticamente, ¿es un mensaje informativo de una sola vía, o la clienta debe responder para que la cita se considere realmente confirmada?
- **Por qué existe:** `RN-CONV-11`, Domain Discovery Pregunta Abierta #17.
- **Documentos que dependen:** `RN-NOT-01`, `04-data-model.md` §5.8 (frontera del aggregate `Notificacion`).
- **Módulos que dependen:** Notificaciones, Agenda.
- **Fases que bloquea:** Fase 4 (Notificaciones) — también condiciona el cierre de la frontera del aggregate `Notificacion` (uno de los 9 pendientes de `ARCHITECTURE_CLOSURE_PLAN.md`).
- **Criticidad:** Alta.
- **¿Valor provisional aceptable?** Sí — push unidireccional (sin requerir respuesta) como default, consistente con lo que ya está en `functional-scope.md` y el mockup.
- **Riesgo de asumir:** Medio — si la respuesta real es "requiere respuesta", `Cita` necesitaría un estado intermedio nuevo no contemplado hoy.
- **Recomendación arquitectónica:** Push unidireccional — es lo que ya está implementado en el mockup sin objeción, y no introduce un estado nuevo en `Cita`.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-CONV-11`, `04-data-model.md` §5.8.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"El cliente elige un horario de los que se propuso. Tiene que ser una respuesta afirmativa... nunca asumas nada, y si es necesario pide confirmación."*
- **Cierre oficial:** Sí — respuesta clara, pero **contraria** a la recomendación arquitectónica original (push unidireccional): la confirmación es **interactiva**, requiere respuesta afirmativa explícita.
- **Hallazgo importante (impacto en diseño activo):** esto requiere un **estado intermedio nuevo** en la máquina de estados de `Cita` (ej. "propuesta"/"pendiente de confirmación") que el modelo de datos actual no contempla. Impacto directo en el diseño de la máquina de estados de `Cita` (Fase 0, en curso) y en `04-data-model.md` §5.8 — debe incorporarse en la siguiente pasada de diseño formal.

### Categoría: Sucursales y Configuración

#### 1.24 — Comportamiento hacia la clienta en modo mantenimiento (`PA-17`)
- **Pregunta exacta:** Cuando el modo mantenimiento está activo, ¿qué recibe una clienta que escribe — silencio total, o un mensaje automático avisando que el equipo responderá manualmente?
- **Por qué existe:** `RN-SUC-03`, `functional-scope.md` §3.8.
- **Documentos que dependen:** `docs/business-rules/09-sucursales-configuracion.md`.
- **Módulos que dependen:** Sucursales y Personal, Conversación.
- **Fases que bloquea:** Fase 1 (`FL-SUC-02`, hoy ~80%).
- **Criticidad:** Media.
- **¿Valor provisional aceptable?** Sí — mensaje automático de aviso (evita el silencio total, que ya se identificó como riesgo en `ADR-012`).
- **Riesgo de asumir:** Bajo si se opta por avisar; alto si se deja en silencio sin confirmar.
- **Recomendación arquitectónica:** Mensaje automático de aviso — `ADR-012` ya advierte explícitamente contra el silencio total.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-SUC-03`.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"Nada, el modo mantenimiento es se maneja todo manual."*
- **Cierre oficial:** Sí, con una interpretación explícita: sin mensaje automático del bot, pero **atendida manualmente por el personal** — no es silencio absoluto hacia la clienta (evita el riesgo que `ADR-012` señalaba). La redacción es algo ambigua; se recomienda una confirmación literal de esta lectura en la próxima reunión si hay oportunidad, pero no bloquea avanzar con esta interpretación.

#### 1.25 — Confirmación de un calendario de Google por sucursal (`PA-18`)
- **Pregunta exacta:** ¿Cada sucursal corresponde efectivamente a un único calendario de Google, diferenciado por color, tal como se asumió?
- **Por qué existe:** `RN-SUC-04`, `RN-AGE-09`, Domain Discovery Pregunta Abierta #14.
- **Documentos que dependen:** `04-data-model.md` §5.9.
- **Módulos que dependen:** Sincronización de Calendario.
- **Fases que bloquea:** Fase 4.
- **Criticidad:** Media.
- **¿Valor provisional aceptable?** Sí — es el supuesto ya usado en todo el diseño.
- **Riesgo de asumir:** Bajo — es un dato de configuración, fácil de ajustar si resulta distinto.
- **Recomendación arquitectónica:** Confirmar el supuesto ya adoptado.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-SUC-04`.

**→ Resultado reunión con la Dueña (2026-08-03):** 🟡 **B — Parcialmente respondida.**
- **Respuesta registrada:** *"Se diferencia por colores para mostrar las diferentes sucursales."*
- **Qué queda resuelto:** existe diferenciación visual por color entre sucursales.
- **Qué sigue sin resolver:** no queda claro si el modelo técnico real es **un calendario de Google independiente por sucursal** (cada uno con su color, el supuesto ya adoptado en `RN-SUC-04`/`04-data-model.md` §5.9) o **un único calendario compartido** con eventos coloreados internamente por sucursal — son dos modelos técnicos distintos con impacto directo en el diseño de sincronización.
- **¿Se cierra oficialmente?** No — requiere una repregunta puntual y directa: *"¿Cada sucursal tiene su propio calendario de Google, o todas comparten un mismo calendario y el color solo las distingue visualmente dentro de él?"*
- **Riesgo de asumir sin ese punto:** Medio — si el modelo real es "un solo calendario", el esquema de sincronización uno-a-uno por sucursal debe rediseñarse antes de Fase 4.

### Categoría: Identidad y Seguridad

#### 1.26 — Alcance de sucursales para Analista y Solo lectura (`PA-19`)
- **Pregunta exacta:** ¿Los roles Analista y Solo lectura ven la información de todas las sucursales, o solo las que se les asignen explícitamente?
- **Por qué existe:** `RN-SEG-03`, Domain Discovery Pregunta Abierta #11 — ya señalada como la de mayor impacto estructural del proyecto (`DESIGN-PHASE-HANDOFF.md` §10).
- **Documentos que dependen:** `04-data-model.md` §5.10 (`usuarios_sucursales`), futuro `05-api-design.md` (claims de token).
- **Módulos que dependen:** Identidad y Accesos.
- **Fases que bloquea:** El modelo de permisos **completo** de Fase 1 — no bloquea empezar a escribir el módulo (el mecanismo ya soporta ambas respuestas sin rediseño, según ya se validó en la revisión adversarial de Fase 1).
- **Criticidad:** Crítica.
- **¿Valor provisional aceptable?** Sí, con salvedad: se puede desplegar con un valor por defecto documentado como provisional (mismo patrón que RPO/RTO), pero `ARCHITECTURE_REVIEW.md` (F-12) exige que quede marcado explícitamente como no confirmado, no asumido en silencio.
- **Riesgo de asumir:** Alto si se asume sin marcar — un modelo de permisos mal calibrado puede sobre-exponer o sub-exponer datos entre sucursales.
- **Recomendación arquitectónica:** Alcance por sucursal asignada (no global) como default más conservador, consistente con "privilegio mínimo por diseño" (`02-architecture-principles.md` §12.1).
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-SEG-03` (Faltante → Aprobada).

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"Todas las sucursales."*
- **Cierre oficial:** Sí — confirma alcance **global** (contrario a la recomendación conservadora original de alcance por sucursal, pero es una respuesta clara e inequívoca). Resuelve `PA-19`, ya señalada como la pregunta de mayor impacto estructural del proyecto, y con ella el **Pendiente P2 de `ARCHITECTURE_CLOSURE_PLAN.md`** (fuera de alcance de esta actualización aplicar el cambio ahí, pero queda registrado el hecho).

### Categoría: Auditoría y Cumplimiento

#### 1.27 — Marco regulatorio de protección de datos personales (`PA-20`)
- **Pregunta exacta:** ¿Existe alguna obligación legal (ej. LFPDPPP en México) que aplique al manejo de fotos, teléfonos y hábitos de consumo de las clientas?
- **Por qué existe:** `RN-AUD-02`, Domain Discovery Pregunta Abierta #12 — bloquea la definición exacta de plazos de retención.
- **Documentos que dependen:** `ADR-017`, `ADR-022`, `04-data-model.md` §8.
- **Módulos que dependen:** Conversación (imágenes), Auditoría, todos los que retienen datos personales.
- **Fases que bloquea:** No bloquea el inicio de ningún módulo (ya hay postura conservadora adoptada) — bloquea cerrar los plazos exactos de retención antes de operar con clientas reales.
- **Criticidad:** Alta, pero no urgente para empezar a construir.
- **¿Valor provisional aceptable?** Sí — postura conservadora de minimización ya adoptada en `ADR-017`/`ADR-022`.
- **Riesgo de asumir:** Medio — si el marco real exige algo más estricto de lo asumido, hay que migrar a un modelo más conservador después (costo real pero acotado).
- **Recomendación arquitectónica:** Consultar a un abogado especializado en protección de datos antes de operar con clientas reales — no es una decisión que la Dueña deba responder sola.
- **Quién responde:** **Abogado** (con validación final de la Dueña).
- **Documento a modificar:** `RN-AUD-02`, `04-data-model.md` §8 (plazos exactos).

**→ Resultado reunión con la Dueña (2026-08-03):** 🟡 **B — Parcialmente respondida.**
- **Respuesta registrada:** *"No por el momento."*
- **Qué queda resuelto:** postura informal de la Dueña — a su conocimiento, no hay una obligación legal aplicable hoy. Es suficiente para seguir construyendo con la postura conservadora ya adoptada (`ADR-017`/`ADR-022`).
- **Qué sigue sin resolver:** es una apreciación de la propia Dueña, no una validación jurídica formal — el documento original ya señalaba explícitamente que esta no es una decisión que ella deba responder sola.
- **¿Se cierra oficialmente?** No en términos legal-formales — se mantiene la recomendación de consultar a un abogado antes de operar con clientas reales (Fase 7).
- **Riesgo de asumir sin validación formal:** Medio — si el marco real exige algo más estricto de lo asumido, migrar después tiene costo real pero acotado.

### Categoría: Notificaciones

#### 1.28 — Vigencia de la cortesía en el recordatorio (`PA-24`)
- **Pregunta exacta:** El contenido de cortesía en el recordatorio (ej. "exfoliante y café gratis") — ¿es permanente, o una promoción con vigencia limitada que debe poder cambiarse?
- **Por qué existe:** `RN-NOT-04`, Sesión 02 de Domain Discovery.
- **Documentos que dependen:** `docs/business-rules/08-notificaciones.md`.
- **Módulos que dependen:** Notificaciones.
- **Fases que bloquea:** Fase 4 (`FL-NOT-02`, hoy ~75%). También afecta una decisión técnica: si es editable frecuentemente, no debe fijarse en la plantilla de WhatsApp aprobada por Meta (`ADR-008`), debe ser configurable sin republicar plantilla.
- **Criticidad:** Media.
- **¿Valor provisional aceptable?** Sí — tratarlo como editable/temporal por defecto (más flexible, ajustable a permanente si la respuesta lo confirma).
- **Riesgo de asumir:** Bajo.
- **Recomendación arquitectónica:** Configurable (no fijo en la plantilla de Meta), dado que ya se sabe que el negocio quiere poder cambiar promociones.
- **Quién responde:** Dueña.
- **Documento a modificar:** `RN-NOT-04`.

**→ Resultado reunión con la Dueña (2026-08-03):** ✅ **A — Resuelta completamente.**
- **Respuesta registrada:** *"Es permanente, hasta que se especifique lo contrario."*
- **Cierre oficial:** Sí — coincide con la recomendación (permanente por defecto, configurable si cambia).

### Categoría: Transversal / Decisiones ejecutivas de negocio

#### 1.29 — Sign-off formal de ADR-008 (WhatsApp oficial vs. Evolution API)
- **Pregunta exacta:** ¿Apruebas usar la API oficial de WhatsApp Business Platform (con costo de mensajería y tiempo de aprovisionamiento) en lugar de Evolution API (más rápida y barata de arrancar, pero con riesgo real de bloqueo del número sin aviso)?
- **Por qué existe:** `ADR-008` se aparta explícitamente del stack de referencia que la Dueña propuso originalmente; `CLAUDE.md` ya lo señala como "open deviation awaiting explicit client sign-off".
- **Documentos que dependen:** `ADR-008`, `ADR_INDEX.md`.
- **Módulos que dependen:** Conversación e IA (integración de WhatsApp).
- **Fases que bloquea:** Fase 4 — y el trámite de verificación de negocio ante Meta, que debe iniciarse en Fase 0/1, no puede empezar sin esta aprobación.
- **Criticidad:** Crítica.
- **¿Valor provisional aceptable?** No — es una decisión ejecutiva de riesgo de negocio, no un parámetro técnico.
- **Riesgo de asumir:** Muy alto — construir sobre Evolution API sin decisión consciente expone el único canal de agendamiento de cada sucursal a un bloqueo sin aviso ni vía de apelación garantizada.
- **Recomendación arquitectónica:** Aprobar la API oficial — es la que elimina el riesgo de continuidad de negocio más severo identificado en todo el Domain Discovery.
- **Quién responde:** Dueña.
- **Documento a modificar:** `ADR-008` (`Status: Proposed → Accepted`).

**→ Resultado reunión con la Dueña (2026-08-03):** 🟡 **B — Parcialmente respondida.**
- **Respuesta registrada:** *"Para este tema lo que queremos en temas de desarrollo es que exista la posibilidad de usar las dos, no quiero que sea simultáneo, sino que en la configuración decidamos si vamos a ir con API oficial de WhatsApp o con Evolution API."*
- **Qué queda resuelto:** hay una decisión real, no es una no-respuesta — cambia el alcance de la pregunta original.
- **Qué sigue sin resolver:** no es el sign-off binario que `ADR-008` pedía (aceptar oficial, rechazar Evolution). En su lugar, se requiere construir **dos adaptadores de WhatsApp** (oficial + Evolution) intercambiables por configuración. `ADR-008` debe **reescribirse** para reflejar este nuevo alcance, no solo marcarse como `Accepted` con la recomendación original.
- **¿Se cierra oficialmente?** No en los términos originales — se cierra la indecisión, pero se abre una tarea de actualización arquitectónica de `ADR-008` (fuera de alcance de esta pasada, que solo toca `DISCOVERY_CHECKLIST.md`).
- **Nota positiva:** es compatible con `ADR-002` (Hexagonal) sin sobrecosto arquitectónico mayor — el patrón de puertos/adaptadores ya soporta esto de forma natural. El trámite de verificación de negocio ante Meta para la API oficial puede iniciarse desde ya en paralelo.
- **Riesgo de no reflejar el nuevo alcance:** Alto si se construye un solo adaptador fijo sin considerar el modelo dual — habría que rehacer el diseño de integración.

#### 1.30 — Capacidad real de recepción humana ante escalamiento masivo (F-05)
- **Pregunta exacta:** Si el proveedor de IA fallara y todas las conversaciones activas escalaran a humano al mismo tiempo, ¿tu personal de recepción (por sucursal) puede absorber ese volumen sin colapsar?
- **Por qué existe:** `ARCHITECTURE_REVIEW.md` (F-05, High) — nadie ha validado esto con un dato real.
- **Documentos que dependen:** `03-technical-architecture.md` §7.2, `ADR-016`.
- **Módulos que dependen:** Escalamiento Humano.
- **Fases que bloquea:** No bloquea construir — bloquea operar en producción con confianza.
- **Criticidad:** Alta, no urgente para desarrollo.
- **¿Valor provisional aceptable?** Sí para desarrollo, no para producción.
- **Riesgo de asumir:** Alto en producción real si nunca se valida.
- **Recomendación arquitectónica:** Diseñar una degradación priorizada (no "todo a humano" indiscriminado) — ya recomendado en `03` §6.5, pendiente de este dato para calibrarse.
- **Quién responde:** Dueña + operación de cada sucursal.
- **Documento a modificar:** Ninguno de arquitectura — es un dato de validación operativa, no una regla.

**→ Resultado reunión con la Dueña (2026-08-03):** 🟡 **B — Parcialmente respondida.**
- **Respuesta registrada:** *"Cuando haya fallas, notificar a la responsable en ese momento y que ella tome el control de la conversación... esto debe ser muy visible y que haya una idea de cuándo se haya resuelto el problema y por qué pasó, además queremos que se pueda volver a la normalidad en caso de requerirlo, con normalidad me refiero a que la IA vuelva a ser la encargada."*
- **Qué queda resuelto:** los requisitos funcionales/UX del mecanismo de degradación (notificar al responsable, visibilidad del estado y la causa, posibilidad de volver a modo IA).
- **Qué sigue sin resolver:** la pregunta original de **capacidad** (F-05) — si el personal puede absorber el volumen real de un escalamiento masivo simultáneo sin colapsar — sigue sin un dato de validación real.
- **¿Se cierra oficialmente?** No — se mantiene abierta la validación de capacidad, aunque ya no bloquea el diseño funcional del mecanismo de degradación (ese diseño ya puede avanzar con esta respuesta).
- **Riesgo de asumir sin validar:** Alto en producción real si nunca se valida con datos reales de volumen.

#### 1.31 — Presupuesto aceptable de mensajería de WhatsApp y límite de gasto de IA (F-18, F-07)
- **Pregunta exacta:** ¿Cuál es el presupuesto mensual aceptable para mensajería de WhatsApp (recordatorios y confirmaciones) y para el costo de IA? ¿Qué debe pasar si se alcanza ese límite?
- **Por qué existe:** `ARCHITECTURE_REVIEW.md` (F-07 High, F-18 Medium) — ningún documento fija un número.
- **Documentos que dependen:** `03-technical-architecture.md` §6.5, enmienda candidata a `ADR-007`/`ADR-011`.
- **Módulos que dependen:** Conversación e IA, Notificaciones.
- **Fases que bloquea:** No bloquea construir el mecanismo técnico (ya diseñado en `03` §6.5) — bloquea fijar el número real.
- **Criticidad:** Alta, no urgente para desarrollo.
- **¿Valor provisional aceptable?** Sí — un límite conservador inicial, ajustable con datos reales.
- **Riesgo de asumir:** Medio — sin límite real, el gasto no está verdaderamente acotado.
- **Recomendación arquitectónica:** Fijar un límite diario/por sucursal desde el lanzamiento, con degradación priorizada (no "apagar todo") al alcanzarlo.
- **Quién responde:** Dueña (o quien maneje el presupuesto — contador).
- **Documento a modificar:** Enmienda a `ADR-007`/`ADR-011`.

**→ Resultado reunión con la Dueña (2026-08-03):** 🔴 **C — Sigue sin respuesta.**
- **Respuesta registrada:** *"Por el momento no está decidido, se va a decidir después."*
- **¿Se cierra oficialmente?** No — permanece abierta; la Dueña la aplazó explícitamente.
- **¿Convertir en supuesto provisional?** Sí — el mecanismo técnico ya está diseñado (`03-technical-architecture.md` §6.5), solo falta fijar el número real; puede resolverse durante el desarrollo.
- **Riesgo de asumir sin resolver:** Medio — sin límite real, el gasto no está verdaderamente acotado en producción, pero no bloquea construir el mecanismo.

---

## 2. DECISIONES YA TOMADAS (NO VOLVER A PREGUNTAR)

Estas decisiones se consideran cerradas. No se reabren sin una contradicción objetiva y demostrable contra un documento ya aprobado:

- **Modular Monolith**, no microservicios (`ADR-001`).
- **Hexagonal + Clean Architecture + Vertical Slice Architecture** combinadas (`ADR-002`).
- **CQRS-lite** limitado a Analítica y disponibilidad de Agenda; **sin Event Sourcing** (`ADR-003`).
- **Domain Events en proceso + Transactional Outbox** para efectos externos críticos (`ADR-004`).
- **PostgreSQL única**, con separación lógica estricta por esquema, sin FKs cruzadas (`ADR-005`).
- **OpenAI vía Responses API**, exclusivamente para interpretación, nunca decisión (`ADR-007`).
- **Single-tenant en despliegue**, modelo Silo si aparece un segundo cliente (`ADR-009`).
- **RBAC en dos niveles + JWT corto + Refresh Token revocable + MFA para roles críticos + auditoría append-only** (`ADR-010`).
- **OpenTelemetry** como estándar de observabilidad vendor-neutral (`ADR-011`).
- **Tres entornos**: Development, Sandbox, Production — **no existe un cuarto entorno "QA"** (`ADR-012`).
- **Tres categorías de error** (dominio, integración externa, inesperado) + circuit breaker por dependencia (`ADR-013`).
- **Versionado de API por URI** desde el primer endpoint, contract-first (`ADR-014`).
- **Prompts de IA como artefacto versionado**, independiente del código, con sandbox y rollback obligatorios (`ADR-015`).
- **Human Handoff**: modo autoritativo revalidado antes de cada respuesta + escalamiento-de-escalamiento (`ADR-016`).
- **Object storage privado con URLs firmadas** para archivos (`ADR-017`).
- **Cola de background jobs durable, at-least-once, con handlers idempotentes** (`ADR-018`).
- **Pirámide de testing por capa + golden set conversacional** (`ADR-019`).
- **Feature flags acotados** a kill-switch y rollout gradual — nunca configuración de negocio (`ADR-020`).
- **Idempotencia de dos capas**: clave en punto de entrada + invariante de negocio como respaldo (`ADR-021`).
- **11 Bounded Contexts** (no 10 — corrección ya aplicada, `Notificaciones` incluido).
- **`SolicitudDeCambioDeHorario`** como aggregate independiente dentro de Agenda, sin Value Object de criterios adicionales, sin Saga, sin Process Manager — dos alternativas ya evaluadas y rechazadas explícitamente.
- **Las tres máquinas de estado (`Cita`, `Conversación`, `TicketEscalamiento`) fueron deliberadamente dejadas sin diseñar** durante Domain Discovery — esto no es una pregunta abierta, es una restricción de alcance ya cumplida y ahora en ejecución activa (Fase 0 del `IMPLEMENTATION_MASTER_PLAN.md`).
- **Las fronteras de aggregate ya evaluadas y confirmadas correctas** tras revisión adversarial explícita: `Conversacion`+`Mensaje` (DM-15), `TicketEscalamiento` como aggregate separado (DM-16), `SolicitudAnticipo` como aggregate separado (DM-17).
- **Business Rules Engine**: 73 reglas, 12 categorías, gobernanza activa — congelado.
- **Catálogo de Decision Flows**: 21 macro-flows + 15 micro-flows — congelado, con las correcciones ya identificadas (P5 de `ARCHITECTURE_CLOSURE_PLAN.md`) pendientes de aplicar, no de rediseñar.
- **Los tres renames diferidos** (`Clienta`→`Cliente`, `Manicurista`→`Profesional`, `ModificadorDeDiseño`→`Modificador de Servicio`) — explícitamente pospuestos hasta un segundo cliente real, no se aplican especulativamente.
- **`ComposicionPorUña` y el contenido de las 73 reglas permanecen específicos de Blanc** — no se generalizan.
- **Orden de implementación por fases** (`IMPLEMENTATION_MASTER_PLAN.md`) — no se reordena sin actualizar ese documento primero.

---

## 3. SUPUESTOS PROVISIONALES

Decisiones que ya operan con un valor de trabajo, explícitamente marcadas como sujetas a confirmación — no bloquean, pero deben revisarse antes de operar con datos/clientas reales:

| Supuesto | Valor provisional actual | Documento | Cuándo debe confirmarse |
|---|---|---|---|
| RPO / RTO de backup | ≤ 15 min / ≤ 4 h | `ADR-022` | Antes de operar en producción (Fase 7) |
| SLOs numéricos de observabilidad | Rezago de Outbox > 5 min, Analítica > 15 min, error de integración > 5%/5min, notificación de escalamiento > 2 min | `03-technical-architecture.md` §6.3 | Con datos reales de las primeras semanas de producción |
| Google Calendar como fuente de verdad de la plataforma | La plataforma decide, Google Calendar es vista de solo lectura | `ADR-006` | ✅ **Confirmado 2026-08-03** (ver 1.1) — pendiente solo trasladar a `ADR-006` (`Status → Accepted`) en la siguiente pasada |
| Identidad global de clienta por teléfono | Global, no por sucursal | `RN-CRM-01` | Baja urgencia — riesgo bajo de estar equivocado |
| Manicurista-recurso ≠ Usuario-manicurista | Dos conceptos distintos vinculados por referencia opcional | `RN-SEG-04` | Baja urgencia |
| Asignación manual a lista roja | Manual, con sugerencia del sistema | `RN-CRM-05` | Ya validado por evidencia de auditoría del mockup — baja urgencia |
| Un calendario de Google por sucursal | Sí, diferenciado por color | `RN-SUC-04` | Ver 1.25 |
| Gobernanza de "palabra prohibida" | Lista configurable, alcance global (no por sucursal) | `RN-CONV-09` | Baja urgencia |
| Override de precio/duración por sucursal | Modelado preventivamente, sin activar | `RN-COT-08`, `04-data-model.md` §5.2 | ✅ **Confirmado 2026-08-03**: no se usa, catálogo global (ver 1.11) |
| Retención de contenido conversacional de IA | "Corta", valor exacto sin fijar | `03-technical-architecture.md` §6.4 | Depende de `PA-20` (ver 1.27) |
| Snapshot inmutable de cotización | Aprobado como supuesto de trabajo | `RN-AGE-08` | Baja urgencia — ya validado ampliamente en el diseño |
| Sin ventana mínima de cancelación | Sin restricción dura; 60-0 min antes activa sugerencia de lista roja | Domain Discovery Pregunta #5 | ✅ **Confirmado 2026-08-03** con regla precisa de 60-0 min (ver 1.7) |
| Sin proveedor de IA de respaldo activo | Puerto preparado, sin implementar | `ADR-007` | Solo si ocurre un incidente real medible de OpenAI |

---

## 4. PREGUNTAS IMPLÍCITAS DETECTADAS

Supuestos que el proyecto está haciendo de facto, sin haber sido nunca registrados como Pregunta Abierta en ningún documento — cada uno sobrevivió un intento explícito de refutación antes de incluirse aquí.

#### 4.1 — Capacidad de citas sin manicurista asignada
- **Pregunta exacta:** Cuando una clienta no pide una manicurista en particular, ¿el sistema le asigna una manicurista específica automáticamente al confirmar, o la cita puede quedar sin asignar hasta el día del servicio?
- **Por qué existe (nunca registrada):** `DOMAIN_MODEL_REVIEW.md` (DM-11) la identificó como vacío real, evaluó 5+ modelos igualmente válidos, y la **descartó explícitamente por falta de evidencia textual** para elegir uno — nunca se convirtió en Pregunta Abierta formal.
- **Documentos que dependen:** `01-domain-discovery.md` §5.1, `04-data-model.md` §5.1, `decision-flows-catalogo-diseno.md` (`FL-AGE-10`).
- **Módulos que dependen:** Agenda.
- **Fases que bloquea:** Fase 2 — es uno de los dos bloqueadores críticos identificados en la revisión adversarial más reciente del proyecto.
- **Criticidad:** Crítica — afecta el invariante de no-doble-booking (`RN-AGE-01`) en un camino mainstream, no un edge case.
- **¿Valor provisional aceptable?** No de forma segura sin una decisión real — es exactamente el tipo de vacío que ya causó el riesgo de sobreventa señalado.
- **Riesgo de asumir:** Alto.
- **Recomendación arquitectónica:** Asignación automática obligatoria de una manicurista concreta al confirmar (incluso sin preferencia explícita de la clienta) — reutiliza el invariante de exclusión ya validado sin necesitar un mecanismo nuevo.
- **Quién responde:** Dueña.
- **Documento a modificar:** `01-domain-discovery.md` §5.1, `decision-flows-catalogo-diseno.md` (`FL-AGE-10`).

#### 4.2 — Destino del atributo `estado` de `Cita` tras una reprogramación
- **Pregunta exacta:** Cuando una cita se mueve a otro horario (reprogramación), ¿su estado queda registrado como "reprogramada" de forma permanente, o vuelve a "confirmada" y la reprogramación queda solo como un evento histórico?
- **Por qué existe (nunca registrada):** `DOMAIN_MODEL_REVIEW.md` (DM-02) resolvió el modelo de identidad (mutación in-place, no una cita nueva) pero nunca aclaró el destino del valor de `estado` en sí — encontrado en la revisión adversarial más reciente.
- **Documentos que dependen:** `01-domain-discovery.md` §5.1, `04-data-model.md` §5.1.
- **Módulos que dependen:** Agenda, Garantías (depende de que `completada` sea alcanzable), Reportes (KPI de "citas reprogramadas").
- **Fases que bloquea:** Fase 2 — parte del mismo entregable ya identificado (máquina de estados de `Cita`).
- **Criticidad:** Alta.
- **¿Valor provisional aceptable?** No — es una decisión de modelado, no un parámetro ajustable después sin costo.
- **Riesgo de asumir:** Alto — si se asume mal, `completada` puede volverse inalcanzable para cualquier cita reprogramada una vez, rompiendo silenciosamente Garantías y Reportes.
- **Recomendación arquitectónica:** Separar el KPI de "fue reprogramada" (campo booleano independiente) del atributo `estado` del ciclo de vida — mismo patrón que el proyecto ya validó para `modo` vs. `estado` en `Conversación`.
- **Quién responde:** Arquitectura (es una decisión de modelado, no de negocio — no requiere a la Dueña).
- **Documento a modificar:** `01-domain-discovery.md` §5.1, `04-data-model.md` §5.1.

#### 4.3 — Tratamiento de citas futuras al desactivar una manicurista
- **Pregunta exacta:** Cuando una manicurista se da de baja y tiene citas futuras ya asignadas, ¿qué pasa con esas citas — se bloquea la baja hasta reasignarlas, se cancelan automáticamente, o quedan pendientes de gestión manual?
- **Por qué existe (nunca registrada):** ningún Rule ID ni Decision Flow lo cubre — `FL-SUC-03` solo cita `RN-SEG-04` (separación de identidad), no este escenario. Encontrado en la revisión adversarial más reciente.
- **Documentos que dependen:** `docs/business-rules/09-sucursales-configuracion.md` (Rule ID nuevo).
- **Módulos que dependen:** Sucursales y Personal, Agenda, Anticipos (si alguna cita afectada tiene anticipo pagado).
- **Fases que bloquea:** No bloquea el inicio de Fase 1 — debe resolverse antes de dar ese módulo por terminado.
- **Criticidad:** Media-Alta.
- **¿Valor provisional aceptable?** Sí — exigir reasignación manual obligatoria antes de completar la baja, como default seguro.
- **Riesgo de asumir:** Medio — dejar citas "huérfanas" sin definición genera comportamiento no definido en el cálculo de disponibilidad.
- **Recomendación arquitectónica:** Reasignación manual obligatoria como parte del flujo de baja — consistente con el principio de control humano en decisiones con clientas/dinero de por medio.
- **Quién responde:** Dueña.
- **Documento a modificar:** `docs/business-rules/09-sucursales-configuracion.md` (nuevo Rule ID), `decision-flows-catalogo-diseno.md` (`FL-SUC-03`).

#### 4.4 — Alcance de auditoría para cancelaciones/reprogramaciones hechas directamente por un empleado
- **Pregunta exacta:** ¿Debe quedar auditada una cancelación o reprogramación de cita cuando la hace un empleado directamente (no la IA), aunque no tenga un componente financiero?
- **Por qué existe (nunca registrada):** `RN-AUD-01` enumera explícitamente solo cuatro categorías (configuración, financiero, lista roja, decisiones de IA) — una cancelación simple hecha por un empleado no encaja en ninguna. Encontrado en la revisión adversarial más reciente.
- **Documentos que dependen:** `docs/business-rules/11-auditoria-cumplimiento.md`.
- **Módulos que dependen:** Agenda, Auditoría.
- **Fases que bloquea:** No bloquea el inicio de Fase 2 — debe resolverse antes de dar por terminada la auditoría de ese módulo.
- **Criticidad:** Media.
- **¿Valor provisional aceptable?** Sí — ampliar `RN-AUD-01` para incluir explícitamente cambios de estado de `Cita` por acción de empleado, sin esperar confirmación adicional (es de bajo riesgo ampliar el alcance de auditoría, nunca al revés).
- **Riesgo de asumir:** Bajo si se amplía; alto si se deja sin resolver (pérdida de trazabilidad real).
- **Recomendación arquitectónica:** Ampliar `RN-AUD-01` ahora — no requiere esperar respuesta de nadie, es una corrección de alcance de bajo riesgo.
- **Quién responde:** Arquitectura (no requiere a la Dueña).
- **Documento a modificar:** `docs/business-rules/11-auditoria-cumplimiento.md`.

#### 4.5 — Reprogramación del recordatorio ya programado al mover una cita
- **Pregunta exacta:** Cuando una cita se reprograma a otro horario, ¿el recordatorio de 24h ya programado se actualiza automáticamente a la nueva hora, o queda apuntando a la hora original?
- **Por qué existe (nunca registrada):** ni `RN-NOT-02` ni `FL-AGE-03`/`FL-NOT-02` se citan mutuamente. Encontrado en la revisión adversarial más reciente.
- **Documentos que dependen:** `docs/business-rules/08-notificaciones.md` (ampliar `RN-NOT-02`).
- **Módulos que dependen:** Notificaciones, Agenda.
- **Fases que bloquea:** No bloquea el inicio de Fase 4 — debe resolverse antes de dar ese módulo por terminado.
- **Criticidad:** Media.
- **¿Valor provisional aceptable?** Sí — que el job de recordatorio consulte el estado vigente de la cita al ejecutarse, en vez de llevar una hora congelada (solución técnica, no requiere respuesta de negocio).
- **Riesgo de asumir:** Bajo con la solución técnica propuesta; alto si se ignora (recordatorio con hora incorrecta).
- **Recomendación arquitectónica:** El job consulta el `rango_horario` vigente al ejecutarse, no una copia congelada al programarse.
- **Quién responde:** Arquitectura (no requiere a la Dueña).
- **Documento a modificar:** `docs/business-rules/08-notificaciones.md`.

---

## 5. Registro de cierre — reunión con la Dueña (2026-08-03)

### 5.1 Conteo

| Clasificación | Cantidad | Preguntas |
|---|---|---|
| **A — Resuelta completamente** | 21 | 1.1, 1.2, 1.3, 1.4, 1.7, 1.8, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.17, 1.18, 1.19, 1.20, 1.23, 1.24, 1.26, 1.28 |
| **B — Parcialmente respondida** | 8 | 1.5, 1.6, 1.9, 1.22, 1.25, 1.27, 1.29, 1.30 |
| **C — Sigue sin respuesta** | 2 | 1.21, 1.31 |
| **D — Ya no aplica** | 0 | — |
| **Total** | 31 | |

De las 31 preguntas originalmente abiertas: **21 resueltas, 8 parciales, 2 siguen abiertas, 0 dejaron de aplicar.** Ninguna quedó huérfana (D) — no hubo ninguna pregunta invalidada por otra decisión tomada en la misma reunión.

**Hallazgos nuevos surgidos más allá de las 31 preguntas** (no eran lo que se preguntó, pero aparecieron en las respuestas — ninguno se ha incorporado todavía a Business Rules/Data Model/Decision Flows, quedan solo señalados aquí):
1. Fallback de oferta a **otra sucursal** cuando no hay disponibilidad (1.2) — capacidad nueva, sin Rule ID.
2. Horario partido con corte de mediodía y **prohibición de citas que crucen el hueco 12pm-3pm** (1.3) — invariante nuevo del motor de disponibilidad.
3. Etiquetas de **ubicación geográfica** de clientas para ofrecer citas por cercanía (1.4) — sugerencia abierta de la Dueña.
4. **Regla de 59-60 minutos**: cancelar/reagendar tarde o no presentarse dispara sugerencia automática de lista roja — confirmada de forma consistente en tres respuestas independientes (1.6, 1.7, 1.18).
5. Excepción: retiro-de-gel-puro se agenda **manualmente**, fuera del flujo automático (1.10).
6. **Anticipo = 40% del servicio** (1.13) — dato crítico que no existía en ningún documento.
7. **Cero reembolsos de anticipo, siempre**; reagendar con anticipo pagado exige **48h de anticipación + alerta de confirmación** (1.14) — regla paralela a la de 59-60 min, deben coexistir sin contradecirse.
8. Confirmación de cita es **interactiva** (requiere respuesta afirmativa explícita), no push unidireccional (1.23) — requiere un **estado intermedio nuevo** en la máquina de estados de `Cita`.
9. `ADR-008` cambia de alcance: se requieren **dos adaptadores de WhatsApp** (oficial + Evolution) configurables, no una elección binaria única (1.29).

### 5.2 ¿Es razonable comenzar el desarrollo de la plataforma con el conocimiento actual?

Respuesta no binaria. Ninguna de las 10 preguntas que quedaron en B o C **bloquea iniciar** el desarrollo — todas bloquean **terminar un módulo específico** o **desplegar a producción con confianza**, nunca el arranque de Fase 1.

| Pregunta | Qué bloquea |
|---|---|
| 1.5 (prioridad exacta en lista de espera) | Terminar Fase 2 (Agenda) — no bloquea iniciarla; FIFO es un default razonable por consistencia con 1.2 |
| 1.6 (mecanismo exacto de `completada`) | Terminar el diseño de la máquina de estados de `Cita` (Fase 0, en curso) y Fase 5 (Garantías) — es la pregunta de mayor apalancamiento del proyecto, se recomienda repreguntarla de forma literal antes de cerrar ese diseño |
| 1.9 (celdas de duración aún sin valor) | Terminar el motor de duración con precisión total antes de operar con cobros reales — no bloquea iniciar, ya existe fallback aditivo marcado como estimado |
| 1.22 (reseteo de `modo` en Conversación) | Terminar el diseño de la máquina de estados de `Conversación` (Fase 0, en curso) — Crítica, es la ruta directa al peor escenario de negocio (DM-C); no bloquea Fases 1-3, que no dependen de Conversación |
| 1.25 (uno vs. varios calendarios de Google) | Terminar/iniciar el módulo de Sincronización de Calendario (Fase 4) — no bloquea Fase 1 |
| 1.27 (marco legal de datos personales) | Desplegar a producción con clientas reales (Fase 7) sin validación legal formal — no bloquea construir ningún módulo |
| 1.29 (alcance dual de `ADR-008`) | Terminar el diseño de integración de WhatsApp (Fase 4) hasta reescribir `ADR-008` — no bloquea Fase 1; el trámite de verificación ante Meta con la API oficial puede iniciarse ya, en paralelo |
| 1.30 (capacidad real de recepción humana) | Desplegar a producción con confianza (Fase 7) — no bloquea construir el mecanismo de degradación, ya diseñado funcionalmente |
| 1.21 (umbral de "cliente molesto") | No bloquea nada — valor provisional ya documentado, se puede resolver durante el desarrollo con datos del golden set |
| 1.31 (presupuesto WhatsApp/IA) | No bloquea nada — mecanismo técnico ya diseñado, solo falta fijar el número, se puede resolver durante el desarrollo |

**Ningún pendiente residual de esta reunión bloquea iniciar desarrollo.** Esto es consistente con (y refuerza) el análisis previo, nunca formalizado en un documento, de que Fase 1 no tiene verdaderos "Start Blockers".

**Efecto directo sobre `ARCHITECTURE_CLOSURE_PLAN.md`:** esta reunión resuelve el **Pendiente P2** (alcance RBAC de `PA-19`/1.26 — confirmado global) de los 9 pendientes finales. **No resuelve el Pendiente P1** (BD/ORM/proveedor de autenticación), que es una decisión de arquitectura/stack, no una pregunta de negocio para la Dueña, y que ese mismo documento identifica como el único bloqueador que hoy detiene el arranque *formal* de toda la Fase 1. El Pendiente P3 (las 3 máquinas de estado) avanza de forma real pero no se cierra: 1.23 se resuelve por completo (requiere estado nuevo en `Cita`), 1.6 avanza mucho (queda un punto exacto por confirmar), 1.22 avanza (queda el mecanismo de `modo` por confirmar), y `TicketEscalamiento` no fue tocado por ninguna de las 31 preguntas.

### 5.3 Módulos de `IMPLEMENTATION_MASTER_PLAN.md`: cuáles pueden empezar ya

- **Bajo el criterio formal y estricto de `ARCHITECTURE_CLOSURE_PLAN.md`:** Fase 1 sigue en "No" — el Pendiente P1 (stack de BD/ORM/Auth), que esta reunión no tocaba ni podía tocar, sigue abierto y ese documento lo trata como bloqueador único de toda la Fase 1.
- **Bajo el análisis más fino ya explorado en esta sesión (chat, nunca persistido):** el diseño de dominio y aplicación de Sucursales → Identidad → Catálogo no depende de la elección de ORM/proveedor concreto, solo de los puertos ya definidos por `ADR-002`. Con el Pendiente P2 ahora confirmado (alcance RBAC global) y sin ningún hallazgo de esta reunión que contradiga esa lectura, el caso para empezar a escribir las capas de dominio/aplicación de Sucursales e Identidad hoy —dejando la capa de infraestructura concreta (adaptador de BD real) para cuando P1 se resuelva— queda, si acaso, más fuerte que antes, no más débil.
- **Catálogo y Cotización** puede avanzar con el fallback aditivo ya documentado para las combinaciones aún sin valor exacto (1.9), marcándolas explícitamente como estimadas.
- **Agenda (Fase 2)** puede avanzar en su mayor parte, pero el cierre de la máquina de estados de `Cita` — entregable activo de Fase 0 — debe esperar la repregunta puntual de 1.6 (mecanismo exacto de `completada`) y ya debe incorporar el nuevo estado intermedio de 1.23 (confirmación interactiva) y el invariante de horario partido de 1.3.
- **Anticipos (Fase 3)** queda con datos de negocio completos por primera vez (40%, sin reembolsos, ventana de 48h) — listo para diseño detallado.
- **Conversación e IA (Fase 4)** no debe iniciarse formalmente hasta cerrar el mecanismo de `modo` de 1.22 (Crítica) y reescribir `ADR-008` con el alcance dual de 1.29 — pero ninguno de los dos bloquea Fases 1-3.
- **Garantías (Fase 5)** confirma un modelo 100% manual/discrecional (1.15-1.17), simplificando su diseño; sigue dependiendo de que 1.6 cierre el evento `CitaCompletada`.

---

## Cómo usar este documento

Cada reunión con la dueña de Blanc debe recorrer la Sección 1 categoría por categoría. Cuando una pregunta se responde, su Rule ID pasa de `Faltante`/`Pendiente`/`Asumida` a `Aprobada` en el documento de Business Rules correspondiente, y esta entrada se marca aquí como `Resuelta` (sin eliminarse, por trazabilidad histórica — mismo criterio ya usado en `99-open-questions.md`). Cuando las 31 preguntas de la Sección 1 estén resueltas (o explícitamente diferidas con un valor provisional aceptado y documentado), la etapa de Discovery queda formalmente cerrada.
