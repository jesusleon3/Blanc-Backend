# ADR-005

## Title
PostgreSQL como única base de datos física, con separación lógica estricta por Bounded Context

## Status
Proposed — pendiente de aprobación del cliente

## Context
Blanc opera como Modular Monolith (ADR-001) con 10 Bounded Contexts definidos en el Domain Discovery. El cliente propuso PostgreSQL (vía Supabase) como referencia de stack. Existen invariantes transaccionales críticos (no-doble-booking en `Agenda`, consistencia de `Anticipo`) y datos de naturaleza muy distinta (relacional estructurado para citas/clientas, eventos/mensajes de alto volumen para `Conversación`).

## Problem Statement
¿Se usa una sola base de datos para todo el sistema, una base de datos por Bounded Context, o una combinación poliglota según el tipo de dato? ¿Cómo se evita que una sola base de datos compartida erosione las fronteras de contexto que el Domain Discovery definió?

## Constraints
- Los invariantes de `Agenda` requieren transacciones ACID confiables y control de concurrencia real (no eventual).
- El equipo no debe operar múltiples motores de base de datos distintos sin una razón concreta — complejidad operativa proporcional a la escala real (3–4 sucursales, un cliente).
- Las fronteras de Bounded Context deben preservarse también en persistencia, no solo en código, o se pierden con el tiempo (riesgo ya señalado en ADR-001).
- Debe conservarse la posibilidad de migrar un contexto a una base de datos propia si algún día se extrae a servicio independiente.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Una base de datos por Bounded Context desde el inicio | Cada uno de los 10 contextos con su propio motor/instancia de base de datos. |
| B. Un esquema único sin separación | Todas las tablas de todos los contextos en el mismo esquema, sin barrera lógica. |
| C. Un motor de base de datos (PostgreSQL), con esquemas/namespaces separados por Bounded Context, sin llaves foráneas entre esquemas | Separación lógica estricta dentro de una única base de datos física. |
| D. Poliglota (ej. PostgreSQL para datos transaccionales + almacén de documentos para `Conversación`) | Motor distinto según la naturaleza del dato de cada contexto. |

## Decision
Se adopta la **Opción C**. PostgreSQL como único motor de base de datos en esta fase, con un esquema/namespace separado por Bounded Context (`agenda`, `catalogo`, `crm`, `conversacion`, etc.). No se permiten llaves foráneas de base de datos entre esquemas de distintos contextos — las referencias cruzadas se guardan como identificadores simples (ej. `Cita.clientaId`) y se resuelven a través del caso de uso público del contexto propietario o vía eventos, nunca con un `JOIN` directo entre esquemas.

## Consequences
Se obtiene la simplicidad operativa de un solo motor de base de datos y transacciones ACID locales para los invariantes críticos, preservando al mismo tiempo la posibilidad de extraer un contexto a su propia base de datos como un paso incremental, no como un rediseño.

### Positive Consequences
- Transacciones ACID nativas dentro de un contexto (ej. `Cita` + su invariante de no-doble-booking) sin necesidad de coordinación distribuida.
- Un solo motor que operar, respaldar y monitorear — proporcional a la escala real del proyecto.
- La separación por esquema hace *incómodo a propósito* el acceso directo entre contextos, reforzando en la base de datos la disciplina de frontera que ADR-001 exige en el código.
- Migrar un contexto a una base de datos propia en el futuro es un cambio incremental (mover su esquema), no una reescritura del modelo de datos.

### Negative Consequences
- Todos los contextos comparten los recursos de un solo motor de base de datos — un contexto con carga pesada (ej. `Conversación`, alto volumen de mensajes) puede competir por recursos con `Agenda` en horas pico.
- La disciplina de "sin FKs entre esquemas" debe hacerse cumplir por convención/revisión de código y de migraciones, PostgreSQL no lo impide técnicamente por sí solo si alguien decide ignorarla.
- No hay aislamiento físico de fallos: un problema del motor de base de datos afecta a todos los contextos a la vez (mitigado parcialmente por la estrategia de backup/DR, ADR-022).

## Risks
- **Volumen de `Conversación` (mensajes) degradando el rendimiento de `Agenda`** con el tiempo. Mitigación: monitoreo por esquema desde el día 1 (ADR-011); el modelo de lectura de Analítica ya está desacoplado (ADR-003) para no agravar esto.
- **Erosión de la separación de esquemas** por conveniencia puntual de un desarrollador bajo presión. Mitigación: la misma revisión de arquitectura obligatoria de ADR-001 aplica a migraciones que crucen esquemas.
- **Snapshot de cotización mal implementado** permitiría que el precio de una cita ya confirmada cambie retroactivamente si el catálogo se actualiza — este ADR asume el snapshot inmutable ya definido como supuesto de trabajo en el Domain Discovery (pendiente de confirmación de negocio).

## Alternatives Rejected
- **Una base de datos por contexto desde el inicio**: rechazada. La complejidad operativa de administrar y respaldar 10 bases de datos independientes no está justificada por la escala actual, y renuncia sin necesidad a la simplicidad de transacciones ACID locales que el Modular Monolith aprovecha para sus invariantes más críticos.
- **Esquema único sin separación**: rechazada. Facilita el acoplamiento accidental entre contextos vía `JOIN`s directos, exactamente el riesgo que ADR-001 busca evitar — habría hecho el Domain Discovery un ejercicio decorativo sin consecuencia real en el código.
- **Poliglota desde el inicio**: rechazada por ahora. Ningún contexto tiene hoy un requisito de modelo de datos que PostgreSQL no pueda resolver razonablemente bien (incluyendo datos semi-estructurados vía JSONB si `Conversación` lo requiere); introducir un segundo motor sin una necesidad concreta añade complejidad operativa no justificada.

## Future Revisit Criteria
- Un contexto necesita escalar o desplegarse independientemente (mismo gatillo que ADR-001/ADR-004) — en ese momento, migrar su esquema a una base de datos propia.
- Evidencia real de contención de recursos entre contextos que el monitoreo por esquema no pueda mitigar con indexación/optimización.
- Un contexto específico desarrolla un requisito de modelo de datos que PostgreSQL no cubre razonablemente bien (ej. búsqueda vectorial a gran escala, si la estrategia de IA lo llegara a requerir de forma central).
