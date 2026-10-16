# ADR-027 — Stack y arquitectura del Frontend operativo

- **Estado:** Accepted
- **Fecha:** 2026-10-16
- **Decide:** Arquitectura
- **Relacionada con:** `ADR-002` (Hexagonal/Clean), `ADR-013` (errores), `ADR-014` (versionado de API), `ADR-024` (identidad con Supabase), `ADR-008` Enmienda 1 (Bandeja Compartida bloqueante de puesta en marcha), `DEC-029` (rol y alcance resueltos en servidor), `DEC-040` (vista de iPad sin PII), `P1` (stack backend), `P9` (alcance de la Manicurista)

---

## Contexto

Al abrir la Fase 5 se buscó el stack de frontend en los ADRs existentes, como corresponde. **No existe ninguna decisión formal.** `P1` cerró el stack del backend y de la plataforma (TypeScript, NestJS, PostgreSQL, Supabase, Drizzle, Railway, OpenAI) y no menciona el cliente web; `02-architecture-principles.md` nombra "el frontend" nueve veces como consumidor de la API interna, sin decir qué es; `IMPLEMENTATION_MASTER_PLAN.md` dice que *"el frontend se construye de forma incremental desde la Fase 1"* y que la Fase 7 es su integración final, sin fijar tecnología.

Es la última decisión de stack pendiente y hay que tomarla ahora, porque `ADR-008` Enmienda 1 la convirtió en **bloqueante de puesta en marcha**: dar de alta un número en la Cloud API lo desconecta de la app de WhatsApp Business, así que **ningún número puede migrarse antes de que la Bandeja Compartida esté en producción**. Si el orden se invierte, el salón se queda incomunicado.

Restricciones reales que condicionan la elección:

1. **Todo el consumo es detrás de autenticación.** No hay una sola pantalla pública: ni SEO, ni enlaces compartibles, ni contenido indexable. El argumento habitual para renderizado en servidor no aplica.
2. **El backend ya resuelve todo.** `ADR-014` fija contract-first con versionado en la URI y `ADR-013` un formato de error semántico; el cliente consume `/v1/...` y no necesita una capa de servidor propia que agregue nada.
3. **El rol NO viaja en el JWT** (`DEC-029`): se resuelve contra PostgreSQL. El cliente lo obtiene de `GET /v1/identidad-y-accesos/usuarios/yo`.
4. **La autenticación es Supabase Auth directa** (`ADR-024`, Opción A). Blanc **no** emite tokens: la Opción B —un endpoint de intercambio en Blanc— se evaluó y se rechazó explícitamente.
5. **Hay tres consumidores con necesidades distintas**: Bandeja Compartida (escritorio, sondeo frecuente), Panel de Encargada/Dueña (escritorio, formularios) y vista de iPad de la Manicurista (táctil, sin PII por `DEC-040`).
6. **Un solo servicio en Railway** para el backend. Añadir un segundo servicio para renderizar el frontend duplica despliegue, configuración y secretos.

---

## Decisión

**SPA de React con Vite, TypeScript en modo estricto, Tailwind CSS, TanStack Query y React Router, servida como estáticos.** Autenticación con `@supabase/supabase-js` contra Supabase Auth. Pruebas con Vitest, Testing Library y MSW.

| Pieza | Elección | Por qué esta y no la alternativa obvia |
|---|---|---|
| Framework | **React 18** | Es el ecosistema con más superficie de contratación y el que mejor cubre los tres consumidores con un solo cuerpo de código. No hay nada en este producto que pida Svelte o Vue, ni nada que lo descarte. |
| Build | **Vite** (no Next.js) | Ninguna pantalla es pública: sin SEO y sin contenido indexable, el renderizado en servidor de Next no compra nada y sí cuesta — un segundo servicio en Railway, otro despliegue, otra copia de los secretos. Un bundle estático se sirve desde el mismo servicio o desde un CDN. |
| Tipado | **TypeScript `strict` + `noUncheckedIndexedAccess`** | Mismo criterio que el backend. `noUncheckedIndexedAccess` se añade porque este código vive de arrays que vienen de la API, y `mensajes[0]` siendo `undefined` es el fallo más probable. |
| Estilos | **Tailwind CSS** | El producto es un panel operativo con pocos componentes muy repetidos. Una librería de componentes completa (MUI, Ant) impondría su estética y pesaría más que lo que resuelve; CSS a mano divergiría entre pantallas. |
| Estado de servidor | **TanStack Query** | Es la pieza que realmente decide la arquitectura. La Bandeja necesita **sondeo** (el contador de escaladas, la lista, el hilo abierto), invalidación tras cada acción de handoff, y reintentos con criterio. Hacerlo con `useEffect` a mano es reimplementar esto peor. |
| Estado de cliente | **Ninguna librería** | Lo único global es la sesión y el perfil, y eso es un contexto de React. Redux/Zustand aquí serían infraestructura sin problema que resolver. |
| Rutas | **React Router** | Guardas por rol declarativas, que es exactamente la forma de la decisión 3 del alcance. |
| Auth | **`@supabase/supabase-js`** | Obligado por `ADR-024`: el login va contra Supabase Auth y el JWT resultante se manda a Blanc. Además da la rotación de refresh token que `ADR-010` exige, sin construirla. |
| Pruebas | **Vitest + Testing Library + MSW** | Vitest comparte la configuración de Vite. **MSW es la decisión importante**: las pruebas se escriben contra *respuestas HTTP*, no contra un cliente doblado, así que verifican la forma real del contrato del backend. |

