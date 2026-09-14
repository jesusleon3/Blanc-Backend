# ADR-011

## Title
Observabilidad basada en OpenTelemetry, con correlación end-to-end e instrumentación de IA como categoría propia

## Status
Proposed — pendiente de aprobación del cliente (backend de visualización específico se decide en la fase de arquitectura técnica)

## Context
Blanc es, por naturaleza, un sistema conversacional donde una sola interacción de una clienta cruza múltiples componentes: webhook de WhatsApp → interpretación de IA → caso de uso de dominio → domain event → notificación de salida. El cliente pidió explícitamente monitoreo, alertas y un dashboard de KPIs que incluye métricas técnicas (tiempo de respuesta, costo de IA, tokens consumidos) junto a métricas de negocio.

## Problem Statement
¿Cómo se instrumenta el sistema para poder depurar un flujo que cruza varios componentes, distinguir entre observabilidad técnica (operación del sistema) y KPIs de negocio (dashboard), y detectar tanto fallos de infraestructura como violaciones de invariantes de negocio?

## Constraints
- Un solo fallo de usuario puede cruzar 4–5 componentes distintos — sin correlación, depurar es adivinar.
- El costo de IA es una preocupación explícita del cliente y debe monitorearse con el mismo rigor que la infraestructura.
- El backend específico de visualización (ej. Grafana/Loki u otro) es una decisión de la fase de arquitectura técnica, no de este documento.
- Retrofitting de instrumentación es costoso y típicamente incompleto — la instrumentación debe exigirse desde el primer caso de uso, no añadirse después.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Instrumentar después, una vez elegido el stack técnico final | Posponer logs/métricas/trazas estructuradas hasta tener el backend de observabilidad decidido. |
| B. Instrumentar desde el día 1 con un estándar vendor-neutral (OpenTelemetry) | Exigir logs estructurados, métricas y trazas con un ID de correlación desde el primer caso de uso, independientemente del backend final. |
| C. Framework de logging propio | Construir una solución de instrumentación a medida. |

## Decision
Se adopta la **Opción B**. Todo código nuevo debe emitir logs estructurados, métricas y trazas siguiendo convenciones compatibles con OpenTelemetry desde el primer caso de uso implementado, con un **ID de correlación propagado end-to-end** (mensaje de WhatsApp → conversación → llamada de IA → caso de uso de dominio → evento de dominio → notificación de salida). La observabilidad técnica (para ingeniería/operación) y los KPIs de negocio del dashboard (para el negocio) se modelan como **una sola fuente de datos con dos proyecciones distintas** — no como dos sistemas separados: "costo de IA" y "tokens consumidos", por ejemplo, son el mismo dato consumido por ambas audiencias. La instrumentación de llamadas a IA se trata como categoría propia: cada llamada registra latencia, tokens, costo, versión de prompt (ADR-015) y resultado (éxito, ambigüedad, fallback a humano).

## Consequences
Se obtiene capacidad de depuración end-to-end y una única fuente de verdad para métricas técnicas y de negocio, a cambio de exigir disciplina de instrumentación desde el primer commit, antes de que el backend final esté decidido.

### Positive Consequences
- Un incidente que cruza varios componentes puede depurarse siguiendo un solo ID de correlación, en vez de correlacionar logs manualmente entre sistemas.
- Evita instrumentación retroactiva incompleta — el problema más común en proyectos que posponen observabilidad.
- El dashboard de negocio y la operación técnica comparten fuente de datos, evitando duplicación e inconsistencia entre "lo que ve el negocio" y "lo que ve ingeniería".
- Al ser vendor-neutral, la elección del backend de visualización en la fase de arquitectura técnica no requiere reinstrumentar el código.

### Negative Consequences
- Disciplina de instrumentación añade trabajo a cada caso de uso desde el inicio, incluso antes de que exista un dashboard que consuma esos datos.
- Sin un backend de agregación/visualización aún decidido, los datos instrumentados no generan valor visible inmediato — requiere confianza en que se pagará ese trabajo por adelantado.

## Risks
- **Instrumentación inconsistente entre desarrolladores** sin una convención clara: mitigado exigiendo la propagación del ID de correlación como parte del contrato de cada caso de uso (Vertical Slice, ADR-002), revisable en PR.
- **Alertas solo sobre señales de infraestructura, ignorando invariantes de negocio**: se decide explícitamente que un doble-booking (si ocurriera pese a ADR-005) o una notificación de escalamiento no entregada (ADR-004, ADR-016) deben alertar con la misma o mayor prioridad que un CPU alto — es un principio, no un detalle de implementación a decidir después.
- **Costo de almacenamiento de logs/trazas** a medida que crece el volumen de conversaciones: se gestiona junto con la política de retención de ADR-022, no de forma indefinida por defecto.

## Alternatives Rejected
- **Instrumentar después de elegir el stack técnico final**: rechazada. La experiencia general de la industria (y el riesgo específico de este sistema, con IA y múltiples integraciones externas) es que la instrumentación retroactiva es costosa e incompleta — se pierde justo la visibilidad de los primeros incidentes, que suelen ser los más informativos.
- **Framework de logging propio**: rechazado. Reinventar observabilidad estructurada no aporta ventaja competitiva (es un Generic Subdomain, según el Domain Discovery) y renuncia al ecosistema de herramientas compatible con un estándar ya adoptado ampliamente en la industria.

## Future Revisit Criteria
- Selección del backend de visualización/almacenamiento específico en `03-technical-architecture.md`.
- Definición de umbrales concretos de alerta (SLOs) una vez exista tráfico real medible — este ADR establece el principio, no los números exactos.
