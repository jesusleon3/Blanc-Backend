# Principios Arquitectónicos — Blanc

> **Fuentes:** `docs/requirements/blanc-requisitos-negocio.md`, `docs/architecture/01-domain-discovery.md`
> **Estado:** Borrador v0.1 — gobierna todas las decisiones técnicas posteriores. Cualquier excepción a estos principios en el código debe justificarse por escrito (ADR) y no por conveniencia puntual.
> **Alcance:** Principios y decisiones estructurales. No hay elección de frameworks/proveedores específicos aquí salvo donde ya fueron mencionados por el cliente como referencia — se marcan explícitamente como "no validado" donde aplica.
> **Actualización 2026-08-04 (propagación parcial, Paso 2 de `MASTER_PROPAGATION_PLAN.md`):** se anotaron dos referencias a Preguntas Abiertas del Domain Discovery ya resueltas para Blanc (§12.1, §12.8) y se agregó el resumen de `ADR-023` a §15, en el mismo formato que las 6 ADRs ya listadas — todo transcripción directa de `DISCOVERY_CHECKLIST.md`/`ADR-023`, sin cambiar ningún principio genérico existente. **La incorporación completa del modelo de 4 capas (Core Platform/Domain Policies/Client Specification/Extension Points) como contenido nuevo, y la actualización de la Nota de Calibración de la Sección 0, quedan pendientes de confirmación sobre dónde y cómo estructurarlas** — ver propuesta en el resumen de esta sesión.

---

## 0. Nota de calibración (inconsistencia detectada)

El encargo inicial de este proyecto lo describiste como *"una plataforma SaaS empresarial"*. El Domain Discovery reveló que en realidad es un **sistema de un solo cliente** (Blanc, 3–4 sucursales), explícitamente no multiempresa. Esto no es un detalle menor: cambia la respuesta correcta a casi todas las preguntas de este documento (monolito vs. microservicios, CQRS, event sourcing, cuántas capas de abstracción se justifican).

Este documento está calibrado para **la escala real descubierta**, no para la aspiración inicial. Interpreto "empresarial" como *nivel de disciplina de ingeniería* (seguridad, auditabilidad, observabilidad, mantenibilidad, capacidad de evolucionar sin reescribir) — no como *complejidad de infraestructura distribuida*. Son dos ejes distintos: se puede construir un sistema de calidad "enterprise" sin la complejidad operativa de un sistema a escala de millones de usuarios. Sobre-diseñar para una escala que no existe es tan negligente como sub-diseñar para una que sí existe — ambas cuestan dinero real del cliente.

Si en el futuro Blanc se convierte en un producto multiempresa (algo que no está descartado — el cliente mencionó crecimiento de sucursales, no de mercado), varias decisiones de este documento tienen marcado explícitamente su "gatillo de revisión".

**Actualización 2026-08-04:** el gatillo de revisión hacia una plataforma multi-cliente que este párrafo anticipaba **ya se activó** — `ADR-023` formaliza el modelo de expansión (Core Platform, Domain Policies, Client Specification, Extension Points — desarrollado en la Sección 17). Esto **no** cambia ninguna de las decisiones de escala de este documento: Modular Monolith, CQRS-lite, sin Event Sourcing, un solo proceso desplegado (Silo, `ADR-009`) siguen vigentes sin modificación para el despliegue actual de Blanc — el modelo de plataforma vive *dentro* de esa arquitectura, no la reemplaza. La calibración de este documento sigue siendo, hoy, la escala real de un cliente.

---

## 1. Principios de diseño rectores

Estos principios son transversales y deben poder citarse como razón de una decisión de diseño en cualquier fase posterior:

1. **La IA interpreta, no decide.** Ya establecido en el Domain Discovery; se reafirma aquí como principio arquitectónico porque tiene implicaciones de diseño concretas (sección 8).
2. **Los límites de Bounded Context son honestos, no solo documentales.** Si el documento de dominio dice que `Agenda` y `Sucursales y Personal` son contextos distintos, el código debe reflejarlo (módulos separados, sin acceso directo a las tablas del otro) — de lo contrario el Domain Discovery fue un ejercicio decorativo.
3. **Simplicidad proporcional a la escala real, no a la escala aspiracional.** Cada patrón de este documento se adopta o se rechaza justificando contra la escala descubierta (sección 0), no contra "lo que hacen las grandes empresas".
4. **Diseñar para poder extraer, no para estar distribuido desde el día 1.** Un monolito modular bien separado se puede partir en servicios el día que la evidencia (no la intuición) lo pida. Empezar distribuido y no necesitarlo es mucho más caro de revertir.
5. **Todo cambio de estado de negocio relevante es un Domain Event**, incluso si hoy se consume en el mismo proceso. Esto ya está determinado por el Domain Discovery (sección 5 de ese documento) y es lo que hace posible el punto 4 sin reescribir lógica de negocio después.
6. **Seguridad y auditabilidad no son una fase, son un requisito transversal desde el primer commit** — coherente con la inversión que el propio cliente pidió explícitamente en seguridad.
7. **Ninguna decisión irreversible se toma sin registrar el tradeoff.** Para eso existen los ADRs (sección 17): decisiones costosas de revertir se documentan con sus alternativas descartadas y por qué.

---

## 2. DDD como base estructural (de estrategia a implementación)

El Domain Discovery ya definió subdominios, bounded contexts, aggregates y domain events. Este documento define **cómo eso se traduce a estructura de código y de despliegue**:

