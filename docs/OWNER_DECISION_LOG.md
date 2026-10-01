# Decisiones pendientes de negocio — Blanc

> **Naturaleza de este documento:** contiene exclusivamente preguntas de negocio pendientes de respuesta de la Dueña (o, en un caso, de validación jurídica). No contiene decisiones de arquitectura, no propone Rule IDs nuevos, no diseña máquinas de estado ni modelo de datos — esos temas viven en `ARCHITECTURE_CLOSURE_PLAN.md` y se resuelven por una vía distinta.
> **Fuente exclusiva:** `docs/DISCOVERY_CHECKLIST.md` (respuestas ya dadas por la Dueña el 2026-08-03/04, con el punto exacto que sigue abierto en cada una) y sus "Preguntas implícitas" (Sección 4, nunca antes formuladas). Ninguna pregunta de este documento se inventó — todas ya estaban evidenciadas.
> **Fecha:** 2026-08-04.
> **Cómo usar este documento:** cuando la Dueña responda una pregunta, se marca aquí como `Resuelta` con la fecha y la respuesta textual (sin eliminarse, misma disciplina de trazabilidad que el resto del proyecto), y la propagación hacia el Rule ID/documento afectado se ejecuta como un paso aparte, con su propia auditoría.

---

## Bloqueantes antes de Fase 1

*(Ninguna pregunta de negocio bloquea el **inicio** de Fase 1 — ver `DISCOVERY_CHECKLIST.md` §5.2. Las dos preguntas de esta sección bloquean **completar**, no empezar, un módulo de Fase 1.)*

### Pregunta 11 — Alcance por defecto de `usuarios_sucursales` para roles distintos de Analista y Solo lectura
**Contexto:** `DISCOVERY_CHECKLIST.md` 1.26 / `RN-SEG-03` ya confirmaron que Analista y Solo lectura ven **todas** las sucursales (ausencia de filas en `usuarios_sucursales` = alcance global) — pero esa respuesta se limitó explícitamente a esos dos roles. `04-data-model.md` §5.10 deja constancia de que el `Decision Pending` general para el resto de los roles (Recepcionista, Gerente, Administrador, Manicurista) **no se cierra** con esa respuesta.
**Regla/documento afectado:** `04-data-model.md` §5.10 (`usuarios_sucursales`), `03-technical-architecture.md` §5.2 (RBAC en dos niveles), futuro `05-api-design.md` (claims de token).
**Por qué importa:** es el mismo tipo de ambigüedad que ya generó `PA-19` — sin definirla, un usuario de esos roles sin filas en `usuarios_sucursales` podría interpretarse como "ve todo" o como "no ve nada", con riesgo directo de sobre-exposición o sub-exposición de datos entre sucursales.
**Qué bloquea:** el modelo de permisos **completo** de Fase 1 (mismo criterio que ya bloqueaba `PA-19` antes de resolverse) y la sección de autenticación/claims de `05-api-design.md`.
**Prioridad:** Alta.
**Opciones posibles (sin recomendar una solución):**
- (a) Ausencia de filas = alcance global, igual que ya se confirmó para Analista y Solo lectura, aplicado a todos los roles.
- (b) Ausencia de filas = sin acceso a ninguna sucursal, obligando a asignación explícita para todo rol que no sea Analista/Solo lectura.
- (c) El comportamiento por defecto varía por rol (ej. Super Admin siempre global, Recepcionista siempre requiere asignación explícita).

