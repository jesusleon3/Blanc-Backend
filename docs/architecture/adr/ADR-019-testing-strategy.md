# ADR-019

## Title
Estrategia de Testing: pirámide alineada a las capas arquitectónicas, con conjunto de regresión conversacional ("golden set") para IA

## Status
Proposed — pendiente de aprobación del cliente

## Context
La arquitectura (ADR-002) aísla explícitamente el dominio de infraestructura y de IA mediante puertos/adaptadores. Existen invariantes de negocio críticos (no-doble-booking, cálculo de cotización) y un componente de comportamiento no determinista (la IA) que las pruebas unitarias tradicionales no pueden validar directamente en cuanto a calidad de tono/interpretación.

## Problem Statement
¿Qué estrategia de pruebas garantiza confianza en los invariantes de negocio sin depender de IA ni de servicios externos reales, y cómo se detectan regresiones de calidad conversacional cuando se cambia un prompt (ADR-015)?

## Constraints
- El dominio debe poder probarse exhaustivamente sin invocar IA, WhatsApp o Google Calendar reales — habilitado directamente por ADR-002.
- Los cambios de prompt necesitan un mecanismo de validación de calidad antes de promoverse a producción (ADR-015, ADR-012).
- Pruebas end-to-end completas son valiosas pero costosas de mantener — no deben ser la única ni la principal red de seguridad.
- El equipo es pequeño — la estrategia de testing debe dar el máximo de confianza por el mínimo de mantenimiento posible.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Solo QA manual | Sin automatización de pruebas, verificación humana antes de cada release. |
| B. Pirámide de pruebas por capa arquitectónica (dominio, aplicación, adaptadores, end-to-end) + conjunto de regresión conversacional para IA | Pruebas unitarias exhaustivas en dominio, pruebas de aplicación con adaptadores falsos, pruebas de contrato para integraciones externas, un conjunto reducido de pruebas end-to-end del camino crítico, y un "golden set" de conversaciones de referencia para validar prompts. |
| C. Predominio de pruebas end-to-end | La mayoría de la confianza se deposita en pruebas que ejercitan el sistema completo. |

## Decision
Se adopta la **Opción B**. La estrategia de pruebas se organiza por capa:
- **Dominio** (entidades, aggregates, value objects, invariantes): pruebas unitarias exhaustivas, sin infraestructura ni IA — la capa donde vive la mayor complejidad de negocio (Domain Discovery) debe tener la mayor cobertura.
- **Aplicación** (casos de uso / Vertical Slices, ADR-002): pruebas con adaptadores falsos (fakes/in-memory), verificando orquestación y reglas de aplicación sin llamar servicios reales.
- **Adaptadores** (WhatsApp, Google Calendar, OpenAI): pruebas de contrato contra respuestas grabadas/simuladas, no contra los servicios reales en cada ejecución de CI.
- **End-to-end**: un conjunto reducido de pruebas que cubren el camino crítico (conversación → cotización → agendamiento → confirmación) ejecutadas contra el entorno Sandbox (ADR-012), no contra producción.
- **Regresión conversacional de IA**: un conjunto fijo de transcripciones de conversación de referencia ("golden set") que se ejecuta antes de promover cualquier nueva versión de prompt (ADR-015) a producción, como sustituto práctico de una prueba unitaria tradicional para validar tono/calidad de interpretación.

## Consequences
Se obtiene alta confianza en los invariantes de negocio con bajo costo de mantenimiento (dominio aislado y rápido de probar), y un mecanismo concreto de control de calidad para cambios de prompt que de otra forma serían imposibles de validar automáticamente.

### Positive Consequences
- Los invariantes más críticos (no-doble-booking, cálculo de cotización por uña) quedan cubiertos por pruebas rápidas y deterministas, sin depender de servicios externos ni de IA.
- El golden set da una señal objetiva de regresión de calidad conversacional antes de exponer un cambio de prompt a clientas reales — sin él, ADR-015 (sandbox de prompts) no tendría un criterio de aceptación real, solo revisión subjetiva.
- Las pruebas de contrato contra adaptadores evitan que la suite de CI dependa de la disponibilidad de WhatsApp/Google Calendar/OpenAI reales.

### Negative Consequences
- Mantener un golden set de conversaciones de referencia representativo y actualizado es trabajo continuo, no un esfuerzo de una sola vez.
- Las pruebas de contrato contra respuestas grabadas pueden quedar desactualizadas si el proveedor externo cambia su comportamiento sin que el equipo lo note (mitigado parcialmente por observabilidad de producción, ADR-011, no eliminado).

## Risks
- **Golden set no representativo** de los casos reales más frecuentes o más riesgosos (ej. clientas molestas, composiciones de servicio complejas): mitigado incorporando activamente transcripciones reales anonimizadas de producción al conjunto de referencia con el tiempo, no solo casos sintéticos iniciales.
- **Sobreinversión en pruebas end-to-end** que terminen siendo lentas y frágiles si no se limitan deliberadamente al camino crítico: mitigado por mantener ese conjunto deliberadamente pequeño, como se decide en este ADR.

## Alternatives Rejected
- **Solo QA manual**: rechazada. Inaceptable para un sistema con invariantes financieros (anticipos) y de agendamiento (no-doble-booking) que deben verificarse en cada cambio, no solo antes de cada release.
- **Predominio de pruebas end-to-end**: rechazada como estrategia principal. Serían lentas, frágiles ante cambios de UI/integración, y no aprovecharían el aislamiento que la arquitectura hexagonal (ADR-002) ya ofrece para probar el dominio de forma rápida y determinista.

## Future Revisit Criteria
- El golden set de conversaciones crece lo suficiente como para requerir categorización/priorización explícita (ej. por tipo de riesgo: cotización, escalamiento, venta cruzada).
- Se identifica un patrón de fallo recurrente en producción no cubierto por ninguna capa de la pirámide actual — se agrega como caso de prueba explícito, no se ignora como "caso raro".
