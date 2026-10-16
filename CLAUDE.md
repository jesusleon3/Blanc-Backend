# CLAUDE.md

Este archivo guía a Claude Code (claude.ai/code) al trabajar en este repositorio.

## Estado del proyecto

Blanc es una plataforma de agendamiento de citas para un salón de uñas de 3 sucursales (próximamente 4), impulsada por WhatsApp y asistida por IA. El diseño de dominio está hecho y **la implementación está en curso**: existe un backend real en `backend/` y un frontend real en `frontend/` (ver las secciones *Trabajar en el código* más abajo). `mockup/` es un prototipo visual comercial **sin backend**, se puede borrar entero, y es la fuente de los tokens de diseño que usa el frontend. La documentación de `docs/` sigue siendo autoritativa sobre el código en materia de reglas de negocio y decisiones de arquitectura.

**Arquitectura:** propuesta y en gran parte congelada, pero **no cerrada formalmente todavía**. **Arquitectura CERRADA (2026-10-16):** los diez puntos de `docs/ARCHITECTURE_CLOSURE_PLAN.md` están cerrados. Tres se cerraron de forma que conviene leer antes de asumir nada: `P6` con `ADR-028` **aceptando una desviación declarada** del hallazgo `F-27` (el webhook procesa síncrono, no con cola) y `ADR-029`; `P8` **generando el contrato del código** en vez de escribirlo a mano; y `P10` **diferido post-MVP, no resuelto**. Siguen abiertos, y no son técnicos: el valor de retención conversacional (`ADR-029`), el tope de gasto de IA (`F-07`) y las plantillas de Meta aprobadas (`N-14` documentado). **Los tres bloqueadores no negociables del plan (`P3`, `P4`, `P5`) están resueltos.** No debe iniciarse implementación (Fase 1) hasta que ese documento lo autorice (su propia "Definition of Ready" es la autorización formal, no se requiere un documento adicional).

**Propagación de Discovery Checklist:** el proyecto completó una ronda de validación con la Dueña (`DISCOVERY_CHECKLIST.md`, 2026-08-03/04) que respondió 31 preguntas de negocio pendientes. Esas respuestas se están propagando sistemáticamente hacia el resto de la documentación siguiendo `docs/MASTER_PROPAGATION_PLAN.md` (documento de trabajo temporal, no funcional) — 11 de 12 pasos de ese roadmap ya están completos.

Documentación vigente (leer antes de proponer cualquier diseño o código):
- `docs/requirements/blanc-requisitos-negocio.md` — fuente oficial de requisitos de negocio/funcionales. Tratar como autoritativa; no reinterpretar sin registrar el cambio.
- `docs/architecture/01-domain-discovery.md` — DDD domain discovery (subdominios, Bounded Contexts, entidades, aggregates, domain events, preguntas abiertas). Varias decisiones de modelado siguen marcadas como preguntas abiertas — consultar la sección 2/9 de ese documento antes de asumir una respuesta.
- `docs/architecture/02-architecture-principles.md` — principios de arquitectura rectores (Modular Monolith, Hexagonal+Clean+Vertical Slices, CQRS-lite, event-driven en proceso + outbox, principios de IA/API/BD/seguridad).
- `docs/PLATFORM_ARCHITECTURE_MODEL.md` — modelo de plataforma reutilizable de 4 capas (Core Platform / Domain Policies / Client Specification / Extension Points), **congelado**, formalizado en `ADR-023`. Léase antes de clasificar cualquier regla, mecanismo o campo de configuración nuevo — el criterio de creación de una Domain Policy nueva (§3) es exigente a propósito.
- `docs/architecture/ADR_INDEX.md` y `docs/architecture/adr/ADR-001..023-*.md` — 23 Architecture Decision Records formales. La mayoría `Proposed`, pendientes de aprobación explícita del cliente, salvo `ADR-006` (`Accepted`, confirmado 2026-08-03) y `ADR-023` (`Accepted`, modelo de plataforma). **`ADR-008`** (integración de WhatsApp): la Dueña respondió (2026-08-03) pidiendo ambos proveedores (API oficial y Evolution API) disponibles como adaptadores configurables, no simultáneos — esto **no aprueba** la Decision original de esta ADR (que rechazaba Evolution API como integración principal); sigue `Proposed`, **pendiente de rediseño formal con autorización explícita**, no de una simple ratificación de `Status`. Cualquier código que viole una ADR `Accepted` necesita una ADR nueva, nunca una desviación silenciosa.
- `docs/business-rules/*.md` — Business Rules Engine (73 reglas de negocio, 12 categorías). `docs/business-rules/99-open-questions.md` consolida las preguntas de negocio que todavía bloquean el estado `Aprobada` de una o más reglas — la mayoría ya resueltas tras la validación con la Dueña.
- `docs/decision-flows-catalogo-diseno.md` — catálogo de Decision Flows (macro/micro-flujos de orquestación, `FL-XXX-NN`).
- `docs/architecture/04-data-model.md` — modelo de datos lógico.

