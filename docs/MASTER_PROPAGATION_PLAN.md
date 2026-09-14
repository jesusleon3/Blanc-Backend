# Plan Maestro de Propagación — Blanc

> **Naturaleza de este documento:** documento de trabajo **temporal**, no documentación funcional del producto. Es el mapa de ejecución para propagar, sesión por sesión, las decisiones ya aprobadas (`DISCOVERY_CHECKLIST.md` completo, `PLATFORM_ARCHITECTURE_MODEL.md` congelado, `ADR-023` aceptado) hacia el resto de la documentación. No introduce arquitectura nueva, no reinterpreta ninguna decisión ya tomada — únicamente mapea información existente hacia su destino.
> **Fecha:** 2026-08-03.
> **Fuentes leídas para construir este plan (sin modificar ninguna):** `DISCOVERY_CHECKLIST.md` (31 preguntas + Sección 5 de cierre), `PLATFORM_ARCHITECTURE_MODEL.md` (14 secciones), `ADR-023-platform-architecture-model.md`, `ARCHITECTURE_CLOSURE_PLAN.md` (9 pendientes P1-P9).
> **Estado de este documento:** borrador de trabajo, no congelado. Se actualiza a medida que avanza la propagación (marcando filas de la matriz como `Ya propagado`).
> **Qué NO hace este documento:** no modifica ningún documento del repositorio salvo su propia existencia. No propaga nada todavía.

---

## 1. Confirmación de lectura

Se leyeron completos, sin editar, los cuatro documentos fuente:
- `DISCOVERY_CHECKLIST.md` — 31 preguntas de la Sección 1, todas con `→ Resultado reunión con la Dueña`; Sección 2 (decisiones ya tomadas), Sección 3 (13 supuestos provisionales), Sección 4 (5 preguntas implícitas, **ninguna respondida en esta ronda** — quedan fuera del alcance de esta propagación, ver Sección 5.1 de este plan), Sección 5 (registro de cierre: 21 A / 8 B / 2 C / 0 D).
- `PLATFORM_ARCHITECTURE_MODEL.md` — modelo de 4 capas congelado, criterio de creación de Domain Policy (§3), Reference Implementation (§4), las 4 Domain Policies reales con sus Rule IDs exactos (§7), lo que NO es Domain Policy (§8), hallazgo de Garantías sin Bounded Context (§10), lista de documentos a modificar (§12).
- `ADR-023-platform-architecture-model.md` — Status: Accepted, formaliza el modelo sin duplicar su mecánica.
- `ARCHITECTURE_CLOSURE_PLAN.md` — 9 pendientes (P1-P9), Definition of Ready de 15 puntos.

---

## 2. Matriz completa de propagación

**Leyenda de clasificación** (según `PLATFORM_ARCHITECTURE_MODEL.md`, sin reinterpretar): **CP** = Core Platform (mecanismo/invariante) · **DP** = Domain Policy (una de las 4 ya aceptadas: `PoliticaDeCotizacion`, `PoliticaDeDisponibilidad`, `PoliticaDeRiesgoCliente`, `PoliticaDeGarantia`) · **CS** = Client Specification (dato/valor) · **EP** = Extension Points (adaptador de infraestructura). La mayoría de las filas combinan dos capas (un mecanismo CP que consume un valor CS, o una DP con su Rule ID) — se listan ambas cuando aplica, tal como el propio modelo lo hace.

