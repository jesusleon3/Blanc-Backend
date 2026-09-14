# Business Rules Engine — Índice y Gobernanza

> **Estado:** Vivo — primera versión.
> **Naturaleza de esta carpeta:** repositorio estructurado de conocimiento operativo, no un documento narrativo. Es la **única fuente oficial de las reglas operativas del negocio** de Blanc. No sustituye ni reduce el propósito de ningún otro documento del proyecto (ver Sección 6).
> **Nivel de generalización:** la **infraestructura** de este motor (taxonomía, template, sistema de IDs, gobernanza, mecanismo de consulta) está diseñada para ser agnóstica de industria y reutilizable por una futura plataforma SaaS. El **contenido** de cada regla (la lógica de negocio real) es y permanece específico de Blanc — no se generaliza especulativamente sin un segundo cliente real. Ver memoria de proyecto "SaaS multi-tenant vision".
> **Fuentes analizadas para la extracción inicial:** `01-domain-discovery.md`, `02-domain-discovery-session-02.md`, `functional-scope.md`, `04-data-model.md`, `ADR_INDEX.md`, `mockup/js/data.js`. No se modificó ninguno de esos documentos para crear esta carpeta.

---

## 1. Propósito

Este repositorio existe para que **cualquier consumidor** (inteligencia artificial, personal humano, backend, dashboard, QA, auditoría) pueda responder cualquier pregunta operativa del negocio consultando exactamente la misma fuente, identificada por un Rule ID único. Nunca debe existir una segunda versión de una regla en un prompt, en el frontend, en el backend o en otro documento — todos consultan esta carpeta.

## 2. Taxonomía (12 categorías)

| # | Categoría | Archivo | Prefijo de Rule ID |
|---|---|---|---|
| 1 | Agenda y Disponibilidad | `01-agenda.md` | `RN-AGE` |
| 2 | Duración y Cotización | `02-duracion-cotizacion.md` | `RN-COT` |
| 3 | Anticipos | `03-anticipos.md` | `RN-ANT` |
| 4 | Garantías | `04-garantias.md` | `RN-GAR` |
| 5 | CRM / Clientas | `05-crm-clientas.md` | `RN-CRM` |
| 6 | Conversación e IA | `06-conversacion-ia.md` | `RN-CONV` |
| 7 | Escalamiento Humano | `07-escalamiento.md` | `RN-ESC` |
| 8 | Notificaciones | `08-notificaciones.md` | `RN-NOT` |
| 9 | Sucursales y Configuración | `09-sucursales-configuracion.md` | `RN-SUC` |
| 10 | Identidad, Accesos y Seguridad | `10-identidad-seguridad.md` | `RN-SEG` |
| 11 | Auditoría y Cumplimiento | `11-auditoria-cumplimiento.md` | `RN-AUD` |
| 12 | Reportes / Analítica | `12-reportes.md` | `RN-REP` |

Preguntas abiertas transversales (no son reglas): `99-open-questions.md`, identificadas como `PA-NN`.

## 3. Template obligatorio por regla (21 campos)

| Campo | Qué contiene |
|---|---|
| Rule ID | Identificador único, permanente, nunca reutilizable (ver Sección 5) |
| Nombre | Nombre corto de la regla |
| Objetivo | Por qué existe esta regla, qué protege o qué habilita |
| Descripción | Explicación funcional completa de la regla |
| Categoría | Una de las 12 de la Sección 2 |
| Alcance | Global / Por sucursal / Decision Pending (si el alcance mismo está sin confirmar) |
| Disparador (Trigger) | Qué evento o acción activa la evaluación de esta regla |
| Precondiciones | Qué debe ser cierto en el sistema antes de que la regla pueda aplicarse |
| Entradas requeridas | Qué datos concretos necesita la regla para evaluarse |
| Lógica de negocio | La regla en sí — condición → resultado |
| Resultado esperado | El efecto concreto sobre el sistema cuando la regla se cumple |
| Ejemplos | 1–2 casos reales de aplicación, tomados de las fuentes analizadas |
| Excepciones | Casos en los que la regla no aplica o se comporta distinto |
| Prioridad | Critical / High / Medium / Low (ver Sección 4) |
| Consumidores | Quién consulta o depende de esta regla hoy o en el futuro previsto |
| Dependencias | Otras reglas de las que depende, o que dependen de esta (por Rule ID) |
| Fuente | Documento y sección exacta de donde se extrajo |
| Estado | Aprobada / Pendiente / Por validar (ver Sección 5) |
| Versión | Entero, empieza en 1 |
| Fecha de aprobación | Fecha real de la fuente que aprobó la regla, o "No registrada" si no existe una fecha explícita en la fuente |
| Notas | Cualquier matiz relevante no cubierto por los campos anteriores |

## 4. Clasificación de prioridad

| Nivel | Criterio | Ejemplos en este repositorio |
|---|---|---|
| **Critical** | Su violación causa pérdida de integridad de agenda, pérdida de ingresos, o una decisión de negocio tomada incorrectamente por la IA | No-doble-booking (`RN-AGE-01`), snapshot de cotización (`RN-AGE-08`), dinero como entero (`RN-COT-07`), "la IA interpreta, no decide" (`RN-CONV-01`) |
| **High** | Afecta directamente ingresos, reputación o una política de riesgo del negocio, sin comprometer la integridad transaccional central | Garantías (`RN-GAR-*`), anticipos (`RN-ANT-*`), lista roja (`RN-CRM-03`) |
| **Medium** | Mejora operación o experiencia, sin riesgo financiero o de integridad directo | Notificaciones (`RN-NOT-*`), CRM/etiquetas (`RN-CRM-08`) |
| **Low** | Bajo impacto si no se cumple exactamente | Reportes (`RN-REP-*`), configuración visual |

## 5. Reglas de gobernanza (obligatorias, sin excepción)

1. **Rule ID permanente y nunca reutilizable.** Si una regla se elimina o se retira, su ID se marca `Retirado` en el índice y nunca se reasigna a una regla distinta.
2. **Nunca inventar información para completar un campo.** Si un campo depende de una decisión de negocio que no existe todavía, el valor del campo es literalmente `No definido — ver 99-open-questions.md#PA-NN`, nunca una suposición redactada como si fuera un hecho.
3. **`Estado` es la fuente de verdad de si un consumidor puede confiar en la regla hoy.** Que una regla liste "IA" en `Consumidores` describe quién la usará *cuando esté aprobada* — mientras `Estado ≠ Aprobada`, ningún consumidor real (humano o automatizado) debe tratar esa regla como comportamiento vigente del sistema.
4. **Las dependencias se declaran en ambos sentidos cuando es factible** ("depende de" / "es dependencia de"), para poder anticipar el impacto de un cambio futuro. Al ser markdown, esto no se valida automáticamente — es responsabilidad de quien edita una regla mantener la consistencia del grafo.
5. **Versionado:** toda regla nace en Versión 1. La versión solo se incrementa ante un cambio de fondo en `Lógica de negocio`, `Resultado esperado` o `Excepciones`. Correcciones de redacción, typos o aclaraciones de forma no incrementan la versión.
6. **Ninguna regla se aprueba unilateralmente por mí.** El `Estado: Aprobada` de cada regla en esta primera versión refleja que la decisión de negocio **ya fue aprobada por el cliente** en una fuente existente (Domain Discovery, Sesión 02, u otra sesión de descubrimiento) — no que yo la esté aprobando ahora. Las reglas en estado `Pendiente`/`Por validar` requieren una decisión de negocio real antes de pasar a `Aprobada`.

## 6. Relación con el resto de la documentación

- `01-domain-discovery.md`, `04-data-model.md`, `02-architecture-principles.md`, los ADRs y `03-technical-architecture.md` **no se modifican** para apuntar hacia este repositorio. Conservan su propósito íntegro (modelo de dominio, modelo de datos, arquitectura). Ver memoria de proyecto "Document boundaries governance".
- `functional-scope.md` y `presentacion-cliente.md` tampoco se modifican retroactivamente. Documentos **nuevos** que se escriban de aquí en adelante sí pueden citar un Rule ID como referencia cruzada cuando aporte valor.
- Este repositorio es la única fuente de verdad **solo** para reglas operativas del negocio — no para conceptos de dominio (aggregates, eventos), modelo de datos, ni arquitectura.

## 7. Tabla maestra de reglas

