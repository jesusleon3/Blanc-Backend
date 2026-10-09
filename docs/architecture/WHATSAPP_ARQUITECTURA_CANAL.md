# WhatsApp — arquitectura de canal: API oficial y Bandeja Compartida

> **Estado:** decisión cerrada (`DEC-043`, 2026-10-09). Sin implementar.
> **Decisión del negocio:** *"el riesgo de baneo por usar APIs no oficiales es inaceptable. El sistema Blanc utilizará estrictamente la API Oficial de Meta (Cloud API)."*
> **Reemplaza** al diseño de "ecos" de `DEC-038` (2026-10-09, misma semana), que resolvía un problema que esta decisión **elimina de raíz**. Ver §1.

---

## 1. Por qué el problema de los "Ecos" desapareció

Hace unos días se diseñó un mecanismo para detectar que una persona había respondido desde la app del celular mientras el bot creía tener el control: escuchar los mensajes salientes y, al ver uno que la plataforma no envió, pausar el bot en esa conversación.

Ese diseño **ya no hace falta**, y conviene entender por qué, porque la razón es estructural y no una simplificación:

> Al dar de alta un número en la **Cloud API de Meta**, ese número **deja de poder usarse en la app de WhatsApp Business**. No es una recomendación ni una política interna: es cómo funciona la plataforma.

Si la app no puede emitir, **no existe un segundo emisor**. No hay colisión que detectar, no hay eco que escuchar, no hay carrera entre el bot y una persona. El problema no se gestiona: se vuelve imposible.

**Esto es estrictamente mejor que el diseño anterior**, y no solo por ser más simple:

| | Diseño del eco (`DEC-038`, descartado) | Canal único (`DEC-043`) |
|---|---|---|
| Colisión bot/humano | **Se detecta tarde**: ambos mensajes ya salieron y la clienta vio dos respuestas | **Imposible por construcción** |
| Dependía de | Que el proveedor emitiera ecos — **un supuesto sin verificar** (`N-07`) | Nada externo sin verificar |
| Historial de la conversación | Parcial: lo que pasara por el celular podía perderse | **Completo**: todo el tráfico pasa por el backend |
| Trazabilidad de quién dijo qué | Reconstruida por inferencia | Directa: cada mensaje tiene autor conocido |

Los pendientes `N-05`, `N-06` y `N-07` quedan **cerrados por no aplicar**.

---

## 2. 🔴 La consecuencia que cambia el plan: la Bandeja Compartida pasa a ser bloqueante

Aquí está lo que hay que ver antes de celebrar la simplificación.

Hasta esta decisión, el handoff humano tenía una red de seguridad implícita: **si el panel de Blanc fallaba o no estaba listo, el equipo seguía teniendo WhatsApp en el celular.** Esa red acaba de desaparecer.

> **Con la Cloud API, el panel de Blanc es el único lugar del mundo desde donde se puede responder a una clienta.** Si la Bandeja Compartida no funciona, el negocio **no puede hablar con nadie**.

Esto reclasifica el entregable:

- **Antes:** la Bandeja Compartida era una comodidad del panel administrativo, prevista para la Fase 4.
- **Ahora:** es **condición de puesta en marcha**. No se puede migrar un solo número a la Cloud API antes de que exista una bandeja funcional, porque el momento de la migración es exactamente el momento en que el celular deja de servir.

**Consecuencia de secuencia, no de diseño:** la migración de números **no puede ir primero**. Debe ir después de que la bandeja esté en producción y probada. Si el orden se invierte, el salón se queda incomunicado.

### 2.1 Qué tiene que saber hacer la bandeja, como mínimo

No es una lista de deseos: es lo que hoy hace la app del celular y dejará de hacer.

- Ver las conversaciones de **las tres sucursales**, filtradas por la que corresponda al número receptor.
- Leer el hilo completo y **escribir como el negocio**.
- Saber si una conversación la lleva el bot o una persona (el `modo` que ya existe en `Conversacion`).
- **Tomar** una conversación y **devolverla** al bot — explícitamente, nunca solo (`RN-ESC-03`).
- **Reasignar** entre Dueña y Encargada, que la Dueña pidió literalmente.
- Avisar de algo nuevo sin que haya que estar mirando la pantalla.

### 2.2 Lo que la bandeja NO puede replicar

Conviene decirlo ahora y no el día de la migración:

- **El historial anterior no viaja.** Las conversaciones que hoy viven en los celulares **no se transfieren** a la Cloud API. Blanc arranca con el historial vacío para cada clienta. La Dueña ya anticipó esto (*"probablemente se tenga que hacer migración o si no ver la manera"*): la respuesta honesta es que **no hay manera por API**, solo exportaciones manuales desde cada teléfono, y quedarían fuera del sistema.
- **Fuera de horario no hay nadie.** La Dueña aceptó que el escalamiento espera a la mañana. Eso ya era cierto; lo nuevo es que ahora tampoco puede alguien contestar desde la cama con el celular.

