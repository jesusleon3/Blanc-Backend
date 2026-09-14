/* ==========================================================================
   Blanc — Service Worker (mockup visual, 100% estático, sin backend)
   Estrategia: cache-first con precache completo, para que el prototipo
   funcione sin conexión después de la primera visita. Cualquier request
   nuevo que sí llegue a red también se cachea de forma oportunista.
   ========================================================================== */

const CACHE_VERSION = "blanc-mockup-v1";
const SCOPE_URL = new URL(self.registration.scope);

const PRECACHE_URLS = [
  "./",
  "index.html",
  "manifest.json",
  "assets/logo.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-192.png",
  "assets/icons/icon-maskable-512.png",
  "assets/icons/apple-touch-icon.png",
  "css/tokens.css",
  "css/base.css",
  "css/components.css",
  "css/screens.css",
  "js/utils.js",
  "js/icons.js",
  "js/data.js",
  "js/components.js",
  "js/app.js",
  "screens/dashboard.html",
  "screens/agenda.html",
  "screens/cita-nueva.html",
  "screens/cita-detalle.html",
  "screens/conversaciones.html",
  "screens/chat.html",
  "screens/escalamientos.html",
  "screens/panel-empleado.html",
  "screens/crm.html",
  "screens/clienta-perfil.html",
  "screens/lista-roja.html",
  "screens/lista-espera.html",
  "screens/anticipos.html",
  "screens/notificaciones.html",
  "screens/historial.html",
  "screens/analytics.html",
  "screens/configuracion.html",
].map((p) => new URL(p, SCOPE_URL).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // sin llamadas externas: no hay backend

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached); // sin red: usa lo cacheado si existe

      return cached || network;
    })
  );
});
