# ADR-025 — Planificador operativo (Scheduler / Jobs)

- **Estado:** Accepted
- **Fecha:** 2026-10-15
- **Decide:** Arquitectura
- **Relacionada con:** `ADR-001` (Modular Monolith), `ADR-002` (Hexagonal), `ADR-012` (operación), `DEC-039` (Lista de Espera), `RN-ANT-03`/`RN-ANT-04` (Anticipos), `DEC-030` (cierre de cita), `RN-NOT-02` (recordatorio)

---

## Contexto

Las Fases 2 y 3 dejaron **cuatro tareas que dependen del paso del tiempo**, todas con su lógica de dominio construida y probada, y **ninguna con nada que las dispare**:

| Tarea | Qué pasa hoy si nadie la invoca |
|---|---|
| Avance de la Lista de Espera (`DEC-039`) | Una oferta vencida **no caduca nunca** y la fila se queda bloqueada en esa clienta |
| Expiración de anticipos (`RN-ANT-03`) | La cita se queda en `en_espera_pago` indefinidamente, ensuciando la agenda con un cobro que nadie va a pagar |
| Cierre de citas pasadas (`DEC-030`) | Las citas atendidas se quedan en `agendada` para siempre y ningún reporte de ocupación es fiable |
| Recordatorio 24 h (`RN-NOT-02`) | No se envía ninguno |

Dos de ellas se expusieron deliberadamente como **casos de uso invocables por HTTP** (`avanzar-turno`, `expirar`) precisamente para no inventar infraestructura antes de decidirla. Esta ADR decide esa infraestructura.

`02-architecture-principles.md` prevé *event-driven en proceso + outbox*, pero el outbox resuelve **entrega fiable de eventos**, no **disparo temporal**: un outbox sigue necesitando algo que lo drene periódicamente. Son problemas distintos y esta decisión es la del disparo.

---

## Decisión

**Cron en proceso con `@nestjs/schedule`, sobre jobs que son casos de uso invocables también por HTTP, protegidos por `pg_try_advisory_lock`.**

Tres piezas, y cada una responde a una pregunta distinta:

### 1. El disparo: `@nestjs/schedule` dentro del mismo proceso

No un worker aparte. Blanc es un **Modular Monolith** (`ADR-001`) desplegado en Railway como un solo servicio; un worker separado duplicaría el despliegue, la configuración y los secretos para ejecutar cuatro barridos que tardan milisegundos. El principio del proyecto —*"ningún patrón se construye dos veces contra el vacío"*— aplica directamente.

`@nestjs/schedule` se fija en **`^4.1.2`**, no en la última: la 12 exige NestJS 11/12 y el proyecto está en 10.4. Instalarla con `--legacy-peer-deps` habría metido una incompatibilidad silenciosa, el mismo error que ya se evitó dejando `jose` en v5 por ser v6 solo-ESM.

### 2. La ejecución: jobs que son casos de uso, no métodos del cron

**El cron no contiene lógica.** Cada job es un caso de uso que ya existe o que se añade al Bounded Context que le corresponde, y el planificador solo lo llama. Consecuencias, que son el motivo de hacerlo así:

- **Invocable a mano.** La Encargada puede disparar un barrido desde el endpoint administrativo sin esperar al cron — útil cuando algo quedó atascado y cuando el canal de WhatsApp aún no existe.
- **Probable sin relojes.** Las pruebas llaman al caso de uso con un `ahora` explícito. No hay que simular temporizadores ni esperar.
- **Sustituible.** Si mañana se mueve a un worker, a una cola o a un cron externo de Railway, **cambia quién llama, no qué se ejecuta**.

### 3. La exclusión mutua: `pg_try_advisory_lock`

Railway puede escalar a más de una instancia, y con cron en proceso **cada instancia dispararía el mismo barrido a la misma hora**. Dos instancias avanzando la Lista de Espera a la vez podrían ofrecer el mismo hueco a dos clientas.

Se usa `pg_try_advisory_lock(clave)`: lo concede PostgreSQL, que ya es el árbitro de todo lo demás en este sistema (las restricciones `EXCLUDE`, los índices únicos parciales). **`try` y no bloqueante**: si otra instancia tiene el cerrojo, esta **se salta el ciclo** en vez de esperar. Un barrido que se salta se repite en el siguiente tick; uno que espera acumula ejecuciones encoladas.

No hace falta tabla de cerrojos ni Redis: el cerrojo vive en la sesión y se libera solo si el proceso muere.

### 4. Aislamiento de errores por elemento

**Un elemento que falla no aborta el lote.** Cada barrido itera, captura por elemento, registra el fallo y sigue. Un barrido que se detuviera en el primer error dejaría sin procesar todo lo que viniera detrás — y el orden es por antigüedad, así que lo que quedaría sin procesar es justo lo más urgente.

Cada ejecución devuelve un resumen (`procesados`, `fallidos`) que se registra, para que un fallo sistemático sea visible en vez de silencioso.

### 5. Idempotencia por estado, no por bandera

Ningún job lleva marca de "ya procesado". **La idempotencia la da la máquina de estados**: un barrido selecciona por estado de origen y la acción cambia ese estado, así que una segunda ejecución inmediata no encuentra nada que hacer. Es la misma propiedad que ya protege las transiciones de `Cita`, y evita una columna que habría que mantener sincronizada.

---

## Consecuencias

### Positivas

- Las cuatro tareas temporales pasan de *construidas* a *operativas* sin infraestructura nueva que desplegar.
- El planificador es trivial de desactivar (una variable de entorno) y de disparar a mano.
- Las pruebas no dependen del reloj: el `ahora` entra por parámetro.
- El cerrojo lo da PostgreSQL, ya presente y ya confiable para este sistema.

### Negativas

- **Si el proceso está caído, no se dispara nada.** Un cron externo sí sobreviviría al reinicio del servicio. Se acepta porque las cuatro tareas son recuperables: al volver, el siguiente tick procesa todo lo atrasado — ninguna depende de haberse ejecutado *en ese instante exacto*.
- **Los barridos comparten CPU y pool de conexiones con las peticiones HTTP.** Con el volumen de un salón de tres sucursales es despreciable; dejaría de serlo con lotes de miles de filas, y entonces toca mover esto a un worker.
- **`pg_try_advisory_lock` protege contra ejecución concurrente, no contra relojes desincronizados.** Dos instancias con horas distintas dispararán en momentos distintos; cada una tomará el cerrojo en su turno. No es un problema aquí porque los barridos son idempotentes.
- Una dependencia nueva (`@nestjs/schedule`), anclada a una major que no es la última.

---

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| **Worker/proceso aparte** | Duplica despliegue, configuración y secretos para cuatro barridos de milisegundos. Es la opción correcta cuando los lotes crezcan, no antes |
| **Cron externo de Railway golpeando los endpoints** | Sobrevive a reinicios, pero exige exponer los barridos a internet con su propia credencial y deja la operación dependiendo de configuración fuera del repositorio. **Sigue siendo posible**: los endpoints existen, así que adoptarlo después no requiere reescribir nada |
| **Outbox + drenador** | Resuelve entrega fiable de eventos, no disparo temporal; el drenador necesitaría igualmente un planificador. No se descarta para el futuro, resuelve otro problema |
| **`setInterval` a mano** | Es lo que `@nestjs/schedule` hace, sin ciclo de vida ligado al módulo, sin apagado ordenado y sin expresiones cron legibles |
| **Tabla de cerrojos propia** | Reinventa `pg_try_advisory_lock` y añade el problema de liberar el cerrojo cuando un proceso muere sin limpiarlo |
