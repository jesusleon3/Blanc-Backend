# Runbook de puesta en marcha — Blanc MVP

> **Para quién:** quien vaya a desplegar Blanc a producción, con el repositorio delante y acceso a Railway, Supabase y Meta.
>
> **Lo único que no se puede improvisar es el orden.** El paso 5 (migrar un número de WhatsApp) **desconecta ese número de la app de WhatsApp Business en el celular**, de forma inmediata y sin vuelta atrás fácil. Si se hace antes de que la Bandeja Compartida esté viva y probada, **el salón se queda incomunicado**: nadie puede leer ni responder los mensajes de las clientas. Es el riesgo operativo más alto de todo el proyecto (`ADR-008` Enmienda 1).
>
> **Tiempo estimado:** 2–3 horas para los pasos 0–4, más una ventana aparte por cada número que se migre.

---

## Paso 0 — Antes de tocar nada

### 0.1 Lo que tiene que estar listo de antemano

| Qué | Dónde se consigue | Por qué va primero |
|---|---|---|
| **Las 3 plantillas `Approved` en Meta** | `docs/operations/PLANTILLAS_META.md` | La aprobación tarda minutos u horas y **no depende de ti**. Si se deja para el final, bloquea todo. |
| **Cuentas en Supabase Auth** para la Dueña y las 3 Encargadas | Supabase → *Authentication* → *Add user* | Sin cuenta no hay login: Blanc no emite tokens (`ADR-024`). |
| **El `UID` de la cuenta de la Dueña** | Supabase → *Authentication* → *Users* → columna `UID` | Es `SUPER_ADMIN_SUPABASE_SUB`. **Es un uuid, no el correo.** |
| **Proyecto de Supabase con Postgres** | Supabase → *Settings* → *Database* | Usa la cadena del **connection pooler**, no la directa: Railway reinicia y la directa agota conexiones. |
| **App de Meta con el WABA configurado** | Meta Business Manager | De aquí salen `META_APP_SECRET` y el token del System User. |

### 0.2 Verificar el repositorio en verde

```bash
cd backend && npx tsc --noEmit && npm run lint && npm run build \
  && npx drizzle-kit check && npx madge --circular --extensions ts src/ && npm test
cd ../frontend && npx tsc -b && npm run lint && npm run build && npm test
```

**Las pruebas del backend necesitan Docker** (Testcontainers). Si no corre, fallan con *"Could not find a working container runtime strategy"* — no es un problema del código.

> ⚠️ **Nada de lo que sigue se ha verificado contra los servicios reales**, y conviene saberlo antes de empezar: no hay credenciales de Supabase, Meta ni OpenAI en el entorno de desarrollo. Las integraciones están construidas contra el contrato documentado de cada una y probadas con dobles. **Los pasos 3, 4 y 5 son la primera vez que este código habla con esos servicios.** Está declarado así en `ADR-024`, `ADR-008` y `ADR-027`.

---

## Paso 1 — Variables de entorno en Railway

Copia los nombres de `backend/.env.example` (que explica cada uno) y rellena en Railway.

**Obligatorias para arrancar:**

```
DATABASE_URL=            # cadena del POOLER de Supabase
SUPABASE_URL=            # Settings → API → Project URL
SUPABASE_SERVICE_ROLE_KEY=
NODE_ENV=production
PORT=3000
```

**Para el canal de WhatsApp** (se pueden dejar vacías en el primer despliegue; ver paso 4):

```
META_APP_SECRET=
META_VERIFY_TOKEN=       # lo eliges tú, lo pegarás igual en Meta
WHATSAPP_ACCESS_TOKEN=
```

**Interruptores — arranca con el bot apagado:**

```
PLANIFICADOR_ACTIVO=true
BOT_ACTIVO=false         # ⚠️ false en el primer despliegue. Ver paso 4.
```

> **Las tres credenciales de integración FALLAN CERRADO.** Sin `META_APP_SECRET` el webhook rechaza todo; sin `WHATSAPP_ACCESS_TOKEN` no se envía ningún mensaje; sin `OPENAI_API_KEY` el bot usa el intérprete determinista. **Un despliegue incompleto no manda mensajes por accidente** — es deliberado y es lo que permite desplegar antes de tener los secretos.

