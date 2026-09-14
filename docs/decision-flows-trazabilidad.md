# Verificación de Trazabilidad — Decision Flows

> **Naturaleza de este documento:** verificación objetiva, no revisión de diseño. No cuestiona el inventario congelado en `docs/decision-flows-catalogo-diseno.md` — comprueba que esté completamente trazado: cada regla, cada evento, cada flujo.
> **Método:** Matriz 1 recorre las 73 reglas una por una contra el catálogo de flujos. Matriz 2 recorre los ~40 eventos de dominio catalogados en `01-domain-discovery.md` §5. Matriz 3 recorre los 21 macro-flows contra el estado real de las reglas que orquestan.
> **Resultado adelantado:** no se encontró ninguna inconsistencia estructural (ningún flujo debe agregarse, dividirse o eliminarse). Sí aparecieron algunas referencias cruzadas menores que faltaban en la documentación del catálogo — se listan como correcciones de anotación, no como reapertura del diseño.

---

## 1. Matriz Rule ID → Flow(s)

Agrupada por categoría. `T` = transversal/estructural, deliberadamente sin flujo propio (no es un hueco). `H` = hallazgo de esta verificación: referencia que faltaba hacerse explícita (corrección de anotación, no de estructura).

### RN-AGE

| Rule ID | Estado | Flow(s) |
|---|---|---|
| RN-AGE-01 | Aprobada | FL-AGE-09, FL-AGE-08 |
| RN-AGE-02 | Aprobada | FL-AGE-08 |
| RN-AGE-03 | Aprobada (caso límite pendiente) | FL-AGE-10 |
| RN-AGE-04 | Aprobada | FL-AGE-10 |
| RN-AGE-05 | Aprobada | FL-AGE-10 |
| RN-AGE-06 | Aprobada conceptualmente, no consolidada | FL-AGE-02, FL-AGE-03 |
| RN-AGE-07 | Aprobada (expiración/prioridad pendiente) | FL-AGE-05, FL-AGE-06 |
| RN-AGE-08 | Aprobada (supuesto) | FL-AGE-08 |
| RN-AGE-09 | Aprobada (supuesto, no confirmada) | FL-AGE-11 |
| RN-AGE-10 | Aprobada | FL-AGE-09, FL-SUC-01 (la configura) |
| RN-AGE-11 | Aprobada | FL-AGE-09, FL-AGE-07 (la configura) |
| RN-AGE-12 | Asumida, no documentada | **T** — dato dentro de RN-AGE-10/FL-SUC-01, no requiere paso propio |
| RN-AGE-13 | Faltante | Hueco explícito dentro de FL-AGE-03, FL-AGE-06 |

### RN-COT

| Rule ID | Estado | Flow(s) |
|---|---|---|
| RN-COT-01 | Aprobada (tablas incompletas) | FL-COT-02 |
| RN-COT-02 | Aprobada | FL-COT-02 |
| RN-COT-03 | Aprobada | FL-COT-03 |
| RN-COT-04 | Faltante | Hueco dentro de FL-COT-02 |
| RN-COT-05 | Faltante | **H** — no estaba cruzada en el catálogo original; se agrega como hueco dentro de FL-COT-02 (afecta directamente su entrada: el método de retiro) |
| RN-COT-06 | Faltante | Hueco dentro de FL-COT-02/FL-COT-03 |
| RN-COT-07 | Aprobada | FL-COT-03 (transversal a todo cálculo monetario) |
| RN-COT-08 | Decision Pending | FL-COT-01 (la define), FL-COT-03 (la consume) |
| RN-COT-09 | Faltante | Hueco dentro de FL-COT-03 / FL-AGE-08 |

### RN-ANT

| Rule ID | Estado | Flow(s) |
|---|---|---|
| RN-ANT-01 | Aprobada | FL-CRM-05 (lectura), FL-AGE-08 (consecuencia) |
| RN-ANT-02 | Aprobada | FL-ANT-02, FL-AGE-08 |
| RN-ANT-03 | Aprobada en estructura (ventana pendiente) | FL-ANT-01 |
| RN-ANT-04 | Asumida, no documentada | FL-AGE-04 (paso en línea) |

### RN-GAR

| Rule ID | Estado | Flow(s) |
|---|---|---|
| RN-GAR-01 | Aprobada | FL-GAR-01 |
| RN-GAR-02 | Aprobada | FL-GAR-01 |
| RN-GAR-03 | Aprobada | FL-GAR-01 |
| RN-GAR-04 | Faltante | Hueco dentro de FL-GAR-01 |
| RN-GAR-05 | Faltante | Hueco dentro de FL-GAR-01 |
| RN-GAR-06 | Faltante | Hueco dentro de FL-GAR-01 |

### RN-CRM

| Rule ID | Estado | Flow(s) |
|---|---|---|
| RN-CRM-01 | Aprobada (supuesto) | FL-CRM-01 |
| RN-CRM-02 | Aprobada | FL-CRM-05, FL-CRM-02, FL-CRM-03 |
| RN-CRM-03 | Aprobada | FL-CRM-02, FL-CRM-05, FL-AGE-04 |
| RN-CRM-04 | Aprobada | FL-CRM-03, FL-CRM-05 |
| RN-CRM-05 | Aprobada (supuesto) | FL-CRM-02 |
| RN-CRM-06 | Faltante | Hueco dentro de FL-CRM-02 |
| RN-CRM-07 | Faltante | Hueco dentro de FL-CRM-02 (también relevante para FL-AGE-01/03/06 si ya existe una cita confirmada al momento de marcar — se anota la relación cruzada) |
| RN-CRM-08 | Aprobada | FL-CRM-04 |
| RN-CRM-09 | Faltante | Hueco dentro de FL-CRM-04 |

### RN-CONV

| Rule ID | Estado | Flow(s) |
|---|---|---|
| RN-CONV-01 | Aprobada | FL-CONV-01 |
| RN-CONV-02 | Aprobada | FL-CONV-01 |
| RN-CONV-03 | Aprobada (matiz 9.6 pendiente) | FL-CONV-02 |
| RN-CONV-04 | Aprobada | **H** — no estaba cruzada explícitamente; se agrega: consumida transversalmente por FL-AUD-01 (toda decisión de IA que pasa por FL-CONV-01/02/03/04 alimenta el registro de auditoría vía esta regla) |
| RN-CONV-05 | Aprobada | FL-CONV-03 |
| RN-CONV-06 | Aprobada | FL-CONV-03 |
| RN-CONV-07 | Aprobada | **T** — cualidad de estilo sin bifurcación de negocio, no requiere flujo (relevante para el golden set de ADR-019, no para orquestación) |
| RN-CONV-08 | Mecanismo aprobado, umbral faltante | FL-CONV-03 |
| RN-CONV-09 | Aprobada (supuesto) | FL-CONV-03 |
| RN-CONV-10 | Faltante | **H** — huérfana en el catálogo original; se agrega como hueco explícito dentro de FL-CONV-01 (afecta si una conversación es nueva o continuación) |
| RN-CONV-11 | Faltante | **H** — se agrega como hueco explícito dentro de FL-AGE-08 y FL-NOT-01 (ya insinuado en la propia nota de RN-NOT-01, nunca cruzado formalmente) |

### RN-ESC

| Rule ID | Estado | Flow(s) |
|---|---|---|
| RN-ESC-01 | Aprobada | FL-ESC-01 |
| RN-ESC-02 | Aprobada | FL-CONV-04 |
| RN-ESC-03 | Aprobada | FL-ESC-02 |
| RN-ESC-04 | Aprobada | FL-ESC-01 |

### RN-NOT

| Rule ID | Estado | Flow(s) |
|---|---|---|
| RN-NOT-01 | Aprobada | FL-NOT-01 |
| RN-NOT-02 | Aprobada | FL-NOT-02 |
| RN-NOT-03 | Aprobada | FL-NOT-02 |
| RN-NOT-04 | Faltante | Hueco dentro de FL-NOT-02 |
| RN-NOT-05 | Aprobada | FL-NOT-01 |

### RN-SUC

| Rule ID | Estado | Flow(s) |
|---|---|---|
| RN-SUC-01 | Aprobada | FL-SUC-01 |
| RN-SUC-02 | Aprobada | FL-SUC-02 |
| RN-SUC-03 | Faltante | Hueco dentro de FL-SUC-02 |
| RN-SUC-04 | Supuesto de trabajo, sin confirmar | FL-AGE-11, FL-SUC-04 |

