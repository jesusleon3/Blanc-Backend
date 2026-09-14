# Revisión Crítica del Catálogo de Decision Flows — Perspectiva de Plataforma

> **Rol asumido para este documento:** arquitecto externo contratado para encontrar defectos en `docs/decision-flows-catalogo-diseno.md`, no para confirmarlo. Mismo estándar adversarial que `ARCHITECTURE_REVIEW.md` y `DOMAIN_MODEL_REVIEW.md` — hallazgos reales, no cosméticos, con intento explícito de refutación en cada uno.
> **Alcance:** el catálogo de 17 macro-flows y 16 micro-flows (uno, `FL-SEG-02`, ya marcado candidato a exclusión) propuesto en el documento de diseño. No modifica ese documento — es un insumo de revisión previo a decidir si se corrige antes de congelar.
> **Ángulo exigido:** revisar el catálogo también como la infraestructura reutilizable de una futura plataforma multi-negocio (ADR-009), no solo como el modelo operativo de Blanc.

---

## 1. ¿Algún macro-flow debería dividirse en dos procesos independientes?

**Sí — encontré un patrón que apliqué de forma inconsistente en el propio catálogo.**

Ya había separado `FL-ANT-01` (Liberar Horario por Anticipo No Pagado) y `FL-NOT-02` (Enviar Recordatorio) como macro-flows propios, precisamente porque su disparador es un job programado, no una conversación — un principio correcto que **no apliqué a otros dos flujos que tienen exactamente la misma estructura**:

- **`FL-AGE-02` (Reagendar por Cambio de Horario)** mezcla dos responsabilidades con disparadores de naturaleza distinta: (a) *registrar* la solicitud de aviso — síncrono, dentro de una conversación — y (b) *reaccionar* cuando se libera un horario compatible — asíncrono, disparado por un evento de dominio (`HorarioDesbloqueado`). Cambiar la política de registro no tiene por qué afectar la política de oferta, y viceversa — son dos razones de cambio distintas.
- **`FL-AGE-04` (Atender Lista de Espera)** tiene el mismo problema exacto: registrar en la lista (síncrono) vs. notificar y convertir cupo liberado (asíncrono).

**Recomendación:** dividir ambos en su componente síncrono y asíncrono, igual que ya hice con Anticipos/Notificaciones:
- `FL-AGE-02` → `FL-AGE-02a` (Activar Solicitud de Cambio de Horario) + `FL-AGE-02b` (Ofrecer y Confirmar Cambio de Horario, disparado por evento).
- `FL-AGE-04` → `FL-AGE-04a` (Registrar en Lista de Espera) + `FL-AGE-04b` (Notificar y Convertir Cupo Liberado, disparado por evento).

**Un segundo hallazgo real:** `FL-CRM-02` (Clasificar Cliente: VIP / Lista Roja / Bloqueada) agrupa **tres políticas con actores, disparadores y consecuencias distintas** bajo un solo nombre: reconocimiento (VIP, sin lógica de negocio real detrás — ningún Rule ID gobierna su criterio), mitigación de riesgo (lista roja, `RN-CRM-05/06/07`), y restricción punitiva (bloqueo, `RN-CRM-04`). Esto es exactamente el "God flow" que el catálogo debería evitar.

**Recomendación:** dividir en `FL-CRM-02` (Marcar/Desmarcar Lista Roja) y `FL-CRM-02b` (Bloquear/Desbloquear Cliente); **cuestionar si "marcar VIP" necesita un Decision Flow propio** — no hay ningún Rule ID que gobierne su criterio, es un cambio de atributo sin bifurcación de negocio (comparable a por qué `Reportes` no tiene flujos).

**Un tercer hallazgo, con relevancia directa de plataforma:** `FL-SUC-01` (Configurar Sucursal) mezcla configuración rutinaria y de bajo riesgo (horario, festivos) con un evento raro y de alto impacto (aprovisionar el número de WhatsApp, que involucra a un BSP externo, ADR-008). Ver Sección 4 — este hallazgo se conecta con una capacidad que falta por completo en el catálogo.

---

## 2. ¿Algún micro-flow todavía hace más de una cosa?

**Sí — el hallazgo más importante de toda esta revisión: `FL-CRM-04`.**