### Organización del código: por pantalla, no por tipo de archivo

```
frontend/src/
  api/          → cliente HTTP, un módulo por recurso del backend, tipos del contrato
  auth/         → sesión de Supabase, perfil (`/yo`), guardas de ruta por rol
  componentes/  → lo compartido de verdad (botones, badges, estados vacíos)
  paginas/      → una carpeta por pantalla, con sus componentes propios dentro
  App.tsx       → tabla de rutas
```

Es el equivalente de los **Vertical Slices** del backend (`ADR-002`): lo que cambia junto vive junto. La alternativa —`components/`, `hooks/`, `utils/` globales— obliga a tocar cuatro carpetas para cambiar una pantalla y hace que todo parezca compartido aunque no lo sea.

### Tres reglas de frontera

1. **El rol sirve para dibujar, nunca para autorizar.** Ocultar el enlace a Clientas es una cortesía; la autorización está en el `@Roles` del backend, que revalida con los permisos resueltos en servidor. Un cliente que mintiera sobre su rol recibiría `403` igual. **Corolario: no se considera que una restricción esté implementada porque el botón no se vea.**
2. **Ningún dato de negocio se calcula en el cliente.** Ni precios, ni duraciones, ni si la ventana de 24 h está abierta. Es la misma frontera que `ADR-026` impone a la IA, por la misma razón: hay una sola autoridad sobre las reglas y es el backend. `GET /v1/conversaciones/:id` devuelve `estadoDeVentana` **precisamente** para que el cliente no lo deduzca de las marcas de tiempo.
3. **Los errores se leen por su código de negocio** (`ADR-013`), no por el texto ni solo por el HTTP. `409 HORARIO_NO_DISPONIBLE` al confirmar un anticipo significa *"otra clienta ganó el cupo"* (`RN-ANT-03`) y necesita un mensaje distinto de cualquier otro `409`.

### Secretos

Solo dos variables, las dos públicas por diseño (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) más la base de la API. **Sus valores reales no se escriben en el repositorio**: `.env.example` lleva únicamente los nombres. La `anon key` es publicable —va en el bundle, inevitablemente— y lo que protege los datos es RLS y el `AuthorizationGuard` del backend, no el secreto de esa clave. La `service_role key` **no aparece nunca** en el frontend.

---

## Consequences

### Positive

- **Un solo artefacto y un solo despliegue.** Estáticos: se pueden servir desde el propio servicio de Railway o desde un CDN, sin runtime de Node adicional.
- **Las pruebas verifican el contrato, no un doble.** Con MSW, un cambio de forma en una respuesta del backend rompe las pruebas del frontend — que es exactamente lo que se quiere de un cliente de API versionada (`ADR-014`).
- **El sondeo de la Bandeja queda resuelto por una pieza probada.** Intervalos, invalidación tras mutación, deduplicación de peticiones y reintentos salen de TanStack Query, no de código propio.
- **Blanc no gana superficie de autenticación.** Al ir contra Supabase Auth directo se respeta `ADR-024` y no hay un endpoint de intercambio propio que proteger, versionar y mantener.
- **El tipado del contrato es compartible.** Los tipos de `api/` son la contrapartida de los DTO del backend y hoy están escritos a mano, lo que deja abierta la puerta a generarlos desde OpenAPI cuando `P8` (`05-api-design.md`) se cierre.

### Negative

- **Los tipos del contrato están duplicados a mano**, backend y frontend. Hoy es la opción honesta porque `P8` está abierto y no hay especificación OpenAPI de la que generarlos; el riesgo es deriva silenciosa, mitigado parcialmente porque MSW obliga a escribir las respuestas con su forma real. **Cuando `P8` cierre, hay que generar estos tipos.**
- **Sin renderizado en servidor, la primera carga descarga la aplicación entera.** Irrelevante en un panel que se abre al empezar el turno y se deja abierto; sería un problema si algún día hubiera una pantalla pública, y entonces esta decisión habría que reabrirla.
- **El sondeo no es tiempo real.** La Bandeja refresca por intervalo, con la latencia que eso implica. Supabase Realtime ya está en el stack (`P1`) y es el camino natural, pero exige exponer tablas o un canal, y eso es una decisión de modelo de datos que no toca aquí. Se registra como mejora, no como deuda: para una bandeja atendida por dos o tres personas, unos segundos de latencia no cambian la operación.
- **Tailwind en el marcado hace el HTML más ruidoso** y exige disciplina para extraer componentes en vez de copiar clases.
- **Dos ecosistemas de pruebas en el repositorio** (Jest en el backend, Vitest en el frontend). Unificar no es posible sin perder la integración de Vitest con Vite, y no son dos suites que se ejecuten juntas.

---

## Alternativas consideradas

| Alternativa | Por qué se rechazó |
|---|---|
| **Next.js (App Router)** | Su valor principal —renderizado en servidor, rutas de API, SEO— no aplica: cero pantallas públicas y el backend ya es NestJS con contrato versionado. Costaría un segundo servicio en Railway y otra copia de los secretos. Sería la elección correcta el día que exista una web pública de reservas, y entonces conviviría con esto en vez de sustituirlo. |
| **Vue 3 / Nuxt** | Técnicamente adecuados. Se descartó por ecosistema y continuidad: no hay nada en el producto que pida Vue, y la elección entre dos opciones equivalentes se resuelve por la de mayor superficie de mantenimiento. |
| **Remix / SvelteKit** | Mismo razonamiento que Next: su fuerte es el renderizado en servidor. |
| **Una librería de componentes completa (MUI, Ant Design, Chakra)** | Impone su estética y pesa más de lo que resuelve en un panel con pocos componentes repetidos. La vista de iPad además necesita un diseño táctil propio (`DEC-040`), no una tabla de escritorio adaptada. |
| **Redux Toolkit / Zustand** | Lo único global es la sesión. Todo lo demás es estado de servidor, que es trabajo de TanStack Query; mezclar los dos acaba en una caché duplicada y desincronizada. |
| **`fetch` con `useEffect`, sin librería de datos** | Reimplementa sondeo, invalidación, deduplicación y reintentos, peor y en cada pantalla. |
| **Supabase Realtime en lugar de sondeo, ya en la Parte 1** | Exige decidir qué se expone y cómo se autoriza — decisión de modelo de datos que no corresponde a esta ADR. El sondeo es suficiente para la operación real y se puede sustituir sin tocar las pantallas, porque el acceso a datos está detrás de los módulos de `api/`. |
| **Autenticación con un `/v1/auth/login` propio en Blanc** | Es literalmente la Opción B de `ADR-024`, **evaluada y rechazada**: duplica la superficie de emisión de tokens (dos secretos, dos mecanismos de firma, un endpoint de intercambio que proteger) sin ganar nada sobre la Opción A. |
| **Deducir el rol del JWT en el cliente** | `DEC-029`: el rol y el alcance no viajan en el token. Habría que leer un claim que no existe. |

---

## Notas

- **Nada de esto se ha verificado contra Supabase real.** No hay credenciales en este entorno, así que el flujo de login está construido contra el contrato documentado de `@supabase/supabase-js` y probado con MSW y con un doble del cliente, nunca contra el proyecto real. Es la misma situación que `ADR-024` ya declaró para el backend y que `ADR-008` declara para Meta: **es una tarea de verificación de despliegue, no una decisión abierta.**
- **El Custom Access Token Hook de `ADR-024` sigue sin crearse**, y el frontend no depende de él: obtiene rol y alcance de `GET /yo`, que los lee de PostgreSQL. Si el hook se crea más adelante, `/yo` sigue siendo la fuente para el cliente — un claim en el token no mejora nada aquí y añadiría una segunda fuente de verdad.
- El diseño visual (paleta, tipografía) **no es materia de esta ADR**. Lo que sí fija es el medio: utilidades de Tailwind sobre tokens definidos en un único sitio, para que un cambio de identidad sea un cambio de configuración.
