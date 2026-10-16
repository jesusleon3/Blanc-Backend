# ADR-029 — Enmienda conjunta a `ADR-007`, `ADR-017` y `ADR-022`: retención diferenciada del registro de IA

- **Estado:** Accepted (con un valor de retención pendiente de insumo externo, declarado)
- **Fecha:** 2026-10-16
- **Decide:** Arquitectura
- **Cierra:** `F-14` (`ARCHITECTURE_REVIEW.md`, severidad **High**) y la mitad correspondiente de `P6`
- **Enmienda:** `ADR-007` (gobernanza de IA), `ADR-017` (minimización de datos personales), `ADR-022` (retención y backup)
- **Relacionada con:** `ADR-010` (auditoría), `ADR-026` (frontera de la IA), `RN-AUD-01`, `RN-CONV-04`

---

## Contexto

`ARCHITECTURE_REVIEW.md` detectó una **contradicción entre tres ADRs ya aceptados** y la clasificó `High`:

- **`ADR-007`** exige *trazabilidad total* y *"grabación de todas las decisiones de la IA"* — que en la práctica parece incluir el contenido conversacional: lo que la clienta escribió y lo que el modelo interpretó.
- **`ADR-017`** y **`ADR-022`** exigen minimización y retención acotada de datos personales **sobre ese mismo contenido**.

Ningún ADR resolvía cuál principio prevalece cuando el mismo dato es, a la vez, registro de auditoría de IA y dato personal sujeto a minimización. La review advirtió el riesgo concreto: *"quien implemente esto primero decidirá la política por defecto sin que haya una decisión arquitectónica que lo respalde"*.

`03-technical-architecture.md` §6.4 recomendó la **Opción (c)**: retención diferenciada *dentro del mismo registro* — metadatos de la decisión con retención larga, contenido conversacional con retención corta.

---

## Decisión

**Se ratifica la Opción (c), y se registra que la implementación la cumplió por una vía más fuerte de la que se recomendó: separación física, no retención diferenciada dentro de un mismo registro.**

### Cómo quedó resuelta de hecho

| Capa | Dónde vive | Qué contiene | Retención |
|---|---|---|---|
| **Metadatos de la decisión de IA** | `auditoria` (`ADR-010`) | Tipo de acción, actor (`sistema:bot-conversacional`), sucursal, entidad afectada, **intención clasificada, confianza y fuente de la decisión** (`RN-CONV-04`) | Larga, régimen de auditoría de `ADR-022` |
| **Contenido conversacional** | `conversaciones.mensajes` | El texto de la clienta y el del bot | Corta, régimen de datos personales de `ADR-017`/`ADR-022` — **valor pendiente**, ver abajo |

> **La auditoría NO contiene el texto, en absoluto.** No es una política de purga: es que el dato **nunca entra** en ese registro. `RN-AUD-01` lo exige —*el detalle de auditoría nunca lleva PII de la clienta*— y hay una prueba que serializa los registros de auditoría de un turno completo del bot y verifica que **ni el mensaje ni el teléfono aparecen** (`agente/bot.spec.ts`).

### Por qué la separación física es mejor que la retención diferenciada dentro de un registro

Tres razones, y la tercera es la que importa:

1. **Una purga no puede equivocarse si no hay nada que purgar.** La Opción (c) tal como se recomendó exigía un proceso que recorriera los registros de auditoría borrando un campo y conservando los otros. Ese proceso es código que puede fallar, omitir filas o borrar de más.
2. **El borrado del contenido no toca la auditoría.** Aplicar la retención corta es borrar filas de `mensajes`. La trazabilidad de `ADR-007` queda intacta **por construcción**, no porque la purga haya acertado a conservarla.
3. **Es verificable hoy, no cuando exista la purga.** La garantía se puede probar ahora mismo con una aserción sobre el contenido del registro de auditoría. Una política de retención diferenciada solo se puede verificar cuando el proceso de purga exista y corra — es decir, nunca durante el desarrollo.

### Lo que `ADR-007` conserva, y es suficiente

La pregunta práctica que `ADR-007` quiere poder responder es *"¿por qué el bot hizo esto?"*. Para eso basta la clasificación, y es lo que se audita: **intención, confianza y fuente de la decisión** (filtro determinista, modelo, o herramienta). El texto literal no añade capacidad de auditoría — y además sigue disponible en el hilo mientras no se purgue, que es donde quien atiende lo lee de todas formas.

Esto es coherente con `ADR-026`: la IA no puede decidir, así que auditar su decisión es auditar **una clasificación de una lista cerrada**, no un texto libre.

---

## Lo que esta ADR NO cierra

> **El valor de "retención corta" para el contenido conversacional sigue sin fijarse**, y no se fija aquí por una razón concreta: depende de la **Pregunta Abierta #12** del Domain Discovery (marco legal de datos personales aplicable), que sigue sin confirmar. `ADR-017` ya la dejó pendiente por lo mismo.

Inventar un número —"90 días"— sería peor que dejarlo abierto: parecería una decisión informada cuando sería una suposición sobre obligaciones legales. **Lo que sí queda decidido es la estructura**, que es lo que `F-14` pedía: cuando el número se fije, aplicarlo es borrar filas de `mensajes` con un `DELETE` acotado por fecha, sin tocar `auditoria` y sin rediseñar nada.

