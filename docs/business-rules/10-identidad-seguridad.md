# Categoría: Identidad, Accesos y Seguridad (`RN-SEG`)

> Gobierna roles, permisos y control de acceso al panel administrativo.

---

### RN-SEG-01 — 7 roles con capacidades delimitadas

| Campo | Valor |
|---|---|
| Rule ID | RN-SEG-01 |
| Nombre | 7 roles con capacidades estrictamente delimitadas |
| Objetivo | Que cada persona del negocio tenga acceso exactamente a lo que su función requiere, ni más ni menos. |
| Descripción | El sistema define 7 roles: Super Admin, Administrador, Gerente, Recepcionista, Manicurista, Analista y Solo lectura, cada uno con capacidades estrictamente delimitadas. |
| Categoría | Identidad, Accesos y Seguridad |
| Alcance | Global |
| Disparador | Alta de un usuario interno. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Rol asignado al usuario. |
| Lógica de negocio | Un rol nunca tiene acceso a capacidades fuera de lo que su definición establece. |
| Resultado esperado | Ningún usuario accede a funciones fuera de su rol asignado. |
| Ejemplos | `functional-scope.md` §2 detalla exactamente qué puede hacer cada uno de los 7 roles. |
| Excepciones | Ninguna conocida sobre el catálogo en sí — ver `RN-SEG-03` para el alcance de sucursales de Analista/Solo lectura. |
| Prioridad | High |
| Consumidores | Backend, Administrador, QA |
| Dependencias | Es dependencia de: RN-SEG-02, RN-AUD-01 |
| Fuente | `01-domain-discovery.md` §5.8; `functional-scope.md` §2 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | Bajo el modelo Silo de expansión SaaS (ADR-009), este catálogo de roles es dato de la instancia de Blanc, no estructura compartida — un futuro cliente tendría su propio catálogo. |

---

### RN-SEG-02 — MFA obligatorio para roles críticos

| Campo | Valor |
|---|---|
| Rule ID | RN-SEG-02 |
| Nombre | MFA obligatorio para roles con permisos administrativos críticos |
| Objetivo | Reducir el riesgo de acceso indebido a funciones críticas del sistema. |
| Descripción | Los roles con permisos administrativos críticos requieren verificación adicional de identidad (MFA), no solo usuario y contraseña. |
| Categoría | Identidad, Accesos y Seguridad |
| Alcance | Global |
| Disparador | Inicio de sesión de un usuario con rol crítico. |
| Precondiciones | El rol del usuario está clasificado como crítico. |
| Entradas requeridas | Rol del usuario, estado de MFA habilitado. |
| Lógica de negocio | Si el rol es crítico y MFA no está habilitado → bloquear o forzar configuración de MFA antes de continuar. |
| Resultado esperado | Ningún rol crítico opera sin verificación adicional de identidad. |
| Ejemplos | Sin ejemplo específico en el mockup — regla de arquitectura de seguridad (ADR-010). |
| Excepciones | Ninguna conocida. |
| Prioridad | Critical |
| Consumidores | Backend, Seguridad |
| Dependencias | Depende de: RN-SEG-01 |
| Fuente | ADR-010 (Seguridad: RBAC, JWT, Audit Logs) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-SEG-03 — Alcance de sucursales para Analista y Solo lectura

| Campo | Valor |
|---|---|
| Rule ID | RN-SEG-03 |
| Nombre | Alcance de sucursales para Analista y Solo lectura |
| Objetivo | Cerrar el modelo de permisos completo definiendo el alcance de sucursales para Analista y Solo lectura. |
| Descripción | Confirmado: alcance **global** — Analista y Solo lectura ven todas las sucursales, no solo las asignadas explícitamente. |
| Categoría | Identidad, Accesos y Seguridad |
| Alcance | Global |
| Disparador | Un usuario con rol Analista o Solo lectura consulta información. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Rol del usuario. |
| Lógica de negocio | Si `rol IN (Analista, Solo lectura)` → el alcance de consulta es todas las sucursales, sin filtro de `usuarios_sucursales`. |
| Resultado esperado | Ningún usuario Analista o Solo lectura queda limitado a un subconjunto de sucursales. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.26 (2026-08-04): *"Todas las sucursales."* |
| Excepciones | Ninguna. |
| Prioridad | Critical |
| Consumidores | Backend, Administrador, QA |
| Dependencias | Depende de: RN-SEG-01 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #11; `DISCOVERY_CHECKLIST.md` 1.26 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | Resuelve `PA-19`, ya señalada como la pregunta de mayor impacto estructural del proyecto, y con ella el Pendiente P2 de `ARCHITECTURE_CLOSURE_PLAN.md` (actualizar ese documento queda fuera de alcance de esta propagación — Paso 3 no lo toca). Respuesta contraria a la recomendación conservadora original (alcance por sucursal), pero clara e inequívoca. |

---

### RN-SEG-04 — Manicurista-recurso ≠ Usuario-manicurista

| Campo | Valor |
|---|---|
| Rule ID | RN-SEG-04 |
| Nombre | El recurso agendable "Manicurista" no es la misma entidad que el "Usuario" con rol Manicurista |
| Objetivo | Evitar acoplar el ciclo de vida de un recurso agendable al de una cuenta de acceso al sistema. |
| Descripción | "Manicurista" como recurso agendable (Agenda) y "Usuario con rol Manicurista" (acceso a la plataforma) se modelan como dos conceptos distintos, vinculados por referencia opcional — no toda manicurista necesita tener login. |
| Categoría | Identidad, Accesos y Seguridad |
| Alcance | Global |
| Disparador | Alta o baja de una manicurista. |
| Precondiciones | Ninguna. |
| Entradas requeridas | Registro de recurso agendable, registro de usuario (si existe). |
| Lógica de negocio | Dar de baja el recurso agendable no implica necesariamente dar de baja una cuenta de usuario, y viceversa. |
| Resultado esperado | El sistema puede operar con manicuristas que nunca usan la plataforma directamente. |
| Ejemplos | En el mockup, `manicuristas` (registro administrativo) y `usuarios` con rol Manicurista son colecciones separadas, vinculadas por nombre/sucursal. |
| Excepciones | Ninguna conocida. |
| Prioridad | Medium |
| Consumidores | Backend |
| Dependencias | Relacionada con: RN-AGE-03, RN-AGE-04, RN-SEG-01 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #2 (supuesto de trabajo) |
| Estado | Aprobada como supuesto de trabajo |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |
