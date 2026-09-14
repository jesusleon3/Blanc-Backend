# ADR-001

## Title
Modular Monolith en lugar de Microservicios como estilo de despliegue inicial

## Status
Proposed — pendiente de aprobación del cliente

## Context
Blanc es un sistema de un solo cliente (no multiempresa), con 3 sucursales activas y una 4ª prevista a corto plazo. El Domain Discovery (`01-domain-discovery.md`) identificó 10 Bounded Contexts con fronteras claras (Agenda, Catálogo y Cotización, Conversación, Escalamiento, Clientas, Anticipos, Sucursales y Personal, Identidad y Accesos, Analítica, Sincronización de Calendario). El encargo original describió el proyecto como "una plataforma SaaS empresarial", pero el descubrimiento de negocio confirmó que es un sistema de un solo tenant en su alcance actual. El equipo de ingeniería en esta fase es pequeño (no hay evidencia de múltiples equipos autónomos).

## Problem Statement
¿Debe Blanc desplegarse como un conjunto de microservicios independientes desde el inicio, o como un único desplegable internamente modularizado por Bounded Context?

## Constraints
- Un solo cliente, escala de 3–4 sucursales, no millones de usuarios.
- Invariantes de negocio críticos con dinero de por medio (anticipos) y con alto costo de inconsistencia (doble-booking).
- No hay evidencia de necesidad de escalar componentes de forma independiente hoy.
- El cliente pidió explícitamente "no sacrificar arquitectura por velocidad", pero también un enfoque por sprints incremental, no una plataforma distribuida completa antes de tener producto.
- Presupuesto/equipo no ilimitado — no se puede asumir un equipo de plataforma dedicado a operar Kubernetes/service mesh.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Microservicios desde el día 1 | Un servicio desplegable por Bounded Context (10 servicios), comunicación vía red (HTTP/gRPC/broker), bases de datos separadas. |
| B. Monolito sin modularización interna | Un único desplegable con toda la lógica mezclada, sin fronteras internas explícitas. |
| C. Modular Monolith | Un único desplegable, internamente organizado en módulos con frontera estricta por Bounded Context, comunicación interna vía interfaces explícitas y domain events. |

## Decision
Se adopta la **Opción C — Modular Monolith**. Cada Bounded Context del Domain Discovery se implementa como un módulo con API interna explícita (casos de uso públicos) y sin acceso directo a los datos internos de otro módulo.

## Consequences
El sistema se despliega y opera como una sola unidad, lo que reduce drásticamente la complejidad operativa inicial, a cambio de exigir disciplina de ingeniería para no erosionar las fronteras de módulo con el tiempo.

### Positive Consequences
- Transacciones ACID nativas de una sola base de datos para invariantes críticos (ej. no-doble-booking), sin necesidad de sagas ni transacciones distribuidas.
- Despliegue, monitoreo y depuración de una sola unidad — no requiere plataforma de orquestación distribuida ni un equipo de SRE dedicado.
- Velocidad de entrega mayor en las primeras fases: el tiempo se invierte en el dominio, no en infraestructura distribuida.
- Costo de "nos equivocamos de límite de contexto" es bajo — mover código entre módulos del mismo repositorio es un refactor, no un proyecto de migración entre servicios.
- Preserva la posibilidad real de extraer un módulo a servicio independiente en el futuro, porque la disciplina de frontera (ADR-002, ADR-006) ya obliga a que cada módulo tenga una interfaz explícita.

### Negative Consequences
- Un único proceso significa que un bug de memoria/CPU en un módulo puede degradar a los demás (sin aislamiento de fallos a nivel de proceso).
- El despliegue es todo-o-nada: no se puede desplegar un cambio de un módulo sin desplegar el binario completo.
- Requiere disciplina activa (no solo buena intención) para que los módulos no se acoplen entre sí con el tiempo.

## Risks
- **Erosión de fronteras bajo presión de entrega** ("solo un JOIN rápido, ya lo arreglamos después"). Mitigación: revisión de arquitectura obligatoria en PRs que crucen límites de módulo; separación lógica de esquemas de base de datos (ADR-005) que hace más incómodo, y por tanto menos probable, el acceso directo cruzado.
- **Escalado desigual entre módulos**: si `Conversación` recibe mucho más tráfico que el resto, escalar el monolito completo escala también lo que no lo necesita. Mitigación: monitoreo por módulo desde el día 1 para detectar esta situación con evidencia real antes de que sea un incidente.

## Alternatives Rejected
- **Microservicios desde el día 1**: rechazada. El costo de coordinación distribuida (service discovery, observabilidad distribuida, transacciones distribuidas o sagas para invariantes como no-doble-booking, despliegue orquestado) no está justificado por la escala real ni por el tamaño de equipo. Habría significado construir una plataforma distribuida completa antes de tener producto funcionando, contradiciendo la petición explícita de avanzar por sprints incrementales.
- **Monolito sin modularización interna**: rechazada. Sin fronteras internas explícitas, el sistema tiende naturalmente a convertirse en un "big ball of mud" donde cambiar una regla de negocio de `Agenda` puede romper `CRM` de forma no evidente, y una futura extracción a servicios (si alguna vez es necesaria) requeriría un rediseño completo en vez de una extracción incremental.

## Future Revisit Criteria
- Blanc pasa de cliente único a plataforma multi-cliente real (no solo crecimiento de sucursales del mismo cliente).
- Un módulo específico (candidato natural: `Conversación`, por volumen de tráfico de WhatsApp y sensibilidad a latencia) necesita desplegarse o escalar a una cadencia distinta del resto, con evidencia de carga real medida, no proyectada.
- El equipo de ingeniería crece a múltiples equipos autónomos que se bloquean mutuamente trabajando sobre el mismo desplegable.
