# Modelo Arquitectónico de Plataforma — Core Platform, Domain Policies, Client Specification y Extension Points

> **Estado:** Freeze candidate — versión candidata a congelarse. No se congela con este documento; se congela cuando el cliente lo declare explícitamente.
> **Fecha:** 2026-08-03.
> **Relación con el ejercicio anterior:** en esta misma sesión se presentó, solo en chat, una primera clasificación en tres categorías (Core Platform / Client Specification / Extension Points). Ese análisis **nunca se persistió** en ningún archivo. Este documento no lo reproduce — lo **reemplaza** con un modelo de cuatro capas, después de un intento de refutación explícito que corrigió varias de sus clasificaciones. Ningún otro documento del repositorio fue modificado para producir este archivo.
> **Ajuste 2026-08-03 (segunda revisión):** se agregaron el criterio formal de cuándo crear una Domain Policy (Sección 3), el principio de implementación compartida (Sección 4), y el proceso de onboarding de un cliente nuevo (Sección 11).
> **Ajuste 2026-08-03 (tercera revisión — esta):** a solicitud explícita del cliente, cinco mejoras antes de congelar: (1) renombrado "Implementación Default" → **Reference Implementation**, término más preciso; (2) diagrama ASCII de las cuatro capas (Sección 1); (3) principio explícito "las Domain Policies representan variabilidad de dominio, nunca variabilidad técnica" (Sección 1 y 3.1); (4) análisis crítico de si el modelo merece un ADR independiente — conclusión: sí, se recomienda `ADR-023` (Sección 5.7); (5) revisión completa de consistencia interna (referencias, numeración, terminología). No se agregó ningún concepto arquitectónico nuevo — ver resumen de cambios descartados en el cierre de esta revisión.
> **Qué NO hace este documento:** no propaga las respuestas de `DISCOVERY_CHECKLIST.md` hacia ningún otro documento. Esa propagación es el siguiente paso pendiente **después** de que este modelo quede aprobado y congelado — ver Sección 14.

---

## 1. El modelo — cuatro capas y el contrato entre ellas

```
+---------------------------------------------+
|                CORE PLATFORM                  |
|  Mecanismos, invariantes, Decision Flows.     |
|  Depende SOLO de la interfaz de cada          |
|  Domain Policy -- nunca de su implementacion. |
+---------------------+-------------------------+
                       | invoca la interfaz
                       v
+---------------------------------------------+
|               DOMAIN POLICIES                 |
|  Contrato tipado por decision de negocio.     |
|  Ej.: PoliticaDeCotizacion,                   |
|       PoliticaDeDisponibilidad                |
+---------------------+-------------------------+
                       | implementada por
           +-----------+------------+
           v                        v
+------------------------+   +---------------------------+
|  REFERENCE              |   |  IMPLEMENTACION            |
|  IMPLEMENTATION          |   |  ESPECIFICA DE CLIENTE      |
|  Provista por la         |   |  Solo si el checklist de    |
|  plataforma. La usa      |   |  la Seccion 3 lo justifica  |
|  Blanc hoy y todo        |   |  (algoritmo genuinamente    |
|  cliente nuevo, por      |   |  distinto -- no solo un     |
|  defecto (Seccion 4).    |   |  valor distinto).           |
+------------+-------------+   +---------------------------+
             | lee
             v
+---------------------------------------------+
|             CLIENT SPECIFICATION              |
|  Solo datos: catalogo, horarios,              |
|  porcentajes, prompts, roles, textos.         |
|  Cero logica de negocio.                      |
+---------------------------------------------+

+---------------------------------------------+
|              EXTENSION POINTS                 |
|  Adaptadores de infraestructura: WhatsApp,    |
|  proveedor de IA, Calendario externo.         |
|  Sin relacion de dependencia con las Domain   |
|  Policies -- son variabilidad TECNICA, nunca  |
|  variabilidad de DOMINIO (ver principio abajo)|
+---------------------------------------------+
```

| Capa | Qué contiene | Qué NO contiene | Quién la define / modifica | Ejemplo real de Blanc |
|---|---|---|---|---|
| **Core Platform** | Mecanismos universales, invariantes no negociables, aggregates, la orquestación de los 36 Decision Flows | Ningún valor específico de un cliente; ninguna implementación de una Domain Policy | Equipo de arquitectura, vía código + ADR | Invariante de no-doble-booking (`RN-AGE-01`), ciclo de vida de `Cita` |
| **Domain Policies (Client Brain)** | Interfaces de dominio tipadas para **decisiones con lógica real** que un cliente distinto podría resolver con un procedimiento distinto — más una implementación concreta por cliente | Valores sueltos sin lógica condicional (eso es Client Specification); nunca puede desactivar un invariante de Core; nunca variabilidad técnica (eso es Extension Points) | El equipo de arquitectura define el **contrato** (la interfaz); cada cliente aporta la **implementación** — por defecto, la Reference Implementation que provee la plataforma (Sección 4) | `PoliticaDeCotizacion` — Blanc implementa composición por uña con tabla de combinaciones |
| **Client Specification** | Datos puros: catálogo, horarios, prompts, roles, textos, porcentajes, umbrales | Cualquier lógica condicional no trivial — si hace falta una condición real, no es Client Specification, es una Domain Policy | El cliente, vía Discovery, cargado como datos | 40% de anticipo, horario semanal, lista de palabras prohibidas |
| **Extension Points** | Adaptadores de infraestructura externa reemplazable, ya definidos como puertos por ADR-002 | Lógica de negocio de cualquier tipo | Equipo de arquitectura, un adaptador por proveedor | WhatsApp oficial vs. Evolution API, proveedor de IA, calendario externo |