**Stack tecnológico principal ya cerrado (`P1`, 2026-08-04):** TypeScript, NestJS, Modular Monolith, PostgreSQL, Supabase como proveedor de BD/Auth/Storage/Realtime, Drizzle ORM, Railway como hosting, OpenAI exclusivamente como intérprete con salida estructurada (nunca decide reglas de negocio — backend/dominio son la única autoridad). La elección de Supabase Auth y de Railway está cerrada, pero su **validación en producción** (rotación de refresh token con detección de reuso; despliegue rolling/blue-green) sigue pendiente como tarea de verificación de Fase 1, no como decisión abierta. Ningún modelo de datos definitivo (DDL ejecutable) ni diseño de API ha sido cerrado todavía — ver `04-data-model.md` (modelo lógico) y P8 de `ARCHITECTURE_CLOSURE_PLAN.md` (`05-api-design.md`, pendiente de redactar). **WhatsApp (`P7` resuelto, 2026-10-09):** se usa la **API Oficial de Meta (Cloud API) en exclusiva** (`DEC-043`, `ADR-008` `Accepted` con Enmienda 1). Esto **revierte** la petición previa de doble adaptador: las APIs no oficiales (Baileys, Evolution API) quedan descartadas por riesgo de baneo inaceptable. El canal sigue sin construir (Fase 4) y el trámite con Meta es camino crítico. Ver `docs/architecture/WHATSAPP_ARQUITECTURA_CANAL.md`.

## Trabajar en el código (`backend/`)

NestJS + TypeScript, Modular Monolith (`ADR-001`), Hexagonal + Clean + Vertical Slices (`ADR-002`), Drizzle ORM sobre PostgreSQL. **Todo comando se corre desde `backend/`.**

| Qué | Comando |
|---|---|
| Compilar | `npm run build` |
| Tipos sin emitir | `npx tsc --noEmit` |
| Tipos incluyendo config y specs | `npx tsc -p tsconfig.eslint.json` |
| Lint | `npm run lint` |
| Todas las pruebas | `npm test` |
| **Un archivo** | `npx jest ruta/al/archivo.spec.ts` |
| **Una prueba** | `npx jest ruta/al/archivo.spec.ts -t "fragmento del nombre"` |
| Generar migración | `npm run db:generate` |
| Verificar migraciones | `npx drizzle-kit check` |
| **Seed idempotente** | `npm run db:seed` (ver variables en `.env.example`) |
| **Regenerar el contrato de API** | `npm run contrato:actualizar` |
| Arranque de producción | `npm run start:prod` |
| Ciclos de dependencias | `npx madge --circular --extensions ts src/` |

**Las pruebas necesitan Docker.** No hay base en memoria: `pg-mem` se eliminó tras comprobar que no soporta `tstzrange`, `EXCLUDE USING gist` ni `btree_gist` — es decir, no puede ejecutar el invariante central del sistema. Se usan **Testcontainers** con `postgres:16-alpine`: un contenedor por corrida, **una base por worker de Jest**, y **las migraciones son el DDL**. Si Docker no corre, las pruebas fallan con *"Could not find a working container runtime strategy"*; `test/global-setup.js` sondea los sockets de OrbStack/Colima/Rancher/Docker Desktop además de `/var/run/docker.sock`.