**Adenda (2026-08-11, hardening transversal del módulo Sucursales y Personal):** verificación de código confirma que esta pregunta ya tiene dos superficies concretas construidas y en producción-lógica hoy, ninguna resuelta formalmente:
- **Escrituras** (`ActualizarConfiguracionSucursalUseCase`, `AgregarDiaFestivoUseCase`, `EliminarDiaFestivoUseCase`) ya invocan `tieneAlcanceSucursal()`, que trata un arreglo `sucursales` vacío como "sin acceso a ninguna sucursal" — es decir, ya implementan de hecho la opción (b) para todo rol no-Super-Admin, sin que la Dueña la haya confirmado. No se revirtió esto en este hardening (no es parte del alcance autorizado), pero queda registrado como una asunción de implementación pendiente de ratificación.
- **Lecturas** (`ListarSucursalesUseCase`, `ConsultarSucursalUseCase`, `ListarManicuristasUseCase` → endpoints `GET /sucursales`, `GET /sucursales/:id`, `GET /manicuristas`) no aplican ningún filtro de alcance — cualquier rol autenticado ve todas las sucursales/manicuristas, lo cual es la respuesta ya correcta para Analista/Solo lectura (RN-SEG-03) pero no tiene base documental para el resto de roles. No se modificó este comportamiento en este hardening.
Ambas superficies quedan bloqueadas en el mismo punto: sin que la Dueña elija (a)/(b)/(c), no hay forma de saber si el comportamiento de escritura ya implementado es el correcto, ni si las lecturas deberían empezar a filtrar.

### Pregunta 3 — RN-COT-04: valores de duración faltantes y significado de "+15 min"
**Contexto:** la Dueña aportó una tabla extensa de combinaciones de duración (2026-08-03), casi completa, más una regla nueva: "retiro de gel con drill se agregan 15 minutos al usar el drill."
**Regla/documento afectado:** `docs/business-rules/02-duracion-cotizacion.md` (`RN-COT-04`), `04-data-model.md` §5.2.
**Por qué importa:** es el Core Domain diferenciador del negocio (motor de cotización); hay dinero real de por medio en cada cálculo.
**Qué bloquea:** no bloquea iniciar Fase 1 (el CRUD de catálogo y el fallback aditivo ya marcado como estimado permiten avanzar) — bloquea dar por **terminado** el motor de duración dentro de Fase 1, antes de operar con cobros reales de precisión total.
**Prioridad:** Alta.
**Opciones posibles (sin recomendar una solución):**
- (a) "+15 min" reemplaza el valor fijo ya recibido para esa combinación con drill.
- (b) "+15 min" es un delta que se suma sobre el valor fijo ya recibido.
- Además, faltan valores numéricos exactos para varias celdas (ej. "Diseño Especial", "SP", "CF", "CC") que hoy solo tienen una descripción cualitativa ("dentro de la hora dependiendo del diseño").

---

## Bloqueantes antes de Fase 2

### Pregunta 2 — Estado `completada` de `Cita`: ¿cuándo se considera oficialmente completada? — ~~Abierta~~ **RESUELTA (2026-09-30)**

> **Respuesta:** opción **(a)** — la transición es **automática por el paso del tiempo**, y además **no emite notificación a la clienta**. Formalizada en `DEC-030` (`PROJECT_STATUS.md` §5); diseño en `FASE_2_AGENDA_ARQUITECTURA.md` §3.
> **Abierto que generó (`N-02`):** `no_show` es manual y `completada` automática, y se pisan — falta decidir entre ventana de gracia o permitir que `no_show` sobrescriba. Afecta a `RN-CRM-06`.
**Contexto:** la Dueña ya confirmó que `no_show` es un disparador **manual** (lo marca un empleado) y que dispara la sugerencia de lista roja si ocurre dentro de los 60-0 minutos antes de la cita. Sobre `completada` dijo textualmente: *"se toma como completado cuando no haya un inconveniente con la cita"* — frase que admite dos lecturas distintas.
**Regla/documento afectado:** `RN-AGE-14` (a crear, `01-agenda.md`), máquina de estados de `Cita` (`01-domain-discovery.md`, en diseño activo), evento de dominio `CitaCompletada`.
**Por qué importa:** es la pregunta de mayor apalancamiento de todo el proyecto — desbloquea en cascada cuatro entregables a la vez (el propio `RN-AGE-14`, el cierre de la máquina de estados de `Cita`, el evento `CitaCompletada`, y la entrada a la Fase de Garantías, que depende de ese evento).
**Qué bloquea:** cierre de la máquina de estados de `Cita` (Fase 0, en curso) y de Fase 2 (Agenda) completa; en cascada, también la Fase de Garantías.
**Prioridad:** Alta.
**Opciones posibles (sin recomendar una solución):**
- (a) `completada` es un estado que el sistema asigna automáticamente por el simple paso del tiempo, si nadie marcó lo contrario (`no_show` u otro).
- (b) `completada` también requiere una acción manual explícita de un empleado, igual que `no_show`.
- (c) Alguna combinación (ej. automático por defecto, pero un empleado puede corregirlo manualmente si hubo un inconveniente).

