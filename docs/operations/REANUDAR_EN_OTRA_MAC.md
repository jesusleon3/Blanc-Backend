# Cómo retomar el proyecto en una Mac nueva

> Escrito el 2026-11-25, antes de formatear la Mac donde se construyó todo. Si estás leyendo esto en
> una máquina nueva, empieza aquí.

---

## 1. Dónde quedó cada cosa

| Qué | Dónde está | ¿Se pierde al borrar la Mac? |
|---|---|---|
| **Código, migraciones, pruebas y toda la documentación** (`docs/`, `CLAUDE.md`, `contratos/`) | GitHub: `jesusleon3/Blanc-Backend`, rama `main` | **No.** Es la copia completa |
| **La bitácora de trabajo** (qué se hizo, por qué, qué falta) | `docs/PROJECT_STATUS.md` §16, dentro del repo | **No** |
| **Las instrucciones que Claude lee al abrir el proyecto** | `CLAUDE.md`, en la raíz del repo | **No** |
| **La memoria de Claude** (preferencias: todo en español, modo arquitecto, plantilla de ADR, etc.) | `~/.claude/projects/-Users-jesusleon-Claude-Proyecto-Blanc/memory/` | **Sí**, si no se respalda. Va en el zip (§2) |
| **El historial de conversaciones con Claude** (~60 MB) | `~/.claude/projects/-Users-jesusleon-Claude-Proyecto-Blanc/*.jsonl` | **Sí**, si no se respalda. Va en el zip (§2). **No debe subirse a GitHub**: contiene la conversación completa |
| **Permisos guardados de Claude para este proyecto** | `.claude/settings.local.json` (ignorado por git) | **Sí**. Va en el zip. Es comodidad, no indispensable |
| `node_modules` (~480 MB) | Carpetas `backend/` y `frontend/` | Se pierden **y no importa**: se reinstalan con `npm ci` |
| **Secretos** (claves de Meta, OpenAI, Supabase) | **No existen todavía.** Nunca se configuraron credenciales reales | Nada que respaldar hoy. Ver §5 |

**Lo esencial para seguir trabajando está en GitHub.** Claude recupera el contexto del proyecto leyendo
`CLAUDE.md` y `docs/PROJECT_STATUS.md`. La memoria y el historial son un complemento: sin ellos se puede
seguir trabajando igual, solo que Claude no recordará tus preferencias hasta que se las repitas.

---

## 2. El respaldo que NO está en GitHub

Un zip con la memoria de Claude, el historial de conversaciones y los permisos locales:

```
respaldo-claude-blanc-2026-11-25.zip
```

**Antes de borrar la Mac, ese zip tiene que quedar fuera de ella**: iCloud Drive, Google Drive o una
memoria USB. Si se queda solo en el Escritorio, se borra junto con todo lo demás.

---

## 3. Paso a paso en la Mac nueva

### 3.1 Usa el mismo usuario y la misma ruta (importante)

Claude guarda la memoria de cada proyecto en una carpeta cuyo nombre **se calcula a partir de la ruta
completa del proyecto**. Este proyecto vive en:

```
/Users/jesusleon/Claude Proyecto Blanc
```

y su memoria en:

```
~/.claude/projects/-Users-jesusleon-Claude-Proyecto-Blanc/
```

(cada `/` y cada espacio de la ruta se convierte en `-`). Si en la Mac nueva el usuario de macOS se
llama distinto o clonas el repo en otra carpeta, **Claude no encontrará la memoria por su cuenta**. Se
arregla copiándola a la carpeta que corresponda a la ruta nueva, pero es más fácil conservar ambas cosas
iguales: usuario `jesusleon` y carpeta `Claude Proyecto Blanc` en tu carpeta de inicio.

### 3.2 Instalar las herramientas

| Herramienta | Para qué | Versión en la Mac original |
|---|---|---|
| **Node.js** | Backend y frontend | `v26.12.0` |
| **OrbStack** (o Docker Desktop) | **Las pruebas del backend no corren sin Docker**: levantan PostgreSQL real con Testcontainers | OrbStack |
| **git** y **GitHub CLI (`gh`)** | Clonar y subir cambios | — |
| **Claude Code** | Seguir trabajando con Claude | `2.1.215` |

### 3.3 Clonar el proyecto

```bash
gh auth login                       # inicia sesión con la cuenta jesusleon3
cd ~
gh repo clone jesusleon3/Blanc-Backend "Claude Proyecto Blanc"
cd "Claude Proyecto Blanc"
git config user.email "<tu correo de siempre>"   # para que los commits sigan firmados igual
git config user.name "jesusleon"
```

### 3.4 Restaurar la memoria y el historial de Claude

Descomprime el zip y copia su contenido a su lugar:

```bash
mkdir -p ~/.claude/projects/-Users-jesusleon-Claude-Proyecto-Blanc
# Desde la carpeta donde descomprimiste el zip:
cp -R claude-proyecto/. ~/.claude/projects/-Users-jesusleon-Claude-Proyecto-Blanc/
cp settings.local.json "$HOME/Claude Proyecto Blanc/.claude/settings.local.json"
```

### 3.5 Instalar dependencias y comprobar que todo está bien

```bash
cd "$HOME/Claude Proyecto Blanc/backend"  && npm ci
cd "$HOME/Claude Proyecto Blanc/frontend" && npm ci
```

Con OrbStack abierto, corre las comprobaciones de `CLAUDE.md`. Si todo quedó bien, deberías ver:

| | Resultado esperado al 2026-11-25 |
|---|---|
| Backend `npm test` | **1388 pruebas en 81 suites**, todas en verde |
| Frontend `npm test` | **238 pruebas en 14 suites**, todas en verde |

