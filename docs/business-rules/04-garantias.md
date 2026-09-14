# Categoría: Garantías (`RN-GAR`)

> Dominio de negocio completamente nuevo, identificado en la Sesión 02 de Domain Discovery. Cubre el reclamo de un problema con un servicio ya realizado.

---

### RN-GAR-01 — Cobertura de garantía de 7 días

| Campo | Valor |
|---|---|
| Rule ID | RN-GAR-01 |
| Nombre | Cobertura de garantía de 7 días |
| Objetivo | Dar respuesta ordenada a una clienta cuando el producto aplicado falla poco después del servicio. |
| Descripción | La garantía cubre el producto aplicado durante los 7 días posteriores al servicio. |
| Categoría | Garantías |
| Alcance | Global (a confirmar si varía por sucursal, ver `RN-GAR-06`) |
| Disparador | La clienta reporta un problema con un servicio dentro de los 7 días posteriores. |
| Precondiciones | Existe una cita completada dentro de la ventana de 7 días. |
| Entradas requeridas | Fecha del servicio original, fecha del reclamo. |
| Lógica de negocio | Si `fecha_reclamo - fecha_servicio <= 7 días` → la solicitud está dentro de vigencia. |
| Resultado esperado | La solicitud se marca dentro o fuera de vigencia según la ventana. |
| Ejemplos | `gar-1`: reclamo dentro de vigencia (cita hace pocos días). `gar-2`: reclamo fuera de vigencia (cita hace 10 días, marcada `vencida`). |
| Excepciones | Ninguna conocida sobre la ventana en sí — ver `RN-GAR-05` para coincidencia parcial. |
| Prioridad | High |
| Consumidores | IA, Recepción, Backend |
| Dependencias | Depende de: RN-GAR-02. Es dependencia de: RN-GAR-03 |
| Fuente | Sesión 02 de Domain Discovery, regla N1 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-07-12 |
| Notas | — |

---

### RN-GAR-02 — Solo aplica a servicio completado

| Campo | Valor |
|---|---|
| Rule ID | RN-GAR-02 |
| Nombre | La garantía solo aplica a un servicio efectivamente realizado |
| Objetivo | Evitar solicitudes de garantía sobre citas que nunca se llevaron a cabo. |
| Descripción | La solicitud de garantía solo es válida si corresponde a un servicio efectivamente realizado y completado — no aplica sobre una cita cancelada o no realizada. |
| Categoría | Garantías |
| Alcance | Global |
| Disparador | Registro de una solicitud de garantía. |
| Precondiciones | Existe una cita asociada al reclamo. |
| Entradas requeridas | Estado de la cita asociada (`completada`, `cancelada`, `no_show`, etc.). |
| Lógica de negocio | Si `estado_cita != completada` → la solicitud no es válida por este criterio, independientemente de la ventana de tiempo. |
| Resultado esperado | Ninguna solicitud sobre una cita no completada se marca como válida. |
| Ejemplos | Una garantía sobre `cit-1016` (cancelada) no sería válida bajo este criterio. |
| Excepciones | Ninguna conocida. |
| Prioridad | High |
| Consumidores | Backend, QA |
| Dependencias | Es dependencia de: RN-GAR-01 |
| Fuente | Sesión 02 de Domain Discovery / `functional-scope.md` §3.6 (precisión funcional de N1) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-07-12 |
| Notas | — |

---

### RN-GAR-03 — Nunca aprobación automática

| Campo | Valor |
|---|---|
| Rule ID | RN-GAR-03 |
| Nombre | Ninguna garantía se aprueba automáticamente |
| Objetivo | Mantener control humano sobre la decisión final de una garantía, incluso con validación automática favorable. |
| Descripción | Ninguna solicitud de garantía se aprueba de forma automática — toda solicitud, sea válida o no según la validación automática, se envía a revisión de una persona antes de tener efecto. |
| Categoría | Garantías |
| Alcance | Global |
| Disparador | Registro de cualquier solicitud de garantía. |
| Precondiciones | Ninguna — aplica siempre, sin excepción. |
| Entradas requeridas | Resultado de `RN-GAR-01` y `RN-GAR-02`. |
| Lógica de negocio | Independientemente del resultado de la validación automática → la solicitud pasa a estado `en_revision`, nunca se resuelve sola. |
| Resultado esperado | Toda solicitud requiere una acción humana explícita antes de tener efecto sobre la clienta. |
| Ejemplos | En el mockup, la única acción disponible sobre una garantía es "enviar a revisión" — nunca una aprobación automática simulada. |
| Excepciones | Ninguna — es una decisión explícita sin excepciones previstas. |
| Prioridad | High |
| Consumidores | IA, Recepción, Gerente |
| Dependencias | Depende de: RN-GAR-01, RN-GAR-02 |
| Fuente | Sesión 02 de Domain Discovery (decisión explícita) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-07-12 |
| Notas | Esta regla es la que define el diseño de UI del mockup (tab de Garantías en el perfil de clienta con una sola acción posible). |

---

### RN-GAR-04 — Beneficio exacto de la garantía

