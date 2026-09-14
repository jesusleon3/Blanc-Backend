# ADR-012

## Title
Estrategia de despliegue: entornos Development/Sandbox/Production, despliegue continuo con migraciones compatibles hacia atrás

## Status
Proposed — pendiente de aprobación del cliente (proveedor de hosting específico se decide en la fase de arquitectura técnica)

## Context
El cliente pidió explícitamente un **entorno sandbox** para probar cambios (especialmente de prompts de IA y configuración de sucursal) antes de publicarlos, y un **modo mantenimiento** para detener uno o todos los bots. El sistema se despliega como Modular Monolith (ADR-001) y opera durante horario comercial extendido (lunes a sábado) donde una interrupción tiene impacto directo en la capacidad de agendar citas.

## Problem Statement
¿Qué entornos existen, cómo se promueven los cambios entre ellos, y cómo se despliega sin interrumpir la disponibilidad del canal de agendamiento durante horario comercial?

## Constraints
- El cliente requiere explícitamente un entorno sandbox, distinto de producción, antes de publicar cambios.
- El sistema no puede depender de una ventana de mantenimiento larga — WhatsApp puede recibir mensajes en cualquier momento del horario comercial (lunes a sábado, según horarios definidos en el Domain Discovery).
- Las migraciones de base de datos (ADR-005) no deben requerir downtime para desplegarse junto con el código.
- El "modo mantenimiento" pedido por el cliente es una capacidad de negocio (detener uno o todos los bots), no solo una operación de infraestructura.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Despliegue manual, sin entornos separados | Cambios aplicados directamente en producción sin ambiente de prueba previo. |
| B. Entornos Development, Sandbox, Production con CI/CD automatizado y despliegue rolling/blue-green | Pipeline con promoción entre ambientes, verificación de salud y rollback automático ante fallo. |
| C. Entornos por rama/preview por cada Pull Request | Un ambiente efímero por cada cambio en revisión. |

## Decision
Se adopta la **Opción B**, con tres entornos: **Development** (interno, cambios en curso), **Sandbox** (aislado, con números de WhatsApp/configuración de prueba, donde se validan cambios de prompt y configuración de sucursal antes de publicarse — satisface el requisito explícito del cliente), y **Production**. El pipeline de CI/CD promueve cambios automáticamente hacia Sandbox, con una puerta de aprobación manual antes de promover a Production. Los despliegues a Production usan estrategia rolling o blue-green, preferentemente fuera de las horas de mayor tráfico, con verificación de salud automática y rollback automático si las métricas de error superan un umbral tras el despliegue. Las migraciones de base de datos siguen el patrón expand/contract (agregar antes de quitar, nunca un cambio destructivo en el mismo despliegue que lo empieza a usar) para permitir despliegues sin downtime.

## Consequences
Se obtiene la capacidad de validar cambios (incluyendo prompts de IA) sin arriesgar producción, y despliegues sin downtime, a cambio de la complejidad de mantener tres entornos y disciplina de migraciones compatibles hacia atrás.

### Positive Consequences
- Satisface directamente el requisito explícito del cliente de probar cambios en sandbox antes de publicarlos.
- Despliegues sin downtime durante horario comercial, crítico para un canal de agendamiento activo.
- Rollback automático ante degradación reduce el tiempo de exposición a un despliegue defectuoso.
- El "modo mantenimiento" (deteniendo uno o todos los bots) se implementa como una capacidad de negocio operable en caliente, no como sacar el sistema de línea.

### Negative Consequences
- Mantener tres entornos implica costo de infraestructura y de datos de prueba adicionales (Sandbox necesita su propia configuración de WhatsApp/IA aislada de producción).
- Migraciones expand/contract son más lentas de implementar que un cambio de esquema directo (requieren un paso intermedio de compatibilidad).
- La puerta de aprobación manual antes de Production añade fricción deliberada — es un tradeoff aceptado a favor de seguridad sobre velocidad, consistente con el principio rector del proyecto.

## Risks
- **Sandbox mal aislado de producción** (ej. compartiendo el mismo número de WhatsApp o la misma cuenta de IA) anularía su propósito y podría filtrar pruebas a clientas reales. Mitigación: Sandbox debe tener credenciales y configuración completamente separadas de Production, verificado explícitamente antes de considerarse operativo.
- **Migraciones no compatibles hacia atrás** desplegadas por error causarían downtime pese a la estrategia rolling/blue-green. Mitigación: revisión obligatoria de migraciones como parte del proceso de PR.
- **Modo mantenimiento mal implementado** podría detener el bot pero dejar mensajes entrantes sin ningún manejo (silencio total hacia la clienta). Mitigación: el modo mantenimiento debe definir explícitamente el comportamiento hacia el usuario final (ej. mensaje automático indicando que el equipo responderá manualmente), no solo apagar el procesamiento.

## Alternatives Rejected
- **Despliegue manual sin entornos separados**: rechazada. Contradice directamente el requisito explícito del cliente de un entorno sandbox, y no da ninguna red de seguridad antes de exponer un cambio a clientas reales.
- **Entornos efímeros por Pull Request**: no rechazada de forma permanente, pero no adoptada como parte de esta decisión inicial — es una mejora incremental razonable sobre la Opción B que puede añadirse después sin contradecir esta decisión, no un reemplazo de Sandbox/Production.

## Future Revisit Criteria
- Selección del proveedor de hosting/orquestación específico en `03-technical-architecture.md`.
- Si la cadencia de despliegue crece significativamente (varios despliegues diarios), evaluar añadir entornos de preview por Pull Request como complemento a Sandbox.
