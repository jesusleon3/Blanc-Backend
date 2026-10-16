# ADR-026 — Frontera determinista de la IA y provisión de puertos cruzados

- **Estado:** Accepted
- **Fecha:** 2026-10-16
- **Decide:** Arquitectura
- **Relacionada con:** `ADR-001` (Modular Monolith), `ADR-002` (Hexagonal/Puertos), `ADR-008` (WhatsApp), `ADR-023` (Modelo de plataforma), `RN-CONV-01`/`RN-CONV-02`/`RN-CONV-05` (IA), `P1` (stack: OpenAI solo como intérprete), `P5` (dependencias entre Bounded Contexts), `DEC-044` (el Bot como principal de sistema)

---

## Contexto

Esta ADR formaliza **dos reglas que ya están implementadas y vigiladas por pruebas**, y que hasta ahora solo vivían en comentarios de código y en `CLAUDE.md`. Las dos salieron del cierre de Fase 4, y las dos tienen el mismo problema de fondo: **son invariantes que una revisión de código no detecta si se violan**, porque violarlas no rompe nada visible.

### Regla 1 — ¿Cómo se garantiza que la IA no decide?

`RN-CONV-01` dice que *la IA interpreta, nunca decide*, y `P1` cerró el stack con *"OpenAI exclusivamente como intérprete con salida estructurada (nunca decide reglas de negocio)"*. Ninguno de los dos dice **cómo** se hace cumplir.

La forma habitual es el prompt: *"no inventes precios"*. No hay ninguna garantía de que se respete — y el fallo es catastrófico en este negocio concreto, porque un precio inventado por WhatsApp es un precio que la clienta va a exigir al llegar al salón.

### Regla 2 — ¿Quién provee un puerto que dos Bounded Contexts comparten?

`P5` cerró con el patrón `IntegracionModule`: el BC que **consume** declara el puerto, y un módulo `@Global` externo provee el adaptador. Lo que `P5` no dijo —porque nadie lo sabía— es que **ese patrón tiene una precondición no evidente**.

Durante la Fase 4 se violó **dos veces**, las dos en silencio:

| Dónde | Lo que el código afirmaba | Lo que pasaba |
|---|---|---|
| `IntegracionModule` → `NOTIFICADOR_RECORDATORIO_PORT`, `NOTIFICACION_LISTA_ESPERA_PORT` | Que sobrescribía los adaptadores de solo-log de `AgendaModule` | **Ni un recordatorio ni una oferta de hueco salieron nunca por WhatsApp** durante toda la Parte 2, con la suite completa en verde |
| `AgenteModule` → `ORQUESTADOR_DE_BOT_PORT` | Que sobrescribía el adaptador inerte de `ConversacionesModule` | El bot no contestaba a nadie |

La causa es la misma: **`@Global` en NestJS solo evita tener que importar el módulo. No da prioridad sobre nada — un proveedor local gana siempre sobre uno global.** Se verificó aislando el caso en un contenedor mínimo antes de aceptarlo.

---

## Decisión

### 1. La frontera determinista de la IA se impone con el TIPO DE RETORNO, no con el prompt

El único valor que un modelo de lenguaje puede devolver al dominio es una `Intencion`:

```ts
export interface Intencion {
  tipo: TipoDeIntencion;        // qué quiere la clienta, de una lista cerrada
  fecha?: string;               // YYYY-MM-DD que ella mencionó
  hora?: string;                // HH:MM que ella mencionó
  servicioMencionado?: string;  // tal como lo dijo, SIN resolver
  confianza: number;            // 0..1
}
```

**Lo que este tipo no tiene es la decisión:** no hay campo para un precio, ni una duración, ni un hueco, ni "está disponible", ni el texto de la respuesta al cliente. Por tanto:

> **Un modelo alucinando, con el prompt comprometido por inyección, o con la API cambiada de versión, no puede inventar un precio — porque no tiene dónde escribirlo.**

Tres consecuencias que se derivan y son obligatorias:

1. **Todo dato y toda acción salen de los casos de uso reales** (`HerramientasDelBot`), los mismos que usa el mostrador. No existe una vía paralela para obtener un precio o agendar.
2. **Lo que no cabe en `Intencion` no cruza la frontera.** El adaptador valida la respuesta del modelo contra el tipo y degrada a `desconocida` con confianza `0` lo que no encaje — y eso escala a una persona (`RN-CONV-05`).
3. **Añadir un campo a `Intencion` es una decisión de arquitectura**, no un detalle de implementación: hay que preguntarse si se acaba de mover una decisión al modelo.

**Corolario sobre la trazabilidad (`RN-CONV-04`):** se audita la intención, la confianza y la fuente de la decisión; **nunca el texto de la clienta ni la respuesta** — eso es PII (`RN-AUD-01`) y ya vive en el hilo de la conversación, que es donde se lee.

### 2. Si otro módulo provee un puerto, el BC que lo declara NO declara un valor por defecto

Regla positiva, sin excepciones:

> **Un Bounded Context que declara un puerto destinado a ser provisto desde fuera no registra ningún proveedor para él.** Se queda sin proveedor, y el contenedor **falla al arrancar**.

El fallo ruidoso es la propiedad buscada, no un efecto colateral que se tolera. La alternativa —un valor por defecto local "por si acaso"— produce exactamente los dos defectos de la tabla de contexto: **el sistema arranca, parece funcionar, y no hace lo que dice hacer.**

Dos consecuencias operativas:

1. **Un adaptador provisional puede existir sin estar registrado.** `RecordatorioSoloLogAdapter` sigue en el repositorio porque documenta el comportamiento anterior y sirve si hay que apagar los envíos; lo que no puede es estar en la lista de `providers` de un módulo.
2. **Apagar un componente es una variable de entorno, no quitar un módulo.** Si `AgenteModule` se quitara de `AppModule`, nadie proveería `ORQUESTADOR_DE_BOT_PORT` y la aplicación no arrancaría. El interruptor es `BOT_ACTIVO=false`, que hace que el propio `AgenteModule` provea el adaptador inerte — mismo mecanismo que `PLANIFICADOR_ACTIVO` (`ADR-025`).

---

## Consequences

### Positive

- **`RN-CONV-01` pasa de aspiración a propiedad estructural.** Deja de depender de que el prompt se respete, del modelo contratado o de la versión de la API. Es verificable leyendo un tipo.
- **Auditar la frontera de la IA es leer un directorio.** Todo lo que toca un modelo de lenguaje vive en `modules/agente/`.
- **Cambiar de proveedor de IA no toca el dominio.** El puerto `AgenteConversacionalPort` devuelve `Intencion` y nada más; el adaptador determinista y el de OpenAI son intercambiables, y el determinista es un modo de operación desplegable, no un simulacro de pruebas.
- **La familia de defectos de la Regla 2 queda cerrada mecánicamente.** `integracion/sin-defaults-locales.spec.ts` verifica, para cada puerto provisto desde fuera, que el BC que lo declara no tenga un `provide:` para él y que el proveedor externo sí lo tenga.
- **El rollback de un componente opcional es verificable en despliegue.** `BOT_ACTIVO=false` se puede probar: con esa variable, el canal, la Bandeja y el recordatorio siguen pasando sus pruebas y solo fallan las que exigen bot.

### Negative

- **El bot entiende menos de lo que entendería sin esta frontera.** No puede responder nada que no esté previsto como intención, y ante la duda escala. Es un coste real en atención humana, aceptado deliberadamente: una respuesta inventada cuesta más que un escalamiento de más.
- **Añadir una capacidad al bot cuesta más que cambiar un prompt.** Hace falta una intención nueva, su herramienta y sus pruebas. Es el precio de que el prompt no sea la frontera.
- **La Regla 2 hace que montar un subconjunto de módulos en una prueba sea más laborioso:** un E2E que monte `IntegracionModule` arrastra `ConversacionesModule` y por tanto necesita `AgenteModule`. Se consideró aceptable: el fallo es inmediato y el mensaje de Nest nombra el puerto exacto.
- **`sin-defaults-locales.spec.ts` es una prueba sobre el texto de los módulos**, no sobre el contenedor. Es exacta para lo que afirma —que la declaración duplicada no existe en ninguna composición posible— pero hay que mantener su lista a mano cuando se añade un puerto cruzado.