| # | Discovery Item | Decisión | Clasificación | Documentos destino | Estado |
|---|---|---|---|---|---|
| 1 | 1.1 Fuente de verdad del calendario | Plataforma = fuente de verdad; sync con Google en "tiempo real o cerca" | CP (patrón fuente-de-verdad/proyección) + EP (Google, adaptador ya existente) | `ADR-006` (Status→Accepted), `99-open-questions.md` (agregar `PA-25`), `03-technical-architecture.md` §6.3 (cotejar SLO de latencia) | Pendiente |
| 2 | 1.2 Prioridad FIFO + fallback cross-sucursal | FIFO gana; fallback a otra sucursal si no hay cupo | CS (FIFO, elección cerrada) + hallazgo nuevo sin Rule ID (fallback cross-sucursal) | `RN-AGE-13` (`01-agenda.md`, Faltante→Aprobada); nuevo Rule ID candidato para fallback cross-sucursal | Requiere revisión (ver auditoría 5.2 — discrepancia con `PLATFORM_ARCHITECTURE_MODEL.md` §7) |
| 3 | 1.3 Horario partido + corte de mediodía | Horario completo por día; ninguna cita cruza el corte de 12-3pm | CS (valores de horario) + CP (invariante nuevo del motor de disponibilidad) | `RN-AGE-10`/`RN-AGE-12` (`01-agenda.md`), `04-data-model.md` §5.7, nota en `PoliticaDeDisponibilidad` (contrato, `PLATFORM_ARCHITECTURE_MODEL.md` §7) | Pendiente |
| 4 | 1.4 Ventana cambio de horario (evento, no tiempo) | Oferta vigente hasta que se llene el cupo; sugerencia de etiquetas geográficas (idea abierta, no decisión) | CS (mecanismo basado en evento) | `RN-AGE-06` (`01-agenda.md`), `FL-AGE-03` (mensaje "ya se llenó") | Pendiente (regla) / No aplica (etiquetas geográficas — sugerencia, no decisión tomada) |
| 5 | 1.5 Lista de espera: expiración por evento | Expira al agendar o completar la cita existente; falta confirmar prioridad exacta | CS (mecanismo de expiración) | `RN-AGE-07` (`01-agenda.md`) | Requiere revisión (prioridad exacta sigue sin reconfirmar explícitamente) |
| 6 | 1.6 Disparador completada/no_show + regla 59 min | `no_show` manual; regla de 59 min → sugerencia lista roja; `completada` sigue ambiguo | CP (máquina de estados de `Cita`, P3 del Closure Plan) + DP `PoliticaDeRiesgoCliente` (regla 59 min, mismo Rule ID que 1.18) | `01-domain-discovery.md` (adenda máquina de estados), `RN-AGE-14` (nueva regla, `01-agenda.md`), `decision-flows-catalogo-diseno.md` (reincorporar flujo excluido), `RN-CRM-06` | Requiere revisión (punto de mayor apalancamiento del proyecto, necesita repregunta literal antes de cerrar el diseño de la máquina de estados) |
| 7 | 1.7 Ventana 60-0 min → lista roja | Sin restricción dura de cancelación; 60-0 min activa sugerencia | DP `PoliticaDeRiesgoCliente` (mismo Rule ID `RN-CRM-06` que 1.6/1.18) | `RN-CRM-06` (`05-crm-clientas.md`), `01-domain-discovery.md` Pregunta Abierta #5 | Pendiente |
| 8 | 1.8 Corrección de snapshot erróneo | Autoriza la Dueña, se corrige en plataforma, nunca automático | CP (caso de uso administrativo) | `04-data-model.md` §7.2 (activar `agenda.ajustes_cotizacion`), `01-domain-discovery.md` (si se formaliza) | Pendiente |
| 9 | 1.9 Tabla de combinaciones + regla drill +15min | Docenas de combinaciones nuevas; celdas aún faltantes (Diseño Especial, SP, CF, CC) | DP `PoliticaDeCotizacion` (`RN-COT-01..04`, exacto) | `RN-COT-04` (`02-duracion-cotizacion.md`), `04-data-model.md` §5.2, futura `PoliticaDeCotizacionReferencia` (código) | Requiere revisión (reconciliación drill vs. tabla fija, celdas faltantes) |
| 10 | 1.10 Método de retiro (clienta decide, drill solo gel) | Regla determinista por producto; excepción: retiro-de-gel-puro se agenda manual | CS (regla de producto) + CP (mecanismo de excepción) | `RN-COT-05` (`02-duracion-cotizacion.md`), nota de excepción en Decision Flows | Pendiente |
| 11 | 1.11 Precios/duraciones globales | Confirmado: catálogo global, sin override por sucursal | CS (confirma no-uso) + CP (capacidad `RN-COT-08` se mantiene sin activar) | `RN-COT-06`/`RN-COT-08` (`02-duracion-cotizacion.md`) | Pendiente |
| 12 | 1.12 Vigencia de cotización indefinida | Sin expiración por tiempo; solo por cambio de composición | CS (política de vigencia) | `RN-COT-09` (`02-duracion-cotizacion.md`) | Pendiente |
| 13 | 1.13 Anticipo 40%, sin hold real | 40% del servicio; sin retención temporal, gana quien paga primero | CS (§8, candidato explícitamente rechazado como Domain Policy) | `RN-ANT-03` (`03-anticipos.md`), `04-data-model.md` §5.6 | Pendiente |
| 14 | 1.14 Nunca reembolso; 48h reagendo con anticipo | Cero reembolsos; ventana de 48h + alerta si hay anticipo pagado | CS (§8) | `RN-ANT-04` (`03-anticipos.md`) | Requiere revisión (coexistencia con la ventana de 59-60 min de 1.6/1.7/1.18 — ver auditoría 5.2) |
| 15 | 1.15 Beneficio de garantía: discrecional | 100% manual, sin beneficio fijo | DP `PoliticaDeGarantia` (`RN-GAR-01..06`) | `RN-GAR-04` (`04-garantias.md`) | Requiere revisión (bloqueado por prerrequisito de Bounded Context, `PLATFORM_ARCHITECTURE_MODEL.md` §10) |
| 16 | 1.16 Coincidencia parcial en garantías | Misma respuesta que 1.15 — siempre revisión humana | DP `PoliticaDeGarantia` | `RN-GAR-05` (`04-garantias.md`) | Requiere revisión (mismo prerrequisito que 1.15) |
| 17 | 1.17 Garantía no varía por sucursal | Misma respuesta que 1.15/1.16 — política global de facto | DP `PoliticaDeGarantia` | `RN-GAR-06` (`04-garantias.md`) | Requiere revisión (mismo prerrequisito que 1.15) |
| 18 | 1.18 Umbral lista roja: por incidente, no acumulado | <60 min o no-show dispara sugerencia (no umbral acumulado) | DP `PoliticaDeRiesgoCliente` (`RN-CRM-06`, mismo Rule ID que 1.6/1.7) | `RN-CRM-06` (`05-crm-clientas.md`) | Pendiente |
| 19 | 1.19 Lista roja no retroactiva | Cita ya confirmada no se ve afectada | CP (aplicación del principio de inmutabilidad ya existente) | `RN-CRM-07` (`05-crm-clientas.md`) | Pendiente |
| 20 | 1.20 Etiquetas: texto libre, global, sin permiso | Confirma la recomendación original | CS (gobernanza) + CP (capacidad genérica) | `RN-CRM-09` (`05-crm-clientas.md`) | Pendiente |
| 21 | 1.21 Umbral "cliente molesto" | Sigue sin respuesta — aplazada explícitamente | CS (cuando se resuelva) + CP (mecanismo híbrido ya existente) | `RN-CONV-08` (`06-conversacion-ia.md`) — sin cambio | No aplica (sigue sin respuesta; supuesto provisional ya reflejado en el Estado actual de la regla) |
| 22 | 1.22 Conversación persistente por clienta; `modo` sin resolver | Identidad de conversación persistente; alcance de memoria acotado; reseteo de `modo` sigue abierto | CP (aggregate `Conversacion`, mecanismo de dominio) | `01-domain-discovery.md` §5.3 (adenda máquina de estados), `RN-CONV-10` (`06-conversacion-ia.md`) | Requiere revisión (punto crítico sin resolver, bloquea P3 del Closure Plan) |
| 23 | 1.23 Confirmación interactiva (no push) | Requiere respuesta afirmativa explícita; nuevo estado intermedio en `Cita` | CP — el propio `PLATFORM_ARCHITECTURE_MODEL.md` §8 ya clasificó esto como "costura documentada, no Domain Policy todavía" (`RN-CONV-11`) | `RN-CONV-11` (`06-conversacion-ia.md`), `04-data-model.md` §5.1/§5.8 (nuevo estado), `01-domain-discovery.md` (máquina de estados `Cita`) | Pendiente (alto impacto en diseño activo de Fase 0) |
| 24 | 1.24 Modo mantenimiento: atención manual | Sin mensaje automático, personal atiende manualmente | CS (elección cerrada) + CP (mecanismo kill-switch, ADR-020) | `RN-SUC-03` (`09-sucursales-configuracion.md`) | Pendiente |
| 25 | 1.25 Calendario de Google: ambiguo (uno vs. varios) | Diferenciación por color confirmada; modelo técnico exacto sin resolver | EP (adaptador de calendario) + CS (dato de configuración, cuando se resuelva) | `RN-SUC-04` (`09-sucursales-configuracion.md`), `04-data-model.md` §5.9 | Requiere revisión (necesita repregunta puntual antes de propagar con certeza) |
| 26 | 1.26 RBAC Analista/Solo lectura: alcance global | Confirmado global, no por sucursal | CS (valor de política) + CP (mecanismo RBAC, ADR-010) | `RN-SEG-03` (`10-identidad-seguridad.md`, Faltante→Aprobada), `04-data-model.md` §5.10, **`ARCHITECTURE_CLOSURE_PLAN.md` (marcar P2 como Resuelto — hoy solo lo dice `DISCOVERY_CHECKLIST.md`)** | Pendiente |
| 27 | 1.27 Marco legal: postura informal, sin validación jurídica | "No por el momento" (opinión de la Dueña, no validación formal) | CS (postura conservadora ya adoptada, sin cambio) | `RN-AUD-02` (`11-auditoria-cumplimiento.md`) — nota de postura informal, sin pasar a `Aprobada` plena | Requiere revisión (no cerrar sin validación jurídica formal) |
| 28 | 1.28 Cortesía permanente | Confirmado permanente por defecto | CS (valor) | `RN-NOT-04` (`08-notificaciones.md`) | Pendiente |
| 29 | 1.29 ADR-008: doble adaptador configurable | Ambos proveedores de WhatsApp, elegibles por configuración | **EP** (adaptador de infraestructura — exactamente el caso de uso central de Extension Points) | `ADR-008` (reescritura sustantiva, no solo Status), `ADR_INDEX.md`, `CLAUDE.md` (la nota de "open deviation" queda obsoleta) | Requiere revisión (reescritura de diseño, no una transcripción mecánica) |
| 30 | 1.30 Capacidad de recepción humana | Requisitos funcionales dados; capacidad real sin validar | Fuera de las 4 capas — dato operativo de validación, no artefacto arquitectónico (ver auditoría 5.4) | `03-technical-architecture.md` §7.2, `ADR-016` (nota de requisitos funcionales) | Requiere revisión (la validación de capacidad en sí no tiene documento destino — es un dato operativo, no una decisión de arquitectura) |
| 31 | 1.31 Presupuesto WhatsApp/IA | Sigue sin respuesta — aplazada explícitamente | No aplica (sin decisión que propagar) | — | No aplica |