### Convenciones no obvias

- **Todo en español**: nombres de clases, métodos, variables, comentarios, mensajes de error y nombres de pruebas. Solo los términos técnicos aceptados quedan en inglés.
- **Un esquema de PostgreSQL por Bounded Context, y NUNCA una FK cruzada entre esquemas** (`ADR-005`). Las referencias entre contextos son `uuid` sin FK. Dentro del mismo esquema, las FK sí son legítimas.
- **`@Global` NO sobrescribe un proveedor local.** Solo evita tener que importar el módulo: **un proveedor local gana siempre**. Por tanto, **si otro módulo tiene que proveer un puerto, el BC que lo declara no declara un valor por defecto para él** — se queda sin proveedor y el arranque falla ruidosamente, que es lo correcto. Creer lo contrario costó dos defectos silenciosos: los recordatorios de WhatsApp nunca salieron durante toda la Parte 2 de Fase 4, y el bot quedó inerte en la Parte 3. Lo vigila `src/modules/integracion/sin-defaults-locales.spec.ts`, y `src/modules/agente/bot.e2e.spec.ts` es el único sitio que monta el grafo completo en el orden de `AppModule`.
- **Ningún Bounded Context importa a otro, ni su código ni sus tipos** (`P5`, cerrado 2026-10-15). El puerto se define en el módulo que **consume** y el adaptador vive en `modules/integracion/` (`@Global`). Un `import` directo crearía un ciclo que `madge` marca. Si un puerto necesita una unión de literales que otro BC también tiene (p. ej. el estado de riesgo de una clienta), **se repite en el puerto**: esa copia *es* el contrato publicado.
- **`UnitOfWork` se une a la transacción en curso.** Un caso de uso que invoque a otro comparte una sola transacción, cuya frontera es la del más externo. No todo cruce debe ser atómico: una escritura cruzada sí va dentro (perderla pierde un dato), pero **su fallo no debe propagar** si deshacer el acto principal sería peor, y una llamada de red va siempre **fuera**.
- **Las `EXCLUDE USING gist` y los `CHECK` están escritos a mano en las migraciones** porque Drizzle no sabe expresarlos, y **no están en su snapshot**. Quien cambie la lista de estados de `Cita` debe editar el array de TypeScript, el `CHECK` y el `WHERE` de las dos `EXCLUDE`. Lo vigila `src/database/schema/deriva-restricciones-agenda.spec.ts`, que compara `pg_constraint` contra los arrays de TS — si deriva, falla.
- **Los rangos horarios son `tstzrange` con fin exclusivo `[inicio, fin)`**, para que dos citas consecutivas no choquen.
- **El horario del negocio es hora de pared**, no instantes: ver `ZONA_HORARIA_NEGOCIO` en `motor-disponibilidad.ts`.
- **Toda escritura va dentro de `UnitOfWork` y registra en `AuditoriaPort`** (`RN-AUD-01`). El `detalle` de auditoría **nunca** lleva PII de la clienta. Las llamadas HTTP van **fuera** de la transacción.
- **`@Roles` se declara por método, no por clase.** Sin decorador, `RolesGuard` deja pasar a cualquier autenticado: **toda ruta nueva debe declarar el suyo**.
- **Los errores de dominio son `DomainError`** y los traduce `HttpExceptionFilter` (`ADR-013`). Nunca se deja escapar un error crudo de PostgreSQL: se traduce por SQLSTATE (`23505` → unicidad, `23P01` → exclusión).
- **El dinero son `Centavos`**, un *branded type* (`RN-COT-07`). Nunca un `number` suelto ni coma flotante.
- `jose` está fijado en `^5.10.0` **a propósito**: la v6 es solo ESM y rompe el runtime CommonJS.

### El contrato de API está verificado entre los dos proyectos (`P8`)

`contratos/api-v1.json` se **deriva del código** (80 rutas con sus roles desde los metadatos de Nest, 12 formas de respuesta invocando los presenters reales) y lo verifican los **dos** proyectos.

