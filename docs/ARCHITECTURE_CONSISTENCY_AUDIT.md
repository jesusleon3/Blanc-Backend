# Architecture Consistency Audit — Blanc

> **Objetivo único:** encontrar inconsistencias documentales reales entre documentos ya existentes. No se buscan ideas nuevas, no se proponen funcionalidades, no se reabre ninguna decisión ya cerrada.
> **Alcance revisado:** Domain Discovery, Business Rules, Functional Scope, Data Model, Technical Architecture, los 22 ADRs, Decision Flows (catálogo + trazabilidad + revisión crítica), Architecture Review, Domain Model Review, Implementation Readiness Review, Implementation Master Plan, Architecture Closure Plan, Discovery Checklist, los tres HANDOFF, `presentacion-cliente.md`, `mockup/README.md`. `05-api-design.md` **no existe todavía** (verificado directamente) — no hay nada que cruzar ahí.
> **Fecha:** 2026-07-16.

---

## Hallazgos que sobrevivieron el intento de refutación

### H1 — Dependencia circular Agenda↔Anticipos, todavía sin corregir en el archivo vivo

1. **Documentos involucrados:** `decision-flows-catalogo-diseno.md`, `01-domain-discovery.md`, `03-technical-architecture.md`.
2. **Citas exactas:** `decision-flows-catalogo-diseno.md` (Sección 2): `FL-ANT-01` invoca `FL-AGE-09`; `FL-AGE-08` invoca `FL-CRM-05`/`FL-ANT-02`. `01-domain-discovery.md` §4: *"Anticipos: Consumidor de estado de Clienta y de Agenda (slot a retener)"* — relación unidireccional. `03-technical-architecture.md` §4.1: el diagrama de componentes muestra `Anticipos` estrictamente aguas abajo del bus de eventos, sin flecha de retorno hacia `Agenda`.
3. **Explicación del conflicto:** el catálogo de Decision Flows implementa una invocación en ambos sentidos entre dos Bounded Contexts que dos documentos distintos (Domain Discovery y Technical Architecture) describen como relación unidireccional.
4. **Severidad:** High.
5. **Impacto real:** si se codifica tal cual está escrito, el módulo `Agenda` importaría la interfaz pública de `Anticipos` y viceversa — dependencia circular de módulo, contradice `ADR-001`.
6. **Fuente de verdad recomendada:** `01-domain-discovery.md` §4 + `03-technical-architecture.md` §4.1 (ambos ya coinciden entre sí; el catálogo de Decision Flows es el que se desvió).
7. **Corrección mínima:** una fila del catálogo — `FL-ANT-01` pasa de invocar `FL-AGE-09` a publicar `AnticipoExpirado` (evento ya catalogado), consumido por Agenda vía su propio Outbox.
8. **¿Bloquea implementación?** Sí, de Fase 2/3, en su forma actual — la corrección es de bajo esfuerzo.
9. **¿Reabre una decisión ya cerrada?** No — el mecanismo de consistencia eventual entre estos dos contextos ya estaba decidido (`01-domain-discovery.md` §5.11); esta corrección lo respeta, no lo cambia.
10. **Intento de refutación:** se buscó si `02-architecture-principles.md` §2 permitía invocación en ambos sentidos entre dos contextos ("invocación explícita de un caso de uso público del otro contexto" es una de las dos formas permitidas de comunicación). Esto permite que *un* contexto invoque al otro — no que ambos se invoquen mutuamente sin que ninguno sea downstream puro. Domain Discovery §4 ya fija explícitamente cuál de los dos es el consumidor. **No se pudo refutar.**
- Ya identificado y con corrección propuesta en la ronda de revisión adversarial previa; sigue sin aplicarse en el archivo — se reporta aquí porque la auditoría revisa el estado actual del repositorio, no el historial de recomendaciones.

### H2 — Etiquetas de estado documental desactualizadas (tres manifestaciones del mismo patrón)

