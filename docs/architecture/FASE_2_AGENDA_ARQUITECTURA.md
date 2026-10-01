# Fase 2 — Arquitectura del Motor de Agenda

> **Estado:** Diseño aprobado en sus reglas de negocio, **sin implementar**. Ninguna línea de código, esquema ni migración de este documento existe todavía.
> **Fecha:** 2026-09-30.
> **Origen:** respuestas de la Dueña al documento de definiciones operativas, bajo la directriz de **"Sistema Híbrido"** — automatizar la agenda básica, apoyarse en el equipo humano para lo complejo.
> **Qué decide este documento:** cómo se traducen esas cinco reglas a estructura. Lo que no decide queda marcado como `ABIERTO`, nunca asumido.

---

## 0. La directriz rectora

> Automatizar la agenda básica; que el sistema **se apoye en recepción y gerencia** para casos complejos, diseños y cotizaciones.

Esto no es una preferencia de producto, es una restricción de diseño con consecuencias concretas: **el sistema debe poder detenerse y pedir a un humano que decida**, sin dejar la cita en un estado inconsistente ni el horario bloqueado indefinidamente. Las reglas 2 y 4 son las dos realizaciones de esa idea.

---

## 1. Resumen de las cinco reglas aprobadas

| # | Regla | Cierra | Impacto |
|---|---|---|---|
| 1 | `completada` es **automática por paso del tiempo**, sin notificación a la clienta | `Pregunta 2` | Máquina de estados de `Cita`; evento `CitaCompletada` |
| 2 | Capacidad física estricta por sucursal (Zibatá 5, Lomas 3, Álamos 1) vía **Sillas Virtuales** | `P4` | Esquema de `agenda`, invariante anti-doble-booking |
| 3 | Baja de manicurista con citas futuras: **bloqueo duro** | `Pregunta 4` | **Modifica código de Fase 1 ya implementado** |
| 4 | Diseños especiales: no se parametrizan; flag `requiere_cotizacion_manual` | parte de `RN-COT-04` | **Modifica `FL-COT-01`, flujo ya cerrado** |
| 5 | Anticipo expirado: el espacio **se libera** | hueco de la máquina de estados | Define qué estados ocupan horario |

---

## 2. El patrón de Sillas Virtuales (regla 2)

Es la pieza central de Fase 2. Resuelve un problema que, sin él, falla **en silencio**.

### 2.1 El problema: `NULL` desactiva la restricción de exclusión

El invariante anti-doble-booking de `04-data-model.md` §5.1 es una restricción de exclusión de PostgreSQL:

```sql
EXCLUDE USING gist (manicurista_id WITH =, rango WITH &&)
```

Cuando la clienta **no elige manicurista**, el candidato natural es dejar `manicurista_id` en `NULL`. Y ahí está la trampa:

> En PostgreSQL, `NULL = NULL` evalúa a `NULL`, no a `TRUE`. Una restricción `EXCLUDE` **nunca se dispara entre dos filas con `NULL`** en la columna comparada.

Consecuencia: el sistema aceptaría **un número ilimitado de citas simultáneas sin manicurista** en la misma sucursal, y la base de datos no diría nada. No es un error que aparezca en los logs ni que rompa una prueba evidente: es sobreventa silenciosa, descubierta el día que llegan siete clientas a un local de tres sillas.

Esto es exactamente el hueco que `DOMAIN_MODEL_REVIEW.md` (DM-11) identificó y que `P4` dejó abierto por no poder elegir entre cinco modelos sin una decisión de negocio. La Dueña ya la dio: **hay un límite físico duro**.

### 2.2 La solución: la silla es el recurso escaso, la manicurista es una preferencia

Se introduce `agenda.sillas` — la **estación de trabajo física**. Cada sucursal tiene un número fijo:

| Sucursal | Sillas |
|---|---|
| Zibatá | 5 |
| Lomas | 3 |
| Álamos | 1 |

Y se invierte el modelo mental:

> **Toda cita ocupa exactamente una silla, siempre. La manicurista es opcional.**

```
Cita sin preferencia  →  silla_id = S2,  manicurista_id = NULL
Cita con preferencia  →  silla_id = S2,  manicurista_id = Ana
```

La silla **nunca** es `NULL`. Por lo tanto la restricción de exclusión siempre tiene un valor real que comparar, y la capacidad de la sucursal deja de ser una regla que la aplicación deba recordar: pasa a ser una consecuencia aritmética del esquema. *Lomas tiene 3 sillas, luego Lomas no puede tener 4 citas simultáneas.*

### 2.3 Dos restricciones, dos escaseces distintas

```sql
-- (a) CAPACIDAD FÍSICA: una silla, una cita a la vez.
--     `silla_id` es NOT NULL, así que esta restricción SIEMPRE aplica.
ALTER TABLE agenda.citas
  ADD CONSTRAINT citas_silla_sin_solapamiento
  EXCLUDE USING gist (silla_id WITH =, rango_horario WITH &&)
  WHERE (estado NOT IN ('cancelada', 'expirada', 'reprogramada'));

-- (b) LA MANICURISTA NOMBRADA NO SE DUPLICA.
--     El `WHERE ... IS NOT NULL` es EXPLÍCITO a propósito: documenta que las
--     citas sin manicurista quedan fuera de esta restricción por decisión,
--     no por el accidente de que NULL nunca entra en conflicto.
ALTER TABLE agenda.citas
  ADD CONSTRAINT citas_manicurista_sin_solapamiento
  EXCLUDE USING gist (manicurista_id WITH =, rango_horario WITH &&)
  WHERE (manicurista_id IS NOT NULL
         AND estado NOT IN ('cancelada', 'expirada', 'reprogramada'));
```

Ambas requieren la extensión `btree_gist` (el operador `=` sobre `uuid` dentro de un índice GiST). **Ya está verificada**: el smoke test de `postgres-de-prueba.smoke.spec.ts` crea esta misma restricción en miniatura y comprueba que PostgreSQL rechaza el solapamiento para el mismo recurso y lo acepta para otro distinto. El prerrequisito técnico de Fase 2 no es una suposición.

### 2.4 Recepción reasigna al llegar la clienta

Es el punto que conecta el patrón con la directriz de Sistema Híbrido:

```
Reserva   →  cita en silla S2, manicurista_id = NULL   (el bot pudo hacerlo solo)
Llegada   →  recepción pone manicurista_id = Ana        (una persona decide)
```

La reasignación es un simple `UPDATE`. Y lo elegante es que **la restricción (b) valida esa asignación automáticamente**: si Ana ya tiene otra cita solapada, PostgreSQL rechaza el `UPDATE`. La misma restricción protege el camino de reserva y el de asignación en mostrador, sin lógica duplicada.

La silla no cambia al reasignar: el espacio físico ya estaba apartado desde la reserva.

### 2.5 Modelos descartados, y por qué

| Modelo | Por qué se descarta |
|---|---|
| **`manicurista_id` NULL** | Falla en silencio (§2.1). Es el camino por defecto si nadie piensa en esto, y por eso vale la pena dejarlo escrito. |
| **Recurso unificado:** sillas y manicuristas como filas hermanas de una misma tabla `recursos`, con una sola restricción sobre `recurso_id` | Mezcla dos escaseces distintas y **fuga capacidad**. Si Lomas tuviera 3 sillas + 3 manicuristas = 6 recursos, se podrían reservar 6 citas simultáneas en un local de 3 sillas. Para evitarlo habría que hacer que los recursos fueran *exactamente* las sillas, y entonces no se podría reservar con una manicurista concreta. |
| **Asignar una manicurista real de inmediato** | Contradice la directriz: la Dueña quiere que **recepción decida al llegar la clienta**, no que el sistema comprometa a una persona con horas de antelación. |

