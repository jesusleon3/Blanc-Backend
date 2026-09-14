# ADR-008

## Title
Estrategia de integración con WhatsApp: API oficial de WhatsApp Business Platform como decisión primaria — Evolution API rechazada como integración principal

## Status
Proposed — **respuesta del cliente recibida (`DISCOVERY_CHECKLIST.md` 1.29, 2026-08-03), pero no aprueba la Decision tal como está escrita.** El cliente pide un alcance distinto al de la Opción B exclusiva (ver nota post-Context). Este ADR **no pasa a Accepted** hasta que se rediseñe y se reescriba formalmente con autorización explícita — no es una simple ratificación.

## Context
El stack de referencia entregado por el cliente propone **Evolution API** para la integración de WhatsApp. Evolution API es una solución open-source que opera sobre el protocolo no oficial de WhatsApp Web (vía librerías como Baileys), no sobre la API oficial de Meta (WhatsApp Business Platform / Cloud API). El Domain Discovery ya marcó esto como riesgo técnico con impacto de negocio directo: cada una de las 3–4 sucursales depende de **un único número de WhatsApp** como único canal de agendamiento, sin canal de respaldo declarado.

## Respuesta del cliente (2026-08-03) — cambia el alcance, no resuelve la Decision

**Transcripción literal (`DISCOVERY_CHECKLIST.md` 1.29):** *"Para este tema lo que queremos en temas de desarrollo es que exista la posibilidad de usar las dos, no quiero que sea simultáneo, sino que en la configuración decidamos si vamos a ir con API oficial de WhatsApp o con Evolution API."*

**Lo que esto confirma (hecho, no inferencia):** el cliente no dio el sign-off binario que esta ADR pedía (aprobar B, rechazar A) — pidió que ambos proveedores estén disponibles como adaptadores intercambiables por configuración, no simultáneos.

**Lo que esto NO resuelve (requiere autorización antes de reescribir `Decision`/`Options Considered`/`Alternatives Rejected`):** cuál es el adaptador por defecto, cómo se selecciona por configuración, si `Alternatives Rejected` debe seguir describiendo Evolution API como "rechazada" o debe reformularse, y el impacto en el cronograma de verificación de negocio ante Meta.

**Nota informativa, sin diseño (`DISCOVERY_CHECKLIST.md` 1.29):** el cliente confirma que el trámite de verificación de negocio ante Meta para la API oficial puede iniciarse desde ya, en paralelo — dato operativo, no una decisión de arquitectura.

**Compatibilidad ya confirmada, sin cambio (`PLATFORM_ARCHITECTURE_MODEL.md`):** el patrón de puertos/adaptadores de ADR-002 ya soporta un segundo adaptador sin sobrecosto arquitectónico mayor — esto es contexto, no una decisión de cómo implementarlo aquí.

## Problem Statement
¿El canal de comunicación con clientas — que es, en la práctica, el único canal de ingreso de ingresos del negocio — se construye sobre una integración no oficial con riesgo de bloqueo de número, o sobre la API oficial de Meta con garantías contractuales?

## Constraints
- Cada sucursal tiene un solo número de WhatsApp; su pérdida deja a esa sucursal sin canal de agendamiento.
- El negocio ya opera con 3 números de WhatsApp existentes (posiblemente cuentas personales/business estándar, no necesariamente aprovisionados para la API oficial) — cualquier migración a la API oficial implica un proceso de aprovisionamiento/verificación de negocio en Meta, que tiene tiempo de espera y fricción operativa propia.
- Los mensajes salientes fuera de la ventana de 24 horas de la API oficial (recordatorios de 24h antes, confirmaciones automáticas) requieren plantillas de mensaje pre-aprobadas por Meta — una restricción real que no existe en integraciones no oficiales.
- El cliente pidió explícitamente invertir fuerte en seguridad y confiabilidad; un canal de ingreso de citas con riesgo de bloqueo sin aviso contradice ese mismo principio.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Evolution API (no oficial, protocolo WhatsApp Web) | Propuesta original del cliente. Sin costo de mensajería directo de Meta, sin proceso de verificación de negocio, pero sin SLA y con riesgo de bloqueo del número por parte de Meta sin previo aviso ni vía de apelación garantizada. |
| B. WhatsApp Business Platform oficial (Cloud API), vía un proveedor de soluciones de negocio (Business Solution Provider) | Integración oficial soportada por Meta, con SLA de la infraestructura, mensajería basada en plantillas aprobadas fuera de la ventana de 24h, costo por conversación según categoría (utilidad/marketing/servicio). |
| C. Estrategia híbrida (Evolution API ahora, migración planeada a oficial) | Empezar con Evolution API para validar producto rápido, con plan explícito de migración a la API oficial antes de operar a plena escala. |

