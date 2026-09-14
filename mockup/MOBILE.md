# Blanc — Mockup en móvil (PWA)

Este mockup es una **Progressive Web App estática**: sigue siendo HTML/CSS/JS
vanilla puro (sin build, sin backend, sin framework), pero ahora puede
instalarse en la pantalla de inicio de un teléfono y funcionar por completo
sin conexión, exactamente igual que en escritorio.

> Nada de esto toca la lógica del mockup ni el Domain Discovery. Es
> únicamente la capa de entrega/experiencia para que se pueda abrir e
> interactuar desde un navegador móvil.

## Por qué un servidor local (nunca `file://`)

Dos cosas del mockup requieren que los archivos se sirvan por HTTP(S), no
abriéndolos directamente desde el disco:

1. **Los Service Workers no funcionan sobre `file://`** — es una restricción
   de seguridad de todos los navegadores. Sin esto no hay soporte offline.
2. Los `fetch`/`import` relativos y el `manifest.json` se comportan de forma
   inconsistente (o se bloquean) bajo `file://` en varios navegadores móviles.

La recomendación es siempre un servidor estático simple. No hace falta nada
más (no hay API, no hay base de datos).

## 1. Escritorio

Desde la carpeta `mockup/`:

```bash
python3 -m http.server 8080
# o, si tienes Node:
npx serve -l 8080
```

Abre `http://localhost:8080/index.html` en Chrome, Safari o el navegador que
prefieras. El ícono de instalación de PWA aparecerá en la barra de
direcciones (Chrome/Edge) — instalarlo es opcional, el mockup funciona igual
en una pestaña normal.

## 2. Android (Chrome)

1. Corre el servidor estático en tu computadora (ver arriba) y anota la IP
   local de esa máquina (`ipconfig` en Windows, `ifconfig`/`ip a` en
   Mac/Linux — ej. `192.168.1.50`). El teléfono y la computadora deben estar
   en la **misma red Wi-Fi**.
2. En el teléfono, abre Chrome y visita `http://192.168.1.50:8080/index.html`
   (con tu IP real).
3. Chrome mostrará un banner o la opción **"Agregar a pantalla de inicio"**
   en el menú (⋮). Al aceptar, el ícono de Blanc queda instalado y abre en
   modo standalone (sin la barra de direcciones del navegador).
4. Después de la primera carga, el Service Worker deja todo cacheado: puedes
   activar el modo avión y el mockup sigue funcionando.

## 3. iPhone (Safari)

iOS **solo** permite instalar PWAs desde Safari (no desde Chrome/Firefox en
iOS, que son motores Safari con otra cáscara y no exponen "Agregar a
inicio" para sitios).

1. Corre el servidor estático (ver arriba) y ubica la IP local de tu
   computadora, en la misma red Wi-Fi que el iPhone.
2. En el iPhone, abre **Safari** y visita `http://<tu-ip>:8080/index.html`.
3. Toca el botón de compartir (el cuadrado con la flecha hacia arriba) →
   **"Agregar a pantalla de inicio"**.
4. Confirma el nombre ("Blanc") y toca **Agregar**. El ícono aparece en tu
   pantalla de inicio y abre en modo standalone, con la barra de estado
   estilizada y respetando el notch/Dynamic Island.
5. Igual que en Android: tras la primera carga completa, el mockup sigue
   funcionando sin conexión (Safari en iOS soporta Service Workers desde
   iOS 11.3+).

## Qué esperar una vez instalado

- **Funciona 100% offline** después de la primera visita — el Service
  Worker (`service-worker.js`) precachea todas las pantallas, estilos,
  scripts e íconos.
- **El tema (claro/oscuro), la sucursal activa y el rol de sesión
  persisten** en `localStorage`, igual que en escritorio — instalarlo como
  PWA no cambia ese comportamiento.
- Todas las interacciones (navegación, chat, wizard de nueva cita, cambio de
  sucursal, tema) funcionan igual que en desktop; en pantallas angostas los
  layouts se reorganizan (sidebar como panel deslizante, tablas y
  calendario con scroll horizontal contenido, tarjetas apiladas) pero sin
  perder ninguna información.
- Es un prototipo visual: seguir sin backend real ni autenticación real
  sigue siendo intencional (ver `README.md` de esta misma carpeta).

## Si algo no aparece actualizado

El Service Worker cachea agresivamente para garantizar el offline. Si haces
cambios a los archivos y quieres verlos reflejados de inmediato durante
desarrollo, hace un hard-refresh (Cmd/Ctrl+Shift+R) o borra el Service
Worker desde las DevTools (Application → Service Workers → Unregister).
