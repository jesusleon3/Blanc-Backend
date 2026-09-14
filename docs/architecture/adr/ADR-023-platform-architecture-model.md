# ADR-023

## Title
Modelo Arquitectónico de Plataforma: Core Platform, Domain Policies, Client Specification y Extension Points (ADR agregado — no estaba en la lista original)

## Status
Accepted — 2026-08-03. El modelo subyacente (`PLATFORM_ARCHITECTURE_MODEL.md`) fue aprobado y congelado explícitamente por el cliente en la misma fecha; esta ADR formaliza esa aprobación.

## Context
Blanc, originalmente diseñado como un sistema de un solo cliente (ADR-009), evolucionó su objetivo hacia una plataforma reutilizable para clientes futuros. `PLATFORM_ARCHITECTURE_MODEL.md` (2026-08-03) formaliza cómo lograr esa reutilización sin sacrificar la riqueza del dominio ya modelado (Business Rules, Decision Flows, aggregates), a través de un modelo de cuatro capas — después de un intento de refutación explícito (su Sección 5) que descartó tres de los siete candidatos de variabilidad originalmente considerados por sobreabstracción especulativa, y de revisiones sucesivas que formalizaron el criterio de creación de nuevas políticas (§3), el principio de Reference Implementation (§4), y la recomendación (§5.7) de registrar esta decisión como un ADR independiente en vez de enmendar ADR-002 y ADR-009 por separado — el mismo patrón de consolidación que este proyecto ya usó para crear ADR-021 y ADR-022.

## Problem Statement
¿Cómo se estructura la plataforma para que el comportamiento específico de cada cliente pueda variar — incluyendo casos con lógica real de decisión, no solo valores — sin duplicar el dominio ya modelado y minimizando los cambios sobre el código compartido al incorporar un cliente nuevo?

## Constraints
- Ninguna variación de cliente puede desactivar un invariante de Core Platform (`PLATFORM_ARCHITECTURE_MODEL.md` §2).
- Una variación se abstrae como Domain Policy únicamente con evidencia real de un segundo cliente concreto o plausible, nunca de forma especulativa (§3, anti-test) — el propio proyecto ya identificó un caso real de sobreabstracción especulativa evitable (`RN-COT-08`, citado en §3.3).
- Las Domain Policies representan únicamente variabilidad de dominio; la variabilidad técnica (proveedores externos, motores de IA, bases de datos, infraestructura en general) pertenece siempre a Extension Points, ya gobernados por ADR-002 (§1).
- El modelo de despliegue Silo de ADR-009 no cambia — la variabilidad de cliente se resuelve dentro de una instancia, no reestructurando la topología de despliegue.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Modelo de tres capas sin Domain Policies — toda la variabilidad de cliente resuelta como Client Specification (datos) | Primera clasificación presentada en la misma sesión; nunca se persistió en un archivo (ver nota de relación en el encabezado de `PLATFORM_ARCHITECTURE_MODEL.md`) |
| B. Modelo de cuatro capas con Domain Policies como interfaces de dominio tipadas, filtradas por un criterio de evidencia de seis puntos, con Reference Implementation compartida | La adoptada — desarrollada en `PLATFORM_ARCHITECTURE_MODEL.md` completo |

## Decision
Se adopta la **Opción B**. Esta ADR declara oficialmente:

1. El modelo arquitectónico de la plataforma queda estructurado en **cuatro capas**: Core Platform, Domain Policies, Client Specification y Extension Points.
2. **Core Platform depende únicamente de las interfaces de las Domain Policies, nunca de una implementación concreta** — la misma regla de dependencia hacia adentro que ADR-002 ya exige para infraestructura, extendida aquí a decisiones de dominio.
3. Queda formalizada la separación entre **Core Platform**, **Domain Policies**, su **Reference Implementation** (la implementación de referencia que la plataforma mantiene y que usa Blanc hoy), **Client Specification** (solo datos, sin lógica) y **Extension Points** (adaptadores de infraestructura, gobernados por ADR-002).
4. **Las Domain Policies representan únicamente variabilidad de dominio, nunca variabilidad técnica** — un cambio de proveedor externo, motor de IA, base de datos o cualquier infraestructura es siempre un Extension Point, sin excepción.
5. **La creación de cualquier Domain Policy nueva, presente o futura, requiere pasar el criterio de seis puntos y el anti-test de evidencia definidos en `PLATFORM_ARCHITECTURE_MODEL.md` §3** — sin excepción, sin decisión automática.
6. **`PLATFORM_ARCHITECTURE_MODEL.md` queda como el documento normativo de detalle** de esta decisión. Contiene la mecánica completa (checklist de creación, Reference Implementation, mapeo a Decision Flows, proceso de onboarding de un cliente nuevo, intento de refutación) y no se duplica aquí.