---

## Bloqueantes antes de Fase 4

### Pregunta 1 — RN-CONV-10: ¿cuándo vuelve el control al bot tras una intervención humana por inactividad?
**Contexto:** ya está resuelto que el retorno de control al bot **siempre requiere una acción explícita de un empleado** cuando el empleado decide devolverlo (`RN-ESC-03`, ya `Aprobada`, no se reabre aquí). Lo que sigue sin resolver es distinto: qué pasa con el `modo` de una conversación después de un período de **inactividad** tras haber escalado a humano — la Dueña confirmó el modelo de identidad de conversación persistente (2026-08-03) pero no este punto específico, y ella misma invitó a repreguntar ("si hay dudas quiero que me las preguntes").
**Regla/documento afectado:** `RN-CONV-10` (`06-conversacion-ia.md`), máquina de estados de `Conversación` (`01-domain-discovery.md`, en diseño activo).
**Por qué importa:** es la ruta directa hacia el peor escenario de negocio ya identificado en la revisión adversarial del proyecto (DM-C: una clienta que escribe y no recibe respuesta de nadie, ni bot ni humano).
**Qué bloquea:** cierre de la máquina de estados de `Conversación` (Fase 0, en curso) y el inicio formal de Fase 4 (Conversación e IA). No bloquea Fases 1-3.
**Prioridad:** Alta (la de mayor riesgo de negocio de esta lista).
**Opciones posibles (sin recomendar una solución):**
- (a) El bot retoma el control automáticamente tras cierto tiempo de inactividad, sin acción humana.
- (b) El `modo` permanece en `humano` indefinidamente hasta que un empleado lo libere explícitamente, sin importar cuánta inactividad pase.
- (c) Algún mecanismo intermedio (ej. aviso al empleado tras N horas de inactividad, sin cambiar el `modo` automáticamente).
*(Pregunta puntual ya redactada en `RN-CONV-10`: "¿qué debe pasar con el modo humano/bot si pasó mucho tiempo de inactividad: el bot retoma el control solo, o siempre requiere que un empleado lo libere explícitamente?")*

### Pregunta 5 — RN-SUC-04: modelo de Google Calendar
**Contexto:** la Dueña confirmó que las sucursales se diferencian por color en Google Calendar (2026-08-03), pero no confirmó el modelo técnico exacto detrás de esa diferenciación.
**Regla/documento afectado:** `RN-SUC-04` (`09-sucursales-configuracion.md`), `04-data-model.md` §5.9 (`calendario_google_id`).
**Por qué importa:** determina el diseño del adaptador de Sincronización de Calendario (Anti-Corruption Layer).
**Qué bloquea:** Fase 4 (Sincronización de Calendario) — no bloquea Fases 1-3.
**Prioridad:** Media.
**Opciones posibles (sin recomendar una solución):**
- (a) Cada sucursal tiene su propio calendario de Google independiente, diferenciado por color.
- (b) Todas las sucursales comparten un único calendario de Google, y el color solo las distingue visualmente dentro de él.
*(Pregunta puntual ya redactada en `RN-SUC-04`: "¿Cada sucursal tiene su propio calendario de Google, o todas comparten un mismo calendario y el color solo las distingue visualmente dentro de él?")*

---

## Importantes pero no bloqueantes

