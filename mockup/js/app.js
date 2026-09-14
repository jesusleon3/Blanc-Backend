/* ==========================================================================
   Blanc — Bootstrap de la aplicación (interactividad compartida)
   Mockup visual: no hay backend, todo el estado vive en memoria/localStorage.
   ========================================================================== */

const App = (() => {
  const SUCURSAL_KEY = "blanc-sucursal";
  const USER_KEY = "blanc-user-id";

  function initTheme() {
    const saved = localStorage.getItem("blanc-theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    updateThemeIcon();
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("blanc-theme", next);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const btn = document.getElementById("theme-toggle-btn");
    if (!btn) return;
    const current = document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    btn.innerHTML = current === "dark" ? ICONS.sun : ICONS.moon;
  }

  function initSidebarState() {
    if (localStorage.getItem("blanc-sidebar-collapsed") === "1") {
      document.body.classList.add("sidebar-collapsed");
    }
  }

  function toggleSidebar() {
    document.body.classList.toggle("sidebar-collapsed");
    localStorage.setItem("blanc-sidebar-collapsed", document.body.classList.contains("sidebar-collapsed") ? "1" : "0");
  }

  function ensureSidebarBackdrop() {
    let el = document.querySelector(".sidebar-backdrop");
    if (!el) {
      el = document.createElement("div");
      el.className = "sidebar-backdrop";
      el.addEventListener("click", toggleMobileNav);
      document.body.appendChild(el);
    }
    return el;
  }

  function toggleMobileNav() {
    ensureSidebarBackdrop();
    document.querySelector(".sidebar")?.classList.toggle("mobile-open");
  }

  function toggleDropdown(id, evt) {
    if (evt) evt.stopPropagation();
    const el = document.getElementById(id);
    const wasOpen = el.classList.contains("open");
    Utils.qsa(".dropdown.open").forEach((d) => d.classList.remove("open"));
    if (!wasOpen) el.classList.add("open");
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) Utils.qsa(".dropdown.open").forEach((d) => d.classList.remove("open"));
  });

  // Elegir una acción de un menú (ej. "Editar rol", "Notificar cupo
  // disponible") debe cerrar ese menú, igual que en cualquier producto real
  // — antes se quedaba abierto hasta el siguiente clic en otro lado.
  document.addEventListener("click", (e) => {
    const item = e.target.closest(".dropdown-item");
    if (item) item.closest(".dropdown")?.classList.remove("open");
  });

  function openModal(id) {
    document.getElementById(id)?.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeModal(id) {
    document.getElementById(id)?.classList.remove("open");
    document.body.style.overflow = "";
  }
  document.addEventListener("click", (e) => {
    if (e.target.classList && e.target.classList.contains("modal-overlay")) {
      e.target.classList.remove("open");
      document.body.style.overflow = "";
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") Utils.qsa(".modal-overlay.open").forEach((m) => { m.classList.remove("open"); document.body.style.overflow = ""; });
  });

  function ensureToastStack() {
    let stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    return stack;
  }

  function toast(type, title, desc, duration = 4200) {
    const stack = ensureToastStack();
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    const iconMap = { success: "checkCircle", error: "alert", info: "bell" };
    el.innerHTML = `
      <span class="toast-icon">${ICONS[iconMap[type] || "bell"]}</span>
      <div>
        <div class="toast-title">${title}</div>
        ${desc ? `<div class="toast-desc">${desc}</div>` : ""}
      </div>
      <span class="toast-close">${ICONS.x}</span>`;
    el.querySelector(".toast-close").onclick = () => el.remove();
    stack.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  function switchTab(groupEl, tabKey) {
    Utils.qsa(".tab", groupEl).forEach((t) => t.classList.toggle("active", t.dataset.tab === tabKey));
    const panelGroup = groupEl.dataset.panels ? document.getElementById(groupEl.dataset.panels) : groupEl.parentElement;
    Utils.qsa(".tab-panel", panelGroup).forEach((p) => p.classList.toggle("active", p.dataset.panel === tabKey));
  }

  // Segmented controls de rango de tiempo (Hoy/Semana/Mes, 30 días/90 días/Año):
  // el mockup no tiene series históricas reales para recalcular cada rango,
  // así que al menos reflejan la selección visualmente y avisan que es una
  // vista simulada, en vez de no responder al clic.
  function selectSegment(btn) {
    Utils.qsa("button", btn.parentElement).forEach((b) => b.classList.toggle("active", b === btn));
    toast("info", `Vista: ${btn.textContent.trim()}`, "Acción simulada — sin efecto real sobre datos persistentes.", 2600);
  }

  function simulateLoading(containerId, renderFn, delay = 650) {
    const el = document.getElementById(containerId);
    if (!el) return;
    setTimeout(() => { el.innerHTML = renderFn(); }, delay);
  }

  /* ---------- Estado global: sucursal activa ----------
     Fuente única de verdad para "qué sucursal estoy viendo", persistida en
     localStorage y propagada a todas las pantallas vía evento custom, para
     que el filtro se comporte igual sin importar desde dónde se cambie
     (sidebar, tabs de Agenda, tabla de desempeño del Dashboard, etc). */
  function getSucursal() {
    return localStorage.getItem(SUCURSAL_KEY) || "todas";
  }

  function isTodasSucursales() {
    return getSucursal() === "todas";
  }

  function scopeLabel() {
    const cur = getSucursal();
    if (cur === "todas") return "todas las sucursales";
    return DB.sucursal(cur)?.nombre || "todas las sucursales";
  }

  function filterBySucursal(list, resolver) {
    const cur = getSucursal();
    if (cur === "todas") return list;
    return list.filter((item) => resolver(item) === cur);
  }

  function renderSucursalSwitchUI() {
    const cur = getSucursal();
    const label = cur === "todas" ? "Todas las sucursales" : (DB.sucursal(cur)?.nombre || "Todas las sucursales");
    const target = document.getElementById("sucursal-actual");
    if (target) target.textContent = label;
    Utils.qsa("#sucursal-switch .dropdown-item").forEach((item) => {
      item.classList.toggle("is-selected", item.dataset.sucursal === cur);
    });
  }

  function setSucursal(id, opts = {}) {
    const changed = getSucursal() !== id;
    localStorage.setItem(SUCURSAL_KEY, id);
    renderSucursalSwitchUI();
    document.getElementById("sucursal-switch")?.classList.remove("open");
    if (changed && !opts.silent) {
      const label = id === "todas" ? "Todas las sucursales" : DB.sucursal(id)?.nombre;
      toast("info", "Vista actualizada", `Mostrando datos de ${label}.`, 2600);
    }
    document.dispatchEvent(new CustomEvent("blanc:sucursal-change", { detail: { sucursalId: id } }));
  }

  function initSucursalSwitch() {
    renderSucursalSwitchUI();
    Utils.qsa("#sucursal-switch .dropdown-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        setSucursal(item.dataset.sucursal);
      });
    });
  }

  /* ---------- Estado global: usuario / rol simulado ----------
     El login (index.html) guarda qué rol se eligió; aquí se resuelve a un
     usuario concreto de DB.usuarios para que el resto de la app (sidebar,
     panel del empleado, identidad del agente en el chat) sea consistente
     con el rol elegido, en vez de mostrar siempre "Karla Espinoza". */
  function getCurrentUser() {
    const id = localStorage.getItem(USER_KEY);
    return DB.usuarios.find((u) => u.id === id) || DB.usuarios[0];
  }

  function init(pageKey, titleKey) {
    initTheme();
    initSidebarState();
    if (document.getElementById("sidebar-mount")) {
      Components.mount(pageKey, titleKey);
      updateThemeIcon();
      initSucursalSwitch();
    }
  }

  return {
    init, toggleTheme, toggleSidebar, toggleMobileNav, toggleDropdown,
    openModal, closeModal, toast, switchTab, simulateLoading, selectSegment,
    getSucursal, setSucursal, isTodasSucursales, scopeLabel, filterBySucursal,
    getCurrentUser,
  };
})();
