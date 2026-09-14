# ADR-002

## Title
Arquitectura Hexagonal + Clean Architecture + Vertical Slice Architecture combinadas

## Status
Proposed — pendiente de aprobación del cliente

## Context
El dominio de Blanc depende de integraciones externas volátiles o de riesgo elevado: un proveedor de WhatsApp potencialmente no oficial (ADR-008), un único proveedor de IA (ADR-007), y una integración de calendario externo (ADR-006). El Domain Discovery ya identificó una lista extensa y estable de casos de uso (sección 6 de `01-domain-discovery.md`). El cliente exigió explícitamente que "toda la lógica de negocio" viva en código determinista, no en el modelo de IA.

## Problem Statement
¿Cómo se organiza el código para que la lógica de negocio sea independiente de proveedores externos reemplazables, testeable sin IA ni infraestructura real, y evolucione sin que cambios pequeños obliguen a tocar múltiples capas no relacionadas?

## Constraints
- El dominio no debe depender de SDKs concretos de WhatsApp, Google Calendar u OpenAI.
- Debe ser posible probar la lógica de negocio (ej. cálculo de cotización, invariantes de agenda) sin invocar un LLM real ni una API externa.
- La lista de casos de uso ya está definida por el Domain Discovery y es el eje natural de organización del trabajo por sprints.
- Equipo pequeño: la organización del código no debe generar cuellos de botella de coordinación (todos editando los mismos archivos técnicos compartidos).

## Options Considered

| Opción | Descripción |
|---|---|
| A. Clean Architecture en capas técnicas compartidas | Carpetas por tipo técnico (`controllers/`, `services/`, `repositories/`, `dtos/`) compartidas por todos los casos de uso. |
| B. MVC / capas simples sin aislamiento de dominio | Controladores llaman directamente a SDKs externos y al ORM; sin puertos ni abstracción. |
| C. Hexagonal (Ports & Adapters) + Clean Architecture (regla de dependencia) + Vertical Slice Architecture (organización por caso de uso) | Dominio aislado vía puertos/adaptadores, regla de dependencia hacia adentro, capa de aplicación organizada por caso de uso en vez de por capa técnica. |

## Decision
Se adopta la **Opción C**. El dominio (entidades, aggregates, value objects, domain events) no importa ningún framework, SDK de terceros ni detalle de transporte. Todo acceso al exterior pasa por un puerto definido por el dominio e implementado por un adaptador de infraestructura. La capa de aplicación se organiza en rebanadas verticales autocontenidas por caso de uso (comando/consulta + handler + validación + DTOs), no en carpetas técnicas compartidas. El modelo de dominio permanece compartido dentro de cada Bounded Context — Vertical Slice organiza la capa de aplicación, no reemplaza el modelo de dominio.

## Consequences
Mayor disciplina y costo de diseño en las primeras semanas, a cambio de que los tres riesgos de integración externa identificados en el Domain Discovery (WhatsApp, IA, Google Calendar) queden aislados detrás de interfaces reemplazables y de que el dominio sea testeable sin ellos.

### Positive Consequences
- Los proveedores externos (WhatsApp, IA, Calendario) pueden reemplazarse o mockearse sin tocar lógica de negocio.
- El dominio se puede testear exhaustivamente sin IA ni servicios externos en el ciclo (unit tests puros).
- Cada caso de uso es una unidad clara, auditable y trazable — alineado con el requisito de "grabación de todas las decisiones de la IA" (cada acción disparada por IA invoca un caso de uso identificable).
- Evita el cuello de botella de coordinación de carpetas técnicas compartidas por decenas de casos de uso no relacionados.

### Negative Consequences
- Mayor cantidad de código boilerplate (puertos, DTOs por slice) comparado con llamar directo a un SDK o al ORM.
- Curva de aprendizaje mayor para desarrolladores acostumbrados a MVC simple.
- Riesgo de duplicación superficial entre slices similares (ej. `ConfirmarCita` y `ReprogramarCita`) si no se vigila qué es duplicación de forma vs. duplicación de lógica de negocio real.

## Risks
- **Modelo anémico por mal uso de Vertical Slices**: si los handlers empiezan a contener lógica de negocio que debería vivir en el dominio, se pierde el valor del patrón. Mitigación: revisión de código que exija que las reglas de negocio (invariantes, cálculos) vivan en entidades/aggregates/servicios de dominio, no en handlers.
- **Sobrediseño de puertos para integraciones que nunca cambiarán**: mitigado exigiendo que cada puerto tenga una razón de negocio concreta (ya existen tres: WhatsApp, IA, Calendario, con riesgo de reemplazo documentado), no puertos especulativos para todo.

## Alternatives Rejected
- **Clean Architecture en capas técnicas compartidas**: rechazada como organización primaria. Es el anti-patrón donde `services/` y `controllers/` se convierten en cuellos de botella de coordinación entre casos de uso no relacionados, y donde un cambio pequeño a un caso de uso obliga a tocar varias carpetas.
- **MVC/capas simples sin aislamiento de dominio**: rechazada. Acoplaría directamente la lógica de negocio a WhatsApp, al SDK de IA y al ORM, contradiciendo el principio explícito del cliente de que la lógica de negocio no puede depender del comportamiento de la IA ni de un proveedor externo específico.

## Future Revisit Criteria
- Si, en la práctica, ningún puerto llega a tener más de un adaptador real ni se prevé que lo tenga (señal de que el costo de abstracción no se está pagando con flexibilidad real), revisar si el nivel de abstracción es el correcto para esa integración específica.
- Si la organización por Vertical Slice genera duplicación de lógica de negocio real (no solo de forma) de manera recurrente, revisar si el modelo de dominio compartido dentro del contexto está siendo suficientemente rico.

## Nota de extensión (2026-08-04)
`ADR-023` reconoce una segunda familia de puertos, orientada a decisiones de dominio (Domain Policies) en vez de a infraestructura — extiende la misma regla de dependencia de este ADR, no la contradice. Detalle completo en `ADR-023` y `PLATFORM_ARCHITECTURE_MODEL.md`; no se reabre `Decision` ni `Options Considered` de este documento.