---

## 3. La ventana de 24 horas deja de ser un detalle y pasa a ser una restricción dura

Con una integración no oficial esto no existía. Con la Cloud API sí:

> Pasadas **24 horas** desde el último mensaje de la clienta, el negocio **no puede escribirle libremente**. Solo puede enviarle una **plantilla preaprobada por Meta**, y esa plantilla **se cobra**.

Tres flujos ya aprobados chocan con esto:

| Flujo | Problema |
|---|---|
| **Recordatorio 24h antes** (`RN-NOT-*`) | Casi siempre cae fuera de la ventana → es plantilla de pago, **en cada cita**. La Dueña confirmó que son obligatorios: *"sí se tienen que mandar recordatorios automáticos"* |
| **Aviso de lista de espera** (`DEC-042`) | Se avisa a una clienta que quizá lleva días sin escribir → plantilla. Y una plantilla **solo admite variables en huecos fijos**, no texto libre: hay que diseñarla y aprobarla antes, con sus parámetros |
| **Escalamiento que "espera a mañana"** (`DEC-042`) | Si una clienta escribe el sábado por la noche y nadie responde hasta el lunes, **ya pasaron más de 24h**: la respuesta humana deja de ser libre y necesita plantilla. Un retraso operativo se convierte en un costo y en una fricción de redacción |

### 3.1 Lo que esto obliga a hacer antes de Fase 4

- **Inventariar y redactar cada plantilla**, con sus variables, y **someterla a aprobación de Meta**. Es un trámite con latencia externa, como la verificación de negocio.
- **Cerrar `Pregunta 8`** (presupuesto). Ya no se puede aplazar con "se decide después": el modelo de cobro de Meta define cuántos recordatorios son viables. La Dueña dio dirección —*"sí se asume el costo, pero que sea el menor posible"*— pero hace falta el análisis de precios y escenarios que ella misma pidió.
- **Verificar el modelo de precios vigente de Meta** (`N-13`). Cambia con cierta frecuencia y no debe asumirse de memoria — mismo criterio que llevó a descubrir que el proyecto firma con ES256 y no HS256.

---

## 4. Trámites externos que hay que empezar ya

Ninguno depende de escribir código, y todos tienen tiempo de espera ajeno:

1. **Verificación de negocio ante Meta.** `DISCOVERY_CHECKLIST.md` 1.29 ya dejó dicho que puede arrancar en paralelo. Ahora es camino crítico.
2. **Alta de los 3 números** en la WABA, uno por sucursal (confirmado por la Dueña).
3. **Aprobación de plantillas**, que no puede empezar hasta tener redactados los textos.
4. **Plan de migración número por número**, con su ventana de corte — y **después** de que la bandeja esté lista (§2).

---

## 5. Lo que esta decisión cierra

| Pendiente | Estado |
|---|---|
| **`ADR-008`** — oficial vs. Evolution, abierto desde el inicio del proyecto | **RESUELTO**: API oficial, en exclusiva |
| **`P7`** — sign-off de `ADR-008` | **RESUELTO** |
| **`N-05`** — qué eventos salientes cuentan como intervención humana | **No aplica** |
| **`N-06`** — demora deliberada para mitigar la carrera bot/humano | **No aplica** |
| **`N-07`** — verificar coexistencia app + API en Meta | **No aplica** |

**Y revierte una petición previa de la Dueña.** El 2026-08-03 pidió explícitamente *"que exista la posibilidad de usar las dos, no quiero que sea simultáneo, sino que en la configuración decidamos"* — dos adaptadores configurables. Esta decisión lo anula: **habrá un solo adaptador**. No es una contradicción a resolver, es un cambio de opinión informado por el riesgo de baneo, y queda registrado como tal para que nadie reabra el doble adaptador creyendo que sigue vigente.

---

## 6. Pendientes nuevos

| # | Pendiente | Responde | Bloquea |
|---|---|---|---|
| `N-13` | Verificar el modelo de precios vigente de Meta y correr escenarios de costo | Externa + Dueña | `Pregunta 8`, diseño de notificaciones |
| `N-14` | Inventario y redacción de las plantillas, con sus variables | Dueña + Arquitectura | Aprobación de Meta, Fase 4 |
| `N-15` | Plan de migración de los 3 números, con ventana de corte y aviso a clientas | Dueña | Puesta en marcha |
| `N-16` | Alcance mínimo de la Bandeja Compartida para poder migrar (§2.1) | Arquitectura | **Puesta en marcha** |