**Frontend** (`frontend/.env.example`), en el build:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE=           # VACÍO si se sirve desde el mismo origen (lo normal)
```

> **`CORS_ORIGIN` solo hace falta si el frontend va en otro dominio.** Si se omite en producción, CORS queda desactivado asumiendo el mismo origen, que es el despliegue previsto (`ADR-027`). **Nunca se responde `*`**: la API se autentica con un JWT en cabecera, y un `*` permitiría a cualquier página usar el token de una Encargada que tuviera el panel abierto.

---

## Paso 2 — Base de datos: migraciones y seed

### 2.1 Migraciones

```bash
cd backend && npm run db:migrate
```

Las 14 migraciones **son el DDL** del sistema: no hay un `schema.sql` aparte. Incluyen las `EXCLUDE USING gist` del no-doble-booking y los `CHECK` escritos a mano que Drizzle no sabe expresar.

> **Es la primera vez que estas migraciones se aplican a una base real.** Durante todo el desarrollo corrieron contra Testcontainers. Si alguna falla, **no sigas**: el estado parcial de un esquema es peor que ninguno.

### 2.2 Seed idempotente

```bash
SUPER_ADMIN_EMAIL=duena@blanc.mx \
SUPER_ADMIN_NOMBRE="Dueña de Blanc" \
SUPER_ADMIN_SUPABASE_SUB=<el-uuid-del-paso-0.1> \
npm run db:seed
```

Deja listo:

- **Las 3 sucursales** — Zibatá, Lomas, Álamos — con el horario real: **L-V 9:00–12:00 y 15:00–18:00, sábado 9:00–15:00, domingo cerrado** (`RN-AGE-12`).
- **Las sillas virtuales**: Zibatá 5, Lomas 3, **Álamos 1** (`DEC-031`).
- **El Super Admin** vinculado a su cuenta de Supabase, con alcance `GLOBAL`.
- **El catálogo OFICIAL de la Dueña**: 21 renglones en sus cinco categorías reales, con los tiempos definitivos.

| Categoría | Renglones | Bloque |
|---|---|---|
| **Retiro** | Retiro de gel, acrílico o rubber *(solo retiro, drill o acetona)* | 60 min |
| **Servicios individuales** | Gel · Rubber · Rubber + gel · Manicure · Rubber + gel + manicure | 60 min |
| **Extensiones y cobertura** | Extensiones · Baño de acrílico · (+ gel) · (+ gel + manicure) | 120 min |
| **Combinaciones con retiro** | Retiro de **gel** + rubber, gel o manicure | **60 min** |
| | Retiro de **acrílico o rubber** + rubber, gel o manicure | 120 min |
| | Retiro de acrílico o rubber + extensiones o baño de acrílico *(± manicure)* | 180 min |
| **Diseños y efectos** | Gel / Rubber / Manicure + rubber, **+ diseño estándar** | 60 min |
| | Extensiones o baño de acrílico + diseño estándar | 180 min |
| | Diseño especial *(cotización manual)* | 60 min |

> ## LOS TIEMPOS SE ABSORBEN, NO SE SUMAN — Y ESO HAY QUE SABERLO ANTES DE TOCAR NADA
>
> `Rubber + gel + manicure` es **una hora**, no tres: los tres trabajos caben en la misma hora porque se hacen sobre la misma mano. El **retiro de gel** se absorbe dentro de esa hora; el de **acrílico o rubber** añade su propio bloque. No hay fórmula que produzca eso — hay una tabla, y es la de arriba.
>
> **Cada combinación es su propio renglón del catálogo**, con su duración exacta. Por eso no existe un "motor de combinaciones" (`FL-COT-03`) y no hace falta.
>
> Las duraciones caen en bloques de **60, 120 y 180 minutos**, que encajan con el horario de la sucursal. Consecuencia operativa que conviene anticipar: **una cita de tres horas solo cabe empezando a las 9:00 o a las 15:00.** A las 10:00 el sistema responde `FUERA_DEL_HORARIO_DE_SUCURSAL`, y es correcto — no es un hueco que se niegue a vender, es un hueco que no existe (`RN-AGE-10`).

> ## ⚠️ LOS TIEMPOS SON OFICIALES; LOS PRECIOS, PROVISIONALES
>
> La Dueña entregó la matriz de **tiempos** (2026-10-19), y están sembrados tal cual. Los **importes** no: son estimaciones coherentes con cada bloque, puestas para que el sistema arranque operable.
>
> **Hay que confirmar los precios con la Dueña antes de cobrarle a la primera clienta.** El precio es lo que se cobra y la base del 40 % del anticipo (`RN-ANT-01`).
>
> Dos avisos más, que no son lo mismo:
>
> 1. **Cuatro renglones cubren varias combinaciones a la vez** (los de "retiro + …"), porque comparten bloque de tiempo. Para el tiempo es exacto; para el precio significa **un solo importe para tres combinaciones** que probablemente no cuesten lo mismo. Cuando la Dueña dé los precios, esos renglones se desdoblan desde el Backoffice.
> 2. **Cambiar una duración cambia lo que el bot vende.** Si se ajusta un renglón, el bot y el mostrador lo respetan desde la siguiente cita, sin desplegar nada.
>
> Todo se corrige en **Configuración → Catálogo y tiempos** del panel, o por `PATCH /v1/catalogo-y-cotizacion/servicios/:id`. El seed **no vuelve a pisar** lo que alguien ya corrigió.

**Es idempotente**: correrlo dos veces no duplica ni falla. Y es más fino que eso — **no reimpone valores de fábrica**: si alguien ajustó el horario de una sucursal desde el panel o desactivó una silla por reparación, el seed **no lo pisa**. Volver a correrlo es seguro siempre.

Si falta algún dato del Super Admin, **falla antes de escribir nada** y dice qué variable. Es deliberado: una base sembrada sin usuario inicial **parece correcta** y no se puede usar, porque todos los endpoints de alta exigen `SUPER_ADMIN` o `ADMINISTRADOR`.

### 2.3 Lo que el seed NO siembra, y hay que dar de alta por la API o por el panel

- **Manicuristas** y su asignación a sucursal → **Configuración → Personal** del panel, o `POST /v1/sucursales-y-personal/manicuristas`
- **Usuarios de las Encargadas** → `POST /v1/identidad-y-accesos/usuarios` + vincular su `UID` de Supabase
- **Los precios reales del catálogo** → el seed deja los 21 renglones con los **tiempos oficiales** y con **precios provisionales** (ver el aviso de §2.2); confirmar los importes con la Dueña es parte de la puesta en marcha, no algo posterior

Van por API y no por seed porque **son datos que cambian** (alta y baja de personal, cambios de precio) y tienen su RBAC. El seed cubre solo el arranque en frío: deja el sistema arrancable, no configurado.

> **Sin manicuristas asignadas, el motor de disponibilidad no vende nada**: la capacidad es el mínimo entre sillas y personal. Si la agenda dice que no hay lugar a ninguna hora, esto es lo primero que hay que mirar.

---

## Paso 3 — Despliegue y verificación de humo

### 3.1 Desplegar

Backend: `npm run build` → `npm run start:prod`. Frontend: `npm run build` → servir `dist/` como estáticos.

`enableShutdownHooks()` está activo, así que un `SIGTERM` de Railway **drena el pool de PostgreSQL** antes de morir en vez de cortar conexiones a medias.

### 3.2 Humo, en este orden

| # | Qué | Cómo | Qué tiene que pasar |
|---|---|---|---|
| 1 | El servicio vive | `GET /health` | `200`. Es la ruta del healthcheck de Railway y es pública. |
| 2 | La base responde | `GET /health` incluye el estado de la conexión | Sin error de base |
| 3 | **El login funciona** | Entrar al panel con la cuenta de la Dueña | Aterriza en la Bandeja. **Si falla aquí, es `ADR-024`**: revisa `SUPABASE_URL` — de ahí se derivan el `issuer` y el JWKS |
| 4 | El rol se resuelve | El encabezado dice *"Dueña"* | Sale de `GET /usuarios/yo`, que lo lee de PostgreSQL, no del token (`DEC-029`) |
| 5 | Los selectores traen datos reales | Abrir Agenda | Las 3 sucursales en el desplegable. Si están vacías, el seed no corrió |
| 6 | **Agendar una cita de prueba** | Dar de alta una clienta de prueba y agendarla | La cita aparece con su silla, su precio y su horario correcto |
| 7 | La hora es la correcta | Mirar la hora de la cita | **Si sale desplazada 6 horas, hay un problema de zona horaria.** Es el error más probable del despliegue |
| 8 | Cancelar y reprogramar | Sobre la cita de prueba | Los diálogos de confirmación aparecen |
| 9 | La vista de iPad | Entrar con la cuenta de una Manicurista | Solo sus citas, **sin** indicadores de lista roja y **sin** botones de acción |
| 10 | El planificador corre | Logs | Los 4 barridos aparecen sin errores |

**Borra la cita y la clienta de prueba antes de seguir.**

> **Hasta aquí, cero riesgo para la operación del salón.** Los números de WhatsApp siguen en los celulares y el salón opera como siempre. Si algo de arriba falla, se arregla sin prisa.

---

## Paso 4 — El webhook de Meta (sin migrar números todavía)

Esto configura la recepción **antes** de desconectar nada.

1. Rellena `META_APP_SECRET`, `META_VERIFY_TOKEN` y `WHATSAPP_ACCESS_TOKEN` en Railway y redespliega.
2. **Meta Business Manager** → *WhatsApp* → *Configuration* → *Webhook* → *Edit*:
   - **Callback URL:** `https://<tu-dominio>/v1/webhooks/meta`
   - **Verify token:** el mismo valor de `META_VERIFY_TOKEN`
