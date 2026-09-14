# Arquitectura Técnica — Blanc

> **Fuentes:** `docs/requirements/blanc-requisitos-negocio.md`, `docs/architecture/01-domain-discovery.md`, `docs/architecture/02-architecture-principles.md`, `docs/architecture/ADR_INDEX.md` y los 22 ADRs en `docs/architecture/adr/`, `docs/architecture/ARCHITECTURE_REVIEW.md`, `docs/architecture/DOMAIN_MODEL_REVIEW.md`.
> **Estado:** Borrador v0.1 — la etapa de Domain Discovery y el conjunto de 22 ADRs se consideran cerrados por instrucción explícita del cliente (ver historial de la sesión). Este documento no reabre ninguna decisión de dominio ni de los ADRs salvo que se detecte una contradicción objetiva, en cuyo caso el documento se detiene y la notifica antes de continuar.
> **Alcance de este documento:** selección de stack técnico concreto y arquitectura de componentes/despliegue. **No incluye** diseño de esquema de base de datos (`04-data-model.md`), diseño de contratos de API (`05-api-design.md`) ni backlog/plan de sprints (`06-development-plan.md`) — todos documentos posteriores, acotados por lo que aquí se congele. No se escribe código en ningún punto de este documento.
>
> **Regla de gobernanza de este documento (Decision Pending):** ante un vacío de decisión, una decisión pendiente de negocio, o una alternativa técnicamente válida que afecte de forma importante la arquitectura, este documento **no cierra la decisión unilateralmente**. En su lugar: documenta el problema, presenta las alternativas consideradas, indica una recomendación justificada contra los criterios de la Sección 2, y marca el punto explícitamente como **`Decision Pending`**. Una decisión solo se cierra de forma firme aquí cuando es una elección de implementación de bajo riesgo, reversible, sin dependencia de información de negocio no confirmada, y sin tradeoff material entre las alternativas serias. Si en cambio se detecta una **contradicción real con un ADR ya vigente** (no un vacío, sino un choque con algo ya decidido), este documento se detiene en ese punto, lo notifica explícitamente, y no continúa hasta recibir instrucción.

---

## 0. Cómo leer este documento

- Cada subsección de la Sección 3 (stack técnico) sigue el mismo protocolo: **opciones consideradas → evaluación contra los criterios de la Sección 2 → decisión (firme o `Decision Pending`) → justificación**. Ninguna tecnología se asume de entrada, incluyendo las del stack de referencia que el cliente propuso originalmente (`blanc-requisitos-negocio.md`) — se evalúan como una opción más, no como el punto de partida.
- Las decisiones ya congeladas por un ADR (ej. PostgreSQL como motor, ADR-005; OpenAI como proveedor de IA, ADR-007) no se reabren aquí — este documento resuelve la pieza de implementación concreta que el ADR dejó abierta (ej. ¿proveedor gestionado o autoalojado?), no el motor/proveedor en sí.
- Los puntos marcados **`Decision Pending`** no bloquean la lectura ni la utilidad del resto del documento — son, por diseño, la lista de lo que debe confirmarse antes o durante `04`/`05`/`06`, no un defecto de este documento.
- La Sección 11 (ADRs candidatos) se escribe **al final**, después de la revisión adversarial completa de todo el documento — solo contendrá los hallazgos que, tras ver la arquitectura completa, realmente ameriten un ADR formal nuevo. No se anticipa aquí.

---

## 1. Resumen ejecutivo y alcance

Este documento traduce los 22 ADRs y el modelo de dominio ya congelados en: (a) una selección de stack técnico concreto, evaluada con criterios explícitos y no asumida por conveniencia o por ser la propuesta original del cliente; y (b) una arquitectura de componentes y despliegue de alto nivel — sin entrar a esquema de base de datos, contratos de API ni backlog, que son los tres documentos siguientes de esta serie.

**Lo que este documento decide:** qué pieza de tecnología concreta implementa cada decisión arquitectónica ya tomada (framework backend, proveedor de base de datos, ORM, cache, cola de jobs, canal realtime, storage, autenticación, hosting, backend de observabilidad, CI/CD), y cómo se organizan los componentes internos (los 11 Bounded Contexts como módulos) y su despliegue.

**Lo que este documento NO decide:** esquema de tablas/columnas (→ `04-data-model.md`), contratos de request/response de la API (→ `05-api-design.md`), backlog o secuencia de sprints (→ `06-development-plan.md`), ni ninguna decisión de negocio todavía pendiente del Domain Discovery (preguntas abiertas #4, #11, #12) o de los ADRs con confirmación ejecutiva pendiente (ADR-006, ADR-008, ADR-022) — se usan sus supuestos de trabajo ya documentados, sin resolverlos aquí.

**Cómo se relaciona con la Architecture Review:** las condiciones que `ARCHITECTURE_REVIEW.md` fijó antes de escribir este documento (F-27 — patrón de ingesta de webhook; F-14 — tensión entre trazabilidad de IA y minimización de datos; F-01 — secuenciación de patrones) se abordan dentro de las secciones correspondientes (4.4, 6, y una nota en la Sección 9 respectivamente) como análisis con recomendación, marcados `Decision Pending` donde corresponda — no como ADRs nuevos creados de antemano, por instrucción explícita del cliente.

---

## 2. Criterios de evaluación tecnológica

Estos siete criterios se aplican, en este orden de relevancia para Blanc, a **cada** decisión de la Sección 3. No se pondera con un número (evitaría más precisión de la que el ejercicio soporta); se razona narrativamente contra cada uno, y se declara explícitamente cuando dos criterios entran en tensión.

1. **Simplicidad proporcional a la escala real.** Blanc es un cliente único, 3–4 sucursales, sin evidencia de un equipo de ingeniería grande (principio 1.3 y Sección 0 de `02-architecture-principles.md`). Una tecnología más "potente" pero que exige operar infraestructura adicional sin un problema real que resuelva hoy pesa en contra, no a favor.
2. **Costo total**, no solo precio de licencia: incluye infraestructura, tiempo de operación/mantenimiento, y costo de salida (qué tan caro es migrar fuera si la elección resulta equivocada).
3. **Mantenibilidad**: madurez y tamaño de la comunidad, calidad de la documentación, curva de aprendizaje, y qué tan fácil es depurar un problema en producción con las herramientas del ecosistema elegido.
4. **Escalabilidad real, no especulativa**: ¿la opción alcanza cómodamente para 3→4→5 sucursales? ¿deja una puerta de salida razonable si el volumen crece más de lo proyectado, sin exigir sobre-diseño hoy (principio 1.4, "diseñar para poder extraer")?
5. **Integración con los ADRs ya congelados**: ¿la opción respeta Hexagonal/Clean/Vertical Slice (ADR-002) sin fricción artificial, la separación de esquemas por Bounded Context (ADR-005), el patrón Outbox (ADR-004), CQRS-lite (ADR-003), y el resto de decisiones ya tomadas? Una opción que exige violar o rodear un ADR ya vigente no se descarta automáticamente, pero se marca como el tipo de hallazgo que activa la regla de "contradicción real" de la portada de este documento.
6. **Experiencia/aptitud del equipo.** Ningún documento de este proyecto confirma el tamaño ni la composición exacta del equipo de ingeniería que va a construir e implementar esto. Ante esa ausencia de dato, este documento adopta como supuesto de trabajo explícito: **un equipo pequeño, generalista, con competencia razonable en el ecosistema TypeScript/Node.js**, sin asumir experiencia especializada en herramientas de nicho. Este supuesto favorece tecnologías mainstream sobre alternativas técnicamente superiores pero minoritarias, y se marca aquí como un supuesto a confirmar, no como un hecho.
7. **Adecuación específica a los casos de uso reales de Blanc** (Domain Discovery, Sección 6) — no "qué es popular en la industria", sino qué resuelve mejor: composición de servicio por uña vía lenguaje natural, no-doble-booking con concurrencia real, configuración multi-sucursal, integración con WhatsApp/IA/Calendario, y trazabilidad de decisiones de IA.

**Tensión declarada de antemano:** los criterios 1–3 (simplicidad, costo, mantenibilidad) tienden a favorecer plataformas gestionadas todo-en-uno; el criterio 5 (integración con ADRs, en particular la separación estricta de esquemas por Bounded Context y la independencia de proveedor exigida por Hexagonal) tiende a penalizar la misma clase de plataformas cuando empaquetan varias piezas (DB + Auth + Storage + Realtime) de forma difícil de desacoplar. Esta tensión se hace explícita en cada subsección de la Sección 3 donde aplica, en vez de resolverse de forma implícita a favor de un lado.

---

## 3. Selección de stack técnico

Cada subsección sigue: **opciones consideradas → evaluación contra los criterios de la Sección 2 → decisión**. La decisión es **firme** solo cuando es de bajo riesgo, reversible, y no depende de información de negocio no confirmada ni de un tradeoff material entre alternativas serias; en cualquier otro caso queda marcada **`Decision Pending`** con una recomendación justificada, tal como exige la regla de gobernanza de la portada.

### 3.1 Runtime / framework de backend

**Opciones consideradas:** NestJS (propuesta del cliente); Express o Fastify con estructura propia hecha a mano; Encore.ts.

**Evaluación:** el criterio que más pesa aquí es la integración con ADR-002. NestJS está construido alrededor de módulos + inyección de dependencias, lo cual mapea de forma casi directa a "puertos como interfaces, adaptadores como providers inyectables, un módulo por Bounded Context" — reduce la carga de que el propio equipo invente cómo materializar Hexagonal + Vertical Slice en código, justo el tipo de ambigüedad que agrava F-01 (acumulación de patrones). Express/Fastify son más minimalistas y exigirían que el equipo construya esa disciplina de módulos a mano, con más varianza posible entre desarrolladores. Ningún framework de esta lista tiene costo de licencia. NestJS tiene la comunidad más grande específicamente para el patrón "Node + TypeScript + arquitectura en capas" que este proyecto ya adoptó.

**Decisión: firme — NestJS.** No se marca `Decision Pending` porque, precisamente por el aislamiento que exige ADR-002, el framework de backend solo afecta la capa de adaptadores más externa, nunca el dominio — es una de las decisiones más baratas de revertir de todo este documento, y ninguna alternativa seria contradice ningún ADR.

### 3.2 Frontend

**Opciones consideradas:** Next.js (propuesta del cliente); React + Vite como SPA simple; Remix.

**Evaluación:** el frontend consume la API interna como un cliente más (ADR-014) — su elección no toca ninguna decisión arquitectónica ya congelada. La superficie real es un panel administrativo interno (los mismos roles y pantallas ya prototipados en `/mockup`), no un sitio público con necesidad de SEO/SSR — el argumento más fuerte de Next.js (renderizado en servidor) aporta poco aquí, porque casi todo vive detrás de autenticación. Aun así, Next.js es la opción de mayor adopción del ecosistema, tiene el mejor soporte de tooling, y fue la preferencia ya expresada por el cliente — nada en los criterios la descalifica, solo matiza que se use mayormente en modo cliente (client components), no que se fuerce SSR sin necesidad real.

**Decisión: firme — Next.js**, usado predominantemente en modo cliente. Bajo riesgo, reversible, sin dependencia de información no confirmada.

### 3.3 Motor y proveedor de base de datos

**Opciones consideradas:** el motor ya está fijado (PostgreSQL, ADR-005) — lo que queda abierto es el **proveedor**: Supabase (Postgres gestionado, propuesta del cliente), Neon (Postgres serverless con branching), addon de Postgres del proveedor de hosting elegido en 3.13, o un motor autoalojado (RDS/VM propia).

**Evaluación:** un proveedor gestionado gana claramente en los criterios 1 (simplicidad — sin parcheo/backups manuales), 3 (mantenibilidad) y 6 (experiencia de equipo asumida como generalista, no especializada en operar bases de datos). Ningún proveedor de esta lista impide la separación de esquemas por Bounded Context ni la prohibición de FKs cruzadas que exige ADR-005 — es simplemente PostgreSQL en los tres casos, la disciplina de separación vive en el código/migraciones, no en el proveedor. La diferencia real está en costo y en si conviene adoptar Supabase como plataforma completa (ver la tensión declarada en la Sección 2) o usarlo (o Neon) únicamente como Postgres gestionado, separando esa decisión de si también se adopta su Auth/Storage/Realtime (evaluados por separado en 3.7–3.9).

**Decisión: firme — Supabase (Postgres gestionado).** Cierra `P1` de `ARCHITECTURE_CLOSURE_PLAN.md` (2026-08-04): se adopta el conjunto Supabase completo (BD + Auth §3.9 + Storage §3.8 + Realtime §3.7), resuelto como una sola decisión coherente, tal como esta misma sección ya exigía ("depende de la decisión más amplia... acoplada a 3.7, 3.8 y 3.9"). Recomendación original preservada: un proveedor de PostgreSQL gestionado sobre autoalojar el motor.

### 3.4 ORM / capa de acceso a datos

**Opciones consideradas:** Prisma (propuesta del cliente); Drizzle ORM; TypeORM; Kysely (query builder tipado sin capa de ORM).

**Evaluación:** aquí el criterio 5 (integración con ADRs) genera una tensión real, no cosmética. Prisma soporta múltiples esquemas de Postgres desde sus versiones recientes (`schemas` + `@@schema(...)`), pero todo el modelo vive en un único archivo `schema.prisma` que lista las tablas de los 11 Bounded Contexts juntas — la frontera entre módulos queda en la disciplina de qué código importa qué, no en una barrera estructural. Drizzle, al definirse como objetos TypeScript normales, permite que cada módulo tenga su propio archivo de esquema que físicamente no se importa fuera de su carpeta — un cruce de frontera se nota como una importación fuera de lugar, más fácil de detectar en revisión de PR y de reforzar con un linter de dependencias (mitigación que F-02 ya pide para 15 de los 22 ADRs). A favor de Prisma: mejor tooling listo para usar (Prisma Studio, migraciones con diff automático) y curva de aprendizaje menor para un equipo generalista (criterio 6) — Drizzle exige más comodidad con SQL. TypeORM se descarta de la comparación activa por historial de mantenimiento menos estable que las otras dos opciones. Ninguna de las dos opciones serias (Prisma, Drizzle) contradice ADR-005; la diferencia es de qué tan bien **refuerzan estructuralmente** una disciplina que hoy depende de revisión manual.

**Decisión: firme — Drizzle.** Cierra `P1` (2026-08-04). Razón arquitectónica principal: Blanc depende fuertemente de mecanismos de PostgreSQL para sus invariantes más críticos (restricción `EXCLUDE` de no-doble-booking, `FOR UPDATE`/`FOR UPDATE SKIP LOCKED` para el reclamo de filas del Outbox, transacciones explícitas) — se prioriza una capa de acceso a datos delgada y cercana a SQL sobre la de mayor tooling (Prisma). Refuerza además, por diseño (un esquema por módulo en archivo propio, no importable fuera de su carpeta), el límite de Bounded Context que `ADR-001` ya exige por disciplina — el mismo riesgo sistémico F-02 que esta sección ya señalaba. **Prisma no estaba aprobado en ningún documento** — era la propuesta de referencia original del cliente (`blanc-requisitos-negocio.md`), evaluada aquí mismo como una de cuatro opciones, nunca cerrada; elegir Drizzle no reabre ninguna decisión ya tomada. **Riesgo aceptado, no bloqueante:** el equipo no tiene experiencia previa documentada con Drizzle/SQL directo — se registra como riesgo de curva de aprendizaje de la fase de implementación, no como motivo para mantener esta decisión abierta.

### 3.5 Cache

**Opciones consideradas:** Redis (propuesta del cliente); Valkey (fork open-source de Redis); Memcached.

**Evaluación:** el rol del cache ya está acotado por el principio 13.4 (`02-architecture-principles.md`): solo datos de lectura estables y de bajo riesgo (catálogo, horarios), nunca disponibilidad de horarios. Con ese alcance deliberadamente angosto, ningún criterio diferencia realmente entre Redis y Valkey (protocolo idéntico); Memcached carece de las estructuras de datos que además se necesitan si se adopta una cola respaldada en Redis (3.6), lo cual la descarta por adecuación práctica. Redis es, además, la base de datos que necesitaría BullMQ si esa es la cola elegida — hay sinergia real de infraestructura compartida si ambas decisiones convergen.

**Decisión: firme — Redis (o Valkey como alternativa de licencia equivalente en protocolo)**, con el alcance ya acotado por el principio 13.4. Bajo riesgo, sin tradeoff material entre las opciones serias.

### 3.6 Cola de background jobs

**Opciones consideradas:** BullMQ sobre Redis (propuesta del cliente); pg-boss o Graphile Worker, ambas respaldadas directamente en PostgreSQL sin infraestructura adicional.

**Evaluación:** esta decisión está acoplada a 3.5. Si Redis ya se adopta para cache, BullMQ no añade una pieza de infraestructura nueva y es la opción con más comunidad, mejor tooling (Bull Board) y el camino más documentado para exactamente lo que ADR-018 exige (reintentos con backoff, retraso/programación para recordatorios de 24h y expiración de retención de anticipo, dead-letter alertable). Si, en cambio, el equipo prefiere minimizar piezas de infraestructura y prescindir de Redis por completo, pg-boss/Graphile Worker cumplen el mismo contrato de ADR-018 usando solo PostgreSQL — una ganancia real de simplicidad (criterio 1) al costo de una comunidad/tooling más pequeños (criterio 3). Ambas rutas son compatibles con handlers idempotentes (ADR-021).

**Decisión: `Decision Pending`, acoplada a 3.5.** Recomendación: BullMQ si Redis ya se adopta para cache (aprovecha la misma infraestructura, mejor tooling); pg-boss si el equipo decide prescindir de Redis y prefiere un menor número de piezas operadas. Ambas satisfacen ADR-018/ADR-021 igual de bien — la decisión depende de la respuesta a 3.5, no de una diferencia de fondo aquí.

### 3.7 Canal realtime del panel de handoff

Resuelve el vacío **F-11** (`ARCHITECTURE_REVIEW.md`): ningún ADR definió el mecanismo de transporte para que un empleado vea mensajes casi en tiempo real mientras tiene el control de una conversación escalada (ADR-016).

**Opciones consideradas:** Supabase Realtime (propuesta del cliente, basada en replicación lógica de Postgres); Server-Sent Events (SSE) sobre el propio backend; WebSocket dedicado (ej. Socket.IO); un servicio de terceros (Pusher/Ably); polling simple por intervalo corto.

**Evaluación:** la necesidad real, tal como la describe ADR-016, es unidireccional (el servidor empuja mensajes nuevos al empleado; la respuesta del empleado ya viaja por una llamada HTTP normal, no por este mismo canal) — es exactamente la forma para la que existe SSE, sin necesitar un canal bidireccional. El polling resuelve el problema de forma más simple pero degrada la experiencia de "casi tiempo real" que el propio ADR-016 exige, y desperdicia recursos. Supabase Realtime es potente pero acopla el mecanismo de tiempo real a la elección de proveedor de base de datos (3.3) y exige integrar su propio modelo de autenticación con el esquema JWT ya decidido en ADR-010, en vez de reusarlo directamente. Un WebSocket dedicado (Socket.IO) es más flexible a futuro (si algún día se necesita bidireccionalidad real) pero introduce una capa con estado por conexión, en tensión con el principio 13.2 ("la capa de aplicación es sin estado") — manejable a esta escala, pero una complejidad que SSE no tiene. Tanto SSE como un WebSocket propio pueden autenticarse con el mismo JWT de ADR-010 sin capas de traducción adicionales.

**Decisión: firme — Supabase Realtime.** Cierra `P1` (2026-08-04): esta misma sección ya condicionaba esta elección a que "3.3/3.9 terminen adoptando el conjunto Supabase completo" — esa condición ya se cumplió (§3.3, §3.9). Se adopta por reducción de superficie de integración (un solo proveedor para BD+Auth+Storage+Realtime), tal como esta sección ya anticipaba, no por superioridad técnica sobre SSE para esta necesidad puntual — SSE sigue siendo, en términos puramente técnicos, la opción más simple si no se hubiera adoptado el conjunto Supabase. Este vacío (F-11) sigue siendo candidato a ADR nuevo — ver Sección 11; elegir el proveedor no cierra esa ratificación pendiente.

### 3.8 Storage de archivos

**Opciones consideradas:** Supabase Storage (propuesta del cliente); un proveedor compatible con S3 (Cloudflare R2, AWS S3, Backblaze B2).

**Evaluación:** ADR-017 exige object storage privado, URLs firmadas de expiración corta, retención acotada y un puerto que no acople el dominio a un proveedor específico. Cualquiera de las opciones cumple ese contrato. La diferencia real está en costo (R2 no cobra por salida de datos, relevante si el volumen de imágenes de referencia crece) y en qué tan intercambiable es el adaptador: un proveedor que habla la API estándar de S3 permite cambiar de proveedor con un cambio de configuración (endpoint) en vez de reescribir el adaptador, lo cual encaja mejor con el espíritu de puertos/adaptadores de ADR-002 que un SDK propietario.

**Decisión: firme — Supabase Storage.** Cierra `P1` (2026-08-04): esta misma sección ya anticipaba esta excepción — "salvo que la decisión de 3.3/3.9 sea adoptar el conjunto Supabase completo... en ese caso, Supabase Storage es una opción válida" — esa condición ya se cumplió. No es la opción de mejor ajuste aislado (un proveedor S3-compatible seguiría siendo preferible evaluado solo, por costo de salida), pero sí la de mejor ajuste dado el conjunto completo ya adoptado. El contrato de `ADR-017` (URLs firmadas de expiración corta, retención acotada) no cambia con esta elección de proveedor.

### 3.9 Autenticación

**Opciones consideradas:** Supabase Auth (propuesta del cliente); una implementación propia de JWT + refresh sobre NestJS; un proveedor de identidad gestionado (Auth0, Clerk); Keycloak autoalojado.

**Evaluación:** este es uno de los puntos de mayor riesgo asimétrico del documento — un error de seguridad "aproximadamente correcto" en una implementación propia es peor que casi cualquier alternativa gestionada, porque falla en silencio hasta que alguien lo explota. ADR-010 exige: JWT de corta duración con claims de rol + alcance de sucursal, refresh token revocable con rotación y detección de reuso, MFA obligatorio para Super Admin/Administrador, y RBAC en dos niveles (middleware + revalidación en el caso de uso de dominio) con auditoría append-only. Los proveedores gestionados (Supabase Auth, Auth0, Clerk) cubren razonablemente bien la mecánica de credenciales/sesión/rotación/MFA — pero el segundo nivel de RBAC (revalidación a nivel de caso de uso) y el log de auditoría append-only son lógica de aplicación propia de Blanc en cualquier caso, ningún proveedor los sustituye. Esto reduce la diferencia real entre opciones a "quién gestiona la mecánica de credenciales", no a "quién implementa el modelo de permisos completo". No he validado en vivo si la rotación con detección de reuso de Supabase Auth cumple exactamente el contrato que ADR-010 describe — es un análisis de documentación, no una prueba directa.

**Decisión: firme — Supabase Auth.** Cierra `P1` (2026-08-04), consistente con la convergencia ya cerrada en §3.3 ("por simplicidad de un solo proveedor"). El modelo de claims de rol+sucursal, la revalidación en el dominio, y la auditoría append-only siguen siendo código propio de Blanc sobre este proveedor, sin cambio respecto a lo ya descrito.

**No declarado como validado en producción.** Esta sección exigía explícitamente, antes de dar la elección por cerrada, "validar de forma directa (no solo documental) que el proveedor soporta rotación de refresh token con detección de reuso equivalente a lo que `ADR-010` exige" — esa validación **no se ha realizado todavía**; esta decisión cierra la **elección de proveedor**, no certifica su comportamiento en producción. Se registra explícitamente como tarea de verificación de Fase 1 (Definition of Done del módulo Identidad y Accesos, `IMPLEMENTATION_MASTER_PLAN.md` §8), no como precondición para empezar a construir.

### 3.10 Integración con el proveedor de IA

**Opciones consideradas:** el proveedor ya está fijado (OpenAI, ADR-007). Lo que queda abierto es la superficie de API concreta: Responses API (propuesta del cliente, unifica function-calling + salida estructurada + herramientas), Chat Completions API con parámetros de `tools`/`response_format`, o la Assistants API (con estado de conversación gestionado del lado de OpenAI).

**Evaluación:** la Assistants API introduce su propio modelo de "threads" con estado de conversación persistido del lado de OpenAI — esto compite directamente con `Conversacion`/`Mensaje`, que el Domain Discovery (5.3) ya define como el aggregate dueño de esa historia. Adoptarla crearía dos sistemas de registro para lo mismo, en tensión directa con que el dominio (no un proveedor externo) sea la fuente de verdad — este no es un tradeoff cerrado entre opciones igualmente válidas, es una de las dos rutas que contradice un principio ya estable (ADR-002/007: la IA interpreta, no posee estado de negocio). La Responses API (o, en su defecto, Chat Completions con salida estructurada) mantiene a OpenAI sin estado de conversación propio: cada llamada recibe el contexto que el dominio decide enviarle, y la salida estructurada valida contra un esquema antes de tocar cualquier caso de uso (ADR-007).

**Decisión: firme — Responses API (o Chat Completions con salida estructurada si en el momento de implementar la Responses API no está suficientemente madura), sin usar el modelo de threads con estado de la Assistants API.** No se marca `Decision Pending` porque la alternativa descartada no es una opción seria igualmente válida — contradice un principio ya congelado, no es una cuestión de preferencia.

### 3.11 Integración con WhatsApp — Business Solution Provider

Resuelve el vacío **F-21** (`ARCHITECTURE_REVIEW.md`): ADR-008 ya decidió usar la API oficial de WhatsApp Business Platform, pero no a través de qué proveedor de acceso.

**Opciones consideradas:** acceso directo a la Cloud API de Meta (sin intermediario); un Business Solution Provider comercial (ej. Twilio, 360dialog, Infobip, Gupshup, entre otros — se nombran como ejemplos de categoría, no como preselección).

**Evaluación:** el acceso directo evita una segunda capa de dependencia de proveedor además de Meta misma (exactamente la preocupación que F-21 señaló) y evita cualquier margen adicional sobre el costo por conversación que Meta ya cobra. Un BSP comercial normalmente aporta mejor tablero de gestión de plantillas, mejor visibilidad de salud del número, y soporte humano durante el aprovisionamiento — valioso dado que ningún documento confirma experiencia previa del equipo con WhatsApp Business Platform (criterio 6), y ADR-008 ya identificó el tiempo de aprovisionamiento como un riesgo real de cronograma. El contrato del webhook (resuelto en la Sección 4.4) es esencialmente el mismo formato de Meta se acceda directo o vía la mayoría de BSPs, aunque algunos BSPs normalizan el payload a su propio formato, lo cual añade una capa de traducción pero puede simplificar una futura abstracción multi-proveedor.

**Decisión: `Decision Pending`.** Depende de una comparación real de costo/soporte con proveedores concretos que este documento no puede cerrar sin cotizaciones actuales. Recomendación: evaluar 1–2 BSPs con buena reputación de soporte de aprobación de plantillas (ej. Twilio, 360dialog, como punto de partida de la comparación, no como preselección) contra el acceso directo, priorizando el que reduzca más el riesgo de fricción de aprovisionamiento ya señalado por ADR-008.

### 3.12 Google Calendar API

Ya decidido por ADR-006 (la plataforma es la fuente de verdad; Google Calendar es una proyección de solo lectura). No existe una decisión de proveedor aquí — es la API de Google, sin alternativa de mercado. El único detalle técnico es la librería cliente oficial de Google para Node (`googleapis`).

**Decisión: firme — librería oficial `googleapis`.** Sin alternativas serias que evaluar; no aplica `Decision Pending`.

### 3.13 Hosting

**Opciones consideradas:** Railway (propuesta del cliente); Render; Fly.io; infraestructura propia sobre un proveedor cloud general (AWS/GCP) con orquestación manual.

**Evaluación:** Railway, Render y Fly.io son plataformas diseñadas explícitamente para el perfil "equipo pequeño, un solo desplegable, pocos entornos" — todas satisfacen ADR-001 (un solo desplegable) y ADR-012 (tres entornos, despliegue rolling/blue-green, verificación de salud) sin fricción, muy por encima de lo que costaría ensamblar esa misma capacidad a mano sobre AWS/GCP (el costo de ingeniería de configurar esa infraestructura es un costo real, criterio 2, aunque el cómputo crudo sea más barato). Entre las tres, Fly.io está más orientada a distribución global de baja latencia, algo que Blanc no necesita (negocio de una sola región, CDMX). Ninguna de las tres contradice ningún ADR. No se ha validado en vivo el soporte exacto de despliegue rolling/blue-green con rollback automático por chequeo de salud en cada plataforma — este análisis es documental, no una prueba directa contra el contrato exacto que exige ADR-012.

**Decisión: firme — Railway.** Cierra `P1` (2026-08-04): es la propuesta original del cliente (`blanc-requisitos-negocio.md`) y una de las tres opciones PaaS ya evaluadas como igualmente válidas para esta escala, sin que ninguna contradiga un ADR.

**No declarado como validado en producción.** Esta sección ya advertía: "No se ha validado en vivo el soporte exacto de despliegue rolling/blue-green con rollback automático por chequeo de salud... este análisis es documental, no una prueba directa contra el contrato exacto que exige `ADR-012`" — esa validación **no se ha realizado todavía**. Se registra explícitamente como tarea de verificación de Fase 1 (configuración real de Sandbox, `IMPLEMENTATION_MASTER_PLAN.md` §13), no como precondición para empezar a construir.

### 3.14 Backend de observabilidad

**Opciones consideradas:** el estándar de instrumentación ya está fijado (OpenTelemetry, ADR-011). Para el backend que lo recibe y visualiza: Grafana + Loki + Tempo autoalojados (propuesta del cliente); una alternativa gestionada compatible con OTel (Grafana Cloud, Better Stack, Axiom, u otras).

**Evaluación:** autoalojar Grafana/Loki/Tempo añade tres servicios más que operar, parchear y respaldar — precisamente la clase de complejidad operativa que el principio de simplicidad proporcional (1.3) desaconseja para este tamaño de proyecto; de forma un poco irónica, el equipo necesitaría observar su propia pila de observabilidad. Una opción gestionada elimina ese mantenimiento por un costo de suscripción predecible, con niveles gratuitos o económicos que casi con certeza cubren el volumen real de logs/trazas de Blanc a esta escala. ADR-011 fijó el protocolo precisamente para que el backend fuera intercambiable sin reinstrumentar código — cualquier opción compatible con OpenTelemetry cumple el ADR igual de bien.

**Decisión: `Decision Pending` en el proveedor específico, con una guía firme dentro de ella.** Firme: un backend gestionado compatible con OpenTelemetry, no autoalojar Grafana/Loki/Tempo, dado lo desproporcionado de esa carga operativa para el tamaño real del proyecto. Pendiente: cuál proveedor gestionado específico — es una comparación de precio/features que cambia con el tiempo y no se cierra aquí.

### 3.15 CI/CD

**Opciones consideradas:** GitHub Actions (propuesta del cliente, asume GitHub como alojamiento del código); GitLab CI; CircleCI.

**Evaluación:** nada en ningún documento sugiere un alojamiento de código distinto de GitHub, y GitHub Actions es la opción de menor fricción en ese caso (sin proveedor adicional, integración directa con el flujo de Pull Request). Esto último importa más de lo que parece: F-02 (`ARCHITECTURE_REVIEW.md`) señala que 15 de los 22 ADRs dependen de "revisión de PR obligatoria" como mitigación principal, y la propia review recomienda reforzarla con controles automatizados (linter de límites de módulo, linter de compatibilidad de migraciones — F-25) — tenerlos como checks de GitHub Actions directamente en la vista de PR refuerza exactamente esa mitigación, en vez de dejarla como buena intención.

**Decisión: firme — GitHub Actions**, bajo el supuesto explícito de que GitHub es la plataforma de repositorios del proyecto (ningún documento lo confirma formalmente; se asume como opción por defecto al no existir indicación de lo contrario). Si ese supuesto resultara incorrecto, es la única entrada de esta subsección que cambiaría — el resto del análisis (CI/CD como vehículo de los controles automatizados de F-02/F-25) no depende de cuál sea específicamente la plataforma de repositorios. Sin tradeoff material frente a las alternativas para este proyecto, dado ese supuesto.

### 3.16 Nota de síntesis: las decisiones acopladas al "conjunto Supabase"

Las subsecciones 3.3 (base de datos), 3.7 (realtime), 3.8 (storage) y 3.9 (autenticación) no eran cuatro decisiones independientes — las cuatro dependían de una misma pregunta: **¿se adopta el conjunto Supabase completo por simplicidad de un solo proveedor, o se elige el mejor ajuste individual por servicio?**

**Resuelto (2026-08-04, cierre de `P1`):** se adopta el **conjunto Supabase completo** (BD + Realtime + Storage + Auth) como una sola decisión coherente, exactamente para evitar el riesgo de combinación inconsistente que este párrafo advertía. Las cuatro subsecciones (§3.3, §3.7, §3.8, §3.9) ya reflejan esta resolución individualmente.

---

## 4. Arquitectura de componentes y despliegue

Esta sección describe cómo se organizan los componentes internos y su despliegue — sin esquema de base de datos ni contratos de API, que son objeto de `04-data-model.md` y `05-api-design.md`.

### 4.1 Mapa de módulos internos

Cada uno de los 11 Bounded Contexts del Domain Discovery (§4) se implementa como un módulo con frontera estricta (ADR-001, ADR-002): expone únicamente sus casos de uso públicos (la capa de aplicación organizada en Vertical Slices, ADR-002 §4) y **nunca** sus entidades de persistencia ni su esquema interno a otro módulo. Un módulo que necesita un dato de otro contexto lo pide a través de ese caso de uso público, o lo consume vía domain event (ADR-004) — nunca por acceso directo a datos.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Conversación                             │
│  (adaptador driving sobre el dominio — principio 9.8 de          │
│   02-architecture-principles.md, ADR-007)                        │
└───────────┬─────────────┬─────────────┬─────────────┬───────────┘
            │ invoca      │ invoca      │ invoca      │ publica evento
            ▼             ▼             ▼             ▼ (consistencia
      ┌──────────┐  ┌───────────┐ ┌──────────┐   eventual, DD §5.11)
      │  Agenda  │  │ Catálogo y│ │ Clientas │  ┌──────────────┐
      │          │  │ Cotización│ │  (CRM)   │  │ Escalamiento │
      └────┬─────┘  └───────────┘ └────┬─────┘  └──────┬───────┘
           │ eventos                   │ eventos        │ eventos
           ▼                           ▼                ▼
      ┌─────────────────────────────────────────────────────────┐
      │              Bus de eventos en proceso + Outbox           │
      │                        (ADR-004)                          │
      └───┬──────────┬──────────────┬───────────────┬────────────┘
          ▼          ▼              ▼               ▼
    ┌──────────┐ ┌─────────┐ ┌──────────────┐ ┌────────────┐
    │Anticipos │ │ Notifi- │ │ Sincronización│ │ Analítica  │
    │          │ │caciones │ │ de Calendario │ │(read-model)│
    └──────────┘ └─────────┘ └──────────────┘ └────────────┘

  Sucursales y Personal, Identidad y Accesos: módulos transversales
  de configuración/seguridad, consultados por casi todos los anteriores.
```

Este diagrama es una vista de dependencias de invocación/eventos, no un esquema de datos ni un contrato de API — ambos se definen en los documentos siguientes de esta serie. La relación `Conversación → Escalamiento` se dibuja deliberadamente distinta de las otras tres: el Domain Discovery (§5.11) clasifica el par `Conversacion ↔ TicketEscalamiento` como uno de los tres casos de consistencia eventual entre aggregates, no como invocación síncrona de un caso de uso — `Conversación` publica el evento que dispara la creación del ticket, nunca invoca a `Escalamiento` directamente.

### 4.2 Comunicación interna: bus de eventos y Outbox

Confirma ADR-004: los domain events se publican y consumen dentro del mismo proceso mediante un bus en memoria (patrón mediador); para los eventos con efectos externos críticos (notificación de WhatsApp, sincronización con Google Calendar, flujo de anticipos), cada Bounded Context productor mantiene su propia tabla de outbox **dentro de su propio esquema** (consistente con la separación estricta de ADR-005 — ninguna tabla de outbox es compartida entre contextos), con los campos conceptuales mínimos que el patrón exige: identificador del evento, tipo, payload, estado de despacho y marcas de tiempo. Un proceso de despacho separado lee estas tablas y garantiza la entrega con reintentos.

**Vacío detectado (F-03, `ARCHITECTURE_REVIEW.md`):** ningún ADR especifica cómo el proceso de despacho evita procesar la misma fila de outbox dos veces si el sistema llega a correr más de una instancia (permitido explícitamente por el principio de escalabilidad 13.2/13.3 para alta disponibilidad, no necesariamente por volumen). Esto **no estaba cerrado en ningún ADR** — es territorio nuevo, no una contradicción con algo ya decidido.

**`Decision Pending` — mecanismo de reclamo exclusivo de filas del Outbox.**
- *Opciones consideradas:* (a) un único proceso dispatcher activo aunque la aplicación corra en varias instancias (más simple, evita el problema por diseño, con el costo de que ese despacho específico no tiene alta disponibilidad propia — aunque la durabilidad del Outbox ya evita perder el evento, solo retrasa su entrega); (b) reclamo exclusivo de filas vía `SELECT ... FOR UPDATE SKIP LOCKED` (patrón estándar de PostgreSQL para colas, usado por pg-boss/Graphile Worker, permite múltiples dispatchers compitiendo de forma segura); (c) un lock distribuido externo (ej. Redis) — descartado por añadir una dependencia adicional para resolver un problema que PostgreSQL ya resuelve nativamente.
- *Evaluación:* a la escala real de Blanc (proceso único hoy, ADR-001), la Opción (a) es suficiente y la más simple. La Opción (b) es el mismo costo de implementación que ya pagaría un dispatcher basado en PostgreSQL (pg-boss/Graphile Worker ya usan este patrón internamente) y deja el sistema listo para el gatillo de revisión que el principio de escalabilidad 13.2/13.3 (`02-architecture-principles.md`), ya citado en esta subsección, define (necesidad de múltiples instancias por disponibilidad) sin rediseño posterior.
- *Recomendación:* implementar el despacho con reclamo `FOR UPDATE SKIP LOCKED` desde el inicio, aunque se opere con una sola instancia hoy — el costo adicional es marginal y evita un rediseño cuando se cumpla el gatillo de ADR-004. Se marca `Decision Pending` (no firme) porque es una decisión que faltaba en ADR-004 y merece ratificarse explícitamente, no asumirse por implementación — ver candidato a ADR en la Sección 11.

**Nota de alcance — read-model de disponibilidad (ADR-003):** ADR-003 aplica CQRS-lite también a la búsqueda de disponibilidad dentro de `Agenda`, no solo a Analítica (cubierta en §6.3). El diseño concreto de ese read-model (tabla propia, vista materializada, u otro mecanismo) se desarrolla en `04-data-model.md`, no en este documento.

### 4.3 Vista de despliegue

Un solo artefacto desplegable (Modular Monolith, ADR-001), corriendo como un único proceso Node/NestJS por entorno. Tres entornos (ADR-012): **Development** (interno), **Sandbox** (credenciales de WhatsApp/IA/Calendario propias, aisladas de producción — donde se validan cambios de prompt y configuración antes de publicarse) y **Production**. El pipeline promueve automáticamente hacia Sandbox; una puerta de aprobación manual precede la promoción a Production. La capa de aplicación es sin estado (principio 13.2) — el estado de conversación, sesión y disponibilidad vive en PostgreSQL/cache, nunca en memoria del proceso — lo que permite correr más de una instancia por disponibilidad sin rediseño, aunque hoy no hay evidencia de que el volumen lo requiera (ADR-001, gatillos de revisión). Esta vista es independiente del proveedor de hosting específico (`Decision Pending`, §3.13) — cualquiera de los candidatos de esa sección soporta esta misma topología.

### 4.4 Integración de WhatsApp

**Vacío detectado (F-27, `ARCHITECTURE_REVIEW.md`, severidad Critical):** ningún ADR especifica que el procesamiento de un mensaje entrante de WhatsApp (incluida la llamada al LLM) debe desacoplarse del acknowledgment del webhook. Procesar de forma síncrona dentro del ciclo de request del webhook es la causa más documentada de reintentos y duplicados en integraciones de este tipo — la propia review lo marca como el hallazgo más severo de toda la arquitectura junto con F-01.

**`Decision Pending` — patrón de ingesta del webhook de WhatsApp.**
- *Opciones consideradas:* (a) procesar el mensaje de forma síncrona dentro del handler del webhook (la que la review ya identificó como el anti-patrón a evitar — se incluye aquí solo para descartarla explícitamente, no como alternativa seria); (b) responder `200 OK` de inmediato al recibir el webhook y encolar el mensaje para procesamiento asíncrono (ADR-018) antes de invocar cualquier lógica de dominio o de IA; (c) responder de inmediato y procesar en un hilo/proceso secundario sin pasar por la cola durable (más rápido de implementar, pero renuncia a las garantías de reintento/dead-letter que ADR-018 ya exige para el resto del sistema).
- *Evaluación:* la Opción (b) es la única consistente con ADR-018 (que ya exige cola durable con reintentos para todo proceso diferido) y con ADR-021 (idempotencia en el punto de entrada, usando el ID de mensaje de WhatsApp como clave de idempotencia natural). La Opción (c) introduce una segunda vía de procesamiento diferido sin las garantías que el resto del sistema ya tiene, una inconsistencia interna que no se justifica.
- *Recomendación:* Opción (b) — ack inmediato del webhook, encolado del mensaje crudo (payload de WhatsApp) como job idempotente (clave = ID de mensaje de WhatsApp), y todo el pipeline de interpretación de IA + casos de uso de dominio ocurre dentro del handler del job, no del webhook. Se marca `Decision Pending` y no firme, pese a la confianza alta en la recomendación, porque la propia review pidió explícitamente que esto se ratifique como una decisión formal (candidata a ADR — ver Sección 11), no que se asuma silenciosamente en la implementación.

### 4.5 Integración de IA

Confirma el principio 9.8 (`02-architecture-principles.md`) y ADR-007: el módulo `Conversación` es un adaptador *driving* sobre los casos de uso de `Agenda`, `Catálogo y Cotización`, `Clientas`, etc. — nunca al revés. El flujo (ya resuelto, sin vacío): mensaje encolado (§4.4) → el handler del job arma el contexto de conversación desde `Conversacion`/`MemoriaDeConversacion` (dominio, no el proveedor de IA — ver §3.10) → llamada a OpenAI vía el puerto `ProveedorDeIA` con salida estructurada → la salida se valida contra esquema antes de invocar el caso de uso de dominio correspondiente (`ConfirmarCita`, `CotizarComposicionDeServicio`, etc., ADR-007 §Decision) → el resultado (éxito, ambigüedad, o fallback) se registra con el detalle de trazabilidad que exige el principio 9.4 (`02-architecture-principles.md`) y ADR-011 (observabilidad de IA como categoría propia).

### 4.6 Integración de Google Calendar

Confirma ADR-006: un adaptador de salida (Anti-Corruption Layer) traduce los domain events de `Cita` (`CitaConfirmada`, `CitaReagendada`, `CitaCancelada`, etc.) a llamadas de la API de Google Calendar, despachadas vía el mismo mecanismo de Outbox de §4.2 (uno de los efectos externos críticos que ADR-004 ya exige despachar vía Outbox, junto con la notificación de WhatsApp y el flujo de anticipos). Esto es distinto de los tres pares de consistencia eventual entre aggregates internos del Domain Discovery §5.11 (que incluyen `Cita ↔ SolicitudAnticipo`, no la sincronización de calendario): aquí no hay un segundo aggregate propio al otro lado, sino un sistema externo consumiendo eventos a través de un ACL — la misma mecánica de despacho, pero una categoría distinta de relación. La sincronización es unidireccional (plataforma → Google Calendar); no hay lectura de Google Calendar como fuente de disponibilidad ni de estado, consistente con que `Agenda` es la única fuente de verdad.

### 4.7 Feature flags y modo mantenimiento (ADR-020)

Confirma ADR-020: los feature flags se usan exclusivamente para (a) kill-switch de emergencia (detener un bot específico o todos) y (b) rollout gradual de un caso de uso o versión de prompt (ADR-015) a un subconjunto de sucursales antes de expandirse a todas — nunca como mecanismo de configuración de negocio por sucursal, que ya vive como dato en `Sucursales y Personal`. El punto de evaluación del flag es el mismo handler del job de §4.4: antes de invocar el pipeline de IA/casos de uso de dominio (§4.5), el handler consulta el estado del kill-switch para la sucursal/bot correspondiente. El propio ADR-012 señala como riesgo no resuelto qué ocurre con un mensaje entrante mientras el modo mantenimiento está activo — este documento no cierra ese comportamiento exacto; el ack inmediato del webhook (§4.4) ya ocurre independientemente del estado del flag, por lo que ningún mensaje se pierde, pero qué hacer con el mensaje ya encolado durante mantenimiento queda como detalle de implementación del handler del job.

---

## 5. Seguridad técnica concreta

Esta sección aterriza ADR-010 en mecanismos técnicos concretos y resuelve el vacío F-13. No define esquema de tablas de usuarios/roles (→ `04-data-model.md`) ni contratos de autenticación de la API (→ `05-api-design.md`).

### 5.1 Modelo de tokens

Confirma ADR-010, Opción C: access token JWT de vida corta (minutos) con claims de rol y de alcance de sucursal(es) asignadas; refresh token de vida más larga, rastreado del lado del servidor (no un JWT stateless), con rotación obligatoria en cada uso. La detección de reuso (un refresh token ya rotado que se vuelve a usar invalida toda la cadena de sesión, tal como exige el análisis de Riesgos de ADR-010) requiere que el almacén de refresh tokens sea consultable y mutable en tiempo real — esto acopla la elección de dónde vive ese almacén con la decisión de autenticación de §3.9, sin abrir una alternativa nueva aquí.

### 5.2 RBAC en dos niveles

Confirma ADR-010: autorización gruesa por middleware (rol/endpoint) y revalidación fina a nivel de caso de uso de dominio (ej. "solo Recepcionista o superior puede aprobar la salida de una clienta de lista roja"). El claim de sucursal(es) del token alimenta ambos niveles — el middleware puede rechazar por sucursal fuera de alcance antes de llegar al caso de uso, pero el caso de uso vuelve a validar el mismo dato de forma independiente (defensa en profundidad, ya justificada en ADR-010, sin vacío nuevo). El alcance exacto de qué rol ve qué dato por sucursal permanece atado a la Pregunta Abierta #11 del Domain Discovery, heredada tal cual (no se resuelve en este documento).

### 5.3 MFA para roles elevados

Confirma ADR-010: MFA obligatorio para Super Admin y Administrador como mínimo. El proveedor concreto del segundo factor (TOTP genérico vs. el mecanismo que ofrezca el proveedor de autenticación elegido en §3.9) queda subordinado a esa decisión — no es una alternativa independiente que este documento deba evaluar por separado.

### 5.4 Auditoría append-only

Confirma ADR-010: registro de solo-anexado (sin update/delete de aplicación) para cambios de configuración, acciones financieras (anticipos), asignación/remoción de lista roja, y toda decisión de IA con efecto de negocio. Este mismo registro es el punto de fricción real de la Sección 6.4 (F-14) — el "qué tan detallado" del contenido conversacional dentro de este log de auditoría no se cierra aquí, se resuelve ahí para no duplicar el análisis.

### 5.5 Gestión de secretos y resolución de F-13

**Vacío detectado (F-13, `ARCHITECTURE_REVIEW.md`, severidad Medium):** las credenciales de WhatsApp de las 3–4 sucursales, tratadas como secretos por ADR-010, no tienen segregación de alcance definida — si el gestor de secretos no aísla el acceso por sucursal, el compromiso de una sola credencial podría exponer las cuatro simultáneamente (blast radius de 1 a 4).

Este vacío no requiere evaluar alternativas serias (no hay una razón de negocio ni técnica para *no* segregar), por lo que se resuelve de forma directa y no se marca `Decision Pending`: el gestor de secretos elegido debe almacenar y controlar el acceso a las credenciales de WhatsApp de cada sucursal de forma aislada entre sí (un secreto por sucursal, con permisos de lectura independientes), no como un bloque único de configuración compartido. El propio `ARCHITECTURE_REVIEW.md` lo clasifica como aclaración a ADR-010, no como una decisión nueva — se trata en consecuencia como una restricción de diseño firme sobre cualquier gestor de secretos que se elija. Este vacío (F-13) es candidato a aclaración de ADR-010 — ver Sección 11.

El gestor de secretos específico (integrado en la plataforma de hosting de §3.13, en el proveedor de autenticación de §3.9, o un producto dedicado como Doppler/Infisical) sí permanece `Decision Pending`, acoplado a esas dos decisiones — no se preselecciona aquí ninguno.

---

## 6. Observabilidad técnica concreta

Esta sección aterriza ADR-011 en mecanismos concretos, resuelve el vacío F-24 (SLOs numéricos) y resuelve F-14 (tensión ADR-007 vs. ADR-017/ADR-022).

### 6.1 Correlación end-to-end

Confirma ADR-011: un ID de correlación único se genera en el punto de entrada (creación o continuación del job de §4.4) y se propaga por todo el flujo (job → contexto de dominio → llamada a IA → caso de uso → domain event → notificación de salida), siguiendo el estándar de trazas de OpenTelemetry. No hay vacío aquí — es una exigencia de convención de código, no una decisión de infraestructura pendiente.

### 6.2 Instrumentación de IA como categoría propia

Confirma ADR-011: cada llamada al proveedor de IA (§3.10) registra latencia, tokens, costo, versión de prompt (ADR-015) y resultado (éxito/ambigüedad/fallback a humano), como métrica de primera clase, no como subproducto de un log genérico.

### 6.3 SLOs numéricos — resolución de F-24

**Vacío detectado (F-24, `ARCHITECTURE_REVIEW.md`, severidad Medium):** ADR-011 fija la filosofía de observabilidad, pero ningún ADR define umbrales numéricos concretos de alerta — la propia review señala esto como bloqueante antes de operar con clientas reales, y pide explícitamente que los SLOs se definan como parte de la salida de este documento.

**`Decision Pending` — valores numéricos de SLO.**
- *Opciones consideradas:* (a) no fijar ningún número todavía, dejarlo para cuando exista tráfico real (mantiene el vacío que F-24 señaló como bloqueante); (b) fijar valores iniciales conservadores, explícitamente provisionales y sujetos a ajuste con datos reales de producción (mismo patrón ya usado y aceptado en ADR-022 para RPO/RTO); (c) importar SLOs genéricos de la industria sin adaptarlos al perfil real de Blanc (riesgo de umbrales mal calibrados para un sistema de este tamaño).
- *Evaluación:* la Opción (a) deja exactamente el vacío que la review pidió cerrar. La Opción (c) no está justificada por ningún dato del proyecto. La Opción (b) sigue el mismo patrón ya aceptado por el cliente en ADR-022 (RPO ≤ 15 min / RTO ≤ 4 h "provisional, sujeto a confirmación") — es consistente con cómo este proyecto ya trata la incertidumbre de umbrales sin bloquear el desarrollo.
- *Recomendación:* fijar, como valores iniciales provisionales (mismo estatus que los de ADR-022 — sujetos a revisión con datos reales de las primeras semanas de operación, con dueño explícito de esa revisión):
  - Rezago del dispatcher de Outbox (§4.2): alertar si una fila permanece sin despachar **> 5 minutos**.
  - Rezago del read-model de Analítica (CQRS-lite, ADR-003): alertar si el retraso respecto al último evento de dominio supera **15 minutos**.
  - Tasa de error de integración externa (WhatsApp/IA/Google Calendar, ADR-013): alertar si el circuit breaker de una dependencia abre, o si la tasa de error de una dependencia supera **5% en una ventana de 5 minutos**.
  - Cola de background jobs (ADR-018): alertar si el dead-letter recibe **cualquier job** (no hay volumen "normal" aceptable de fallos definitivos sin revisión humana).
  - Notificación de escalamiento humano (ADR-016): alertar si una notificación de handoff no se entrega en **2 minutos** — dado que este es, por diseño, el camino de última instancia cuando la IA no puede resolver algo.

  Se marca `Decision Pending` (no firme) porque son cifras de arquitecto sin validación de tráfico real, exactamente como ya se aceptó para ADR-022 — no porque exista una alternativa técnica seria distinta a evaluar. No se marca como candidato a ADR en la Sección 11: `ARCHITECTURE_REVIEW.md` clasifica explícitamente este punto como parámetro operativo ("No a ADR-011 — son parámetros operativos, no una decisión arquitectónica distinta"), consistente con que ADR-011 ya previó esta definición como su propio "Future Revisit Criteria" sin necesitar una enmienda formal. Se mantiene como decisión operativa de este documento, revisable con datos reales (§9.5).

**Nota de trazabilidad (2026-08-04) — posible tensión con un requisito de negocio identificado después de esta sección.** `RN-AGE-09` (`docs/business-rules/01-agenda.md`, confirmada por la Dueña el 2026-08-03) exige que la sincronización con Google Calendar sea "en tiempo real o cerca de eso". El SLO ya fijado arriba para el rezago del dispatcher de Outbox — el mismo mecanismo que despacha la sincronización de calendario, ver §4.6 — es "alertar si una fila permanece sin despachar **> 5 minutos**". Ambos hechos ya están documentados por separado; nadie los ha cotejado todavía. Se registra aquí, sin resolverlo:
- El requisito de "tiempo real o cerca de eso" se identificó el 2026-08-04, posterior a la redacción original de este SLO.
- No existe todavía una definición cuantitativa de qué cuenta como "cerca de eso" — es una expresión de la Dueña, no una cifra confirmada.
- Requiere validación (cotejar el valor numérico del SLO contra esa expectativa) antes de que el diseño del dispatcher de Outbox se dé por final.
- Esta nota no implica modificar el mecanismo de Outbox ni el valor del SLO ahora mismo — queda cubierta por el propio gatillo de revisión de `Decision Pending` ya declarado en esta sección y en §9.5.

### 6.4 Resolución de F-14: trazabilidad de IA vs. minimización de datos personales

**Contradicción detectada entre dos ADRs ya congelados (F-14, `ARCHITECTURE_REVIEW.md`, severidad High):** ADR-007 exige trazabilidad total de las decisiones de IA — en la práctica, esto incluye el contenido conversacional real (lo que la clienta escribió, lo que el modelo interpretó). ADR-017 y ADR-022 exigen minimización y retención acotada de datos personales sobre ese mismo contenido. Ningún ADR resuelve cuál principio prevalece cuando el mismo dato es, a la vez, registro de auditoría de IA y dato personal sujeto a minimización.

Esta tensión **no fue descubierta por este documento** — ya estaba identificada como hallazgo High en `ARCHITECTURE_REVIEW.md`, y el propio review recomienda resolverla "posiblemente como enmienda conjunta a ADR-007/ADR-017/ADR-022". El plan de trabajo aprobado para este documento ya asignó su tratamiento a esta sección (§6), como análisis con recomendación marcado `Decision Pending` — no como una contradicción nueva que detenga la redacción, sino como el vacío de gobernanza que este documento tiene instrucción explícita de resolver aquí.

**`Decision Pending` — política de retención diferenciada dentro del registro de auditoría de IA.**
- *Opciones consideradas:* (a) retener el contenido conversacional textual completo indefinidamente junto con el resto del registro de auditoría (satisface ADR-007 al pie de la letra, viola directamente ADR-017/ADR-022); (b) minimizar/purgar el contenido conversacional agresivamente y conservar solo metadatos de la decisión (satisface ADR-017/ADR-022, viola ADR-007 — una disputa de cliente o una auditoría de calidad de IA no podría reconstruir qué se interpretó realmente); (c) retención diferenciada dentro del mismo registro: los metadatos de la decisión de IA (qué caso de uso se invocó, qué prompt/versión, resultado, confianza, ID de correlación) con retención larga alineada a auditoría (ADR-010/ADR-022), y el contenido conversacional textual crudo con una retención corta separada, acotada por la política de minimización de ADR-017/ADR-022.
- *Evaluación:* (a) y (b) sacrifican por completo uno de los dos ADRs ya aceptados por el cliente — ninguna de las dos es aceptable sin reabrir esos ADRs, algo que este documento no está autorizado a hacer. (c) es la única opción que honra ambos requisitos simultáneamente, y es exactamente la dirección que el propio `ARCHITECTURE_REVIEW.md` sugiere como solución probable.
- *Recomendación:* Opción (c). El registro de auditoría de decisiones de IA (ADR-010) separa dos capas de retención dentro del mismo evento lógico: metadatos de decisión (retención larga, régimen de ADR-022 para datos de auditoría) y contenido conversacional textual (retención corta, régimen de ADR-022 para datos personales/conversacionales, sujeto también a que se confirme el marco regulatorio de la Pregunta Abierta #12 del Domain Discovery). El valor exacto de "corta" para el contenido conversacional no se fija aquí — depende de la misma pregunta abierta #12 que ya deja pendiente ADR-017.

  Se marca `Decision Pending` (no firme) porque, aunque la dirección de la recomendación es de alta confianza, cierra formalmente una tensión entre tres ADRs distintos y por tanto no debe asumirse silenciosamente en la implementación — es, con alta probabilidad, un candidato genuino a enmienda conjunta de ADR-007/ADR-017/ADR-022 (ver Sección 11), tal como el propio review anticipó.

### 6.5 Resolución de F-07: mecanismo de límite de gasto de IA

**Vacío detectado (F-07, `ARCHITECTURE_REVIEW.md`, severidad High):** ningún ADR (007, 011, 015) fija un número concreto de límite de gasto de IA, ni define quién lo revisa, ni qué hace el sistema al alcanzarlo. El principio de "gobernanza de costo" está declarado, pero sin mecanismo operativo — y la propia review advierte que la respuesta ingenua ("escalar todo a humano" al tocar el límite) agravaría F-05 (sin validación de que el personal de recepción pueda absorber una escalada masiva).

**`Decision Pending` — mecanismo técnico de límite de gasto de IA.**
- *Opciones consideradas:* (a) sin mecanismo técnico, solo revisión manual periódica del costo acumulado (repite el patrón que F-02 ya señaló como insuficiente — control humano donde cabe uno automatizado); (b) un umbral de gasto configurable (diario y/o por sucursal, aprovechando la instrumentación de costo por llamada de §6.2) que, al alcanzarse, dispara una alerta y activa un modo de degradación explícito — no "detener el bot" ni "escalar todo a humano" de forma indiscriminada, sino priorizar conversaciones ya en curso y aplicar un mensaje de contención para conversaciones nuevas hasta que se levante el límite o un humano lo autorice; (c) cortar el servicio de IA por completo al alcanzar el límite, sin modo intermedio.
- *Evaluación:* (a) dejaría exactamente el vacío operativo que la review señaló. (c) resolvería el gasto pero recrearía el mismo colapso operativo que F-05 ya identifica como riesgo si ocurriera de golpe y sin priorización. (b) es la única opción que da gobernanza real de costo sin trasladar el problema completo a la capacidad humana de las sucursales.
- *Recomendación:* Opción (b): el umbral de gasto en sí (el número) es una decisión de negocio que este documento no puede fijar — pero el mecanismo técnico (contador de costo acumulado alimentado por la instrumentación de §6.2, alerta al acercarse al umbral, y un modo de degradación explícito y priorizado en vez de "todo a humano") sí se define aquí, tal como pide la review ("el mecanismo, no el número"). El diseño exacto del modo de degradación depende, a su vez, de la validación de capacidad humana que F-05 requiere del negocio — ver la nota de dependencia en §7.2.

  Se marca `Decision Pending` porque el número de límite es una decisión de negocio pendiente (no arquitectónica) y el modo de degradación depende de un dato de negocio que tampoco existe todavía (F-05) — el mecanismo técnico en sí, sin embargo, es una recomendación de alta confianza. Candidato a ADR en la Sección 11 (anexo a ADR-007/ADR-011, tal como la propia review sugiere).

---

## 7. Manejo de errores y resiliencia concreto

Esta sección aterriza ADR-013 en mecanismos concretos. No se detectó ninguna contradicción nueva con un ADR vigente — es, en su mayor parte, una traducción directa de una decisión ya completa — pero sí una dependencia de negocio no resuelta (F-05) que se anota en 7.2 sin intentar cerrarla aquí.

### 7.1 Tres categorías de error, aplicadas

Confirma ADR-013: (1) errores de dominio (resultado/excepción tipada con código de negocio, ej. "horario no disponible") propagados hasta `Conversación` para que la IA los comunique con naturalidad (ADR-007) o hasta la futura API (ADR-014, `05-api-design.md`) como un código identificable, nunca como error genérico; (2) errores de integración externa (WhatsApp, IA, Google Calendar) con reintento con backoff exponencial y circuit breaker por dependencia — cuando el circuito de IA abre, el flujo degrada a escalamiento humano (ADR-016), nunca a "seguir sin IA"; (3) errores inesperados, registrados con contexto completo vía el ID de correlación de §6.1 y alertados, nunca silenciados.

### 7.2 Circuit breaker por dependencia externa

Confirma ADR-013: un circuito independiente por cada una de las tres integraciones externas (WhatsApp, IA, Google Calendar) — el fallo de una no debe derribar las otras dos (ej. un fallo de Google Calendar no debe impedir confirmar una `Cita`, que ya ocurrió en el dominio antes de que la sincronización de calendario se dispare vía Outbox, §4.2/4.6). El estado del circuito (abierto/cerrado/medio-abierto) se instrumenta y alerta (§6.3 ya cubre la integración externa con un umbral de tasa de error) para no quedar "atascado" abierto sin que nadie lo note, tal como el propio ADR-013 exige en sus Consecuencias Negativas. Los umbrales exactos de apertura del circuito (no solo la tasa de error de alerta ya fijada en §6.3, sino el umbral de apertura del circuito en sí) quedan, por diseño explícito de ADR-013, como parámetro calibrable con datos reales — no se fija un número aquí, consistente con el propio "Future Revisit Criteria" de ese ADR.

**Nota de dependencia (F-05, `ARCHITECTURE_REVIEW.md`, severidad High — no resuelta aquí):** cuando el circuito de IA abre, ADR-013/ADR-016 ya definen que el flujo degrada a escalamiento humano. Lo que ningún documento valida es si el personal de recepción de las 3–4 sucursales puede absorber que **todas** las conversaciones en curso escalen simultáneamente ante una caída del proveedor de IA. Este es un dato de capacidad operativa que debe venir del negocio, no una decisión de arquitectura — se hereda tal cual (sin resolver) de `ARCHITECTURE_REVIEW.md`, en la misma línea que el mecanismo de degradación priorizada mencionado en §6.5. No se marca `Decision Pending` porque no hay alternativa arquitectónica que evaluar sin ese dato; es una validación de negocio pendiente, no un vacío que este documento pueda cerrar con una recomendación técnica.

---

## 8. Testing técnico concreto

Esta sección aterriza ADR-019 en mecanismos concretos y resuelve el vacío F-17.

### 8.1 Pirámide por capa arquitectónica, aplicada

Confirma ADR-019: dominio (unitarias exhaustivas, sin infraestructura ni IA — la capa de mayor cobertura exigida), aplicación/casos de uso (adaptadores falsos/in-memory), adaptadores externos (pruebas de contrato contra respuestas grabadas, no contra WhatsApp/IA/Google Calendar reales en cada corrida de CI), end-to-end reducido al camino crítico (conversación → cotización → agendamiento → confirmación) contra el entorno Sandbox (ADR-012), nunca contra Producción.

### 8.2 Golden set de regresión conversacional

Confirma ADR-019: un conjunto fijo de transcripciones de referencia se ejecuta antes de promover cualquier nueva versión de prompt (ADR-015) a Sandbox y luego a Producción — es el criterio de aceptación objetivo que ADR-015 necesita y no tendría de otro modo. Sin vacío nuevo: la composición/gobernanza exacta del propio golden set (quién lo cura, con qué cadencia) es un detalle de proceso de `06-development-plan.md`, no de este documento.

### 8.3 Runner de pruebas — heredado de 3.1, no una decisión nueva

El framework de ejecución de pruebas unitarias/de aplicación (Jest, el que provee por defecto el CLI de NestJS ya elegido en firme en §3.1) se adopta como consecuencia directa de esa elección, no como una evaluación de criterios independiente — igual que se trató ORM/cola en §3.4/3.6 como decisiones acopladas, no aisladas.

### 8.4 Resolución de F-17: pruebas de fallo inyectado sobre Outbox y cola de jobs

**Vacío detectado (F-17, `ARCHITECTURE_REVIEW.md`, severidad Medium):** ningún ADR menciona pruebas de fallo inyectado (chaos testing) sobre el Outbox (§4.2) o la cola de background jobs (ADR-018), pese a ser, junto con el propio F-24, los componentes con mayor riesgo de falla silenciosa de todo el sistema.

Este vacío tampoco enfrenta alternativas serias que evaluar (la pregunta no es "cuál mecanismo" sino "si se incluye o no una práctica de prueba adicional"), por lo que se resuelve de forma directa, sin `Decision Pending`: la definición de "terminado" del dispatcher de Outbox (§4.2) y de los handlers de la cola de jobs (ADR-018) debe incluir explícitamente pruebas de fallo inyectado (ej. simular una fila reclamada dos veces, un handler que falla a mitad de ejecución, un dead-letter que se llena) como parte de su propio alcance de implementación — no como una fase de testing general aparte. El propio `ARCHITECTURE_REVIEW.md` sugiere que esto podría formalizarse más adelante como criterio explícito de ADR-019; se anota como candidato a ADR en la Sección 11, pero no bloquea ni requiere `Decision Pending` aquí porque no hay una decisión de fondo que cerrar, solo una práctica que incorporar.

### 8.5 `pg-mem` como sustituto de Postgres real en pruebas de integración — alcance y límite verificados empíricamente

**Contexto:** el entorno de desarrollo actual no tiene acceso a Docker ni a una instancia Postgres real; el módulo Sucursales y Personal (primer módulo construido, Fase 1) adoptó `pg-mem` (emulador de Postgres en memoria) para sus pruebas de integración de repositorios y E2E, sin que esa elección estuviera fijada en ningún ADR previo. Este apartado documenta, con evidencia empírica reproducida en el hardening transversal de 2026-08-11, qué es seguro asumir de `pg-mem` y qué no — para que Identidad y Catálogo reutilicen el patrón con conocimiento de causa, no por copia ciega.

**Verificado como equivalente a Postgres real (seguro reutilizar):**
- Ejecución de SQL real generado por Drizzle (no son mocks del repositorio) — detecta errores de sintaxis/tipos que un repositorio con mocks no detectaría.
- Restricciones `UNIQUE`/`FOREIGN KEY`/`PRIMARY KEY` se aplican y rechazan violaciones.
- El código SQLSTATE de una violación de unicidad es `23505`, igual que en Postgres real — confirmado insertando un duplicado directo y leyendo `error.code` tanto con el wrapper de este proyecto como con el driver `pg` crudo. Es seguro construir traducción de errores (ver `05-api-design.md` §9, `shared/errors/postgres-error.ts`) contra este código con `pg-mem`.

**Verificado como NO equivalente (no asumir, no usar `pg-mem` para validarlo):**
- **`db.transaction()` no revierte de verdad.** Un `INSERT` dentro de una transacción que luego lanza un error dentro de `pg-mem` deja la fila insertada — `BEGIN`/`ROLLBACK` se aceptan sin error pero no tienen efecto real. Confirmado tanto a nivel del driver `pg` crudo (`BEGIN; INSERT; ROLLBACK;` vía `client.query`) como a través de `db.transaction()` de Drizzle. Cualquier prueba de atomicidad/rollback contra `pg-mem` prueba la lógica de orquestación del código (que delega correctamente en `UnitOfWork.ejecutar`), **no** que la base de datos realmente revierta — eso permanece sin verificar hasta tener una conexión Postgres real (Supabase o local).
- El driver `node-postgres` (`pg`) que `pg-mem` emula no es el driver de producción (`postgres-js`) — el wrapper de este proyecto (`database/test-utils/pg-mem-database.ts`) existe precisamente porque ninguno de los dos expone la misma superficie de opciones (`types.getTypeParser`, `rowMode: 'array'`) sin adaptación. Cualquier comportamiento específico de `postgres-js` (backpressure, `prepare: false` bajo PgBouncer, `onnotice`, tipos numéricos de alta precisión) queda fuera de lo que estas pruebas pueden validar.

**Recomendación concreta para Identidad y Catálogo:** mantener la pirámide ya usada — unitarias de dominio/aplicación con dobles in-memory (sin `pg-mem`, sin base de datos), integración de repositorios contra `pg-mem` (rápida, sin Docker, valida SQL/constraints/SQLSTATE), E2E de HTTP contra `pg-mem` (valida el cableado completo Guards → Controller → Caso de uso → Repositorio). **No sustituir todo por `pg-mem` ni todo por una base real** — reservar una validación contra Postgres real (aunque sea una sola vez, antes de cerrar cada módulo) específicamente para: comportamiento de transacciones/rollback, y cualquier tipo de dato con parseo no trivial (`timestamptz`, `numeric`). Sin `DATABASE_URL` real disponible hoy, esa validación queda pendiente para los tres módulos construidos hasta ahora (ver Tarea 8 del reporte de cierre del hardening de Sucursales y Personal).

---

## 9. Riesgos técnicos consolidados y Future Revisit Criteria

Esta sección no introduce análisis nuevo — consolida cómo este documento trató (o deliberadamente no trató) cada hallazgo de `ARCHITECTURE_REVIEW.md`, para que quede explícito qué quedó cerrado, qué quedó `Decision Pending`, qué se hereda sin resolver, y qué queda fuera de alcance por diseño.

### 9.1 Hallazgos resueltos o mitigados dentro de este documento

| ID | Severidad | Tratamiento | Sección |
|---|---|---|---|
| F-27 | Critical | Resuelto como `Decision Pending` (ack inmediato + cola idempotente) | §4.4 |
| F-03 | High | Resuelto como `Decision Pending` (reclamo de fila `FOR UPDATE SKIP LOCKED`) | §4.2 |
| F-14 | High | Resuelto como `Decision Pending` (retención diferenciada dentro del registro de auditoría) | §6.4 |
| F-07 | High | Resuelto como `Decision Pending` (mecanismo de límite de gasto, no el número) | §6.5 |
| F-02 | High | Parcialmente mitigado (GitHub Actions como vehículo de controles automatizados) | §3.15 |
| F-11 | Medium | Resuelto como `Decision Pending` (canal SSE, reutilizando JWT de ADR-010) | §3.7 |
| F-13 | Medium | Resuelto directamente, sin alternativas que evaluar (segregación de secretos por sucursal) | §5.5 |
| F-21 | Medium | Resuelto como `Decision Pending` (BSP vs. acceso directo) | §3.11 |
| F-24 | Medium | Resuelto como `Decision Pending` (SLOs numéricos provisionales) | §6.3 |
| F-25 | Medium | Parcialmente mitigado (linter de compatibilidad de migraciones como check de CI) | §3.15 |
| F-17 | Medium | Resuelto directamente, sin alternativas que evaluar (pruebas de fallo inyectado) | §8.4 |

### 9.2 Hallazgos heredados sin resolver — requieren dato o decisión de negocio

Este documento no tiene autoridad para cerrar estos puntos porque cada uno depende de información que solo el negocio puede proveer (capacidad operativa, presupuesto, marco regulatorio, o una confirmación ya pendiente desde el Domain Discovery). Se listan explícitamente para que no se pierdan, no para resolverlos aquí.

| ID | Severidad | Qué falta | Dependencia |
|---|---|---|---|
| F-05 | High | Validación de capacidad de recepción ante escalamiento masivo simultáneo | Dato de negocio (nota en §7.2) |
| F-12 | Medium | Alcance exacto de RBAC por sucursal | Domain Discovery, Pregunta Abierta #11 |
| F-08 | High | Plan de migración de los 3 números de WhatsApp existentes | Plan de ejecución, no arquitectura |
| F-09 | Medium | Aprobación de plantillas de mensaje por Meta | Plan de ejecución, no arquitectura |
| F-10 | High *(reclasificado)* | Plan de gestión de cambio para adopción de Google Calendar como fuente única | Plan de ejecución, no arquitectura |
| F-18 | Medium | Estimación de costo de mensajería de WhatsApp oficial | Dato de negocio/volumen |
| F-22 | Medium | Viabilidad económica del modelo Silo para futuros clientes pequeños | Dato de negocio (especulativo hoy) |
| F-20 | Medium | Ajuste de expectativa de portabilidad de proveedor de IA en el texto de ADR-007 | Ajuste editorial, no de arquitectura |
| F-26 | Medium | Contención de recursos entre `Conversación` (alto volumen de mensajes) y `Agenda` (transaccional crítico) en la misma instancia de PostgreSQL — mitigación concreta (ej. pool de conexiones separado) solo si el monitoreo muestra degradación real | Evidencia real de volumen/latencia — mismo gatillo de revisión ya definido en ADR-005 |

### 9.3 Hallazgos fuera de alcance de este documento por diseño

Pertenecen a diseño de casos de uso conversacionales, UX, o planificación de backlog — no a arquitectura de componentes/stack, y por instrucción explícita no se abordan aquí.

| ID | Severidad | Dónde corresponde |
|---|---|---|
| F-04 | Medium | Caso de uso "conflicto de confirmación tardía" — diseño de flujo conversacional |
| F-06 | Medium | Ampliación de alcance del golden set (ADR-019) a errores semánticos — gobernanza de contenido, no arquitectura |
| F-15 | Medium-High | Dimensionamiento de 4 herramientas internas — `06-development-plan.md` |
| F-16 | Medium | Debilidad inicial del golden set — plan de lanzamiento, no arquitectura |
| F-23 | Low-Medium | Ajuste de expectativa de esfuerzo en ADR-009 — editorial |
| F-28 | Low-Medium | Caso de uso de "corrección administrativa" de cotización congelada — diseño de caso de uso |

### 9.4 Nota de secuenciación — F-01 (Critical, no resuelto por este documento)

F-01 señala que el conjunto acumulado de patrones (Hexagonal + Clean + Vertical Slice + CQRS-lite + Domain Events/Outbox + Modular Monolith con 10 esquemas lógicos + DDD táctico completo) es individualmente defendible en cada ADR, pero nadie evaluó el costo acumulado de exigir que un equipo pequeño domine las cinco disciplinas simultáneamente desde el primer sprint. La propia review es explícita: **no recomienda descartar ningún ADR**, recomienda una **decisión de secuenciación de implementación** — construir primero el núcleo transaccional (Agenda, Catálogo, Clientas) con Hexagonal + Vertical Slice simple, y diferir la implementación completa de CQRS-lite/Outbox hasta que el primer caso de uso de Analítica/Notificaciones lo requiera realmente, en vez de construir toda la maquinaria por adelantado.

Este documento **no resuelve F-01** — lo hereda explícitamente, tal como el plan de trabajo aprobado anticipó. La secuenciación de implementación es, por su propia naturaleza, contenido de `06-development-plan.md` (orden de sprints), no de la arquitectura de componentes. F-19 (footprint de infraestructura mayor al de un MVP) es, según la propia review, consecuencia directa de F-01 y se hereda por la misma razón, sin tratamiento independiente.

### 9.5 Future Revisit Criteria de este documento

**Actualizado 2026-08-04 (cierre de `P1`):** §3.3 (BD), §3.4 (ORM), §3.7 (Realtime), §3.8 (Storage), §3.9 (Auth), §3.13 (Hosting) y §3.16 (síntesis) ya no son `Decision Pending` — quedaron firmes con esta actualización. Permanecen `Decision Pending`, sin relación con `P1`: §3.6 (cola de jobs, acoplada a §3.5), §3.11 (BSP de WhatsApp, fuera de alcance hasta Fase 4), §3.14 (backend de observabilidad).

Todo elemento marcado `Decision Pending` en este documento (§3.6, 3.11, 3.14, §4.2, §4.4, §5.5, §6.3–6.5) debe revisarse y cerrarse explícitamente antes de, o durante, la redacción de `04-data-model.md` (para las decisiones de motor/ORM/proveedor de base de datos) y `05-api-design.md` (para autenticación/canal de handoff). Adicionalmente: cualquier resolución de las Preguntas Abiertas #4, #11 y #12 del Domain Discovery debe revisarse contra las secciones de este documento que las dan por pendientes (§5.2, §6.4, §9.2), ya que pueden alterar una recomendación aquí registrada.

---

## 10. Tabla de trazabilidad

Mapea cada decisión operativa de este documento a su origen — Domain Discovery, ADR, o hallazgo de `ARCHITECTURE_REVIEW.md` — para que ninguna sección de este documento pueda leerse como una decisión inventada sin origen.

| Sección de este documento | Origen | Tipo de origen |
|---|---|---|
| §3.1 NestJS, §3.2 Next.js | Principio de simplicidad proporcional (`02-architecture-principles.md`) | Principio |
| §3.3 Motor/proveedor de BD | ADR-005 (motor fijo), proveedor abierto | ADR + vacío |
| §3.4 ORM | ADR-005 (separación de esquemas) | ADR (implicación no resuelta) |
| §3.5 Redis | Principio 13.4 (`02-architecture-principles.md`) | Principio |
| §3.6 Cola de jobs | ADR-018, ADR-021 | ADR |
| §3.7 Canal de handoff | ADR-016, F-11 | ADR + hallazgo de review |
| §3.8 Storage de archivos | ADR-017 | ADR |
| §3.9 Autenticación | ADR-010 | ADR |
| §3.10 Proveedor de IA | ADR-007 | ADR |
| §3.11 BSP de WhatsApp | ADR-008, F-21 | ADR + hallazgo de review |
| §3.12 Google Calendar API | ADR-006 | ADR |
| §3.13 Hosting | ADR-001, ADR-012 | ADR |
| §3.14 Observabilidad (backend) | ADR-011 | ADR |
| §3.15 CI/CD | F-02, F-25 | Hallazgos de review |
| §4.1 Mapa de módulos | Domain Discovery §4 (11 Bounded Contexts), ADR-001/002 | Domain Discovery + ADR |
| §4.1 (relación Conversación↔Escalamiento) | Domain Discovery §5.11 | Domain Discovery |
| §4.2 Outbox y F-03 | ADR-004, ADR-005, F-03 | ADR + hallazgo de review |
| §4.3 Vista de despliegue | ADR-001, ADR-012, principio 13.2 | ADR + principio |
| §4.4 Integración de WhatsApp y F-27 | ADR-018, ADR-021, F-27 | ADR + hallazgo de review |
| §4.5 Integración de IA | ADR-002 principio 9.8, ADR-007 | Principio + ADR |
| §4.6 Integración de Google Calendar | ADR-006, ADR-004 | ADR |
| §5.1–5.4 Seguridad | ADR-010 | ADR |
| §5.5 Secretos y F-13 | ADR-010, F-13 | ADR + hallazgo de review |
| §6.1–6.2 Observabilidad | ADR-011 | ADR |
| §6.3 SLOs y F-24 | ADR-011, F-24 | ADR + hallazgo de review |
| §6.4 Retención y F-14 | ADR-007, ADR-017, ADR-022, F-14 | ADR + hallazgo de review |
| §6.5 Límite de gasto y F-07 | ADR-007, ADR-011, F-07 | ADR + hallazgo de review |
| §7.1–7.2 Errores y resiliencia | ADR-013 | ADR |
| §7.2 (nota F-05) | F-05 | Hallazgo de review (no resuelto) |
| §8.1–8.3 Testing | ADR-019 | ADR |
| §8.4 Fallo inyectado y F-17 | ADR-018, F-17 | ADR + hallazgo de review |

---

## 11. ADRs candidatos identificados

Lista final, filtrada después de revisar el documento completo — contiene únicamente las decisiones que, a criterio de este documento, ameritan convertirse en un ADR formal o una enmienda a uno existente. No se crean los ADRs aquí; se listan para decisión del cliente/arquitecto, tal como se acordó en el plan de trabajo.

| # | Candidato | Tipo | Sección de origen | Severidad del hallazgo |
|---|---|---|---|---|
| 1 | Patrón de ingesta del webhook de WhatsApp (ack inmediato + cola idempotente) | ADR nuevo | §4.4 (F-27) | Critical |
| 2 | Mecanismo de reclamo exclusivo de filas del Outbox (`FOR UPDATE SKIP LOCKED`) | Enmienda a ADR-004 | §4.2 (F-03) | High |
| 3 | Política de retención diferenciada en el registro de auditoría de IA (metadatos vs. contenido conversacional) | Enmienda conjunta a ADR-007/ADR-017/ADR-022 | §6.4 (F-14) | High |
| 4 | Mecanismo técnico de límite de gasto de IA (contador + modo de degradación priorizado) | Enmienda conjunta a ADR-007/ADR-011 | §6.5 (F-07) | High |
| 5 | Canal de transporte y autenticación del panel de handoff humano (SSE + JWT de ADR-010) | ADR nuevo | §3.7 (F-11) | Medium |
| 6 | Segregación de secretos de WhatsApp por sucursal en el gestor de secretos | Aclaración a ADR-010 | §5.5 (F-13) | Medium |
| 7 | Pruebas de fallo inyectado sobre Outbox y cola de jobs como criterio de "terminado" | Anexo a ADR-019 | §8.4 (F-17) | Medium |

**Deliberadamente excluidos de esta lista** (no ameritan ADR todavía, según el propio análisis de la Sección 9): F-01 (requiere una decisión de secuenciación de implementación, no un ADR — la propia review lo distingue explícitamente), F-12 (depende de que se confirme primero la Pregunta Abierta #11 del Domain Discovery — un ADR ahora se basaría en un supuesto no confirmado), F-24 (la propia `ARCHITECTURE_REVIEW.md` lo clasifica explícitamente como parámetro operativo, no como decisión arquitectónica — se mantiene como decisión operativa en §6.3, no como candidato a ADR), F-05/F-08/F-09/F-10/F-18/F-22 (dependen de datos o planes de negocio/ejecución, no de una decisión arquitectónica pendiente), F-20/F-23 (ajustes editoriales a ADRs existentes, no decisiones nuevas), F-04/F-06/F-15/F-16/F-28 (pertenecen a diseño de casos de uso, contenido del golden set, o backlog — no a arquitectura).

---

## 12. Próximos pasos

1. **Revisión y cierre de los `Decision Pending` de mayor impacto** antes de iniciar `04-data-model.md`: la pregunta umbral del "conjunto Supabase" (§3.16), de la que dependen §3.3 (proveedor de BD), §3.7 (canal de handoff), §3.8 (storage) y §3.9 (autenticación); y el proveedor de hosting (§3.13), del que depende parcialmente el gestor de secretos (§5.5).
2. **Decisión de secuenciación de implementación (F-01)** antes de planificar el primer sprint en `06-development-plan.md` — no bloquea el inicio de `04-data-model.md`, pero sí debe resolverse antes de comprometer un calendario de entregas.
3. **Presentar al cliente los 7 candidatos a ADR de la Sección 11**, junto con esta versión de `03-technical-architecture.md`, para decidir cuáles se formalizan como ADR nuevo, cuáles como enmienda, y en qué orden.
4. **Solicitar al negocio los datos pendientes de la Sección 9.2** (capacidad de recepción ante escalamiento masivo, alcance de RBAC por sucursal, plan de migración de números de WhatsApp, marco regulatorio de datos personales) — varias decisiones `Decision Pending` de este documento no pueden cerrarse sin esa información.
5. **Continuar con `04-data-model.md`**, heredando de este documento: el motor PostgreSQL con separación por esquema (§3.3, ADR-005), la decisión de ORM que se cierre primero (§3.4), y la estructura conceptual de las tablas de Outbox por contexto (§4.2) — sin repetir aquí ninguna decisión de stack ya tomada.

---