Mi propia descripción en el catálogo dice: *"Consultar si la clienta es normal/VIP/lista roja/bloqueada, **y activar la política correspondiente**"*. Eso son dos responsabilidades: una consulta de estado (lectura) y una acción con efecto (escritura/orquestación). Un micro-flow de consulta no debería decidir qué hacer con el resultado — eso le corresponde al macro-flow que lo invoca. Mezclar ambas cosas es precisamente el anti-patrón que el principio de separación consulta/comando (presente en el espíritu de SOLID — Single Responsibility — que gobierna este proyecto según `02-architecture-principles.md` §5) busca evitar.

**Recomendación:** reducir `FL-CRM-04` a una consulta pura ("Consultar Clasificación de Cliente"), sin ninguna acción embebida. Cada macro-flow que lo invoque decide, con esa información, qué hacer a continuación (ver Sección 4 para dónde debería vivir esa decisión).

**Un segundo caso, revisado y **deliberadamente no corregido**:** `FL-COT-02` (Calcular Cotización) mezcla el cálculo puro del precio (`RN-COT-03`, `RN-COT-07`) con la resolución de qué precio usar (`RN-COT-08`, override por sucursal) y con la vigencia temporal de la cotización (`RN-COT-09`). En rigor, son tres responsabilidades. **No recomiendo dividirlo todavía**: ambas reglas adicionales (`RN-COT-08`, `RN-COT-09`) siguen `Faltante`/`Decision Pending` — no tienen lógica real que orquestar. Dividir un micro-flow para separar una responsabilidad que hoy no existe como comportamiento confirmado sería sobre-diseño especulativo, exactamente lo que este proyecto ya decidió evitar en otros casos (ver `HANDOFF.md` §7, Intento 2). Marco esto como watch-item: revisar la división en cuanto `RN-COT-08`/`RN-COT-09` se resuelvan.

---

## 3. ¿Algún micro-flow con reutilización demasiado baja para justificar su existencia?

Repasé los tres micro-flows con un solo consumidor declarado (`FL-COT-02`, `FL-ANT-03`, `FL-ANT-04`) con más rigor que en el primer borrador:

- **`FL-COT-02` y `FL-ANT-03` en realidad tienen más de un consumidor** — el catálogo original lo subestimó. `FL-AGE-02` (Reagendar), si la clienta cambia la composición del servicio al aceptar el nuevo horario, también necesita recalcular cotización — y si esa clienta es lista roja, también necesita re-evaluar el anticipo. La matriz de reutilización del documento de diseño ya reflejaba esto para `FL-COT-01` pero **no** para `FL-COT-02` — es una inconsistencia de mi propia matriz, ya corregida en la Sección 6 de este documento.

- **`FL-ANT-04` (Reembolsar Anticipo) sí es un candidato real a eliminación.** Un solo consumidor (`FL-AGE-03`), y la regla que orquesta (`RN-ANT-04`) está `Asumida, no documentada` — no existe ningún criterio de negocio confirmado detrás. Mantenerlo como micro-flow propio hoy es documentar una capacidad sin contenido real. **Recomiendo fusionarlo como paso en línea dentro de `FL-AGE-03`**, y solo volver a extraerlo como micro-flow independiente si `RN-ANT-04` se resuelve y aparece un segundo consumidor real (ej. una pantalla de administración de reembolsos).

---

## 4. ¿Alguna capacidad reutilizable escondida dentro de un macro-flow?

Encontré tres, una de ellas con impacto directo en el roadmap real de Blanc (no hipotético):

**a. La verificación de anticipo debería vivir dentro de `Confirmar Cita`, no repetirse en cada macro-flow que confirma.** Hoy, `FL-AGE-01`, `FL-AGE-04` (y, tras la división de la Sección 1, `FL-AGE-02b`) cada uno orquesta independientemente "consultar clasificación → si lista roja, solicitar anticipo" antes de invocar `FL-AGE-08` (Confirmar Cita). Pero `RN-ANT-02` es literal: *"una cita que requiere anticipo no se considera confirmada en firme hasta que el pago quede registrado"* — esto es una propiedad de **qué significa confirmar**, no un paso opcional que cada flujo llamante debe acordarse de incluir. Si mañana aparece un cuarto flujo que confirma una cita (plausible: conversión directa de una oferta de garantía en una nueva cita, por ejemplo) y su autor olvida repetir la verificación, el invariante de negocio se rompe silenciosamente.

  **Recomendación:** `FL-AGE-08` (Confirmar Cita) debe invocar internamente `FL-CRM-04` (ya reducido a consulta pura, Sección 2) y, condicionalmente, `FL-ANT-03`, como parte de su propia responsabilidad — no como algo que cada macro-flow orquesta por separado. Esto resuelve, de paso, el hallazgo de reutilización baja de la Sección 3: en vez de tres macro-flows reutilizando dos micro-flows cada uno, hay un único punto de verdad (`FL-AGE-08`) que lo garantiza siempre.

**b. Falta por completo una capacidad de "dar de alta una sucursal nueva" — y no es hipotético.** El catálogo tiene `FL-SUC-01` (Configurar Sucursal, implícitamente una sucursal ya existente) pero ninguna entrada para crear una sucursal desde cero. `HANDOFF.md` §1 ya dice explícitamente que Blanc tiene **una cuarta sucursal prevista** — esto no es una especulación de plataforma futura, es un evento real y cercano del propio negocio actual. Además, es exactamente el tipo de flujo donde se concentraría la reutilización real si aparece un segundo negocio bajo el modelo Silo de ADR-009 (aprovisionar una nueva instancia empieza, casi siempre, dando de alta su primera "sucursal"/ubicación).

  **Recomendación:** agregar `FL-SUC-04` (Dar de Alta Nueva Sucursal) al catálogo, que reutiliza como micro-flow el aprovisionamiento de WhatsApp que hoy está enterrado dentro de `FL-SUC-01` (ver Sección 1, tercer hallazgo) — separarlo ahí no solo corrige la cohesión de `FL-SUC-01`, habilita esta capacidad que faltaba.

**c. `RN-ESC-02` (revalidar modo antes de cada respuesta del bot) está enterrado dentro de `FL-ESC-02`, pero su disparador real es "cada vez que la IA está por responder en cualquier conversación" — no solo dentro de un ticket de escalamiento ya creado.** Tal como está catalogado hoy, `FL-AGE-01/02/03/04` y `FL-GAR-01` no declaran ningún paso que revalide el modo antes de que el bot responda — implícitamente asumen que nunca hay una conversación en modo `humano` mientras se ejecutan, lo cual es exactamente el escenario que `RN-ESC-02` existe para prevenir.

  **Recomendación:** extraer un nuevo micro-flow transversal, `FL-CONV-04` (Revalidar Modo de Conversación Antes de Responder), reutilizado por todos los macro-flows conversacionales — al mismo nivel que `FL-CONV-01/02/03`, no anidado dentro de Escalamiento.

---

## 5. Clasificación de reutilización para una futura segunda instancia (ADR-009, modelo Silo)

Aplicando el criterio de forma honesta (no todo lo que suena genérico lo es, no todo lo que suena específico de Blanc lo es) al catálogo ya corregido con los hallazgos anteriores:

### Reutilizable sin cambios (la forma del flujo es agnóstica de industria)

| Flow ID | Por qué |
|---|---|
| FL-AGE-05 (Bloquear Horario/Festivo) | Bloquear tiempo de la disponibilidad es mecánica de agenda pura, sin vocabulario de negocio |
| FL-AGE-07 (Validar Disponibilidad) | Motor de disponibilidad genérico |
| FL-AGE-10 (Sincronizar con Google Calendar) | La elección de proveedor (Google) es decisión de plataforma (ADR-006), no de negocio |
| FL-CRM-01 (Registrar Cliente) | Identidad global por teléfono es un patrón universal de CRM multi-sucursal |
| FL-CRM-02b (Bloquear/Desbloquear Cliente) | Restricción punitiva por mal comportamiento es universal |
| FL-CRM-03 (Gestionar Etiquetas) | Etiquetado de texto libre es CRM genérico |
| FL-CRM-04 (Consultar Clasificación, tras Sección 2) | Una consulta de estado no tiene contenido de negocio propio |
| FL-ESC-02 (Atender Ticket de Escalamiento) | Mecánica de handoff humano/IA, sin vocabulario de negocio |
| FL-SUC-01 (Configurar Horario/Festivos, tras Sección 1) | Configuración de agenda por ubicación es universal |
| FL-SUC-02 (Modo Mantenimiento) | Kill-switch operativo genérico |
| FL-SUC-03 (Gestionar Personal) | Separar recurso agendable de cuenta de usuario aplica a cualquier negocio con personal agendable |
| FL-SUC-04 (Dar de Alta Sucursal, nueva) | Es, literalmente, el mecanismo de onboarding de una ubicación/instancia |
| FL-CONV-02 (Clarificar Ambigüedad) | Mecanismo conversacional puro |
| FL-CONV-04 (Revalidar Modo, nueva) | Mecanismo de handoff puro, sin contenido de negocio |
| FL-ESC-01 (Escalar a Humano) | Mecanismo de escalamiento genérico |
| FL-NOT-01 (Enviar Notificación) | Mecanismo de envío genérico (WhatsApp es decisión de plataforma, ADR-008) |
| FL-AUD-01 (Registrar Auditoría) | Mecanismo de auditoría completamente genérico |

