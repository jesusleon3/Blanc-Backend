# Inventario de plantillas de WhatsApp — cierre de `N-14`

> **Qué es esto:** el texto exacto, listo para copiar y pegar en el **Meta Business Manager**, de las tres plantillas que Blanc necesita. Cierra `N-14`, que estaba abierto desde el cierre de `P7` (2026-10-09).
>
> **Por qué bloqueaba:** sin plantillas aprobadas, **el sistema no puede escribirle a una clienta cuando la ventana de 24 h de Meta está cerrada** (`N-14`). Eso incluye los dos avisos automáticos que el Planificador dispara —recordatorio y oferta de hueco—, que son precisamente los que salen cuando nadie ha escrito en horas. Un nombre que Meta no reconoce produce un **rechazo del envío**, no un mensaje raro.

---

## 1. Antes de empezar: qué es una plantilla y por qué hacen falta

Meta solo permite **texto libre durante 24 horas** desde el último mensaje de la clienta. Pasada esa ventana, lo único que se puede enviar es una **plantilla previamente aprobada por Meta**. No es una decisión de Blanc: es la regla de la plataforma, y el dominio la valida **antes** de llamar a Meta para que el operador reciba una instrucción (*"usa una plantilla"*) en vez de un fallo genérico de API.

Tres cosas que conviene saber antes de darlas de alta:

- **La aprobación tarda**, normalmente minutos y a veces horas. Es la razón de que sea el **paso 1** del runbook y no el último.
- **Categoría `UTILITY`, no `MARKETING`.** Las tres son avisos sobre una transacción que la clienta ya inició (su cita). Clasificarlas como `MARKETING` las sometería a las reglas de consentimiento publicitario y a un coste distinto, y podría provocar el rechazo de la aprobación.
- **El orden de las variables importa y Meta no lo valida.** Meta sustituye `{{1}}`, `{{2}}`… por lo que se le mande, sin comprobar nada. Si el orden se equivoca, la clienta recibe la hora donde va la fecha y **Meta lo entrega igualmente**.

---

## 2. Las tres plantillas

Los nombres **tienen que coincidir exactamente** con la constante `PLANTILLAS` de `backend/src/modules/conversaciones/domain/plantillas.ts`. Es la fuente única de verdad y el selector del panel la sirve por `GET /v1/conversaciones/plantillas`.

| Nombre en Meta | Idioma | Categoría | Variables | Quién la envía |
|---|---|---|---|---|
| `recordatorio_cita_24h` | `es_MX` | `UTILITY` | 1 | El Planificador, 24 h antes (`RN-NOT-02`) |
| `oferta_hueco_lista_espera` | `es_MX` | `UTILITY` | 2 | El Planificador, al liberarse un hueco (`DEC-039`) |
| `reapertura_conversacion` | `es_MX` | `UTILITY` | 1 | Una persona, desde la Bandeja Compartida |

### 2.1 `recordatorio_cita_24h`

- **Nombre exacto:** `recordatorio_cita_24h`
- **Idioma:** Español (México) — `es_MX`
- **Categoría:** `UTILITY`
- **Sin encabezado, sin pie, sin botones.**

**Cuerpo (copiar tal cual):**

```
Hola, te recordamos tu cita en Blanc mañana a las {{1}}. ¿Nos confirmas que vienes? Responde este mensaje y listo.
```

| Variable | Qué se manda | Ejemplo |
|---|---|---|
| `{{1}}` | Hora de la cita, en hora de pared de Querétaro | `10:00 a.m.` |

> **Por qué pide responder:** la confirmación es **interactiva** (`DISCOVERY_CHECKLIST` 1.23). La respuesta de la clienta reabre la ventana de 24 h y el bot la interpreta: un *"sí"* pasa la cita de `pendiente_confirmacion` a `confirmada`. Si el texto no invitara a responder, el ciclo no se cerraría y alguien tendría que llamar.
>
> **Ejemplo de muestra para Meta** (lo pide al aprobar): `10:00 a.m.`

### 2.2 `oferta_hueco_lista_espera`