Mientras no se fije, **no hay purga y los mensajes se conservan**. Es el estado actual y conviene nombrarlo: no es una decisión de retención indefinida, es la ausencia del insumo para decidirla.

### Actualización 2026-10-16 — el mecanismo YA EXISTE; sigue faltando el número

El barrido está construido: `PurgarMensajesUseCase`, disparado por el **quinto barrido** del Planificador (`retencion_de_mensajes`, cada hora, con su propio cerrojo `advisory lock`).

| Qué hace | Detalle |
|---|---|
| Borra | Filas de `conversaciones.mensajes` con `ocurrido_en` anterior a N días |
| **No toca** | `auditoria` — es lo que hace que esta ADR funcione, y hay una prueba que lo verifica |
| **No borra** | La `Conversacion`: es la identidad persistente de la clienta en ese número y su `modo` es estado operativo vigente. Lo que caduca es el contenido, no el hilo |
| Por lotes | 5.000 filas por ejecución. Un `DELETE` sin tope sobre un año de mensajes bloquearía la tabla que la Bandeja lee en caliente: **la primera purga podría dejar al equipo sin poder atender** |

**`RETENCION_MENSAJES_DIAS` vacío o `0` = no purga nada, y es el valor por defecto.** Un valor no entero o negativo se trata como "no configurado": un typo no debe borrar con un umbral absurdo ni desactivar la purga creyéndola activa. El borrado es irreversible, así que el lado seguro es no borrar.

> **Lo que sigue abierto es exactamente lo que esta ADR ya declaraba: el número.** Depende de la Pregunta Abierta #12. La diferencia es que ahora activar la retención es poner una variable, no escribir código.

---

## Consequences

### Positive

- **La contradicción entre los tres ADRs queda resuelta sin reabrir ninguno.** `ADR-007` conserva su trazabilidad y `ADR-017`/`ADR-022` su minimización, porque recaen sobre datos que viven en tablas distintas.
- **La garantía es verificable hoy** y lo verifica una prueba, en vez de depender de un proceso de purga futuro.
- **Aplicar la retención, cuando se decida, es una operación acotada**: borrar filas de una tabla. No hay campos que preservar dentro de registros mixtos.
- **El riesgo que la review señaló desapareció.** No lo decidió "quien implementó primero sin respaldo": `RN-AUD-01` ya existía y está vigilado por pruebas.

### Negative

- **El valor de retención sigue abierto**, y por tanto la obligación de `ADR-017` no está cumplida en la práctica: hoy no se purga nada. Depende de un insumo que nadie ha conseguido (Pregunta Abierta #12), y conviene no presentarlo como cerrado.
- **El texto de un turno concreto no se puede reconstruir desde la auditoría** si el hilo se purga antes. Es el precio aceptado de la minimización: una disputa muy posterior tendría los metadatos de la decisión y no las palabras exactas. Se consideró aceptable porque la decisión auditada es una clasificación de lista cerrada, no un texto.
- **Queda una obligación operativa sin construir:** el proceso de purga. Cuando el valor se fije, el sitio natural es un quinto barrido del Planificador (`ADR-025`), con el mismo criterio de aislamiento de fallos por elemento.

---

## Alternativas consideradas

| Alternativa | Por qué se rechazó |
|---|---|
| **Opción (a): retener el contenido indefinidamente junto a la auditoría** | Satisface `ADR-007` al pie de la letra y **viola directamente** `ADR-017`/`ADR-022`. Exigiría reabrir dos ADRs aceptados. |
| **Opción (b): purgar el contenido y conservar solo metadatos, sin hilo** | Satisface la minimización y rompe `ADR-007` y la operación: la Bandeja Compartida **es** el hilo. Sin contenido no hay a qué responder. |
| **Opción (c) literal: dos retenciones dentro del mismo registro de auditoría** | Es lo recomendado y lo que esta ADR ratifica en espíritu, pero la implementación lo superó. Mantenerlo literalmente exigiría **meter el texto en la auditoría para luego borrarlo**, añadiendo una copia de PII y un proceso que puede fallar, a cambio de nada. |
| **Fijar aquí un valor de retención (p. ej. 90 días)** | Sería una suposición sobre obligaciones legales disfrazada de decisión. La Pregunta Abierta #12 sigue sin confirmar. |

---

## Verificación

| Qué se afirma | Qué lo sostiene |
|---|---|
| La auditoría no contiene el texto de la clienta ni su teléfono | `agente/bot.spec.ts` — *"audita la intención, la confianza y la fuente, y NUNCA el texto de la clienta"*, con un `JSON.stringify` sobre todos los registros del turno |
| Se audita intención, confianza y fuente (`RN-CONV-04`) | El mismo spec, con `toMatchObject` sobre el detalle |
| El contenido conversacional vive en su propia tabla | `conversaciones.schema.ts` (`mensajes.contenido`) y la migración `0013` |
| Ningún otro registro de auditoría lleva PII | Es `RN-AUD-01` y aplica a toda escritura; los specs de cada módulo verifican el `detalle` que registran |
