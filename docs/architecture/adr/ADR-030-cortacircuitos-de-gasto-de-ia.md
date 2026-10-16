# ADR-030 — Cortacircuitos de gasto de IA

- **Estado:** Accepted
- **Fecha:** 2026-10-16
- **Decide:** Arquitectura
- **Cierra:** `F-07` (`ARCHITECTURE_REVIEW.md`, severidad **High**)
- **Relacionada con:** `ADR-007` (gobernanza de IA), `ADR-011` (costos), `ADR-026` (frontera determinista de la IA), `ADR-028` (ingesta del webhook), `F-05`

---

## Contexto

`F-07` quedó abierto desde la revisión de arquitectura y fue el único de los cinco candidatos a ADR sin cubrir que seguía siendo **un vacío con consecuencia práctica** al cerrar el MVP (ver la nota de trazabilidad de `P6`). La review lo describió así: *"ningún ADR fija un número concreto de límite de gasto de IA, ni define quién lo revisa, ni qué hace el sistema al alcanzarlo. El principio de gobernanza de costo está declarado, pero sin mecanismo operativo."*

Y añadió una advertencia que condiciona la solución: **la respuesta ingenua —*"escalar todo a humano"* al tocar el límite— agravaría `F-05`**, porque nadie ha validado que el personal pueda absorber una escalada masiva.

El escenario que lo hace urgente no es el uso normal. Tres sucursales con una decena de conversaciones diarias no generan un gasto preocupante, y el bot solo invoca al modelo cuando su filtro determinista no acierta. Lo urgente es el **uso anómalo**: un bucle, una clienta mandando mensajes en ráfaga, o correo basura dirigido al número. Sin tope, el coste crece mientras nadie mira — y con el webhook procesando síncrono (`ADR-028`), cada mensaje entrante es una llamada potencial.

---

## Decisión

**Tope diario de llamadas al modelo, contado en PostgreSQL, que al agotarse degrada al intérprete determinista en vez de escalar.**

### 1. Qué pasa al alcanzar el tope — y por qué no es "escalar todo"

Al agotarse el presupuesto, **el bot sigue atendiendo**: clasifica con `AgenteDeterministicoAdapter`, que no tiene coste por mensaje y resuelve saludos, consultas de precios y de disponibilidad. Solo escala lo que ese intérprete no reconoce.

> **El tope degrada la comprensión, no el servicio.**

Tres cosas lo hacen la opción correcta y no un parche:

1. **Evita `F-05` por construcción.** No hay escalada masiva porque la mayoría de los mensajes siguen atendiéndose solos.
2. **No es un camino nuevo que haya que probar aparte.** Es **exactamente** el mismo comportamiento que el sistema ya tiene cuando no hay `OPENAI_API_KEY` (`ADR-026`), que es un modo de operación desplegable y probado.
3. **La frontera determinista no cambia.** El intérprete de respaldo devuelve la misma `Intencion`, así que `RN-CONV-01` se sigue cumpliendo por el tipo (`ADR-026`): no hay un camino degradado con menos garantías.

### 2. La cuenta vive en PostgreSQL, no en memoria

`agente.consumo_de_ia`: una fila por **fecha de pared de Querétaro**, con el número de llamadas.

Un contador en memoria habría sido una línea y **habría protegido justo del caso que no importa**. Lo que `F-07` teme es el gasto descontrolado por un bucle o una ráfaga, y en ese escenario lo probable es que el proceso se reinicie —Railway reinicia ante un fallo—: un contador en memoria volvería a cero en cada reinicio y **el tope no se alcanzaría nunca**. Con la cuenta en la base, sobrevive a reinicios y es compartida entre instancias.

**La fecha es de pared, no UTC.** El presupuesto es diario y "el día" es el día del salón: con UTC, el corte caería a las 18:00 de Querétaro, en mitad del turno de tarde.

### 3. Consultar e incrementar son un solo acto

```sql
INSERT INTO agente.consumo_de_ia (fecha, llamadas) VALUES ($1, 1)
ON CONFLICT (fecha) DO UPDATE SET llamadas = consumo_de_ia.llamadas + 1
  WHERE consumo_de_ia.llamadas < $2
RETURNING llamadas
```

Con dos métodos (`¿puedo?` + `registra`), diez mensajes simultáneos pasarían los diez la comprobación antes de que ninguno incrementara — y el tope no serviría **justo en el escenario de ráfaga que esto previene**. El `WHERE` del `DO UPDATE` hace que PostgreSQL decida con la fila bloqueada. Es el mismo criterio por el que el no-doble-booking vive en una restricción de la base y no en una consulta previa.

### 4. El valor por defecto es finito

`OPENAI_MAX_LLAMADAS_DIA`, y sin la variable, **500**. Un valor por defecto ilimitado dejaría sin protección a quien no configure nada, que es quien más la necesita. `0` apaga el modelo por completo.