### 3.6 Volver a abrir Claude

```bash
cd "$HOME/Claude Proyecto Blanc"
claude
```

Un buen primer mensaje:

> Lee `CLAUDE.md`, la entrada más reciente de `docs/PROJECT_STATUS.md` §16 y
> `docs/operations/REANUDAR_EN_OTRA_MAC.md`, y dime en qué estado está el proyecto y qué queda pendiente.

Si restauraste el historial, `claude --resume` muestra las conversaciones anteriores. No hace falta
reabrirlas: todo lo importante está en los documentos.

---

## 4. Lo que solo se habló en el chat (y que ahora queda aquí)

Estas conclusiones salieron de la conversación del 2026-11-14 y **no estaban escritas en ningún
documento del repo**.

### 4.1 Costo mensual de operar un negocio como Blanc

Escenario: **120 a 150 conversaciones al mes**, unos **10 mensajes enviados por conversación**, un solo
número de WhatsApp conectado directo a la API oficial de Meta. Tipo de cambio de **$18.55 MXN por
dólar** (FIX del 13 de noviembre de 2026).

| Concepto | MXN al mes |
|---|---|
| Meta (WhatsApp) | $31 – $79 |
| OpenAI (el bot) | $5 – $20 |
| Railway (servidor), plan Hobby o Pro | $130 – $371 |
| Supabase Pro (base de datos, inicio de sesión, respaldos) | $464 |
| IVA 16 % sobre los servicios en dólares | $101 – $149 |
| Comisión bancaria por cobros en dólares (~3 %) | $22 – $33 |
| Dominio `.com.mx` (prorrateado) | $30 – $50 |
| Línea telefónica dedicada a WhatsApp | $0 – $200 |
| **Total** | **≈ $780 – $1,370** |

**No incluye** el mantenimiento técnico (estimado en $1,000 – $4,800 MXN al mes, de 3 a 8 horas de un
desarrollador) ni el tiempo de la encargada atendiendo las conversaciones que escala el bot.

**El dato clave de Meta:** desde el **1 de octubre de 2026**, los mensajes de servicio (respuestas dentro
de la ventana de 24 h) dejaron de ser gratis sin límite. Ahora **los primeros 1,000 al mes por número son
gratis** y los siguientes se cobran como plantilla de utilidad (~$0.157 MXN cada uno). Las plantillas de
utilidad (el recordatorio de 24 h, la oferta de lista de espera, la reapertura) se cobran siempre.

### 4.2 ⚠️ Pendiente con fecha: cambiar el modelo de OpenAI antes del 14 de enero de 2027

- Blanc usa **`gpt-4o-mini`** por defecto (`MODELO_POR_DEFECTO` en
  `backend/src/modules/agente/infrastructure/llm/openai.adapter.ts`).
- **OpenAI lo apaga el 14 de enero de 2027.** Ese día cada llamada fallaría, el sistema lo trataría como
  "no entendí" y **pasaría todas las conversaciones a una persona, sin ningún error visible**.
- **Recomendación: `gpt-6-luna`** (publicado el 22 de septiembre de 2026). Cuesta US$0.10 por millón de
  tokens de entrada y US$0.50 de salida (≈ $2 MXN al mes en el volumen de §4.1), responde en menos de un
  segundo en modo sin razonamiento y está pensado para tareas de clasificación como esta.
- **No basta con cambiar el nombre del modelo.** El código manda `temperature: 0`, que los modelos nuevos
  pueden rechazar con error 400, y no manda `reasoning_effort`. Hay que **quitar `temperature`** y
  **añadir `reasoning_effort: "none"`**; si no, el bot se rompe igual de silencioso.
- Antes de salir a producción, **probar unos 50 mensajes reales** contra el modelo para confirmar que
  clasifica bien el español informal de WhatsApp. No encontré comparativas publicadas para este caso.

**Estado: no implementado.** Se ofreció hacer el cambio y quedó pendiente.

### 4.3 Otros pendientes antes de salir a producción

Los mismos que registra `GO_LIVE_RUNBOOK.md`, resumidos:

- **Los precios del catálogo son provisionales.** Los tiempos son oficiales de la Dueña; los importes no.
- Aprobar en Meta las **tres plantillas** de `PLANTILLAS_META.md`.
- **Nada está verificado contra Supabase, Meta, OpenAI ni Railway reales**: no hay credenciales todavía.

---

## 5. Los secretos, cuando existan

Hoy no hay ninguno: el proyecto nunca se conectó a servicios reales. Cuando se configuren:

- **Nunca en git.** Ni en el código, ni en `docs/`, ni en un `.env` versionado. `.env.example` lleva
  solo los nombres de las variables, nunca valores.
- Viven en **las variables de entorno de Railway** (producción) y en **un gestor de contraseñas**
  (1Password, Bitwarden, el Llavero de iCloud) como copia de respaldo.
- Si borras otra vez la Mac, los secretos se recuperan del gestor, no de un respaldo de archivos.

---

## 6. El repositorio de GitHub es público

Al 2026-11-25, `jesusleon3/Blanc-Backend` tiene visibilidad **pública**. No contiene secretos (se revisó
el historial completo), pero sí expone el modelo de negocio de Blanc, sus reglas internas, el catálogo de
la Dueña y el correo del autor de los commits. **Se recomienda hacerlo privado** desde GitHub →
Settings → *Change repository visibility*, o con:

```bash
gh repo edit jesusleon3/Blanc-Backend --visibility private --accept-visibility-change-consequences
```