- **Si cambias un presenter, un DTO, una ruta o un `@Roles`, la prueba falla** hasta que corras `npm run contrato:actualizar`. Eso es deliberado: así el cambio aparece en el diff de un commit en vez de inadvertido.
- **Un campo que desaparezca del backend rompe el build del frontend**, porque `tsc` allí obliga a que `claves-del-contrato.ts` coincida con las interfaces, y una prueba compara esos arreglos con este JSON.
- **Si una pantalla lee una forma ANIDADA, hay que declararla.** El verificador comparaba solo las claves de primer nivel y eso dejó pasar un defecto hasta la pantalla: `cotizacionSnapshot` coincidía como nombre mientras su contenido estaba equivocado, y el iPad mostraba `NaN` y **$0.00 para un servicio de cotización manual**.
- Verifica además tres invariantes que ninguna prueba de módulo puede ver: que **toda ruta declara sus roles** (sin `@Roles`, `RolesGuard` deja pasar a cualquier autenticado), que **ninguna escritura está abierta a `MANICURISTA` ni `SOLO_LECTURA`**, y que la forma de `Cita` del iPad es un **subconjunto estricto** de la de operación.

### Analítica y reportes (Fase 6)

- **`AnaliticaModule` NO tiene SQL propio.** Es un adaptador conductor: cada Bounded Context agrega **su propio esquema** (`ReporteDeAgendaUseCase`, `ReporteDeAnticiposUseCase`, `ReporteDeConversacionesUseCase`) y él compone en memoria. Un módulo de analítica con `JOIN` entre esquemas es lo que `ADR-005` prohíbe.
- **Los helpers de reporte viven en `shared/reportes/`**, no en el módulo de Agenda: que un BC los importara de otro sería violar `P5` **sin que `madge` lo marcara**.
- **«Se quedó en el bot» se mide por los MENSAJES, no por el `modo`.** `devolverAlBot` limpia el motivo (`RN-ESC-03`), así que contar `modo='bot'` inflaría el indicador justo en los casos en que una persona trabajó.
- **La tasa de no-show usa `completada + no_show` como denominador**, no el total: incluir las canceladas diluiría la tasa cuando más tiene que notarse.
- **`null` no es `0`** en un indicador: «no hubo datos» y «salió cero» llevan a conclusiones distintas. La pantalla muestra «—».
- **El ingreso es un ESTIMADO** y las advertencias viajan **en la respuesta**, no en la documentación: quien lee un número tiene que saber qué no incluye en el mismo sitio donde lo lee.
- **Los reportes usan dos ejes de tiempo distintos**: citas por `lower(rango_horario)` (cuándo es la cita), anticipos y lista de espera por `creado_en` (cuándo se registró la fila). En actividad pasada coinciden; con datos futuros, no.

### Despliegue y operación

- **El seed es idempotente, y eso incluye NO reimponer valores de fábrica**: no pisa un horario ajustado a mano ni reactiva una silla desactivada. *Idempotente* significa "no cambia el resultado", no "reescribe el valor por defecto".
- **CORS nunca responde `*`.** Sin `CORS_ORIGIN` en producción queda desactivado, asumiendo el mismo origen (`ADR-027`). Falla cerrado.
- **Dos interruptores de rollback por entorno**: `PLANIFICADOR_ACTIVO=false` y `BOT_ACTIVO=false`. **Ninguno se apaga quitando su módulo** — el contenedor no arrancaría (`ADR-026`).
- **`OPENAI_MAX_LLAMADAS_DIA`** (`ADR-030`): tope diario de llamadas al modelo, contado en PostgreSQL para que **sobreviva a reinicios**. Al agotarse, el bot **sigue atendiendo** con el intérprete determinista: escalar todo agravaría `F-05`. Por defecto 500, finito a propósito; `0` apaga el modelo.
- **`RETENCION_MENSAJES_DIAS`** (`ADR-029`): **vacío o `0` no purga nada**, y es el valor por defecto. El *valor* de retención depende de la Pregunta Abierta #12 y no se inventa; un borrado es irreversible. El barrido nunca toca `auditoria`.
- **El orden de puesta en marcha no es negociable**: `docs/operations/GO_LIVE_RUNBOOK.md`. Migrar un número a la Cloud API **lo desconecta de la app de WhatsApp Business inmediatamente**; si la Bandeja no está viva, el salón se queda incomunicado.
- **Nada está verificado contra Supabase, Meta, OpenAI ni Railway reales.** No hay credenciales en este entorno; está declarado en `ADR-024`, `ADR-008`, `ADR-027` y `ADR-028`.