3. Pulsa **Verify and save**. Meta hace un `GET` con un reto.
   - **Si falla:** el token no coincide, o la URL no es alcanzable. El endpoint **falla cerrado** a propósito — aceptar un reto con token vacío permitiría que un tercero registrara nuestra URL en su propia app.
4. **Suscríbete al campo `messages`.** Sin esa suscripción Meta no manda nada y el silencio parece un fallo del código.

### Deja `BOT_ACTIVO=false` todavía

Durante los primeros días el canal se atiende **solo por personas**. Dos razones:

1. **Separa los problemas.** Si algo va mal con el canal, sabes que no es el bot.
2. **El bot agenda citas de verdad** (`DEC-044` Enmienda 1). Conviene ver primero cómo escriben las clientas reales antes de dejar que una conversación acabe en una cita sin que nadie la mire.

---

## Paso 5 — ⚠️ Migrar los números (punto de no retorno)

> **Lee esto completo antes de empezar.**
>
> **En el momento en que das de alta un número en la Cloud API, ese número deja de funcionar en la app de WhatsApp Business del celular.** Inmediatamente. Los mensajes de las clientas dejan de llegar al teléfono y empiezan a llegar **solo al webhook**. Si la Bandeja no está viva, **nadie puede leerlos ni responderlos**.

