# ADR-006

## Title
Estrategia de integración con Google Calendar: la plataforma es la fuente de verdad, Google Calendar es una proyección

## Status
Accepted — confirmado explícitamente por la Dueña (`DISCOVERY_CHECKLIST.md` 1.1, 2026-08-03). Ver nota de latencia agregada 2026-08-04.

## Context
El negocio usa hoy Google Calendar como su herramienta operativa diaria, organizada por color, un calendario por sucursal (según la lectura del Domain Discovery de la respuesta a la pregunta 9 de negocio). El cliente indicó: *"Google Calendar se mantiene tal cual, es la vista que usa el negocio. La plataforma sincroniza con Google Calendar."* Esta frase no resuelve, por sí sola, quién es la autoridad en caso de conflicto — fue registrada como Pregunta Abierta #1 en el Domain Discovery, con un supuesto de trabajo ya adoptado (la plataforma es la fuente de verdad).

## Problem Statement
¿Quién es la fuente de verdad del estado de una cita: la plataforma Blanc o Google Calendar? ¿Cómo se sincronizan, y qué ocurre si hay un conflicto (ej. el negocio edita un evento directamente en Google Calendar)?

## Constraints
- El invariante de no-doble-booking debe garantizarse de forma confiable (ADR-005) — solo es posible si hay una única autoridad transaccional.
- El negocio seguirá consultando visualmente Google Calendar en el corto/mediano plazo — la migración de hábito operativo no es instantánea.
- La API de Google Calendar es una integración externa con sus propios límites de tasa y posibilidad de fallo — no puede ser un punto único de fallo para poder agendar una cita.
- El cliente ya expresó, a través del consultor de negocio, que reconoce el valor de que la plataforma sea la fuente de verdad "por ser más escalable" — hay una señal de alineación, no solo una suposición unilateral.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Google Calendar como fuente de verdad | La plataforma lee/escribe en Google Calendar y ese es el estado autoritativo; el modelo interno de `Agenda` es una caché. |
| B. Sincronización bidireccional sin autoridad única | Ambos sistemas pueden escribir y se reconcilian con una estrategia de "último cambio gana" o similar. |
| C. La plataforma es la fuente de verdad; Google Calendar es una proyección de solo lectura (push unidireccional) | Toda escritura de cita ocurre en la plataforma; los cambios se reflejan hacia Google Calendar, nunca al revés. |

## Decision
Se adopta la **Opción C**. `Agenda` (el aggregate `Cita`, ADR-005) es la única fuente de verdad. Un adaptador de salida (Anti-Corruption Layer, ADR-002) traduce los cambios de estado de `Cita` a eventos de Google Calendar y los empuja a un calendario por sucursal. Google Calendar no es consultado como fuente de disponibilidad ni de estado de una cita — es exclusivamente la vista operativa que el negocio ya usa. La escritura directa en Google Calendar por parte del negocio (fuera de la plataforma) no se sincroniza de vuelta en esta primera versión.

## Consequences
El invariante de no-doble-booking queda garantizado íntegramente dentro del control de la plataforma, sin depender de la disponibilidad ni de la coherencia de una API externa para tomar esa decisión — a cambio de que el negocio deba dejar de editar directamente en Google Calendar como flujo válido de trabajo.

### Positive Consequences
- El invariante crítico de no-doble-booking se resuelve en una sola transacción local (ADR-005), sin depender de la disponibilidad de la API de Google Calendar.
- Un fallo o caída de Google Calendar degrada la *vista* del negocio, no la capacidad de agendar citas — la plataforma sigue funcionando.
- El modelo interno de `Cita` no se contamina con el formato/limitaciones de eventos de Google Calendar (colores, límites de campos).
- Camino claro y simple de razonar: un solo escritor, una sola dirección de sincronización.

### Negative Consequences
- Si un empleado edita o borra un evento directamente en Google Calendar (hábito actual del negocio), ese cambio **no** se refleja en la plataforma y quedará sobrescrito en la próxima sincronización — esto puede generar confusión operativa si no se comunica y gestiona el cambio de hábito con el negocio.
- Requiere gestión de cambio con el equipo del salón: deben aprender a que "la verdad" ahora vive en la plataforma, no en Google Calendar, aunque sigan mirando Google Calendar visualmente.
- Un fallo prolongado en la sincronización hacia Google Calendar deja al negocio operando "a ciegas" en su herramienta habitual, aunque la plataforma internamente esté correcta.

## Risks
- **Riesgo principal, no técnico sino de adopción**: el negocio podría seguir editando directamente en Google Calendar por costumbre, generando una fuente de verdad dividida de facto aunque el diseño sea unidireccional. Mitigación: el rollout debe incluir capacitación explícita y, en el mediano plazo, evaluar bloquear o desalentar la edición directa (ej. eventos marcados como "gestionados por Blanc, no editar aquí").
- **Retraso o fallo de sincronización** deja la vista de Google Calendar desactualizada respecto a la plataforma. Mitigación: reintentos con Outbox (ADR-004), alertar si el rezago de sincronización supera un umbral (ADR-011).
- ~~Este ADR resuelve una ambigüedad de negocio no confirmada explícitamente (Pregunta Abierta #1 del Domain Discovery)...~~ **Resuelto (`DISCOVERY_CHECKLIST.md` 1.1, 2026-08-03):** confirmado explícitamente por la Dueña. Riesgo cerrado. **Nuevo requisito revelado en la misma respuesta:** exige sincronización "en tiempo real o cerca de eso" — pendiente de cotejar contra el SLO provisional de rezago de Outbox (`03-technical-architecture.md` §6.3), fuera de alcance de esta actualización.

## Alternatives Rejected
- **Google Calendar como fuente de verdad**: rechazada. Acoplaría el invariante más crítico del negocio (no-doble-booking) a la disponibilidad y a los límites de tasa de una API externa, y obligaría a modelar el dominio interno alrededor de las limitaciones de Google Calendar (viola el principio de Anti-Corruption Layer, ADR-002).
- **Sincronización bidireccional sin autoridad única**: rechazada. La reconciliación de conflictos ("último cambio gana" o similar) es una fuente conocida de errores sutiles en sistemas de reservas, y agregaría una complejidad de resolución de conflictos no justificada frente a la opción C, que es mucho más simple de razonar y de depurar.

## Future Revisit Criteria
- ~~El cliente confirma explícitamente (o rechaza) esta decisión...~~ **Cumplido (`DISCOVERY_CHECKLIST.md` 1.1, 2026-08-03).**
- Si el negocio demuestra, con evidencia operativa real, que necesita editar directamente en Google Calendar como flujo de trabajo legítimo (no solo hábito), revisar hacia sincronización bidireccional con una estrategia explícita de resolución de conflictos.