### Canal de WhatsApp (`DEC-043`, `ADR-008` Enmienda 1)

Cloud API oficial de Meta en exclusiva. Lo que hay que saber antes de tocarlo:

- **El webhook es `@Public()` y se autentica por firma HMAC** (`X-Hub-Signature-256`). El HMAC se calcula sobre el **cuerpo crudo** que captura `main.ts`; reserializar el JSON parseado rompe la firma. Si falta `rawBody`, se trata como firma inválida — nunca como "no se pudo comprobar".
- **El webhook responde siempre `200` salvo firma inválida.** Meta reintenta ante cualquier no-2xx: un `500` convierte un evento defectuoso en un bucle.
- **El webhook procesa SÍNCRONO, incluida la llamada al modelo** (`ADR-028`). Es una desviación aceptada del hallazgo `F-27` (`Critical`), no un descuido: la duplicación —el daño más grave previsto— es imposible por el índice único sobre `wamid`, y el trabajo que no puede perderse va por el Planificador. **Tiene tres criterios de reapertura medibles**; si los logs muestran reintentos de Meta sobre mensajes ya procesados, hay que leer esa ADR antes de tocar nada.
- **Idempotencia por `wamid`**, impuesta por índice único parcial. Para insertar de forma idempotente **dentro de una transacción** usa `ON CONFLICT DO NOTHING`, **no** `try/catch` sobre el `23505`: un statement que falla aborta la transacción entera (`25P02`) y el error sale igual en el `COMMIT`.
- **Ventana de 24 h de Meta** (`N-14`): pasadas 24 h desde el último mensaje de la clienta solo se puede enviar una **plantilla aprobada**. Se valida en el dominio **antes** de llamar a Meta.
- **El webhook pasa el `type` CRUDO de Meta** (`tipoCrudoDeMeta`) además del normalizado: `TipoMensaje` colapsa imagen y audio en `no_soportado`, y el dominio necesita distinguirlos (una foto es `cotizacion_compleja`, una nota de voz `medio_no_soportado`). El desglose por motivo es lo que la Dueña mira para saber qué se le escapa al bot.
- **Del modo `humano` no se sale solo** (`RN-ESC-03`): no hay vía automática de vuelta a `bot`. Esa ausencia es la regla, y la vigila el detector de deriva.
- **El proveedor por defecto NO envía nada.** El adaptador real se activa solo con `WHATSAPP_ACCESS_TOKEN`; `META_APP_SECRET` y `META_VERIFY_TOKEN` fallan cerrado si faltan. Ningún secreto se escribe en el repositorio.

### Agente Conversacional / Bot IA (`modules/agente/`)

**Adaptador conductor, no un Bounded Context** — igual que `PlanificadorModule`: decide *cuándo invocar a quién*, no tiene dominio propio.

