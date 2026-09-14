# Architectural Decision Ownership — Blanc

> **Propósito:** un solo lugar que responda, para cualquier decisión importante del proyecto, quién es su dueño, si puede reabrirse, y con qué evidencia. No reemplaza a los ADRs, Business Rules ni Decision Flows — es un índice de gobernanza sobre ellos.
> **Fecha:** 2026-07-16.

---

## Registro de decisiones

### ADRs (arquitectura técnica)

| Nombre | Descripción | Categoría | Dueño | Estado | Reabrible | Evidencia para reabrir | Documentos afectados | Fase de impacto |
|---|---|---|---|---|---|---|---|---|
| ADR-001 | Modular Monolith, no microservicios | Arquitectura | Equipo de arquitectura | Cerrada | No | Blanc pasa a multi-cliente real, o un módulo necesita escalar independiente con evidencia de carga real | `03`, `04`, todos los módulos | Todas |
| ADR-002 | Hexagonal + Clean + Vertical Slice | Arquitectura | Equipo de arquitectura | Cerrada | No | Ningún puerto llega a tener más de un adaptador real en la práctica | `03`, código de todos los módulos | Todas |
| ADR-003 | CQRS-lite, sin Event Sourcing | Arquitectura | Equipo de arquitectura | Cerrada | No | Necesidad demostrada de reconstrucción histórica exacta más allá de auditoría | `04` §6, Analítica | Fase 6 |
| ADR-004 | Domain Events + Transactional Outbox | Arquitectura | Equipo de arquitectura | Cerrada | No | Necesidad de broker distribuido con evidencia de volumen real | `04` §4.1, todos los módulos con eventos | Fase 2+ |
| ADR-005 | PostgreSQL único, esquemas separados | Arquitectura/Infraestructura | Equipo de arquitectura | Cerrada | No | Evidencia real de contención entre esquemas no mitigable por indexación | `04-data-model.md` completo | Todas |
| ADR-006 | Google Calendar como proyección de solo lectura | Integración externa | **Dueña de Blanc** (mecanismo ya diseñado por arquitectura) | **Provisional** — sin confirmación explícita del cliente (ver `DISCOVERY_CHECKLIST.md` 1.1) | Sí | El negocio demuestra necesidad real de editar directamente en Google Calendar como flujo legítimo | `ADR-006`, `04-data-model.md` §5.9, Sincronización de Calendario | Fase 4 |
| ADR-007 | OpenAI vía Responses API | Negocio/Integración externa | Dueña de Blanc (ya decidido explícitamente) | Cerrada | Sí | Incidente real medible de disponibilidad de OpenAI, o costo sostenido fuera de presupuesto | `ADR-007`, Conversación | Fase 4 |
| ADR-008 | WhatsApp oficial vs. Evolution API | Negocio (riesgo) + Integración externa | **Dueña de Blanc** | **Pendiente** — sign-off explícito no otorgado | Sí, explícitamente previsto por el propio ADR (aceptar Evolution API como riesgo consciente) | Decisión ejecutiva directa de la Dueña | `ADR-008`, Conversación, trámite ante Meta | Fase 4 |
| ADR-009 | Multi-tenant Silo (single-tenant hoy) | Arquitectura | Equipo de arquitectura | Cerrada | No | Aparece un segundo cliente real confirmado comercialmente | Todo el modelo de datos, `ADR-009` | Todas (futuro) |
| ADR-010 | RBAC + JWT + MFA + auditoría append-only | Seguridad | Equipo de arquitectura (mecanismo); Dueña (alcance de 2 roles, `PA-19`) | Cerrada (mecanismo); Pendiente (alcance exacto) | Parcial | Confirmación de `PA-19` | `04-data-model.md` §5.10, `05-api-design.md` | Fase 1 |
| ADR-011 | Observabilidad OpenTelemetry | Arquitectura/Infraestructura | Equipo de arquitectura | Cerrada | No | — | Todos los módulos | Todas |
| ADR-012 | 3 entornos, despliegue rolling/blue-green | Arquitectura/Infraestructura | Equipo de arquitectura | Cerrada | No | — | Despliegue de todas las fases | Fase 1+ |
| ADR-013 | Manejo de errores en 3 categorías | Arquitectura | Equipo de arquitectura | Cerrada | No | — | Todos los módulos | Todas |
| ADR-014 | Versionado de API por URI | Arquitectura | Equipo de arquitectura | Cerrada | No | Aparece el primer integrador externo real con necesidades no anticipadas | `05-api-design.md` | Fase 1+ |
| ADR-015 | Prompts de IA versionados | Arquitectura | Equipo de arquitectura | Cerrada | No | — | Conversación | Fase 4 |
| ADR-016 | Human Handoff con revalidación de modo | Arquitectura | Equipo de arquitectura | Cerrada | No | — | Escalamiento, Conversación | Fase 4 |
| ADR-017 | Object storage privado, URLs firmadas | Arquitectura + Legal (retención) | Equipo de arquitectura (mecanismo); Abogado (plazo exacto, `PA-20`) | Cerrada (mecanismo); Provisional (plazo) | Parcial | Confirmación del marco regulatorio (`PA-20`) | `04-data-model.md` §8 | Fase 4 |
| ADR-018 | Background jobs durables, idempotentes | Arquitectura | Equipo de arquitectura | Cerrada | No | — | Agenda, Anticipos, Notificaciones | Fase 2+ |
| ADR-019 | Pirámide de testing + golden set | Arquitectura | Equipo de arquitectura | Cerrada | No | — | Todos los módulos | Todas |
| ADR-020 | Feature flags acotados a kill-switch/rollout | Arquitectura | Equipo de arquitectura | Cerrada | No | — | Sucursales, Conversación | Fase 1+ |
| ADR-021 | Idempotencia de dos capas | Arquitectura | Equipo de arquitectura | Cerrada | No | — | Todos los módulos con efecto de estado | Todas |
| ADR-022 | Backup/DR, retención diferenciada | Arquitectura + Negocio | Equipo de arquitectura (mecanismo); Dueña (RPO/RTO exactos) | Provisional — valores explícitamente provisionales | Sí | Confirmación de negocio de RPO/RTO reales, o incidente real | `04-data-model.md` §8 | Fase 7 |

### Modelado de dominio

| Nombre | Descripción | Categoría | Dueño | Estado | Reabrible | Evidencia para reabrir | Documentos afectados | Fase de impacto |
|---|---|---|---|---|---|---|---|---|
| 11 Bounded Contexts | Límites estratégicos del dominio | Arquitectura | Equipo de arquitectura | Cerrada | No | — | Todos | Todas |
| `SolicitudDeCambioDeHorario` como aggregate independiente | Sin VO de criterios adicionales, sin Saga | Arquitectura | Equipo de arquitectura | Cerrada | No | Evidencia de que el negocio necesita múltiples ofertas por cita (ya evaluado y rechazado una vez) | `01-domain-discovery.md` §5.1 | Fase 2 |
| Fronteras de aggregate (`Conversacion+Mensaje`, `TicketEscalamiento` separado, `SolicitudAnticipo` separado) | Confirmadas tras revisión adversarial explícita (DM-15/16/17) | Arquitectura | Equipo de arquitectura | Cerrada | No | — | `01-domain-discovery.md`, `04-data-model.md` | Fase 2, 4 |
| 3 máquinas de estado deliberadamente diferidas | `Cita`, `Conversación`, `TicketEscalamiento` — restricción de alcance ya cumplida, ahora en diseño activo | Arquitectura | Equipo de arquitectura (con 2 insumos de negocio, ver `DISCOVERY_CHECKLIST.md` 1.6/1.22) | Pendiente (en ejecución, Fase 0) | N/A — es trabajo pendiente, no una decisión a reabrir | — | `01-domain-discovery.md`, `04-data-model.md` §5.1/§5.3 | Fase 2, 4 |
| Identidad global de clienta por teléfono | Historial cruza todas las sucursales | Negocio | Dueña de Blanc | Provisional (supuesto de trabajo) | Sí | Confirmación explícita, bajo riesgo si se mantiene sin confirmar | `RN-CRM-01` | Fase 3 |
| Manicurista-recurso ≠ Usuario-manicurista | Dos conceptos distintos, vínculo opcional | Arquitectura/Negocio | Equipo de arquitectura | Provisional (supuesto de trabajo, bajo riesgo) | Sí | — | `RN-SEG-04`, `04-data-model.md` §5.1/§5.7 | Fase 1, 2 |

### Políticas de negocio (agrupadas por tema — no una fila por cada una de las 73 reglas)