## Consequences
Se obtiene un mecanismo acotado y evidenciado para incorporar clientes futuros sin construir un mecanismo de configuración universal ni reescribir el Core por cada nuevo cliente, a cambio de introducir una capa conceptual nueva que exige disciplina continua para no sobreabstraerse.

### Positive Consequences
- Permite incorporar un cliente nuevo escalando por niveles de costo creciente (datos → nueva implementación de una Policy existente → nueva Policy → Core Platform como último recurso), con el Core Platform como el último lugar que se modifica (§11).
- Evita la sobreabstracción especulativa: de los siete candidatos de variabilidad originalmente considerados, solo cuatro superaron el criterio de evidencia (§3, §7, §8).
- Blanc permanece como la referencia, no como la excepción — su implementación de cada una de las cuatro Domain Policies es, hoy, la Reference Implementation (§4).

### Negative Consequences
- El modelo depende de que el equipo aplique con disciplina el criterio de la Sección 3 en cada decisión futura; sin esa disciplina, el riesgo de sobreabstracción especulativa que el propio intento de refutación identificó (§5.1) podría repetirse.
- `PoliticaDeGarantia` queda sin Bounded Context formal en `01-domain-discovery.md` — prerrequisito pendiente antes de poder implementarla (§10).
- El valor real del modelo solo se confirma cuando aparezca un segundo cliente — hasta entonces, la Reference Implementation y la implementación de Blanc son, literalmente, la misma clase (§4).

## Risks
- Que una Domain Policy futura se cree sin pasar el checklist de evidencia de `PLATFORM_ARCHITECTURE_MODEL.md` §3 — mitigado por dejarlo establecido como regla arquitectónica permanente, no como una recomendación.
- Que una necesidad de infraestructura (proveedor de IA, base de datos, canal externo) se confunda con una Domain Policy — mitigado por el principio explícito de que las Domain Policies son variabilidad de dominio, nunca técnica, y por su exclusión explícita del checklist de creación (§1, §3).
- Que esta ADR y `PLATFORM_ARCHITECTURE_MODEL.md` diverjan con el tiempo si se actualiza uno sin el otro — mitigado porque esta ADR remite al documento como única fuente normativa de la mecánica, sin duplicar contenido (Decisión, punto 6).

## Alternatives Rejected
- **Modelo de tres capas sin Domain Policies (Opción A):** rechazado porque resuelve como datos decisiones que, en cuatro casos con evidencia concreta (`PoliticaDeCotizacion`, `PoliticaDeDisponibilidad`, `PoliticaDeRiesgoCliente`, `PoliticaDeGarantia`), requieren un procedimiento de decisión distinto entre clientes, no solo un valor distinto — intento de refutación completo en `PLATFORM_ARCHITECTURE_MODEL.md` §5, evidencia caso por caso en §7.
- **Enmendar ADR-002 y ADR-009 en lugar de crear un ADR independiente:** rechazado tras intento de refutación explícito (`PLATFORM_ARCHITECTURE_MODEL.md` §5.7) — el tema estaba disperso en cuatro ADRs (002, 009, 015, 020) sin una decisión única que los gobernara, el mismo patrón de fragmentación que ya justificó crear ADR-021 y ADR-022 en este proyecto.

## Future Revisit Criteria
- Aparece un segundo cliente real — momento en el que se evalúa, con evidencia concreta, si su comportamiento cabe en las Reference Implementations existentes o si alguna requiere una implementación nueva (§4, §11).
- Se identifica un candidato nuevo que supera el checklist completo de seis criterios y el anti-test de evidencia de §3 — se formaliza como una quinta Domain Policy siguiendo el mismo proceso.
- Se resuelve el hallazgo de que Garantías no tiene Bounded Context en `01-domain-discovery.md` (§10) — habilita completar formalmente `PoliticaDeGarantia`.