- **Nombre exacto:** `oferta_hueco_lista_espera`
- **Idioma:** `es_MX` · **Categoría:** `UTILITY`

**Cuerpo:**

```
¡Buenas noticias! Se liberó un lugar en Blanc el {{1}} a las {{2}}. Si te interesa, respóndenos pronto: el lugar no queda reservado hasta que lo confirmemos.
```

| Variable | Qué se manda | Ejemplo |
|---|---|---|
| `{{1}}` | Fecha del hueco | `7 de diciembre` |
| `{{2}}` | Hora del hueco | `05:00 p.m.` |

> **La última frase no es cortesía: es `RN-AGE-13`.** La oferta **no retiene el lugar** — mientras la clienta decide, otra puede tomarlo. Si el mensaje diera a entender que el lugar está apartado, la clienta llegaría a un hueco vendido y la culpa sería del texto. **No se debe suavizar esa frase al aprobar la plantilla.**

### 2.3 `reapertura_conversacion`

- **Nombre exacto:** `reapertura_conversacion`
- **Idioma:** `es_MX` · **Categoría:** `UTILITY`

**Cuerpo:**

```
Hola {{1}}, te escribimos de Blanc para dar seguimiento a tu último mensaje. Si nos respondes por aquí, seguimos la conversación.
```

| Variable | Qué se manda | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre de la clienta | `Andrea` |

> **Para qué existe:** es la única vía cuando la Encargada necesita retomar el contacto con la ventana cerrada y no hay recordatorio ni oferta de por medio — el caso típico es una clienta que escribió el viernes por la tarde y a la que hay que contestar el lunes. Sin esta plantilla, esa conversación quedaría muerta hasta que la clienta volviera a escribir.

---

## 3. Cómo darlas de alta

1. **Meta Business Manager** → *WhatsApp Manager* → *Plantillas de mensajes* → **Crear plantilla**.
2. Categoría **`UTILITY`**. Idioma **Español (México)**.
3. **Nombre:** copiado tal cual de la tabla. Meta solo admite minúsculas, números y `_` — los de arriba ya cumplen.
4. Pegar el cuerpo **sin cambiar el número ni el orden de las variables**.
5. Rellenar los ejemplos de muestra que Meta pide (los de las tablas sirven).
6. Enviar a revisión y **esperar el estado `Approved`**.

### Al terminar, verificar que el código coincide

```bash
cd backend && npx jest src/modules/conversaciones/infrastructure/http/conversaciones.e2e.spec.ts -t "plantillas"
```

Y **quitar la marca de provisional**: en `plantillas.ts`, el endpoint devuelve hoy `provisional: true` y `pendiente: 'N-14'`, y el panel lo advierte en pantalla. Cuando las tres estén `Approved`, cambiar esa marca es el acto que cierra `N-14` en el código.

> Si Meta rechaza una plantilla o exige cambiar su redacción, **el nombre no se cambia**: se ajusta el texto. El nombre es el contrato con el código; el texto, no.

---

## 4. Lo que estas tres plantillas NO cubren

Dicho explícitamente, para que nadie lo descubra en producción:

- **No hay plantilla de cancelación.** `DEC-040`: ninguna clienta cancela sola, y cancelar lo comunica una persona. Si se añadiera, el bot no la usaría.
- **No hay plantilla de confirmación de anticipo.** Los datos de transferencia y la validación del comprobante los da una persona desde la Bandeja (`RN-ANT-01`), y en ese momento la ventana está abierta porque la clienta acaba de escribir.
- **No hay plantilla promocional.** Sería `MARKETING`, con otras reglas de consentimiento y otro coste. No está en el alcance del MVP.
- **El coste por plantilla enviada no está presupuestado.** `Pregunta 8` sigue abierta: la Dueña dio dirección (*"sí se asume el costo, pero que sea el menor posible"*, con recordatorios **obligatorios**) y falta el análisis de precios (`N-13`). Con tres sucursales y un recordatorio por cita, el volumen es estimable **y nadie lo ha estimado**.