El modelo adoptado mantiene separadas las dos cosas que de verdad son distintas: **el espacio físico** (finito, siempre consumido) y **la persona** (opcional, nombrada solo si la clienta la pidió).

### 2.6 Consecuencias que conviene aceptar conscientemente

- **Una cita con manicurista nombrada también consume una silla.** Es físicamente correcto: Ana necesita una estación para trabajar. Implica que una reserva para Ana puede rechazarse por "no hay sillas libres" aunque Ana esté libre. No es un defecto, es el local lleno.
- **Las sillas son configuración, no código.** El número por sucursal vive en datos (`agenda.sillas`), no en una constante. Añadir la cuarta sucursal, o una silla más en Lomas, es insertar filas.
- **Las sillas no se nombran de cara a la clienta.** Son un mecanismo interno de capacidad. Nada en WhatsApp dice "silla 2".

### 2.7 ⚠️ `ABIERTO` — capacidad física vs. personal presente

**Las sillas no son el único límite real, y la Dueña no respondió sobre el otro.**

Si Zibatá tiene 5 sillas pero hoy solo trabajan 3 manicuristas, este modelo aceptaría 5 citas simultáneas y dos clientas no tendrían quién las atienda. La restricción de exclusión no lo impediría: las 5 sillas están libres.

Hay al menos tres salidas, y **no se elige ninguna aquí**:

- (a) La capacidad efectiva es `min(sillas, manicuristas en turno)` — exige modelar turnos, que hoy no existen.
- (b) Se mantiene el límite por sillas y **recepción absorbe el desajuste** — coherente con la directriz de Sistema Híbrido, pero traslada el problema a una persona.
- (c) Las sillas de cada sucursal se configuran a la baja, al mínimo de personal habitual, sacrificando capacidad en los días buenos.

Es una pregunta para la Dueña, no para arquitectura. Queda registrada como pendiente nueva.

---

## 3. Regla 1 — `completada` automática

**Decisión:** la transición ocurre **por el paso del tiempo**, sin acción de ningún empleado y **sin notificación a la clienta**.

Cierra `Pregunta 2`, que `OWNER_DECISION_LOG.md` calificaba como *"la pregunta de mayor apalancamiento de todo el proyecto"* — desbloquea en cascada `RN-AGE-14`, la máquina de estados de `Cita`, el evento `CitaCompletada` y, con él, la entrada a la Fase 5 (Garantías).

### 3.1 Transición almacenada, no calculada

Es tentador no almacenar nada: si `rango_horario` ya pasó y nadie marcó lo contrario, la cita "está completada". Pero **Garantías depende del evento de dominio `CitaCompletada`**, y un evento necesita un instante en que algo ocurre. Una vista calculada no emite eventos.

Por lo tanto: un **job programado** transiciona `confirmada → completada` cuando `upper(rango_horario) < now()`, y publica `CitaCompletada` por el Outbox (que nace en esta misma fase).

### 3.2 ⚠️ `ABIERTO` — la carrera con `no_show`

`no_show` es **manual** (ya confirmado) y `completada` es **automática**. Se pisan:

> La cita de las 18:00 termina. El job corre a las 19:00 y la marca `completada`. A la mañana siguiente, recepción se da cuenta de que la clienta nunca llegó e intenta marcar `no_show` — pero la cita ya es `completada`, un estado que suena terminal.

Dos salidas posibles, **sin elegir aquí**:

- (a) **Ventana de gracia**: el job no toca una cita hasta N horas después de terminar, dando margen al marcado manual.
- (b) **`no_show` puede sobrescribir `completada`**: la transición existe y queda auditada como corrección.

Afecta directamente a `RN-CRM-06`, porque un `no_show` dispara la sugerencia de lista roja. Si la corrección no es posible, esa regla pierde casos reales.

---

## 4. Regla 3 — Baja de manicurista: bloqueo duro

**Decisión:** el sistema **lanza excepción** si se intenta dar de baja a una manicurista con citas futuras. Es la opción (a) de `Pregunta 4`.

### 4.1 Esto modifica código de Fase 1 ya entregado