---

## Alternativas consideradas

| Alternativa | Por qué se rechazó |
|---|---|
| **Confiar la frontera de la IA al prompt** y validar la salida con un esquema laxo | Es la práctica habitual y es insuficiente aquí: el esquema laxo admitiría un campo `precio` el día que alguien lo añada "para enriquecer la respuesta", y nadie lo notaría hasta que una clienta reclame un precio que el salón no dio. |
| **Dejar que el modelo redacte la respuesta final** con los datos reales inyectados en el contexto | Dárselos le permite repetirlos, y repetirlos mal. El bot redacta con plantillas de texto sobre valores que vienen de los casos de uso; es más rígido y es la razón de que no pueda equivocarse en una cifra. |
| **Resolver la Regla 2 con el orden de los `imports` en `AppModule`** | Es lo que se creía que funcionaba, y no funciona: el orden no afecta la precedencia de un proveedor local. Era la causa del defecto, no su solución. |
| **Resolver la Regla 2 con `forwardRef` entre módulos** | Haría que `ConversacionesModule` importara `AgenteModule` y viceversa: un ciclo explícito, que es justo lo que `P5` cerró y lo que `madge --circular` prohíbe. |
| **Detectar la Regla 2 con una prueba de contenedor** que inspeccione qué instancia recibió cada consumidor | Solo detecta el caso en el grafo que esa prueba monte, y el defecto vive precisamente en las composiciones que nadie monta. Por eso la prueba es sobre el texto de los módulos. |

---

## Verificación

| Qué se afirma | Qué lo sostiene |
|---|---|
| El modelo no puede devolver un precio ni un horario | El tipo `Intencion` (`modules/agente/domain/intencion.ts`) y `interpretarRespuesta` en el adaptador de OpenAI |
| Los precios que el bot dice son los del catálogo real | `agente/bot.spec.ts` — *"los PRECIOS que responde son los de la tabla de servicios"* y *"un servicio de COTIZACIÓN MANUAL… NUNCA da el precio como final"* |
| La disponibilidad sale de la base, no del modelo | `agente/bot.spec.ts` — el par de pruebas con la misma pregunta y la silla ocupada/libre |
| La auditoría no contiene PII | `agente/bot.spec.ts` — *"audita la intención, la confianza y la fuente, y NUNCA el texto de la clienta"* |
| Ningún BC declara un default de un puerto provisto desde fuera | `integracion/sin-defaults-locales.spec.ts` (19 pruebas) |
| El cableado real de notificaciones funciona de extremo a extremo | `agente/bot.e2e.spec.ts` — *"EL BARRIDO REAL de recordatorios sale por WhatsApp y deja el contador intacto"* |
| El rollback por entorno funciona | Con `BOT_ACTIVO=false`, de las 13 pruebas del E2E del bot fallan las 9 que exigen bot y pasan las 4 del canal |

---

## Notas

- **El adaptador de OpenAI no está verificado contra el servicio real.** No hay credenciales en este entorno, igual que con Meta y Supabase. Lo que sí está garantizado por construcción es que su salida pasa por la validación de tipo y que cualquier fallo suyo degrada a `desconocida` sin propagar — propagar devolvería un `500` al webhook de Meta y provocaría un bucle de reintentos.
- Esta ADR **no** reabre `DEC-044` ni decide qué puede escribir el bot: eso es la Enmienda 1 de `DEC-044` (2026-10-16), registrada en `PROJECT_STATUS.md` §5.