| Nombre | Descripción | Categoría | Dueño | Estado | Reabrible | Evidencia para reabrir | Documentos afectados | Fase de impacto |
|---|---|---|---|---|---|---|---|---|
| Motor de duración por combinación (estructura) | Tabla de combinaciones, no suma de tiempos | Negocio | Dueña de Blanc | Cerrada (estructura); valores exactos Pendiente | Sí, para valores exactos | Tablas completas de combinaciones (`PA-02`) | `docs/business-rules/02-duracion-cotizacion.md` | Fase 1 |
| Anticipo solo para lista roja | Política de cobro condicionado | Negocio | Dueña de Blanc | Cerrada | Sí | Nueva política de riesgo del negocio | `docs/business-rules/03-anticipos.md` | Fase 3 |
| Garantía de 7 días, siempre revisión humana | Nunca aprobación automática | Negocio | Dueña de Blanc | Cerrada | Sí | Nueva política comercial | `docs/business-rules/04-garantias.md` | Fase 5 |
| Clasificación de clientas (normal/VIP/lista roja/bloqueada) | Estados y consecuencias asociadas | Negocio | Dueña de Blanc | Cerrada | Sí | Nueva política de CRM | `docs/business-rules/05-crm-clientas.md` | Fase 3 |
| 7 roles con capacidades delimitadas | Catálogo de roles (alcance de 2 roles Pendiente, `PA-19`) | Negocio | Dueña de Blanc | Cerrada (catálogo); Pendiente (alcance de 2 roles) | Sí, para alcance | Confirmación `PA-19` | `docs/business-rules/10-identidad-seguridad.md` | Fase 1 |
| Disparadores de escalamiento (imagen/audio/queja/palabra prohibida) | Detención automática de IA | Negocio | Dueña de Blanc | Cerrada | Sí | Nueva categoría de disparador | `docs/business-rules/07-escalamiento.md` | Fase 4 |
| Tono conversacional ("que no se note como bot") | Requisito de estilo | Negocio/UX | Dueña de Blanc | Cerrada | Sí | — | `docs/business-rules/06-conversacion-ia.md` | Fase 4 |
| Modo mantenimiento | Pausa reversible de atención automática | Negocio | Dueña de Blanc | Cerrada (mecanismo); Pendiente (comportamiento hacia clienta, `PA-17`) | Sí, para el comportamiento | Confirmación `PA-17` | `docs/business-rules/09-sucursales-configuracion.md` | Fase 1 |

### Stack técnico específico (decisiones firmes de `03-technical-architecture.md`)

| Nombre | Descripción | Categoría | Dueño | Estado | Reabrible | Evidencia para reabrir | Documentos afectados | Fase de impacto |
|---|---|---|---|---|---|---|---|---|
| NestJS | Framework de backend | Infraestructura | Equipo de arquitectura | Cerrada | Sí | Bajo riesgo de revertir — es una de las decisiones más baratas del proyecto | `03` §3.1 | Fase 1 |
| Next.js | Framework de frontend | Infraestructura | Equipo de arquitectura | Cerrada | Sí, bajo riesgo | — | `03` §3.2 | Fase 1+ |
| Redis/Valkey | Cache | Infraestructura | Equipo de arquitectura | Cerrada | Sí, bajo riesgo | — | `03` §3.5 | Fase 2 |
| OpenAI Responses API (no Assistants) | Superficie de API de IA concreta | Arquitectura | Equipo de arquitectura | Cerrada | No, sin evidencia nueva | Contradice un principio ya congelado si se cambia a Assistants API | `03` §3.10 | Fase 4 |
| `googleapis` (librería oficial) | Cliente de Google Calendar | Integración externa | Equipo de arquitectura | Cerrada | No | — | `03` §3.12 | Fase 4 |
| GitHub Actions | CI/CD | Infraestructura | Equipo de arquitectura | Cerrada (bajo supuesto de que GitHub aloja el código) | Sí, si el supuesto es falso | Confirmación de la plataforma de repositorios | `03` §3.15 | Fase 1 |

### Gobernanza / meta