- **`RN-CONV-01` (*la IA interpreta, nunca decide*) está impuesto por el tipo, no por el prompt.** `Intencion` no tiene campo para un precio, una duración, un hueco ni el texto de la respuesta: **el modelo no puede inventar un precio porque no tiene dónde escribirlo**. La única vía para obtener uno es `HerramientasDelBot`, que envuelve los mismos casos de uso que usa el mostrador. Si añades un campo a `Intencion`, piensa si acabas de mover una decisión al modelo.
- **Tres capas, en orden.** (1) Filtro determinista de frases — cancelar, pedir una persona y quejarse escalan **sin consultar al modelo**; (2) el modelo clasifica, y por debajo de `CONFIANZA_MINIMA` se escala (`RN-CONV-05`); (3) las herramientas reales. Toda intención no contemplada escala: el lado seguro.
- **`PATRONES` del adaptador determinista se recorre en orden y `saludo` va al final.** Es la señal más débil: ponerlo primero convierte *"Hola, ¿qué precios tienen?"* en un saludo.
- **El intérprete por defecto NO es OpenAI.** Sin `OPENAI_API_KEY` corre `AgenteDeterministicoAdapter`, con confianza binaria (1/0). Es un modo de operación desplegable, no un simulacro: las pruebas no pueden depender de un modelo probabilístico. **`OpenAiAgenteAdapter` no se ha ejecutado nunca contra OpenAI** (sin credenciales); cualquier fallo suyo degrada a `desconocida` y **nunca propaga**, porque lanzar devolvería un 500 a Meta y provocaría un bucle de reintentos.
- **El bot ejecuta escrituras acotadas** (`DEC-044` Enmienda 1): agendar, confirmar recordatorio, inscribir/aceptar lista de espera, generar anticipo. **Cancelar y reprogramar siguen prohibidos** (`DEC-040`) y lo vigila una lista negra en `principal-de-sistema.spec.ts`. Toda escritura nueva debe declararse además en `ESCRITURAS_AUTORIZADAS_AL_BOT`.
- **`BOT_ACTIVO=false` es el plan de rollback**, como `PLANIFICADOR_ACTIVO`: el puerto recibe `OrquestadorInactivoAdapter` y el canal queda atendido solo por personas. **No** se apaga quitando el módulo: entonces nadie provee el puerto.
- **Un acuse no es una respuesta.** `EnviarMensajeDelBotUseCase` toma `esAcuse`: con `true` usa `registrarNotificacionDeSistema` y **no toca `mensajes_sin_responder`**. Si un acuse lo limpiara, una conversación recién escalada desaparecería del contador de pendientes y nadie sabría que hay que atenderla.
- **El motivo de escalamiento viaja en `ResultadoDelTurno`**, no se relee de la entidad: la copia que tiene `RecibirMensajeUseCase` se cargó antes de que el bot escalara sobre la suya.

### Planificador operativo (`ADR-025`)

Cuatro barridos temporales (`lista_espera`, `anticipos`, `cierre_de_citas`, `recordatorios`) con cron en proceso (`@nestjs/schedule`, fijado en `^4.1.2` por compatibilidad con NestJS 10).

- **El cron no contiene lógica**: cada barrido es un caso de uso invocable también por `POST /v1/planificador/barridos/:nombre`. Así se dispara a mano, se prueba con un `ahora` explícito y se puede mover a un worker cambiando solo quién llama.
- **`PLANIFICADOR_ACTIVO=false`** apaga los ticks dejando los endpoints vivos. `test/global-setup.js` lo pone en pruebas: un tick corrompería los escenarios de integración.
- **Un elemento que falla no aborta el lote** (`procesarLote`), y la idempotencia es **por estado, no por bandera**: cada barrido selecciona por estado de origen y la acción lo cambia.
- **El cerrojo entre instancias usa `pg_try_advisory_lock` sobre una conexión RESERVADA** (`reserve()`). Los advisory locks son por sesión y `postgres-js` usa un pool: pedirlo por el pool deja el cerrojo colgado cuando el `unlock` cae en otra conexión.

## Trabajar en el código (`frontend/`)

SPA de React + Vite, TypeScript estricto, Tailwind, TanStack Query, React Router (`ADR-027`). **Todo comando se corre desde `frontend/`.**

| Qué | Comando |
|---|---|
| Desarrollo | `npm run dev` (proxy de `/v1` a `localhost:3000`) |
| Tipos | `npx tsc -b` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Pruebas | `npm test` |
| **Un archivo** | `npx vitest run ruta/al/archivo.spec.tsx` |
| **Una prueba** | `npx vitest run ruta -t "fragmento del nombre"` |

### Convenciones no obvias del frontend