### 5.1 Antes de migrar el primero

- [ ] Los pasos 3 y 4 completos y en verde.
- [ ] La Encargada de la sucursal piloto **tiene el panel abierto** y sabe usar la Bandeja.
- [ ] Hay una ventana de **baja demanda** (`F-08`): no un sábado a las 10 de la mañana.
- [ ] Alguien puede revertir si hace falta (ver paso 6).

### 5.2 Empieza por UNA sucursal piloto

**Álamos**, por volumen: una silla, menos conversaciones, menos daño si algo va mal.

1. En Meta, da de alta el número de Álamos en la Cloud API.
2. Copia su **`phone_number_id`** (Meta → *WhatsApp* → *API Setup*).
3. Dalo de alta en Blanc, **por cualquiera de las dos vías**:
   - `PHONE_NUMBER_ID_ALAMOS=<id>` y volver a correr `npm run db:seed` (es idempotente, no toca nada más), **o**
   - `POST /v1/conversaciones/numeros` desde el panel con la cuenta de la Dueña.

> **Si el mapeo queda mal, las conversaciones de una sucursal aparecen en la bandeja de otra.** El seed se niega a reasignar un `phone_number_id` que ya apunte a otra sucursal, en vez de resolverlo en silencio.

### 5.3 Verificar en vivo, con un teléfono real