### RN-SEG

| Rule ID | Estado | Flow(s) |
|---|---|---|
| RN-SEG-01 | Aprobada | Precondición citada en FL-SEG-01, FL-COT-01, FL-SUC-01/02/03/04 |
| RN-SEG-02 | Aprobada | FL-SEG-01 (mismas precondiciones citadas arriba) |
| RN-SEG-03 | Faltante — bloquea RBAC completo | Hueco dentro de FL-SEG-01 |
| RN-SEG-04 | Aprobada (supuesto) | FL-SUC-03 |

### RN-AUD

| Rule ID | Estado | Flow(s) |
|---|---|---|
| RN-AUD-01 | Aprobada | FL-AUD-01 |
| RN-AUD-02 | Faltante — bloquea retención | **H** — no tenía flujo dueño único; se clasifica como transversal, afecta a todo flujo que maneja datos personales (FL-CRM-01, FL-CONV-01, FL-AUD-01), sin un flujo específico responsable de resolverlo |

### RN-REP

| Rule ID | Estado | Flow(s) |
|---|---|---|
| RN-REP-01 | Aprobada | **T** — Analítica es read-model puro, fuera del alcance de Decision Flows (ya establecido en el catálogo) |
| RN-REP-02 | Aprobada | **T** — mismo motivo |

**Resultado de la Matriz 1:** las 73 reglas quedan clasificadas — 65 con al menos un flujo que las consume o las referencia como hueco explícito, 5 correctamente `T` (transversal/estructural sin flujo, decisión ya justificada, no un vacío), y **6 correcciones de anotación (`H`)** aplicadas arriba: `RN-COT-05`, `RN-CONV-04`, `RN-CONV-10`, `RN-CONV-11`, `RN-AUD-02` no estaban explícitamente cruzadas en el catálogo original, y `RN-CRM-07` necesitaba una nota de relación cruzada adicional. Ninguna requiere agregar, dividir o eliminar un flujo — son correcciones dentro de los flujos ya existentes.

---

## 2. Matriz Evento de Dominio → Productor → Consumidor(es) → Flow(s)

Organizada por Bounded Context, igual que `01-domain-discovery.md` §5.

### Agenda (§5.1)

| Evento | Productor | Consumidor(es) | Flow(s) |
|---|---|---|---|
| CitaSolicitada | FL-AGE-01 | Analítica | Producido por FL-AGE-01 |
| CitaConfirmada | FL-AGE-08 | FL-AGE-11, FL-NOT-01, Analítica | Producido por FL-AGE-08 |
| CitaReagendada | FL-AGE-03 | FL-AGE-11, FL-NOT-01 | Producido por FL-AGE-03 |
| CitaCancelada | FL-AGE-04 | FL-AGE-11, FL-AGE-03/FL-AGE-06 (libera cupo) | Producido por FL-AGE-04 |
| **CitaCompletada** | **Ninguno** | **FL-GAR-01 (RN-GAR-02 depende de él)** | **Ver hallazgo prioritario abajo** |
| ClienteNoShow | Ninguno | Ninguno explícito hoy | Mismo hueco que CitaCompletada, sin consumidor urgente todavía |
| HorarioBloqueado | FL-AGE-07 | FL-AGE-09 | — |
| HorarioDesbloqueado | FL-AGE-07 | FL-AGE-03, FL-AGE-06 | — |
| EntradaListaEsperaCreada | FL-AGE-05 | FL-AGE-06 (indirecto) | — |
| CupoDisponibleParaListaEspera | FL-AGE-04 / FL-AGE-07 | FL-AGE-06 | — |
| EntradaListaEsperaExpirada | Ninguno (depende de PA-23) | — | Mismo hueco ya conocido, sin acción nueva |

**Hallazgo prioritario de esta matriz:** `CitaCompletada` no tiene productor en el catálogo — consistente con la exclusión ya conocida de "Marcar Cita Completada/No-Show" (sin `RN-AGE-14` todavía). Lo que esta matriz añade es hacer explícito el **impacto real, no solo teórico**: `FL-GAR-01` (Gestionar Solicitud de Garantía) depende de este evento vía `RN-GAR-02` ("solo aplica a servicio completado") para poder validar una solicitud de garantía contra una cita real. Esto no cambia el catálogo ni crea un nuevo flujo — pero eleva la prioridad de la acción ya pendiente (crear `RN-AGE-14`) porque ahora es visible que bloquea, en la práctica, el criterio central de otro macro-flow ya `Aprobado`.

### Catálogo (§5.2)

| Evento | Productor | Consumidor(es) | Flow(s) |
|---|---|---|---|
| ServicioCreado/Actualizado/Desactivado | FL-COT-01 | FL-COT-02, FL-COT-03 | — |
| ModificadorDeDiseñoCreado/Actualizado | FL-COT-01 | FL-COT-03 | — |
| CotizacionCalculada | FL-COT-03 | FL-AGE-08, Analítica | — |

### Conversación (§5.3)

| Evento | Productor | Consumidor(es) | Flow(s) |
|---|---|---|---|
| ConversacionIniciada | FL-CONV-01 | Analítica | — |
| MensajeRecibido / MensajeEnviado | Transversal | Todos los flujos conversacionales | Sustrato de la conversación, sin flujo dueño único |
| ClienteFrecuenteReconocido / VentaCruzadaSugerida | Ninguno (por diseño) | — | Ya descartados como lógica determinista (`DOMAIN_MODEL_REVIEW.md`, DM-14) — no es un hueco |
| ClienteMolestoDetectado | FL-CONV-03 | FL-ESC-01 | — |
| IntencionDeCancelacionDetectada | FL-CONV-01 | FL-AGE-04 | **H** — no estaba cruzado explícitamente; se agrega esta referencia (menor) |
| EscalamientoSolicitado | FL-CONV-03 | FL-ESC-01 | — |
| ConversacionDevueltaABot | FL-ESC-02 | FL-CONV-04 | — |
| ImagenRecibida | Transversal | FL-CONV-03 | — |
| CostoIARegistrado | FL-CONV-01 | FL-AUD-01, Analítica | — |

### Escalamiento (§5.4)

| Evento | Productor | Consumidor(es) | Flow(s) |
|---|---|---|---|
| TicketCreado | FL-ESC-01 | FL-ESC-02 | — |
| EmpleadoNotificado | FL-ESC-01 | FL-ESC-02 | — |
| TicketTomado | FL-ESC-02 | FL-CONV-04 | — |
| ControlDevueltoABot | FL-ESC-02 | FL-CONV-04 | — |
| TicketCerrado | FL-ESC-02 | Analítica | — |

### Clientas (§5.5)

| Evento | Productor | Consumidor(es) | Flow(s) |
|---|---|---|---|
| ClientaCreada | FL-CRM-01 | FL-CRM-05, Analítica | — |
| ClientaMarcadaVIP | Ninguno (por decisión ya tomada) | — | Consecuencia directa de excluir "Marcar VIP" del catálogo — no es un hallazgo nuevo |
| ClientaMarcadaListaRoja / Desmarcada | FL-CRM-02 | FL-CRM-05, FL-AGE-08 | — |
| ClientaBloqueada | FL-CRM-03 | FL-CRM-05, FL-AGE-08 | — |
| NotaInternaAgregada | Ninguno | — | **H** — sin Rule ID ni flujo propio; aplicando el mismo criterio ya usado para VIP (cambio de atributo sin bifurcación de negocio), se confirma correctamente sin flujo — no requiere acción |
| VisitaRegistrada | Depende de CitaCompletada (mismo hueco) | FL-CRM-05, Analítica | — |

### Anticipos (§5.6)

| Evento | Productor | Consumidor(es) | Flow(s) |
|---|---|---|---|
| AnticipoSolicitado | FL-ANT-02 | FL-AGE-08 | — |
| AnticipoPagado | FL-ANT-02 | FL-AGE-08 | — |
| AnticipoExpirado | FL-ANT-01 | FL-AGE-09 | — |
| AnticipoReembolsado | FL-AGE-04 (inline) | Analítica | — |

### Sucursales y Personal (§5.7)

| Evento | Productor | Consumidor(es) | Flow(s) |
|---|---|---|---|
| SucursalCreada | FL-SUC-04 | FL-AGE-09, Analítica | — |
| HorarioActualizado | FL-SUC-01 | FL-AGE-09 | — |
| DiaFestivoConfigurado | FL-SUC-01 | FL-AGE-09 | — |
| ManicuristaAgregada / Desactivada | FL-SUC-03 | FL-AGE-09, FL-AGE-10 | — |

