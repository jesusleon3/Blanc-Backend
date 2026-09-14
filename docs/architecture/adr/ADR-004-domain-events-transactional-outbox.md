# ADR-004

## Title
Domain Events en proceso (bus en memoria) con patrón Transactional Outbox

## Status
Proposed — pendiente de aprobación del cliente

## Context
El Domain Discovery catalogó una cantidad significativa de domain events que cruzan Bounded Contexts (`CitaConfirmada` dispara notificación y actualiza Analítica; `EscalamientoSolicitado` dispara ticket y notificación al empleado; casi todo evento relevante alimenta `Analítica`). El sistema se despliega como Modular Monolith (ADR-001), en un solo proceso.

## Problem Statement
¿Cómo se comunican los Bounded Contexts entre sí sin acoplarse directamente, y cómo se garantiza que los eventos con efectos externos críticos (notificación de WhatsApp, sincronización de calendario, cobro de anticipo) no se pierdan si el proceso falla?

## Constraints
- Los contextos deben permanecer desacoplados (ADR-001, ADR-002): no deben invocarse directamente entre sí de forma síncrona para todo.
- Un mensaje de escalamiento no entregado a un empleado es uno de los peores modos de falla posibles para este negocio (cliente molesto sin respuesta).
- No existe hoy una necesidad de despliegue independiente por módulo que justifique infraestructura de mensajería distribuida.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Llamadas síncronas directas entre módulos | Un módulo invoca directamente el código interno de otro cuando necesita reaccionar a un cambio. |
| B. Message broker distribuido (Kafka, RabbitMQ, SNS/SQS) desde el inicio | Eventos publicados y consumidos a través de infraestructura de mensajería externa. |
| C. Bus de eventos en memoria (patrón mediador) + Transactional Outbox para eventos con efectos externos críticos | Publicación/consumo de eventos dentro del mismo proceso; persistencia garantizada del evento en la misma transacción que el cambio de estado para los casos donde la entrega no puede fallar silenciosamente. |

## Decision
Se adopta la **Opción C**. Los domain events se publican y consumen dentro del mismo proceso mediante un bus en memoria. Para los eventos que disparan efectos externos críticos (notificaciones de WhatsApp, sincronización con Google Calendar, flujo de anticipos), se exige el **patrón Transactional Outbox**: el evento se escribe en la misma transacción de base de datos que el cambio de estado que lo origina, y un proceso separado garantiza su entrega posterior con reintentos.

## Consequences
Se obtiene desacoplamiento entre contextos sin la complejidad operativa de un broker distribuido, a cambio de implementar correctamente el patrón Outbox para no perder eventos críticos ante una falla del proceso.

### Positive Consequences
- Los Bounded Contexts permanecen desacoplados: `Agenda` no necesita conocer que `Notificaciones` existe, solo publica `CitaConfirmada`.
- No se introduce infraestructura de mensajería adicional (otro punto de falla, otro sistema que monitorear) sin un problema real que la justifique hoy.
- El patrón Outbox da garantías de entrega "at-least-once" para los eventos de mayor impacto de negocio, cerrando la brecha más peligrosa de un bus puramente en memoria.

### Negative Consequences
- Un bus en memoria puro (sin Outbox) puede perder eventos si el proceso falla entre el cambio de estado y la publicación — por eso el Outbox es obligatorio para los casos críticos, no opcional.
- El patrón Outbox añade una tabla de eventos pendientes y un proceso de despacho con reintentos, que debe implementarse y operarse correctamente (no es gratis).
- Los consumidores de eventos deben ser idempotentes (ver ADR-021), porque la garantía "at-least-once" puede entregar el mismo evento más de una vez.

## Risks
- **Implementación incorrecta del Outbox** (ej. despachar el evento antes de confirmar la transacción, o no reintentar tras fallo) anularía la garantía que este ADR busca dar. Mitigación: el proceso de despacho del Outbox y sus reintentos deben tener test de integración explícito antes de considerarse completo.
- **Acumulación de eventos no despachados** si el proceso de despacho falla silenciosamente. Mitigación: alertar (ADR-011) si el rezago del Outbox supera un umbral, no solo registrar el fallo.
- **Uso del bus en memoria para casos que en realidad necesitaban Outbox** por decisión apresurada de "esto no es crítico". Mitigación: la clasificación de qué eventos requieren Outbox se revisa explícitamente en el diseño técnico de cada caso de uso, no se asume por defecto.

## Alternatives Rejected
- **Llamadas síncronas directas entre módulos**: rechazada como mecanismo primario de comunicación entre contextos. Acopla módulos que deben permanecer independientes (contradice ADR-001 y ADR-002) y dificulta agregar nuevos consumidores de un evento sin modificar al productor.
- **Message broker distribuido desde el inicio**: rechazada. Resuelve problemas de escala y despliegue independiente que no existen hoy (ADR-001); introducirlo ahora es infraestructura y complejidad operativa sin un problema real que resuelva todavía.

## Future Revisit Criteria
- Un módulo (candidato: `Conversación`) necesita desplegarse o escalar independientemente del resto del monolito (mismo gatillo que ADR-001).
- Aparece un segundo proceso o servicio externo al monolito que necesita consumir estos eventos de forma nativa.
- El volumen de eventos supera lo que un despacho de Outbox de un solo proceso puede sostener con la latencia de entrega requerida por el negocio.
