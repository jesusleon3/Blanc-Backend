# ADR-016

## Title
Estrategia de Human Handoff: estado de modo autoritativo con re-verificación previa a cada respuesta, entrega garantizada de notificación con escalamiento-de-escalamiento

## Status
Proposed — pendiente de aprobación del cliente

## Context
El Domain Discovery define el Bounded Context de Escalamiento: ante imagen, audio complicado, queja o palabra prohibida, el bot debe detener la IA, crear un ticket, notificar al empleado por WhatsApp, y permitir que el humano continúe manualmente desde la plataforma, devolviendo el control al bot mediante acción explícita después. Este es uno de los flujos con mayor impacto reputacional directo si falla (una clienta molesta sin respuesta es, según el propio Domain Discovery, uno de los peores escenarios posibles).

## Problem Statement
¿Cómo se garantiza, a nivel de arquitectura, que (a) la IA realmente deja de responder en el instante en que se escala, sin condición de carrera, y (b) la notificación al empleado llega de forma confiable, incluso si el primer intento falla?

## Constraints
- Debe evitarse la condición de carrera donde la IA responde justo después de que un humano ya tomó el control.
- La notificación de escalamiento no puede fallar en silencio — es el flujo de mayor sensibilidad reputacional del sistema.
- El humano debe operar desde la plataforma con visibilidad casi inmediata de los mensajes entrantes mientras tiene el control.
- El retorno de control al bot debe ser una acción explícita del humano, nunca automática por timeout (ya definido en el Domain Discovery).

## Options Considered

| Opción | Descripción |
|---|---|
| A. Notificación "fire-and-forget", modo de conversación cacheado en memoria de proceso | Notificación enviada una vez sin garantía de entrega; el estado bot/humano se lee de una caché que puede quedar desactualizada. |
| B. Modo de conversación como campo autoritativo re-verificado antes de cada respuesta de IA + notificación con entrega garantizada (Outbox, ADR-004) y escalamiento-de-escalamiento ante fallo de entrega | El estado se lee siempre de la fuente de verdad inmediatamente antes de generar una respuesta; la notificación se reintenta hasta confirmarse, con una ruta de respaldo si el primer intento falla repetidamente. |
| C. Notificación síncrona bloqueante dentro del mismo flujo de respuesta de IA | La generación de respuesta del bot espera a que la notificación se entregue antes de continuar. |

## Decision
Se adopta la **Opción B**. El modo de conversación (`bot` | `humano`) es un campo único y autoritativo del aggregate `Conversacion`. Inmediatamente antes de generar o enviar cualquier respuesta de IA, el caso de uso revalida el modo actual contra la fuente de verdad (no contra una copia en caché), cerrando la ventana de condición de carrera. La notificación de escalamiento al empleado usa el patrón Transactional Outbox (ADR-004) con reintento hasta confirmación de entrega; si la notificación falla repetidamente dentro de un umbral de tiempo, se activa una **ruta de escalamiento-de-escalamiento** (notificar a un segundo empleado o a un rol de supervisión) en vez de dejar el ticket sin notificación efectiva.

## Consequences
Se cierra la ventana de condición de carrera entre IA y humano, y se elimina el escenario de "notificación de escalamiento silenciosamente perdida", a cambio de una revalidación de estado en cada respuesta de IA y de un mecanismo de reintento/escalamiento adicional que debe implementarse y probarse con cuidado.

### Positive Consequences
- Elimina el riesgo de que la IA responda después de que un humano ya tomó el control de una conversación escalada.
- La entrega de la notificación de escalamiento tiene garantía de al menos un intento confirmado o una escalada de respaldo, no un envío único sin seguimiento.
- El diseño es consistente con el resto de la arquitectura (mismo mecanismo de Outbox que ya se usa para otros efectos externos críticos, ADR-004).

### Negative Consequences
- Revalidar el modo de conversación antes de cada respuesta añade una consulta adicional al flujo de generación de respuesta (costo de latencia menor, pero real).
- El mecanismo de escalamiento-de-escalamiento añade una pieza de lógica y de configuración adicional (a quién escalar si el primer intento falla) que debe mantenerse actualizada operativamente.

## Risks
- **Definición de la ruta de escalamiento-de-escalamiento no configurada** (ej. no hay un segundo empleado definido para una sucursal pequeña): mitigación mínima aceptable es que, en ausencia de un segundo destinatario configurado, se reintente de forma más agresiva y se genere una alerta de observabilidad (ADR-011) de alta prioridad en vez de fallar en silencio.
- **Latencia añadida por la revalidación de estado** en sistemas de muy alta concurrencia: no se considera un riesgo real a la escala actual (3–4 sucursales), pero se documenta como un costo aceptado.

## Alternatives Rejected
- **Notificación "fire-and-forget" con estado cacheado en memoria**: rechazada. Es exactamente el patrón que permite tanto la condición de carrera IA/humano como la pérdida silenciosa de una notificación de escalamiento — ambos escenarios inaceptables dado el impacto reputacional descrito en el Domain Discovery.
- **Notificación síncrona bloqueante dentro del flujo de IA**: rechazada. Acoplaría la latencia de respuesta conversacional a la garantía de entrega de la notificación, degradando la experiencia de la clienta en el peor momento posible (justo cuando algo salió mal).

## Future Revisit Criteria
- Se define formalmente (Domain Discovery, pregunta abierta pendiente de definición operativa) quién es el destinatario de respaldo de la ruta de escalamiento-de-escalamiento por sucursal.
- Evidencia real de latencia de revalidación de estado que impacte la experiencia conversacional a mayor volumen.