| Campo | Valor |
|---|---|
| Rule ID | RN-GAR-04 |
| Nombre | Beneficio exacto de una garantía válida |
| Objetivo | Definir qué recibe la clienta ante una garantía válida. |
| Descripción | No hay un beneficio fijo ni automatizado — la garantía la maneja manualmente la Dueña (o la persona que interactúa con la plataforma), caso por caso. |
| Categoría | Garantías |
| Alcance | Global |
| Disparador | Una solicitud de garantía llega a revisión humana (`RN-GAR-03`). |
| Precondiciones | La solicitud ya pasó por `RN-GAR-01`/`RN-GAR-02`. |
| Entradas requeridas | Ninguna estructurada — es una decisión discrecional del revisor humano. |
| Lógica de negocio | El beneficio (reposición, descuento, u otro) se decide manualmente en cada caso; el sistema no calcula ni sugiere un beneficio automático. |
| Resultado esperado | Ninguna clienta recibe un beneficio determinado automáticamente por el sistema. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.15 (2026-08-04): *"La garantía la va a manejar manualmente la dueña y la persona que interactúe con la plataforma."* |
| Excepciones | Ninguna — es una decisión de negocio válida: 100% discrecional, sin regla automática. |
| Prioridad | High |
| Consumidores | Recepción, Gerente |
| Dependencias | Depende de: RN-GAR-01, RN-GAR-03 |
| Fuente | Sesión 02 de Domain Discovery, pregunta abierta 2; `DISCOVERY_CHECKLIST.md` 1.15 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | Consistente con `RN-GAR-03` (nunca aprobación automática). **Pendiente real, no bloqueante para esta regla:** `PLATFORM_ARCHITECTURE_MODEL.md` §10 señala que Garantías no tiene Bounded Context propio en `01-domain-discovery.md` — eso bloquea formalizar `PoliticaDeGarantia` a nivel de código, no bloquea esta documentación de negocio. |

---

### RN-GAR-05 — Tratamiento de coincidencia parcial

| Campo | Valor |
|---|---|
| Rule ID | RN-GAR-05 |
| Nombre | Tratamiento de coincidencia parcial en garantías |
| Objetivo | Definir el tratamiento cuando el problema reportado no coincide exactamente con el servicio realizado. |
| Descripción | Mismo tratamiento que cualquier solicitud de garantía: se envía a revisión humana con la discrepancia marcada explícitamente — no hay una regla automática distinta para la coincidencia parcial. |
| Categoría | Garantías |
| Alcance | Global |
| Disparador | Una solicitud de garantía cuyo problema reportado no coincide exactamente con el servicio de la cita asociada. |
| Precondiciones | Ninguna adicional a `RN-GAR-01`/`RN-GAR-02`. |
| Entradas requeridas | Ninguna estructurada. |
| Lógica de negocio | La discrepancia se marca explícitamente y la solicitud sigue el mismo camino que cualquier otra: revisión humana obligatoria (`RN-GAR-03`), sin resultado automático. |
| Resultado esperado | Ninguna coincidencia parcial se resuelve sin intervención humana. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.16 (2026-08-04): misma respuesta que 1.15 — gestión manual y discrecional. |
| Excepciones | Ninguna. |
| Prioridad | Medium |
| Consumidores | Recepción, Gerente |
| Dependencias | Depende de: RN-GAR-01, RN-GAR-02, RN-GAR-03 |
| Fuente | Sesión 02 de Domain Discovery, pregunta abierta 2; `DISCOVERY_CHECKLIST.md` 1.16 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | No se requiere acción adicional urgente — el comportamiento por defecto de `RN-GAR-03` ya cubre este caso de forma segura. |

---

### RN-GAR-06 — ¿Política de garantía varía por sucursal?

| Campo | Valor |
|---|---|
| Rule ID | RN-GAR-06 |
| Nombre | Variación de la política de garantía por sucursal |
| Objetivo | Determinar si la política de garantía varía por sucursal. |
| Descripción | No hay variación formal por sucursal — al ser un proceso 100% discrecional y manual (`RN-GAR-04`/`RN-GAR-05`), la política es de facto global. |
| Categoría | Garantías |
| Alcance | Global |
| Disparador | No aplica — no hay bifurcación por sucursal. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Ninguna. |
| Lógica de negocio | La ventana de 7 días (`RN-GAR-01`) y la gestión manual (`RN-GAR-03`/`RN-GAR-04`) aplican igual en todas las sucursales. |
| Resultado esperado | Ninguna sucursal opera con una política de garantía distinta a las demás. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.17 (2026-08-04): misma respuesta que 1.15/1.16 — gestión manual y discrecional. |
| Excepciones | Ninguna. |
| Prioridad | Low |
| Consumidores | Recepción, Gerente |
| Dependencias | Depende de: RN-GAR-01 |
| Fuente | Sesión 02 de Domain Discovery, pregunta abierta 2; `DISCOVERY_CHECKLIST.md` 1.17 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | Se interpreta la ausencia de variación formal como política global de facto, dado que todo el módulo se trata como discrecional caso por caso. |
