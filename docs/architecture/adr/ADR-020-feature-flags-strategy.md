# ADR-020

## Title
Feature Flags de propósito acotado: kill-switch operativo y despliegue gradual, no mecanismo general de configuración

## Status
Proposed — pendiente de aprobación del cliente

## Context
El cliente pidió explícitamente un **modo mantenimiento** para detener uno o todos los bots, y un flujo de **sandbox antes de publicar cambios**. Por separado, el Domain Discovery ya define "configuración editable por sucursal" (horarios, servicios, precios, personal) como un mecanismo de **datos**, no de código.

## Problem Statement
¿Se necesita un sistema de feature flags, y si es así, para qué casos específicos — evitando confundirlo con la configuración por sucursal que ya tiene su propio mecanismo (datos, no flags)?

## Constraints
- El modo mantenimiento debe poder activarse en caliente, sin despliegue, y con alcance granular (un bot específico o todos).
- El rollout de un cambio de comportamiento (ej. una nueva versión de prompt, un nuevo caso de uso) debería poder probarse en un subconjunto de sucursales antes de expandirse a todas.
- La configuración específica por sucursal (horarios, precios, personal) ya tiene un mecanismo propio y no debe resolverse con feature flags — mezclar ambos conceptos genera confusión operativa y "flag debt" innecesario.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Sin sistema de feature flags, todo cambio requiere despliegue | Cualquier ajuste de comportamiento, incluido un kill-switch, requeriría un despliegue de código. |
| B. Sistema de flags de propósito acotado: kill-switch y rollout gradual únicamente | Flags usados exclusivamente para apagar funcionalidad de emergencia y para exponer gradualmente un cambio ya desplegado. |
| C. Sistema de flags como mecanismo general para toda condicionalidad del sistema | Flags usados también para diferenciar comportamiento por sucursal, por rol, o cualquier variación de negocio. |

## Decision
Se adopta la **Opción B**. Los feature flags se usan exclusivamente para: (1) **kill-switch de emergencia** (detener un bot específico o todos, satisfaciendo el requisito explícito de "modo mantenimiento"), y (2) **rollout gradual** de un caso de uso o versión de prompt (ADR-015) ya desplegado, expuesto primero a un subconjunto de sucursales antes de expandirse a todas. Se decide explícitamente **no usar flags** como mecanismo de configuración de negocio por sucursal (eso ya vive como datos en el contexto de Sucursales y Personal) ni como sustituto del versionado de prompts (ADR-015) — cada flag activo debe tener un propósito y una fecha de retiro esperada, para evitar acumulación de "flag debt".

## Consequences
Se obtiene la capacidad de respuesta rápida ante incidentes (kill-switch) y de despliegue gradual con bajo riesgo, sin convertir el sistema de flags en un mecanismo de configuración de negocio paralelo y confuso al ya definido por el dominio.

### Positive Consequences
- Satisface directamente el requisito explícito del cliente de un modo mantenimiento operable en caliente.
- El rollout gradual reduce el riesgo de exponer un cambio defectuoso a las 3–4 sucursales simultáneamente.
- Evita la confusión y el costo de mantenimiento a largo plazo de un sistema de flags usado como mecanismo general de configuración ("flag debt"), separando claramente "esto es una decisión de negocio por sucursal" (datos) de "esto es un interruptor operativo temporal" (flag).

### Negative Consequences
- Requiere una pieza de infraestructura para evaluar flags en tiempo real (aunque de alcance acotado, sigue siendo un componente a operar).
- Disciplina necesaria para no "abusar" del sistema de flags como atajo de configuración cuando en realidad la solución correcta es un dato de sucursal — requiere criterio de revisión de código.

## Risks
- **Uso indebido de flags para resolver necesidades de configuración por sucursal** (el atajo más tentador): mitigado explícitamente por este ADR como decisión de diseño, revisable en PR.
- **Flags de rollout gradual que nunca se retiran** una vez completado el rollout, acumulando complejidad: mitigado exigiendo que cada flag tenga un propósito documentado y se elimine del código una vez que el rollout se completa o el kill-switch ya no es necesario.

## Alternatives Rejected
- **Sin sistema de feature flags**: rechazada. No satisface el requisito explícito y operativamente crítico de un modo mantenimiento accionable sin depender de un despliegue de emergencia bajo presión (que es precisamente el escenario donde un despliegue tiene más probabilidad de salir mal).
- **Flags como mecanismo general de configuración**: rechazada. Confundiría dos conceptos que el Domain Discovery ya separó deliberadamente (configuración de negocio por sucursal, que es un dato del dominio, vs. control operativo temporal de despliegue), y generaría acumulación de complejidad innecesaria a largo plazo.

## Future Revisit Criteria
- La cadencia de rollouts graduales crece al punto de requerir segmentación más fina que "por sucursal" (ej. por rol de usuario, por porcentaje de tráfico).
- Se detecta acumulación de flags no retirados en una auditoría de código — señal de que la disciplina declarada en este ADR no se está cumpliendo en la práctica.
