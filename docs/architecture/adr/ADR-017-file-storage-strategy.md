# ADR-017

## Title
Estrategia de almacenamiento de archivos: object storage privado con URLs firmadas y retención acotada

## Status
Proposed — pendiente de aprobación del cliente (marco regulatorio de datos personales aún sin confirmar — ver Riesgos)

## Context
El cliente pidió explícitamente que el sistema pueda leer imágenes (fotos de referencia de diseño de uñas) enviadas por clientas vía WhatsApp, como parte del flujo de interpretación de IA (ADR-007). Estas imágenes son datos personales asociados a una conversación y a una clienta específica. El Domain Discovery dejó pendiente de confirmar el marco regulatorio de protección de datos aplicable.

## Problem Statement
¿Dónde y cómo se almacenan las imágenes recibidas por WhatsApp, con qué control de acceso, y con qué política de retención — dado que son datos personales sensibles sin marco regulatorio confirmado todavía?

## Constraints
- Las imágenes deben ser accesibles por el pipeline de IA (lectura de imágenes) y por el personal autorizado (ej. durante un escalamiento humano), no públicamente.
- No se debe almacenar contenido binario de gran tamaño directamente en la base de datos relacional (ADR-005) — antipatrón de rendimiento y costo.
- El principio de minimización de datos personales (ya establecido en `02-architecture-principles.md`) exige no retener indefinidamente por defecto.
- El marco legal exacto de protección de datos aplicable no está confirmado (Domain Discovery, pregunta abierta #12) — la arquitectura debe ser conservadora mientras tanto.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Almacenar imágenes como blobs en PostgreSQL | Contenido binario directamente en filas de base de datos relacional. |
| B. Object storage privado, con URLs firmadas de expiración corta y retención acotada configurable | Almacenamiento especializado para binarios, con control de acceso temporal y política de borrado. |
| C. Object storage con URLs públicas permanentes | Almacenamiento especializado, pero con acceso sin expiración ni control adicional. |

## Decision
Se adopta la **Opción B**. Las imágenes se almacenan en un servicio de object storage (detrás de un puerto, ADR-002, para no acoplar el dominio a un proveedor específico), con acceso **privado por defecto**: cualquier acceso (por el pipeline de IA o por un empleado durante un escalamiento) se realiza vía URLs firmadas de expiración corta, nunca vía URLs públicas permanentes. Cada imagen se enlaza al `Mensaje`/`Conversacion` que la originó para trazabilidad, pero se almacena físicamente separada de la base de datos relacional. Se define una política de retención acotada (valor exacto pendiente de la resolución del marco regulatorio, Domain Discovery pregunta #12) en vez de retención indefinida por defecto.

## Consequences
Se obtiene control de acceso adecuado para datos personales sensibles y una postura conservadora frente a un marco regulatorio aún no confirmado, a cambio de la complejidad operativa de gestionar URLs firmadas y una política de retención con borrado activo.

### Positive Consequences
- Las imágenes de clientas no quedan expuestas públicamente ni de forma permanente, incluso si una URL se filtra o se comparte por error (expira).
- Separar binarios de la base de datos relacional evita degradar el rendimiento/costo de `Conversación` (ADR-005).
- La postura conservadora de retención acotada reduce el riesgo si el marco regulatorio termina siendo más estricto de lo asumido.

### Negative Consequences
- Gestionar URLs firmadas añade complejidad respecto a servir un archivo estático directamente.
- Un proceso de borrado por retención requiere lógica y monitoreo propios (verificar que efectivamente se ejecuta, no solo que existe la política).
- Si el marco regulatorio termina exigiendo retención más larga (ej. por motivos de disputa/auditoría), la política deberá ajustarse — se documenta como riesgo, no como error de diseño.

## Risks
- **Marco regulatorio de datos personales sin confirmar** (Domain Discovery, pregunta abierta #12): este ADR asume una postura conservadora de minimización, pero el valor exacto de retención y el tratamiento legal completo quedan pendientes de una respuesta de negocio/legal formal.
- **Borrado por retención mal implementado** (política definida pero nunca ejecutada realmente): mitigado por monitoreo explícito (ADR-011) del proceso de retención, no solo por su existencia documental.
- **Filtración de una URL firmada antes de su expiración**: mitigado por mantener la ventana de expiración lo más corta posible dado el caso de uso real (ej. minutos para el pipeline de IA, no días).

## Alternatives Rejected
- **Blobs en PostgreSQL**: rechazada. Antipatrón de rendimiento y costo conocido para contenido binario a cualquier volumen relevante, y contradice la separación de responsabilidades de ADR-005 (una base de datos relacional para estado transaccional, no para almacenamiento de archivos).
- **Object storage con URLs públicas permanentes**: rechazada. Viola directamente el principio de minimización y control de acceso de datos personales sensibles — una foto de referencia enviada por una clienta no debe ser accesible indefinidamente por cualquiera que obtenga el enlace.

## Future Revisit Criteria
- Se confirma el marco regulatorio de protección de datos aplicable (Domain Discovery, pregunta abierta #12) — ajustar el período de retención exacto y cualquier requisito adicional (ej. derecho al olvido, consentimiento explícito).
- El cliente solicita explícitamente generar cotizaciones desde imágenes (hoy fuera de alcance) — revisar si cambia el perfil de retención o procesamiento necesario.
