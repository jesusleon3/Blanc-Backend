# ADR-014

## Title
Versionado de APIs basado en URI, contract-first, con contratos internos y públicos diferenciados desde el inicio

## Status
Proposed — pendiente de aprobación del cliente

## Context
El cliente mencionó explícitamente el interés futuro en una **API pública** para integrarse con sistemas POS o de inventario. Hoy, la única API existente sería consumida internamente (frontend de la plataforma, capa de IA/Conversación). No hay todavía un integrador externo real.

## Problem Statement
¿Cómo se versiona la API para que un cambio interno no rompa a un futuro integrador externo, sin sobre-diseñar una API pública que todavía no tiene consumidores reales?

## Constraints
- No existe hoy un consumidor externo real — no se debe construir una capa de API pública completa antes de que se necesite.
- El cambio de contrato de una API ya usada por un integrador externo (futuro) es mucho más costoso de gestionar sin versionado que dentro de un sistema cerrado.
- El equipo debe adoptar el hábito y la disciplina de contratos versionados antes de que la API pública exista, para que no sea una reconstrucción posterior.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Versionado por header (ej. `Accept-Version`) | La versión se negocia vía cabecera HTTP. |
| B. Versionado en la URI (ej. `/v1/...`) | La versión es explícita y visible en la ruta. |
| C. Sin versionado hasta que exista un consumidor externo real | Postergar cualquier disciplina de versionado hasta que la API pública se construya. |

## Decision
Se adopta la **Opción B — versionado en la URI**, aplicado desde el primer endpoint, incluso para la API de uso interno. Se establece la distinción explícita entre **contrato interno** (consumido por el frontend de la plataforma y por la capa de Conversación) y **contrato público futuro** (para integradores POS/inventario) — pueden compartir implementación al inicio, pero se diseñan y versionan como contratos independientes desde el nombre de la ruta, para no tener que "extraer" una API pública de una interna ya acoplada más adelante. Todo diseño de contrato es **contract-first**: se define el esquema antes de implementar.

## Consequences
Se adopta disciplina de contrato desde el día 1, a un costo bajo (versionar una API interna no es significativamente más caro que no hacerlo), evitando construir una API pública completa antes de tener demanda real.

### Positive Consequences
- El hábito y la tooling de versionado ya existen cuando la API pública se construya — no es una reconstrucción, es una extensión.
- El versionado por URI es el más simple de entender, depurar y probar manualmente para un futuro integrador externo (relevante si ese integrador es un proveedor de POS con su propio equipo técnico, no necesariamente sofisticado en negociación de contenido HTTP).
- Contract-first evita que el contrato "emerja" accidentalmente de la implementación, lo cual facilita mantenerlo estable.

### Negative Consequences
- Versionar desde el día 1 una API que hoy solo consume el propio frontend es, en el margen, trabajo que no se cobra en valor inmediato.
- Mantener contratos internos y públicos conceptualmente separados desde el inicio, aunque compartan implementación, requiere disciplina de diseño incluso antes de que el contrato público tenga un solo consumidor real.

## Risks
- **Versionar de más, de forma prematura, para casos de uso que nunca se hacen públicos**: mitigado porque el costo marginal de versionar por URI es bajo y no implica construir infraestructura de gestión de versiones múltiples en paralelo, solo una convención de nombres y disciplina de contrato.
- **El contrato público real termine siendo muy distinto del interno** una vez que aparezca el primer integrador real, invalidando el diseño anticipado: aceptado como riesgo razonable — la alternativa (no pensar en ello hasta que exista el integrador) es peor porque parte de un contrato interno ya acoplado a necesidades de UI que un integrador externo no comparte.

## Alternatives Rejected
- **Versionado por header**: rechazado como default. Es menos explícito/depurable para un integrador externo no sofisticado, y no aporta ventaja real sobre el versionado por URI para el perfil de consumidores esperado (plataforma propia, futuro integrador POS).
- **Sin versionado hasta que exista un consumidor externo real**: rechazado. Retrofitting de versionado sobre una API interna ya en uso (por el frontend y por la capa de Conversación) es más disruptivo que adoptar la disciplina desde el inicio, cuando el costo marginal es bajo.

## Future Revisit Criteria
- Aparece el primer integrador externo real (POS/inventario) — validar que el contrato público diseñado de forma anticipada realmente encaja con sus necesidades, y ajustar si no.
- Se define una política formal de deprecación (tiempo mínimo de aviso, soporte de versiones concurrentes) una vez exista al menos un consumidor externo real al que aplicarla.
