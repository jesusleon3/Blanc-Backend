# Catálogo de Decision Flows — Diseño Congelado

> **Estado: CONGELADO.** Fecha de congelamiento: 2026-07-15. A partir de este punto, cualquier cambio a este catálogo debe estar motivado por (a) nueva información de negocio del cliente, (b) un ADR nuevo, o (c) una inconsistencia real encontrada durante la implementación — no por seguir refinando el diseño.
> **Qué significa "congelado" exactamente:** queda fijo el inventario — qué flujos existen, sus límites, su nivel (macro/micro), su nomenclatura y su grafo de composición. **No** significa que cada flujo individual esté en `Estado: Aprobado` — varios siguen `Conceptual` porque las reglas de negocio que orquestan todavía tienen preguntas abiertas en `99-open-questions.md`. Eso es esperado y no bloquea el congelamiento del catálogo; bloquea únicamente que ese flujo específico se trate como comportamiento vigente hasta que su regla se resuelva (misma disciplina que ya rige el Business Rules Engine).
> **Historial:** este documento reemplaza la versión borrador anterior. La revisión crítica que originó estas correcciones vive, sin modificarse, en `docs/decision-flows-revision-critica.md` — se conserva como registro histórico, igual que `ARCHITECTURE_REVIEW.md` y `DOMAIN_MODEL_REVIEW.md`.

---

## 1. Catálogo de Macro-flows (final)

| Flow ID | Nombre | Objetivo | Disparador | Categoría | Prioridad | Estado | Micro-flows que invoca |
|---|---|---|---|---|---|---|---|
| FL-AGE-01 | Agendar Cita Nueva | Confirmar una cita nueva con tiempo y precio exactos, sin conflicto | La IA interpreta intención de agendar | Agenda | Critical | Conceptual | FL-CONV-01, FL-CONV-02, FL-CONV-03, FL-CONV-04, FL-COT-02, FL-COT-03, FL-AGE-09, FL-AGE-10, FL-AGE-11, FL-NOT-01, FL-AUD-01, FL-ESC-01 |
| FL-AGE-02 | Activar Solicitud de Cambio de Horario | Registrar el interés de una clienta con cita confirmada en un horario anterior | Clienta con cita confirmada pide que se le avise si se libera un horario anterior | Agenda | High | Conceptual | FL-CONV-01, FL-CONV-04, FL-AUD-01 |
| FL-AGE-03 | Ofrecer y Confirmar Cambio de Horario | Mover una cita ya confirmada a un horario anterior, solo con aceptación explícita | Se libera un horario compatible con una solicitud activa (evento de dominio) | Agenda | High | Conceptual | FL-AGE-09, FL-AGE-11, FL-NOT-01, FL-AUD-01 |
| FL-AGE-04 | Cancelar Cita | Cancelar una cita ya confirmada, con revisión si la clienta es de riesgo, y evaluar reembolso si aplica | Clienta o empleado solicita cancelar | Agenda | High | Conceptual | FL-CONV-01, FL-CONV-04, FL-CRM-05, FL-AGE-11, FL-NOT-01, FL-AUD-01, FL-ESC-01 |
| FL-AGE-05 | Registrar en Lista de Espera | Registrar a una clienta interesada cuando no hay disponibilidad exacta ni alternativa razonable | No hay disponibilidad y la clienta acepta esperar | Agenda | Medium | Conceptual | FL-CONV-01, FL-CONV-04, FL-COT-02, FL-COT-03, FL-AUD-01 |
| FL-AGE-06 | Notificar y Convertir Cupo de Lista de Espera | Convertir en cita a una clienta en lista de espera cuando se libera un cupo compatible | Se libera un cupo compatible con una o más entradas en lista de espera (evento de dominio) | Agenda | Medium | Conceptual | FL-AGE-09, FL-AGE-10, FL-AGE-11, FL-NOT-01, FL-AUD-01 |
| FL-AGE-07 | Bloquear Horario / Configurar Día Festivo | Reservar tiempo fuera de la disponibilidad ofrecida a clientas | Acción explícita de un administrador | Agenda | Medium | Aprobado | FL-CONV-04*, FL-AUD-01 |
| FL-COT-01 | Gestionar Catálogo de Servicios y Modificadores | Mantener precios, duraciones y overrides del catálogo | Acción explícita de un administrador | Duración y Cotización | Medium | Conceptual | FL-AUD-01 |
| FL-ANT-01 | Liberar Horario por Anticipo No Pagado | No bloquear horarios indefinidamente por anticipos nunca pagados | Vence la ventana de gracia (job programado) | Anticipos | High | Conceptual | FL-AGE-09, FL-NOT-01, FL-AUD-01 |
| FL-GAR-01 | Gestionar Solicitud de Garantía | Dar respuesta ordenada a un problema con un servicio ya realizado | Clienta reporta un problema con un servicio | Garantías | High | Aprobado | FL-CONV-01, FL-CONV-04, FL-AUD-01, FL-ESC-01 (si el reporte es una queja) |
| FL-CRM-01 | Registrar Cliente | Crear o completar el perfil de una clienta | Primer contacto por WhatsApp, o alta manual por un empleado | CRM / Clientas | Medium | Aprobado | FL-AUD-01 |
| FL-CRM-02 | Marcar / Desmarcar Lista Roja | Clasificar a una clienta como riesgo de cancelación, con sus consecuencias asociadas | Acción de un empleado, o sugerencia del sistema por historial | CRM / Clientas | High | Conceptual | FL-CRM-05, FL-AUD-01 |
| FL-CRM-03 | Bloquear / Desbloquear Cliente | Restringir el agendamiento de una clienta con comportamiento inaceptable | Acción explícita de un empleado | CRM / Clientas | High | Aprobado | FL-AUD-01 |
| FL-CRM-04 | Gestionar Etiquetas de Cliente | Permitir trato personalizado más allá de la clasificación formal | Acción explícita de un empleado | CRM / Clientas | Medium | Conceptual | FL-AUD-01 |
| FL-ESC-02 | Atender Ticket de Escalamiento | Garantizar que un empleado atienda y resuelva una conversación escalada | Notificación de ticket creado | Escalamiento Humano | Critical | Aprobado | FL-NOT-01, FL-AUD-01 |
| FL-NOT-02 | Enviar Recordatorio Programado de Cita | Reducir inasistencias recordando la cita con anticipación | Ventana de tiempo antes de la cita (job programado) | Notificaciones | Medium | Conceptual | FL-NOT-01 |
| FL-SUC-01 | Configurar Horario y Festivos de Sucursal | Reflejar la operación real de cada sucursal | Acción explícita de un administrador | Sucursales y Configuración | Medium | Aprobado | FL-AUD-01 |
| FL-SUC-02 | Activar Modo Mantenimiento | Pausar la atención automática de forma controlada y reversible | Acción explícita de un Super Administrador | Sucursales y Configuración | High | Conceptual | FL-AUD-01 |
| FL-SUC-03 | Gestionar Personal (Alta/Baja de Manicurista) | Administrar el recurso agendable sin acoplarlo a la cuenta de usuario | Acción explícita de un administrador | Sucursales y Configuración | Medium | Aprobado | FL-AUD-01 |
| FL-SUC-04 | Dar de Alta Nueva Sucursal | Aprovisionar una sucursal completa (horario, personal, canal de WhatsApp) | Acción explícita de un administrador | Sucursales y Configuración | Medium | Conceptual | FL-SUC-01, FL-SUC-03, FL-AUD-01 |
| FL-SEG-01 | Gestionar Usuario Interno y Rol | Dar de alta usuarios internos con el rol y la verificación correctos | Acción explícita de un administrador | Identidad y Seguridad | High | Implementado, alcance mínimo (2026-08-22) — ver nota (f) | FL-AUD-01 |

`*` `FL-CONV-04` en `FL-AGE-07` solo aplica si el bloqueo se origina dentro de una conversación (poco común); se lista por completitud, no es su ruta principal.

**Total: 21 macro-flows.**

