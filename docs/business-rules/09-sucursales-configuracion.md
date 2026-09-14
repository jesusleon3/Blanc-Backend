# Categoría: Sucursales y Configuración (`RN-SUC`)

> Gobierna la configuración operativa por sucursal y los mecanismos de control general del sistema.

---

### RN-SUC-01 — Configuración propia por sucursal

| Campo | Valor |
|---|---|
| Rule ID | RN-SUC-01 |
| Nombre | Configuración propia por sucursal |
| Objetivo | Permitir que cada sucursal opere con sus propias condiciones sin afectar a las demás. |
| Descripción | Cada sucursal tiene su propio horario, festivos, personal y número de atención por WhatsApp. |
| Categoría | Sucursales y Configuración |
| Alcance | Por sucursal |
| Disparador | Configuración inicial de una sucursal o modificación por un administrador. |
| Precondiciones | Rol con permiso de configuración (`RN-SEG-01`). |
| Entradas requeridas | Horario semanal, festivos, personal asignado, número de WhatsApp. |
| Lógica de negocio | Toda configuración operativa vive scoped por sucursal, sin afectar a otras sucursales. |
| Resultado esperado | Cada sucursal opera de forma independiente en su configuración. |
| Ejemplos | Blanc Polanco, Blanc Condesa y Blanc Santa Fe, cada una con su propio número de WhatsApp y horario. |
| Excepciones | Ninguna conocida. |
| Prioridad | Medium |
| Consumidores | Backend, Administrador |
| Dependencias | Es dependencia de: RN-AGE-10 |
| Fuente | `01-domain-discovery.md` §5.7 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-SUC-02 — Modo mantenimiento

| Campo | Valor |
|---|---|
| Rule ID | RN-SUC-02 |
| Nombre | Modo mantenimiento |
| Objetivo | Permitir pausar la atención automática de forma controlada sin perder información. |
| Descripción | El modo de mantenimiento detiene la atención automática de una sucursal o de todas, de forma reversible, sin afectar la información ya registrada. |
| Categoría | Sucursales y Configuración |
| Alcance | Global o por sucursal (configurable) |
| Disparador | Acción explícita de un Super Administrador. |
| Precondiciones | Rol Super Admin. |
| Entradas requeridas | Alcance del mantenimiento (una sucursal o todas). |
| Lógica de negocio | Al activarse → detener respuestas automáticas del bot en el alcance definido, sin borrar ni alterar datos existentes; reversible al desactivarse. |
| Resultado esperado | La atención automática se pausa de forma segura y reversible. |
| Ejemplos | `aud-6` en el mockup: "Karla Espinoza activó el modo mantenimiento para Blanc Condesa por 40 minutos." |
| Excepciones | Comportamiento hacia una clienta que escribe durante el mantenimiento no está definido (ver `RN-SUC-03`). |
| Prioridad | High |
| Consumidores | Backend, Super Admin |
| Dependencias | Relacionada con: RN-CONV-01, RN-CONV-05. Es dependencia de: RN-SUC-03 |
| Fuente | `01-domain-discovery.md`, caso de uso de modo mantenimiento; `functional-scope.md` §3.8 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-SUC-03 — Comportamiento hacia la clienta en modo mantenimiento

| Campo | Valor |
|---|---|
| Rule ID | RN-SUC-03 |
| Nombre | Comportamiento hacia la clienta durante modo mantenimiento |
| Objetivo | Evitar que una clienta quede sin ninguna respuesta durante el modo mantenimiento. |
| Descripción | No hay mensaje automático del bot, pero la clienta **es atendida manualmente por el personal** — no es silencio absoluto. |
| Categoría | Sucursales y Configuración |
| Alcance | Global |
| Disparador | Una clienta escribe mientras el modo mantenimiento está activo. |
| Precondiciones | `RN-SUC-02` (modo mantenimiento) está activo para esa sucursal. |
| Entradas requeridas | Estado del modo mantenimiento. |
| Lógica de negocio | El bot no responde automáticamente; el mensaje queda disponible para que el personal lo atienda manualmente. |
| Resultado esperado | Ninguna clienta queda sin respuesta durante el modo mantenimiento, aunque la respuesta no sea automática. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.24 (2026-08-04): *"Nada, el modo mantenimiento es se maneja todo manual."* |
| Excepciones | Ninguna conocida. |
| Prioridad | Medium |
| Consumidores | Backend, Recepción |
| Dependencias | Depende de: RN-SUC-02 |
| Fuente | `functional-scope.md` §3.8, Restricciones; `DISCOVERY_CHECKLIST.md` 1.24 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | 2026-08-03 |
| Notas | **Interpretación explícita (2026-08-04):** la redacción de la Dueña es algo ambigua ("Nada... se maneja todo manual") — se interpreta como "sin mensaje automático del bot, pero atendida manualmente por el personal", evitando el silencio total que `ADR-012` ya advertía como riesgo. Se recomienda confirmación literal en una próxima reunión si hay oportunidad; no bloquea avanzar con esta interpretación. |

---

### RN-SUC-04 — Un calendario de Google por sucursal

| Campo | Valor |
|---|---|
| Rule ID | RN-SUC-04 |
| Nombre | Un calendario de Google por sucursal |
| Objetivo | Mantener la vista operativa de Google Calendar organizada de forma consistente con la estructura de sucursales. |
| Descripción | **Parcialmente respondido.** Confirmado: las sucursales se diferencian por color en Google Calendar. **No confirmado:** si esa diferenciación de color significa un calendario de Google *independiente* por sucursal (el supuesto ya adoptado en esta regla), o si es un único calendario *compartido* con eventos coloreados internamente por sucursal — son dos modelos técnicos distintos. |
| Categoría | Sucursales y Configuración |
| Alcance | Por sucursal (supuesto, sin confirmar el modelo técnico exacto) |
| Disparador | Sincronización de una cita hacia Google Calendar. |
| Precondiciones | La sucursal tiene un calendario de Google configurado. |
| Entradas requeridas | Sucursal de la cita, identificador del calendario de Google correspondiente. |
| Lógica de negocio | **Sin cambio hasta confirmar el modelo técnico:** toda cita se sincroniza únicamente con el calendario (o la vista coloreada) de su propia sucursal. |
| Resultado esperado | Cada sucursal tiene su propia vista de calendario, sin mezclar citas de otras sucursales — el mecanismo técnico exacto queda pendiente. |
| Ejemplos | `DISCOVERY_CHECKLIST.md` 1.25 (2026-08-04): *"Se diferencia por colores para mostrar las diferentes sucursales."* |
| Excepciones | Modelo técnico exacto no confirmado — requiere repregunta puntual: *"¿Cada sucursal tiene su propio calendario de Google, o todas comparten un mismo calendario y el color solo las distingue visualmente dentro de él?"* |
| Prioridad | Medium |
| Consumidores | Backend |
| Dependencias | Relacionada con: RN-AGE-09 |
| Fuente | `01-domain-discovery.md` Pregunta Abierta #14; `DISCOVERY_CHECKLIST.md` 1.25 |
| Estado | Supuesto de trabajo, parcialmente informado — modelo técnico sin confirmar |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | Riesgo medio si se asume "un calendario por sucursal" y el modelo real es "uno solo": el esquema de sincronización uno-a-uno debe rediseñarse antes de Fase 4. No se cierra el Estado a Aprobada hasta resolver esta ambigüedad. |