**Regla de dependencia (extiende, no contradice, ADR-002):** Core Platform depende únicamente de las **interfaces** de las Domain Policies, nunca de una implementación concreta — la regla de dependencia hacia adentro que ADR-002 ya exige para infraestructura se extiende aquí a decisiones de dominio. Una Domain Policy puede leer datos de Client Specification; Client Specification nunca contiene lógica ni es invocada directamente por Core Platform sin pasar por una Policy o por un mecanismo genérico ya existente (ej. el despachador de notificaciones).

**Principio arquitectónico — las Domain Policies representan variabilidad de dominio, nunca variabilidad técnica.** Una Domain Policy encapsula **cómo se toma una decisión de negocio** (qué duración calcular, qué disponibilidad ofrecer, cuándo sugerir riesgo, cómo resolver una garantía) — nunca **con qué proveedor o tecnología** se ejecuta una integración externa. Proveedores externos, bases de datos, motores de IA e infraestructura en general pertenecen siempre a **Extension Points**, nunca a Domain Policies, sin excepción. Regla de clasificación rápida: si la variación futura es sobre *tecnología* (qué IA, qué canal, qué motor de base de datos), es un Extension Point y se rige por ADR-002; si es sobre *decisión de negocio*, se evalúa con el checklist de la Sección 3 para decidir si es una Domain Policy o, si es solo un valor, Client Specification.

## 2. Invariantes que ninguna Domain Policy puede tocar

Una Domain Policy decide **cómo se resuelve una decisión de negocio dentro de límites seguros**; nunca tiene autoridad para desactivar un invariante de Core Platform. Lista cerrada, la misma ya identificada en el ejercicio de clasificación previo, ahora formalizada como restricción arquitectónica de esta capa:

1. No-doble-booking y revalidación de disponibilidad al confirmar (`RN-AGE-01/02`).
2. Snapshot inmutable de cotización (`RN-AGE-08`).
3. Dinero como entero, nunca punto flotante (`RN-COT-07`).
4. "La IA interpreta, nunca decide" + validación estructurada antes de tener efecto (`RN-CONV-01/02`).
5. Degradación a escalamiento humano ante baja confianza (`RN-CONV-05`).
6. Revalidación de `modo` antes de cada respuesta del bot (`RN-ESC-02`).
7. Auditoría append-only (`RN-AUD-01`).
8. El *principio* de que ninguna decisión financiera o de riesgo se aprueba de forma automática — una Domain Policy puede decidir **qué** se sugiere o **cuánto** se cobra, nunca puede saltarse el paso de aprobación humana donde el proyecto ya lo exige.

Ejemplo concreto de cómo aplica: `PoliticaDeRiesgoCliente` puede decidir *si* sugiere lista roja y con qué criterio; nunca puede asignarla sin que quede un paso de confirmación humana, porque eso violaría el invariante 8, no una preferencia de política.

---

## 3. Criterio de decisión — cuándo crear una Domain Policy

**Regla arquitectónica permanente.** Esta sección no es parte del análisis histórico de la Sección 5 — es la regla que gobierna toda decisión futura de crear una Domain Policy nueva, dentro o fuera de este documento. Ningún elemento se convierte en Domain Policy sin pasar, explícitamente, por este checklist. **Este checklist evalúa únicamente variabilidad de dominio** (principio de la Sección 1) — una necesidad de cambiar de proveedor externo, motor de IA, base de datos o cualquier pieza de infraestructura nunca pasa por aquí: pertenece siempre a Extension Points (ADR-002), sin excepción.

### 3.1 Los seis criterios — deben cumplirse los seis, no una mayoría

| # | Criterio | Pregunta que debe responderse con evidencia, no con hipótesis |
|---|---|---|
| 1 | **Evidencia de procedimiento distinto, no de valor distinto** | ¿Hay evidencia concreta de que un cliente distinto resolvería este problema con un **algoritmo** diferente, no solo con un número, texto o umbral diferente? |
| 2 | **Cambia el algoritmo o el flujo de decisión** | ¿La variación afecta ramas, orden de evaluación o la estructura de la decisión — no solo un punto de corte dentro del mismo camino único? |
| 3 | **No se puede resolver únicamente con datos** | ¿Intentar resolverlo con un valor de Client Specification (número, enum, lista, tabla) deja casos reales sin cubrir, o exige lógica condicional no trivial alrededor del dato? |
| 4 | **No rompe invariantes del Core Platform** | ¿La variación cabe completamente dentro de los límites de la Sección 2 — nunca desactiva no-doble-booking, snapshot inmutable, control humano sobre decisiones sensibles, auditoría? |
| 5 | **Complejidad suficiente para justificar una interfaz propia** | ¿La lógica tiene más de una rama de decisión real? Una comparación única (`si X < umbral entonces Y`) no la tiene. |
| 6 | **Razón de negocio articulable, no especulativa** | ¿Existe una razón de negocio concreta de por qué esta decisión necesita poder variar — no "podría ser útil algún día"? Mismo estándar que ADR-002 ya exige para un puerto de infraestructura. |

**Anti-test obligatorio antes de aceptar cualquier candidato:** si no se puede señalar un segundo cliente **real o concretamente plausible** — no un cliente hipotético genérico — donde el algoritmo, no el valor, sería distinto, la respuesta por defecto es **NO**. Blanc es la referencia, no la excepción (mismo principio ya aplicado en el ejercicio de clasificación previo). En la práctica, este anti-test es cómo se evalúa el criterio 6 (y, indirectamente, el 1) cuando no hay evidencia — no es un séptimo criterio adicional, es la vara de medir de ambos.

