# Categoría: Escalamiento Humano (`RN-ESC`)

> Gobierna la transferencia de control entre la IA y el personal humano.

---

### RN-ESC-01 — Disparo automático de escalamiento

| Campo | Valor |
|---|---|
| Rule ID | RN-ESC-01 |
| Nombre | Disparo automático de escalamiento |
| Objetivo | Garantizar que ninguna situación fuera del alcance de la IA quede sin atención humana. |
| Descripción | Ante una imagen que requiere criterio humano, una nota de voz, una queja o el uso de una palabra sensible, la atención automática se detiene de inmediato y se crea un aviso para el personal. |
| Categoría | Escalamiento Humano |
| Alcance | Global |
| Disparador | Detección de imagen que requiere criterio humano, audio, queja, o palabra prohibida; o baja confianza / cliente molesto (`RN-CONV-05`, `RN-CONV-08`). |
| Precondiciones | Ninguna. |
| Entradas requeridas | Tipo de situación detectada, conversación relacionada. |
| Lógica de negocio | Ante cualquiera de los disparadores → crear `TicketEscalamiento`, detener respuesta automática, notificar al personal correspondiente. |
| Resultado esperado | Ninguna situación sensible queda sin ticket de escalamiento y sin notificación al personal. |
| Ejemplos | `tkt-1` (queja), `tkt-2` (palabra prohibida), `tkt-3` (imagen), `tkt-4` (audio complicado) en el mockup. |
| Excepciones | Se intenta clarificar primero ante ambigüedad simple (`RN-CONV-03`) antes de escalar por esa causa específica. |
| Prioridad | Critical |
| Consumidores | IA, Backend, Recepción |
| Dependencias | Depende de: RN-CONV-05, RN-CONV-06, RN-CONV-08, RN-CONV-09. Es dependencia de: RN-ESC-03, RN-ESC-04, RN-AUD-01 |
| Fuente | `01-domain-discovery.md` §5.4 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-ESC-02 — Revalidación de modo antes de cada respuesta del bot

| Campo | Valor |
|---|---|
| Rule ID | RN-ESC-02 |
| Nombre | Revalidación de modo antes de cada respuesta del bot |
| Objetivo | Evitar que el bot responda automáticamente justo después de que una persona ya tomó el control. |
| Descripción | El modo de una conversación (bot/humano) se verifica justo antes de que el asistente automático genere cualquier respuesta. |
| Categoría | Escalamiento Humano |
| Alcance | Global |
| Disparador | Inmediatamente antes de que la IA genere cualquier respuesta. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Modo actual de la conversación (`bot` / `humano`). |
| Lógica de negocio | Antes de generar una respuesta automática → revalidar que `modo = bot`; si cambió a `humano`, no responder. |
| Resultado esperado | Nunca hay una respuesta duplicada o contradictoria entre el bot y un humano en la misma conversación. |
| Ejemplos | En `conv-1`, tras escalar a Sofía Beltrán, el bot no vuelve a responder automáticamente. |
| Excepciones | Ninguna. |
| Prioridad | Critical |
| Consumidores | Backend, QA |
| Dependencias | Depende de: RN-CONV-01. Es dependencia de: RN-ESC-03 |
| Fuente | `01-domain-discovery.md`; ADR-016 (Human Handoff) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | El mecanismo técnico concreto (control de concurrencia optimista sobre `modo`) vive en `04-data-model.md` §5.3. |

---

### RN-ESC-03 — Retorno de control siempre explícito

| Campo | Valor |
|---|---|
| Rule ID | RN-ESC-03 |
| Nombre | Retorno de control al bot siempre explícito |
| Objetivo | Evitar que una conversación vuelva al bot sin que un humano decida activamente que ya puede hacerlo. |
| Descripción | El retorno del control al asistente automático es siempre una acción explícita del empleado — nunca ocurre de forma automática por el simple paso del tiempo. |
| Categoría | Escalamiento Humano |
| Alcance | Global |
| Disparador | Acción explícita de un empleado de "devolver control al bot". |
| Precondiciones | La conversación está en `modo = humano`. |
| Entradas requeridas | Acción del empleado. |
| Lógica de negocio | El cambio de `modo` de `humano` a `bot` solo ocurre por acción explícita del empleado, nunca por temporizador. |
| Resultado esperado | Ninguna conversación vuelve al bot sin decisión humana consciente. |
| Ejemplos | "Un empleado toma el control de una conversación escalada, responde manualmente y devuelve el control al asistente al finalizar" (`functional-scope.md` §3.3). |
| Excepciones | Ninguna. |
| Prioridad | High |
| Consumidores | Backend, Recepción |
| Dependencias | Depende de: RN-ESC-02 |
| Fuente | `01-domain-discovery.md` §5.4 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-ESC-04 — Reintento/respaldo de notificación al personal

| Campo | Valor |
|---|---|
| Rule ID | RN-ESC-04 |
| Nombre | Reintento y respaldo de notificación al personal |
| Objetivo | Garantizar que ninguna situación sensible quede sin aviso efectivo al personal por una falla de entrega. |
| Descripción | Si el intento de notificar al personal falla, el sistema debe intentarlo de nuevo o notificar a una persona de respaldo — nunca debe quedar una situación sensible sin ningún aviso efectivo. |
| Categoría | Escalamiento Humano |
| Alcance | Global |
| Disparador | Falla en la entrega de una notificación de escalamiento. |
| Precondiciones | Se creó un ticket de escalamiento (`RN-ESC-01`) y su notificación inicial falló. |
| Entradas requeridas | Estado de entrega de la notificación. |
| Lógica de negocio | Ante fallo de entrega → reintentar o notificar a un respaldo, hasta lograr una notificación exitosa. |
| Resultado esperado | Ningún ticket de escalamiento queda sin que algún empleado sea notificado efectivamente. |
| Ejemplos | Sin ejemplo concreto en el mockup — mecanismo descrito en la fuente de arquitectura (ADR-016, "escalamiento-de-escalamiento"). |
| Excepciones | Ninguna. |
| Prioridad | High |
| Consumidores | Backend |
| Dependencias | Depende de: RN-ESC-01 |
| Fuente | `01-domain-discovery.md`; ADR-016 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |
