# Categoría: Notificaciones (`RN-NOT`)

> Gobierna el envío automático de mensajes asociados al ciclo de vida de una cita.

---

### RN-NOT-01 — Confirmación automática de cita

| Campo | Valor |
|---|---|
| Rule ID | RN-NOT-01 |
| Nombre | Confirmación automática de cita |
| Objetivo | Mantener informada a la clienta sin depender de que el personal lo haga manualmente. |
| Descripción | Toda cita confirmada recibe una notificación de confirmación automática. |
| Categoría | Notificaciones |
| Alcance | Global |
| Disparador | Una cita pasa a estado confirmado. |
| Precondiciones | La cita fue confirmada (`RN-AGE-01`, `RN-AGE-02`). |
| Entradas requeridas | Datos de la cita, canal de contacto de la clienta (WhatsApp). |
| Lógica de negocio | Al confirmarse una cita → generar y enviar notificación de confirmación por WhatsApp. |
| Resultado esperado | La clienta recibe confirmación inmediata tras agendar. |
| Ejemplos | `not-2`, `not-6` en el mockup: notificaciones de tipo `confirmación` ya enviadas. |
| Excepciones | Ninguna conocida. |
| Prioridad | Medium |
| Consumidores | Backend, IA |
| Dependencias | Depende de: RN-AGE-01. Relacionada con: RN-CONV-11 |
| Fuente | `01-domain-discovery.md` §5.12; `DISCOVERY_CHECKLIST.md` 1.23 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | **Actualizado 2026-08-04:** `RN-CONV-11` ya se resolvió — la confirmación es interactiva, no push unidireccional. El ajuste que esta nota ya anticipaba aplica: esta regla probablemente deba distinguir entre el mensaje que **propone** un horario (no es "confirmación") y el mensaje que **confirma** tras la respuesta afirmativa de la clienta. No se rediseña aquí — requiere el mismo diseño de estado nuevo en `Cita` señalado en `RN-CONV-11`. |

---

### RN-NOT-02 — Recordatorio automático de cita

| Campo | Valor |
|---|---|
| Rule ID | RN-NOT-02 |
| Nombre | Recordatorio automático de cita |
| Objetivo | Reducir inasistencias recordando la cita con anticipación. |
| Descripción | Toda cita recibe un recordatorio automático antes de la fecha programada. |
| Categoría | Notificaciones |
| Alcance | Global |
| Disparador | Se acerca la fecha programada de una cita confirmada. |
| Precondiciones | La cita está confirmada. |
| Entradas requeridas | Fecha de la cita, canal de contacto. |
| Lógica de negocio | A una ventana de tiempo antes de la cita (24h según ejemplos observados) → enviar recordatorio automático. El job de recordatorio consulta el `rango_horario` **vigente** de la cita en el momento de ejecutarse, no una copia congelada al momento de programarse. |
| Resultado esperado | La clienta recibe un recordatorio antes de su cita, con la hora correcta aunque la cita se haya reprogramado después de programarse el recordatorio. |
| Ejemplos | `not-1`, `not-5` en el mockup: recordatorios ya enviados. |
| Excepciones | Ninguna conocida sobre el mecanismo — ver `RN-NOT-03`/`RN-NOT-04` para el contenido. |
| Prioridad | Medium |
| Consumidores | Backend, IA |
| Dependencias | Depende de: RN-AGE-01. Es dependencia de: RN-NOT-03 |
| Fuente | `01-domain-discovery.md` §5.12 |
| Estado | Aprobada |
| Versión | 2 (2026-08-04 — cambio de fondo en `Lógica de negocio`: aclara que el job consulta el horario vigente, no uno congelado) |
| Fecha de aprobación | No registrada |
| Notas | **Agregado 2026-08-04 (`DISCOVERY_CHECKLIST.md` §4.5, pregunta implícita nunca antes registrada):** ni esta regla ni `FL-AGE-03`/`FL-NOT-02` se citaban mutuamente para cubrir qué pasa con un recordatorio ya programado cuando la cita se reprograma. Solución técnica, sin dependencia de negocio: el job no lleva una hora congelada, siempre lee `agenda.citas.rango_horario` al momento de ejecutarse. |

---