### Identidad (§5.8)

| Evento | Productor | Consumidor(es) | Flow(s) |
|---|---|---|---|
| UsuarioCreado | FL-SEG-01 | FL-AUD-01, Analítica | — |
| RolAsignado | FL-SEG-01 | Precondición de todos los flujos administrativos | — |
| MFAHabilitado | FL-SEG-01 | — | — |
| AccesoDenegado | Ninguno en el catálogo | — | Consecuencia directa de excluir `FL-SEG-02` (es mecanismo técnico de ADR-010, no de negocio) — no es un hallazgo nuevo |

### Notificaciones (§5.12)

| Evento | Productor | Consumidor(es) | Flow(s) |
|---|---|---|---|
| NotificacionProgramada | FL-NOT-02 | FL-NOT-01 | — |
| NotificacionEnviada | FL-NOT-01 | Analítica | — |
| NotificacionFallida | FL-NOT-01 | Analítica (revisión pasiva, sin flujo propio — correcto, mismo criterio que Reportes) | — |

**Resultado de la Matriz 2:** un hallazgo real con impacto (`CitaCompletada` sin productor, con consumidor real en `FL-GAR-01`), tres hallazgos menores de cruce (`IntencionDeCancelacionDetectada`), y el resto de los "huérfanos" son consecuencia directa de decisiones ya tomadas y congeladas (VIP, NotaInternaAgregada, AccesoDenegado) — no eventos esperando algo que no existe por descuido, sino por diseño ya justificado.

---

## 3. Matriz Macro-flow → Micro-flow → Rule ID → Estado (con % de completitud aproximado)

**Método (explícito, para no sobre-interpretar el número):** % = reglas en `Aprobada` sin matiz sobre el total de reglas distintas que el macro-flow toca (directa o vía sus micro-flows), con medio punto para reglas `Aprobada` con matiz/supuesto sin confirmar. Es una heurística de bulto, no una métrica certificada — sirve para priorizar, no para reportar al cliente como un hecho exacto.