| Nombre | Descripción | Categoría | Dueño | Estado | Reabrible | Evidencia para reabrir | Documentos afectados | Fase de impacto |
|---|---|---|---|---|---|---|---|---|
| Business Rules Engine (taxonomía, template, gobernanza) | 73 reglas, 12 categorías | Arquitectura | Equipo de arquitectura | Cerrada | No, la infraestructura; sí, el contenido de cada regla individual | — | `docs/business-rules/` completo | Todas |
| Catálogo de Decision Flows (21 macro + 15 micro) | Inventario congelado | Arquitectura | Equipo de arquitectura | Cerrada, con 2 correcciones pendientes de aplicar (ver `ARCHITECTURE_CONSISTENCY_AUDIT.md` H1) | Sí, exactamente para esas 2 correcciones ya identificadas | Ya presentada — `ARCHITECTURE_CONSISTENCY_AUDIT.md` H1 | `decision-flows-catalogo-diseno.md` | Fase 2, 3 |
| Renames diferidos (`Clienta`→`Cliente`, etc.) | Explícitamente pospuestos | Negocio | Dueña de Blanc | Cerrada (la decisión de diferir) | Sí, cuando exista un segundo cliente real | Segundo cliente confirmado | Todo el modelo de datos | Futuro |
| Mockup como entregable comercial congelado | No se modifica sin autorización | UX/Negocio | Dueña de Blanc | Cerrada | Sí, con autorización explícita | Autorización directa de la Dueña | `mockup/` | N/A |
| Idioma español obligatorio en todo el proyecto | Documentación, comentarios, respuestas | Negocio/UX | Usuario (Dueña/dirección del proyecto) | Cerrada | Sí | Nueva instrucción explícita | Todo el repositorio | Todas |

---

## DECISIONES NO REABRIBLES

Decisiones arquitectónicas que quedaron definitivamente cerradas — no se reabren sin evidencia objetiva y demostrable contra un documento ya aprobado:

- Los 22 ADRs, salvo los 4 marcados explícitamente `Provisional`/`Pendiente` arriba (ADR-006, ADR-008, ADR-010 en su alcance exacto, ADR-017 en su plazo exacto, ADR-022 en sus valores exactos) — el resto es firme.
- Los 11 Bounded Contexts y sus fronteras.
- `SolicitudDeCambioDeHorario` como aggregate independiente, con las dos alternativas de diseño ya evaluadas y rechazadas (nombre alternativo, separación en Interés/Oferta).
- Las fronteras de aggregate confirmadas tras revisión adversarial (`Conversacion+Mensaje`, `TicketEscalamiento`, `SolicitudAnticipo` como aggregates separados).
- Modular Monolith, Hexagonal + Clean + Vertical Slice, CQRS-lite acotado, Domain Events + Outbox, PostgreSQL único con esquemas separados.
- La infraestructura (taxonomía, template, gobernanza) del Business Rules Engine y del catálogo de Decision Flows — el contenido específico de cada regla o flujo individual sí puede evolucionar con nueva información de negocio, la estructura no.
- El orden de implementación por fases de `IMPLEMENTATION_MASTER_PLAN.md`, salvo actualización formal de ese mismo documento.

---

## DECISIONES QUE DEPENDEN EXCLUSIVAMENTE DEL CLIENTE

Decisiones que jamás deben resolverse por ingeniería sin validación explícita de la Dueña de Blanc:

- Confirmación de que la plataforma (no Google Calendar) es la fuente de verdad de disponibilidad (ADR-006).
- Sign-off formal de ADR-008 (WhatsApp oficial vs. Evolution API) — es una decisión de riesgo de negocio, no técnica.
- Alcance de sucursales para los roles Analista y Solo lectura (`PA-19`).
- Toda tabla de duración/precio de combinaciones de servicio no listada (`PA-02`, `PA-03`, `PA-04`).
- Ventana de gracia de anticipos (`PA-06`) y criterio de reembolso justificado (`PA-07`).
- Beneficio exacto de una garantía válida (`PA-08`) y si varía por sucursal (`PA-10`).
- Umbral de cancelaciones para lista roja (`PA-11`) y tratamiento de citas ya confirmadas al marcarla (`PA-12`).
- Gobernanza de etiquetas de cliente (`PA-13`).
- Umbral de "cliente molesto" (`PA-14`) y disparador de cierre/reapertura de conversación (`PA-15`).
- Naturaleza de la confirmación automática, push o interactiva (`PA-16`).
- Comportamiento hacia la clienta en modo mantenimiento (`PA-17`).
- Disparador de `completada`/`no_show` de una cita (Domain Discovery Pregunta #15).
- Invariante de capacidad para citas sin manicurista asignada (hallazgo de `DOMAIN_MODEL_REVIEW.md`, DM-11).
- RPO/RTO reales de backup y presupuesto aceptable de mensajería de WhatsApp / costo de IA.
- Cualquier decisión que ADR-022 o el Business Rules Engine ya marquen como "supuesto de trabajo, pendiente de confirmación explícita del cliente".

**Nota de exclusión deliberada:** el marco regulatorio de datos personales (`PA-20`) depende de un **Abogado**, no directamente de la Dueña (aunque ella debe validar la recomendación final) — se lista aparte en el registro principal, no aquí, para no atribuirle a la Dueña una decisión que requiere asesoría legal especializada como primer paso.