## Decision
Se adopta la **Opción B — WhatsApp Business Platform oficial** como integración primaria y objetivo de arquitectura. **Se rechaza Evolution API como integración principal de producción**, específicamente porque el canal de WhatsApp no es una función accesoria del sistema — es el único canal de ingreso de citas del negocio, y un bloqueo de número sin aviso es un escenario de pérdida de ingresos directa e inmediata para la sucursal afectada, sin mecanismo de recuperación garantizado.

Esta decisión **se aparta explícitamente del stack de referencia** que el cliente propuso y requiere su aprobación consciente antes de proceder, dado que implica: (a) tiempo de aprovisionamiento/verificación de negocio ante Meta, (b) posible necesidad de migrar los números existentes o dar de alta números nuevos gestionados por la API oficial, y (c) costo de mensajería por conversación que Evolution API no tiene.

## Consequences
Se sacrifica velocidad y simplicidad de arranque (Evolution API es, en la práctica, más rápida de poner en marcha) a cambio de eliminar el riesgo de continuidad de negocio más severo identificado en todo el Domain Discovery.

### Positive Consequences
- Elimina el riesgo de bloqueo de número por uso de protocolo no oficial — el riesgo de negocio más severo identificado hasta ahora.
- Soporte contractual/SLA real de la infraestructura de mensajería.
- El uso de plantillas pre-aprobadas encaja naturalmente con dos de los requisitos ya explícitos del cliente: confirmación automática y recordatorio 24h antes — son, por diseño, el caso de uso para el que existen las plantillas de la API oficial.
- Reduce la superficie de riesgo reputacional/legal de depender de un uso no sancionado por Meta de su plataforma.

### Negative Consequences
- Costo de mensajería por conversación que Evolution API no tiene.
- Proceso de verificación de negocio ante Meta y aprovisionamiento de números con tiempo de espera no trivial — impacta el cronograma de arranque.
- Restricción de la ventana de 24 horas para mensajes de formato libre; toda comunicación proactiva fuera de esa ventana requiere plantillas pre-aprobadas, lo cual reduce la flexibilidad conversacional espontánea fuera de una conversación activa iniciada por la clienta.
- Migrar los 3 números de WhatsApp existentes (si están en uso personal/estándar) a la plataforma oficial es un proyecto operativo en sí mismo, con downtime o coordinación necesaria durante la transición.

## Risks
- **Fricción de adopción/costo puede generar presión para revertir a Evolution API "solo para arrancar más rápido"**: este es exactamente el tipo de decisión que el principio "nunca sacrifiques arquitectura por velocidad" existe para prevenir. Si el cliente decide asumir el riesgo conscientemente, debe quedar registrado como una decisión ejecutiva explícita, no una omisión.
- **Tiempo de aprovisionamiento ante Meta puede bloquear el cronograma de sprints** si no se inicia con suficiente antelación — se recomienda iniciar el proceso de verificación de negocio en paralelo a las primeras fases de desarrollo, no al final.
- **Restricción de plantillas puede sentirse "menos natural"** frente al objetivo de tono conversacional del cliente (respuestas cortas, sin parecer bot) — mitigado porque la restricción de plantillas aplica a mensajes *proactivos* fuera de ventana, no a la conversación activa iniciada por la clienta, que es donde vive el requisito de tono natural.
- **Si el cliente rechaza esta decisión** por razones de costo/tiempo y opta por Evolution API de todas formas, este ADR debe actualizarse a "Accepted con riesgo aceptado por el cliente" y el riesgo de bloqueo de número pasa a gestionarse como riesgo de negocio aceptado explícitamente, con plan de contingencia (ej. número de respaldo) como mitigación mínima obligatoria.

## Alternatives Rejected
- **Evolution API como integración principal**: rechazada como decisión por defecto, precisamente por ser la propuesta original del cliente que este documento está corrigiendo con justificación explícita — el riesgo de continuidad de negocio (bloqueo del único canal de ingreso de citas de una sucursal) no es aceptable como configuración por defecto para un negocio real con ingresos dependientes de ese canal.
- **Estrategia híbrida (empezar no oficial, migrar después)**: rechazada como plan por defecto. Retrasar la decisión "difícil" no elimina el riesgo, solo lo pospone mientras el negocio ya depende operativamente del canal — y migrar un canal de producción en vivo es más disruptivo que empezar bien. Se podría reconsiderar solo si el cliente necesita validar el producto con una audiencia muy reducida antes de comprometerse al proceso de verificación de Meta, y con un límite de tiempo explícito para la migración.

## Future Revisit Criteria
- El cliente aprueba o rechaza explícitamente esta decisión — **es un bloqueante formal antes de diseñar el módulo de integración de WhatsApp en la arquitectura técnica**.
- Si se aprueba Evolution API pese a esta recomendación, debe definirse un plan de contingencia mínimo (ej. proceso manual de respaldo si un número es bloqueado) antes de considerar el riesgo "gestionado".
- Cambios en la política de Meta hacia integraciones no oficiales, o hacia el costo/proceso de la API oficial, ameritan revisar esta decisión.
