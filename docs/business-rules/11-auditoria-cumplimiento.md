# Categoría: Auditoría y Cumplimiento (`RN-AUD`)

> Gobierna el registro permanente de acciones relevantes y el manejo de datos personales.

---

### RN-AUD-01 — Registro permanente no editable

| Campo | Valor |
|---|---|
| Rule ID | RN-AUD-01 |
| Nombre | Registro permanente y no editable de acciones relevantes |
| Objetivo | Garantizar trazabilidad completa de las decisiones y cambios más sensibles del negocio. |
| Descripción | Todo cambio de configuración, toda acción financiera, toda asignación o remoción de la clasificación "lista roja", y toda decisión relevante de la inteligencia artificial queda registrada de forma permanente y no editable. **Ampliación (2026-08-04, `DISCOVERY_CHECKLIST.md` §4.4, pregunta implícita nunca antes registrada):** también queda registrada toda cancelación o reprogramación de una cita realizada directamente por un empleado (no solo por la IA), aunque no tenga componente financiero — vacío detectado porque ninguna de las cuatro categorías originales lo cubría explícitamente. Ampliar alcance de auditoría es de bajo riesgo por diseño (nunca al revés); no requiere validación de negocio, es una corrección de cobertura de arquitectura. |
| Categoría | Auditoría y Cumplimiento |
| Alcance | Global |
| Disparador | Cualquiera de las acciones listadas en la descripción. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Tipo de acción, actor, entidad afectada, detalle, timestamp. |
| Lógica de negocio | Toda acción de las categorías cubiertas se inserta en el log de auditoría append-only; nunca se actualiza ni se elimina un registro existente. |
| Resultado esperado | Cualquier acción sensible puede reconstruirse íntegramente después de ocurrida. |
| Ejemplos | `aud-1` a `aud-8` en el mockup: decisiones de IA, cambios de configuración, asignación de lista roja, pagos de anticipo, publicación de prompts, escalamientos. |
| Excepciones | Ninguna — es append-only sin excepciones de edición. |
| Prioridad | Critical |
| Consumidores | Backend, Auditoría, QA, Administrador |
| Dependencias | Depende de: RN-SEG-01, RN-CRM-05, RN-CONV-04 |
| Fuente | `01-domain-discovery.md` (principio de auditoría); ADR-010 |
| Estado | Aprobada |
| Versión | 2 (2026-08-04 — cambio de fondo en `Descripción`, amplía cobertura a cancelaciones/reprogramaciones por empleado) |
| Fecha de aprobación | No registrada (ampliación de alcance de arquitectura, no requiere aprobación de negocio) |
| Notas | El registro de decisiones de IA separa metadatos (retención larga) de contenido conversacional crudo (retención corta) — ver `RN-AUD-02` y `04-data-model.md` §4.3. |

---

### RN-AUD-02 — Marco regulatorio de datos personales aplicable

| Campo | Valor |
|---|---|
| Rule ID | RN-AUD-02 |
| Nombre | Marco regulatorio de protección de datos personales aplicable |
| Objetivo | Confirmar si existe una obligación regulatoria aplicable al manejo de datos personales de las clientas. |
| Descripción | **Parcialmente respondido.** La Dueña indicó que, a su conocimiento, no aplica ninguna obligación hoy ("No por el momento") — pero es una apreciación informal, no una validación jurídica formal. La pregunta original ya señalaba explícitamente que esta no es una decisión que la Dueña deba responder sola. |
| Categoría | Auditoría y Cumplimiento |
| Alcance | Global |
| Disparador | No aplica — sigue sin cerrar formalmente. |
| Precondiciones | No definido. |
| Entradas requeridas | No definido. |
| Lógica de negocio | No definido — se mantiene la postura conservadora de minimización ya adoptada en `ADR-017`/`ADR-022` mientras no haya validación jurídica formal. |
| Resultado esperado | No definido — los plazos exactos de retención siguen sin poder fijarse con certeza jurídica. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.27 (2026-08-04): *"No por el momento."* |
| Excepciones | No aplica. |
| Prioridad | Alta, no urgente para desarrollo |
| Consumidores | Pendiente |
| Dependencias | Relacionada con: RN-CRM-01, RN-AUD-01 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #12; `DISCOVERY_CHECKLIST.md` 1.27 |
| Estado | Faltante — postura informal registrada, pendiente de validación jurídica formal antes de operar con clientas reales |
| Versión | 1 |
| Fecha de aprobación | N/A — no se cierra sin validación de un abogado |
| Notas | Marcado como riesgo, no como requisito todavía, en `01-domain-discovery.md` §7. **No se cambia el Estado a Aprobada** — la propia regla exige que la responda un abogado con validación final de la Dueña, no la Dueña sola. |