- **No hay `POST /v1/auth/login`, y no debe haberlo.** El login va contra **Supabase Auth directo** y el JWT se manda a Blanc en `Authorization`. `ADR-024` evaluó que Blanc emitiera su propio token y **lo rechazó**.
- **El rol se obtiene de `GET /v1/identidad-y-accesos/usuarios/yo`, nunca del JWT** (`DEC-029`): no viaja en el token, se resuelve contra PostgreSQL.
- **El rol sirve para dibujar, nunca para autorizar.** Cada endpoint revalida su `@Roles` en el servidor. **Una restricción no está implementada porque el botón no se vea.**
- **Ningún dato de negocio se calcula en el cliente.** Ni precios, ni duraciones, ni si la ventana de 24 h está abierta: `GET /v1/conversaciones/:id` devuelve `estadoDeVentana` **precisamente** para que el cliente no lo deduzca de las marcas de tiempo.
- **Los errores se leen por su `code` de negocio** (`ADR-013`), nunca por el texto ni solo por el HTTP. `409 HORARIO_NO_DISPONIBLE` al confirmar un anticipo significa *"otra clienta ganó el cupo"* (`RN-ANT-03`) y necesita su propio mensaje.
- **La vista de la Manicurista es un árbol de rutas separado**, sin `Layout`: ese marco lleva el contador de escaladas y los enlaces al panel, y ninguno puede aparecer en el iPad (`DEC-040`). La separación estructural evita depender de un `if` de rol.
- **Las pruebas usan MSW, no dobles del cliente de API.** Interceptan HTTP y responden con la forma real del contrato, así que un cambio de forma en el backend las rompe — necesario mientras los tipos de `api/contrato.ts` se escriban a mano (`P8` abierto).
- **Plurales en español: no concatenes sufijos.** `conversación` + `es` da «conversaciónes» y `cancelación` + `es` da «cancelaciónes» — el plural pierde la tilde. Escribe las dos formas enteras. **Ya ha aparecido tres veces**: contador de la Bandeja, Clientas y Analítica.
- **Los tokens visuales salen de `mockup/css/tokens.css`**, declarados como tema en `tailwind.config.ts`. Los colores semánticos van por variable CSS para que el tema oscuro no duplique clases.
- **La hora de pared de Querétaro se construye con `-06:00` explícito** (`instanteDesdeHoraLocal` en `componentes/etiquetas.ts`). `new Date('2026-12-07T10:00')` la interpretaría en la zona del navegador: una Encargada con el portátil en otra zona agendaría a otra hora sin que nada avisara. Es el error más probable de todo el frontend.
- **Las tablas de transiciones y los agrupamientos de rol son COPIAS del backend**, igual que las uniones de literales del contrato. Ofrecer un botón que el backend rechazará con `409 TRANSICION_ILEGAL` es peor que no ofrecerlo, porque invita a intentarlo — pero **la autoridad sigue siendo el backend**.
- **La confirmación consciente se dispara con el `409`, no por adelantado.** Al cancelar no se manda `confirmacionDeEmpleado: true` desde el principio: el rechazo del backend es lo que dispara la advertencia de que el anticipo no se reembolsa. Enviarla siempre convertiría una barrera deliberada en un trámite invisible.
- **Un formulario dentro de una vista con fecha arranca en la fecha visible, no en hoy.** Fue un defecto real: se agendaba para hoy mirando otro día, y nada avisaba.
- **Dos campos con el mismo nombre accesible en una pantalla es un defecto**, no un detalle: son indistinguibles para un lector de pantalla y para las pruebas.
- **Sin valores de secretos en el repositorio.** `.env.example` lleva solo nombres. La `anon key` de Supabase es publicable (va en el bundle); la `service_role key` **no aparece nunca** en el frontend.

### Antes de dar por terminado un cambio

**Backend:** `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npx drizzle-kit check`, `npx madge --circular --extensions ts src/` y `npm test` — los seis en verde. **Frontend:** `npx tsc -b`, `npm run lint`, `npm run build` y `npm test` — los cuatro en verde. **No apliques migraciones a ninguna base de datos real**: eso es actividad de despliegue (Fase 7).
