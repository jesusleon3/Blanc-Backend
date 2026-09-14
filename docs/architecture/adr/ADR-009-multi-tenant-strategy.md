# ADR-009

## Title
Estrategia de Multi-Tenancy: single-tenant en despliegue, fronteras de dominio tenant-ready

## Status
Proposed — pendiente de aprobación del cliente

## Context
El encargo original de este proyecto lo describió como "una plataforma SaaS empresarial". El Domain Discovery confirmó que, en la práctica, Blanc es un sistema de **un solo cliente**, explícitamente no multiempresa, con crecimiento previsto en número de sucursales (3 → 4 → posiblemente 5), no en número de clientes/organizaciones distintas. No existe hoy ningún segundo cliente confirmado ni una decisión de negocio de productizar la plataforma comercialmente.

## Problem Statement
¿Se construye la plataforma con soporte multi-tenant (múltiples organizaciones/clientes aislados) desde el día 1, o como un sistema single-tenant? Si es single-tenant, ¿cómo se evita que esa decisión bloquee una eventual expansión sin un rediseño completo?

## Constraints
- Un solo cliente confirmado hoy; expansión a más clientes es especulativa, no un requisito confirmado.
- El aislamiento incorrecto entre tenants (fuga de datos entre clientes) es uno de los riesgos de seguridad más severos que existen en sistemas SaaS — no es un patrón que deba implementarse "por si acaso" sin necesidad real.
- El Domain Discovery ya modela `Sucursal` como el límite natural de configuración (horarios, precios, personal) dentro del cliente actual — es un candidato natural para convertirse en el nivel *debajo* de un futuro concepto de "organización/tenant", no al mismo nivel.
- El principio rector de simplicidad proporcional (sección 1.3, `02-architecture-principles.md`) exige no construir para una escala que no existe.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Multi-tenant compartido desde el día 1 (modelo "Pool") | Esquema compartido con `tenant_id` en cada tabla, aislamiento vía filtros/row-level security en cada consulta. |
| B. Single-tenant estricto, sin ningún concepto de tenant en el código | El sistema asume una sola organización de forma implícita e hardcodeada en toda la base de código. |
| C. Single-tenant en despliegue, con fronteras de dominio ya "tenant-ready" | Un solo cliente por despliegue hoy; el dominio se modela ya scoped por `Sucursal` (sin asumir un número fijo de sucursales ni datos hardcodeados de "Blanc" en la lógica), dejando un punto de extensión natural para introducir un concepto de organización por encima de `Sucursal` si aparece un segundo cliente. |

## Decision
Se adopta la **Opción C**. El sistema se despliega hoy como single-tenant (una instancia y una base de datos dedicadas a Blanc). El dominio no asume un número fijo de sucursales ni codifica el nombre o identidad de "Blanc" en ninguna regla de negocio — toda configuración (horarios, servicios, precios, personal, número de WhatsApp) ya vive scoped por `Sucursal` como dato, no como código. Si en el futuro aparece un segundo cliente real, la estrategia de expansión por defecto es el **modelo "Silo"**: una instancia y base de datos dedicada por cliente, no un esquema compartido multi-tenant — introduciendo un concepto de "Organización" por encima de `Sucursal` como una migración aditiva, no como una reescritura.

## Consequences
Se evita construir infraestructura de aislamiento multi-tenant (con su propio riesgo de seguridad) para una necesidad que no existe hoy, sin cerrar la puerta a una expansión futura ordenada.

### Positive Consequences
- No se paga el costo de ingeniería ni el riesgo de seguridad de un modelo de aislamiento multi-tenant (row-level security, riesgo de fuga de datos entre clientes) para un único cliente confirmado.
- El uso de `Sucursal` como límite de configuración ya existente hace que agregar un segundo cliente sea, en el peor caso, desplegar una segunda instancia — no una migración de datos compleja dentro de un esquema compartido.
- Ninguna decisión de esta fase bloquea crecer de 3 a 5 sucursales del mismo cliente, que es el crecimiento real confirmado.

### Negative Consequences
- Si el cliente decide productizar Blanc comercialmente para otros salones, onboarding de un segundo cliente implica un proyecto real (introducir el concepto de "Organización", decidir aislamiento Silo vs. Pool para ese caso específico), no un simple flag de configuración.
- El modelo Silo (una instancia por cliente) tiene un costo de infraestructura por cliente mayor que un modelo Pool compartido si algún día se necesitara operar muchos clientes pequeños de forma económica — esa optimización no está disponible por defecto con esta decisión.

## Risks
- **Presión de negocio repentina para "vender esto a otros salones" sin tiempo de rediseño**: mitigado porque este ADR deja explícito el camino de expansión (Silo primero), evitando que la decisión se tome de forma improvisada bajo presión comercial.
- **Hardcoding accidental de supuestos de un solo cliente** en el código pese a esta decisión (ej. asumir exactamente 3 sucursales en validaciones, o un solo esquema de roles sin scope de organización). Mitigación: revisión de arquitectura debe verificar que ninguna regla de negocio nueva asuma "solo existe Blanc" de forma implícita.

## Alternatives Rejected
- **Multi-tenant compartido desde el día 1**: rechazada. Es exactamente el tipo de complejidad especulativa que el principio de simplicidad proporcional busca evitar — construir aislamiento robusto multi-tenant (con su propio riesgo de seguridad si se hace mal) para un solo cliente confirmado no tiene retorno hoy.
- **Single-tenant estricto sin fronteras de dominio preparadas**: rechazada. Hardcodear supuestos de un solo cliente en la lógica de negocio (en vez de en la configuración de despliegue) haría que incluso el crecimiento *ya confirmado* del propio Blanc (4ª y eventual 5ª sucursal) friccionara contra el diseño, y bloquearía cualquier expansión futura sin una reescritura significativa.

## Future Revisit Criteria
- Aparece un segundo cliente real (firma comercial confirmada), no solo especulación de crecimiento.
- El cliente toma la decisión explícita de productizar Blanc como oferta comercial para otros salones — en ese momento se evalúa formalmente Silo vs. Pool con datos reales de cuántos clientes potenciales y de qué tamaño se esperan, no de forma especulativa como en este ADR.

## Nota de extensión (2026-08-04)
`ADR-023` es el mecanismo formal que opera el concepto de "Organización" que la `Decision` de este ADR ya anticipaba (línea 30) como migración aditiva por encima de `Sucursal`. `ADR-023` no rediseña el modelo Silo ni el concepto de Organización en sí — formaliza cómo el código (Core Platform/Domain Policies/Client Specification/Extension Points) soporta esa expansión. Dar estructura formal nueva a "Organización" (campos, cardinalidad, relación con `Sucursal`) sigue sin diseñarse — no se ejecuta aquí, requiere autorización explícita. Detalle completo en `ADR-023` y `PLATFORM_ARCHITECTURE_MODEL.md`; no se reabre `Decision` ni `Options Considered` de este documento.
