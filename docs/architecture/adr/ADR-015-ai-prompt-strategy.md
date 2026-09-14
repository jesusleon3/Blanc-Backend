# ADR-015

## Title
Estrategia de prompts de IA: artefacto versionado, independiente del despliegue de código, con validación obligatoria en sandbox

## Status
Proposed — pendiente de aprobación del cliente

## Context
El cliente pidió explícitamente: un panel para que personal no técnico entrene al bot agregando respuestas frecuentes sin programar, versionado de prompts con posibilidad de revertir cambios, y un entorno sandbox para probar cambios antes de publicarlos (ADR-012). El principio de IA ya establecido (ADR-007) exige salida estructurada validada y trazabilidad completa de decisiones de IA.

## Problem Statement
¿Cómo se gestionan los prompts que gobiernan la conversación para que puedan iterarse rápido (incluso por personal no técnico) sin arriesgar la calidad o el tono de la conversación en producción, y sin acoplar su ciclo de vida al de un despliegue de código completo?

## Constraints
- Personal no técnico debe poder agregar respuestas frecuentes sin escribir código.
- Todo cambio de prompt debe poder probarse en Sandbox (ADR-012) antes de publicarse.
- Debe existir historial de versiones y capacidad de revertir sin un despliegue de aplicación.
- Un prompt y el esquema de salida estructurada que se espera de él (ADR-007) están acoplados — cambiar uno sin el otro es una fuente de fallos silenciosos.
- El tono conversacional (respuestas cortas, sin emojis, sin errores humanos simulados) es un requisito de negocio explícito y sensible a regresiones no detectadas fácilmente por pruebas automatizadas tradicionales.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Prompts embebidos en el código fuente, desplegados junto con la aplicación | Cada cambio de prompt requiere un despliegue completo de código. |
| B. Prompts como artefacto versionado en un almacén propio (config/DB), con aprobación y despliegue independientes del código de aplicación | Iteración de prompts desacoplada del ciclo de release de la aplicación, con control de versión, sandbox y rollback propios. |
| C. Edición dinámica y autónoma por la propia IA sin revisión humana | El modelo ajusta su propio comportamiento conversacional sin aprobación intermedia. |

## Decision
Se adopta la **Opción B**. Los prompts se gestionan como artefactos versionados independientes del ciclo de despliegue de la aplicación. Cada versión de prompt se empareja explícitamente con la versión del esquema de salida estructurada que espera (no se versionan por separado, para evitar el fallo silencioso de un prompt nuevo con un esquema viejo o viceversa). Todo cambio de prompt debe: (1) probarse en Sandbox (ADR-012) contra el conjunto de conversaciones de referencia (ADR-019), (2) quedar registrado en un historial de cambios con autor y fecha, (3) poder revertirse a la versión anterior sin desplegar código. El panel de "entrenar al bot" que el cliente pidió para personal no técnico opera sobre este mismo pipeline versionado — no es un atajo que edite producción directamente.

## Consequences
Se obtiene velocidad de iteración conversacional desacoplada del ciclo de release de software, con una red de seguridad (sandbox + rollback) que evita que un cambio de prompt mal hecho por personal no técnico degrade la producción sin control.

### Positive Consequences
- Satisface directamente los tres requisitos explícitos del cliente: entrenamiento sin programar, versionado con reversión, y prueba en sandbox antes de publicar.
- Desacopla la velocidad de iteración conversacional de la cadencia de despliegue de código — se puede ajustar el tono o agregar una respuesta frecuente sin esperar un release de aplicación.
- El acoplamiento explícito entre versión de prompt y versión de esquema de salida previene un fallo silencioso conocido (un prompt nuevo devolviendo un formato que el código ya no espera, o viceversa).

### Negative Consequences
- Requiere construir el pipeline de gestión de prompts (almacén versionado, sandbox, aprobación, rollback) como una pieza de infraestructura propia, no trivial.
- Un cambio de prompt no revisado con cuidado, aunque pase por sandbox, puede seguir degradando la calidad conversacional si el conjunto de pruebas de referencia (ADR-019) no cubre el caso afectado.

## Risks
- **Personal no técnico introduce un cambio de tono no deseado** (ej. sin darse cuenta, generando respuestas más largas o con errores simulados, contradiciendo principios de conversación ya definidos): mitigado por el requisito de paso obligatorio por Sandbox y por el conjunto de pruebas de regresión conversacional (ADR-019), no por confiar en la revisión manual únicamente.
- **Desincronización entre prompt y esquema de salida** si se edita uno sin el otro: mitigado por el versionado acoplado explícito de esta decisión.
- **Historial de prompts sin gobernanza de quién puede aprobar promoción a producción**: debe definirse dentro de RBAC (ADR-010) qué rol tiene permiso de promover un prompt de Sandbox a Production, no solo de editarlo.

## Alternatives Rejected
- **Prompts embebidos en código fuente**: rechazada. Acopla cada ajuste conversacional (incluyendo los hechos por personal no técnico) a un despliegue completo de aplicación, contradiciendo directamente el requisito explícito del cliente de poder entrenar al bot sin programar.
- **Edición dinámica autónoma por la IA sin revisión humana**: rechazada de forma categórica. Contradice el principio rector "la IA interpreta, no decide" — permitir que el modelo ajuste su propio comportamiento sin aprobación humana intermedia es exactamente el tipo de autonomía no controlada que el cliente pidió evitar.

## Future Revisit Criteria
- El volumen de cambios de prompt crece al punto de requerir un flujo de aprobación más formal (múltiples revisores, entornos adicionales de prueba).
- Se identifican categorías de cambio de prompt (ej. ajustes menores de redacción vs. cambios de lógica conversacional) que ameriten niveles de rigor de aprobación distintos.