### RN-NOT-03 — Contenido de cortesía configurable

| Campo | Valor |
|---|---|
| Rule ID | RN-NOT-03 |
| Nombre | Contenido de cortesía en el recordatorio |
| Objetivo | Reforzar la relación con la clienta más allá de la información logística de la cita. |
| Descripción | El recordatorio de 24h antes puede incluir un mensaje de cortesía configurable (ej. "tienes exfoliante y café gratis"), no solo fecha/hora de la cita. |
| Categoría | Notificaciones |
| Alcance | Global |
| Disparador | Generación del recordatorio automático (`RN-NOT-02`). |
| Precondiciones | Existe un contenido de cortesía configurado por el negocio. |
| Entradas requeridas | Plantilla de recordatorio, contenido de cortesía vigente. |
| Lógica de negocio | Al generar el recordatorio → incluir el contenido de cortesía configurado, además de fecha/hora. |
| Resultado esperado | El recordatorio incluye el mensaje de cortesía definido por el negocio. |
| Ejemplos | "Tienes exfoliante y café gratis" (ejemplo textual aportado por la dueña en Sesión 02). |
| Excepciones | Vigencia (permanente vs. temporal) no definida (ver `RN-NOT-04`). |
| Prioridad | Medium |
| Consumidores | Backend, Administrador |
| Dependencias | Depende de: RN-NOT-02 |
| Fuente | Sesión 02 de Domain Discovery, reglas N2/F4 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-07-12 |
| Notas | — |

---

### RN-NOT-04 — Vigencia de la cortesía en el recordatorio

| Campo | Valor |
|---|---|
| Rule ID | RN-NOT-04 |
| Nombre | Vigencia de la cortesía en el recordatorio |
| Objetivo | Definir si la cortesía del recordatorio es permanente o temporal. |
| Descripción | Confirmado: es **permanente**, hasta que se especifique lo contrario. |
| Categoría | Notificaciones |
| Alcance | Global |
| Disparador | Generación del recordatorio automático (`RN-NOT-02`/`RN-NOT-03`). |
| Precondiciones | Ninguna. |
| Entradas requeridas | Contenido de cortesía vigente. |
| Lógica de negocio | El contenido de cortesía se mantiene sin fecha de expiración, salvo que el negocio lo cambie explícitamente. |
| Resultado esperado | El recordatorio incluye la cortesía vigente sin necesidad de renovarla periódicamente. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.28 (2026-08-04): *"Es permanente, hasta que se especifique lo contrario."* |
| Excepciones | Ninguna. |
| Prioridad | Medium |
| Consumidores | Backend, Administrador |
| Dependencias | Depende de: RN-NOT-03 |
| Fuente | Sesión 02 de Domain Discovery, pregunta abierta 7; `DISCOVERY_CHECKLIST.md` 1.28 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | Debe ser configurable (no fijo en la plantilla de WhatsApp aprobada por Meta, ADR-008), dado que aunque hoy sea "permanente", el negocio pidió poder cambiarla — decisión técnica ya anticipada, no bloqueada por esta respuesta. |

---

### RN-NOT-05 — Registro de fallos sin reintento indefinido

| Campo | Valor |
|---|---|
| Rule ID | RN-NOT-05 |
| Nombre | Registro de fallos de envío sin reintento indefinido |
| Objetivo | Evitar gasto o ruido operativo por reintentos automáticos sin control. |
| Descripción | Si el envío de una notificación falla, queda registrado como fallido para su revisión — no se reintenta de forma indefinida sin control. |
| Categoría | Notificaciones |
| Alcance | Global |
| Disparador | Falla en el envío de una notificación. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Resultado del intento de envío. |
| Lógica de negocio | Ante un fallo de envío → marcar la notificación como `fallida`, disponible para revisión, sin reintento automático indefinido. |
| Resultado esperado | Los fallos de notificación son visibles y revisables, sin generar reintentos descontrolados. |
| Ejemplos | `not-4` en el mockup: notificación de confirmación con estado `fallida`. |
| Excepciones | Ninguna conocida. |
| Prioridad | Medium |
| Consumidores | Backend, QA |
| Dependencias | Ninguna identificada |
| Fuente | `functional-scope.md` §3.7, Restricciones |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |
