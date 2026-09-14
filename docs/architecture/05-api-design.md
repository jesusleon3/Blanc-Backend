# Diseño de API — Blanc

> **Fuentes:** `docs/architecture/02-architecture-principles.md` §10 (Principios para APIs), `docs/architecture/adr/ADR-010-security-rbac-jwt-audit.md`, `docs/architecture/adr/ADR-013-error-handling-strategy.md`, `docs/architecture/adr/ADR-014-api-versioning-strategy.md`, `docs/architecture/adr/ADR-021-idempotency-concurrency-strategy.md`, `03-technical-architecture.md` §3.9/§5.1-5.2, `04-data-model.md` §4.2, `ARCHITECTURE_CLOSURE_PLAN.md` (`P1`, `P8`), `IMPLEMENTATION_MASTER_PLAN.md` (Enmienda 2026-08-04, Arranque parcial controlado).
> **Estado:** Borrador v0.1 — **alcance deliberadamente parcial.** Este documento define únicamente las convenciones transversales necesarias para iniciar Sucursales y Personal, Identidad y Accesos, y Catálogo y Cotización, consistente con la Enmienda 2026-08-04 de `IMPLEMENTATION_MASTER_PLAN.md`. **No contiene** contratos específicos de endpoint para ningún módulo — ni siquiera para los tres módulos habilitados por esa enmienda. Los contratos de Agenda, Conversación, WhatsApp, Notificaciones, Sincronización de Calendario y Garantías quedan explícitamente fuera de alcance, reservados a su fase correspondiente (`IMPLEMENTATION_MASTER_PLAN.md` §11, mismo principio ya aplicado a Decision Flows: "módulo por módulo, justo antes de implementarlo").
> **Regla de gobernanza (heredada de `03`/`04`, sin cambios):** ante un vacío de decisión o una alternativa técnicamente válida sin cerrar, este documento no decide unilateralmente — se marca explícitamente `Decision Pending`, citando qué falta y quién debe resolverlo. Ninguna convención de este documento inventa un requisito no sustentado por la arquitectura ya congelada.

---

## 0. Qué cierra este documento y qué no

**Cierra (Fase 0, parcial):** las convenciones transversales que los tres módulos del arranque parcial controlado necesitan compartir desde su primer endpoint, para no retrofitear un formato de error, un esquema de claims o una convención de idempotencia después de que los tres ya estén construidos — exactamente el riesgo que `ADR-014` ya advierte.

**No cierra:** ningún contrato de request/response específico de un caso de uso. Eso depende de que cada Decision Flow correspondiente esté redactado en detalle (`IMPLEMENTATION_MASTER_PLAN.md` §11), y se hace módulo por módulo.

---

## 1. Versionado de API

**Firme — heredado de `ADR-014`, sin reabrir.** Toda la API (interna y, en el futuro, pública) se versiona por URI desde el primer endpoint: prefijo `/v1`. `ADR-014` ya establece que la API interna (consumida por el frontend/plataforma) y una futura API pública son contratos distintos aunque compartan implementación al inicio — este documento no diseña la API pública, solo dejar el prefijo de versión ya presente evita una migración de ruta después.

---

## 2. Formato estándar de errores (alineado con `ADR-013`)

**Firme en su estructura general — realización concreta de un principio ya aprobado**, no una decisión nueva: `ADR-013` ya exige tres categorías de error (dominio, integración externa, inesperado) y el principio 10.5 (`02-architecture-principles.md`) ya exige "formato de error consistente y semántico... códigos de negocio identificables, no solo códigos HTTP genéricos."

Forma del cuerpo de error, para las tres categorías:

```json
{
  "error": {
    "category": "domain | integration | unexpected",
    "code": "HORARIO_NO_DISPONIBLE",
    "message": "El horario solicitado ya no está disponible.",
    "correlationId": "uuid",
    "details": {}
  }
}
```

- `category`: una de las tres de `ADR-013`, sin excepción.
- `code`: código de negocio identificable, estable entre versiones — el mecanismo concreto por el que la IA (`ADR-007`) y el frontend distinguen "no hay disponibilidad" de "clienta bloqueada" sin parsear el mensaje en lenguaje natural.
- `message`: texto legible, en español (consistente con el lenguaje ubicuo, principio 2 de `02-architecture-principles.md`), nunca la única fuente de verdad del tipo de error.
- `correlationId`: el mismo identificador de correlación de extremo a extremo que `ADR-011`/`03` §6.1 ya exigen — presente en todo error para poder cruzarlo con logs/trazas.
- `details`: objeto libre, opcional, solo para contexto adicional no sensible.

**`Decision Pending` — catálogo exhaustivo de `code` por Rule ID.** Este documento no enumera aquí todos los códigos de error posibles (ej. `HORARIO_NO_DISPONIBLE`, `CLIENTA_BLOQUEADA`, `ANTICIPO_REQUERIDO`) — depende de que cada módulo defina sus propios códigos al redactar su contrato específico, consistente con el alcance parcial declarado en la Sección 0. Se fija aquí solo la **forma** del error, no su contenido módulo por módulo.

---

## 3. Convenciones generales de request/response

- Cuerpos de request/response en JSON (`Content-Type: application/json`), sin excepción salvo endpoints de subida de archivos (fuera de alcance de esta fase — Storage/imágenes es Fase 4).
- Fechas/horas en el cuerpo de la API: **`Decision Pending`** — `04-data-model.md` §4.6 ya fija `timestamptz` en UTC como convención de persistencia, pero ningún documento decide si la API expone ISO 8601 en UTC directamente o ya convertido a hora local de sucursal. Recomendación no vinculante: exponer UTC y dejar la conversión a hora local en la capa de presentación (mismo principio 11.5 ya aplicado a persistencia) — se marca `Decision Pending` porque no hay una fuente que lo cierre explícitamente para la capa de API.
- **`Decision Pending` — convención de nombres de campo (camelCase vs. snake_case).** El lenguaje ubicuo en español ya rige los nombres de conceptos de dominio (`Cita`, `Clienta`) — ningún documento decide el formato de serialización de los campos JSON en sí. No se asume ninguno de los dos.
- Paginación de listados: **`Decision Pending`** — ningún documento define el mecanismo (cursor vs. offset) porque ningún endpoint específico se ha diseñado todavía en esta pasada.

---

## 4. Autenticación

**Firme — `ADR-010`, con el proveedor ya cerrado en `P1` (Supabase Auth).** Todo endpoint autenticado exige un `access token` JWT de vida corta en el encabezado `Authorization: Bearer <token>`, con rotación de `refresh token` gestionada por el flujo que Supabase Auth provee. **Recordatorio de lo ya registrado en `P1`:** la elección del proveedor está cerrada; la validación en producción de la rotación con detección de reuso sigue pendiente como tarea de esta misma fase (`ARCHITECTURE_CLOSURE_PLAN.md`), no bloquea diseñar el contrato de autenticación en sí.

---

## 5. Autorización / RBAC

**Firme — `ADR-010`, principio 12.1.** Dos niveles, sin excepción: (1) middleware grueso, que rechaza por rol/endpoint antes de llegar al caso de uso; (2) revalidación fina dentro del caso de uso de dominio, con el mismo dato de claims, como defensa en profundidad — ninguno de los dos niveles sustituye al otro.

---

## 6. Forma de los claims de rol y sucursal

**Parcialmente firme.** El JWT lleva, como mínimo: `rol` (uno de los 7 roles ya enumerados en `RN-SEG-01`) y `sucursales` (lista de identificadores de sucursal a la que el usuario tiene alcance, o un valor que represente alcance global).

- **Ya resuelto:** para los roles Analista y Solo lectura, ausencia de asignación explícita = alcance global (`RN-SEG-03`, `P2` de `ARCHITECTURE_CLOSURE_PLAN.md`).
- **`Decision Pending` — comportamiento por defecto para el resto de los roles** (Recepcionista, Gerente, Administrador, Manicurista) cuando no tienen filas en `usuarios_sucursales`. Esta es una decisión de negocio, no técnica — ya registrada como Pregunta 11 en `OWNER_DECISION_LOG.md`. Este documento no la asume; el middleware y la revalidación de la Sección 5 deben tratarse como incompletos para esos roles hasta que se responda.
- Super Admin: se asume alcance global implícito por definición de rol (consistente con `RN-SEG-01`), sin necesitar el arreglo `sucursales`.