### Pregunta 4 — Baja de manicurista: ¿qué ocurre con sus citas futuras ya asignadas? — ~~Abierta~~ **RESUELTA (2026-09-30)**

> **Respuesta:** opción **(a)** — **bloqueo duro**: el sistema lanza excepción si la manicurista tiene citas futuras. Nada se cancela ni reasigna automáticamente. Formalizada en `DEC-032`; diseño en `FASE_2_AGENDA_ARQUITECTURA.md` §4.
> **Nota:** modifica `DesactivarManicuristaUseCase`, ya implementado en Fase 1 y que hoy no verifica nada. Requiere un puerto entre Bounded Contexts (Agenda → Sucursales y Personal), no un `JOIN`.
> **Abierto que generó (`N-04`):** qué estados cuentan como "cita futura".
**Contexto:** nunca se le formuló esta pregunta a la Dueña — es una "pregunta implícita" que el proyecto está asumiendo de facto sin haberla registrado nunca (`DISCOVERY_CHECKLIST.md` §4.3).
**Regla/documento afectado:** nuevo Rule ID en `docs/business-rules/09-sucursales-configuracion.md` (no creado — requiere tu autorización aparte, ver Grupo B).
**Por qué importa:** sin definición, el cálculo de disponibilidad puede quedar con citas "huérfanas" sin comportamiento definido.
**Qué bloquea:** no bloquea iniciar Fase 1 — debe resolverse antes de dar el módulo Sucursales y Personal por terminado.
**Prioridad:** Media.
**Opciones posibles (sin recomendar una solución):**
- (a) Se bloquea la baja de la manicurista hasta que sus citas futuras se reasignen manualmente.
- (b) Las citas futuras se cancelan automáticamente al dar de baja.
- (c) Las citas quedan pendientes de gestión manual, sin bloquear la baja ni cancelar automáticamente.

### Pregunta 6 — Capacidad real de recepción humana ante escalamiento masivo
**Contexto:** la Dueña ya definió los requisitos funcionales del mecanismo de degradación (notificar al responsable, visibilidad del estado/causa, posibilidad de volver a modo IA) — pero no hay un dato real de si el personal de cada sucursal puede absorber que *todas* las conversaciones activas escalen a la vez si el proveedor de IA falla.
**Regla/documento afectado:** ninguno de arquitectura — es un dato de validación operativa (`03-technical-architecture.md` §7.2, nota F-05).
**Por qué importa:** si el dato real es "no puede absorberlo", el mecanismo de degradación priorizada necesita calibrarse distinto.
**Qué bloquea:** no bloquea construir el mecanismo (ya diseñado funcionalmente) — bloquea **operar en producción con confianza** (Fase 7).
**Prioridad:** Media, no urgente para desarrollo.
**Opciones posibles:** no aplica — esta pregunta requiere un dato real de capacidad operativa de cada sucursal, no una elección entre alternativas de diseño.

### Pregunta 7 — Validación legal del marco regulatorio de datos personales
**Contexto:** la Dueña registró una postura informal ("no por el momento, que yo sepa") — explícitamente no es una validación jurídica formal.
**Regla/documento afectado:** `RN-AUD-02` (`11-auditoria-cumplimiento.md`), `04-data-model.md` §8 (plazos de retención).
**Por qué importa:** condiciona los plazos exactos de retención de datos personales (fotos, teléfonos, hábitos de consumo).
**Qué bloquea:** no bloquea construir ningún módulo (ya hay postura conservadora de minimización adoptada) — bloquea operar con clientas reales (Fase 7) sin ese riesgo legal sin resolver.
**Prioridad:** Media (por el tipo de riesgo, no por urgencia de calendario).
**Opciones posibles:** no aplica — **esta pregunta la debe responder un abogado especializado en protección de datos, con validación final de la Dueña, no la Dueña sola** (así lo señala la propia regla desde su origen).

