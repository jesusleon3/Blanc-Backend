# ADR-013

## Title
Manejo de errores: errores de dominio tipados, resiliencia por circuit breaker en integraciones externas, degradación a escalamiento humano

## Status
Proposed — pendiente de aprobación del cliente

## Context
Blanc depende de tres integraciones externas con distinto perfil de riesgo (WhatsApp, ADR-008; IA, ADR-007; Google Calendar, ADR-006), además de reglas de negocio propias que pueden rechazar una operación de forma esperada (ej. "no hay disponibilidad", "clienta bloqueada"). El principio de IA ya establecido exige que, ante ambigüedad o fallo, el sistema escale a un humano en vez de "adivinar".

## Problem Statement
¿Cómo se distinguen y manejan los distintos tipos de error (regla de negocio esperada, fallo de integración externa, error de programación inesperado) de forma consistente en todo el sistema, y cómo se evita que el fallo de una integración externa derribe funcionalidad que no depende de ella?

## Constraints
- Los errores de negocio (ej. "horario no disponible") son esperados y deben comunicarse con un código de negocio identificable, no como un error genérico.
- Los fallos de integración externa (timeout, indisponibilidad) no deben propagarse como fallos catastróficos si existe un camino de degradación razonable (ej. escalar a humano).
- Los errores de programación inesperados deben fallar de forma ruidosa (loggeados, alertados), nunca silenciada.
- Debe ser posible para la capa de IA (ADR-007) y la capa de API (ADR-014) reaccionar de forma distinta según el tipo de error.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Manejo genérico de excepciones con error 500 uniforme | Cualquier fallo se captura y responde de forma genérica, sin distinción de causa. |
| B. Tres categorías explícitas de error (dominio, integración externa, inesperado) con manejo diferenciado, incluyendo circuit breaker por dependencia externa | Cada categoría tiene un contrato y una estrategia de manejo propia. |
| C. Dejar el manejo de errores al comportamiento por defecto del framework elegido | Sin una convención propia del proyecto, se usa lo que el framework técnico ofrezca de fábrica. |

## Decision
Se adopta la **Opción B**. Se definen tres categorías:
1. **Errores de dominio** (violación de una regla de negocio esperada, ej. "horario no disponible", "clienta en lista roja requiere aprobación") — se modelan como resultados/excepciones tipadas con código de negocio identificable, no como error HTTP genérico.
2. **Errores de integración externa** (WhatsApp, Google Calendar, OpenAI) — se gestionan con reintentos con backoff exponencial y un **circuit breaker por dependencia externa**, para que el fallo de una integración no derribe funcionalidad que no depende de ella (ej. un fallo de Google Calendar no debe impedir confirmar una cita). Cuando el circuito abre para IA, el flujo degrada a escalamiento humano (ADR-016), no a un intento de continuar sin IA.
3. **Errores inesperados/de programación** — se registran con contexto completo (correlacionados vía ADR-011), generan alerta, y nunca se capturan silenciosamente.

Todos los errores se correlacionan con el ID de correlación de observabilidad (ADR-011).

## Consequences
Se obtiene un sistema donde el tipo de fallo determina la respuesta correcta (reintentar, degradar, escalar, o simplemente informar una regla de negocio), a cambio de mayor disciplina de diseño en cada caso de uso para clasificar correctamente sus errores.

### Positive Consequences
- La capa de IA y la capa de API pueden reaccionar de forma distinta y correcta según el tipo de error (ej. "no hay disponibilidad" se puede comunicar de forma natural en la conversación; un fallo de programación no debería intentar comunicarse "de forma natural", debe escalar).
- El circuit breaker evita fallos en cascada: una integración externa caída no debería tumbar todo el sistema.
- Los errores de negocio quedan documentados con códigos identificables, útiles tanto para el frontend como para la auditoría.

### Negative Consequences
- Requiere disciplina de clasificación de errores en cada caso de uso — más trabajo que capturar y responder genéricamente.
- El circuit breaker añade estado (abierto/cerrado/medio-abierto) que debe monitorearse (ADR-011) para no quedar "atascado" abierto sin que nadie lo note.

## Risks
- **Clasificación incorrecta de errores** (ej. tratar un fallo de programación como error de negocio) ocultaría bugs reales tras un mensaje de negocio aparentemente normal. Mitigación: revisión de código explícita sobre el tipo de error usado en cada caso de uso.
- **Circuit breaker mal calibrado** (umbral muy sensible o muy laxo) podría degradar el sistema innecesariamente o no proteger a tiempo. Mitigación: umbrales configurables y revisables con datos reales de producción, no fijos de forma permanente.

## Alternatives Rejected
- **Manejo genérico de excepciones con error uniforme**: rechazado. No permite que la capa de IA distinga entre "la clienta pidió algo que las reglas de negocio no permiten" (debe comunicarse con naturalidad) y "algo se rompió" (debe escalar), lo cual contradice directamente el principio de degradación a escalamiento humano.
- **Dejar el manejo de errores al comportamiento por defecto del framework**: rechazado. No daría la distinción de categorías que el sistema necesita, y dejaría la decisión de resiliencia (reintentos, circuit breaker) sin una estrategia propia coherente entre las tres integraciones externas de distinto riesgo.

## Future Revisit Criteria
- Datos reales de producción muestran que los umbrales de circuit breaker o de reintento no son adecuados para el patrón de fallo real observado.
- Se identifica un cuarto tipo de error que no encaja bien en las tres categorías definidas.