`DesactivarManicuristaUseCase` **existe hoy y no verifica nada**. Su propio comentario deja constancia de que el tratamiento de citas futuras estaba deferido a esta pregunta. No es trabajo nuevo en terreno virgen: es un cambio sobre un módulo cerrado, con sus pruebas ya escritas.

Error de dominio a añadir, siguiendo la convención del proyecto:

```
MANICURISTA_CON_CITAS_FUTURAS   →  409 Conflicto de negocio
```

### 4.2 La consecuencia arquitectónica: cruza un Bounded Context

La baja ocurre en **Sucursales y Personal**. Las citas viven en **Agenda**. `ADR-005` prohíbe claves foráneas entre esquemas, y `ADR-001`/`ADR-002` prohíben que un módulo consulte las tablas de otro.

Por lo tanto la verificación **no puede ser un `JOIN`**. Debe hacerse por un puerto explícito que Agenda implemente y Sucursales y Personal consuma — el mismo patrón con el que `AuthModule` consume `PERMISOS_USUARIO_PORT` de `IdentidadYAccesosModule` (`DEC-029`).

```
SucursalesYPersonalModule  ──consume──>  CITAS_FUTURAS_PORT  <──implementa──  AgendaModule
```

Esto invierte la dirección de dependencia declarada en `01-domain-discovery.md` §4, donde **Agenda es consumidor** de Sucursales y Personal. Un puerto definido por el consumidor evita el ciclo de módulos, pero conviene verificar con `madge` al implementarlo: es justo el tipo de cambio que introduce dependencias circulares.

### 4.3 ⚠️ `ABIERTO` — qué cuenta como "cita futura"

¿Una cita `cancelada` en el futuro bloquea la baja? Lo razonable es que no: no hay nada que reasignar. Pero eso significa que la consulta del puerto depende de **qué estados ocupan horario** (§6), y conviene que sea la misma lista, no una segunda definición que pueda divergir.

---

## 5. Regla 4 — Diseños especiales: `requiere_cotizacion_manual`

**Decisión:** no se intenta parametrizar tiempos ni precios de diseños complejos. Se marca el elemento con un flag y **la automatización se detiene**, exigiendo un humano.

Es la realización más directa de la directriz de Sistema Híbrido: el sistema reconoce lo que no sabe calcular y lo entrega a una persona, en vez de inventar un número.

### 5.1 Qué resuelve de `RN-COT-04`, y qué no

`RN-COT-04` tenía **tres** huecos. Este flag cierra uno:

| Hueco | Estado |
|---|---|
| Celdas sin valor numérico ("Diseño Especial", `SP`, `CF`, `CC`) | ✅ **Resuelto por decisión**: no se parametrizan, se marcan como manuales |
| Ambigüedad del "+15 min" del drill: ¿delta o reemplazo? | ❌ **Sigue abierto** |
| La tabla numérica original no está en el repositorio | ❌ **Sigue abierto** — hay que recuperarla de la reunión |

Conviene no confundir "ya no bloquea" con "resuelto". El motor de duración sigue sin poder operar con precisión total.

### 5.2 Dónde vive el flag

En **ambos** catálogos, porque un "Diseño Especial" es un `ModificadorDiseno` pero podría existir un `Servicio` entero que lo requiera:

```
catalogo_cotizacion.servicios.requiere_cotizacion_manual            boolean NOT NULL DEFAULT false
catalogo_cotizacion.modificadores_diseno.requiere_cotizacion_manual boolean NOT NULL DEFAULT false
```

**Regla de propagación:** si *cualquier* elemento de la composición lo tiene activo, la cotización completa es manual. Es una disyunción, no una media ponderada: basta un elemento incalculable para que el total lo sea.

### 5.3 Esto reabre `FL-COT-01`, que estaba cerrado

`FL-COT-01` figura como **flujo CERRADO** desde 2026-09-14. Este flag exige:

- dos columnas nuevas → **migración `0004`**
- cambios en las entidades `Servicio` y `ModificadorDiseno`
- cambios en los DTO de alta y edición, y en el presenter
- pruebas nuevas

No es grave —son cambios aditivos con `DEFAULT false`, sin romper datos existentes—, pero el estado de `FL-COT-01` debe pasar de `CERRADO` a **`REABIERTO (alcance acotado)`**. Marcarlo cerrado y modificarlo igual sería precisamente el tipo de deriva que este proyecto evita.

### 5.4 ⚠️ `ABIERTO` — qué significa "la automatización se detiene"

El flag dice *que* hay que parar; no dice *cómo*. Falta definir:

- ¿La cita queda en un estado propio (`pendiente_cotizacion`) que **ocupa** el horario mientras un humano cotiza? Si no ocupa, el hueco puede venderse dos veces.
- ¿Hay límite de tiempo para que un humano responda, o espera indefinidamente?
- ¿Se avisa a recepción de forma activa (ticket de escalamiento) o aparece pasivamente en un tablero?

La tercera roza el módulo de Escalamiento (Fase 4). Queda fuera de alcance aquí, pero el estado sí hay que decidirlo para la máquina de estados.

---

## 6. Regla 5 — Anticipo expirado libera el espacio, y la lista de estados

**Decisión:** si un anticipo expira, el espacio **no se considera agendado y se libera**, priorizando a otras clientas.

Esto rellena un hueco concreto que `DOMAIN_MODEL_REVIEW.md` había señalado: *"la expiración de la retención no es solo una incógnita de negocio, es una transición de estado sin definir"*.

### 6.1 La lista que la restricción de exclusión necesita

`04-data-model.md` §346 dejó constancia de que, sin saber **qué estados ocupan el horario**, la restricción de exclusión *"no puede implementarse literalmente"*. Con las reglas 1 y 5 ya hay base para proponerla:

| Estado | ¿Ocupa el horario? | Nota |
|---|---|---|
| `pendiente_confirmacion` | **Sí** | La clienta aún no responde (confirmación interactiva, `RN-CONV-11`), pero el hueco está apartado |
| `en_espera_pago` | **Sí** | Mientras el anticipo no expire, el espacio es suyo |
| `confirmada` | **Sí** | — |
| `completada` | **Sí** | Terminal; mantenerla ocupando preserva la integridad histórica |
| `no_show` | **Sí** | Terminal; la clienta no llegó, pero el hueco se consumió igual |
| `cancelada` | **No** | Libera |
| `expirada` | **No** | Libera — **es el estado destino de la regla 5** |
| `reprogramada` | **No** | Libera el hueco viejo; la cita conserva su identidad en el nuevo |

Formulado al revés, que es como se escribe en SQL y es más robusto: **liberan `cancelada`, `expirada` y `reprogramada`; todo lo demás ocupa.** Un estado nuevo que alguien añada en el futuro ocupará por defecto, que es el lado seguro del error.

### 6.2 Lo que sigue faltando para cerrar `P3`

Con esto, la máquina de estados de `Cita` tiene **la mayor parte** de sus piezas. Sigue sin cerrarse del todo:

- `pendiente_confirmacion` es un estado **que todavía no existe** en la lista de `01-domain-discovery.md` §113. Lo exige la confirmación interactiva ya confirmada por la Dueña (1.23), y sigue sin diseñarse formalmente.
- A qué estado vuelve una cita **después** de reprogramarse.
- Si la regla 4 necesita un `pendiente_cotizacion` propio (§5.4).
- Las máquinas de **`Conversación`** y **`TicketEscalamiento`** siguen intactas — la segunda ni siquiera tiene valores propuestos.

`P3` pasa de `Abierto` a **`Abierto — parcialmente desbloqueado`**. Agenda ya puede diseñarse; Conversación y Escalamiento (Fase 4) no.

---

## 7. Esquema propuesto (ilustrativo, no implementado)

```sql
-- Estación de trabajo física. El número de filas por sucursal ES la capacidad.
CREATE TABLE agenda.sillas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id uuid NOT NULL,          -- sin FK: ADR-005 prohíbe FKs entre esquemas
  etiqueta    text NOT NULL,          -- "Zibatá 1".. interno, nunca visible a la clienta
  activa      boolean NOT NULL DEFAULT true,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agenda.citas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id    uuid NOT NULL,
  silla_id       uuid NOT NULL REFERENCES agenda.sillas(id),  -- NUNCA null: ver §2.2
  manicurista_id uuid,                                        -- null = sin preferencia
  clienta_id     uuid NOT NULL,
  rango_horario  tstzrange NOT NULL,
  estado         text NOT NULL,
  cotizacion_snapshot jsonb NOT NULL,   -- congelada, no referencia viva (04-data-model §5.2)
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Las dos restricciones de §2.3 van aquí.
```

Notas de modelado:

- `silla_id` **referencia dentro del mismo esquema** (`agenda`), así que la FK sí es legítima — `ADR-005` solo prohíbe las cruzadas entre esquemas. Mismo criterio que `servicio_modificadores_aplicables` en Catálogo.
- `sucursal_id` y `manicurista_id` apuntan a `sucursales_personal` **sin FK**, por esa misma regla.
- `cotizacion_snapshot` es `jsonb` congelado. **No se crean tablas `cotizaciones` ni `composiciones_por_una`** (`04-data-model.md` §5.2).
- Falta decidir el tipo de `estado`: `text` con `CHECK`, o `enum` de PostgreSQL. Un `enum` dificulta añadir estados sin migración; dado que §6.2 admite que faltan estados por definir, `text` + `CHECK` es probablemente mejor. **No se decide aquí.**

---

## 8. Pendientes nuevos que esta ronda abrió

Cinco respuestas cerraron tres bloqueos y abrieron cuatro preguntas más pequeñas. Es sano: son más concretas que las que sustituyen.

| # | Pregunta | Para | Bloquea |
|---|---|---|---|
| N-01 | Capacidad física vs. personal en turno (§2.7) | Dueña | Calibrar el motor de disponibilidad |
| N-02 | Carrera `completada` / `no_show`: ventana de gracia o sobrescritura (§3.2) | Dueña | `RN-AGE-14`, `RN-CRM-06` |
| N-03 | Qué significa operativamente "la automatización se detiene" (§5.4) | Dueña + Arquitectura | Estado `pendiente_cotizacion` |
| N-04 | Qué estados cuentan como "cita futura" para bloquear la baja (§4.3) | Arquitectura | Puerto `CITAS_FUTURAS_PORT` |

Y siguen abiertos, sin cambio:

- La ambigüedad del **"+15 min" del drill** y la **recuperación de la tabla numérica** de `RN-COT-04`.
- `Pregunta 11` — alcance por defecto de sucursales por rol (el código hoy se comporta de dos maneras contradictorias según si lee o escribe).
- Las máquinas de **`Conversación`** y **`TicketEscalamiento`**.

---

## 9. Trazabilidad

| Documento | Relación |
|---|---|
| `PROJECT_STATUS.md` §5 | `DEC-030`..`DEC-034` registran estas cinco decisiones |
| `OWNER_DECISION_LOG.md` | `Pregunta 2` y `Pregunta 4` pasan a `Resuelta` |
| `ARCHITECTURE_CLOSURE_PLAN.md` | `P4` **Resuelto**; `P3` parcialmente desbloqueado |
| `04-data-model.md` §5.1 | La restricción de exclusión por fin tiene su lista de estados (§6.1) |
| `01-domain-discovery.md` §113 | `EstadoCita` necesita `pendiente_confirmacion` y `expirada` |
| `business-rules/01-agenda.md` | `RN-AGE-14` por crear (regla 1); regla de capacidad por crear (regla 2) |
| `postgres-de-prueba.smoke.spec.ts` | Prueba viva de que `btree_gist` + `EXCLUDE` funcionan |