- Cada **Bounded Context** identificado (Agenda, Catálogo y Cotización, Conversación, Escalamiento, Clientas, Anticipos, Sucursales y Personal, Identidad y Accesos, Analítica, Sincronización de Calendario) se implementa como un **módulo con frontera explícita**: expone una API interna (casos de uso) y, opcionalmente, eventos de dominio. No expone sus entidades de persistencia a otros módulos.
- La comunicación entre contextos ocurre **solo** por: (a) invocación explícita de un caso de uso público del otro contexto, o (b) domain events. Nunca por acceso directo a la base de datos de otro contexto (ver sección 12, Principios de Base de Datos).
- El **lenguaje ubicuo se mantiene en español** dentro de cada contexto (`Cita`, `Clienta`, `ListaRoja`, `Anticipo`), tal como aparece en el Domain Discovery. Esto es deliberado: DDD prioriza que el modelo hable el idioma del experto de dominio (el negocio de Blanc), no el idioma "natural" del código en inglés. La única excepción aceptable es la capa de infraestructura pura (nombres de librerías, protocolos), donde el inglés técnico es estándar de la industria.
- El contexto **"Sincronización de Calendario"** actúa formalmente como **Anti-Corruption Layer**: nada del modelo de Google Calendar (colores, formato de evento) puede filtrarse a `Agenda`. Mismo principio aplica al contexto de **Conversación** respecto al formato de mensajes de WhatsApp y a **Catálogo y Cotización** respecto al formato de respuesta del LLM.

**Riesgo aceptado y mitigación:** el mayor riesgo de DDD táctico en un equipo pequeño es que las fronteras se erosionen con el tiempo bajo presión de entrega ("solo un JOIN rápido, ya lo arreglamos después"). Mitigación: revisión de arquitectura obligatoria en PR cuando un módulo importa código interno de otro módulo (no su API pública), reforzada con linting de límites de módulo cuando se defina el stack técnico.

---

## 3. Clean Architecture + Arquitectura Hexagonal (decisión: combinadas, no una u otra)

Estos dos estilos resuelven el mismo problema central desde ángulos distintos:

- **Hexagonal (Ports & Adapters):** el dominio no conoce el mundo exterior; se comunica con él a través de *puertos* (interfaces) implementados por *adaptadores* (WhatsApp, Google Calendar, OpenAI, base de datos, HTTP).
- **Clean Architecture:** formaliza la "Regla de Dependencia" — las dependencias de código siempre apuntan hacia adentro (dominio), nunca hacia afuera (infraestructura/frameworks).

**Decisión:** se adoptan como un mismo principio práctico, no como dos arquitecturas en competencia: *el dominio (entidades, aggregates, value objects, domain events del Domain Discovery) no importa ningún framework, librería de infraestructura, SDK de terceros ni detalle de transporte (HTTP, WhatsApp, SQL). Todo acceso al exterior pasa por un puerto definido por el dominio, implementado por un adaptador en la capa de infraestructura.*

**Por qué esta combinación y no solo una:** "Clean Architecture" por sí sola tiende a describirse en capas concéntricas genéricas (entities/use cases/adapters/frameworks) que en la práctica se implementan como carpetas técnicas (`controllers/`, `services/`, `repositories/`) — esto es precisamente lo que la sección 4 (Vertical Slices) evita. Usamos el **vocabulario y la disciplina de dependencia de Clean Architecture**, con la **organización física de puertos/adaptadores de Hexagonal** en los bordes del sistema (integraciones externas), y una organización interna por caso de uso (sección 4) en vez de por capa técnica.

**Tradeoff aceptado:** esta combinación exige más disciplina de diseño inicial que "escribir controladores que llaman directo a Prisma". El costo se paga en velocidad de las primeras semanas; el retorno es que WhatsApp, Google Calendar y el proveedor de IA pueden cambiarse o mockearse sin tocar lógica de negocio — crítico dado que dos de esas tres integraciones ya están marcadas como riesgo técnico en el Domain Discovery (proveedor de WhatsApp no oficial, dependencia de un solo proveedor de IA).

---

## 4. Vertical Slice Architecture (decisión: sí, para la capa de aplicación)

**Decisión:** cada caso de uso del Domain Discovery (sección 6 de ese documento — ej. `ConfirmarCita`, `SolicitarAnticipo`, `CotizarComposicionDeServicio`, `EscalarConversacion`) se implementa como una **rebanada vertical autocontenida**: su comando/consulta, su handler, su validación y sus DTOs de entrada/salida viven juntos, en vez de dispersarse en carpetas técnicas compartidas (`controllers/`, `services/`, `dtos/`) donde un cambio a un caso de uso obliga a tocar cinco carpetas no relacionadas entre sí.

**Por qué:**
- Evita el anti-patrón clásico de "Clean Architecture mal aplicada": capas técnicas compartidas por decenas de casos de uso no relacionados, que se convierten en cuellos de botella de coordinación en equipo (todos tocan `services/` para cosas distintas).
- Encaja naturalmente con la lista de casos de uso ya identificada en el Domain Discovery — no hay que inventar la organización, ya existe.
- Facilita razonar sobre auditoría e IA: cada caso de uso disparado por la IA (ej. `ConfirmarCita` invocado desde la Conversación) es una unidad clara y trazable, alineado con el requisito de "grabación de todas las decisiones de la IA".

**Lo que NO cambia:** el **modelo de dominio (entidades, aggregates, value objects) es compartido dentro del Bounded Context**, no se duplica por slice. Vertical Slices organiza la capa de *aplicación* (orquestación de casos de uso), no reemplaza el modelo de dominio rico definido en el Domain Discovery — si lo hiciera, caeríamos en el anti-patrón opuesto (lógica de negocio filtrándose a los handlers, "modelo anémico").

**Tradeoff aceptado:** algo de duplicación superficial entre slices similares (ej. `ConfirmarCita` y `ReprogramarCita` comparten validaciones parecidas). Se acepta esa duplicación mientras sea genuinamente superficial; si dos slices comparten lógica de negocio real (no solo forma), esa lógica pertenece al dominio compartido, no se copia.

---

## 5. SOLID (aplicación práctica, no checklist teórico)

SOLID se aplica como guía de diseño a nivel de código dentro de cada slice y cada adaptador, no como una capa arquitectónica adicional:

| Principio | Aplicación concreta en Blanc |
|---|---|
| **S**ingle Responsibility | Cada handler de caso de uso (sección 4) hace una sola cosa; la lógica de cálculo de cotización vive en el dominio de `Catálogo y Cotización`, no en el handler de `ConfirmarCita`. |
| **O**pen/Closed | Los puertos (ej. `ProveedorDeMensajeria`, `ProveedorDeIA`, `SincronizadorDeCalendario`) permiten agregar un nuevo proveedor sin modificar el dominio — relevante porque dos proveedores externos (WhatsApp, IA) ya están marcados como riesgo y podrían necesitar reemplazo. |
| **L**iskov Substitution | Cualquier adaptador que implemente un puerto (ej. un `ProveedorDeIA` de respaldo si OpenAI falla) debe ser sustituible sin romper el contrato esperado por el dominio — esto es lo que hace viable un *fallback* de IA (sección 8). |
| **I**nterface Segregation | Puertos pequeños y específicos (ej. separar "leer disponibilidad" de "escribir cita" si sus consumidores son distintos) en vez de un puerto `CalendarioService` gigante que todos dependen de todo. |
| **D**ependency Inversion | Es la regla de dependencia de la sección 3: el dominio define las interfaces (puertos), la infraestructura las implementa. El dominio nunca importa un SDK concreto. |

---

## 6. CQRS (decisión: CQRS selectivo — "CQRS-lite" — no CQRS global ni Event Sourcing)

**Decisión:** se separan modelo de lectura y modelo de escritura **solo** donde el Domain Discovery ya evidenció una necesidad real:

- **Analítica** — es, por diseño, un read-model puro que se alimenta de eventos de dominio de todos los demás contextos (así quedó definido en la sección 5.9 del Domain Discovery). Esto ya es CQRS de facto: el modelo de lectura del dashboard no debe construirse consultando en vivo las tablas transaccionales de `Cita`, `Conversacion`, etc.
- **Búsqueda de disponibilidad** (dentro de `Agenda`) — es una consulta de alta frecuencia con forma muy distinta a la de escritura (¿qué horarios están libres, dada sucursal + duración + manicurista opcional?). Beneficia de un modelo de lectura optimizado, separado del modelo transaccional que garantiza el invariante de no-doble-booking.

**Se descarta explícitamente CQRS como patrón global** para el resto de los contextos (`Clientas`, `Anticipos`, `Escalamiento`, `Sucursales y Personal`, etc.): su complejidad de escritura no lo justifica, y duplicar modelo de lectura/escritura ahí sería complejidad accidental sin beneficio — contradice el principio de simplicidad proporcional (sección 1.3).

**Se descarta explícitamente Event Sourcing como estrategia de persistencia.** Esto es distinto de "usar domain events" (que sí se adopta, sección 7): Event Sourcing significa que el *estado se reconstruye* a partir del log de eventos como fuente de verdad. Es un salto de complejidad operativa (proyecciones para todo, versionado de eventos, snapshots) no justificado por la escala real ni por el tamaño de equipo esperado. Los domain events aquí se usan para **integración y notificación entre contextos**, no como mecanismo de persistencia — el estado de `Cita`, `Clienta`, etc. se persiste directamente como estado actual (modelo transaccional convencional).

**Tradeoff aceptado:** si en el futuro la Analítica necesita datos históricos más ricos que los que un modelo de estado actual + eventos de integración puede ofrecer, revisitar esta decisión (gatillo explícito: necesidad de reconstruir estado pasado exacto para auditoría regulatoria más allá de lo que el log de auditoría — sección 13 — ya cubre).

---

## 7. Event-Driven (decisión: sí, dentro del proceso — sin broker distribuido por ahora)

**Decisión:** la comunicación entre Bounded Contexts usa domain events (ya catalogados en el Domain Discovery), publicados y consumidos **dentro del mismo proceso** mediante un bus de eventos en memoria (patrón mediador), **no** mediante un message broker distribuido (Kafka, RabbitMQ, SNS/SQS) en esta fase.

**Por qué sí event-driven:** el propio Domain Discovery ya reveló una topología naturalmente orientada a eventos — `CitaConfirmada` dispara notificación, `EscalamientoSolicitado` dispara ticket + notificación, casi todo dispara `Analítica`. Modelarlo como llamadas síncronas directas entre contextos acoplaría fuertemente módulos que deben permanecer independientes (violaría la sección 2).

**Por qué sin broker distribuido todavía:** un broker distribuido resuelve problemas de *escala y despliegue independiente* que no existen hoy (un solo proceso desplegado, un solo cliente, 3–4 sucursales). Introducirlo ahora es complejidad operativa (infraestructura adicional, monitoreo adicional, otro punto de falla) sin un problema real que resuelva todavía — viola el principio de simplicidad proporcional.

**Mitigación de la debilidad conocida de este enfoque:** un bus en memoria pierde eventos si el proceso falla entre "guardar el cambio de estado" y "publicar el evento". Para los eventos que disparan efectos externos importantes (notificación de WhatsApp, sincronización con Google Calendar, cobro de anticipo) se exige el **patrón Transactional Outbox**: el evento se escribe en la misma transacción que el cambio de estado, y un proceso separado garantiza su entrega. Esto evita construir sobre una promesa de "como no debería fallar, no lo protegemos" — que es exactamente el tipo de decisión que en un sistema de reservas con dinero de por medio (anticipos) no es aceptable.

**Gatillo de revisión hacia un broker distribuido:** si un módulo (el candidato natural es `Conversación`, por volumen y latencia) necesita desplegarse y escalar independientemente del resto, o si aparece un segundo proceso/servicio que necesita consumir estos eventos fuera del monolito.

---

## 8. Modular Monolith vs. Microservices (decisión: Modular Monolith)

| Criterio | Microservicios | Modular Monolith |
|---|---|---|
| Equipo actual | Requiere múltiples equipos autónomos para justificar el costo de coordinación distribuida (Ley de Conway) | Un solo despliegue, un solo equipo puede operarlo sin plataforma dedicada |
| Escala actual | Diseñado para escalar componentes de forma independiente a gran volumen | 3–4 sucursales, un cliente — el volumen no justifica escalado independiente por servicio |
| Complejidad operativa | Alta: orquestación, service discovery, observabilidad distribuida, transacciones distribuidas | Baja: un solo proceso, transacciones ACID nativas de una sola base de datos |
| Consistencia de invariantes (ej. no-doble-booking) | Requiere sagas o transacciones distribuidas — más difícil de garantizar correctamente | Transacción de base de datos local — mucho más simple y confiable |
| Velocidad de entrega inicial | Más lenta (hay que construir la plataforma distribuida antes que el producto) | Más rápida — se invierte el tiempo en el dominio, no en infraestructura distribuida |
| Costo de "me equivoqué de límite de contexto" | Alto — mover una responsabilidad entre servicios es un proyecto en sí mismo | Bajo — mover código entre módulos del mismo repo es un refactor, no un proyecto |

**Decisión: Modular Monolith**, con los Bounded Contexts del Domain Discovery como módulos internos con frontera estricta (sección 2). Esto es coherente con la escala real (sección 0) y no cierra la puerta a extraer servicios después, precisamente porque la disciplina de Hexagonal + DDD (secciones 2–3) ya obliga a que cada módulo tenga una interfaz explícita — la extracción futura de un módulo a servicio independiente es un cambio de *despliegue*, no de *diseño*, si se respeta esta disciplina desde ahora.

**Gatillos explícitos de revisión** (no dejar la decisión "abierta para siempre" sin criterio):
- Blanc pasa de cliente único a plataforma multi-cliente (cambia el perfil de escala fundamentalmente).
- Un módulo específico (candidato: `Conversación`) necesita escalar o desplegarse a una cadencia distinta del resto por volumen real medido, no proyectado.
- El equipo de ingeniería crece a múltiples equipos autónomos que se bloquean mutuamente trabajando en el mismo despliegue.

**Tradeoff aceptado:** un monolito modular mal disciplinado degenera en un "monolito distribuido sin los beneficios de ninguno de los dos". La mitigación es la misma de la sección 2: revisión de arquitectura obligatoria en límites de módulo.

---

## 9. Principios para IA

1. **La IA interpreta lenguaje natural; el dominio decide.** Ningún resultado del LLM cambia estado de negocio directamente — siempre pasa por un caso de uso del dominio (sección 4) que aplica sus propios invariantes, sin importar lo que la IA "haya entendido".
2. **Salida estructurada obligatoria, no texto libre parseado.** Toda interacción donde la IA extrae información accionable (intención, composición de servicio por uña, datos de contacto) debe producir una salida con esquema validado por código antes de tocar el dominio. Esto mitiga directamente el riesgo de alucinación ya identificado en el Domain Discovery (contar mal uñas/diseños en algo que determina precio).
3. **Cada acción disparada por IA es idempotente.** Los mensajes de WhatsApp pueden reintentarse o duplicarse (webhooks); una misma intención de "confirmar cita" recibida dos veces no debe crear dos citas.
4. **Trazabilidad total de decisiones de IA.** Cada intento de intención, tool-call o acción sugerida por el modelo se registra con: prompt/versión usada, entrada, salida, modelo, tokens, costo y el caso de uso de dominio que terminó ejecutándose (o no). Esto es lo que el cliente pidió explícitamente como "grabación de todas las decisiones de la IA" y es, además, la base de la auditoría de seguridad (sección 13).
5. **Versionado de prompts como artefacto de primera clase**, no como string embebido en el código de un handler. Debe poder desplegarse una nueva versión de prompt, probarse en sandbox (ya solicitado por el cliente) y revertirse sin un despliegue de código.
6. **Degradación explícita a escalamiento humano, nunca a "adivinar".** Si la confianza de interpretación es baja, la salida no cumple el esquema esperado, o el proveedor de IA falla/no responde, el flujo cae al Bounded Context de Escalamiento (ya modelado) en vez de intentar continuar con una interpretación dudosa. Esto es consistente con el principio de "no cometer errores humanos simulados" (el cliente no quiere que el bot finja naturalidad forzando una respuesta cuando no está seguro).
7. **Gobernanza de costo como control técnico, no solo métrica.** El riesgo de costo de IA no acotado (ya identificado) se mitiga con límites duros configurables (por conversación, por sucursal, por día), no solo con un dashboard que lo reporta después de gastado.
8. **Aislamiento estricto de la capa de IA respecto al dominio.** El Bounded Context de `Conversación` es, arquitectónicamente, un adaptador *driving* (equivalente a una UI) sobre los casos de uso de `Agenda`, `Catálogo y Cotización`, `Clientas`, etc. — no al revés. Esto permite probar y operar toda la lógica de negocio sin IA en el ciclo (crítico para tests, sandbox y para el día en que se quiera dar soporte a un canal sin IA, ej. un panel administrativo que agenda manualmente).

---

## 10. Principios para APIs

*(Principios de diseño de contrato, no elección de framework — eso se decide en la fase de arquitectura técnica.)*

1. **Contract-first.** El contrato (esquema de request/response) se define antes que la implementación, no se infiere del código después.
2. **Versionado explícito desde el primer endpoint** (ej. prefijo `/v1`), porque el cliente ya pidió una API pública futura para integraciones con POS/inventario — romper compatibilidad sin versión afecta a un integrador externo que Blanc no controla.
3. **La API pública futura y la API interna (usada por el frontend/plataforma) son contratos distintos**, aunque compartan implementación interna al inicio. No se diseña la interna asumiendo que un tercero nunca la va a consumir, ni se expone la interna tal cual como "la pública" el día que se necesite.
4. **Idempotencia obligatoria en endpoints que cambian estado**, vía idempotency key en el header, particularmente relevante en los que puede disparar la IA o un reintento de webhook de WhatsApp (mismo riesgo que el principio 9.3).
5. **Formato de error consistente y semántico** en todos los endpoints (mismo esquema de error, códigos de negocio identificables, no solo códigos HTTP genéricos) — necesario para que el frontend y la capa de IA puedan reaccionar distinto a "no hay disponibilidad" vs. "clienta bloqueada" vs. "error interno".
6. **Autenticación de servicio a servicio explícita** para webhooks entrantes (WhatsApp, Google Calendar) — verificación de firma/origen, no solo un endpoint abierto confiando en el payload.
7. **Rate limiting por identidad del llamador** (usuario interno, sucursal, integrador público futuro), no solo un límite global — coherente con la lista de seguridad que el cliente ya pidió.

---

## 11. Principios para Base de Datos

1. **Una sola base de datos física en esta fase**, con **separación lógica por Bounded Context** (esquemas o namespaces separados por contexto: `agenda`, `catalogo`, `crm`, `conversacion`, etc.). Es coherente con la decisión de Modular Monolith (sección 8): un contexto no debe poder hacer `JOIN` directo contra las tablas de otro contexto — si necesita ese dato, lo pide a través del caso de uso público de ese contexto o lo consume vía evento. Esto es lo que preserva la posibilidad real de extraer un contexto a un servicio con su propia base de datos después.
2. **Sin llaves foráneas entre esquemas de distintos Bounded Context.** Referencias entre contextos se guardan como identificadores simples (ej. `Cita.clientaId`), nunca como FK de base de datos — el motor de base de datos no debe imponer un acoplamiento que el diseño de dominio deliberadamente evita.
3. **Control de concurrencia explícito en el aggregate `Cita`** (bloqueo optimista o restricción única a nivel de base de datos sobre manicurista+rango horario) para garantizar en la capa de persistencia el invariante de no-doble-booking, no solo en la lógica de aplicación — el riesgo de condición de carrera ya fue identificado en el Domain Discovery y no es aceptable resolverlo "solo con buena suerte en el código".
4. **Dinero como entero (unidad mínima, ej. centavos) o decimal de precisión fija — nunca punto flotante.** Aplica a precios, anticipos y cotizaciones.
5. **Toda fecha/hora se almacena en UTC**; la conversión a hora local de sucursal ocurre en la capa de presentación/aplicación, nunca en la de persistencia. Los sistemas de citas son particularmente propensos a bugs de zona horaria (horario de verano, festivos) — se decide esto ahora para no descubrirlo en producción.
6. **Migraciones versionadas, revisables y reversibles** desde el primer esquema, incluso antes de tener usuarios reales.
7. **Modelo de lectura de Analítica separado físicamente o al menos desacoplado en consulta** de las tablas transaccionales (ligado a la decisión de CQRS-lite, sección 6), para que un reporte pesado no compita por recursos con una confirmación de cita en curso.
8. **Snapshot inmutable de cotización dentro de `Cita`** (ya definido como supuesto de trabajo en el Domain Discovery, pendiente de confirmación de negocio): el precio/duración de una cita confirmada no debe cambiar retroactivamente si el catálogo cambia después.
9. **Atomicidad de operación de negocio + auditoría (RN-AUD-01) vía un puerto `UnitOfWork`, no `db.transaction()` directo en Application.** Confirmado como patrón transversal autorizado en el hardening del módulo Sucursales y Personal (2026-08-11, primer módulo construido) tras evaluar las alternativas: `db.transaction()` directo en Application (rechazado — rompe la separación Application/Infrastructure de `ADR-002`, Application conocería Drizzle); Transaction Manager con begin/commit/rollback expuestos (rechazado — más superficie de la que este proyecto necesita hoy). Se adopta un puerto mínimo (`UnitOfWork.ejecutar(trabajo)`) implementado en Infrastructure sobre `db.transaction()`, con la conexión transaccional propagada a los repositorios vía `AsyncLocalStorage` (Node nativo, sin dependencia nueva) — evita pasar un handle de transacción por cada firma de puerto del dominio. Application solo ve la interfaz del puerto. Todo caso de uso de escritura que además audite (o que escriba en más de un repositorio) debe envolver ambos pasos en `unitOfWork.ejecutar(...)`. Implementación de referencia: `backend/src/shared/persistence/`. **Límite conocido, no resuelto:** la reversión real de una transacción fallida solo se verificó contra `pg-mem` (que no revierte de verdad, ver `03-technical-architecture.md` §8.5) — la verificación contra Postgres real queda pendiente por falta de `DATABASE_URL` real en el entorno de desarrollo actual.
10. **Traducción de errores de PostgreSQL a errores de dominio ocurre en Infrastructure (repositorios), nunca se propaga el código SQLSTATE hacia Application/Domain.** Confirmado en el mismo hardening — hoy cubre específicamente `23505` (`unique_violation`) → `ConflictoDeNegocioError` (409), la única violación de constraint que el primer módulo puede producir. Ver `shared/errors/postgres-error.ts`. **Nota de gobernanza, no cerrada aquí:** esta traducción ya fija de facto `409` como el código HTTP por defecto para conflictos de regla de negocio detectados a nivel de base de datos, mientras `05-api-design.md` §9 sigue marcando `409` vs. `422` como `Decision Pending` general. No se cierra esa decisión global en este documento — se deja constancia de que la implementación real ya está inclinada hacia `409`, para que quien la formalice lo haga con ese hecho a la vista.

---

## 12. Principios de Seguridad

Extendiendo la lista que el propio cliente ya pidió (RBAC, JWT, Refresh Tokens, MFA, auditoría, historial, versionado, rate limit, logs, encriptación, backups, monitoreo, alertas, secrets manager) como **principios**, no solo checklist de features:

1. **Privilegio mínimo por diseño.** RBAC no es solo "qué puede ver cada rol" sino "por defecto no puede, hasta que se conceda" — y con alcance de sucursal aplicado consistentemente (pendiente de resolver el alcance exacto por rol, Domain Discovery pregunta abierta #11). **→ Alcance ya definido para Blanc (`DISCOVERY_CHECKLIST.md` 1.26, 2026-08-03):** global para Analista y Solo lectura, no por sucursal — es una respuesta de Client Specification (dato del cliente), no una propiedad de este principio genérico; el principio de privilegio mínimo en sí no cambia.
2. **MFA obligatorio para roles con capacidad de cambio de configuración crítica** (Super Admin, Administrador como mínimo) — no opcional, dado que esos roles pueden alterar horarios, precios y bloquear sucursales enteras.
3. **Todo secreto vive en un gestor de secretos, nunca en código ni en variables de entorno versionadas.** Aplica igual a credenciales de WhatsApp, claves de Google Calendar y API keys de IA.
4. **Cifrado en tránsito y en reposo por defecto**, sin excepción para "solo es un dato de prueba".
5. **El log de auditoría es de solo-anexado (append-only) y no editable**, incluyendo decisiones de IA (sección 9.4), cambios de configuración por sucursal, asignación/remoción de lista roja y cobros de anticipo — son precisamente las acciones con impacto reputacional o económico directo identificadas como riesgo de negocio.
6. **El webhook de entrada de WhatsApp es superficie pública y se trata como tal:** verificación de firma/origen, rate limiting, y validación estricta de payload antes de tocar cualquier lógica de dominio — es el punto de entrada más expuesto de todo el sistema porque es, por diseño, accesible sin autenticación de usuario.
7. **Los backups se validan con restauración periódica real**, no se asume que "existen backups" es equivalente a "la recuperación funciona".
8. **Minimización de datos personales sensibles** (fotos de referencia, teléfonos, hábitos de consumo) como principio de diseño aunque el marco regulatorio exacto siga sin confirmar (Domain Discovery, pregunta abierta #12) — construir asumiendo que se deberá justificar cada dato retenido es más barato que migrar después a un modelo más estricto. **→ Postura informal registrada (`DISCOVERY_CHECKLIST.md` 1.27, 2026-08-03):** la Dueña no conoce una obligación aplicable hoy, pero no es una validación jurídica formal — el principio de minimización se mantiene exactamente igual hasta esa validación.

---

## 13. Estrategia de escalabilidad

1. **La escala real hoy (3–4 sucursales, un cliente) no requiere escalado horizontal agresivo ni sharding.** Diseñar para eso ahora sería trabajo no justificado — vuelve al principio de simplicidad proporcional (sección 1.3).
2. **La capa de aplicación es sin estado (stateless).** El estado de conversación, sesión y disponibilidad vive en la base de datos/cache, no en memoria del proceso — esto es barato de hacer bien desde el inicio y caro de corregir después, y es lo que permite correr más de una instancia por disponibilidad (no necesariamente por volumen) sin rediseño.
3. **`Conversación` es el módulo con mayor probabilidad de necesitar escalar o desplegarse de forma independiente primero**, por ser el punto de entrada de todo el tráfico de WhatsApp y tener latencia sensible (una clienta esperando respuesta). El diseño modular (sección 8) ya lo deja como candidato natural de extracción si el volumen real lo justifica.
4. **Cache para datos de lectura estables y de bajo riesgo de inconsistencia** (catálogo de servicios, horarios de sucursal) — nunca para disponibilidad de horarios, que debe resolverse siempre contra la fuente de verdad para no reintroducir el riesgo de doble-booking que la sección 11.3 ya resuelve a nivel de base de datos.
5. **Umbral explícito de revisión de esta estrategia:** más de una sucursal adicional a lo hoy proyectado (5ª+ ya mencionada como incierta), degradación de latencia sostenida en `Conversación`, o expansión a multi-cliente.

---

## 14. Estrategia de observabilidad

1. **Tres pilares estándar (logs estructurados, métricas, trazas) correlacionados por un identificador único de flujo**, desde el mensaje de WhatsApp entrante hasta el evento de dominio resultante y la notificación de salida. En un sistema conversacional, un solo error suele cruzar 4–5 componentes (webhook → IA → caso de uso → evento → notificación) — sin correlación, depurar es adivinar.
2. **Observabilidad técnica (operación del sistema) y KPIs de negocio (dashboard tipo Stripe que pidió el cliente) son la misma fuente de datos, dos audiencias distintas.** "Costo IA" y "tokens consumidos", por ejemplo, aparecen en ambos porque son el mismo dato — se modelan una sola vez y se proyectan a dos vistas (ingeniería vs. negocio), no se duplican como dos sistemas separados. Esto es una aclaración importante porque el listado del cliente mezcla ambos tipos de métrica bajo "Dashboard".
3. **Observabilidad de IA como categoría propia**, no genérica: cada llamada al modelo se registra con latencia, tokens, costo, versión de prompt y resultado (éxito, ambigüedad, fallback) — insumo directo tanto para el dashboard de negocio como para depuración técnica y para la auditoría de seguridad (sección 12.5).
4. **Alertas sobre violaciones de invariantes de negocio, no solo sobre señales de infraestructura.** Un doble-booking que ocurriera pese a los controles de la sección 11.3, o una notificación de escalamiento que no llegó al empleado, son incidentes con impacto directo en el negocio y deben alertar igual (o más fuerte) que un CPU alto.
5. **Todo lo anterior se diseña contra un estándar neutral (OpenTelemetry como protocolo)**, no atado a un backend de visualización específico — cuál backend (Grafana/Loki u otro) se decide en la fase de arquitectura técnica, no aquí.

---

## 15. ADRs iniciales

> Formato: Contexto → Decisión → Alternativas consideradas → Consecuencias.

### ADR-001 — Modular Monolith en lugar de Microservicios
- **Contexto:** sistema de un solo cliente, 3–4 sucursales, equipo de ingeniería probablemente pequeño en esta fase.
- **Decisión:** un único desplegable, organizado internamente en módulos con frontera estricta por Bounded Context.
- **Alternativas consideradas:** microservicios desde el inicio (rechazado: costo operativo no justificado por la escala real, sección 8); monolito sin modularización interna (rechazado: no permitiría evolucionar ni extraer servicios después sin reescritura).
- **Consecuencias:** despliegue y operación simples ahora; requiere disciplina de límites de módulo para no degradar en un "monolito distribuido sin beneficios". Revisión si se cumplen los gatillos de la sección 8.

### ADR-002 — Hexagonal + Clean Architecture + Vertical Slices combinados
- **Contexto:** el dominio depende de integraciones externas volátiles/riesgosas (WhatsApp no oficial, proveedor único de IA) y de una lista extensa de casos de uso ya identificados.
- **Decisión:** dominio aislado de infraestructura vía puertos/adaptadores (Hexagonal) con regla de dependencia hacia adentro (Clean), organizado por caso de uso (Vertical Slices) en la capa de aplicación.
- **Alternativas consideradas:** Clean Architecture en capas técnicas compartidas (rechazado: cuello de botella de coordinación, sección 4); MVC/capas simples sin separación de dominio (rechazado: acopla lógica de negocio a WhatsApp/IA/DB, contradice el principio "la IA interpreta, no decide").
- **Consecuencias:** mayor costo de diseño inicial; permite reemplazar proveedores externos y testear el dominio sin IA ni WhatsApp en el ciclo.

### ADR-003 — CQRS selectivo, sin Event Sourcing
- **Contexto:** Analítica y búsqueda de disponibilidad tienen forma de lectura muy distinta a la de escritura; el resto de los contextos no.
- **Decisión:** modelo de lectura separado solo para Analítica y disponibilidad; resto de contextos con modelo único; sin Event Sourcing como estrategia de persistencia.
- **Alternativas consideradas:** CQRS global (rechazado: complejidad no justificada, sección 6); Event Sourcing completo (rechazado: complejidad operativa alta, no resuelve un problema real hoy).
- **Consecuencias:** dashboard y disponibilidad performantes sin acoplar todo el sistema a un patrón más complejo de lo necesario. Revisión si Analítica necesita reconstrucción histórica exacta más allá del log de auditoría.

### ADR-004 — Domain events en proceso + Transactional Outbox, sin broker distribuido
- **Contexto:** múltiples Bounded Contexts reaccionan a los mismos eventos (confirmación de cita, escalamiento) sin necesidad de despliegue independiente hoy.
- **Decisión:** bus de eventos en memoria dentro del monolito; patrón Outbox para eventos con efectos externos críticos (notificaciones, sincronización de calendario, anticipos).
- **Alternativas consideradas:** message broker distribuido desde el inicio (rechazado: infraestructura no justificada por la escala actual, sección 7); llamadas síncronas directas entre módulos (rechazado: acopla contextos que deben permanecer independientes, contradice sección 2).
- **Consecuencias:** simplicidad operativa ahora; requiere implementar Outbox correctamente para no perder eventos críticos en caso de falla del proceso. Revisión si un módulo necesita despliegue independiente.

### ADR-005 — La IA es un adaptador de interpretación, nunca la autoridad de decisión
- **Contexto:** riesgo de alucinación del LLM en cálculo de precio/duración (identificado en Domain Discovery) y riesgo reputacional de decisiones de negocio delegadas a un modelo no determinista.
- **Decisión:** el contexto `Conversación` es un adaptador *driving* sobre los casos de uso del dominio; toda salida de IA con impacto de negocio requiere esquema estructurado validado por código antes de ejecutar cualquier caso de uso.
- **Alternativas consideradas:** dejar que el LLM ejecute acciones directamente vía function-calling sin validación intermedia (rechazado: sin control sobre alucinaciones en algo que involucra dinero); lógica de negocio embebida en el prompt (rechazado: contradice el requisito explícito del cliente de que "toda la lógica de negocio" sea código).
- **Consecuencias:** más trabajo de definición de esquemas y validación; dominio testeable y operable sin IA en el ciclo; trazabilidad completa de decisiones de IA.

### ADR-006 — Una sola base de datos física, separación lógica estricta por contexto
- **Contexto:** Modular Monolith (ADR-001) necesita que los límites de contexto se respeten también en persistencia, o se pierden con el tiempo.
- **Decisión:** un motor de base de datos, esquemas/namespaces separados por Bounded Context, sin FKs entre esquemas.
- **Alternativas consideradas:** una base de datos por contexto desde el inicio (rechazado: complejidad operativa de múltiples bases de datos no justificada hoy, y contradice la simplicidad de transacciones ACID locales que el Modular Monolith aprovecha); un esquema único sin separación (rechazado: facilita el acoplamiento accidental entre contextos vía JOINs, exactamente el riesgo que ADR-001 busca evitar).
- **Consecuencias:** migración a bases de datos separadas por contexto es un paso incremental y no un rediseño, si algún contexto se extrae a servicio en el futuro.

### ADR-023 — Modelo de Plataforma: Core Platform, Domain Policies, Client Specification y Extension Points *(agregado — no estaba en la lista original de 6)*
- **Contexto:** Blanc evolucionó de sistema de un solo cliente a plataforma reutilizable para clientes futuros, sin sacrificar la riqueza del dominio ni construir un mecanismo de configuración universal.
- **Decisión:** cuatro capas — Core Platform (mecanismos, depende solo de interfaces de Domain Policy), Domain Policies (decisiones de dominio con lógica real, filtradas por un criterio de seis puntos), Client Specification (solo datos), Extension Points (adaptadores de infraestructura, ya gobernados por ADR-002). Las Domain Policies representan únicamente variabilidad de dominio, nunca técnica.
- **Alternativas consideradas:** modelo de tres capas sin Domain Policies (rechazado: resuelve como datos decisiones que en 4 casos tienen evidencia de requerir un algoritmo distinto, no solo un valor distinto); enmendar ADR-002/ADR-009 en vez de un ADR propio (rechazado: el tema estaba disperso en 4 ADRs, mismo patrón que ya justificó crear ADR-021/ADR-022).
- **Consecuencias:** incorporar un cliente nuevo escala por niveles de costo creciente, con el Core Platform como último recurso; mecánica completa y criterio de creación en `PLATFORM_ARCHITECTURE_MODEL.md`, documento normativo de detalle de esta ADR.

---

## 16. Riesgos y Tradeoffs (consolidado)

| Riesgo / Tradeoff | Decisión que lo origina | Mitigación |
|---|---|---|
| Erosión de límites de módulo bajo presión de entrega | Modular Monolith (ADR-001) | Revisión de arquitectura obligatoria en PRs que crucen límites de módulo |
| Pérdida de eventos si el proceso falla entre guardar estado y publicar evento | Event-driven en proceso (ADR-004) | Transactional Outbox para eventos con efectos externos críticos |
| Costo de diseño inicial más alto que un CRUD directo | Hexagonal + Clean + Vertical Slices (ADR-002) | Aceptado deliberadamente: el costo se paga una vez, el acoplamiento a WhatsApp/IA se hubiera pagado muchas veces |
| Un solo motor de base de datos como posible cuello de botella si todos los contextos crecen a la vez | Base de datos única (ADR-006) | Separación lógica estricta permite migrar un contexto a base de datos propia sin rediseño; monitoreo de carga por esquema |
| Duplicación superficial entre slices similares | Vertical Slices (sección 4) | Aceptable si es solo forma; lógica de negocio real compartida vive en el dominio, no se copia |
| Dependencia de un solo proveedor de IA para una función central del negocio | Principios para IA (sección 9) | Puertos/adaptadores (ADR-002) dejan la puerta abierta a un proveedor de respaldo sin rediseño del dominio |
| Escala real puede no ser la escala futura si Blanc se vuelve multi-cliente | Todo el documento (calibrado a sección 0) | Gatillos de revisión explícitos en secciones 6, 7, 8 y 13 — no es una decisión "para siempre", es una decisión para la evidencia de hoy |

---

## 17. Modelo de Plataforma: Core Platform, Domain Policies, Client Specification y Extension Points

> **Decisión formal:** `ADR-023`. **Documento normativo de detalle** (checklist de creación, Reference Implementation, mapeo a Decision Flows, proceso de onboarding, intento de refutación completo): `PLATFORM_ARCHITECTURE_MODEL.md`. Esta sección resume, no duplica.

Blanc evolucionó de sistema de un solo cliente a plataforma reutilizable para clientes futuros (ver Sección 0). El dominio rico ya definido en los principios anteriores (secciones 1-14) se mantiene íntegro — este modelo añade una capa de clasificación sobre él, no lo reemplaza.

**Las cuatro capas:**

| Capa | Contiene | Quién la define |
|---|---|---|
| **Core Platform** | Mecanismos universales, invariantes no negociables, aggregates, orquestación de casos de uso | Equipo de arquitectura, vía código + ADR |
| **Domain Policies** | Interfaces de dominio tipadas para decisiones con lógica real que varía entre clientes | Equipo de arquitectura define el contrato; cada cliente aporta la implementación |
| **Client Specification** | Datos puros — catálogo, horarios, prompts, roles, porcentajes | El cliente, vía Discovery |
| **Extension Points** | Adaptadores de infraestructura reemplazable — ya son los puertos que la Sección 3 (Hexagonal) exige | Equipo de arquitectura, un adaptador por proveedor |

**Regla de dependencia (extiende la Sección 3, no la contradice):** Core Platform depende únicamente de las interfaces de las Domain Policies, nunca de una implementación concreta — misma regla de dependencia hacia adentro que la Sección 3 ya exige para infraestructura, extendida aquí a decisiones de dominio.

**Principio — las Domain Policies representan variabilidad de dominio, nunca variabilidad técnica.** Un cambio de proveedor externo, motor de IA, base de datos o cualquier infraestructura es siempre un Extension Point (Sección 3), nunca una Domain Policy.

**Criterio de creación** (resumen — checklist completo de 6 puntos y anti-test de evidencia en `PLATFORM_ARCHITECTURE_MODEL.md` §3): ninguna Domain Policy se crea sin evidencia real de que un cliente distinto resolvería el problema con un algoritmo distinto — no solo con un valor distinto — y sin que exista una razón de negocio articulable, no especulativa. Hoy existen exactamente cuatro: `PoliticaDeCotizacion`, `PoliticaDeDisponibilidad`, `PoliticaDeRiesgoCliente`, `PoliticaDeGarantia`.

**Reference Implementation** (principio completo en `PLATFORM_ARCHITECTURE_MODEL.md` §4): toda Domain Policy tiene una implementación de referencia que resuelve la mayoría de los casos leyendo Client Specification — un cliente nuevo la usa por defecto, sin escribir código, salvo que necesite un algoritmo genuinamente distinto.

**Relación con los principios ya aprobados de este documento:** no reabre ninguno. El Modular Monolith (Sección 8), CQRS-lite (Sección 6), Event-Driven en proceso (Sección 7) y Hexagonal+Clean+Vertical Slices (Sección 3) siguen vigentes sin cambio — este modelo vive dentro de esa misma arquitectura, no la sustituye.

---

## 18. Próximos pasos

Con estos principios definidos, el siguiente documento natural es la **arquitectura técnica** (`docs/architecture/03-technical-architecture.md`): ahí sí corresponde evaluar el stack de referencia que propusiste (Next.js, NestJS, Supabase, Evolution API, etc.) contra estos principios — en particular, validar si Evolution API es aceptable dado el riesgo de continuidad ya señalado, o si conviene una alternativa/plan de contingencia.

Antes de avanzar ahí, ¿confirmas los principios de este documento (especialmente Modular Monolith, CQRS-lite y "sin Event Sourcing", que son las decisiones más caras de revertir si están equivocadas), o hay alguno que quieras cuestionar primero?