### Pregunta 8 — Presupuesto de mensajería de WhatsApp y límite de gasto de IA
**Contexto:** la Dueña aplazó explícitamente esta pregunta ("por el momento no está decidido, se va a decidir después").
**Regla/documento afectado:** enmienda candidata a `ADR-007`/`ADR-011` (no creada — ver Grupo B).
**Por qué importa:** sin un número real, el gasto de IA/WhatsApp no está verdaderamente acotado en producción.
**Qué bloquea:** nada — el mecanismo técnico de límite y degradación ya está diseñado (`03-technical-architecture.md` §6.5); solo falta fijar la cifra.
**Prioridad:** Baja.
**Opciones posibles:** no aplica — requiere un número concreto de presupuesto, no una elección entre alternativas de diseño.

### Pregunta 9 — RN-CONV-08: umbral exacto de "cliente molesto"
**Contexto:** la Dueña aplazó explícitamente esta pregunta ("estas se definen después, sin definir").
**Regla/documento afectado:** `RN-CONV-08` (`06-conversacion-ia.md`).
**Por qué importa:** un umbral mal calibrado genera falsos positivos (escalamiento innecesario) o falsos negativos (clienta molesta sin atención).
**Qué bloquea:** nada — ya hay un supuesto provisional vigente (sentimiento del modelo + palabras clave genéricas), ajustable con datos reales del golden set.
**Prioridad:** Baja.
**Opciones posibles:** no aplica — requiere palabras clave/umbrales específicos del negocio, no una elección entre alternativas de diseño.

### Pregunta 10 — Reconfirmación de FIFO estricto en lista de espera
**Contexto:** la Dueña confirmó FIFO para la prioridad general de agenda (`RN-AGE-13`, 2026-08-03: "el primero que conteste"), pero esto se infiere por consistencia para la lista de espera específicamente (`RN-AGE-07`) — nunca se confirmó de forma literal para ese caso.
**Regla/documento afectado:** `RN-AGE-07` (`01-agenda.md`).
**Por qué importa:** confirma si el mismo criterio aplica sin excepción a la lista de espera.
**Qué bloquea:** nada — FIFO ya es el comportamiento documentado, esto es solo una reconfirmación pendiente de menor riesgo.
**Prioridad:** Baja.
**Opciones posibles (sin recomendar una solución):**
- (a) FIFO estricto, igual que el resto de la agenda.
- (b) Existe algún criterio de prioridad distinto (ej. VIP) específicamente para la lista de espera.

---

## Resumen de conteo

| Bucket | Preguntas |
|---|---|
| Bloqueantes antes de Fase 1 (completar, no iniciar) | 2 (Preguntas 3 *parcial*, 11) |
| Bloqueantes antes de Fase 2 | ~~1~~ **0** — Pregunta 2 resuelta (`DEC-030`) |
| Bloqueantes antes de Fase 4 | 2 (Preguntas 1, 5) |
| Importantes, no bloqueantes | ~~6~~ **5** — Pregunta 4 resuelta (`DEC-032`) |
| **Total original** | **11** — 2 resueltas el 2026-09-30, 1 parcialmente (Pregunta 3 vía `DEC-033`) |

**Actualización 2026-09-30 — ronda de respuestas de la Dueña.** Se resolvieron las Preguntas 2 y 4,
y parcialmente la 3 (`DEC-033` cierra el hueco de las celdas sin valor numérico; la ambigüedad del
"+15 min" y la recuperación de la tabla original siguen abiertas). Se resolvió además **`P4`** de
`ARCHITECTURE_CLOSURE_PLAN.md` (capacidad sin manicurista → `DEC-031`), que **nunca figuró entre
estas 11 preguntas** pese a bloquear Fase 2 y requerir decisión de negocio — el hueco de
catalogación que ya se había señalado al extraer los bloqueos para el documento ejecutivo.

**Cuatro preguntas nuevas** (`N-01`..`N-04`) nacieron de estas respuestas; viven en
`PROJECT_STATUS.md` §14.3 y en `FASE_2_AGENDA_ARQUITECTURA.md` §8.