1. **Documentos involucrados:** `01-domain-discovery.md`, los 22 ADRs, `mockup/README.md`.
2. **Citas exactas:** `01-domain-discovery.md` línea 4: *"Estado: Borrador v0.1 — pendiente de validación de las Preguntas Abiertas antes de congelar el modelo."* Cada uno de los 22 ADRs: *"Status: Proposed — pendiente de aprobación del cliente."* `mockup/README.md` (citado en `ARCHITECTURE-HANDOFF.md` §9): afirma que `01-domain-discovery.md` está *"ya auditado y cerrado."*
3. **Explicación del conflicto:** tres documentos afirman, en su propio encabezado o contenido, un estado (`Borrador`/`Proposed`/`no cerrado` vs. `cerrado`) que contradice cómo el resto del repositorio (73 Business Rules, 36 Decision Flows, `04-data-model.md`, `IMPLEMENTATION_MASTER_PLAN.md`) los trata en la práctica: como fuente cerrada y vinculante.
4. **Severidad:** Medium — no es un error de contenido, es un desfase de gobernanza, pero es real y afecta a la totalidad del proyecto (todo se construyó encima de documentos que formalmente dicen no estar cerrados).
5. **Impacto real:** un lector nuevo (o un auditor externo) que abra `01-domain-discovery.md` o cualquier ADR por primera vez concluiría, correctamente según el propio texto, que el diseño no está aprobado — contradiciendo el estado real de facto del proyecto.
6. **Fuente de verdad recomendada:** el propio contenido ya es correcto y vinculante; lo que debe actualizarse es únicamente el campo de estado/encabezado, no el contenido.
7. **Corrección mínima:** actualizar `Estado`/`Status` de estos documentos a reflejar su tratamiento real, y corregir o eliminar la afirmación de `mockup/README.md`.
8. **¿Bloquea implementación?** No — todo el repositorio ya opera como si estuvieran cerrados.
9. **¿Reabre una decisión ya cerrada?** No — es un cambio de etiqueta, no de contenido.
10. **Intento de refutación:** se buscó si `ARCHITECTURE_CLOSURE_PLAN.md` ya resolvía esto. Lo incluye como pendiente de "formalización a Accepted" (para los ADRs) pero no para el encabezado de `01-domain-discovery.md` ni para `mockup/README.md` — la cobertura es parcial. **No se pudo refutar en su totalidad.**
- Ya señalado parcialmente como inconsistencia en `ARCHITECTURE-HANDOFF.md` §9 (2026-07-13); sigue sin corregirse tres sesiones después.

### H3 — ADR-001 y ADR-005 cuentan "10 Bounded Contexts"; el resto del repositorio usa 11

1. **Documentos involucrados:** `ADR-001-modular-monolith-vs-microservices.md`, `ADR-005-postgresql-single-database.md`, `01-domain-discovery.md`, `04-data-model.md`.
2. **Citas exactas:** `ADR-001` Contexto: *"El Domain Discovery... identificó 10 Bounded Contexts con fronteras claras (Agenda, Catálogo y Cotización, Conversación, Escalamiento, Clientas, Anticipos, Sucursales y Personal, Identidad y Accesos, Analítica, Sincronización de Calendario)"* — la lista omite `Notificaciones`. `04-data-model.md` §2: *"El Domain Discovery define 11 Bounded Contexts... no 10; ADR-001 y ADR-005 fueron redactados antes de que Notificaciones se incorporara formalmente."*
3. **Explicación del conflicto:** dos ADRs cuentan y enumeran explícitamente un Bounded Context menos que el modelo de dominio vigente.
4. **Severidad:** Low — `04-data-model.md` ya documenta la discrepancia y ya declara cuál es el criterio autorizado.
5. **Impacto real:** ninguno funcional — es un desfase de conteo ya explicado por otro documento del propio repositorio.
6. **Fuente de verdad recomendada:** `01-domain-discovery.md` (11 Bounded Contexts), ya reconocido así explícitamente por `04-data-model.md`.
7. **Corrección mínima:** nota al pie en `ADR-001`/`ADR-005` actualizando el conteo — opcional, de cortesía editorial, no urgente.
8. **¿Bloquea implementación?** No.
9. **¿Reabre una decisión ya cerrada?** No.
10. **Intento de refutación:** se buscó si esto ya estaba resuelto sin necesidad de acción. `04-data-model.md` §2 ya lo resuelve en cuanto a gobernanza ("no es una contradicción que deba resolverse modificando esos ADRs") — pero el texto literal de los dos ADRs sigue sin corregirse. **Sobrevive como hallazgo de severidad mínima**, ya que el texto en sí sigue siendo inconsistente aunque la gobernanza ya lo explique.