Un valor no entero o negativo se trata como "no configurado" y se registra un aviso: un typo no debe desactivar el tope en silencio.

---

## Lo que esta ADR NO resuelve

> **El número no está calibrado contra coste real.** Nadie ha medido el precio por llamada ni el volumen esperado: `Pregunta 8` (presupuesto de WhatsApp e IA) y `N-13` (análisis de precios) siguen abiertas. **500 es una cota de cordura, no un presupuesto en pesos.**

Lo que sí queda resuelto es el **mecanismo** —que es lo que `F-07` pedía— y la pregunta *"¿qué hace el sistema al alcanzarlo?"*. Cuando haya cifras reales, ajustar el tope es cambiar una variable de entorno.

Tampoco hay **alerta** al alcanzarlo: queda en el log (`warn`, una vez al día para no enterrar otros errores) y en el consumo que `consumoDeHoy` expone. Avisar a una persona depende del mismo canal que `DEC-046` dejó pendiente de decisión.

---

## Consequences

### Positive

- **El gasto tiene un techo verificable**, y el techo sobrevive a reinicios y a múltiples instancias.
- **Un ataque de correo basura o un bucle no se traduce en coste ilimitado**, que era el riesgo concreto de `F-07`.
- **No agrava `F-05`.** La degradación mantiene el servicio en pie; el personal no recibe una avalancha.
- **Es observable.** `consumoDeHoy` da llamadas y tope, así que se puede ver cuánto margen queda sin mirar la factura.
- **La trazabilidad distingue los dos modos.** La auditoría registra `sinPresupuesto: true` cuando la decisión la tomó el intérprete de respaldo (`RN-CONV-04`): sin eso, un día de respuestas peores parecería un fallo del modelo.

### Negative

- **El tope es un número sin calibrar.** Si 500 resulta bajo, el bot entenderá menos durante el resto del día sin que nadie se entere más que por el log. Es el precio de poner un límite antes de tener datos de coste, y se consideró mejor que no tener límite.
- **El contador puede sobrecontar en una carrera.** Dos peticiones simultáneas pueden incrementar antes de que la segunda vea el tope; el `WHERE` lo impide en el borde, pero el error de ±1 es posible. Irrelevante para un presupuesto.
- **Una fila por día crece sin límite.** Son 365 filas al año, con dos columnas: no merece purga.
- **No hay alerta activa.** Depende del canal que `DEC-046` dejó pendiente.

---

## Alternativas consideradas

| Alternativa | Por qué se rechazó |
|---|---|
| **Escalar todo a humano al tocar el tope** | Es la respuesta obvia y la review ya advirtió que **agravaría `F-05`**: una escalada masiva que nadie ha validado que el personal pueda absorber. |
| **Contador en memoria** | Protege del caso que no importa. En el escenario de bucle, el proceso se reinicia y el contador vuelve a cero: el tope no se alcanzaría nunca. |
| **Tope en pesos en vez de en llamadas** | Más cercano a lo que al negocio le importa, pero exige conocer el precio por llamada y el consumo de tokens de cada petición — datos que no se tienen (`N-13`). Un tope en llamadas es aproximado y **medible hoy**. |
| **Límite por conversación en vez de diario** | Atajaría un bucle en una conversación y no una ráfaga desde muchos números. El diario cubre los dos, y el bucle en una conversación ya está acotado por la deduplicación de `wamid` (`ADR-028`). |
| **Dos métodos (`¿puedo?` y `registra`)** | API más legible y **tope inservible bajo concurrencia**, que es el único momento en que hace falta. |

---

## Verificación

| Qué se afirma | Qué lo sostiene |
|---|---|
| Corta al alcanzar el tope y sigue cortando | `presupuesto-de-ia.adapter.spec.ts` |
| El contador sobrevive a un reinicio | Mismo spec: una instancia nueva sobre la misma base ve el consumo anterior |
| Diez llamadas simultáneas con tope 5 dejan pasar exactamente 5 | Mismo spec |
| El presupuesto se renueva con el día **de pared** | Mismo spec, con dos horas del mismo día local y el día siguiente |
| Con el tope agotado el bot **sigue atendiendo** y no escala todo | `bot.spec.ts` — la clienta recibe los precios del catálogo real y la conversación sigue en `bot` |
| El filtro determinista **no consume** presupuesto | `bot.spec.ts` — cancelar escala sin gastar una llamada |
| La auditoría distingue la decisión sin presupuesto | `bot.spec.ts` — `sinPresupuesto: true` en el detalle |
| El tope por defecto es finito | `presupuesto-de-ia.adapter.spec.ts` |

⚠️ **Nada verificado contra OpenAI real**: no hay credenciales. Lo que está probado es el cortacircuitos, que es independiente del proveedor.
