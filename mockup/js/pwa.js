/* ==========================================================================
   Blanc — Registro del Service Worker (PWA offline, sin backend)
   Este script se incluye igual desde index.html (raíz) y desde screens/*.html
   (un nivel abajo); se apoya en document.currentScript para resolver la raíz
   real de /mockup sin importar la profundidad de la página que lo cargó.
   ========================================================================== */
(function () {
  if (!("serviceWorker" in navigator)) return;
  var scriptEl = document.currentScript;
  var root = new URL("../", scriptEl.src); // js/ siempre está un nivel bajo la raíz del mockup
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register(new URL("service-worker.js", root).toString(), { scope: root.pathname })
      .catch(function (err) { console.warn("Blanc: no se pudo registrar el service worker", err); });
  });
})();

/* ==========================================================================
   Retroalimentación táctil (touchstart/touchend)
   No cambia ningún onclick existente: solo agrega una clase visual .pressed
   mientras el dedo está sobre un elemento interactivo, con delegación de
   eventos (un solo listener, funciona con contenido montado dinámicamente).
   Como efecto colateral también "activa" :active en iOS Safari, que
   históricamente no dispara :active sin al menos un listener de touch.
   ========================================================================== */
(function () {
  var SELECTOR = [
    "a", "button", ".btn", ".icon-btn", ".nav-item", ".filter-chip", ".tab",
    ".dropdown-item", ".kanban-card", ".data-table tbody tr", ".step",
    ".uña-chip", ".role-pill", ".service-pill", ".segmented button",
    ".sidebar-sucursal", ".user-chip", ".sidebar-collapse-btn", ".appt-block",
  ].join(",");

  var pressedEl = null;
  var clearTimer = null;

  function press(target) {
    var el = target.closest ? target.closest(SELECTOR) : null;
    if (!el) return;
    pressedEl = el;
    el.classList.add("pressed");
    clearTimeout(clearTimer);
    // Salvaguarda: si por lo que sea nunca llega touchend/touchcancel
    // (ej. el dedo se arrastra fuera durante un scroll), se limpia solo.
    clearTimer = setTimeout(release, 500);
  }

  function release() {
    if (pressedEl) pressedEl.classList.remove("pressed");
    pressedEl = null;
    clearTimeout(clearTimer);
  }

  document.addEventListener("touchstart", function (e) { press(e.target); }, { passive: true });
  document.addEventListener("touchend", release, { passive: true });
  document.addEventListener("touchcancel", release, { passive: true });
})();