| Macro-flow | Micro-flows | Reglas Faltante/Pendiente que bloquean | % aproximado | Bloqueado por (PA-NN) |
|---|---|---|---|---|
| FL-AGE-01 Agendar Cita Nueva | CONV-01/02/03/04, COT-02/03, AGE-08/09/10/11, NOT-01, AUD-01, ESC-01 | RN-COT-04, RN-COT-08, RN-COT-09 | ~80% | PA-02, PA-04, PA-05, PA-14, PA-18 |
| FL-AGE-02 Activar Solicitud Cambio Horario | CONV-01, CONV-04, AUD-01 | RN-AGE-06 (no consolidada) | ~55% | Sesión 03 de Domain Discovery pendiente; PA-22 |
| FL-AGE-03 Ofrecer y Confirmar Cambio Horario | AGE-09/11, NOT-01, AUD-01 | RN-AGE-06, RN-AGE-13 | ~45% (el más bajo del catálogo) | PA-01, PA-22, PA-18 |
| FL-AGE-04 Cancelar Cita | CONV-01/04, CRM-05, AGE-11, NOT-01, AUD-01, ESC-01 | RN-ANT-04 | ~80% | PA-07 |
| FL-AGE-05 Registrar en Lista de Espera | CONV-01/04, COT-02/03, AUD-01 | RN-AGE-07 (parcial) | ~67% | PA-23, PA-02, PA-04, PA-05 |
| FL-AGE-06 Notificar y Convertir Cupo Lista de Espera | AGE-08/09/10/11, NOT-01, AUD-01 | RN-AGE-13 | ~63% | PA-23, PA-01, PA-18 |
| FL-AGE-07 Bloquear Horario/Festivo | AUD-01 | Ninguna | **100%** | Ninguno |
| FL-COT-01 Gestionar Catálogo | AUD-01 | RN-COT-08 | ~83% | PA-04 |
| FL-ANT-01 Liberar Horario por Anticipo No Pagado | AGE-09, NOT-01, AUD-01 | RN-ANT-03 (ventana) | ~87% | PA-06 |
| FL-GAR-01 Gestionar Solicitud de Garantía | CONV-01/04, AUD-01, ESC-01 | RN-GAR-04/05/06 | ~70% (ver nota) | PA-08, PA-09, PA-10 **+ dependencia estructural de `CitaCompletada` (Matriz 2)** |
| FL-CRM-01 Registrar Cliente | AUD-01 | RN-CRM-01 (supuesto) | ~75% | Confirmación formal de identidad global (Domain Discovery Pregunta #6) |
| FL-CRM-02 Marcar/Desmarcar Lista Roja | CRM-05, AUD-01 | RN-CRM-06, RN-CRM-07 | ~40% (el segundo más bajo) | PA-11, PA-12 |
| FL-CRM-03 Bloquear/Desbloquear Cliente | AUD-01 | Ninguna | **100%** | Ninguno |
| FL-CRM-04 Gestionar Etiquetas | AUD-01 | RN-CRM-09 | ~67% | PA-13 |
| FL-ESC-02 Atender Ticket de Escalamiento | NOT-01, AUD-01 | Ninguna | **100%** | Ninguno |
| FL-NOT-02 Enviar Recordatorio Programado | NOT-01 | RN-NOT-04 | ~75% | PA-24 |
| FL-SUC-01 Configurar Horario y Festivos | AUD-01 | Ninguna | **100%** | Ninguno |
| FL-SUC-02 Activar Modo Mantenimiento | AUD-01 | RN-SUC-03 | ~80% | PA-17 |
| FL-SUC-03 Gestionar Personal | AUD-01 | RN-SEG-04 (supuesto) | ~88% | — |
| FL-SUC-04 Dar de Alta Nueva Sucursal | SUC-01, SUC-03, AUD-01 | RN-SUC-04 (supuesto) | ~75% | PA-18 |
| FL-SEG-01 Gestionar Usuario Interno y Rol | AUD-01 | RN-SEG-03 (bloquea RBAC completo) | ~65% | **PA-19 — la de mayor impacto estructural del proyecto, según `DESIGN-PHASE-HANDOFF.md` §10** |

**Lectura de esta matriz:**
- **4 macro-flows al 100%**, sin ninguna pregunta abierta pendiente: `FL-AGE-07`, `FL-CRM-03`, `FL-ESC-02`, `FL-SUC-01`. Son los candidatos naturales para redactarse primero — no requieren ninguna anotación de incertidumbre.
- **3 macro-flows por debajo del 60%**: `FL-AGE-02` (~55%), `FL-AGE-03` (~45%), `FL-CRM-02` (~40%). Ninguno tiene un problema estructural — su bajo porcentaje refleja fielmente que sus reglas centrales (`RN-AGE-06`, `RN-AGE-13`, `RN-CRM-06/07`) siguen sin resolución de negocio. Redactarlos ahora es válido (con anotaciones explícitas de incertidumbre en cada hueco), pero el mayor apalancamiento real está en resolver `PA-01`, `PA-11`, `PA-12`, y consolidar la Sesión 03 de Domain Discovery — no en seguir documentando alrededor del vacío.
- El hallazgo de mayor valor de toda esta verificación es la dependencia de `FL-GAR-01` hacia el evento `CitaCompletada` (Matriz 2) — no cambia su % de reglas, pero es una dependencia que ninguna de las dos matrices anteriores, tomada sola, habría hecho tan visible.

---

## 4. Conclusión

Ninguna de las tres matrices encontró una inconsistencia estructural: no falta ningún flujo, no sobra ninguno, no hay ciclos, no hay eventos inventados. Las correcciones que sí aparecieron (6 reglas sin cruce explícito, 1 evento con dependencia real hacia un hueco ya conocido, 1 referencia de evento menor) son anotaciones dentro de flujos ya existentes — ninguna reabre el inventario de 21 macro-flows y 15 micro-flows congelado en la sesión anterior.

**Se da por cerrada la fase de análisis.** La siguiente tarea es la redacción detallada de cada uno de los 36 flujos en `docs/decision-flows/`, empezando, si no indicas otro orden, por los 4 macro-flows ya al 100% (`FL-AGE-07`, `FL-CRM-03`, `FL-ESC-02`, `FL-SUC-01`) y sus micro-flows asociados.