### 3.2 Verificación retroactiva — aplicando el criterio a lo ya decidido

Para que esta regla no sea solo declarativa, se aplica aquí mismo a los siete candidatos evaluados en el ejercicio de clasificación de esta sesión (narrativa completa en la Sección 5, clasificación final en las Secciones 7 y 8), como prueba de consistencia:

| Candidato | 1. Procedimiento distinto | 2. Cambia el flujo | 3. No resoluble solo con datos | 4. No rompe invariantes | 5. Complejidad suficiente | 6. Razón de negocio clara | Resultado |
|---|---|---|---|---|---|---|---|
| `PoliticaDeCotizacion` | Sí | Sí | Sí | Sí | Sí | Sí | **Domain Policy** |
| `PoliticaDeDisponibilidad` | Sí | Sí | Sí | Sí | Sí | Sí | **Domain Policy** |
| `PoliticaDeRiesgoCliente` | Sí | Sí | Sí | Sí | Sí | Sí | **Domain Policy** |
| `PoliticaDeGarantia` | Sí | Sí | Sí | Sí | Sí | Sí | **Domain Policy** |
| Cancelaciones (ventana de tiempo) | No | No | No — es un umbral | n/a | No | No | Client Specification + mecanismo genérico |
| Anticipos (%, reembolso, ventana) | Parcial — la política de reembolso es una elección cerrada entre 2-3 opciones, no un algoritmo abierto | No | No — un enum cubre los casos reales | n/a | No | No | Client Specification + mecanismo genérico |
| Recordatorios (contenido, timing) | No | No | No | n/a | No | No | Client Specification + mecanismo genérico |
| Confirmación push vs. interactiva (`RN-CONV-11`) | Sí, en teoría | Sí — cambia la máquina de estados de `Cita` | No del todo | Sí | Sí | **Falla** — sin segundo cliente real hoy | Costura documentada, **no** se crea la Policy todavía |

La última fila es la más instructiva: es un candidato que pasa cinco de los seis criterios y aun así se rechaza, porque falla el anti-test de evidencia (criterio 6). Es la aplicación más estricta del principio "no abstraer sin evidencia real" — pasar la mayoría de los criterios no es suficiente si falta el sexto.

### 3.3 Cuándo NO crear una Domain Policy — con ejemplos

No crear una Domain Policy cuando:

- **La variación es solo un número o un texto.** Ejemplo: el porcentaje de anticipo (40% en Blanc). Cambiarlo a 25% para otro cliente no cambia ningún algoritmo — es un dato.
- **La variación es una elección cerrada y enumerable.** Ejemplo: política de reembolso (nunca / condicional / siempre). Un enum de 3 valores en Client Specification cubre esto sin necesitar una interfaz.
- **Solo existe un cliente y no hay evidencia concreta de un segundo comportamiento.** Ejemplo: confirmación push vs. interactiva — real, pero especulativa hoy. Se documenta como costura, no se construye.
- **La lógica es en realidad un caso especial de una Domain Policy ya existente.** Antes de proponer una interfaz nueva, se debe verificar si una de las cuatro ya aceptadas (Sección 7) puede cubrirla ampliando su contrato — evita duplicar interfaces para el mismo tipo de decisión.
- **La motivación es "flexibilidad a futuro" sin un caso de uso presente.** Es exactamente el patrón que `RN-COT-08` (override de precio/duración por sucursal) ya mostró como desperdicio real dentro de este mismo proyecto — modelado preventivamente, confirmado sin uso.
- **La variación es sobre infraestructura o proveedor, no sobre decisión de negocio.** Ejemplo: cambiar de OpenAI a otro proveedor de IA, o de Google Calendar a Outlook. Es variabilidad técnica — pertenece a Extension Points (principio de la Sección 1), nunca entra a este checklist.

---

## 4. Principio de Reference Implementation

**Regla arquitectónica permanente, aplicable a toda Domain Policy presente y futura.**

1. **Toda Domain Policy debe tener una Reference Implementation** provista por el Core Platform (ej. `PoliticaDeCotizacionReferencia`, `PoliticaDeDisponibilidadReferencia`, `PoliticaDeRiesgoClienteReferencia`, `PoliticaDeGarantiaReferencia`). El nombre importa: no es un mecanismo automático ni un "valor por omisión" — es **la implementación de referencia que la plataforma mantiene y ofrece a cualquier cliente**, incluido el primero.
2. **La Reference Implementation debe resolver la mayoría de los casos leyendo exclusivamente Client Specification** (valores, tablas, catálogos) — no debe contener ninguna lógica hardcodeada que solo funcione para Blanc. Si no puede operar correctamente con solo cambiar los datos de entrada, no es una Reference Implementation real, es la implementación de Blanc disfrazada.
3. **Un cliente nuevo parte, de entrada, de la Reference Implementation de las cuatro Domain Policies**, alimentada por su propia Client Specification — sin escribir una sola línea de código nuevo.
4. **Solo se escribe una implementación nueva, distinta de la Reference Implementation, cuando el cliente necesita un algoritmo distinto**, no un valor distinto — y esa necesidad debe pasar el checklist completo de la Sección 3 antes de escribirse.

**Aclaración importante sobre el estado actual:** dado que Blanc es hoy el único cliente, no existe todavía una distinción real entre "la Reference Implementation" y "la implementación de Blanc" — son, literalmente, la misma clase, porque no hay un segundo caso con el que contrastar y extraer qué parte es genuinamente genérica. Esto es consistente con el principio "Blanc es la referencia, no la excepción": el día que aparezca un segundo cliente real, recién ahí se decide, con evidencia concreta, si su comportamiento cabe en la Reference Implementation existente (ajustando solo Client Specification) o si necesita una implementación propia — nunca antes, de forma especulativa.

Este principio es lo que mantiene acotado el costo de mantenimiento del modelo: no se paga el costo de N implementaciones completas por cada Domain Policy multiplicado por cada cliente — se paga, en el caso general, solo el costo de una Reference Implementation reutilizable, y el costo de una implementación nueva únicamente cuando la Sección 3 lo justifica.

---

## 5. Intento de refutación

### 5.1 Riesgos

**Riesgo real más alto — explosión de puertos contra la propia disciplina de ADR-002.** ADR-002 exige explícitamente que "cada puerto tenga una razón de negocio concreta... no puertos especulativos para todo" y su propio criterio de revisión futura dice: *"si ningún puerto llega a tener más de un adaptador real ni se prevé que lo tenga, revisar si el nivel de abstracción es correcto."* Los siete candidatos originalmente propuestos (cancelaciones, anticipos, riesgo, garantías, cotización, disponibilidad, recordatorios) tendrían, hoy, **exactamente una implementación cada uno** — la de Blanc. Aceptarlos sin filtrar habría repetido, a escala de Domain Policy, la misma sobreabstracción especulativa que ADR-002 ya prohíbe para adaptadores de infraestructura. **Esto no invalida la idea — exige aplicarle el mismo filtro de evidencia que ya usa ADR-002**, ahora formalizado en la Sección 3. El resultado de aplicar ese filtro está en la Sección 7.

**Riesgo de divergencia del "Client Brain" entre clientes.** Si cada política se implementa como una clase completamente nueva por cliente sin una implementación de referencia compartida, el costo de mantenimiento crece linealmente con el número de clientes y de políticas, y cada implementación se vuelve una superficie de prueba aislada (tensiona ADR-019, la pirámide de testing por capa no anticipa N implementaciones de una misma interfaz). Mitigado formalmente por el principio de Reference Implementation (Sección 4): la mayoría de la variabilidad real se cubre con una implementación compartida, parametrizada por Client Specification — solo las políticas con lógica genuinamente distinta requieren una clase nueva.

### 5.2 Conflictos con ADRs existentes

No se encontró ninguna contradicción real. Se encontraron dos ADRs relacionados que requieren, como mínimo, una referencia cruzada, y dos que ya son precedente directo:

| ADR | Relación con este modelo |
|---|---|
| **ADR-002** (Hexagonal) | Se extiende conceptualmente (dos familias de puerto: infraestructura y Domain Policy), pero el vehículo de formalización recomendado no es una enmienda a este ADR — es un ADR independiente. Análisis completo en la Sección 5.7. |
| **ADR-009** (Multi-tenant) | Este modelo es, en los hechos, la operacionalización del propio "Future Revisit Criteria" de ADR-009 — no lo contradice, lo activa. Requiere una enmienda menor propia (concepto de "Organización" por encima de `Sucursal`, que es un tema de topología de despliegue, no de Domain Policies) más una referencia cruzada al ADR independiente recomendado. Análisis completo en la Sección 5.7. |
| **ADR-015** (Prompts de IA) | Es **precedente directo y ya funcionando**: el contenido conversacional (variabilidad real entre clientes) ya vive como dato versionado, no como código, mientras el *pipeline* (sandbox, versionado, rollback) es Core Platform. Es la misma partición Core-mecanismo / Client-Specification-dato que este modelo formaliza para el resto del sistema. Sin conflicto. |
| **ADR-020** (Feature flags) | Refuerza el modelo: ya rechaza explícitamente usar flags como configuración de negocio. Con este documento, quedan tres mecanismos claramente distintos y no debe confundirse ninguno con otro: *feature flag* (interruptor operativo temporal), *Client Specification* (dato de negocio), *Domain Policy* (decisión con lógica real). Sin conflicto. |

Ningún otro ADR (001, 003, 004, 005, 010–014, 016–019, 021, 022) interactúa con este modelo — gobiernan disciplina de ingeniería que no depende de qué cliente esté desplegado.

### 5.3 Sobreabstracción

Se aplicó el criterio ahora formalizado en la Sección 3 a cada uno de los siete candidatos originales. Resultado: **cuatro sobreviven como Domain Policy real, tres no** — el detalle y la evidencia exacta de cada uno está en las Secciones 7 y 8. Este es el hallazgo central de la refutación: la lista original, aceptada sin filtrar, habría sido sobreabstracción; filtrada, es defendible.

### 5.4 Duplicidades

No se encontró duplicidad real entre Domain Policies, Business Rules y Decision Flows — son tres representaciones distintas y complementarias del mismo conocimiento, cada una en su capa ya establecida:

- **Business Rules** (`docs/business-rules/`) sigue siendo la fuente de verdad **declarativa** de qué dice cada regla, en prosa, consultable por cualquiera (humano o IA).
- **Decision Flows** sigue siendo la orquestación — **cuándo y en qué orden** se invoca cada regla.
- **Domain Policies** es la realización **en código** del campo "Lógica de negocio" de un Rule ID, únicamente para los Rule IDs cuya lógica es genuinamente client-specific (Sección 7) — su implementación para Blanc debe trazar exactamente a los Rule IDs correspondientes, con la misma disciplina que Decision Flows ya sigue ("todo paso de todo flujo cita un Rule ID existente; ninguno inventa lógica").

No se requiere renombrar ni mover ningún Rule ID ni Flow ID.

### 5.5 Impacto en Bounded Contexts y Aggregates

**Hallazgo nuevo, verificado con evidencia dura, no derivado del ejercicio anterior:** `01-domain-discovery.md` **no tiene ningún Bounded Context, subdominio, aggregate ni entidad para Garantías**. Se verificó con búsqueda exhaustiva del término en el documento completo — cero apariciones del concepto de negocio "garantía de servicio" en §3 (subdominios), §4 (Bounded Contexts) o §5 (modelo por contexto, que va de §5.1 a §5.12 sin una sola subsección de Garantías). Sin embargo, Garantías **sí** tiene 6 Rule IDs (`RN-GAR-01..06`) y un Decision Flow ya en estado `Aprobado` (`FL-GAR-01`) y un módulo funcional completo (`functional-scope.md` §3.6). Es un vacío real, distinto de los ya conocidos (P4, P5, etc. de `ARCHITECTURE_CLOSURE_PLAN.md`), descubierto por este ejercicio al intentar ubicar dónde viviría `PoliticaDeGarantia`. Se trata en la Sección 10 como prerrequisito.

Para el resto de los Bounded Contexts, ninguna Domain Policy requiere un aggregate nuevo — todas mapean a responsabilidades que el Domain Discovery ya describía en prosa sin nombrarlas formalmente como Domain Service (el "motor de cotización" y el "motor de disponibilidad" de §3). Formalizarlas como Domain Policy es, en los hechos, cerrar ese hueco de catalogación ya señalado en el ejercicio anterior, no abrir uno nuevo.

### 5.6 Impacto en estrategia de productización

Sin conflicto con ADR-009 (Silo): las Domain Policies son un concern de código (inyección de dependencias en tiempo de construcción/arranque), no de topología de despliegue. Cada instancia Silo sigue siendo una base de datos y una instancia dedicadas; lo que cambia es qué implementación de cada Policy se conecta en esa instancia. El costo real de incorporar un segundo cliente, con este modelo, queda acotado y auditable: de los siete candidatos originales, tres (Sección 8) cuestan **cero código nuevo** — solo datos — y cuatro (Sección 7) cuestan, en el peor caso, **una clase nueva con un contrato ya definido** (gracias al principio de Reference Implementation de la Sección 4), no un rediseño del Core. El proceso completo de onboarding, con esta lógica de costos aplicada paso a paso, está formalizado en la Sección 11.

### 5.7 ¿ADR independiente o enmienda a ADR-002 y ADR-009?

**Pregunta explícita del cliente, evaluada sin decisión automática.** Se intentó refutar la necesidad de un ADR independiente antes de recomendarlo.

**Caso a favor de mantenerlo como enmiendas (el que se descartó):**
- ADR-002 ya define el patrón de puertos/adaptadores; una Domain Policy es, en esencia, un puerto orientado a dominio en vez de a infraestructura — una extensión incremental del mismo patrón, no un concepto nuevo.
- ADR-009 ya es "la" decisión de estrategia multi-tenant; este modelo es la operacionalización de su propio "Future Revisit Criteria" — podría argumentarse que su lugar natural es dentro de esa misma ADR.
- Evita el riesgo de que un ADR-023 nuevo y este documento diverjan con el tiempo (el mismo riesgo de duplicidad que la Sección 5.4 ya identificó y descartó para Business Rules/Decision Flows).
- Un ADR de este proyecto documenta decisiones de alto nivel (motor de base de datos, monolito vs. microservicios); "cómo se inyecta una política de dominio" podría verse como un patrón de implementación por debajo de ese umbral, no una decisión arquitectónica per se.

**Caso a favor de un ADR independiente (el que se sostiene):**
- **Precedente directo y ya usado en este mismo proyecto:** ADR-021 (Idempotencia) y ADR-022 (Backup/DR) se crearon exactamente por esta razón — `ADR_INDEX.md` documenta que el tema de idempotencia "aparecía disperso en al menos cuatro ADRs distintos... sin una decisión única que los gobernara de forma consistente." Este modelo está disperso en **cuatro** ADRs (002, 009, 015, 020) de la misma manera — es el mismo patrón de fragmentación que ya justificó crear un ADR nuevo dos veces en este proyecto, no un caso inédito.
- Este documento tiene 14 secciones y una disciplina completa de checklist, refutación y onboarding — es, en sustancia, del mismo tamaño y peso que cualquier ADR ya existente en el proyecto, no un detalle menor de implementación. Forzarlo dentro de ADR-002 o ADR-009 lo fragmentaría entre dos documentos que no fueron diseñados para contenerlo.
- Tiene implicación de **estrategia de negocio** (cómo se productiza la plataforma para un segundo cliente), la misma categoría de decisión que ya elevó a ADR-009 por encima de un detalle técnico — no una decisión de bajo nivel.
- El propio patrón documental del proyecto ya separa "decisión formal corta" (el ADR) de "mecánica detallada" (el documento compañero) — ADR-004 (Outbox) es una decisión de una página; `04-data-model.md` §4.1 contiene su mecánica completa. Este documento puede jugar exactamente ese rol de "mecánica detallada" respecto a una decisión formal corta en `ADR-023`, sin duplicar contenido.

**Conclusión, tras el intento de refutación:** el caso a favor de un ADR independiente es más fuerte, con evidencia directa del propio proyecto (el precedente de ADR-021/ADR-022), no una preferencia estética. **Se recomienda crear `ADR-023`** como la decisión formal, corta, en el formato estándar ya usado por los 22 ADRs existentes (Title, Status, Context, Problem Statement, Constraints, Options Considered, Decision, Consequences, Risks, Alternatives Rejected, Future Revisit Criteria) — con este documento (`PLATFORM_ARCHITECTURE_MODEL.md`) quedando como su documento de detalle/mecánica, mismo patrón que `ADR-004` ↔ `04-data-model.md`. `ADR-002` y `ADR-009` reciben únicamente una referencia cruzada breve a `ADR-023`, no una enmienda sustantiva — ver Sección 12 para el detalle exacto de qué cambia en cada uno. **No se crea el archivo de `ADR-023` en esta revisión** — es, en sí mismo, uno de los cambios pendientes de la Sección 12, a ejecutar después de la aprobación de este modelo.

---

## 6. Veredicto

La propuesta **sobrevive** el intento de refutación, con cuatro refinamientos obligatorios respecto a la formulación original:

1. De los siete ejemplos de Domain Policy mencionados originalmente, solo **cuatro** tienen evidencia real de lógica variable (Sección 7); los otros tres quedan como mecanismo de Core Platform + dato de Client Specification, con un mecanismo genérico compartido (Sección 8) — no como interfaces separadas.
2. Ninguna Domain Policy puede desactivar un invariante de Core Platform (Sección 2) — restricción arquitectónica explícita, no implícita.
3. `Garantías` necesita, como prerrequisito, un Bounded Context propio en `01-domain-discovery.md` antes de que `PoliticaDeGarantia` tenga un hogar formal (Sección 10) — se señala aquí, no se resuelve en este documento.
4. El modelo se formaliza mejor como un ADR independiente (`ADR-023` recomendado) que como enmiendas a ADR-002 y ADR-009, que reciben solo una referencia cruzada — decidido tras intento de refutación explícito en la Sección 5.7, no ejecutado todavía.

En la segunda y tercera revisión se agregaron, sin reabrir este veredicto, el criterio formal de creación (Sección 3), el principio de Reference Implementation (Sección 4), el proceso de onboarding (Sección 11), el diagrama y principio de variabilidad de dominio (Sección 1), y la recomendación de `ADR-023` (Sección 5.7) — ninguno contradice lo ya concluido; lo formalizan, lo nombran con más precisión y lo operacionalizan.

---

## 7. Las cuatro Domain Policies reales — con evidencia

| Domain Policy | Bounded Context | Contrato (entrada → salida) | Evidencia de que es lógica real, no un valor | Implementación de Blanc | ¿Es hoy la Reference Implementation? | Rule IDs que formaliza |
|---|---|---|---|---|---|---|
| **`PoliticaDeCotizacion`** | Catálogo y Cotización | Composición de servicio solicitada → duración total + precio total + desglose | Es el propio Core Domain señalado por Domain Discovery §3 ("el corazón del valor"); tiene ramificaciones reales (combinación vs. suma aditiva, modificador de drill como delta y no como valor fijo, fallback marcado como estimado cuando falta un dato) | Composición por uña, tabla de combinaciones, drill +15 min, fallback aditivo | Sí — único cliente hoy, ver Sección 4 | `RN-COT-01, 02, 03, 04` |
| **`PoliticaDeDisponibilidad`** | Agenda | Solicitud (servicio + duración + sucursal + preferencia de manicurista) → slot(s) ofrecidos u orden de fallback | Tiene ramificación real de negocio: preferencia exclusiva bloquea todo fallback de persona; preferencia no exclusiva permite alternar persona u horario; el hallazgo nuevo de esta semana (fallback a otra sucursal, Discovery Checklist 1.2) es una tercera rama que ya cambió la lógica una vez | Exclusividad de manicurista, fallback intra-sucursal, fallback cross-sucursal, no cruzar el corte de mediodía | Sí — único cliente hoy, ver Sección 4 | `RN-AGE-03, 04, 05` |
| **`PoliticaDeRiesgoCliente`** | Clientas (CRM) | Historial de una clienta (cancelaciones, no-shows, reagendos) → sugerencia de lista roja sí/no | Evidencia directa dentro de este mismo proyecto: la recomendación arquitectónica original (umbral acumulado, ej. "2-3 cancelaciones en 30 días") y la respuesta real de la Dueña (disparador por incidente individual) son dos **procedimientos de decisión genuinamente distintos**, no dos valores del mismo procedimiento — prueba de que la lógica de agregación en sí es una decisión de diseño real | Disparador por incidente (<60 min o no-show), no acumulado | Sí — único cliente hoy, ver Sección 4 | `RN-CRM-06`, `RN-AGE-13` |
| **`PoliticaDeGarantia`** | *(sin Bounded Context hoy — ver Sección 10)* | Reclamo (cita relacionada, fecha, descripción) → resultado de validación automática + decisión de si amerita beneficio | Blanc eligió explícitamente "nunca automático" entre alternativas reales ya evaluadas (`RN-GAR-03`); `functional-scope.md` §3.6 ya describe una validación automática previa (vigencia + coincidencia de servicio) antes de enviar a revisión — hay lógica condicional real, no un valor único | Validación automática de vigencia y coincidencia, siempre a revisión humana, sin beneficio fijo | Sí — único cliente hoy, ver Sección 4 | `RN-GAR-01..06` |

---

## 8. Lo que NO se convierte en Domain Policy — mecanismo Core, dato Client Specification

| Candidato original | Por qué se descarta como Domain Policy (checklist Sección 3) | Dónde vive en su lugar |
|---|---|---|
| Cancelaciones (ventana de 59-60 min → sugerencia de lista roja) | Hoy es una comparación de umbral única (`tiempo_restante < X`) — falla los criterios 1, 2, 3 y 5 | Mecanismo genérico de Core Platform ("umbral de tiempo dispara sugerencia"), valor `ventana_minutos` en Client Specification |
| Anticipos (40%, sin reembolso, 48h de reagendo) | Igual patrón: son valores y, como mucho, una elección cerrada entre 2-3 opciones enumerables — falla los criterios 2, 3 y 5 | Mecanismo genérico + valores (`porcentaje`, `ventana_reagendo`, `politica_reembolso` como enum) en Client Specification |
| Recordatorios (contenido, timing) | Es contenido y calendarización, sin ramificación de negocio real — falla todos los criterios salvo el 4 (no aplica) | Mecanismo genérico de despacho (ya diseñado, Outbox) + contenido/tiempos en Client Specification, mismo patrón que ya usa ADR-015 para prompts |

**Nota sobre confirmación push vs. interactiva (`RN-CONV-11`, hallazgo de esta semana):** tiene ramificación real (cambia la forma de la máquina de estados de `Cita`), pero hoy solo existe una implementación conocida (la de Blanc: interactiva) — falla el criterio 6 (anti-test de evidencia, Sección 3.1). No se formaliza todavía como Domain Policy — se deja como una costura documentada que el diseño de la máquina de estados de `Cita` (Fase 0, en curso) debe tener presente, sin construir la abstracción hasta que exista evidencia de un segundo comportamiento real.

---

## 9. Mapeo a Decision Flows — dónde se invoca cada Domain Policy

Los 36 Decision Flows no cambian de forma. Esto es, específicamente, dónde queda la costura:

| Domain Policy | Se invoca desde (micro-flow) | Consumido por (macro-flows) |
|---|---|---|
| `PoliticaDeCotizacion` | `FL-COT-02` (Calcular Duración), `FL-COT-03` (Calcular Cotización) | `FL-AGE-01`, `FL-AGE-05` |
| `PoliticaDeDisponibilidad` | `FL-AGE-10` (Resolver Conflicto de Disponibilidad) | `FL-AGE-01` |
| `PoliticaDeRiesgoCliente` | `FL-CRM-05` (Consultar Clasificación), pasos internos de `FL-CRM-02` | `FL-AGE-04`, `FL-AGE-08` (interno), `FL-CRM-02` |
| `PoliticaDeGarantia` | Dentro de `FL-GAR-01` (Gestionar Solicitud de Garantía) — hoy sin micro-flow propio de validación, candidato a extraerse cuando exista Bounded Context | `FL-GAR-01` |

---

## 10. Hallazgo nuevo — Garantías no tiene Bounded Context (prerrequisito, no resuelto aquí)

Confirmado por búsqueda exhaustiva (Sección 5.5): `01-domain-discovery.md` nunca modeló Garantías como subdominio, Bounded Context, aggregate o entidad, pese a que sí tiene Business Rules, un Decision Flow `Aprobado` y un módulo funcional completo. Es un vacío estructural real, del mismo tipo que el que originalmente afectaba a Notificaciones antes del hallazgo DM-07 (que sí se resolvió, agregando el Bounded Context #11).

**Esto no bloquea aprobar este modelo** — bloquea, específicamente, formalizar `PoliticaDeGarantia` con un hogar de dominio correcto. Se dejará registrado como trabajo pendiente en la Sección 12, no se resuelve en este documento (sería modificar `01-domain-discovery.md`, fuera de alcance de esta tarea).

---

## 11. Onboarding de un nuevo cliente

Proceso formal, en orden estricto. Cada nivel solo se evalúa si el anterior no alcanza — **el Core Platform es, por diseño, el último lugar que debe modificarse, nunca el primero.**

1. **Ejecutar Discovery.** Reutilizar el patrón ya validado con Blanc (`DISCOVERY_CHECKLIST.md`): un cuestionario estructurado que cubre cada Bounded Context, con el mismo rigor de "intentar demostrar que sigue abierta antes de cerrarla".
2. **Llenar Client Specification del nuevo cliente.** Catálogo, horarios, roles, prompts, porcentajes, textos — sin escribir código. Es exactamente el mismo tipo de contenido que hoy vive en `DISCOVERY_CHECKLIST.md` una vez resuelto.
3. **Para cada regla de negocio que el cliente nuevo necesite, decidir si cabe dentro de una Domain Policy ya existente (las cuatro de la Sección 7):**
   - **Si cabe y solo requiere valores distintos** → reutilizar la **Reference Implementation** de esa Policy (Sección 4), alimentada con la nueva Client Specification. **Costo: cero código.**
   - **Si cabe pero requiere un algoritmo distinto** (y pasa el checklist completo de la Sección 3) → crear una **implementación nueva**, distinta de la Reference Implementation, de esa misma Domain Policy — no una interfaz nueva. **Costo: una clase nueva, contrato ya definido.**
4. **Solo si ninguna Domain Policy existente representa correctamente el concepto de dominio que el cliente necesita** → evaluar crear una **Domain Policy nueva**, aplicando el checklist completo de la Sección 3, incluido el anti-test de evidencia real (Sección 3.1). **Costo: una interfaz nueva + su implementación, con el mismo escrutinio que se aplicó a las cuatro ya aceptadas.**
5. **Solo si ni siquiera una Domain Policy nueva alcanza** — es decir, el cliente necesita un concepto de dominio que el Core Platform no modela en absoluto (un aggregate, un evento, un invariante que hoy no existe) — **recién entonces se evalúa un cambio al Core Platform.** Requiere el mismo rigor que cualquier cambio de Core hoy: un ADR nuevo o una enmienda, y una revisión explícita de impacto en Bounded Contexts y aggregates existentes.

| Nivel | Qué se toca | Costo | Ejemplo |
|---|---|---|---|
| 1 | Client Specification (datos) | Cero código | Cliente nuevo con anticipo del 25% en vez de 40% |
| 2 | Nueva implementación de una Domain Policy existente | Una clase, contrato ya definido | Cliente con un motor de cotización por paquete fijo, no por unidad compuesta |
| 3 | Domain Policy nueva (interfaz + implementación) | Una interfaz nueva, evaluada con el checklist completo de la Sección 3 | Sin ejemplo real hoy — hipotético hasta que exista evidencia concreta |
| 4 | Core Platform | Cambio de dominio, requiere ADR o enmienda | Un concepto de negocio que ningún aggregate actual representa |

**Si un ejercicio de onboarding termina proponiendo un cambio de Core Platform sin haber agotado, con evidencia, los niveles 1 a 3, es una señal de que Client Specification o las Domain Policies existentes están mal diseñadas — no una necesidad real de tocar el Core.** Este orden de escalamiento es, en sí mismo, la defensa principal del modelo contra la sobreingeniería que se buscó evitar desde el planteamiento original.

---

## 12. Documentos que deberán modificarse después de aprobar este modelo

Ninguno de estos cambios se ejecuta todavía. Lista exacta para cuando se autorice:

| Documento | Cambio requerido |
|---|---|
| `01-domain-discovery.md` | Agregar Garantías como Bounded Context #12 (Sección 10); documentar formalmente las 4 Domain Policies como Domain Services tipados en la Sección 5 correspondiente a cada contexto |
| `02-architecture-principles.md` | Incorporar el modelo de 4 capas como principio arquitectónico: la regla de dependencia y el principio de variabilidad de dominio vs. técnica (Sección 1), el criterio de creación (Sección 3) y el principio de Reference Implementation (Sección 4) |
| **`ADR-023` (nuevo, a crear)** | Redactar en el formato estándar de ADR del proyecto, formalizando este modelo como decisión arquitectónica propia — ver justificación completa en la Sección 5.7. Este documento queda como su mecánica de detalle, sin duplicar contenido |
| `ADR-002` | Referencia cruzada breve a `ADR-023` para la familia de puertos de Domain Policy — no una enmienda sustantiva |
| `ADR-009` | Enmienda menor: incorporar el concepto de "Organización" por encima de `Sucursal`, más referencia cruzada a `ADR-023` como el mecanismo concreto de expansión a un segundo cliente |
| `ADR_INDEX.md` | Agregar la entrada de `ADR-023` a la tabla de índice, mismo tratamiento que recibieron ADR-021/ADR-022 al agregarse fuera de la lista original |
| `docs/business-rules/00-index.md` y las 4 reglas afectadas | Nota de trazabilidad (opcional, decisión pendiente del cliente): marcar qué Rule IDs tienen su lógica formalizada como Domain Policy (`RN-COT-01..04`, `RN-AGE-03/04/05`, `RN-CRM-06`, `RN-GAR-01..06`) |
| `04-data-model.md` | Nota, sin cambio estructural: aclarar que Client Specification vive como datos en los esquemas ya existentes, sin esquema nuevo |
| `DISCOVERY_CHECKLIST.md` | Al propagar (Sección 14), marcar explícitamente qué respuestas alimentan una Domain Policy (lógica) vs. Client Specification pura (dato) |
| `CLAUDE.md` | Actualizar el framing de "Blanc" a "plataforma con Blanc como primer cliente de referencia", consistente con la visión SaaS ya registrada en memoria de proyecto |

---

## 13. Qué NO cambia

- El catálogo de 36 Decision Flows permanece congelado, sin cambio de forma — solo se documenta dónde invocan una Domain Policy.
- Ningún Rule ID se renombra ni se mueve de categoría.
- La numeración de ADRs no se rompe — `ADR-023` se sumaría como una adición nueva (mismo patrón ya usado para ADR-021/ADR-022), con referencias cruzadas breves en ADR-002 y ADR-009, no reescrituras.
- El modelo de despliegue Silo de ADR-009 no cambia — este modelo vive dentro de una instancia, no entre instancias.
- La taxonomía exacta de categorías de Business Rules y Decision Flows (rechazo ya registrado de `PAG/CLI/CFG` como prefijos generalizados) se mantiene intacta.

---

## 14. Próximo paso — pendiente de tu aprobación

Este documento formaliza el modelo, pero **no propaga todavía las respuestas de `DISCOVERY_CHECKLIST.md`** hacia ningún otro documento, tal como pediste.

**El siguiente paso pendiente, una vez apruebes y declares congelado este modelo, es retomar la propagación de `DISCOVERY_CHECKLIST.md`** hacia Domain Discovery, Business Rules, Data Model, Decision Flows y ADRs — ahora ya informada por esta clasificación (incluyendo el criterio de la Sección 3 y la Reference Implementation de la Sección 4), para no volver a escribir un valor de Blanc como si fuera una verdad universal del dominio. No se debe iniciar esa propagación sin tu aprobación explícita de este modelo.