---

## 7. Transmisión y tratamiento de idempotency keys

**Firme en la transmisión, `Decision Pending` en el almacenamiento.** Todo endpoint con efecto de estado (`ADR-021`) exige un encabezado `Idempotency-Key`, provisto por el llamador o derivado de forma determinista del evento de origen (ej. ID de mensaje de WhatsApp, fuera de alcance de los tres módulos de esta fase). Un reintento con la misma clave debe devolver el mismo resultado ya producido, sin re-ejecutar el efecto.

**`Decision Pending` heredado, no nuevo aquí:** `04-data-model.md` §4.2 ya deja sin cerrar si el almacén de claves de idempotencia es una tabla compartida en un esquema transversal o una tabla por esquema de Bounded Context — este documento no lo resuelve, solo fija que la clave viaja en ese encabezado sin importar dónde se guarde.

**Estado real de implementación (Sucursales y Personal, hardening transversal 2026-08-11) — para que ningún módulo futuro asuma lo contrario por lectura de este documento:** el código de este módulo **no lee ni aplica** el encabezado `Idempotency-Key` en ningún endpoint — la exigencia de este párrafo es, hoy, únicamente contractual/documental, no una garantía real. Decisión explícita tomada en ese hardening: no implementar deduplicación por clave en este módulo. Razón — sus mutaciones son mayormente auto-protegidas por otros medios (restricciones UNIQUE traducidas a `ConflictoDeNegocioError`, o naturalmente idempotentes por diseño como activar/desactivar mantenimiento), con una excepción conocida: `POST .../dias-festivos` **no** tiene protección alguna contra duplicados por reintento (podría crear dos días festivos idénticos). La implementación real de este mecanismo se difiere a Agenda/Citas (Fase 2), donde el doble-booking hace que la deduplicación sea genuinamente crítica — implementarla aquí primero habría sido resolver el problema donde menos importa.

---

## 8. Validación de entrada

**Firme — consecuencia directa de `ADR-002`/`ADR-021`.** Toda entrada se valida contra un esquema explícito en el borde de la API (DTO de la capa de aplicación, Vertical Slice por caso de uso, `02-architecture-principles.md` §4) antes de tocar cualquier lógica de dominio — mismo principio que `ADR-007`/`ADR-002` ya exigen para la salida estructurada de la IA, aplicado aquí a cualquier entrada HTTP. Una entrada inválida devuelve `400` con el formato de la Sección 2, `category: "domain"`, antes de invocar el caso de uso.

---

## 9. Códigos HTTP y traducción de errores de dominio

Mapeo general, consistente con las tres categorías de `ADR-013` — sin enumerar códigos de negocio específicos (Sección 2):

| Categoría (`ADR-013`) | HTTP típico | Ejemplo de uso |
|---|---|---|
| Dominio (validación de entrada) | `400` | Payload malformado, campo requerido faltante |
| Dominio (regla de negocio violada) | `409` o `422` — **`Decision Pending`** cuál de los dos por defecto | "Horario no disponible", "clienta bloqueada" |
| Autenticación/Autorización | `401` / `403` | Token inválido/expirado; rol sin permiso |
| No encontrado | `404` | Recurso inexistente |
| Integración externa (`ADR-013` categoría 2) | `502` / `503` | Circuit breaker abierto para una dependencia externa |
| Inesperado (`ADR-013` categoría 3) | `500` | Cualquier error no capturado explícitamente |

**`Decision Pending` explícito:** si una violación de regla de negocio (ej. intento de doble-booking) debe devolver `409 Conflict` o `422 Unprocessable Entity` por defecto — ningún documento fija esto; se decide caso por caso al redactar el contrato específico de cada módulo, o se cierra aquí más adelante si aparece un criterio transversal claro.

---

## 10. Convenciones de nombres

