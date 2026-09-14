# ADR-007

## Title
OpenAI como proveedor de IA para interpretación conversacional (no para decisiones de negocio)

## Status
Proposed — pendiente de aprobación del cliente

## Context
El cliente respondió explícitamente en el descubrimiento de negocio: *"Yo usaría GPT únicamente para entender intención y conversación. Y toda la lógica de negocio por código."* Esto ya es una decisión de negocio tomada, no abierta. El rol arquitectónico de este ADR es formalizarla, justificarla técnicamente, y dejar explícito cómo se mitiga el riesgo de dependencia de un solo proveedor ya identificado en el Domain Discovery.

## Problem Statement
¿Qué proveedor de modelo de lenguaje se usa para la capa de interpretación conversacional, y cómo se diseña esa integración para no acoplar el dominio a las particularidades de ese proveedor?

## Constraints
- El LLM solo interpreta lenguaje natural y sostiene conversación — nunca decide (ADR-002, principio "la IA interpreta, no decide").
- Se requiere salida estructurada confiable (function calling / structured output) para mapear lenguaje libre (ej. composición de servicio por uña) a datos validables por código, dado el riesgo de alucinación ya identificado.
- Se requiere soporte de lectura de imágenes (fotos de referencia de uñas), ya solicitado explícitamente por el cliente.
- No se requiere (por ahora) procesamiento de audio.
- El cliente ya expresó preferencia explícita por GPT sobre Claude o Gemini.

## Options Considered

| Opción | Descripción |
|---|---|
| A. OpenAI (Responses API / GPT) | Proveedor elegido explícitamente por el cliente; soporta salida estructurada, function calling y lectura de imágenes. |
| B. Anthropic Claude | Alternativa viable técnicamente (tool use, visión), no elegida por el cliente. |
| C. Google Gemini | Alternativa viable técnicamente, no elegida por el cliente. |
| D. Modelo propio/open-source autoalojado | Evita dependencia de un proveedor externo, a costa de operar infraestructura de inferencia propia. |

## Decision
Se adopta la **Opción A — OpenAI**, respetando la decisión explícita del cliente. Se usa **exclusivamente para interpretación conversacional**: comprensión de intención, extracción estructurada de composición de servicio, detección de sentimiento/intención de cancelación, lectura de imágenes de referencia. Ninguna llamada al modelo ejecuta directamente una acción de negocio — toda salida pasa por validación de esquema y por un caso de uso de dominio (ADR-002, ADR-021) antes de tener efecto.

## Consequences
Se obtiene una integración alineada con la decisión ya tomada por el cliente y con soporte técnico maduro para salida estructurada e imágenes, a cambio de aceptar una dependencia de un único proveedor externo para una función central del negocio, mitigada arquitectónicamente por el puerto de IA definido en ADR-002.

### Positive Consequences
- Soporte maduro de salida estructurada (function calling / structured output), que es el mecanismo concreto para mitigar el riesgo de alucinación en el cálculo de cotización.
- Soporte nativo de lectura de imágenes, requerido explícitamente por el cliente.
- Decisión ya validada por el cliente — no introduce fricción de aprobación adicional.
- Aislada detrás de un puerto (`ProveedorDeIA`, ADR-002), lo que permite instrumentar costo/latencia de forma uniforme sin acoplar el dominio al SDK específico.

### Negative Consequences
- Dependencia de un solo proveedor para una función central del negocio (riesgo ya identificado en el Domain Discovery): un cambio de pricing, disponibilidad o comportamiento del modelo afecta la operación completa.
- El costo de tokens no está acotado por naturaleza del proveedor — requiere control de costo activo (ADR-011, principio de gobernanza de costo).
- Cambios de comportamiento del modelo entre versiones (deprecaciones, actualizaciones silenciosas de modelo) pueden alterar la calidad de interpretación sin cambio de código propio.

## Risks
- **Dependencia de proveedor único** para una función crítica: mitigado arquitectónicamente (no eliminado) por el puerto `ProveedorDeIA` — permite introducir un proveedor de respaldo sin rediseñar el dominio, aunque hoy no se implementa un fallback multi-proveedor activo.
- **Alucinación en la extracción de composición de servicio**: mitigado por el requisito de salida estructurada obligatoria y validación de esquema antes de tocar el dominio (ADR-002, ADR-021).
- **Interrupción o degradación del servicio de OpenAI**: debe activar el flujo de degradación a escalamiento humano (ADR-016), no un intento de "adivinar" sin IA.
- **Costo variable no acotado**: mitigado por límites duros de gasto configurables (ADR-011), no solo por reporte posterior en el dashboard.

## Alternatives Rejected
- **Claude o Gemini**: técnicamente viables (ambos soportan salida estructurada y visión), pero rechazadas por ser contrarias a la decisión explícita ya tomada por el cliente en el descubrimiento de negocio. No se reabre esta decisión sin una razón de negocio nueva.
- **Modelo propio/open-source autoalojado**: rechazado. Requeriría operar infraestructura de inferencia (GPU, escalado, mantenimiento de modelo) totalmente desproporcionada frente a la escala del proyecto y al tamaño de equipo esperado — viola el principio de simplicidad proporcional.

## Future Revisit Criteria
- El costo real de OpenAI a escala de operación demostrada excede lo presupuestado de forma sostenida.
- Aparece un incidente de disponibilidad de OpenAI con impacto medible en el negocio, que justifique invertir en un proveedor de respaldo activo (no solo el puerto ya preparado para ello).
- El cliente decide explícitamente reevaluar el proveedor de IA.
