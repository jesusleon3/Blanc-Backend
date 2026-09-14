# Modelo de Datos — Blanc

> **Fuentes:** `docs/architecture/01-domain-discovery.md`, `docs/architecture/02-architecture-principles.md`, `docs/architecture/03-technical-architecture.md`, `docs/architecture/ADR_INDEX.md` y los 22 ADRs en `docs/architecture/adr/`, `docs/architecture/ARCHITECTURE_REVIEW.md`, `docs/architecture/DOMAIN_MODEL_REVIEW.md`.
> **Estado:** Borrador v0.1 — `01-domain-discovery.md`, los 22 ADRs y `03-technical-architecture.md` se consideran cerrados por instrucción explícita del cliente. Este documento no reabre ninguna decisión de dominio, de principios arquitectónicos ni de arquitectura técnica ya congelada.
> **Alcance:** modelo de datos lógico y físico — entidades, relaciones, restricciones, índices, mapeo de aggregates a tablas, Outbox, auditoría, read models de CQRS-lite. **No incluye** sentencias SQL/DDL ni migraciones (eso es trabajo de implementación posterior a esta serie de documentos), ni contratos de API (`05-api-design.md`), ni backlog/plan de sprints (`06-development-plan.md`). Se nombran tipos conceptuales (UUID, entero en centavos, `timestamptz` UTC, rango temporal) y restricciones en prosa porque el motor ya está fijado (PostgreSQL, ADR-005) y esta es la fase de diseño físico — pero no se escribe una sola sentencia `CREATE TABLE`.
>
> **Regla de gobernanza (heredada de `03-technical-architecture.md`, sin cambios):** ante un vacío de decisión, una decisión pendiente de negocio, o una alternativa técnicamente válida que afecte de forma importante el modelo de datos, este documento no cierra la decisión unilateralmente — documenta el problema, presenta alternativas, da una recomendación justificada, y marca el punto como **`Decision Pending`**. Si en cambio se detecta una **contradicción real** con un documento ya aprobado (Domain Discovery, principios, un ADR vigente, o `03-technical-architecture.md`), este documento se detiene en ese punto, lo notifica explícitamente, y no continúa hasta recibir instrucción.
>
> **Tres restricciones explícitas de alcance para este documento (instrucción del cliente):**
> 1. La decisión de ORM (`03` §3.4) **no se cierra aquí**. El modelo de datos permanece independiente de la tecnología de persistencia; se referencia el forward-pointer ya existente en `03`, sin resolverlo.
> 2. Las 11 subsecciones de la Sección 5 corresponden exactamente a los 11 Bounded Contexts del Domain Discovery — sin fusionar ni omitir ninguno.
> 3. No se enumeran los valores del atributo `estado` de `Cita`, `Conversacion` ni `TicketEscalamiento`. Enumerarlos equivaldría a diseñar parcialmente sus máquinas de estado, decisión que el Domain Discovery dejó deliberadamente fuera de alcance (ver DD Preguntas Abiertas #15/#16, y la restricción explícita registrada en `DOMAIN_MODEL_REVIEW.md`). Se modela únicamente la existencia del atributo, tipado como enum de valores pendientes.

---

## 0. Cómo leer este documento

- Cada subsección de las Secciones 4–8 sigue el mismo protocolo: **entidades/tablas → columnas conceptuales → restricciones/índices → decisión (firme o `Decision Pending`)**.
- Las decisiones ya congeladas por el Domain Discovery, los ADRs o `03-technical-architecture.md` no se reabren aquí — este documento resuelve la pieza de modelo de datos concreta que esos documentos dejaron abierta o en principio, no la decisión de fondo en sí.
- Los puntos marcados `Decision Pending` no bloquean la utilidad del resto del documento — son la lista de lo que debe confirmarse antes de, o durante, la implementación y `05-api-design.md`/`06-development-plan.md`.
- La Sección 11 (candidatos a ADR) se escribe al final, después de revisar el documento completo, siguiendo la misma disciplina de filtrado que `03-technical-architecture.md` §11.
- Donde el Domain Discovery no enumeró valores exhaustivos de un atributo (distinto de las tres máquinas de estado restringidas explícitamente), se propone un conjunto de trabajo ilustrativo, marcado como tal — no como diseño definitivo.

---

## 1. Resumen ejecutivo y alcance

Este documento traduce el Domain Discovery, los principios de base de datos (`02-architecture-principles.md` §11) y las decisiones de `03-technical-architecture.md` ya congeladas (PostgreSQL como motor, separación por esquema, Outbox, auditoría append-only) en un modelo de datos concreto: qué tablas existen, qué columnas conceptuales tienen, qué restricciones e índices garantizan los invariantes de negocio ya identificados, y cómo se materializan los read models de CQRS-lite.

**Lo que este documento decide:** el mapeo de cada aggregate/entidad/VO del Domain Discovery a una estructura de datos concreta, dentro de los esquemas ya definidos por Bounded Context; los mecanismos transversales de persistencia (Outbox, idempotencia, auditoría, feature flags, prompts de IA); el mecanismo de control de concurrencia para `Cita`; la forma de los read models de disponibilidad y Analítica; la clasificación de retención por clase de dato.

**Lo que este documento NO decide:** la tecnología de acceso a datos/ORM (`Decision Pending`, heredado de `03` §3.4, ver Sección 2); el proveedor de base de datos (`Decision Pending`, `03` §3.3 — irrelevante para este documento, que es agnóstico de proveedor); sentencias SQL o migraciones concretas; contratos de API (`05`); backlog (`06`); ninguna decisión de negocio todavía pendiente del Domain Discovery (Preguntas Abiertas #2, #4, #6, #10, #11, #12, #13, #14 son las que tocan directamente forma de esquema — se heredan tal cual, sin resolverlas); el diseño formal de las máquinas de estado de `Cita`, `Conversacion` y `TicketEscalamiento` (fuera de alcance por instrucción explícita, ver portada).

---

## 2. Principios de modelado aplicados

Checklist de restricciones ya congeladas que todo el resto de este documento debe respetar — no se re-evalúan ni se re-deciden aquí, se aplican:

1. **Un único motor físico (PostgreSQL, ADR-005), separación lógica por esquema, uno por Bounded Context.** El Domain Discovery define 11 Bounded Contexts (`01-domain-discovery.md` §4) — no 10; ADR-001 y ADR-005 fueron redactados antes de que `Notificaciones` se incorporara formalmente como Bounded Context propio (consolidación posterior, hallazgo DM-07) y por eso mencionan "10" en su texto original. Esto no es una contradicción que deba resolverse modificando esos ADRs — el criterio de conteo vigente es el del Domain Discovery actual, que ya es la fuente autorizada. Este documento usa 11 en todo momento (Sección 3).
2. **Sin llaves foráneas entre esquemas de distintos Bounded Context (ADR-005).** Toda referencia cruzada entre contextos se modela como un identificador simple (UUID), nunca como restricción `FOREIGN KEY` de base de datos. Dentro de un mismo esquema, las relaciones sí pueden y deben usar FKs reales — la prohibición es específicamente cruzando la frontera de contexto.
3. **Control de concurrencia explícito en `Cita`** (principio 11.3) para el invariante de no-doble-booking — mecanismo concreto en §5.1.
4. **Dinero como entero de unidad mínima (centavos), nunca punto flotante** (principio 11.4) — aplica a `Servicio.precio_base`, `ModificadorDeDiseño.precio_adicional`, `SolicitudAnticipo.monto`, y cualquier campo de dinero futuro.
5. **Toda fecha/hora en UTC** (`timestamptz`), conversión a hora local de sucursal en la capa de presentación (principio 11.5) — nunca en la de persistencia.
6. **Migraciones expand/contract** (ADR-012) — este documento no escribe migraciones, pero ninguna estructura propuesta aquí debe asumir que un cambio de esquema futuro pueda ser destructivo en un solo paso; se diseña pensando en que cualquier evolución futura seguirá ese patrón.
7. **CQRS-lite solo en Analítica y disponibilidad de Agenda (ADR-003)** — ningún otro contexto tiene modelo de lectura separado. Mecanismo concreto en Sección 6.
8. **Snapshot inmutable de cotización dentro de `Cita`** (principio 11.8, DD §5.1) — nunca se muta retroactivamente si el catálogo cambia después.
9. **Ningún secreto se modela en esta base de datos** (principio 12.3) — credenciales de WhatsApp, IA o Google Calendar viven en el gestor de secretos (`03` §5.5), nunca en una tabla de este documento.
10. **No se diseñan máquinas de estado formales para `Cita`, `Conversacion` ni `TicketEscalamiento`** — se modela la existencia del atributo `estado`, tipado como enum de valores pendientes de esa máquina de estados formal (ver portada, restricción #3).
11. **ORM/capa de acceso a datos permanece `Decision Pending`** (heredado de `03` §3.4, sin cerrarse aquí): *"Se recomienda cerrar esta decisión al inicio de `04-data-model.md`, cuando el esquema concreto ya esté sobre la mesa"* — por instrucción explícita del cliente, este documento **no** cierra esa decisión. El modelo de datos que sigue es deliberadamente independiente de si la capa de acceso termina siendo Prisma, Drizzle u otra — ninguna estructura aquí descrita depende de las capacidades específicas de un ORM concreto.

---

## 3. Mapa de esquemas por Bounded Context

Once esquemas, uno por cada Bounded Context del Domain Discovery (`01-domain-discovery.md` §4), más tres esquemas transversales sin Bounded Context dueño (justificación abajo).

| # | Bounded Context | Esquema | Naturaleza |
|---|---|---|---|
| 1 | Agenda | `agenda` | Transaccional, con el invariante más crítico del sistema (no-doble-booking) |
| 2 | Catálogo y Cotización | `catalogo_cotizacion` | Transaccional (catálogo), sin estado transaccional de alta concurrencia |
| 3 | Conversación | `conversacion` | Transaccional, alto volumen de escritura (mensajes) |
| 4 | Escalamiento | `escalamiento` | Transaccional, bajo volumen |
| 5 | Clientas (CRM) | `clientas` | Transaccional |
| 6 | Anticipos | `anticipos` | Transaccional, datos financieros |
| 7 | Sucursales y Personal | `sucursales_personal` | Transaccional, configuración |
| 8 | Notificaciones | `notificaciones` | Transaccional, orquestación de envíos (sin lógica de negocio propia, DD §4) |
| 9 | Sincronización de Calendario | `sincronizacion_calendario` | Anti-Corruption Layer — mapeo, no aggregates de negocio |
| 10 | Identidad y Accesos | `identidad_accesos` | Transaccional, seguridad |
| 11 | Analítica | `analitica` | Read-model puro (CQRS-lite, ADR-003) — sin aggregates propios |

**Esquemas transversales (sin Bounded Context dueño):** el Domain Discovery (§3) clasifica *Auditoría y Cumplimiento*, *Almacenamiento de Medios* y *Observabilidad e Infraestructura* como Generic Subdomains, pero **no** los incluye entre los 11 Bounded Contexts de su §4 — son responsabilidades cruzadas, consumidas por varios contextos, sin un aggregate propio que las posea. Esto no es una inconsistencia del Domain Discovery: es intencional (son infraestructura de soporte, no dominio de negocio). Este documento les asigna esquema propio donde corresponde:

| Esquema transversal | Contenido | Justificación |
|---|---|---|
| `auditoria` | Log de auditoría append-only (ADR-010) | No pertenece a un solo Bounded Context — registra acciones de todos |
| `feature_flags` | Kill-switch y rollout gradual (ADR-020) | Configuración operativa transversal, no dato de negocio de un contexto |
| `prompts_ia` | Versionado de prompts (ADR-015) | Acoplado al pipeline de IA de `Conversación`, pero versionado/gobernado como artefacto independiente del ciclo de vida de una conversación individual |

El *Outbox* (ADR-004) **no** obtiene un esquema propio — cada esquema de Bounded Context productor mantiene su propia tabla de Outbox dentro de sí mismo (detalle en §4.1), consistente con la regla de "sin FKs cruzadas" y con lo ya descrito en `03` §4.2. El almacenamiento binario de imágenes (ADR-017) tampoco vive en ningún esquema de esta base de datos — vive en object storage externo; solo su metadata de referencia vive en `conversacion` (§5.3), por ser donde se origina y consume.

---

## 4. Mecanismos transversales de persistencia

Se definen antes del modelo por contexto (Sección 5) para que cada subsección de contexto solo referencie estos mecanismos en vez de repetir su diseño once veces.

### 4.1 Outbox por contexto

Confirma ADR-004 y lo ya descrito conceptualmente en `03` §4.2. Cada esquema de Bounded Context que produce eventos con efectos externos críticos mantiene su propia tabla `outbox` (ej. `agenda.outbox`, `conversacion.outbox`, `anticipos.outbox`, `notificaciones.outbox` — este último despacha, entre otros, el envío de WhatsApp que ADR-004 nombra explícitamente como efecto externo crítico) — nunca una tabla de Outbox compartida entre esquemas.

**Columnas conceptuales:** identificador (UUID), tipo de evento (texto — ej. `CitaConfirmada`), payload (JSON, el contenido del domain event), estado de despacho (enum: pendiente | despachado | fallido), número de intentos, creado en (`timestamptz` UTC), despachado en (nullable).

**Índice recomendado:** sobre (estado, creado_en), para que el proceso de despacho pueda encontrar eficientemente filas pendientes en orden — este índice es compatible tanto con un dispatcher único como con el mecanismo de reclamo `SELECT ... FOR UPDATE SKIP LOCKED` que `03` §4.2 dejó como recomendación `Decision Pending` (candidato a enmienda de ADR-004, `03` §11). **Este documento no re-decide ese mecanismo** — la forma de tabla aquí descrita sirve a cualquiera de las dos opciones sin cambio de esquema.

### 4.2 Idempotencia en puntos de entrada

Confirma ADR-021 (estrategia de dos capas: clave de idempotencia en el punto de entrada + invariante de negocio como respaldo).

**`Decision Pending` — ubicación del almacén de claves de idempotencia.**
- *Opciones consideradas:* (a) una tabla única compartida en un esquema transversal, consultada por todos los puntos de entrada (webhook de WhatsApp, endpoints de API, handlers de background jobs); (b) una tabla de idempotencia por esquema de contexto, cada una gestionando solo las claves relevantes a los casos de uso de ese contexto.
- *Evaluación:* la Opción (a) es más simple de operar (un solo lugar que monitorear/purgar), pero introduce una tabla escrita por múltiples contextos a la vez — no viola la regla de "sin FKs cruzadas" (no hay FK involucrada), pero sí diluye la propiedad clara de esquema por contexto que el resto de este documento mantiene. La Opción (b) es más consistente con la disciplina de frontera ya aplicada en todo el documento, a costa de una tabla más por esquema.
- *Recomendación:* Opción (b) — una tabla `idempotencia` dentro de cada esquema que la necesite (`agenda`, `anticipos`, `conversacion` como mínimo, dado que son los puntos de entrada con efecto de estado más sensible). Columnas conceptuales: clave de idempotencia (derivada de un identificador único real del evento/mensaje de origen, ej. el ID de mensaje de WhatsApp — ADR-021 exige esto explícitamente, no una aproximación heurística), caso de uso al que aplica, referencia al efecto ya producido (ej. `cita_id` si ya se creó), expira en.
- Se marca `Decision Pending` porque es una decisión de ubicación con un tradeoff real de simplicidad operativa vs. disciplina de frontera, no porque falte una opción técnicamente viable.

### 4.3 Auditoría append-only

Confirma ADR-010. Vive en el esquema transversal `auditoria` (§3), tabla `log_auditoria`, de solo-anexado (sin `UPDATE`/`DELETE` de aplicación).

**Columnas conceptuales:** identificador, tipo de acción (ej. `cambio_configuracion`, `accion_financiera`, `decision_ia`), actor (usuario o `sistema/IA`), sucursal relacionada (si aplica), entidad afectada (tipo + ID, como referencia simple, nunca FK — puede apuntar a cualquier esquema), detalle (JSON), timestamp UTC.

**Retención diferenciada dentro del mismo registro lógico** (resolución de F-14 ya adoptada en `03` §6.4, operacionalizada aquí): cuando la acción auditada es una decisión de IA, el registro separa dos partes con distinto régimen de retención — los **metadatos de la decisión** (qué caso de uso se invocó, versión de prompt, resultado, confianza, ID de correlación) con retención larga, y el **contenido conversacional textual crudo** (lo que la clienta escribió, lo que el modelo interpretó) con retención corta, acotada por la política de minimización de ADR-017/ADR-022. El valor exacto de "corta" sigue pendiente de la Pregunta Abierta #12 del Domain Discovery (marco regulatorio) — no se fija aquí, se hereda tal cual.

### 4.4 Feature flags

Confirma ADR-020. Vive en el esquema transversal `feature_flags`, tabla `flags`.

**Columnas conceptuales:** clave (texto, única), alcance (global | sucursal específica — referencia simple a `sucursales_personal.sucursales`, sin FK cruzada), habilitado (booleano), propósito (texto, obligatorio — ADR-020 exige que cada flag tenga un propósito documentado), fecha de retiro esperada (obligatoria, para evitar "flag debt" tal como el propio ADR exige). **Nunca** se usa esta tabla para configuración de negocio por sucursal (horarios, precios, personal) — eso vive como dato en `sucursales_personal`/`catalogo_cotizacion`, consistente con la distinción que ADR-020 ya estableció.

### 4.5 Versionado de prompts de IA

Confirma ADR-015. Vive en el esquema transversal `prompts_ia`, tabla `versiones_prompt`.

**Columnas conceptuales:** identificador de versión, contenido del prompt (texto), versión del esquema de salida estructurada emparejado (ADR-015 exige que ambos se versionen juntos, nunca por separado), autor, fecha de creación, y una marca de en qué punto del flujo Sandbox → Production (ADR-012) se encuentra actualmente — este campo refleja el flujo operativo que ADR-012/ADR-015 ya describen (validación en Sandbox contra el golden set de ADR-019 antes de promoverse), no una máquina de estados nueva sujeta a la restricción de la portada (esa restricción aplica solo a `Cita`, `Conversacion` y `TicketEscalamiento`).

### 4.6 Convenciones de tipos transversales

- **Claves primarias: UUID** en todos los esquemas — firme, no `Decision Pending`. Justificación: un identificador secuencial expondría volumen de negocio a un futuro integrador externo de la API pública (ADR-014), y UUID no requiere coordinación entre esquemas/instancias si algún contexto se extrae a servicio propio en el futuro (ADR-001/ADR-009, gatillos de revisión). Ninguna alternativa seria (ej. IDs secuenciales) compite en este proyecto — no hay tradeoff material que justifique `Decision Pending`.
- **Dinero:** entero en centavos (o unidad mínima de la moneda), nunca `float`/`decimal` de precisión flotante.
- **Fechas/horas:** `timestamptz` en UTC.
- **Rangos horarios:** tipo rango temporal nativo (equivalente a `tsrange` en PostgreSQL), no dos columnas sueltas de inicio/fin — habilita la restricción de exclusión descrita en §5.1.
- **Borrado suave vs. borrado físico:** no se decide de forma genérica aquí — depende de la clasificación de retención por tabla (Sección 8), que solo puede definirse después de tener el inventario completo de tablas.

---

## 5. Modelo de datos por contexto

Once subsecciones, una por cada Bounded Context del Domain Discovery (`01-domain-discovery.md` §4), en el mismo orden que ese documento usa en su §5. Cada tabla vive en el esquema de su contexto (Sección 3); toda referencia a otro contexto es un identificador simple, nunca una FK.

### 5.1 Agenda (`agenda`)

**`citas`** (aggregate raíz `Cita`, DD §5.1)
- Columnas conceptuales: identificador; `sucursal_id` (ref. a `sucursales_personal`, sin FK); `clienta_id` (ref. a `clientas`, sin FK); `manicurista_id` (ref. a `agenda.manicuristas_recurso` — FK real, mismo esquema; nullable — una cita puede no tener manicurista asignada); `cotizacion_snapshot` (JSON, congelado e inmutable tras confirmarse — contiene el desglose de composición por uña y el total calculado en el momento de la cotización, DD §5.1/§5.2); `rango_horario` (rango temporal, `hora_inicio`/`hora_fin` mutable únicamente vía reprogramación, que preserva la identidad de la fila — DD es explícito en que `CitaReagendada` muta la misma `Cita`, no crea una nueva); `estado` (enum de valores pendientes de la máquina de estados formal — ver portada, restricción #3, y DD Preguntas Abiertas #15); `anticipo_requerido` / `anticipo_pagado` (booleanos); `version` (entero, para bloqueo optimista en actualizaciones concurrentes de la misma fila — ver más abajo); marcas de tiempo de creación/actualización.
- **Control de concurrencia (principio 11.3) — decisión concreta.** El principio ya dejó las dos alternativas abiertas en prosa ("bloqueo optimista o restricción única a nivel de base de datos"); aquí se elige la combinación concreta, no una alternativa nueva no contemplada:
  - *Restricción de exclusión* (tipo `EXCLUDE`, con índice GiST, sobre `manicurista_id` + `rango_horario`, excluyendo del solapamiento el subconjunto de estados que la futura máquina de estados formal marque como "libera el horario", sin anticipar aquí cuáles serían) — esta es la que garantiza en la base de datos, de forma no evadible por la aplicación, el invariante de no-doble-booking. Es el mecanismo estándar de PostgreSQL para exactamente este problema (dos filas que no deben solaparse en un recurso compartido).
  - *Bloqueo optimista* (columna `version`, verificada en cada `UPDATE`) — protege contra actualizaciones concurrentes perdidas sobre la **misma** fila (ej. dos reprogramaciones simultáneas de la misma cita), un problema distinto al de solapamiento entre filas.
  - Se marca **firme**, no `Decision Pending`: no hay una alternativa seria igualmente válida para el invariante de no-doble-booking (confiar solo en validación de aplicación es exactamente el riesgo que el Domain Discovery ya identificó como inaceptable), y la combinación de ambos mecanismos es el patrón estándar de la industria para este problema exacto en PostgreSQL, sin tradeoff material entre opciones serias.

**`manicuristas_recurso`** (recurso agendable, DD §5.1 y nota de diseño DD §4/Pregunta Abierta #2)
- Columnas conceptuales: identificador; `sucursal_id` (ref., sin FK); `activa` (booleano); `manicurista_administrativa_id` (ref. **opcional** a `sucursales_personal.manicuristas`, sin FK).
- **Nota explícita:** esta tabla es intencionalmente distinta de `sucursales_personal.manicuristas` (§5.7) — el Domain Discovery es explícito en que "Manicurista" tiene dos significados distintos según el contexto (recurso agendable vs. registro administrativo) y que **no** debe existir una tabla compartida entre ambos si se busca desacoplamiento real (DD §4, nota de diseño). La referencia entre ambas es un ID simple opcional, nunca una fusión de tablas ni una FK cruzada.

**`bloqueos_horario`** (DD §5.1)
- Columnas conceptuales: identificador; `sucursal_id` (ref., sin FK); `manicurista_id` (ref. a `agenda.manicuristas_recurso` — **con FK real**, porque ambas tablas viven en el mismo esquema `agenda`; nullable, un bloqueo puede aplicar a toda la sucursal); `rango_horario` (rango temporal); `motivo` (texto).

**`lista_espera_entradas`** (aggregate raíz independiente `ListaDeEsperaEntrada`, DD §5.1)
- Columnas conceptuales: identificador; `clienta_id` (ref., sin FK); `servicio_deseado_id` (ref. a `catalogo_cotizacion`, sin FK); `ventana_fechas_preferida` (rango temporal); `estado` (enum — el Domain Discovery no fijó valores exhaustivos para esta entidad, a diferencia de `Cita`/`Conversacion`/`TicketEscalamiento`, que sí están explícitamente restringidas; se propone un conjunto de trabajo ilustrativo — `activa`, `notificada`, `expirada`, `cumplida` — sujeto a ajuste, no es una máquina de estados formal restringida); `expira_en` (`timestamptz`, valor exacto pendiente de DD Pregunta Abierta #9).

### 5.2 Catálogo y Cotización (`catalogo_cotizacion`)

**`servicios`** (aggregate raíz `Servicio`, DD §5.2)
- Columnas conceptuales: identificador; `nombre`; `categoria`; `duracion_base_minutos` (entero); `precio_base` (entero, centavos); `activo` (booleano).

**`modificadores_diseno`** (aggregate raíz independiente `ModificadorDeDiseño`, DD §5.2)
- Columnas conceptuales: identificador; `nombre`; `minutos_adicionales` (entero); `precio_adicional` (entero, centavos).

**`servicio_modificadores_aplicables`** (relación, dentro del mismo esquema, FK real)
- Tabla de unión entre `servicios` y `modificadores_diseno` — DD especifica que `Servicio` "incluye referencia a modificadores aplicables", lo cual implica una relación explícita, no "cualquier modificador aplica a cualquier servicio" de forma implícita.

**`servicio_sucursal_override`** (condicional a DD Pregunta Abierta #10, sin confirmar)
- Columnas conceptuales: `sucursal_id` (ref. a `sucursales_personal`, sin FK cruzada); `servicio_id` (FK real, mismo esquema); `precio_override`/`duracion_override`/`activo_override` (todas nullable, heredando del valor global de `servicios` cuando no hay override).
- **`Decision Pending`.** *Opciones consideradas:* (a) no modelar esta tabla todavía, esperar la confirmación de negocio de la Pregunta #10; (b) modelarla desde ahora como estructura aditiva, sin activarla funcionalmente hasta que se confirme la pregunta.
- *Recomendación:* Opción (b) — el costo de modelarla ahora es bajo (es una tabla adicional, no un cambio disruptivo de `servicios`) y evita un rediseño si la Pregunta #10 se confirma afirmativamente, consistente con cómo este proyecto ya trata otros supuestos de trabajo (ej. RPO/RTO de ADR-022). Si la respuesta de negocio es "no hay override por sucursal", la tabla simplemente no se puebla ni se usa — no bloquea nada mientras tanto.
- **`Decision Pending` resuelto (`DISCOVERY_CHECKLIST.md` 1.11, 2026-08-04):** confirmado que no hay override por sucursal — la tabla queda modelada exactamente como esta sección ya anticipaba, sin poblarse ni usarse. Sin cambio de estructura.

**Nota de alcance — `CotizacionServicio`/`ComposicionPorUña`:** el Domain Discovery es explícito en que estos Value Objects **no se persisten como entidad propia** — se congelan dentro de `agenda.citas.cotizacion_snapshot` al confirmarse (§5.1 de este documento). No existe aquí una tabla `cotizaciones` ni `composiciones_por_una`; crearla sería una redundancia contraria al diseño ya congelado.

### 5.3 Conversación (`conversacion`)

**`conversaciones`** (aggregate raíz `Conversacion`, DD §5.3)
- Columnas conceptuales: identificador; `clienta_id` (ref., sin FK, nullable si el número de WhatsApp aún no fue identificado con una clienta); `sucursal_id` (ref., sin FK, derivada del número de WhatsApp receptor); `modo` (enum: `bot` | `humano` — DD lo enumera explícitamente como `ModoConversacion` y lo distingue del atributo `estado`; **no** está sujeto a la restricción de la portada, que aplica solo al atributo `estado`); `estado` (enum de valores pendientes de la máquina de estados formal — ver portada, restricción #3, y DD Pregunta Abierta #16); `version` (entero, para la revalidación atómica de `modo` inmediatamente antes de cada respuesta de IA que exige ADR-016).

**`mensajes`** (entidad hija de `Conversacion`, DD §5.3)
- Columnas conceptuales: identificador; `conversacion_id` (FK real, mismo esquema); `remitente`; `tipo` (`texto` | `imagen`); `contenido` (texto, o referencia si es imagen — ver tabla siguiente); `timestamp` (UTC); `intencion_detectada`; `sentimiento`; `tokens_consumidos`; `costo_ia` (entero, centavos o unidad mínima de costo).
- **Nota heredada del Domain Discovery (sin resolver aquí):** "el volumen de mensajes probablemente exija particionamiento de almacenamiento aunque el límite de consistencia del aggregate se mantenga lógico" (DD §5.3). Este documento no diseña un esquema de particionamiento concreto — es un detalle de implementación posterior a esta serie, no de modelo lógico/físico a este nivel.

- **Nota (`DISCOVERY_CHECKLIST.md` 1.22, 2026-08-04):** la conversación se confirma como identidad persistente por clienta — `clienta_id` ya es el ancla de esa persistencia, sin requerir columna nueva. El mecanismo de reseteo de `modo` tras inactividad sigue sin resolverse; no se modela aquí.

**`memoria_conversacion`** (DD §5.3)
- Columnas conceptuales: `clienta_id` (ref., sin FK, clave de la tabla — persiste por clienta, no por conversación individual, tal como el Domain Discovery lo define explícitamente); `resumen_contexto` (JSON); `actualizado_en`.

**`imagenes_referencia`** (metadata de archivo, ADR-017 — el binario vive en object storage externo, nunca en esta base de datos)
- Columnas conceptuales: identificador; `mensaje_id` (FK real, mismo esquema); `conversacion_id` (FK real, mismo esquema, para trazabilidad directa sin depender de un JOIN a través de `mensajes`); `clave_objeto_storage` (referencia externa al proveedor de storage de `03` §3.8, `Decision Pending` en ese documento — aquí solo se guarda la clave/ruta, nunca una URL firmada, que se genera al vuelo); `recibida_en`; `retener_hasta` (`timestamptz`, valor exacto pendiente de DD Pregunta Abierta #12, ver también Sección 8).

### 5.4 Escalamiento (`escalamiento`)

**`tickets_escalamiento`** (aggregate raíz `TicketEscalamiento`, DD §5.4)
- Columnas conceptuales: identificador; `conversacion_id` (ref. a `conversacion`, sin FK cruzada); `motivo` (enum: `imagen` | `audio_complicado` | `queja` | `palabra_prohibida` — DD lo enumera explícitamente como `MotivoEscalamiento`, es un Value Object distinto del atributo `estado`, no está sujeto a la restricción de la portada); `empleado_asignado_id` (ref. a `identidad_accesos.usuarios`, sin FK cruzada, nullable); `estado` (enum de valores pendientes de la máquina de estados formal — ver portada, restricción #3; DD no enumeró valores para este atributo tampoco, a diferencia de `motivo`).

### 5.5 Clientas / CRM (`clientas`)

**`clientas`** (aggregate raíz `Clienta`, DD §5.5)
- Columnas conceptuales: identificador; `telefono` (único — es la identidad global de la clienta, DD Pregunta Abierta #6, supuesto de trabajo ya adoptado: alcance global, no por sucursal); `nombre`; `sucursal_favorita_id` (ref., sin FK); `manicurista_favorita_id` (ref., sin FK); `notas_internas` (texto); `cumpleanos`; `estado` (enum: `normal` | `vip` | `lista_roja` | `bloqueada` — DD lo enumera explícitamente como `EstadoClienta`; `Clienta` **no** es una de las tres entidades cuya máquina de estados está restringida por la portada, por lo que este atributo sí se modela con sus valores completos); `estadisticas` (JSON, calculado — última visita, ticket promedio, servicios favoritos; no editable directamente, se deriva de eventos de dominio).

### 5.6 Anticipos (`anticipos`)

**`solicitudes_anticipo`** (aggregate raíz `SolicitudAnticipo`, DD §5.6)
- Columnas conceptuales: identificador; `cita_id` (ref. a `agenda`, sin FK cruzada); `clienta_id` (ref., sin FK); `monto` (entero, centavos + código de moneda); `estado` (enum: `pendiente` | `pagado` | `expirado` | `reembolsado` — DD lo enumera explícitamente; no es una de las tres entidades restringidas); `expira_en` (`timestamptz` — el campo existe, el valor/ventana de gracia exacta permanece pendiente de DD Pregunta Abierta #4, no resuelta aquí).

### 5.7 Sucursales y Personal (`sucursales_personal`)

**`sucursales`** (aggregate raíz `Sucursal`, DD §5.7)
- Columnas conceptuales: identificador; `nombre` (único); `numero_whatsapp_alias` (identificador/alias de referencia — el secreto/credencial real vive en el gestor de secretos, `03` §5.5, nunca aquí); `horario_semanal` (JSON); `descansos` (JSON); `en_mantenimiento` (booleano, por defecto `false` — RN-SUC-02; se activa/desactiva por sucursal individual o de forma global para todas a la vez, ver `05-api-design.md` §10 sobre la inconsistencia de rutas que expone ambos alcances). Documentado aquí en el hardening transversal de 2026-08-11 — existía en el esquema real desde la construcción del módulo pero no se había reflejado en este documento.

**`dias_festivos`** (entidad hija de `Sucursal`, DD §5.7 — modelada como tabla propia en vez de JSON embebido, para permitir consultas indexadas por fecha, ej. al calcular disponibilidad)
- Columnas conceptuales: identificador; `sucursal_id` (FK real, mismo esquema); `fecha`; `descripcion`.

**`manicuristas`** (registro administrativo, aggregate raíz independiente, DD §5.7)
- Columnas conceptuales: identificador; `nombre`; `activa` (booleano).

**`manicuristas_sucursales`** (relación muchos-a-muchos, FK real — DD usa explícitamente "sucursal(es)" en plural para esta entidad, indicando que una manicurista puede pertenecer a más de una sucursal)
- Columnas conceptuales: `manicurista_id` (FK real), `sucursal_id` (FK real).

### 5.8 Notificaciones (`notificaciones`)

> Contexto añadido en consolidación posterior del Domain Discovery (hallazgo DM-07, DD §5.12), que dejó explícitamente pendiente la frontera de su aggregate — "queda pendiente de definirse en una iteración posterior del modelo". Este documento es esa iteración posterior en su dimensión de datos.

**`Decision Pending` — frontera del aggregate `Notificacion`.**
- *Opciones consideradas:* (a) `Notificacion` como aggregate raíz independiente, con su propia tabla y ciclo de vida propio (programada → enviada/fallida), consumiendo eventos de `Agenda`/`Escalamiento`/`Clientas` vía Outbox; (b) `Notificacion` como entidad hija de `Cita` (vive dentro del aggregate de Agenda), dado que la mayoría de notificaciones (recordatorio, confirmación) están atadas 1:1 a una cita; (c) sin aggregate propio — cada notificación es simplemente un efecto de un job de background (ADR-018) sin registro de dominio persistente más allá del log del job.
- *Evaluación:* la Opción (c) contradice el requisito de que "Notificaciones" es un Bounded Context con Domain Events propios ya catalogados (`NotificacionProgramada`, `NotificacionEnviada`, `NotificacionFallida`, DD §5.12) — si no hay una entidad que represente ese ciclo de vida, esos eventos no tienen un sujeto claro. La Opción (b) ata el ciclo de vida de la notificación al de `Cita`, pero el propio DD describe `Notificaciones` como consumidor de eventos de **Agenda, Escalamiento y CRM** simultáneamente — una notificación de escalamiento no tiene una `Cita` relacionada, por lo que anidarla dentro de `Cita` no cubre todos los casos reales.
- *Recomendación:* Opción (a) — `Notificacion` como aggregate raíz independiente en su propio esquema, con referencia opcional a `cita_id` (nullable, para el caso de recordatorio/confirmación) y a `ticket_escalamiento_id` (nullable, para notificaciones de escalamiento), ambas sin FK cruzada. Columnas conceptuales: identificador; `cita_id` (ref., sin FK cruzada, nullable); `ticket_escalamiento_id` (ref., sin FK cruzada, nullable); `clienta_id` (ref., sin FK cruzada, nullable — una notificación de escalamiento va al empleado, no a la clienta); `tipo` (enum: `recordatorio` | `confirmacion` — DD lo enumera explícitamente como `TipoNotificacion`; el catálogo de tipos probablemente deba extenderse para cubrir tanto notificación de escalamiento como el aviso de cupo disponible en lista de espera —`CupoDisponibleParaListaEspera`, DD §5.1—, no cerrado aquí); `canal` (enum: `whatsapp` — hoy el único valor); `estado_envio` (enum de trabajo: `pendiente` | `enviada` | `fallida` — no es una de las tres entidades restringidas por la portada, DD tampoco fijó valores exhaustivos, se propone como ilustrativo).
- Se marca `Decision Pending` porque es, en esencia, una decisión de modelado de dominio (frontera de aggregate) que el propio Domain Discovery dejó abierta — no una decisión puramente técnica. Se anota en la Sección 11 la ambigüedad de **qué documento** debería formalizar el cierre de esta decisión (¿una adenda a `01-domain-discovery.md`, análoga a como se incorporó `Notificaciones` mismo vía DM-07, o queda registrada solo aquí?).

### 5.9 Sincronización de Calendario (`sincronizacion_calendario`)

**`mapeo_cita_evento_calendario`** (Anti-Corruption Layer, DD §5.10, ADR-006)
- Columnas conceptuales: identificador; `cita_id` (ref. a `agenda`, sin FK cruzada); `sucursal_id` (ref., sin FK); `calendario_google_id` (identificador del calendario de Google de esa sucursal — un calendario por sucursal es el supuesto de trabajo de DD Pregunta Abierta #14, sin confirmar); `evento_google_id`; `ultima_sincronizacion_en`; `estado_sincronizacion` (enum de trabajo: `pendiente` | `sincronizado` | `error` — no restringido por la portada, propuesta ilustrativa).
- Esta tabla es, por diseño, el único lugar donde el formato/identificadores de Google Calendar tocan el sistema — ninguna columna de `agenda.citas` conoce la existencia de Google Calendar, consistente con el principio de Anti-Corruption Layer ya establecido (`02-architecture-principles.md` §2, ADR-006).
- **Nota (`DISCOVERY_CHECKLIST.md` 1.25, 2026-08-04):** confirmada la diferenciación por color entre sucursales. **Sigue sin resolver** si el modelo técnico es un calendario de Google independiente por sucursal (el supuesto ya usado en `calendario_google_id`) o uno compartido con colores internos — ambigüedad estructural real, no se cierra aquí.

### 5.10 Identidad y Accesos (`identidad_accesos`)

**`roles`** — **no existe como tabla, ver `ADR-024`.** Catálogo cerrado de 7 valores (DD §5.8), implementado como el `Rol` enum estático de TypeScript (`shared/auth/rol.ts`), no como fila de base de datos — decisión confirmada en `ADR-024` frente a la alternativa de tabla dinámica.
- Valores: `Super Admin`, `Administrador`, `Gerente`, `Recepcionista`, `Manicurista`, `Analista`, `Solo lectura`.

**`usuarios`** (aggregate raíz `Usuario`, DD §5.8) — **implementada, alcance mínimo (`FL-SEG-01`/`FL-SEG-03`/`FL-SEG-05`, 2026-08-22/23).**
- Columnas reales: `id` (UUID, PK); `email` (UNIQUE); `nombre`; `rol` (texto, validado contra el `Rol` enum en el borde de la API — no `rol_id` como el modelo conceptual original suponía, consistente con que `roles` no es tabla); `activa` (booleano, `DEFAULT true` — no `estado` de texto; ningún documento fija más de dos valores para este atributo, y el precedente real de código (`sucursales_personal.manicuristas.activa`) ya usa este mismo patrón, `FL-SEG-05`); `creado_en`; `actualizado_en`.
- **Deliberadamente sin `mfa_habilitado` todavía** — columna conceptual del Domain Discovery, pero ningún caso de uso de este incremento la usa (pertenece a `FL-SEG-07`). Se agrega en la migración del caso de uso que la necesite, no antes — mismo principio ya aplicado en todo el proyecto (`IMPLEMENTATION_MASTER_PLAN.md` §9).
- **Sin `supabase_user_id`** — este incremento no integra con Supabase Auth (`FL-SEG-06`, separado, `ADR-024`); la columna de correlación se evalúa cuando ese flujo se construya.
- **`activa=false` no revoca acceso efectivo todavía** — hecho verificado, no una limitación oculta: `FL-SEG-05` (2026-08-23) solo modifica el registro administrativo de Blanc; nada en el sistema hoy (ni `JwtAuthGuard`, ni ningún hook de claims — que ni siquiera existe) consulta esta columna para autorizar. La revocación efectiva depende de `FL-SEG-06` (Supabase) y de que un futuro mecanismo de emisión de claims la respete. Ver `ADR-010` (revocación inmediata vía invalidación de refresh token, no vía lookup por request).

**`usuarios_sucursales`** (relación, FK real — soporta tanto alcance global como alcance limitado sin rediseño) — **implementada, alcance mínimo (`FL-SEG-04`, 2026-08-22).**
- Columnas reales: `usuario_id` (FK real → `usuarios.id`, `ON DELETE CASCADE`); `sucursal_id` (identificador simple, sin FK cruzada — `sucursales_personal` es otro Bounded Context, ADR-005). UNIQUE(`usuario_id`, `sucursal_id`). Sin `id` propio, sin timestamps, sin soft delete — mismo patrón exacto que `sucursales_personal.manicuristas_sucursales`.
- Ausencia de filas para un usuario se interpreta, según se confirme DD Pregunta Abierta #11, como alcance global o como sin acceso — **`Decision Pending`**, heredado de la misma pregunta que ya deja pendiente ADR-010 (`03` §5.2). El mecanismo de asignación explícita (esta tabla) ya está construido y no depende de esa respuesta — solo el comportamiento *por defecto quando no hay filas* la necesita.
- **Parcialmente resuelto (`DISCOVERY_CHECKLIST.md` 1.26, 2026-08-04):** para los roles Analista y Solo lectura, confirmado alcance **global** (ausencia de filas = todas las sucursales). El `Decision Pending` general (otros roles, mecanismo por defecto) **no se cierra** — solo se resuelve el caso específico ya preguntado. Resuelve también el Pendiente P2 de `ARCHITECTURE_CLOSURE_PLAN.md` (no actualizado aquí, fuera de alcance de este documento).
- **Hallazgo nuevo, sin resolver (auditoría de `FL-SEG-04`, 2026-08-22):** ningún documento dice si la **cuenta** de un usuario con rol Manicurista participa de esta tabla directamente, o si su alcance se deriva del recurso agendable (`sucursales_personal.manicuristas_sucursales`, `RN-SEG-04` ya separa ambos conceptos). No se resuelve aquí — el mecanismo genérico funciona para cualquier rol, pero no se decide si Manicurista lo usa en la práctica.

**`permisos`** (DD §5.8) — **No implementada, ver `ADR-024` (2026-08-11).**
- Columnas conceptuales originales: identificador; `rol_id` (FK real); `recurso`; `accion`.
- `ADR-024` evaluó esta tabla (modelo de autorización dinámico) contra el `Rol` enum estático ya construido y probado en el módulo Sucursales y Personal, y **recomendó mantener el enum** — 7 roles fijos, sin evidencia de negocio que justifique permisos configurables en runtime (`ADR-009`, single-tenant hoy). Esta fila **no se elimina** del modelo lógico — queda como diseño considerado y explícitamente no construido, revisable si aparece un segundo cliente con necesidades distintas (`ADR-009`, Future Revisit Criteria).

**`refresh_tokens`** (ADR-010, revalidación y rotación) — **No implementada, ver `ADR-024` (2026-08-11).**
- Columnas conceptuales originales: identificador; `usuario_id` (FK real, mismo esquema); `hash_token`; `cadena_rotacion_id` (para detectar reuso de un token ya rotado, tal como ADR-010 exige); `revocado` (booleano); `expira_en`; `creado_en`.
- El `Decision Pending` que esta fila señalaba ("depende de si el proveedor de autenticación gestiona rotación/revocación internamente") **se resuelve en `ADR-024`, verificado contra documentación pública de Supabase Auth (no contra el proyecto real de Blanc todavía)**: Supabase Auth gestiona nativamente la rotación en cada uso y expone revocación server-side (`admin.signOut`, `ban_duration`) — cubre el constraint que `ADR-010` exigía sin que Blanc necesite construir ni mantener esta tabla. Fila conservada por trazabilidad, no por vigencia — no se elimina.

**`log_auditoria`** — vive en el esquema transversal `auditoria` (§3), no aquí, pese a estar estrechamente relacionado con Identidad y Accesos — se documenta en §4.3 para no duplicar su diseño.

### 5.11 Analítica (`analitica`)

Sin aggregates de negocio propios (DD §5.9, ADR-003) — es, por diseño, un read-model puro alimentado por eventos de dominio de todos los demás contextos, nunca por escritura transaccional directa desde otro contexto (violaría CQRS-lite, ADR-003, y la separación de esquemas, ADR-005). Las tablas concretas de este esquema se detallan en la Sección 6.2, junto con el mecanismo de actualización — se documenta su existencia y naturaleza aquí únicamente para mantener la correspondencia 1:1 con los 11 Bounded Contexts del Domain Discovery.

---

## 6. Read models CQRS-lite

Confirma ADR-003 y el principio 11.7 — CQRS-lite aplica **solo** a estos dos casos, ningún otro contexto tiene modelo de lectura separado.

### 6.1 Disponibilidad de Agenda

**Restricción ya fijada, no reabierta:** el principio 13.4 (`02-architecture-principles.md`) es explícito — el cache/read-model de disponibilidad **nunca** es la autoridad final; la confirmación de una `Cita` siempre revalida contra `agenda.citas` y su restricción de exclusión (§5.1), que es donde el invariante de no-doble-booking realmente se garantiza. Esto ya lo confirma ADR-003 directamente: *"la decisión final de confirmar siempre valida contra el modelo transaccional (fuente de verdad), la proyección de disponibilidad solo acelera la búsqueda inicial."*

Con esa garantía ya fijada, el mecanismo de actualización del read-model de disponibilidad no compromete ningún invariante crítico sin importar cuál se elija — es, por tanto, una decisión de bajo riesgo real pese a no estar cerrada.

**`Decision Pending` — mecanismo de materialización.**
- *Opciones consideradas:* (a) vista materializada de PostgreSQL sobre `agenda.citas` + `agenda.bloqueos_horario` + `sucursales_personal.horario_semanal`/`dias_festivos`, refrescada periódicamente o por trigger; (b) una tabla propia (`agenda.disponibilidad_slots` o similar) actualizada de forma asíncrona por los mismos domain events que ya disparan el Outbox (`CitaConfirmada`, `CitaCancelada`, `HorarioBloqueado`, etc.); (c) sin read-model separado, calculando disponibilidad en vivo contra las tablas transaccionales en cada consulta.
- *Evaluación:* la Opción (c) es exactamente lo que ADR-003 ya rechazó (la búsqueda de disponibilidad tiene forma de lectura muy distinta a la de escritura, y de alta frecuencia — calcularla en vivo contra tablas transaccionales en cada mensaje de WhatsApp compite por recursos con `Agenda` bajo carga). Las Opciones (a) y (b) son ambas técnicamente válidas y ninguna compromete el invariante (ya resuelto en `agenda.citas`); difieren en operación (una vista materializada es más simple de mantener pero refresca en bloque; una tabla propia actualizada por evento es más granular pero es una pieza más de código a mantener).
- *Recomendación:* Opción (b), por consistencia con el resto del documento (todo lo demás ya fluye vía Outbox/domain events, no vía refresco periódico de base de datos) — pero se marca `Decision Pending` porque la Opción (a) sigue siendo una alternativa seria, no descartable de plano, y depende en parte de qué tan cómodo esté el equipo con vistas materializadas de PostgreSQL (criterio 6 de `03` §2).

### 6.2 Analítica

Alimentada por consumo de domain events de **todos** los demás contextos (vía sus respectivas tablas de Outbox, §4.1) — nunca por lectura directa de las tablas transaccionales de otro esquema, lo cual violaría tanto ADR-003 como ADR-005.

**Tablas conceptuales** (denormalizadas, de hechos agregados — no un espejo 1:1 de las tablas transaccionales): métricas diarias por sucursal (ventas, ocupación, cancelaciones); embudo de conversión (etapas de conversación → cotización → agendamiento → confirmación); servicios más vendidos; costo e interacción de IA por período (tokens, costo, resultado — el mismo dato que alimenta el dashboard técnico y de negocio, ADR-011). No se especifica aquí un esquema exhaustivo de estas tablas — el detalle de qué KPIs exactos y su periodicidad de agregación es información que puede refinarse durante la implementación sin afectar ninguna decisión de este documento; lo que sí está decidido es que **son tablas propias del esquema `analitica`**, alimentadas de forma eventualmente consistente, nunca en la ruta transaccional crítica.

**Rezago aceptable:** ya fijado como `Decision Pending` en `03` §6.3 (SLO provisional de 15 minutos de rezago máximo del read-model de Analítica) — no se re-decide aquí, solo se hereda como restricción operativa sobre el mecanismo de actualización de este esquema.

---

## 7. Consistencia entre aggregates y snapshot de cotización

### 7.1 Los tres pares de consistencia eventual (DD §5.11) — sin reabrir

El Domain Discovery ya identificó tres pares de aggregates que requieren coordinación no transaccional: `Cita ↔ SolicitudAnticipo`, `Conversacion ↔ TicketEscalamiento`, `Cita ↔ ListaDeEsperaEntrada`. Este documento **no redefine estos pares** — el mecanismo de coordinación (Domain Events + Transactional Outbox, ADR-004) ya está descrito en §4.1, y los handlers que consumen estos eventos ya deben ser idempotentes (ADR-021, §4.2).

Lo que el propio Domain Discovery dejó explícitamente pendiente — *"queda pendiente, en una iteración posterior de este documento, definir la ventana de inconsistencia tolerable y la acción compensatoria si la sincronización falla o se retrasa"* (DD §5.11) — se refiere a una iteración posterior del **modelo de dominio** (`01-domain-discovery.md`), documento que está cerrado y que este proyecto no reabre. Sin embargo, la **implementación técnica** de esa compensación (qué estructura de datos detecta una divergencia y qué acción dispara) sí es competencia de este documento — es un vacío de modelo de datos, no de dominio.

**`Decision Pending` — mecanismo técnico de reconciliación/compensación.**
- *Opciones consideradas:* (a) sin mecanismo de reconciliación explícito, confiar en que el Outbox con reintentos (ADR-004) eventualmente entregue todo — deja sin resolver qué pasa si la ventana de inconsistencia se extiende más allá de lo aceptable (ej. un `SolicitudAnticipo` que nunca se enteró de que su `Cita` fue cancelada); (b) un job de reconciliación periódico por cada uno de los tres pares, que detecta divergencias (ej. una `Cita` cancelada con una `SolicitudAnticipo` todavía `pendiente`) y aplica una acción compensatoria específica del par (ej. expirar la solicitud); (c) tres mecanismos ad-hoc distintos, uno por par, sin un patrón compartido.
- *Evaluación:* la Opción (a) es exactamente el vacío que el Domain Discovery señaló como pendiente de resolver — dejarlo así perpetúa el riesgo. La Opción (c) genera tres soluciones distintas al mismo problema estructural (divergencia entre dos aggregates relacionados), inconsistencia evitable. La Opción (b) da un patrón único y reutilizable, ejecutado como background job (ADR-018, ya con cola durable e idempotencia), con la ventana de tolerancia y la acción compensatoria configurables por par.
- *Recomendación:* Opción (b) — un job de reconciliación por par, ejecutado en la cola de background jobs ya definida (ADR-018), con una tabla de configuración simple (par, ventana de tolerancia, acción) más que tres implementaciones distintas. El valor exacto de la ventana de tolerancia y el detalle de la acción compensatoria de cada par no se fija aquí — depende de una definición de negocio que el Domain Discovery no proveyó (mismo tipo de vacío que ADR-022 dejó para RPO/RTO).
- Se marca `Decision Pending` porque, aunque la dirección del mecanismo es de confianza razonable, cierra una ambigüedad que el propio Domain Discovery dejó abierta y que afecta a tres pares de aggregates distintos — no se asume silenciosamente. Candidato a ADR, ver Sección 11.

### 7.2 Snapshot inmutable de cotización y su corrección

El snapshot de `agenda.citas.cotizacion_snapshot` (§5.1) ya es inmutable por diseño (principio 11.8, DD §5.1) — nunca se muta si el catálogo cambia después de confirmarse la cita. Esto protege contra cambios *legítimos* de catálogo, pero el Domain Discovery deja explícitamente sin resolver qué ocurre si el snapshot original fue **erróneo** por error humano de captura (DD Pregunta Abierta #13, hallazgo F-28 de `ARCHITECTURE_REVIEW.md`).

El diseño del caso de uso de corrección administrativa en sí **no** es competencia de este documento (es diseño de caso de uso/dominio, fuera de alcance). Lo que sí es competencia de datos es que, si tal caso de uso llega a diseñarse, **no debe mutar el snapshot original** — mutarlo violaría el principio de inmutabilidad y destruiría el registro de lo que realmente se cotizó y confirmó en su momento (relevante para auditoría, ADR-010).

**`Decision Pending` — estructura de datos para soportar una futura corrección.** Se propone, como estructura aditiva de bajo costo (sin activarse funcionalmente hasta que el caso de uso se diseñe): una tabla `agenda.ajustes_cotizacion` con `cita_id` (FK real, mismo esquema), snapshot corregido, motivo del ajuste, autor, timestamp — nunca sobrescribiendo `cotizacion_snapshot`. Se marca `Decision Pending` porque depende de un caso de uso todavía sin diseñar (DD Pregunta Abierta #13/F-28), no de una alternativa técnica sin resolver.
- **Nota (`DISCOVERY_CHECKLIST.md` 1.8, 2026-08-04):** ya se confirmó quién autoriza la corrección (la Dueña) y cómo se aplica (por medio de la plataforma, nunca automática) — el `Decision Pending` **no se cierra**, porque el caso de uso en sí (flujo, momento exacto de captura) sigue sin diseñar. Esta tabla sigue sin activarse.

---

## 8. Clasificación de retención por clase de dato

Operacionaliza ADR-022 (retención diferenciada) y ADR-017 (minimización de datos personales) sin fijar plazos exactos — los plazos exactos siguen pendientes de DD Pregunta Abierta #12 (marco regulatorio) y de la confirmación de negocio que el propio ADR-022 ya marca como pendiente. Esta clasificación tampoco decide borrado suave vs. físico por tabla de forma definitiva — es la base sobre la que esa decisión debe tomarse en implementación.

**Nota (`DISCOVERY_CHECKLIST.md` 1.27, 2026-08-04):** la Dueña registró una postura informal (no conoce obligación aplicable hoy) — no es validación jurídica formal. La clasificación de esta sección no cambia; los plazos exactos siguen sin fijarse.

| Clase | Tablas | Justificación |
|---|---|---|
| **Financiero / auditoría (retención larga)** | `anticipos.solicitudes_anticipo`, `auditoria.log_auditoria` (metadatos de decisión, §4.3), `agenda.citas` | Valor probatorio ante disputas de cliente (ADR-022) — mismo tratamiento que ADR-022 ya da a registros financieros y de auditoría. |
| **Conversacional / multimedia (retención corta, sujeta a marco regulatorio)** | `conversacion.mensajes`, `conversacion.imagenes_referencia`, `conversacion.memoria_conversacion`, `auditoria.log_auditoria` (contenido conversacional crudo, §4.3) | Datos personales sensibles sujetos al principio de minimización (ADR-017/ADR-022) — la resolución de F-14 (`03` §6.4) ya estableció esta separación dentro del mismo registro de auditoría. |
| **Operativa (retención media, sin sensibilidad personal directa)** | `notificaciones.notificaciones`, `sincronizacion_calendario.mapeo_cita_evento_calendario`, `agenda.outbox` y demás tablas de Outbox por esquema, `identidad_accesos.refresh_tokens` | Utilidad decreciente con el tiempo una vez cumplido su propósito operativo; no requiere el mismo rigor de minimización que datos conversacionales, ni el mismo valor probatorio que datos financieros. |
| **Configuración (sin política de retención por antigüedad — vive mientras el dato siga vigente)** | `catalogo_cotizacion.*`, `sucursales_personal.*`, `identidad_accesos.roles`/`permisos`/`usuarios`, `feature_flags.flags`, `prompts_ia.versiones_prompt` | Son catálogos/configuración vigente, no eventos con antigüedad — se rigen por su propio ciclo de vida (activo/inactivo), no por retención temporal. |

---

## 9. Riesgos de inconsistencia detectados

1. **Acoplamiento `identidad_accesos.refresh_tokens` ↔ proveedor de autenticación (`03` §3.9).** Si el proveedor finalmente elegido gestiona rotación/revocación internamente, esta tabla podría no requerirse tal cual, o requerir columnas adicionales específicas del proveedor. No bloquea el resto del modelo — está aislada en una sola tabla de un solo esquema.
2. **Acoplamiento `agenda.disponibilidad_slots` (read-model, §6.1) ↔ mecanismo de dispatcher de Outbox (`03` §4.2, F-03).** Si el read-model se actualiza vía consumo de eventos (Opción recomendada en §6.1), su frescura depende directamente de qué tan rápido se despache el Outbox — el mismo SLO de rezago ya fijado en `03` §6.3 aplica aquí también, no es una nueva pieza de riesgo, solo una dependencia a tener presente.
3. **Frontera del aggregate `Notificacion` (§5.8) es, en sentido estricto, una decisión de modelado de dominio, no puramente técnica.** Queda ambiguo si su cierre formal debería vivir como adenda a `01-domain-discovery.md` (análogo a como se incorporó el propio Bounded Context `Notificaciones` vía DM-07) o si basta con la resolución registrada aquí. Se señala explícitamente para que el cliente decida el vehículo de cierre, no se asume ninguno.
4. **`servicio_sucursal_override` (§5.2) modelada preventivamente sobre una pregunta de negocio sin confirmar (DD #10).** Riesgo bajo y aceptado: si la respuesta final es "no hay override por sucursal", la tabla queda simplemente sin uso — no genera inconsistencia, solo trabajo de modelado no aprovechado. **Confirmado 2026-08-04 (`DISCOVERY_CHECKLIST.md` 1.11):** no hay override — riesgo materializado como esperado, sin costo real.
5. **Ubicación del almacén de idempotencia (§4.2) afecta directamente el diseño de `05-api-design.md`.** Los contratos de API deberán especificar cómo se transmite la clave de idempotencia (header, campo de payload) de forma consistente con la ubicación elegida aquí — se señala como dependencia hacia adelante, no como inconsistencia actual.
6. **Los atributos `estado` de `Cita`, `Conversacion` y `TicketEscalamiento` son, deliberadamente, tipos sin valores concretos en este documento.** Esto significa que la restricción de exclusión de `agenda.citas` (§5.1) y cualquier lógica futura que dependa de "qué estados liberan el horario" o "qué estados son terminales" **no puede implementarse literalmente** hasta que la máquina de estados formal se diseñe. No es un defecto de este documento — es la consecuencia directa y esperada de la restricción de alcance ya acordada — pero se deja constancia explícita de que es un bloqueante real para pasar de este modelo lógico a DDL ejecutable.
7. **El mecanismo de reconciliación entre pares de aggregates (§7.1) introduce un componente nuevo (job de reconciliación) no mencionado explícitamente en ningún ADR existente**, aunque se apoya enteramente en infraestructura ya decidida (ADR-018, cola de background jobs). Se marca como candidato a ADR en la Sección 11, no como una contradicción.

---

## 10. Tabla de trazabilidad

| Sección de este documento | Origen | Tipo de origen |
|---|---|---|
| §2.1, §3 (conteo de 11 esquemas) | Domain Discovery §4 (11 Bounded Contexts) | Domain Discovery (corrige conteo desactualizado de ADR-001/005) |
| §2.2–2.5, 2.7–2.9 | `02-architecture-principles.md` §11 | Principios |
| §2.6 | ADR-012 | ADR |
| §2.11 | `03-technical-architecture.md` §3.4 | Forward-pointer heredado, no cerrado (instrucción del cliente) |
| §3 (esquemas transversales) | Domain Discovery §3 (Generic Subdomains sin Bounded Context propio) | Domain Discovery |
| §4.1 Outbox | ADR-004, `03` §4.2 | ADR + arquitectura técnica |
| §4.2 Idempotencia | ADR-021 | ADR |
| §4.3 Auditoría | ADR-010, `03` §6.4 (resolución de F-14) | ADR + arquitectura técnica |
| §4.4 Feature flags | ADR-020 | ADR |
| §4.5 Prompts de IA | ADR-015, ADR-012 | ADR |
| §4.6 Convenciones de tipos transversales | `02-architecture-principles.md` §11.4/11.5, ADR-014 (justificación de UUID) | Principio + ADR |
| §5.1 Agenda | DD §5.1, principio 11.3 | Domain Discovery + principio |
| §5.2 Catálogo y Cotización | DD §5.2, DD Pregunta Abierta #10 | Domain Discovery |
| §5.3 Conversación | DD §5.3, ADR-017 (imágenes) | Domain Discovery + ADR |
| §5.4 Escalamiento | DD §5.4 | Domain Discovery |
| §5.5 Clientas/CRM | DD §5.5, DD Pregunta Abierta #6 | Domain Discovery |
| §5.6 Anticipos | DD §5.6, DD Pregunta Abierta #4 | Domain Discovery |
| §5.7 Sucursales y Personal | DD §5.7, DD Pregunta Abierta #2 | Domain Discovery |
| §5.8 Notificaciones | DD §5.12 (hallazgo DM-07) | Domain Discovery |
| §5.9 Sincronización de Calendario | DD §5.10, ADR-006, DD Pregunta Abierta #14 | Domain Discovery + ADR |
| §5.10 Identidad y Accesos | DD §5.8, ADR-010, DD Pregunta Abierta #11 | Domain Discovery + ADR |
| §5.11 Analítica | DD §5.9, ADR-003 | Domain Discovery + ADR |
| §6.1 Disponibilidad | ADR-003, principio 13.4 | ADR + principio |
| §6.2 Analítica (read-model) | ADR-003, `03` §6.3 (SLO) | ADR + arquitectura técnica |
| §7.1 Consistencia entre aggregates | DD §5.11, ADR-004, ADR-021, ADR-018 | Domain Discovery + ADR |
| §7.2 Snapshot y corrección | DD §5.1, DD Pregunta Abierta #13, F-28 (`ARCHITECTURE_REVIEW.md`) | Domain Discovery + hallazgo de review |
| §8 Retención | ADR-022, ADR-017, `03` §6.4 | ADR + arquitectura técnica |

---

## 11. Decisiones pendientes / candidatas a ADR

Lista filtrada, escrita después de revisar el documento completo — solo decisiones que ameritan convertirse en ADR formal o enmienda, no cada `Decision Pending` de este documento (varios son ajustes de ubicación/estructura de bajo riesgo que no requieren ratificación formal).

| # | Candidato | Tipo | Sección de origen |
|---|---|---|---|
| 1 | Mecanismo técnico de reconciliación/compensación para los tres pares de consistencia eventual (job periódico configurable por par) | Enmienda a ADR-004, o ADR nuevo dedicado | §7.1 |
| 2 | Frontera del aggregate `Notificacion` | Adenda a `01-domain-discovery.md` (decisión de modelado de dominio, no técnica) — **vehículo de cierre a decidir por el cliente**, no un ADR técnico | §5.8 |

**Deliberadamente excluidos de esta lista:** ubicación del almacén de idempotencia (§4.2 — decisión de estructura interna, sin tradeoff que amerite gobernanza formal); mecanismo de materialización del read-model de disponibilidad (§6.1 — igual, detalle de implementación); `servicio_sucursal_override` (§5.2 — depende de una respuesta de negocio, no de una decisión arquitectónica); estructura de `ajustes_cotizacion` (§7.2 — depende de un caso de uso todavía sin diseñar); control de concurrencia de `Cita` (§5.1 — se marcó firme, sin tradeoff real que justifique un ADR).

---

## 12. Próximos pasos

1. **Confirmar el vehículo de cierre de la frontera del aggregate `Notificacion`** (§5.8, §11) — requiere decisión explícita del cliente sobre si se resuelve como adenda al Domain Discovery o de otra forma, antes de implementar ese esquema.
2. **Resolver las decisiones `Decision Pending` acopladas a `03-technical-architecture.md`** que este documento heredó sin cerrar: ORM (§2.11 — explícitamente no cerrado aquí por instrucción del cliente), proveedor de autenticación (afecta la forma final de `identidad_accesos.refresh_tokens`, §5.10).
3. **Obtener del negocio las respuestas a las Preguntas Abiertas del Domain Discovery que gatean valores concretos** (no forma de esquema): #4 (ventana de expiración de anticipo — **respondida 2026-08-04: no hay retención real, ver §5.6/`RN-ANT-03`, el campo `expira_en` requiere revisión, pendiente de autorización**), #9 (expiración de lista de espera), #10 (override de servicio por sucursal — **resuelta 2026-08-04: confirmado sin uso**), #11 (alcance de RBAC — **parcialmente resuelta 2026-08-04: global para Analista/Solo lectura, ver §5.10**), #12 (marco regulatorio → plazos de retención exactos de la Sección 8 — **postura informal registrada 2026-08-04, sin validación jurídica formal**), #13 (tratamiento de snapshot erróneo — **quién/cómo resuelto 2026-08-04, caso de uso completo sigue sin diseñar**), #14 (confirmación de un calendario de Google por sucursal — **parcialmente resuelta 2026-08-04: color confirmado, modelo técnico sin resolver**).
4. **Diseñar formalmente las máquinas de estado de `Cita`, `Conversacion` y `TicketEscalamiento`** (fuera de alcance de este documento y del Domain Discovery, por instrucción explícita) — es un prerrequisito real para completar la restricción de exclusión de `agenda.citas` (§5.1) y cualquier lógica de transición, antes de escribir DDL ejecutable.
5. **Continuar con `05-api-design.md`**, heredando de este documento: los 11+3 esquemas y sus tablas, el mecanismo de idempotencia (para definir cómo se transmite la clave en los contratos de API), y la clasificación de retención (Sección 8, relevante para diseñar qué expone o no un endpoint de exportación/borrado de datos personales).

