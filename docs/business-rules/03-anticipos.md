# Categoría: Anticipos (`RN-ANT`)

> Gobierna el cobro condicionado y la retención temporal de horario para clientas de riesgo (lista roja).

---

### RN-ANT-01 — Solo lista roja paga anticipo

| Campo | Valor |
|---|---|
| Rule ID | RN-ANT-01 |
| Nombre | Solo clientas en lista roja pagan anticipo |
| Objetivo | Reducir el riesgo de cancelaciones de último momento sin imponer fricción a clientas de bajo riesgo. |
| Descripción | Solo se solicita anticipo a clientas marcadas en lista roja; el resto de las clientas no pasa por este paso. |
| Categoría | Anticipos |
| Alcance | Global |
| Disparador | Una clienta en estado `lista_roja` intenta agendar una cita. |
| Precondiciones | La clasificación de la clienta es `lista_roja` (`RN-CRM-02`). |
| Entradas requeridas | Estado de la clienta. |
| Lógica de negocio | Si `estado = lista_roja` → solicitar anticipo antes de confirmar en firme; si no → confirmar directamente. |
| Resultado esperado | Solo clientas de riesgo pasan por el flujo de anticipo. |
| Ejemplos | Renata Salazar Nava (lista roja, segunda vez) — anticipo obligatorio antes de confirmar. |
| Excepciones | Ninguna conocida. |
| Prioridad | High |
| Consumidores | IA, Backend, Recepción |
| Dependencias | Depende de: RN-CRM-02, RN-CRM-03. Es dependencia de: RN-ANT-02 |
| Fuente | `01-domain-discovery.md` §5.6; `DISCOVERY_CHECKLIST.md` 1.13 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | **Actualizado 2026-08-04 (`DISCOVERY_CHECKLIST.md` 1.13):** el monto del anticipo queda definido — **40% del valor del servicio**. Dato crítico que no existía en ningún documento previo. |

---

### RN-ANT-02 — Cita no confirmada en firme sin pago

| Campo | Valor |
|---|---|
| Rule ID | RN-ANT-02 |
| Nombre | Cita no confirmada en firme sin pago de anticipo |
| Objetivo | Asegurar que el compromiso económico se cumpla antes de comprometer el horario en firme. |
| Descripción | Una cita que requiere anticipo no se considera confirmada en firme hasta que el pago quede registrado. |
| Categoría | Anticipos |
| Alcance | Global |
| Disparador | Una cita queda marcada `anticipoRequerido: true`. |
| Precondiciones | `RN-ANT-01` determinó que se requiere anticipo. |
| Entradas requeridas | Estado del anticipo (pendiente/pagado). |
| Lógica de negocio | Mientras el anticipo esté `pendiente` → la cita permanece en estado `en_espera_pago`, con el horario retenido temporalmente, no confirmado en firme. |
| Resultado esperado | Ninguna cita con anticipo pendiente se trata como confirmada en firme. |
| Ejemplos | `cit-1003` en `mockup/js/data.js`: estado `en_espera_pago` mientras el anticipo de Lucía Martínez está pendiente. |
| Excepciones | Ninguna conocida. |
| Prioridad | High |
| Consumidores | Backend, Recepción, QA |
| Dependencias | Depende de: RN-ANT-01, RN-COT-07 |
| Fuente | `01-domain-discovery.md` §5.6 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-ANT-03 — Liberación automática si no se paga