### Reutilizable con configuración (la forma se mantiene, los parámetros/taxonomía cambian por industria)

| Flow ID | Qué cambiaría |
|---|---|
| FL-AGE-01 (Agendar Cita Nueva) | La orquestación es universal; el motor de cotización que invoca es específico (ver abajo) |
| FL-AGE-02a/b (Cambio de Horario) | Patrón genérico de "mejora de reserva"; ventana de espera es configurable |
| FL-AGE-03 (Cancelar Cita) | Patrón genérico; el criterio de "cliente de riesgo" es configurable |
| FL-AGE-04a/b (Lista de Espera) | Patrón genérico de reservas; orden/prioridad es configurable |
| FL-AGE-08 (Confirmar Cita, ampliado) | Patrón genérico de confirmación con depósito condicional |
| FL-AGE-09 (Resolver Conflicto de Disponibilidad) | El concepto de "recurso exclusivo" es genérico; "manicurista" es la instancia de Blanc |
| FL-COT-03 (Gestionar Catálogo) | CRUD de catálogo es universal; el contenido del catálogo no |
| FL-ANT-01 (Liberar Horario por Anticipo) | Patrón de hold-and-release universal en sistemas de reserva |
| FL-ANT-03 (Solicitar y Retener Anticipo) | Patrón genérico; el criterio de activación (lista roja) es configurable |
| FL-GAR-01 (Gestionar Garantía) | Patrón de reclamos/garantías común a cualquier servicio; ventana de 7 días y "producto aplicado" son parámetros de Blanc |
| FL-CRM-02 (Lista Roja, tras Sección 1) | Patrón de clasificación de riesgo común (también visto en no-show de restaurantes); umbral configurable |
| FL-NOT-02 (Recordatorio Programado) | Patrón universal; el contenido de cortesía es específico por negocio |
| FL-SEG-01 (Gestionar Usuario y Rol) | Mecánica RBAC genérica; el catálogo de 7 roles es dato de instancia (ya señalado en `RN-SEG-01`) |
| FL-CONV-01 (Interpretar Intención) | Mecanismo LLM genérico; el esquema de intenciones es configurable por industria |
| FL-CONV-03 (Detectar Señal de Escalamiento) | Mecanismo genérico; lista de palabras y disparadores son configurables |

### Específico de Blanc (la forma misma del flujo no es portable)

| Flow ID | Por qué no generalizar (todavía) |
|---|---|
| FL-COT-01 (Calcular Duración de Servicio Compuesto) | La lógica de "categoría de retiro + tabla de combinaciones" es intrínsecamente el modelo operativo de un salón de manicura — un negocio distinto (ej. una clínica) tendría un motor de duración con una forma completamente distinta, no solo valores distintos |
| FL-COT-02 (Calcular Cotización) | Depende de `ComposicionPorUña`, ya marcado explícitamente en `RN-COT-03` como "permanece deliberadamente específico de Blanc" |

**Lectura honesta del resultado:** de ~31 flujos corregidos, solo **2** son genuinamente intransferibles — exactamente el Core Domain diferenciador que el propio Domain Discovery ya identificó (§3: "Motor de Cotización y Composición de Servicios"). Esto es evidencia concreta, no una afirmación de fe, de que el principio "generalizar la plataforma, no el negocio" se cumple en este catálogo: la inmensa mayoría de los flujos son reutilizables tal cual o con configuración: la complejidad específica de Blanc está correctamente concentrada en un lugar pequeño y ya identificado, no dispersa por todo el catálogo.

---

## 6. Cohesión, acoplamiento, SRP y violaciones de principio — flujo por flujo

Evaluado sobre el catálogo **original** (pre-correcciones de este documento), para que cada fila explique exactamente por qué generó un hallazgo arriba.

### Macro-flows

| Flow ID | Cohesión | Acoplamiento | ¿SRP? | ¿Viola algún principio? |
|---|---|---|---|---|
| FL-AGE-01 | Alta | Alto (13 micro-flows) — esperado en el Core Domain | Sí | No |
| FL-AGE-02 | **Media** — mezcla registro síncrono y reacción a evento | Alto | **No** — dos razones de cambio | Inconsistente con el patrón ya aplicado en FL-ANT-01/FL-NOT-02 |
| FL-AGE-03 | Alta | Medio-Alto | Sí | No |
| FL-AGE-04 | **Media** — mismo problema que FL-AGE-02 | Medio | **No** | Misma inconsistencia interna |
| FL-AGE-05 | Alta | Bajo | Sí | No |
| FL-COT-03 | Alta | Bajo | Sí | No |
| FL-ANT-01 | Alta | Medio | Sí | No |
| FL-GAR-01 | Alta | Medio | Sí | No |
| FL-CRM-01 | Alta | Bajo | Sí | No |
| FL-CRM-02 | **Baja** — tres políticas distintas | Medio | **No** — al menos tres razones de cambio | Reproduce a nivel de flujo el anti-patrón que Vertical Slice Architecture (ADR-002) evita a nivel de código |
| FL-CRM-03 | Alta | Bajo | Sí | No |
| FL-ESC-02 | Alta | Bajo-Medio | Sí | No |
| FL-NOT-02 | Alta | Bajo | Sí | No |
| FL-SUC-01 | **Media** — configuración rutinaria + aprovisionamiento excepcional | Bajo | **No** | Inconsistente con la disciplina de "una razón de cambio" del resto del catálogo |
| FL-SUC-02 | Alta | Bajo | Sí | No |
| FL-SUC-03 | Alta | Bajo | Sí | No |
| FL-SEG-01 | Alta (alta+rol+MFA son un solo evento de negocio) | Bajo | Sí | No |

### Micro-flows

| Flow ID | Cohesión | Acoplamiento | ¿SRP? | ¿Viola algún principio? |
|---|---|---|---|---|
| FL-AGE-07 | Alta | Bajo (hoja) | Sí | No |
| FL-AGE-08 | Alta (revalidar+congelar es un solo evento atómico; subirá su acoplamiento tras absorber la Sección 4a, sin perder cohesión) | Bajo hoy, Medio tras la Sección 4a | Sí | No |
| FL-AGE-09 | Alta | Bajo | Sí | No |
| FL-AGE-10 | Alta | Bajo | Sí | No — su cruce hacia Sincronización de Calendario es exactamente el rol de Anti-Corruption Layer ya asignado en `02-architecture-principles.md` §2 |
| FL-COT-01 | Alta | Bajo | Sí | No |
| FL-COT-02 | **Media** — cálculo + resolución de override + vigencia | Bajo | Cuestionable, deliberadamente no corregido (Sección 2) | No, si se documenta la razón de no dividir |
| FL-ANT-03 | Alta | Bajo | Sí | No |
| FL-ANT-04 | Alta en sí mismo, pero **injustificado como flujo propio** | Bajo (1 consumidor) | Técnicamente sí, pero sin contenido real que orquestar | Viola el propio umbral de extracción que el catálogo se impuso |
| FL-CRM-04 | **Media** — consulta + activación de política | Medio (3 consumidores) | **No** — dos razones de cambio | Inconsistente con la separación consulta/comando que SOLID (S) ya exige en `02-architecture-principles.md` §5 |
| FL-CONV-01 | Alta | Bajo | Sí | No |
| FL-CONV-02 | Alta | Bajo | Sí | No |
| FL-CONV-03 | Alta | Bajo-Medio (fan-in de 6) | Sí | No |
| FL-ESC-01 | Alta | Bajo (hoja, por diseño) | Sí | No |
| FL-NOT-01 | Alta | Bajo (hoja, por diseño) | Sí | No |
| FL-AUD-01 | Alta | Bajo (hoja, por diseño) | Sí | No |
| FL-SEG-02 | Alta, pero de naturaleza técnica, no de negocio | Bajo | Sí, pero **cuestionable que deba existir como Decision Flow** | No orquesta una decisión de negocio — orquesta un guard de infraestructura (ADR-010) |

---

## 7. Oportunidades de simplificación

Siendo honesto: la mayoría de las correcciones de esta revisión **no reducen** el número de flujos — lo aumentan ligeramente (dividir `FL-AGE-02`, `FL-AGE-04`, `FL-CRM-02`; agregar `FL-SUC-04`, `FL-CONV-04`). Esto es intencional: "simplificar" aquí significa reducir la duplicación de **orquestación** (la misma lógica repetida en varios lugares), no minimizar el conteo de documentos. Señalo esto explícitamente porque pediste no generar más documentación de la necesaria, y quiero ser claro en el trade-off:

**Elimina documentación (2 flujos menos):**
- `FL-ANT-04` se fusiona dentro de `FL-AGE-03` (Sección 3).
- `FL-SEG-02` se excluye del catálogo, queda como precondición citada (Sección 6, ya recomendado en el documento de diseño anterior).

**Añade documentación, pero elimina duplicación real (4 flujos más, netos):**
- División de `FL-AGE-02` y `FL-AGE-04` (2 flujos adicionales cada uno = 2 netos).
- `FL-SUC-04` (nuevo, cubre un hueco funcional real, no complejidad accidental).
- `FL-CONV-04` (nuevo, extrae una capacidad que ya existía escondida — no es lógica nueva).
- División de `FL-CRM-02` (1 flujo adicional neto).

**Unificaciones consideradas y rechazadas, con justificación:**
- ¿Unificar `FL-CRM-02b` (Bloqueo) con `FL-CRM-03` (Etiquetas)? No — cohesión y consecuencia de negocio distintas (bloqueo impide agendar, etiquetas es informativo).
- ¿Unificar `FL-SUC-02` (Mantenimiento) con `FL-SUC-01` (Configurar Sucursal)? No — actor (Super Admin exclusivo vs. Administrador), disparador y frecuencia distintos.
- ¿Unificar Lista de Espera y Cambio de Horario en un solo macro-flow, dado que ambos son "esperar un cupo que se libera"? Ver Sección 8 — deliberadamente rechazado, con la razón ya registrada en el propio Domain Discovery.

**Neto:** el catálogo pasa de 33 flujos (17 macro + 16 micro) a **35** (20 macro + 15 micro, tras sumar 5 nuevos/divididos y restar 2). Más documentos, pero cada uno más angosto y sin lógica repetida — el trade-off correcto dado que este catálogo está diseñado para escalar a cientos de flujos, donde la duplicación de orquestación es mucho más cara de corregir que un documento adicional.

---

## 8. Abogado del diablo

Cuatro objeciones, tratadas con la misma seriedad que un hallazgo propio — no las descarto por comodidad.

**"Este catálogo de documentación (73 reglas + 35 flujos) para un negocio de 3-4 sucursales sin una sola línea de código en producción es sobre-ingeniería documental. `02-architecture-principles.md` §1.3 dice explícitamente 'simplicidad proporcional a la escala real, no a la escala aspiracional' — ¿este catálogo está calibrado a Blanc o a una plataforma SaaS que todavía no tiene un segundo cliente?"**
Respuesta honesta: el costo de este trabajo es puramente de diseño (no hay código que mantener todavía), y la complejidad que documenta ya existía dispersa — el motor de duración por combinación, los 7 roles, las garantías, ya estaban ahí antes de este catálogo, solo que sin un lugar único no duplicado para consultarlos. El riesgo real no es que el catálogo sea innecesario — es que **se quede solo en documentación**. Recomiendo que, una vez congelado, al menos un flujo (el candidato natural: `FL-AGE-01`) se implemente en código pronto después, como validación contra la realidad, en vez de escribir los 35 flujos completos antes de que exista una sola línea de backend.

**"¿Qué garantiza que no hay 3 o 4 patrones de duplicación similares a los de la Sección 4 que todavía no has visto, y que en 6 meses, con 200 flujos, sean mucho más caros de corregir?"**
Nada lo garantiza — esta revisión, por rigurosa que sea, no es una prueba de completitud. Recomiendo una salvaguarda de gobernanza permanente, no solo esta única puerta antes de congelar: una auditoría de cohesión periódica (mismo espíritu que `ARCHITECTURE_REVIEW.md`/`DOMAIN_MODEL_REVIEW.md` ya establecieron como práctica de este proyecto) cada vez que el catálogo crezca en un umbral fijo (propongo cada 15-20 flujos nuevos), no solo una vez al congelar.

**"Lista de Espera y Cambio de Horario resuelven el mismo problema de fondo — notificar a una candidata cuando se libera un cupo. ¿Por qué son macro-flows separados en vez de uno solo con dos modalidades de entrada?"**
Objeción tomada en serio, y **rechazada deliberadamente**: esta separación ya fue evaluada y decidida a nivel de dominio, no la estoy inventando aquí. `ARCHITECTURE-HANDOFF.md` §10 documenta explícitamente que separar `SolicitudDeCambioDeHorario` de `ListaDeEsperaEntrada` fue "la decisión más cercana a un empate real de todo el proceso de diseño" — se mantuvo separado porque `ListaDeEsperaEntrada` nunca fue pensada para proteger una cita con anticipo/garantía ya asociados, que es exactamente el caso de Cambio de Horario. Los flujos correctamente reflejan una separación de aggregates ya cerrada — unificarlos aquí reabriría esa decisión sin la "contradicción objetiva y demostrable" que el proyecto exige para reabrir algo así.

**"`FL-CONV-04` se invoca literalmente en cada turno de cada conversación — eso no es una capacidad de negocio reutilizable, es middleware técnico. ¿Por qué está en Decision Flows y no en ADR-016 como interceptor de aplicación?"**
Distingo esto de `FL-SEG-02` (que sí recomendé excluir) con un criterio explícito: la pregunta correcta no es "¿se invoca en cada turno?" (frecuencia), es "¿aplica un Rule ID con consecuencia real de negocio, ya reconocida como tal?". `FL-CONV-04` aplica `RN-ESC-02`, clasificada `Critical` en el Business Rules Engine precisamente porque protege un invariante de cara a la clienta (nunca contradecir a un humano que ya tomó el control). `FL-SEG-02` no pasa esa prueba — sus reglas subyacentes (`RN-SEG-01/02`) son de autorización interna, sin consecuencia directa hacia la clienta. Mantengo `FL-CONV-04` en el catálogo; mantengo la exclusión de `FL-SEG-02`.

---

## 9. Recomendación final

**Recomiendo pequeños ajustes antes de congelarlo — no está listo tal cual, y tampoco requiere rediseño.**

La arquitectura de fondo (dos niveles, namespace único `FL-XXX-NN` con campo `Tipo`, categorías idénticas al Business Rules Engine, gobernanza de trazabilidad) **no falló ninguna prueba de esta revisión** — ningún hallazgo cuestiona la estructura, todos son ajustes dentro de ella. Lo que sí encontré es una lista acotada y concreta de correcciones, no un problema sistémico:

1. Dividir `FL-AGE-02` en registro (síncrono) + oferta/confirmación (asíncrono).
2. Dividir `FL-AGE-04` en registro (síncrono) + notificación/conversión (asíncrono).
3. Dividir `FL-CRM-02` en Lista Roja + Bloqueo; decidir si "marcar VIP" necesita flujo propio.
4. Separar el aprovisionamiento de WhatsApp fuera de `FL-SUC-01`; agregar `FL-SUC-04` (Dar de Alta Nueva Sucursal).
5. Reducir `FL-CRM-04` a consulta pura; mover la activación de anticipo a `FL-AGE-08`.
6. Eliminar `FL-ANT-04` como flujo propio (fusionar en `FL-AGE-03`).
7. Confirmar la exclusión de `FL-SEG-02` (ya recomendada antes, reforzada aquí con criterio explícito).
8. Agregar `FL-CONV-04` (Revalidar Modo de Conversación), extraído de `FL-ESC-02`.
9. Corregir la matriz de reutilización de `FL-COT-02`/`FL-ANT-03` (tienen más consumidores de los que el catálogo original reconocía).

Con estos nueve ajustes aplicados, el catálogo queda en **20 macro-flows y 15 micro-flows (35 en total)** y, en mi criterio, sí estaría listo para congelarse.