| # | Qué | Qué tiene que pasar |
|---|---|---|
| 1 | Mandar un WhatsApp al número migrado desde un móvil personal | Aparece en la Bandeja **en segundos** |
| 2 | Mirar los logs | Una petición al webhook con `200` |
| 3 | La conversación muestra **Ventana abierta** | La clienta acaba de escribir |
| 4 | Responder desde la Bandeja | Llega al móvil. La conversación pasa a **modo humano** |
| 5 | El contador del encabezado | Refleja lo que espera |

**Si el mensaje no aparece:**

| Síntoma | Causa probable |
|---|---|
| Nada en los logs | Meta no está mandando: revisa la suscripción al campo `messages` |
| `401 FIRMA_META_INVALIDA` | `META_APP_SECRET` no coincide con el de la app |
| `200` pero no aparece en la Bandeja | El `phone_number_id` no está dado de alta: el webhook lo descarta con un log de aviso |
| Aparece en la sucursal equivocada | El mapeo está mal (ver 5.2) |

### 5.4 Las otras dos

**Espera al menos un día de operación real de Álamos** antes de seguir. El punto de la sucursal piloto es aprender algo; migrar las tres el mismo día desperdicia esa oportunidad y triplica el daño de un problema.

Después, Lomas y Zibatá, una por una, con la misma verificación.

### 5.5 Encender el bot

Cuando el canal lleve unos días estable y las plantillas estén `Approved`:

1. `BOT_ACTIVO=true` y redespliega.
2. Si no hay `OPENAI_API_KEY`, corre el **intérprete determinista**: atiende saludos, precios y disponibilidad, y escala el resto. **No es una degradación** (`ADR-026`), es un modo de operación válido — y es una buena forma de empezar.
3. Manda un *"hola"* al número y comprueba que el bot responde y el mensaje queda en el hilo con `emisor: bot`.

---

## Paso 6 — Contingencia

### Apagar el bot (segundos)

```
BOT_ACTIVO=false    # y redesplegar
```

El canal, la Bandeja y el handoff **siguen funcionando**: queda atendido solo por personas, igual que en los pasos 4 y 5.

> **No se apaga quitando el módulo.** Sin `AgenteModule` nadie provee `ORQUESTADOR_DE_BOT_PORT` y **la aplicación no arranca** (`ADR-026`). Está verificado: con `BOT_ACTIVO=false`, de las 13 pruebas del E2E del bot fallan las 9 que exigen bot y pasan las 4 del canal.

### Apagar el planificador

```
PLANIFICADOR_ACTIVO=false
```

Los ticks se detienen y los endpoints `POST /v1/planificador/barridos/:nombre` siguen vivos para dispararlos a mano. Úsalo si un barrido se comporta mal; **no lo dejes apagado mucho tiempo**: sin él no salen recordatorios, los anticipos no expiran y la lista de espera se queda bloqueada en quien no contestó.

### Si la Bandeja se cae con números ya migrados

**Es el peor escenario y conviene tenerlo pensado de antemano.** Las clientas escriben y nadie lee.

1. **Los mensajes no se pierden** si el backend está vivo: entran al webhook y quedan en la base. Lo que se pierde es la atención.
2. Si el **backend** está caído, Meta reintenta durante un tiempo; parte de los mensajes puede perderse.
3. **Mitigación inmediata:** avisar por el canal que el salón tenga a mano (llamadas, el otro número) y revisar `GET /v1/conversaciones?soloPendientes=true` en cuanto vuelva.
4. **Volver a la app de WhatsApp Business exige deshacer la migración en Meta** y no es inmediato. Por eso el paso 5 va al final y de una en una.

---

## Resumen del orden, para tenerlo a la vista

```
0. Plantillas en Meta (esperar aprobación) + cuentas en Supabase
1. Variables en Railway  — BOT_ACTIVO=false
2. db:migrate → db:seed → manicuristas, servicios y usuarios por API
3. Desplegar + 10 pruebas de humo          ← cero riesgo hasta aquí
4. Webhook en Meta + suscribir `messages`  ← cero riesgo todavía
5. Migrar números: Álamos → esperar 1 día → Lomas → Zibatá   ⚠️ PUNTO DE NO RETORNO
   5.5 BOT_ACTIVO=true
6. Contingencia: BOT_ACTIVO=false
```

**Lo que no se puede invertir:** el paso 5 va después del 3 y del 4. Todo lo demás admite ajustes.
