# ADR-003

## Title
CQRS selectivo ("CQRS-lite"), sin Event Sourcing

## Status
Proposed — pendiente de aprobación del cliente

## Context
El Domain Discovery definió el contexto de `Analítica` como un consumidor puro de eventos de dominio de todos los demás contextos (dashboard estilo Stripe con KPIs de ventas, ocupación, cancelaciones, costo de IA, etc.). También definió que la búsqueda de disponibilidad de horarios en `Agenda` es una consulta de alta frecuencia con una forma muy distinta a la de escritura de una `Cita`.

## Problem Statement
¿Debe el sistema separar modelos de lectura y escritura (CQRS) de forma global, de forma selectiva, o no hacerlo en absoluto? ¿Debe adoptarse Event Sourcing como estrategia de persistencia?

## Constraints
- Escala real: un cliente, 3–4 sucursales — no millones de transacciones por segundo.
- Analítica no debe competir por recursos con transacciones de agendamiento en curso.
- Los invariantes de escritura de `Agenda` (no-doble-booking) deben seguir siendo simples de razonar (transacción ACID local, ADR-001).
- El cliente pidió trazabilidad completa de decisiones de IA, lo cual crea un volumen considerable de eventos/registros que no debe degradar el camino transaccional principal.

## Options Considered

| Opción | Descripción |
|---|---|
| A. CQRS global | Todo Bounded Context separa modelo de comando y modelo de consulta. |
| B. Sin CQRS en ningún contexto | Un solo modelo de lectura/escritura en todos los contextos, incluyendo Analítica. |
| C. CQRS selectivo ("CQRS-lite") | Modelo de lectura separado solo donde la forma de lectura difiere sustancialmente de la de escritura (Analítica, disponibilidad de Agenda); resto de contextos con modelo único. |
| D. Event Sourcing completo | Estado reconstruido a partir de un log de eventos como fuente de verdad, con proyecciones para toda consulta. |

## Decision
Se adopta la **Opción C — CQRS selectivo**, aplicado únicamente a: (1) el contexto de `Analítica`, que se alimenta como read-model de eventos de dominio de los demás contextos, y (2) la búsqueda de disponibilidad dentro de `Agenda`. El resto de los contextos (`Clientas`, `Anticipos`, `Escalamiento`, `Sucursales y Personal`, `Identidad y Accesos`) mantienen un modelo único de lectura/escritura. **Se rechaza explícitamente Event Sourcing como estrategia de persistencia** — el estado de los aggregates se persiste como estado actual (modelo transaccional convencional); los domain events se usan para integración entre contextos, no como mecanismo de reconstrucción de estado.

## Consequences
Analítica y la búsqueda de disponibilidad obtienen un modelo de lectura optimizado sin forzar esa complejidad al resto del sistema, y sin adoptar la sobrecarga operativa de Event Sourcing.

### Positive Consequences
- El dashboard de KPIs no compite por recursos ni bloquea transacciones de agendamiento en curso.
- La búsqueda de disponibilidad puede optimizarse (índices, estructura de datos) sin comprometer la simplicidad del modelo transaccional de `Cita`.
- El resto de los contextos permanece simple: un modelo, sin la complejidad de mantener sincronizados un modelo de comando y uno de consulta donde no aporta valor real.
- Se evita la complejidad operativa de Event Sourcing completo (versionado de esquema de eventos, snapshots, proyecciones para cada nueva pregunta de negocio) que no está justificada por la escala actual ni por el tamaño del equipo.

### Negative Consequences
- Analítica y disponibilidad requieren mantener un mecanismo de sincronización (proyección desde eventos) que añade una pieza móvil adicional respecto a leer directo de las tablas transaccionales.
- Los read-models pueden quedar eventualmente consistentes (no reflejar el estado más reciente de inmediato), lo cual debe ser aceptable para dashboards de negocio y no lo sería para el invariante de no-doble-booking (que sigue resolviéndose contra el modelo transaccional, no contra la proyección de disponibilidad).

## Risks
- **Confusión entre "usar domain events" y "Event Sourcing como persistencia"**: son conceptos distintos y se conflacionan con frecuencia. Mitigación: este ADR y ADR-004 documentan explícitamente la distinción; el estado de los aggregates nunca se reconstruye desde el log de eventos.
- **Divergencia entre el read-model de disponibilidad y el estado real transaccional** bajo alta concurrencia. Mitigación: la decisión final de "confirmar" una cita siempre valida contra el modelo transaccional (fuente de verdad), la proyección de disponibilidad solo acelera la búsqueda inicial, nunca es la autoridad final.

## Alternatives Rejected
- **CQRS global**: rechazada. Duplicar modelo de lectura/escritura en contextos como `Clientas` o `Anticipos`, donde la complejidad de escritura no lo justifica, sería complejidad accidental sin beneficio medible — contradice el principio de simplicidad proporcional a la escala real.
- **Event Sourcing completo**: rechazada. Es un salto de complejidad operativa (proyecciones para todo, versionado de eventos, snapshots, dificultad de consulta directa) no justificado por la escala real ni por el tamaño de equipo esperado. Los domain events ya cubren la necesidad real (integración entre contextos, alimentar Analítica) sin pagar ese costo.

## Future Revisit Criteria
- Analítica necesita reconstrucción histórica exacta de estado pasado más allá de lo que el log de auditoría (ADR-010) y los eventos de integración ya cubren.
- Un contexto transaccional distinto de Agenda desarrolla un patrón de escritura complejo (múltiples pasos, alta tasa de conflicto) que justifique separar su modelo de comando y consulta.