Propuesta de este documento (bajo riesgo, reversible, sin dependencia de información no confirmada — criterio de cierre firme ya usado en `03-technical-architecture.md`): rutas en minúsculas, en español (consistente con el lenguaje ubicuo), agrupadas por Bounded Context, siguiendo los mismos nombres de esquema ya fijados en `04-data-model.md` §3:

```
/v1/sucursales-y-personal/...
/v1/identidad-y-accesos/...
/v1/catalogo-y-cotizacion/...
```

Recursos en plural, verbos HTTP estándar (`GET`/`POST`/`PATCH`/`DELETE`), sin verbos en la ruta salvo para acciones que no mapean a una operación CRUD directa (ej. una activación de modo mantenimiento), consistente con `RN-SUC-02`.

**Inconsistencia detectada y confirmada contra el código (hardening transversal 2026-08-11), no resuelta aquí — no es una decisión de negocio, pero tampoco un cambio autorizado en este hardening (no se tocan rutas de Sucursales y Personal, ver alcance de esa fase):** RN-SUC-02 (modo mantenimiento) hoy se expone por **dos** superficies HTTP distintas para la misma pareja de casos de uso (`ActivarModoMantenimientoUseCase`/`DesactivarModoMantenimientoUseCase`, que ya aceptan un `sucursalId` opcional para cubrir ambos casos):
- `POST /v1/sucursales-y-personal/sucursales/:id/activar-mantenimiento` (alcance de una sucursal)
- `POST /v1/sucursales-y-personal/mantenimiento/activar-global` (alcance global, controlador separado)

Dos convenciones de nombres de ruta para una sola operación parametrizada por alcance — funcionalmente correcto (ambas prueban en E2E), pero no es el patrón que un módulo nuevo debería copiar sin decidir conscientemente cuál convención seguir. Candidato a limpieza de bajo riesgo cuando se toque este módulo de nuevo; no bloquea Identidad.

---

## 11. Principios de compatibilidad y evolución de contratos

**Firme — `02-architecture-principles.md` §10.2/10.3, `ADR-014`.** La API interna y una futura API pública son contratos distintos aunque compartan implementación hoy — no se diseña la interna asumiendo que nunca la consumirá un tercero, ni se expone la interna tal cual como "la pública" el día que se necesite. Ningún cambio que rompa compatibilidad se hace sin subir de versión (`/v1` → `/v2`), consistente con que el cliente ya pidió una API pública futura para integraciones con POS/inventario.

---

## 12. Explícitamente fuera de alcance de este documento (en esta pasada)

- Autenticación de servicio a servicio para webhooks entrantes (WhatsApp, Google Calendar) — principio 10.6, relevante desde Fase 4, no antes.
- Rate limiting por identidad del llamador — principio 10.7, sin números ni prioridad definidos todavía, no bloquea los tres módulos de esta fase.
- Cualquier contrato de endpoint específico de Agenda, Conversación, Anticipos, CRM, Notificaciones, Sincronización de Calendario o Garantías.
- Contratos de la futura API pública (POS/inventario) — mencionada como intención en `02-architecture-principles.md` §10.2, sin diseño propio todavía.

---

## 13. `Decision Pending` — resumen para revisión

| # | Punto | Sección | Quién debe resolverlo |
|---|---|---|---|
| 1 | Formato de fecha/hora expuesto por la API (UTC directo vs. convertido) | §3 | Arquitectura |
| 2 | Convención de nombres de campo JSON (camelCase vs. snake_case) | §3 | Arquitectura |
| 3 | Mecanismo de paginación | §3 | Arquitectura (al diseñar el primer endpoint de listado) |
| 4 | Alcance por defecto de `usuarios_sucursales` para roles distintos de Analista/Solo lectura | §6 | **Dueña** — ya en `OWNER_DECISION_LOG.md`, Pregunta 11 |
| 5 | Ubicación del almacén de idempotencia (heredado, no nuevo) | §7 | Arquitectura — `04-data-model.md` §4.2 |
| 6 | `409` vs. `422` por defecto para violaciones de regla de negocio | §9 | Arquitectura |

Ninguno de estos seis puntos bloquea a Sucursales, Identidad o Catálogo — son matices que se cierran durante la implementación de cada endpoint concreto, no antes.
