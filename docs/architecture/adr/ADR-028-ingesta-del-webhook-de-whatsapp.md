# ADR-028 — Patrón de ingesta del webhook de WhatsApp

- **Estado:** Accepted (con riesgo residual declarado y criterio de reapertura medible)
- **Fecha:** 2026-10-16
- **Decide:** Arquitectura
- **Cierra:** `F-27` (`ARCHITECTURE_REVIEW.md`, severidad **Critical**) y la mitad correspondiente de `P6`
- **Relacionada con:** `ADR-008` (WhatsApp), `ADR-018` (procesos diferidos), `ADR-021` (idempotencia), `ADR-025` (planificador), `ADR-026` (frontera de la IA), `DEC-043`

---

## Contexto

`ARCHITECTURE_REVIEW.md` clasificó `F-27` como **Critical** y lo describió sin rodeos: *"procesar de forma síncrona dentro del request del webhook es el error más común y mejor documentado en integraciones de este tipo: genera timeouts, reintentos de Meta, y mensajes duplicados desde el primer día"*. `03-technical-architecture.md` §4.4 recomendó la **Opción (b)**: responder `200` de inmediato y encolar el payload crudo como job durable (`ADR-018`), con el pipeline de IA y de dominio dentro del handler del job.

**El canal se construyó en la Fase 4 y NO hace eso.** Hay que decirlo antes que nada, porque esta ADR ratifica lo construido y no la recomendación:

> `WebhookMetaController.recibir` **procesa cada mensaje de forma síncrona dentro del ciclo de petición del webhook**, incluida la clasificación por el modelo de lenguaje y la respuesta al cliente por la Cloud API. No hay cola. No hay ack diferido.

Esta ADR existe para decidir, con los hechos en la mano, si eso se corrige o se acepta — no para documentar que se hizo lo recomendado.

---

## Decisión

**Se acepta el procesamiento síncrono para el MVP**, con las mitigaciones que ya existen, una añadida, un riesgo residual declarado y un criterio de reapertura medible.

### 1. Lo que hace que el riesgo principal de `F-27` ya no aplique

La review temía tres cosas. Dos están resueltas, y no por el patrón de ingesta sino por decisiones posteriores:

| Lo que `F-27` temía | Por qué ya no es el riesgo que era |
|---|---|
| **Mensajes duplicados desde el primer día** | **Imposibles por construcción.** `mensajes_wamid_unq` es un índice único parcial en PostgreSQL y la inserción usa `ON CONFLICT DO NOTHING`. Un reintento de Meta no duplica el mensaje, no suma otro pendiente, no vuelve a mover la ventana de 24 h y **no vuelve a invocar al bot** — `RecibirMensajeUseCase` devuelve antes. Es la mitigación que la review pedía a `ADR-021`, y está en la base, no en el código. |
| **Pérdida de trabajo diferido si el proceso cae** | **No hay trabajo diferido que perder.** Lo que no puede perderse —recordatorios, avance de la lista de espera, expiración de anticipos, cierre de citas— **no pasa por el webhook**: lo ejecuta el Planificador (`ADR-025`) con idempotencia por estado. El webhook solo atiende el turno de conversación que está ocurriendo ahora, y si se pierde, la clienta vuelve a escribir. |
| **Timeouts y reintentos de Meta por latencia** | **Sigue vigente. Es el riesgo residual** — ver abajo. |

### 2. Mitigación añadida por esta ADR: timeout en la llamada al modelo

`TIMEOUT_DE_OPENAI_MS = 8_000` en `OpenAiAgenteAdapter`. Antes era un `fetch` sin timeout, que puede colgarse hasta el timeout de TCP —decenas de segundos— mientras Meta ya desistió y está reintentando. Al vencer, el turno degrada a `desconocida` y la conversación pasa a una persona, que es el comportamiento seguro que el adaptador ya tenía para cualquier fallo: **es preferible escalar a tiempo que responder tarde.**

### 3. Lo que ya estaba bien, y conviene que quede registrado

- **Siempre `200`, salvo firma inválida.** Meta reintenta ante cualquier no-2xx: un `500` convierte un evento defectuoso en un bucle.
- **Aislamiento por mensaje.** Meta agrupa eventos; un payload con varios no se pierde entero porque uno venga mal formado.
- **El fallo del bot no propaga.** Si el orquestador falla, el mensaje **ya está guardado** y queda en la Bandeja para una persona.
- **Los envíos van fuera de la transacción.** Un mensaje enviado no se deshace con un `ROLLBACK`.

### 4. Por qué no se construye la cola ahora

No es pereza, son tres razones que apuntan en la misma dirección:

1. **`ADR-018` no está implementado.** No existe cola durable, ni dead-letter, ni worker. Construirlos para este único consumidor es exactamente la infraestructura especulativa que `IMPLEMENTATION_MASTER_PLAN.md` §2 prohíbe — y el proyecto ya tomó la decisión equivalente con el Outbox, que `P5` dejó compatible pero no construido.
2. **El volumen no lo justifica hoy.** Tres sucursales, un número por sucursal. No es un escenario de carga: es un salón donde la Encargada atiende a quien escribe.
3. **La cola no elimina el problema, lo mueve.** Con cola, el ack es inmediato y la latencia del LLM deja de afectar a Meta — pero aparecen un worker que desplegar, una cola que vigilar y un rezago que medir. Es la decisión correcta cuando la latencia real lo exija, y hasta entonces es complejidad operativa a cambio de un riesgo que no se ha medido.

