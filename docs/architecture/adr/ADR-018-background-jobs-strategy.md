# ADR-018

## Title
Estrategia de Background Jobs: cola durable at-least-once con handlers idempotentes y dead-letter alertable

## Status
Proposed — pendiente de aprobación del cliente

## Context
Varios flujos de Blanc son inherentemente asíncronos y no pueden depender de que ocurran en el mismo request que los origina: recordatorio automático 24h antes de la cita, confirmación automática, expiración de retención de horario cuando no se paga un anticipo (ADR pendiente en Domain Discovery, pregunta #4), emparejamiento de lista de espera cuando se libera un cupo, y el despacho del Transactional Outbox (ADR-004).

## Problem Statement
¿Cómo se ejecutan estos procesos diferidos/programados de forma confiable, sin que un fallo silencioso deje de enviar recordatorios o de liberar horarios sin que nadie lo note?

## Constraints
- Los recordatorios y confirmaciones automáticas tienen impacto de negocio directo (una clienta sin recordatorio puede no presentarse; un horario no liberado a tiempo bloquea otra reserva posible).
- Los jobs pueden reintentarse tras un fallo — sus handlers deben ser seguros de ejecutar más de una vez (idempotencia, ADR-021).
- Un fallo recurrente de un tipo de job (ej. "enviar recordatorio" fallando silenciosamente por semanas) debe ser detectable, no descubrirse por una queja de negocio.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Scripts programados (cron) sin durabilidad ni reintento | Ejecución periódica simple, sin garantía de reintento ante fallo ni cola persistente. |
| B. Cola durable (respaldada por almacenamiento persistente) con soporte de reintento, retraso/programación, handlers idempotentes y dead-letter queue alertable | Infraestructura de colas con garantías de entrega at-least-once y visibilidad de fallos recurrentes. |
| C. Orquestación completa basada en eventos con Event Sourcing | Los jobs se derivan de la reconstrucción de estado a partir de un log de eventos completo. |

## Decision
Se adopta la **Opción B**. Los procesos diferidos usan una cola durable con soporte de reintento con backoff, programación/retraso (necesario para recordatorios 24h antes y expiración de retención de anticipo), y una cola de mensajes fallidos (dead-letter) que genera alerta (ADR-011) cuando un tipo de job falla repetidamente, en vez de descartarse en silencio. Todos los handlers de job se diseñan como idempotentes (ADR-021), asumiendo que pueden ejecutarse más de una vez para el mismo evento/tarea.

## Consequences
Se obtiene confiabilidad real para procesos con impacto de negocio directo (recordatorios, expiración de anticipos, liberación de horarios), a cambio de operar una pieza de infraestructura de colas con su propio monitoreo.

### Positive Consequences
- Un fallo de envío de recordatorio se reintenta automáticamente y, si persiste, genera alerta — no desaparece en silencio durante semanas.
- La programación/retraso nativo de la cola es exactamente el mecanismo necesario para "recordatorio 24h antes" y "expiración de retención de anticipo si no se paga a tiempo".
- Los handlers idempotentes hacen segura la garantía at-least-once de la cola y del Outbox (ADR-004), sin duplicar efectos de negocio (ej. enviar el mismo recordatorio dos veces).

### Negative Consequences
- Operar una cola durable es una pieza de infraestructura adicional que monitorear y mantener, más compleja que un cron simple.
- Diseñar cada handler para ser idempotente requiere disciplina adicional en cada caso de uso asíncrono.

## Risks
- **Cola de dead-letter ignorada** (existe pero nadie la revisa): mitigado exigiendo que el umbral de dead-letter dispare una alerta activa (ADR-011), no solo un registro pasivo.
- **Handlers no realmente idempotentes** pese al principio declarado, causando efectos duplicados (ej. dos recordatorios): mitigado por pruebas explícitas de idempotencia como parte de la definición de "terminado" de cada job (ADR-019).
- **Acumulación de jobs programados de expiración de anticipo mal calibrados**, liberando u ocupando horarios incorrectamente: depende directamente de que se resuelva la Pregunta Abierta #4 del Domain Discovery (política de expiración de retención) antes de implementar ese job específico.

## Alternatives Rejected
- **Scripts cron sin durabilidad ni reintento**: rechazados. Un fallo silencioso de un cron que envía recordatorios o libera horarios no seria detectado hasta que el negocio lo note por una queja de clienta o por una sucursal bloqueada — inaceptable para procesos con impacto de negocio directo ya identificado.
- **Orquestación completa basada en Event Sourcing**: rechazada, consistente con ADR-003 — la complejidad operativa no está justificada por la escala real ni resuelve un problema que la Opción B no resuelva ya de forma más simple.

## Future Revisit Criteria
- Se confirma la política de expiración de retención de anticipo (Domain Discovery, pregunta abierta #4), necesaria para implementar ese job específico con la lógica de negocio correcta.
- El volumen de jobs programados crece al punto de requerir particionamiento o priorización explícita entre tipos de job (ej. separar recordatorios de despacho de Outbox si compiten por recursos).