**Nota de completitud:** las 31 preguntas de la Sección 1 tienen al menos una fila. Ninguna quedó fuera de la matriz. Los 9 "hallazgos nuevos" que `DISCOVERY_CHECKLIST.md` §5.1 ya identifica como surgidos más allá de las 31 preguntas (fallback cross-sucursal, invariante de horario partido, etiquetas geográficas, regla de 59-60 min, excepción retiro-puro, anticipo 40%, ventana 48h, estado intermedio de `Cita`, alcance dual de `ADR-008`) están **incorporados dentro de la fila de la pregunta que los originó** — no se les asignó una fila propia porque ninguno es, en sí mismo, una "pregunta del Discovery Checklist" con su propia ficha.

---

## 3. Roadmap de propagación — orden recomendado

Orden por **dependencia real**, no por número de sección ni por orden alfabético — mismo criterio ya usado en `ARCHITECTURE_CLOSURE_PLAN.md` ("Orden óptimo de cierre"). Se explica cada desviación respecto al orden de ejemplo.

| Orden | Documento | Por qué va en esta posición |
|---|---|---|
| 1 | **`01-domain-discovery.md`** | Base de la que todo lo demás depende. Incluye el prerrequisito bloqueante (Garantías como Bounded Context #12, `PLATFORM_ARCHITECTURE_MODEL.md` §10) y la adenda de las 3 máquinas de estado con el progreso real (1.6 parcial, 1.22 parcial, 1.23 resuelto). Sin esto, Business Rules y Data Model propagarían sobre una base todavía incompleta. |
| 2 | **`02-architecture-principles.md`** | Incorpora el modelo de 4 capas como principio formal (regla de dependencia, criterio de creación, Reference Implementation) antes de que Business Rules empiece a clasificar reglas individuales contra ese modelo — mismo orden que propuso el usuario. |
| 3 | **`docs/business-rules/*.md`** | El mayor volumen de la propagación: ~20 Rule IDs pasan de `Faltante`/`Asumida` a `Aprobada` con valores reales, más los Rule IDs nuevos identificados (regla de 59 min si se formaliza, fallback cross-sucursal). Depende de 1-2 para clasificar cada regla correctamente entre mecanismo (Core) y valor (Client Specification). |
| 4 | **`decision-flows-catalogo-diseno.md`** | Cambios acotados: reincorporar el flujo Completada/No-Show (bloqueado hasta que 1.6 cierre del todo — puede quedar parcial), documentar dónde cada Domain Policy se invoca (ya mapeado en `PLATFORM_ARCHITECTURE_MODEL.md` §9, solo trasladar). Depende de que los Rule IDs referenciados en 3 ya tengan su `Estado` actualizado. |
| 5 | **`04-data-model.md`** | Cambios estructurales: activar `agenda.ajustes_cotizacion` (1.8), nuevo estado intermedio de `Cita` (1.23), poblar tablas de duración (1.9), nota sobre `calendario_google_id` (pendiente de 1.25). Depende de que 1-3 ya fijen los valores/decisiones que este documento modela. |
| 6 | **`ADR-006`** | Status → Accepted + nota de latencia (1.1). Cambio acotado; se ubica después de Data Model porque referencia el SLO de sincronización que vive ahí (§6.3 de `03-technical-architecture.md`). **No estaba en el orden de ejemplo — se agrega porque `DISCOVERY_CHECKLIST.md` 1.1 lo señala explícitamente como el ADR de mayor urgencia declarada de todo el proyecto.** |
| 7 | **`ADR-008`** | Reescritura sustantiva (doble adaptador, 1.29) — es, en la práctica, un rediseño acotado, no una transcripción. Se ubica después de que el resto de la propagación mecánica esté estable, para no bloquearla con una decisión de mayor peso de diseño. **Tampoco estaba en el orden de ejemplo — se agrega porque es el único cambio de ADR que requiere trabajo de diseño real, no solo actualizar `Status`.** |
| 8 | **`ADR-002` / `ADR-009`** | Solo referencias cruzadas breves a `ADR-023` (ya decidido en `PLATFORM_ARCHITECTURE_MODEL.md` §12 — no es una decisión nueva). Van al final de los ADRs porque son los cambios más triviales y no bloquean nada. |
| 9 | **`ADR_INDEX.md`** | Agrega la entrada de `ADR-023` (ya creado) y refleja el nuevo estado de `ADR-006`/`ADR-008`. Debe ir después de que esos ADRs individuales ya estén actualizados, para no quedar desincronizado con ellos. |
| 10 | **`ARCHITECTURE_CLOSURE_PLAN.md`** | Marca P2 como formalmente `Resuelto` (hoy solo lo dice `DISCOVERY_CHECKLIST.md` §5.2, no el propio Closure Plan) y anota el avance real de P3. **No estaba en el orden de ejemplo — se agrega porque es el documento que rige si Fase 1 puede empezar, y hoy queda desactualizado respecto a lo ya resuelto.** |
| 11 | **`99-open-questions.md`** | Marca varios `PA-NN` como resueltos, agrega `PA-25` (fuente de verdad del calendario, nunca tuvo número). Es un índice de trazabilidad — va casi al final porque depende de que las decisiones ya vivan en sus documentos de destino reales. **No estaba en el orden de ejemplo — se agrega por la misma razón que el punto anterior.** |
| 12 | **`CLAUDE.md`** | Actualiza el framing del proyecto y el estado de `ADR-008` (ya no es "open deviation... pendiente"). Va último porque es el resumen ejecutivo — debe reflejar el estado final de todo lo demás, no al revés. |

**Diferencia neta respecto al orden de ejemplo del usuario:** mismo orden relativo para los 9 documentos ya mencionados, con 4 documentos adicionales insertados donde su dependencia real lo exige (`ADR-006`, `ADR-008`, `ARCHITECTURE_CLOSURE_PLAN.md`, `99-open-questions.md`) — ninguno estaba en la lista de ejemplo, pero los cuatro tienen cambios directamente exigidos por `DISCOVERY_CHECKLIST.md` o por `PLATFORM_ARCHITECTURE_MODEL.md` §12.

---

## 4. Auditoría

### 4.1 Preguntas sin destino

Ninguna de las 31 preguntas de la Sección 1 quedó sin al menos un documento destino (ver columna correspondiente en la matriz). Las 5 preguntas implícitas de la Sección 4 de `DISCOVERY_CHECKLIST.md` (4.1-4.5) **no fueron respondidas en esta ronda** — la reunión con la Dueña solo cubrió las 31 preguntas de la Sección 1. Quedan fuera del alcance de esta propagación, no porque falte destino, sino porque no hay todavía una respuesta que propagar.

### 4.2 Información duplicada

- **La "regla de 59-60 minutos" aparece de forma independiente en tres preguntas** (1.6, 1.7, 1.18), las tres apuntando al mismo Rule ID (`RN-CRM-06`). Riesgo real: si se propaga sin coordinación, alguien podría escribir la regla tres veces con matices ligeramente distintos en tres documentos distintos. Al llegar al Paso 3 del roadmap, debe escribirse **una sola vez**, con las tres preguntas citadas como evidencia en el campo `Fuente`.
- **La respuesta de Garantías es literalmente idéntica en 1.15, 1.16 y 1.17** — mismo texto de la Dueña, tres Rule IDs distintos (`RN-GAR-04/05/06`). No es duplicidad problemática — es una única decisión de negocio ("todo discrecional") que legítimamente cierra tres preguntas distintas. Se propaga una vez como decisión, referenciada desde los tres Rule IDs.

### 4.3 Información contradictoria

- **Hallazgo real, no menor:** `PLATFORM_ARCHITECTURE_MODEL.md` §7 asocia `RN-AGE-13` (prioridad entre candidatas a un horario liberado — categoría Agenda, pregunta 1.2) como uno de los Rule IDs que formaliza `PoliticaDeRiesgoCliente` (Clientas/CRM, cuyo contrato real es "historial de cancelaciones → sugerencia de lista roja"). Estos son dos conceptos de dominio distintos que comparten superficialmente la palabra "prioridad", pero no la misma decisión de negocio — `RN-AGE-13` es sobre orden de cola de agenda, no sobre riesgo de clienta. Es, con alta probabilidad, una asociación incorrecta dentro del documento ya congelado. **No se corrige aquí** (`PLATFORM_ARCHITECTURE_MODEL.md` está congelado, solo se reabre con una decisión arquitectónica explícita) — se deja registrado como riesgo a resolver en la sesión donde se propague `RN-AGE-13`: probablemente deba clasificarse como Client Specification simple (FIFO, elección cerrada) y **no** como parte de `PoliticaDeRiesgoCliente`.
- **Dos ventanas de tiempo relacionadas pero distintas, riesgo de confundirse al redactar:** la regla general de 59-60 min (1.6/1.7/1.18, aplica a cancelar/reagendar en general) y la ventana de 48h para reagendar **con anticipo ya pagado** (1.14). `DISCOVERY_CHECKLIST.md` 1.14 ya advierte explícitamente que "ambas reglas deben coexistir sin contradecirse" — al propagar a `docs/business-rules/`, cada una debe declarar explícitamente su campo `Precondiciones` (con anticipo pagado vs. sin anticipo) para que no se lean como reglas en conflicto.

### 4.4 Respuestas que necesitan dividirse entre varios documentos

- **1.6** (completada/no_show): `01-domain-discovery.md` (adenda de máquina de estados) + `RN-AGE-14` (regla nueva) + `decision-flows-catalogo-diseno.md` (reincorporar flujo) + `RN-CRM-06` (regla de 59 min) — cuatro destinos de una sola pregunta.
- **1.23** (confirmación interactiva): `RN-CONV-11` + `04-data-model.md` (nuevo estado) + `01-domain-discovery.md` (máquina de estados) — tres destinos.
- **1.29** (ADR-008 dual): `ADR-008` (reescritura) + `ADR_INDEX.md` + `CLAUDE.md` — tres destinos.
- **1.9** (tabla de duración): `RN-COT-04` + `04-data-model.md` (tablas) + futura implementación de código (`PoliticaDeCotizacionReferencia`, fuera del alcance de documentación) — tres destinos.

### 4.5 Respuestas fuera del modelo arquitectónico aprobado

Dos preguntas no encajan limpiamente en las 4 capas de `PLATFORM_ARCHITECTURE_MODEL.md`, sin que eso sea un defecto del modelo — son, por naturaleza, de una categoría distinta:

- **1.30** (capacidad real de recepción humana): es un **dato de validación operativa** (¿el personal puede absorber el volumen?), no una decisión de dominio, de infraestructura ni un valor de configuración. `DISCOVERY_CHECKLIST.md` ya lo señalaba así ("Ninguno de arquitectura — es un dato de validación operativa, no una regla"). No requiere forzarlo dentro de Core Platform/Domain Policy/Client Specification/Extension Points.
- **1.27** (marco legal): tampoco es una decisión de arquitectura — es una postura de cumplimiento normativo, pendiente de validación jurídica formal, no arquitectónica. Ya tiene tratamiento correcto en `RN-AUD-02` como nota, sin necesitar encajar en el modelo de 4 capas.

Ninguna de las 31 respuestas exige **abrir** el modelo arquitectónico (agregar una quinta Domain Policy, cuestionar las 4 ya aceptadas, o crear una capa nueva) — el modelo, tal como quedó congelado, sigue siendo suficiente para clasificar el 100% de lo respondido.

---

## 5. Resumen para decisión

- **31/31 preguntas mapeadas**, ninguna sin destino.
- **16 filas en estado `Pendiente`** (1.1, 1.3, 1.4, 1.7, 1.8, 1.10, 1.11, 1.12, 1.13, 1.18, 1.19, 1.20, 1.23, 1.24, 1.26, 1.28 — listas para propagar sin ambigüedad de fondo).
- **13 filas en estado `Requiere revisión`** (1.2, 1.5, 1.6, 1.9, 1.14, 1.15, 1.16, 1.17, 1.22, 1.25, 1.27, 1.29, 1.30 — cada una tiene su razón específica documentada en la columna Estado; ninguna es un bloqueo total, todas son matices a resolver durante la redacción, no antes de empezar).
- **2 filas en estado `No aplica`** (1.21 y 1.31, ambas sin respuesta de la Dueña) + **1 sub-elemento `No aplica`** dentro de 1.4 (etiquetas geográficas, sugerencia sin decisión tomada).
- **2 riesgos de contradicción identificados y ya acotados** (§4.3), ninguno bloquea iniciar — ambos son advertencias para tener presente al redactar, no vacíos de información.
- **1 prerrequisito bloqueante real:** Garantías necesita su Bounded Context en `01-domain-discovery.md` (Paso 1 del roadmap) antes de que `PoliticaDeGarantia` (1.15/1.16/1.17) pueda propagarse con un hogar de dominio correcto — por eso `01-domain-discovery.md` va primero en el roadmap.

**¿Listos para comenzar la propagación documento por documento?** Sí, con el Paso 1 (`01-domain-discovery.md`) como punto de partida — es el único con un prerrequisito real (Garantías) que, si no se resuelve primero, bloquearía tres preguntas completas (1.15-1.17) más adelante en la secuencia.