---

## Riesgo residual (declarado, no resuelto)

> **Si la respuesta al webhook tarda más de lo que Meta tolera, Meta reintenta.** El reintento **no duplica nada** —el índice único lo absorbe— pero sí desperdicia trabajo: el segundo intento repite la verificación de firma y la consulta, y descubre que el mensaje ya existe. En el peor caso, una clienta puede quedarse sin respuesta automática en ese turno y la conversación queda en la Bandeja.

Dos cosas que **no se saben** y hay que verificar en producción, declaradas como tales:

- **El timeout exacto del webhook de Meta no se ha verificado** contra la documentación vigente ni contra el servicio real. Lo que se sabe con certeza es que Meta reintenta ante no-2xx y ante falta de respuesta; el valor concreto, no.
- **La latencia real del camino completo** (firma → consulta → clasificación → envío de la respuesta) no se ha medido, porque no hay credenciales de Meta ni de OpenAI en este entorno.

### Criterio de reapertura — medible, no a ojo

Se construye la cola de `ADR-018` para este camino **si se cumple cualquiera de estos tres**:

1. **Los logs muestran reintentos de Meta sobre mensajes ya procesados** (visibles porque `registrarMensaje` devuelve `false` por `wamid` repetido) a un ritmo superior a **1 de cada 100 mensajes** en una semana de operación.
2. **El timeout de OpenAI se dispara más de una vez al día** (se distingue en el log: *"OpenAI no respondió en 8000 ms"*).
3. **Se abre la cuarta sucursal o se activa un segundo canal**, porque entonces el volumen deja de ser el que sustenta el punto 2 de la decisión.

---

## Consequences

### Positive

- **El canal está en producción y es simple de operar.** Un solo proceso, un solo despliegue, sin cola que vigilar ni rezago que medir — coherente con el Modular Monolith (`ADR-001`) y con el despliegue único en Railway.
- **La duplicación, que era el daño más grave que `F-27` anticipaba, es imposible.** Y lo garantiza la base de datos, no una convención de código.
- **El diagnóstico es directo.** Un fallo ocurre dentro de una petición con su `x-correlation-id`, no repartido entre un webhook y un worker que hay que correlacionar a mano.
- **La migración a cola no exige rediseñar nada.** `RecibirMensajeUseCase` ya es un caso de uso invocable; encolar significa cambiar quién lo llama, igual que con los barridos del Planificador (`ADR-025`).

### Negative

- **Se acepta conscientemente una recomendación `Critical` sin seguirla.** Es la consecuencia que hay que mirar de frente: si la latencia real resulta peor de lo estimado, el síntoma será turnos sin respuesta automática, y lo pagará la clienta esperando. Los tres criterios de reapertura existen para que eso se detecte con datos y no con quejas.
- **La latencia del canal queda acoplada a la de OpenAI.** El timeout acota el daño, no lo elimina: un modelo lento degrada a escalamiento, y escalar de más carga de trabajo a la Encargada.
- **El riesgo residual depende de un número que no se ha verificado** (el timeout de Meta). Mientras no se mida, la decisión se sostiene en que el daño está acotado, no en que el riesgo sea bajo.

---

## Alternativas consideradas

| Alternativa | Por qué se rechazó |
|---|---|
| **Opción (b) de §4.4: ack inmediato + cola durable de `ADR-018`** | Es la correcta a medio plazo y la que esta ADR deja preparada. Hoy exige construir cola, dead-letter y worker **sin ningún otro consumidor**, contra el principio de no construir infraestructura especulativa. Se reabre con los criterios de arriba. |
| **Opción (c): ack inmediato + procesamiento en segundo plano sin cola** (`setImmediate`, promesa suelta) | **La peor de las tres**, y merece decirlo: daría la apariencia de haber resuelto `F-27` sin ninguna de sus garantías. Un reinicio de Railway a mitad del procesamiento pierde el turno **en silencio**, sin reintento ni dead-letter, y además deja trabajo huérfano tras el `app.close()` de los shutdown hooks. Es sustituir un riesgo visible por uno invisible. |
| **Encolar en PostgreSQL con una tabla propia** (`FOR UPDATE SKIP LOCKED`), sin broker | Técnicamente razonable y es lo que `F-03` propone para el Outbox. Pero necesita un drenador periódico, y eso ya existe (`ADR-025`): el día que se haga, el camino natural es una tabla de eventos entrantes drenada por un quinto barrido. Queda registrado como la forma preferida de la reapertura. |
| **Subir el timeout de OpenAI para que el bot "alcance" a responder** | Al revés de lo que hace falta. Esperar más al modelo aumenta exactamente la latencia que provoca el reintento de Meta. |

---

## Verificación

| Qué se afirma | Qué lo sostiene |
|---|---|
| Un reintento de Meta no duplica el mensaje ni reinvoca al bot | `conversaciones.spec.ts` (deduplicación por `wamid`) y `deriva-restricciones-conversaciones.spec.ts` (el índice único parcial existe en la base) |
| El webhook responde `200` salvo firma inválida | `conversaciones.e2e.spec.ts` |
| Un payload con un mensaje malformado no pierde los demás | `conversaciones.e2e.spec.ts` |
| Un fallo del bot deja el mensaje en la Bandeja | `agente/bot.spec.ts` |
| La llamada al modelo no puede colgarse indefinidamente | `TIMEOUT_DE_OPENAI_MS` con `AbortSignal.timeout`. **No verificado contra OpenAI real** — no hay credenciales |