### H4 — `IMPLEMENTATION_MASTER_PLAN.md` y `ARCHITECTURE_CLOSURE_PLAN.md` describen distinto qué cierra Fase 0

1. **Documentos involucrados:** `IMPLEMENTATION_MASTER_PLAN.md` §6 (Fase 0), `ARCHITECTURE_CLOSURE_PLAN.md` (Matriz de cierre, Sección 2).
2. **Citas exactas:** `IMPLEMENTATION_MASTER_PLAN.md` §6, Fase 0, Entregables: *"las 3 máquinas de estado diseñadas...; `05-api-design.md`; ORM y proveedor de BD cerrados; `RN-SEG-03` resuelta; ADRs candidatos ratificados; inicio del trámite de verificación de negocio ante Meta."* `ARCHITECTURE_CLOSURE_PLAN.md` Sección 2 lista **nueve** pendientes, incluyendo dos que el Master Plan no menciona: la invariante de capacidad para citas sin manicurista (P4) y la corrección de la dependencia circular Agenda↔Anticipos (P5, ver H1).
3. **Explicación del conflicto:** ambos documentos responden a la misma pregunta ("¿qué debe cerrar Fase 0?") con listas que no coinciden — el Master Plan es anterior a las dos rondas de revisión adversarial que descubrieron P4 y P5, y nunca se actualizó para incorporarlas.
4. **Severidad:** Medium-High — no es un error de contenido en ninguno de los dos, es un desfase temporal real entre un documento y su sucesor más reciente y más completo.
5. **Impacto real:** alguien que siga únicamente `IMPLEMENTATION_MASTER_PLAN.md` §6 sin conocer `ARCHITECTURE_CLOSURE_PLAN.md` podría dar Fase 0 por cerrada sin haber resuelto P4/P5.
6. **Fuente de verdad recomendada:** `ARCHITECTURE_CLOSURE_PLAN.md` — es el documento más reciente, y su propio propósito declarado es responder exactamente esta pregunta.
7. **Corrección mínima:** agregar una nota de referencia cruzada en `IMPLEMENTATION_MASTER_PLAN.md` §6 (Fase 0) señalando que `ARCHITECTURE_CLOSURE_PLAN.md` es la lista de pendientes vigente y debe consultarse en vez de (o además de) la lista original de esa sección.
8. **¿Bloquea implementación?** No de forma independiente — ambos documentos ya apuntan al mismo trabajo real; el riesgo es de omisión por desconocimiento, no de contenido contradictorio de fondo.
9. **¿Reabre una decisión ya cerrada?** No.
10. **Intento de refutación:** se buscó si `IMPLEMENTATION_MASTER_PLAN.md` en algún otro punto ya referenciaba a `ARCHITECTURE_CLOSURE_PLAN.md` (que se escribió después) de forma que la desactualización fuera evidente y no un descuido silencioso. No existe tal referencia cruzada en ningún punto del Master Plan. **No se pudo refutar.**

### H5 — `presentacion-cliente.md` describe el "cambio de horario" como una funcionalidad todavía no incluida; `functional-scope.md` y `RN-AGE-06` la tratan como ya aprobada