**Notas de exclusión que se mantienen (no son huecos nuevos, ya identificadas):**
- **Marcar Cita como Completada / No-Show** — sigue excluida. No tiene disparador definido (`01-domain-discovery.md` Pregunta Abierta #15) y, a diferencia de cualquier otro hueco del catálogo, ni siquiera tiene un Rule ID `Faltante` que lo respalde en el Business Rules Engine. **Acción pendiente, fuera del alcance de esta consolidación:** crear `RN-AGE-14` (Faltante) en `docs/business-rules/01-agenda.md` antes de poder catalogar este flujo.
- **Marcar/Desmarcar VIP** — se decide, en esta consolidación, **no** catalogarlo como Decision Flow. Ningún Rule ID gobierna un criterio de asignación (a diferencia de lista roja y bloqueo, que sí tienen `RN-CRM-03`/`RN-CRM-04`) — es un cambio de atributo sin bifurcación de negocio que orquestar, igual que `Reportes` no tiene flujos por ser puro read-model.
- **Versionar y revertir prompts de IA** (Domain Discovery §6, caso de uso 19) — sigue sin Rule ID ni hogar natural. Se deja fuera del catálogo; queda como pregunta abierta para el cliente, no se resuelve aquí.

---

## 2. Catálogo de Micro-flows (final)

| Flow ID | Nombre | Objetivo | Categoría | Rule IDs que consume | Reutilizado por (macro-flows) |
|---|---|---|---|---|---|
| FL-AGE-08 | Confirmar Cita | Fijar una cita en firme por primera vez: revalidar disponibilidad, congelar cotización, y verificar/gestionar anticipo si la clienta es de riesgo | Agenda | RN-AGE-01, RN-AGE-02, RN-AGE-08 | FL-AGE-01, FL-AGE-06 |
| FL-AGE-09 | Validar Disponibilidad | Verificar que un horario/manicurista/sucursal esté realmente libre | Agenda | RN-AGE-01, RN-AGE-10, RN-AGE-11 | FL-AGE-01, FL-AGE-03, FL-AGE-06, FL-ANT-01 |
| FL-AGE-10 | Resolver Conflicto de Disponibilidad | Ofrecer una alternativa razonable ante falta de disponibilidad exacta | Agenda | RN-AGE-03, RN-AGE-04, RN-AGE-05 | FL-AGE-01 |
| FL-AGE-11 | Sincronizar con Google Calendar | Reflejar el estado de una cita en la vista operativa del negocio | Agenda | RN-AGE-09, RN-SUC-04 | FL-AGE-01, FL-AGE-03, FL-AGE-04, FL-AGE-06 |
| FL-COT-02 | Calcular Duración de Servicio Compuesto | Determinar el tiempo real de una combinación de retiro/aplicación | Duración y Cotización | RN-COT-01, RN-COT-02, RN-COT-04, RN-COT-05† | FL-AGE-01, FL-AGE-05 |
| FL-COT-03 | Calcular Cotización | Determinar el precio total de una composición de servicio | Duración y Cotización | RN-COT-03, RN-COT-07, RN-COT-08, RN-COT-09 | FL-AGE-01, FL-AGE-05 |
| FL-ANT-02 | Solicitar y Retener Anticipo | Cobrar el anticipo y retener el horario mientras se espera el pago | Anticipos | RN-ANT-02 | FL-AGE-08 (interno, no invocado directamente por ningún macro-flow) |
| FL-CRM-05 | Consultar Clasificación de Cliente | Consultar si la clienta es normal/VIP/lista roja/bloqueada — consulta pura, sin efecto | CRM / Clientas | RN-CRM-02, RN-CRM-03, RN-CRM-04 | FL-AGE-08 (interno), FL-AGE-04, FL-CRM-02 |
| FL-CONV-01 | Interpretar Intención de la Clienta | Traducir lenguaje natural en una intención estructurada y validada | Conversación e IA | RN-CONV-01, RN-CONV-02 | FL-AGE-01, FL-AGE-02, FL-AGE-04, FL-AGE-05, FL-GAR-01 |
| FL-CONV-02 | Clarificar Solicitud Ambigua | Pedir aclaración antes de asumir una interpretación | Conversación e IA | RN-CONV-03 | FL-AGE-01 |
| FL-CONV-03 | Detectar Señal de Escalamiento | Identificar imagen sensible, audio, queja o palabra prohibida | Conversación e IA | RN-CONV-05, RN-CONV-06, RN-CONV-08, RN-CONV-09 | FL-AGE-01, FL-GAR-01 |
| FL-CONV-04 | Revalidar Modo de Conversación Antes de Responder | Evitar que el bot responda automáticamente justo después de que un humano tomó el control | Conversación e IA | RN-ESC-02 | FL-AGE-01, FL-AGE-02, FL-AGE-04, FL-AGE-05, FL-GAR-01 (todo macro-flow conversacional) |
| FL-ESC-01 | Escalar a Humano | Detener la IA, crear el ticket y notificar al personal | Escalamiento Humano | RN-ESC-01, RN-ESC-04 | Todo flujo que dispare FL-CONV-03 |
| FL-NOT-01 | Enviar Notificación a Clienta | Enviar un mensaje de WhatsApp asociado a un evento de negocio | Notificaciones | RN-NOT-01, RN-NOT-05 | FL-AGE-01, FL-AGE-03, FL-AGE-04, FL-AGE-06, FL-ANT-01, FL-NOT-02, FL-ESC-02 |
| FL-AUD-01 | Registrar Auditoría | Dejar registro permanente y no editable de una acción sensible | Auditoría y Cumplimiento | RN-AUD-01 | Todo macro-flow con efecto financiero, de configuración o de clasificación de cliente |

**Total: 15 micro-flows.**

`†` **Agregado 2026-08-04 (`DISCOVERY_CHECKLIST.md` 1.10):** `RN-COT-05` (método de retiro) se cita en `FL-COT-02` — hueco de trazabilidad ya señalado antes de resolverse. Excepción no incorporada al catálogo (nivel de detalle de flujo, no de índice): una solicitud de retiro-de-gel-puro se agenda manualmente, fuera de este flujo automático.

**Cambios de nivel/alcance aplicados en esta consolidación (para que quede explícito qué cambió y por qué):**
- `FL-AGE-08` (Confirmar Cita) ahora **invoca internamente** a `FL-CRM-05` (consulta) y, condicionalmente, a `FL-ANT-02` (solicitar anticipo) — antes, cada macro-flow que confirmaba una cita orquestaba esa verificación por separado. Centralizar esto en `Confirmar Cita` es lo que resuelve, a la vez, el hallazgo de cohesión de `FL-CRM-05` (Sección 2 de la revisión crítica) y el riesgo de que un futuro cuarto flujo de confirmación olvide repetir la verificación.
- **Precisión encontrada durante esta consolidación (no estaba en la revisión crítica):** `FL-AGE-03` (Ofrecer y Confirmar Cambio de Horario) **no** invoca `FL-AGE-08` completo — reprogramar una cita ya confirmada no vuelve a calcular cotización ni vuelve a evaluar anticipo, porque ambos ya se resolvieron en la primera confirmación (`RN-AGE-08`, snapshot inmutable, es explícito en que el precio/duración no cambia retroactivamente). `FL-AGE-03` reutiliza únicamente `FL-AGE-09` (revalidar disponibilidad del nuevo horario) y `FL-AGE-11` (sincronizar). La revisión crítica había asumido que `FL-COT-03`/`FL-ANT-02` ganarían un consumidor adicional vía el cambio de horario — al detallar el flujo, eso no se sostiene, y se corrige aquí.
- **Aprovisionar Canal de WhatsApp** (mencionado en la revisión crítica como candidato a extraerse de `FL-SUC-01`) se sacó de `FL-SUC-01` para resolver su problema de cohesión, pero **no** se catalogó como micro-flow propio — tiene un solo consumidor hoy (`FL-SUC-04`) y no está en la lista de capacidades pre-aprobadas, así que por el propio umbral de extracción de este catálogo permanece como paso en línea dentro de `FL-SUC-04`. Extraerlo como micro-flow habría sido inconsistente con el mismo criterio que ya se aplicó para no extraer "Validar Vigencia de Garantía".
- `FL-SEG-02` (Verificar Permiso de Rol) **se excluye del catálogo**, tal como recomendó la revisión crítica — `RN-SEG-01`/`RN-SEG-02` se citan como precondición directa en cada macro-flow administrativo (`FL-COT-01`, `FL-SUC-01/02/03/04`, `FL-SEG-01`), sin Flow ID propio.
- `FL-ANT-04` (Reembolsar Anticipo) **se elimina como flujo propio** y queda como paso en línea dentro de `FL-AGE-04` (Cancelar Cita), citando `RN-ANT-04` directamente.

---

## 3. Matriz de reutilización (final)

| Micro-flow | Nº de macro-flows que lo reutilizan | Cuáles |
|---|---|---|
| FL-AUD-01 | 15 (todos) | — |
| FL-NOT-01 | 7 | FL-AGE-01, FL-AGE-03, FL-AGE-04, FL-AGE-06, FL-ANT-01, FL-NOT-02, FL-ESC-02 |
| FL-CONV-01 | 5 | FL-AGE-01, FL-AGE-02, FL-AGE-04, FL-AGE-05, FL-GAR-01 |
| FL-CONV-04 | 5 | FL-AGE-01, FL-AGE-02, FL-AGE-04, FL-AGE-05, FL-GAR-01 |
| FL-AGE-09 | 4 | FL-AGE-01, FL-AGE-03, FL-AGE-06, FL-ANT-01 |
| FL-AGE-11 | 4 | FL-AGE-01, FL-AGE-03, FL-AGE-04, FL-AGE-06 |
| FL-CONV-03 | 2 | FL-AGE-01, FL-GAR-01 |
| FL-COT-02 | 2 | FL-AGE-01, FL-AGE-05 |
| FL-COT-03 | 2 | FL-AGE-01, FL-AGE-05 |
| FL-ESC-01 | 6 (indirecto, vía FL-CONV-03) | Todo lo que dispare FL-CONV-03 |
| FL-AGE-08 | 2 | FL-AGE-01, FL-AGE-06 |
| FL-CRM-05 | 1 directo + 1 interno | FL-AGE-04 (directo); FL-AGE-08 (interno, no un macro-flow) |
| FL-AGE-10 | 1 | FL-AGE-01 |
| FL-ANT-02 | 0 directo, 1 interno | Solo FL-AGE-08 (interno) |

`FL-ANT-02` y `FL-CRM-05` muestran reutilización "baja" en conteo directo de macro-flows precisamente **porque** la corrección de la Sección 2 centralizó su consumo dentro de `FL-AGE-08` — es el resultado esperado del rediseño, no un hallazgo pendiente: `FL-AGE-08` en sí mismo es reutilizado por 2 macro-flows, así que ambos siguen indirectamente reutilizados sin duplicar orquestación.

---

## 4. Verificación final de consistencia cruzada

Contra los cinco documentos que gobiernan el proyecto, con intento explícito de encontrar algo nuevo, no de confirmar lo ya hecho.

**Domain Discovery (`01-domain-discovery.md`):** ningún flujo introduce un aggregate, evento de dominio o transición de estado nueva. La separación `FL-AGE-02`/`FL-AGE-03` (activar solicitud vs. ofrecer/confirmar) y `FL-AGE-05`/`FL-AGE-06` (registrar vs. notificar/convertir) es coherente con que `SolicitudDeCambioDeHorario` y `ListaDeEsperaEntrada` ya son aggregates independientes con su propio ciclo de vida (§5.1, §5.11) — los flujos no hacen más que reflejar en orquestación una separación que el dominio ya había decidido. Ninguna inconsistencia nueva.

**Business Rules (`docs/business-rules/`):** todo paso de todo flujo cita un Rule ID existente; ninguno inventa lógica. Dos huecos quedan explícitamente señalados como acción pendiente fuera de este catálogo (crear `RN-AGE-14` para completada/no-show; decidir si versionar prompts merece un Rule ID) — no bloquean el congelamiento del resto. Los archivos de `docs/business-rules/` **no se modifican** en esta consolidación, consistente con la gobernanza de límites documentales ya establecida — el cruce opcional de `Flow ID` en el campo `Consumidores` de cada regla queda como mejora futura, no como requisito para congelar.

**Decision Flows (autoconsistencia):** verificado el grafo completo de invocación — ningún macro-flow es invocado por otro flujo (los 21 son puntos de entrada), ningún micro-flow invoca un macro-flow, y `FL-AUD-01`/`FL-NOT-01` siguen siendo hojas del grafo (solo invocan Rule IDs). Sin ciclos. La única corrección respecto a la revisión crítica es la precisión de `FL-AGE-03` documentada en la Sección 2 — no es una contradicción, es una imprecisión ya corregida antes de congelar.

**Functional Scope (`functional-scope.md`):** los 9 módulos siguen cubiertos en la misma proporción que antes de esta consolidación; la exclusión de "Marcar VIP" como flujo no contradice el documento (`functional-scope.md` §3.4 menciona la clasificación VIP como funcionalidad, no como regla con bifurcación, consistente con no necesitar un Decision Flow). No se modifica este documento.

**ADRs:** ninguno requiere cambio. `FL-SUC-04` (Dar de Alta Nueva Sucursal) es coherente con ADR-009 (modelo Silo, `Sucursal` ya "tenant-ready"); la centralización de anticipo dentro de `FL-AGE-08` es coherente con ADR-021 (idempotencia como invariante de negocio, no solo técnica) — un único punto de verificación reduce superficie de error de doble-cobro. Ninguna inconsistencia.

**Domain Policies (`PLATFORM_ARCHITECTURE_MODEL.md` §9, formalizado por `ADR-023` — agregado 2026-08-04):** `PoliticaDeCotizacion` se invoca desde `FL-COT-02`/`FL-COT-03`; `PoliticaDeDisponibilidad` desde `FL-AGE-10`; `PoliticaDeRiesgoCliente` desde `FL-CRM-05` y pasos internos de `FL-CRM-02`; `PoliticaDeGarantia` desde `FL-GAR-01`. Ningún flujo cambia de forma — es documentación de dónde vive la costura entre orquestación y decisión de dominio, no una decisión nueva.

**Conclusión de la verificación:** no aparece ninguna contradicción nueva de fondo — solo precisiones dentro de lo ya decidido (Sección 2). Se cumple la condición para congelar.

---

## 5. Declaración de congelamiento

El catálogo queda **congelado en 21 macro-flows y 15 micro-flows (36 en total)**, con el 100% de sus pasos trazables a un Rule ID existente o a un hueco ya reconocido en `99-open-questions.md`.

**Regla de cambio a partir de ahora:** cualquier modificación futura a este catálogo (agregar, dividir, fusionar o eliminar un flujo) requiere una de estas tres justificaciones:
1. Nueva información de negocio proporcionada por el cliente (ej. resuelve una pregunta de `99-open-questions.md`).
2. Un ADR nuevo o modificado.
3. Una inconsistencia real detectada durante la implementación (no una preferencia de diseño).

---

## 6. Adenda — Identidad y Accesos (pre-arranque, hardening 2026-08-11)

**Justificación de esta adenda, explícita (Sección 5, criterios 2 y 3):** durante la auditoría de pre-arranque del módulo Identidad y Accesos se encontró que este catálogo ya contenía `FL-SEG-01` ("Gestionar Usuario Interno y Rol", categoría "Identidad y Seguridad", `Estado: Conceptual`) — un único macro-flow demasiado grueso para dirigir la implementación real de los seis casos de uso distintos que Identidad necesita construir. Esto es una inconsistencia real encontrada al intentar usar el catálogo para programar (criterio 3), y coincide además con la creación de `ADR-024` (criterio 2, ver `docs/architecture/adr/ADR-024-*.md`), que depende directamente de cómo se orquesta la sincronización con Supabase Auth. `FL-SEG-01` **no se elimina ni se reescribe** — permanece en la Sección 1 tal cual. Esta adenda agrega cinco flujos nuevos, más finos, que en conjunto cubren el mismo territorio que `FL-SEG-01` señalaba de forma general.

**Corrección de nomenclatura, no silenciosa:** una instrucción de trabajo reciente asumió el prefijo `FL-IDE-*` para estos flujos. Verificado contra este documento: el prefijo ya establecido para esta categoría es **`FL-SEG-*`** (consistente con `RN-SEG-*` en `docs/business-rules/10-identidad-seguridad.md`, y con el propio `FL-SEG-01` ya congelado). Se usa `FL-SEG-*` aquí — `FL-IDE-*` no existe en ningún documento del proyecto y se descarta sin ambigüedad.

**Corrección 2026-08-22 — colisión de ID detectada y corregida (no silenciosa):** la primera versión de esta adenda reutilizó `FL-SEG-02` para "Editar Usuario / Cambiar Rol" sin notar que ese ID **ya estaba asignado** en este mismo documento (línea de exclusión arriba: `FL-SEG-02` = "Verificar Permiso de Rol", excluido del catálogo desde la revisión crítica original — `docs/decision-flows-revision-critica.md`). Un ID excluido sigue siendo un ID usado; reasignarlo genera ambigüedad real entre dos documentos del proyecto que citan `FL-SEG-02` con significados distintos (`decision-flows-trazabilidad.md` línea 240, `decision-flows-revision-critica.md` líneas 172/182/213/229). Se corrige aquí desplazando los cinco flujos nuevos una posición (`FL-SEG-02`→`FL-SEG-07`), sin tocar los documentos históricos que referencian el `FL-SEG-02` original (correctos, no se editan). El total de macro-flows de esta adenda no cambia (siguen siendo 5 nuevos).

| Flow ID | Nombre | Objetivo | Disparador | Categoría | Prioridad | Estado | Micro-flows que invoca |
|---|---|---|---|---|---|---|---|
| FL-SEG-03 | Editar Usuario / Cambiar Rol | Actualizar los datos de un usuario existente y/o su rol asignado | Acción explícita de un administrador | Identidad y Seguridad | High | Implementado, alcance mínimo (2026-08-22) — ver notas (a) y (f) | FL-AUD-01 |
| FL-SEG-04 | Asignar / Remover Sucursales de Usuario | Administrar la relación usuario↔sucursal (`usuarios_sucursales`) | Acción explícita de un administrador | Identidad y Seguridad | High | Implementado, alcance mínimo (2026-08-22) — ver notas (b) y (g) | FL-AUD-01 |
| FL-SEG-05 | Desactivar / Reactivar Usuario | Revocar o restaurar el acceso de un usuario sin eliminar su historial | Acción explícita de un administrador (ej. offboarding) | Identidad y Seguridad | Critical | **Desactivar**: implementado, alcance mínimo (2026-08-23) — ver nota (h). **Reactivar**: explícitamente fuera de alcance, sin implementar | FL-AUD-01 |
| FL-SEG-06 | Invitar / Sincronizar Usuario con Supabase Auth | Coordinar la creación/vinculación de una cuenta de acceso (Supabase Auth) con el registro administrativo de Blanc | Alta de un usuario que requiere acceso al sistema | Identidad y Seguridad | High | **Sin respaldo de negocio — ver nota (d)** | FL-AUD-01 |
| FL-SEG-07 | Exigir / Verificar MFA | Bloquear el acceso de roles críticos sin verificación adicional de identidad | Inicio de sesión de un usuario con rol crítico | Identidad y Seguridad | Critical | Conceptual — respaldo firme, ver nota (e) | — |

**Notas de respaldo documental, una por flujo (ninguna regla inventada):**

- **(a) `FL-SEG-03`:** respaldado por `RN-SEG-01` (existencia del rol) y `functional-scope.md` §3.8 ("gestión de usuarios internos y asignación de roles"), pero **ningún Rule ID ni ADR define qué debe ocurrir con una sesión ya activa cuando el rol cambia** — la auditoría de pre-arranque (Sección de "cambio de rol con sesión activa" del `HANDOFF`, y ahora `ADR-024`) documenta el comportamiento técnico real (ventana de exposición ligada a la vida del access token), pero eso es una consecuencia técnica observada, no una regla de negocio aprobada. No se inventa ninguna regla aquí — se deja la referencia cruzada.
- **(b) `FL-SEG-04`:** el mecanismo de asignación/remoción explícita (con filas en `usuarios_sucursales`) está respaldado por `04-data-model.md` §5.10. El comportamiento cuando **no** hay filas (para Administrador/Gerente/Recepcionista/Manicurista) sigue bloqueado por la Pregunta 11 de `OWNER_DECISION_LOG.md` — **no se resuelve aquí**. Este flujo cubre el mecanismo, no esa decisión pendiente.
- **(c) `FL-SEG-05`:** respaldado por `usuarios.activa` (nombre real de columna, implementado 2026-08-23 — esta nota se redactó antes, con el nombre provisional `usuarios.estado`; ver nota (h) para el detalle vigente) y por la constraint explícita de `ADR-010` ("debe existir capacidad de revocación inmediata"). **Vacío real, no inventado:** ningún documento anterior a esta adenda definía el mecanismo concreto de desactivación ni sus límites reales — `ADR-024` documenta, con evidencia de la documentación pública de Supabase Auth, que la revocación real de una cuenta desactivada tiene una ventana de exposición no nula (ver `ADR-024` §"Revocación y desactivación").
- **(d) `FL-SEG-06`:** **no existe ningún Rule ID que respalde este flujo.** No es un flujo de negocio — es un flujo técnico de integración entre dos sistemas (Blanc y Supabase Auth) que ningún documento de negocio (Domain Discovery, Business Rules, `functional-scope.md`) menciona jamás, porque la existencia misma de Supabase como proveedor de autenticación es una decisión técnica (`P1`), no una decisión de negocio. Se documenta aquí, sin Rule ID, únicamente para que el catálogo no quede mudo sobre un flujo que sí va a existir en código — es una excepción explícita a la convención "todo flujo cita un Rule ID", justificada porque su origen es técnico, no de negocio. Detalle completo en `ADR-024`.
- **(e) `FL-SEG-07`:** respaldo firme — `RN-SEG-02` (`Estado: Aprobada`, Critical). El **mecanismo** concreto (qué proveedor de segundo factor, cómo se verifica) depende de lo que Supabase Auth exponga — `03-technical-architecture.md` §5.3 ya lo señala como subordinado a esa elección, sin vacío nuevo introducido aquí.
- **(f) `FL-SEG-01`/`FL-SEG-03` — implementados 2026-08-22 con alcance deliberadamente reducido respecto a como se describen arriba.** No crean/editan sucursales del usuario (eso queda en `FL-SEG-04`, sin construir), no integran Supabase Auth (`FL-SEG-06`, sin construir — el usuario creado no puede iniciar sesión hasta que ese flujo exista), no incluyen `estado` ni `mfa_habilitado` en persistencia (pertenecen a `FL-SEG-05`/`FL-SEG-07`). Sí implementan, como regla de seguridad no respaldada por ningún Rule ID sino recomendada y confirmada durante esta iteración: nadie cambia su propio rol; solo Super Admin asigna Super Admin; un actor no-Super-Admin no puede cambiar el rol de un usuario que hoy es Super Admin (`shared/auth/rol.ts`, `puedeAsignarRol`). El invariante "al menos un Super Admin activo" se evaluó y quedó explícitamente sin implementar — riesgo aceptado, documentado, no ratificado.
- **(g) `FL-SEG-04` — implementado 2026-08-22.** A diferencia de `FL-SEG-01`/`FL-SEG-03`, sí aplica nivel 2 de RBAC (`tieneAlcanceSucursal(actor, sucursalId)` sobre la sucursal objetivo, para asignar y remover, incluida auto-asignación) — confirmado explícitamente para esta iteración, no inferido. **Inconsistencia preexistente confirmada, no corregida:** `AsignarManicuristaASucursalUseCase`/`RemoverManicuristaDeSucursalUseCase` (módulo Sucursales y Personal) comparten el mismo riesgo (sin nivel 2) y siguen sin corregirse — pendiente de autorización explícita para una iteración separada. **Pregunta abierta, no resuelta:** si la cuenta de un usuario con rol Manicurista participa de `usuarios_sucursales` directamente o si su alcance se deriva del recurso agendable (`manicuristas_sucursales`) — ver `04-data-model.md` §5.10.
- **(h) `FL-SEG-05` (solo "Desactivar") — implementado 2026-08-23.** `activa: boolean`, no `estado` de texto (mismo precedente que `Manicurista.activa`). Dos restricciones de autorización nivel 2, confirmadas explícitamente: nadie puede desactivarse a sí mismo (anti-lockout, no anti-escalamiento); un actor no-Super-Admin no puede desactivar a un usuario que hoy es Super Admin (mismo criterio jerárquico que `FL-SEG-03`). Idempotente: desactivar dos veces es un no-op exitoso, no un error. **"Reactivar" queda explícitamente fuera de alcance de esta iteración** — tensión de evidencia detectada y documentada, no resuelta a favor de ninguna de las dos: el nombre de este mismo `Flow ID` ("Desactivar / Reactivar") sugería ambas desde que se redactó esta adenda, pero el precedente real de código (`Manicurista` tiene `activar()`/`desactivar()` en la entidad, pero solo `DesactivarManicuristaUseCase` fue construido y expuesto — nunca existió `ActivarManicuristaUseCase`) apunta a construir solo "apagar" primero. Se sigue el precedente de código por instrucción explícita del cliente; el nombre del Flow ID no se cambia. **`activa=false` no revoca acceso efectivo** — ver `04-data-model.md` §5.10, es la limitación más importante de este incremento y queda documentada sin ambigüedad, no como garantía de seguridad real.

**Total actualizado:** 21 → **26 macro-flows** tras esta adenda (15 micro-flows sin cambio, 41 flujos en total). La Sección 3 (matriz de reutilización) y la Sección 4 (verificación cruzada) **no se actualizan** en esta adenda — los cinco flujos nuevos solo reutilizan `FL-AUD-01` (ya reflejado en su propia fila de la Sección 3 como "todos"), sin introducir un grafo de reutilización nuevo que amerite recalcular la matriz completa.

No se reabre este catálogo por refinamiento continuo. La siguiente fase es la redacción detallada de cada flujo (plantilla ya definida en la fase de diseño arquitectónico de esta capa), consumiendo este catálogo como su índice fuente.