| Campo | Valor |
|---|---|
| Rule ID | RN-ANT-03 |
| Nombre | Liberación automática de horario por falta de pago |
| Objetivo | No bloquear horarios indefinidamente por anticipos nunca pagados. |
| Descripción | **Actualizado:** no existe una retención temporal real del horario. Mientras el anticipo esté pendiente, el horario permanece disponible para cualquier otra clienta — el primero en pagar se queda con el cupo, protegido por el invariante de exclusión ya existente (`RN-AGE-01`), sin necesitar un mecanismo de expiración propio. |
| Categoría | Anticipos |
| Alcance | Global |
| Disparador | Solicitud de anticipo sin pago aún registrado. |
| Precondiciones | El anticipo está en estado `pendiente`. |
| Entradas requeridas | Estado del anticipo, estado de disponibilidad real del horario (`RN-AGE-01`). |
| Lógica de negocio | Mientras el anticipo esté `pendiente` → el horario permanece disponible para cualquier clienta; si otra clienta paga primero, el intento original queda sin efecto. No existe una "ventana de gracia" que expire, porque nunca hubo una retención que liberar. |
| Resultado esperado | El horario nunca queda bloqueado indefinidamente por un anticipo nunca pagado — porque nunca estuvo retenido para empezar. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.13 (2026-08-04): *"Hasta que se dé el anticipo se agenda, si no el espacio sigue libre."* |
| Excepciones | Ninguna — el escenario de dos clientas decidiendo pagar al mismo tiempo queda cubierto por `RN-AGE-01`, sin regla adicional. |
| Prioridad | High |
| Consumidores | Backend, QA |
| Dependencias | Depende de: RN-ANT-02. Relacionada con: RN-AGE-01 |
| Fuente | `01-domain-discovery.md` §5.6, Pregunta Abierta #4; `DISCOVERY_CHECKLIST.md` 1.13 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | **Cambio de mecanismo, no solo de valor (2026-08-04):** la pregunta original asumía una ventana de gracia con expiración temporal — la respuesta real es más simple: no existe retención real. El nombre de esta regla ("Liberación automática...") describe el resultado percibido por el negocio, aunque técnicamente no hay nada que "liberar". |

---

### RN-ANT-04 — Criterio de reembolso "justificado"

| Campo | Valor |
|---|---|
| Rule ID | RN-ANT-04 |
| Nombre | Criterio de cancelación justificada para reembolso |
| Objetivo | Definir el tratamiento de anticipos pagados ante cancelación o reagendo. |
| Descripción | No existe ningún criterio de "cancelación justificada" — **nunca hay reembolso de un anticipo ya pagado**, sin excepción. Si la clienta no se presenta habiendo pagado, tampoco se devuelve, y si vuelve a agendar después se le vuelve a pedir anticipo aunque ya haya pagado uno antes. Reagendar una cita **con anticipo ya pagado** solo puede hacerse con **48 horas de anticipación**, levantando una alerta para confirmar el reagendamiento. |
| Categoría | Anticipos |
| Alcance | Global |
| Disparador | Clienta con anticipo pagado solicita cancelar, reagendar, o no se presenta. |
| Precondiciones | **El anticipo de esta cita específica ya está pagado** — distinto de la regla general de cancelación tardía (`RN-CRM-06`), que aplica sin importar si hay anticipo. |
| Entradas requeridas | Estado del anticipo, horas de anticipación de la solicitud de reagendo. |
| Lógica de negocio | Ningún anticipo pagado se reembolsa, bajo ninguna circunstancia. Reagendar con anticipo pagado requiere ≥48h de anticipación y una alerta de confirmación explícita; con menos de 48h, no se reagenda. Un no-show con anticipo pagado no genera devolución, y una futura solicitud de esa clienta vuelve a requerir anticipo. |
| Resultado esperado | Ningún anticipo se devuelve nunca; todo reagendo con anticipo pagado queda sujeto a la ventana de 48h. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.14 (2026-08-04): *"No hay devolución de anticipos... solo pueden reagendar con 48 horas de anticipación cuando ya está pagado el anticipo, levantando una alerta para confirmar el reagendamiento."* |
| Excepciones | Ninguna. |
| Prioridad | High |
| Consumidores | IA, Backend, Recepción |
| Dependencias | Depende de: RN-ANT-01. **No debe confundirse con `RN-CRM-06`** (ventana de 59-60 min, aplica en general, no requiere anticipo pagado) — son dos reglas distintas que coexisten sin contradecirse: esta aplica solo cuando ya hay anticipo pagado sobre esa cita. |
| Fuente | Inferido de `mockup/js/data.js` (dato original); `DISCOVERY_CHECKLIST.md` 1.14 (regla real) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | Respuesta más simple y tajante que lo que este documento anticipaba (no había ningún criterio de "justificación" — nunca hay reembolso). Ver nota de coexistencia con `RN-CRM-06` en Dependencias. |