1. **Documentos involucrados:** `presentacion-cliente.md`, `functional-scope.md`, `docs/business-rules/01-agenda.md`.
2. **Citas exactas:** `presentacion-cliente.md` §10, Roadmap — "Identificado para versiones futuras": *"Un mecanismo para notificar a una clienta si se libera un horario más conveniente antes de su cita ya confirmada... actualmente en evaluación, no incluido todavía."* `functional-scope.md` §3.1: *"Una clienta con una cita ya confirmada puede solicitar que se le avise si se libera un horario anterior a esa cita... (Decisión aprobada en sesión de descubrimiento adicional sobre cambio de horario)."* `RN-AGE-06`, Estado: *"Aprobada conceptualmente, pendiente de consolidación documental formal"* — aprobada, no en evaluación.
3. **Explicación del conflicto:** el documento comercial dirigido al cliente describe como "en evaluación" una funcionalidad que los documentos técnicos ya tratan como aprobada (con Rule ID, Decision Flow y sección propia en el alcance funcional oficial).
4. **Severidad:** Medium — riesgo de comunicación/expectativa con el cliente, no riesgo técnico.
5. **Impacto real:** si se comparte `presentacion-cliente.md` con la Dueña o un tercero en su forma actual, transmite un estado desactualizado de una funcionalidad ya aprobada.
6. **Fuente de verdad recomendada:** `functional-scope.md` (referencia funcional oficial) y `docs/business-rules/01-agenda.md`.
7. **Corrección mínima:** mover "cambio de horario" de la sección "Identificado para versiones futuras" a la Sección 4 (Funcionalidades) de `presentacion-cliente.md`, ajustando el texto.
8. **¿Bloquea implementación?** No.
9. **¿Reabre una decisión ya cerrada?** No.
10. **Intento de refutación:** se buscó si "en evaluación" podría referirse a un aspecto distinto (ej. el mecanismo técnico, no la aprobación de negocio). El texto no distingue eso — dice llanamente "no incluido todavía", lo cual es fácticamente impreciso dado que ya está aprobada conceptualmente y documentada en `functional-scope.md`. **No se pudo refutar.**
- Ya señalado como inconsistencia en `ARCHITECTURE-HANDOFF.md` §9 (hallazgo 4); sigue sin corregirse.

---

## Hallazgos que NO sobrevivieron el intento de refutación (descartados explícitamente)

### Candidato descartado 1 — Orden de "formalizar ADRs a Accepted" en `DESIGN-PHASE-HANDOFF.md` vs. el orden derivado en la revisión adversarial más reciente
`DESIGN-PHASE-HANDOFF.md` §13 lista "formalizar ADRs a Accepted" como paso 8 de 10 (relativamente temprano); la revisión adversarial de secuenciación más reciente concluyó que debe ir al final, después de resolver los candidatos a enmienda. **Refutado:** el propio `DESIGN-PHASE-HANDOFF.md` se autodescribe como *"reporte fiel del estado ya decidido"* y reconoce explícitamente que documentos posteriores (`ARCHITECTURE-HANDOFF.md`) quedan *"parcialmente superado[s] en vigencia"* por los más recientes — el propio proyecto ya tiene establecido que un handoff histórico cede autoridad frente a un análisis posterior más riguroso sobre la misma pregunta. No es una contradicción viva, es una secuencia ya conscientemente refinada.

### Candidato descartado 2 — "¿Puede comenzar Fase 1?" — respuesta "No" de `ARCHITECTURE_CLOSURE_PLAN.md` vs. el argumento de que 55-65% del código es escribible hoy
Ambas conclusiones existen en esta conversación. **Refutado por dos razones:** (a) el análisis que concluye "55-65% escribible hoy" nunca se persistió como documento del repositorio — vive solo en la conversación, por lo que no es una inconsistencia *documental* en sentido estricto; (b) incluso si se comparan, responden preguntas distintas: `ARCHITECTURE_CLOSURE_PLAN.md` responde "¿puede Fase 1 iniciarse y avanzar hasta un estado desplegable sin más decisiones de arquitectura?" (No, por los proveedores técnicos sin cerrar) — el otro análisis responde "¿puede escribirse código de dominio hoy?" (Sí). Una vez precisada la pregunta que cada uno responde, son compatibles, no contradictorios.

---

## Veredicto

**B) Existen exactamente las siguientes inconsistencias:** H1 (High), H4 (Medium-High), H2 y H5 (Medium), H3 (Low). Ninguna es Critical. Ninguna reabre una decisión ya cerrada. Solo H1 tiene relación directa con bloquear una fase de implementación (Fase 2/3), y su corrección ya estaba identificada y es de bajo esfuerzo — no representa un problema de diseño nuevo, sino una corrección pendiente de aplicar.
