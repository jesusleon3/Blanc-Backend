# ADR-021

## Title
Estrategia unificada de Idempotencia y Control de Concurrencia (ADR agregado — no estaba en la lista original)

## Status
Proposed — pendiente de aprobación del cliente

## Context
Durante la redacción de los ADRs 1 a 20, la necesidad de idempotencia y de control de concurrencia apareció de forma dispersa en al menos cuatro lugares distintos: acciones disparadas por IA (ADR-007, ante reintentos de webhook de WhatsApp), endpoints de API con efecto de estado (ADR-014), control de concurrencia en el aggregate `Cita` para no-doble-booking (ADR-005), y handlers de background jobs bajo entrega at-least-once (ADR-018, ADR-004). Tratar esto como cuatro decisiones locales independientes arriesga inconsistencia (ej. una idempotency key con semántica distinta en la API que en los jobs).

## Problem Statement
¿Cómo se garantiza, de forma consistente en todo el sistema, que una operación de estado que se ejecuta más de una vez (por reintento, duplicado, o entrega at-least-once) no produzca un efecto de negocio duplicado o incorrecto?

## Constraints
- Los mensajes de WhatsApp pueden reentregarse (webhooks duplicados) — una misma intención de "confirmar cita" puede llegar más de una vez.
- El bus de eventos con Outbox (ADR-004) y la cola de background jobs (ADR-018) dan garantías "at-least-once" por diseño, no "exactly-once".
- El invariante de no-doble-booking (ADR-005) requiere control de concurrencia real, no solo idempotencia a nivel de request.
- Una duplicación de efecto en `Anticipos` (cobrar dos veces) es inaceptable dado que involucra dinero real de la clienta.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Confiar en que cada capa resuelva idempotencia/concurrencia por su cuenta, sin una convención compartida | Cada equipo/desarrollador decide caso por caso cómo evitar duplicados. |
| B. Estrategia de dos capas: idempotency key explícita en los puntos de entrada (API/webhooks/jobs) + invariante de negocio como backstop final en el dominio/base de datos (ADR-005) | Doble protección: se evita el reproceso en el punto de entrada cuando es posible, y aunque falle esa primera barrera, el invariante de negocio en la base de datos garantiza que el efecto final sea correcto. |
| C. Deduplicación únicamente a nivel de infraestructura de mensajería (cola/broker) | Confiar en que la infraestructura de colas garantice entrega exactly-once. |

## Decision
Se adopta la **Opción B**, como decisión única y transversal que gobierna los cuatro puntos donde el problema apareció:
1. **Puntos de entrada** (endpoints de API con efecto de estado, webhooks de WhatsApp, handlers de background jobs): requieren una idempotency key (provista por el llamador o derivada de forma determinista del evento/mensaje entrante) que permite reconocer y descartar un reintento antes de re-ejecutar el efecto de negocio.
2. **Backstop de dominio/base de datos**: incluso si la idempotency key falla o no está disponible, los invariantes de negocio críticos (ej. restricción única de manicurista+rango horario en `Cita`, ADR-005; estado de `SolicitudAnticipo` que no permite doble cobro) garantizan que el efecto final en el sistema sea correcto, no solo que se detecte el duplicado en la puerta de entrada.

Ninguna infraestructura de mensajería (cola, Outbox) se asume "exactly-once" — todo el sistema se diseña asumiendo entrega "at-least-once" como caso normal, no como caso excepcional.

## Consequences
Se obtiene una defensa en dos capas contra duplicación de efectos de negocio, consistente en todo el sistema, a cambio de exigir que cada nuevo caso de uso con efecto de estado declare explícitamente su clave de idempotencia y su invariante de respaldo.

### Positive Consequences
- Consistencia: no hay cuatro soluciones distintas al mismo problema en cuatro partes del sistema, sino una convención única aplicada en todos los puntos de entrada.
- Defensa en profundidad: aunque la idempotency key falle (ej. un llamador no la envía correctamente), el invariante de negocio en base de datos sigue protegiendo contra el efecto duplicado más costoso (doble-booking, doble cobro).
- Al asumir "at-least-once" como norma (no como caso especial), el diseño de cada nuevo caso de uso incorpora la pregunta de idempotencia desde el inicio, no como un parche posterior.

### Negative Consequences
- Cada caso de uso con efecto de estado debe diseñar explícitamente su clave de idempotencia — trabajo adicional que no existiría si se asumiera (incorrectamente) entrega exactly-once.
- Mantener un registro de idempotency keys ya procesadas (para el punto 1) requiere almacenamiento y una política de expiración propia (no puede crecer indefinidamente).

## Risks
- **Idempotency key mal derivada** (ej. dos mensajes de WhatsApp genuinamente distintos comparten la misma clave por error) causaría que una acción legítima se descarte como duplicado. Mitigación: la derivación de la clave debe basarse en un identificador único real del mensaje/evento origen (ej. el ID de mensaje de WhatsApp), no en una aproximación heurística.
- **Falsa sensación de seguridad** si un equipo asume que la idempotency key por sí sola es suficiente y omite el invariante de respaldo en base de datos: mitigado por exigir ambas capas como parte de la definición de "terminado" de cualquier caso de uso con efecto de estado (ADR-019).

## Alternatives Rejected
- **Sin convención compartida, resolución caso por caso**: rechazada. El riesgo de inconsistencia entre los cuatro puntos donde el problema ya apareció (IA, API, DB, jobs) es alto, y un error de idempotencia en `Anticipos` tiene consecuencias financieras directas — no es un riesgo aceptable de dejar a criterio individual sin una convención explícita.
- **Confiar únicamente en deduplicación de infraestructura de mensajería**: rechazada. Ninguna infraestructura de colas/mensajería realista garantiza exactly-once de forma absoluta en presencia de fallos parciales — diseñar asumiendo esa garantía es una fuente conocida de bugs sutiles y difíciles de reproducir.

## Future Revisit Criteria
- Se detecta un caso real de duplicación de efecto de negocio en producción — señal de que alguna de las dos capas de esta estrategia no se implementó correctamente en ese caso de uso específico.
- El volumen de idempotency keys almacenadas requiere una política de expiración más sofisticada que la inicialmente asumida.