| Rule ID | Nombre | Categoría | Prioridad | Estado | Alcance |
|---|---|---|---|---|---|
| RN-AGE-01 | No doble-booking de profesional | Agenda | Critical | Aprobada | Global |
| RN-AGE-02 | Revalidación de disponibilidad al confirmar | Agenda | Critical | Aprobada | Global |
| RN-AGE-03 | Manicurista exclusiva | Agenda | High | Aprobada (caso límite pendiente) | Global |
| RN-AGE-04 | Fallback de disponibilidad | Agenda | High | Aprobada | Global |
| RN-AGE-05 | Conflicto de confirmación tardía | Agenda | High | Aprobada | Global |
| RN-AGE-06 | Cambio a horario anterior | Agenda | High | Aprobada | Global |
| RN-AGE-07 | Lista de espera | Agenda | Medium | Aprobada (expiración por evento confirmada; prioridad exacta sin reconfirmar) | Global |
| RN-AGE-08 | Snapshot inmutable de cotización | Agenda | Critical | Aprobada (supuesto de trabajo) | Global |
| RN-AGE-09 | Google Calendar como vista de solo lectura | Agenda | High | Aprobada — confirmada explícitamente por la Dueña (2026-08-03) | Global |
| RN-AGE-10 | Horario y festivos por sucursal | Agenda | Medium | Aprobada | Por sucursal |
| RN-AGE-11 | Bloqueo manual de horarios | Agenda | Medium | Aprobada | Por sucursal |
| RN-AGE-12 | Domingo cerrado | Agenda | Low | Aprobada | Global |
| RN-AGE-13 | Prioridad entre candidatas a horario liberado | Agenda | High | Aprobada | Global |
| RN-COT-01 | Motor de duración por combinación | Duración y Cotización | Critical | Aprobada | Global |
| RN-COT-02 | "Retiro" como categoría propia | Duración y Cotización | High | Aprobada | Global |
| RN-COT-03 | Diseño como extra por uña | Duración y Cotización | High | Aprobada | Global |
| RN-COT-04 | Combinaciones no listadas en la tabla | Duración y Cotización | Critical | Parcialmente aprobada — estructura y regla general recibidas, tabla detallada incompleta | Global |
| RN-COT-05 | Quién decide el método de retiro | Duración y Cotización | High | Aprobada | Global |
| RN-COT-06 | ¿Duraciones varían por sucursal? | Duración y Cotización | Medium | Aprobada | Global |
| RN-COT-07 | Dinero como entero (centavos) | Duración y Cotización | Critical | Aprobada | Global |
| RN-COT-08 | Override de precio/duración por sucursal | Duración y Cotización | Medium | Confirmada sin uso — se mantiene modelada preventivamente, sin activar | Decision Pending |
| RN-COT-09 | Vigencia de cotización antes de confirmar | Duración y Cotización | Medium | Aprobada | Global |
| RN-ANT-01 | Solo lista roja paga anticipo | Anticipos | High | Aprobada | Global |
| RN-ANT-02 | Cita no confirmada en firme sin pago | Anticipos | High | Aprobada | Global |
| RN-ANT-03 | Liberación automática si no se paga | Anticipos | High | Aprobada | Global |
| RN-ANT-04 | Criterio de reembolso "justificado" | Anticipos | High | Aprobada | Global |
| RN-GAR-01 | Cobertura de garantía de 7 días | Garantías | High | Aprobada | Global (a confirmar si varía) |
| RN-GAR-02 | Solo aplica a servicio completado | Garantías | High | Aprobada | Global |
| RN-GAR-03 | Nunca aprobación automática | Garantías | High | Aprobada | Global |
| RN-GAR-04 | Beneficio exacto de la garantía | Garantías | High | Aprobada | Global |
| RN-GAR-05 | Tratamiento de coincidencia parcial | Garantías | Medium | Aprobada | Global |
| RN-GAR-06 | ¿Política de garantía varía por sucursal? | Garantías | Low | Aprobada | Global |
| RN-CRM-01 | Identidad global de clienta por teléfono | CRM / Clientas | Medium | Aprobada (supuesto de trabajo) | Global |
| RN-CRM-02 | Clasificación normal/VIP/lista roja/bloqueada | CRM / Clientas | Medium | Aprobada | Global |
| RN-CRM-03 | Lista roja exige anticipo y aprobación de cancelación | CRM / Clientas | High | Aprobada | Global |
| RN-CRM-04 | Clienta bloqueada no puede agendar | CRM / Clientas | High | Aprobada | Global |
| RN-CRM-05 | Asignación manual a lista roja | CRM / Clientas | High | Aprobada (supuesto de trabajo) | Global |
| RN-CRM-06 | Umbral exacto para sugerir lista roja | CRM / Clientas | High | Aprobada | Global |
| RN-CRM-07 | Tratamiento de citas ya confirmadas al marcar lista roja | CRM / Clientas | High | Aprobada | Global |
| RN-CRM-08 | Etiquetas de texto libre | CRM / Clientas | Medium | Aprobada | Global |
| RN-CRM-09 | Gobernanza de etiquetas | CRM / Clientas | Medium | Aprobada | Global |
| RN-CONV-01 | La IA interpreta, nunca decide | Conversación e IA | Critical | Aprobada | Global |
| RN-CONV-02 | Validación estructurada antes de tener efecto | Conversación e IA | Critical | Aprobada | Global |
| RN-CONV-03 | Clarificación ante respuesta ambigua | Conversación e IA | High | Aprobada (redacción 9.6 pendiente de aplicar) | Global |
| RN-CONV-04 | Trazabilidad de toda decisión de IA | Conversación e IA | High | Aprobada | Global |
| RN-CONV-05 | Degradación a escalamiento humano | Conversación e IA | Critical | Aprobada | Global |
| RN-CONV-06 | No se procesan notas de voz | Conversación e IA | High | Aprobada | Global |
| RN-CONV-07 | Tono personal, sin sonar a bot | Conversación e IA | Medium | Aprobada | Global |
| RN-CONV-08 | Criterio de "cliente molesto" | Conversación e IA | High | Mecanismo aprobado, umbral faltante | Global |
| RN-CONV-09 | Gobernanza de "palabra prohibida" | Conversación e IA | High | Aprobada (supuesto de trabajo) | Global |
| RN-CONV-10 | Cierre y reapertura de conversación | Conversación e IA | Critical | Parcialmente aprobada — modelo de identidad y memoria confirmados; disparador de reseteo de `modo` sigue faltante | Global |
| RN-CONV-11 | Confirmación automática: ¿push o requiere respuesta? | Conversación e IA | High | Aprobada | Global |
| RN-ESC-01 | Disparo automático de escalamiento | Escalamiento Humano | Critical | Aprobada | Global |
| RN-ESC-02 | Revalidación de modo antes de cada respuesta del bot | Escalamiento Humano | Critical | Aprobada | Global |
| RN-ESC-03 | Retorno de control siempre explícito | Escalamiento Humano | High | Aprobada | Global |
| RN-ESC-04 | Reintento/respaldo de notificación al personal | Escalamiento Humano | High | Aprobada | Global |
| RN-NOT-01 | Confirmación automática de cita | Notificaciones | Medium | Aprobada | Global |
| RN-NOT-02 | Recordatorio automático de cita | Notificaciones | Medium | Aprobada | Global |
| RN-NOT-03 | Contenido de cortesía configurable | Notificaciones | Medium | Aprobada | Global |
| RN-NOT-04 | Vigencia de la cortesía en el recordatorio | Notificaciones | Medium | Aprobada | Global |
| RN-NOT-05 | Registro de fallos sin reintento indefinido | Notificaciones | Medium | Aprobada | Global |
| RN-SUC-01 | Configuración propia por sucursal | Sucursales y Configuración | Medium | Aprobada | Por sucursal |
| RN-SUC-02 | Modo mantenimiento | Sucursales y Configuración | High | Aprobada | Global o por sucursal |
| RN-SUC-03 | Comportamiento hacia la clienta en modo mantenimiento | Sucursales y Configuración | Medium | Aprobada | Global |
| RN-SUC-04 | Un calendario de Google por sucursal | Sucursales y Configuración | Medium | Supuesto de trabajo, parcialmente informado — modelo técnico sin confirmar | Por sucursal (supuesto, sin confirmar el modelo técnico exacto) |
| RN-SEG-01 | 7 roles con capacidades delimitadas | Identidad, Accesos y Seguridad | High | Aprobada | Global |
| RN-SEG-02 | MFA obligatorio para roles críticos | Identidad, Accesos y Seguridad | Critical | Aprobada | Global |
| RN-SEG-03 | Alcance de sucursales para Analista y Solo lectura | Identidad, Accesos y Seguridad | Critical | Aprobada | Global |
| RN-SEG-04 | Manicurista-recurso ≠ Usuario-manicurista | Identidad, Accesos y Seguridad | Medium | Aprobada (supuesto de trabajo) | Global |
| RN-AUD-01 | Registro permanente no editable | Auditoría y Cumplimiento | Critical | Aprobada | Global |
| RN-AUD-02 | Marco regulatorio de datos personales aplicable | Auditoría y Cumplimiento | Por definir | Faltante — bloquea plazos de retención | Global |
| RN-REP-01 | Indicadores reflejan operación real | Reportes / Analítica | Low | Aprobada | Global |
| RN-REP-02 | Costo de IA con el mismo detalle que indicadores de negocio | Reportes / Analítica | Low | Aprobada | Global |

**Total: 73 reglas** (71 Aprobadas, Aprobadas-con-matiz o Parcialmente aprobadas; 2 Faltantes sin confirmar: `RN-AUD-02` pendiente de validación jurídica formal, `RN-CONV-08` pendiente de umbral exacto — la Dueña la aplazó explícitamente). **Actualizado 2026-08-04** tras la propagación de `DISCOVERY_CHECKLIST.md` (Paso 3 del roadmap de propagación, `MASTER_PROPAGATION_PLAN.md`) — esta tabla no se había sincronizado con los archivos individuales de reglas hasta esta corrección; los 12 archivos de categoría (`01-agenda.md`...`12-reportes.md`) siempre fueron la fuente correcta, esta tabla solo reflejaba un estado anterior.
