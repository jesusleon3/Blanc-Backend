/* ==========================================================================
   Blanc — Componentes reutilizables (render functions)
   ========================================================================== */

const NAV = [
  { group: "Principal", items: [
    { key: "dashboard", label: "Dashboard", href: "dashboard.html", icon: "home" },
    { key: "panel-empleado", label: "Panel del empleado", href: "panel-empleado.html", icon: "user" },
    { key: "agenda", label: "Agenda", href: "agenda.html", icon: "calendar" },
  ]},
  { group: "Interacción", items: [
    { key: "conversaciones", label: "Conversaciones", href: "conversaciones.html", icon: "chat", badge: () => DB.conversaciones.filter(c => c.estado === "activa").length },
    { key: "escalamientos", label: "Escalamientos", href: "escalamientos.html", icon: "alert", badge: () => DB.tickets.filter(t => t.estado !== "resuelto").length },
  ]},
  { group: "Clientas", items: [
    { key: "crm", label: "CRM de clientas", href: "crm.html", icon: "users" },
    { key: "lista-roja", label: "Lista roja", href: "lista-roja.html", icon: "shield" },
    { key: "lista-espera", label: "Lista de espera", href: "lista-espera.html", icon: "clock" },
  ]},
  { group: "Operación", items: [
    { key: "anticipos", label: "Anticipos", href: "anticipos.html", icon: "wallet" },
    { key: "notificaciones", label: "Notificaciones", href: "notificaciones.html", icon: "bell" },
    { key: "historial", label: "Historial", href: "historial.html", icon: "history" },
  ]},
  { group: "Negocio", items: [
    { key: "analytics", label: "Analytics", href: "analytics.html", icon: "chart" },
    { key: "configuracion", label: "Configuración", href: "configuracion.html", icon: "settings" },
  ]},
];

const PAGE_TITLES = {
  dashboard: "Dashboard", "panel-empleado": "Panel del empleado", agenda: "Agenda",
  conversaciones: "Conversaciones", chat: "Conversación", escalamientos: "Escalamientos",
  crm: "CRM de clientas", "clienta-perfil": "Perfil de clienta", "lista-roja": "Lista roja",
  "lista-espera": "Lista de espera", anticipos: "Anticipos", notificaciones: "Notificaciones",
  historial: "Historial", analytics: "Analytics", configuracion: "Configuración",
  "cita-nueva": "Nueva cita", "cita-detalle": "Detalle de cita",
};

const Components = {

  sidebar(activeKey) {
    const groups = NAV.map(g => `
      <div class="nav-group">
        <div class="nav-group-label">${g.group}</div>
        ${g.items.map(it => {
          const badge = it.badge ? it.badge() : 0;
          return `<a class="nav-item ${it.key === activeKey ? "active" : ""}" href="${it.href}">
            ${ICONS[it.icon]}<span>${it.label}</span>
            ${badge ? `<span class="nav-badge">${badge}</span>` : ""}
          </a>`;
        }).join("")}
      </div>`).join("");

    return `
    <aside class="sidebar">
      <a href="dashboard.html" class="sidebar-brand">
        <span class="brand-mark">B</span>
        <span class="brand-name">Blanc</span>
      </a>
      <div class="sidebar-sucursal dropdown" id="sucursal-switch" onclick="App.toggleDropdown('sucursal-switch', event)">
        <span class="dot"></span>
        <span class="truncate" id="sucursal-actual">Todas las sucursales</span>
        ${ICONS.chevronDown}
        <div class="dropdown-menu align-left" style="width:100%;min-width:220px;">
          <div class="dropdown-label">Ver sucursal</div>
          <div class="dropdown-item" data-sucursal="todas">${ICONS.building} Todas las sucursales</div>
          ${DB.sucursales.map(s => `<div class="dropdown-item" data-sucursal="${s.id}">${ICONS.building} ${s.nombre}</div>`).join("")}
        </div>
      </div>
      <nav class="sidebar-nav">${groups}</nav>
      <div class="sidebar-footer">
        <div class="dropdown" id="user-menu" style="width:100%;">
          <div class="user-chip" onclick="App.toggleDropdown('user-menu', event)">
            ${Utils.avatarHTML(App.getCurrentUser().nombre, "sm")}
            <div style="min-width:0;">
              <div class="text-sm font-semibold truncate">${App.getCurrentUser().nombre}</div>
              <div class="text-xs text-tertiary truncate">${App.getCurrentUser().rol}</div>
            </div>
            <span style="margin-left:auto;color:var(--text-tertiary);">${ICONS.moreH}</span>
          </div>
          <div class="dropdown-menu align-left" style="bottom:calc(100% + 6px);top:auto;width:100%;min-width:220px;">
            <div class="dropdown-item" onclick="App.toggleTheme()">${ICONS.moon} Cambiar tema</div>
            <div class="dropdown-item" onclick="location.href='../index.html'">${ICONS.logout} Cerrar sesión</div>
          </div>
        </div>
        <button class="sidebar-collapse-btn mt-2" onclick="App.toggleSidebar()" title="Colapsar menú">${ICONS.menu}</button>
      </div>
    </aside>`;
  },

  topbar(key, extraActions = "", titleKey = null) {
    const title = PAGE_TITLES[titleKey || key] || "Blanc";
    return `
    <header class="topbar">
      <div class="flex items-center gap-3">
        <button class="icon-btn mobile-nav-toggle" onclick="App.toggleMobileNav()">${ICONS.menu}</button>
        <div class="topbar-title">
          <div class="topbar-breadcrumb"><span>Blanc</span>${ICONS.chevronRight}<span>${title}</span></div>
          <h1>${title}</h1>
        </div>
      </div>
      <div class="topbar-actions">
        ${extraActions}
        <button class="icon-btn" onclick="App.toggleTheme()" title="Cambiar tema" id="theme-toggle-btn">${ICONS.moon}</button>
        <div class="dropdown" id="notif-dropdown">
          <button class="icon-btn" onclick="App.toggleDropdown('notif-dropdown', event)" title="Notificaciones">${ICONS.bell}</button>
          <div class="dropdown-menu">
            <div class="dropdown-label">Actividad reciente</div>
            ${DB.auditoria.slice(0, 4).map(a => `<div class="dropdown-item" style="align-items:flex-start;white-space:normal;"><span style="margin-top:2px;">${ICONS.sparkle}</span><span style="font-size:12.5px;line-height:1.4;">${a.detalle}</span></div>`).join("")}
            <div class="dropdown-divider"></div>
            <a href="historial.html" class="dropdown-item">${ICONS.history} Ver historial completo</a>
          </div>
        </div>
      </div>
    </header>`;
  },

  mount(key, titleKey = null) {
    document.getElementById("sidebar-mount").innerHTML = Components.sidebar(key);
    document.getElementById("topbar-mount").innerHTML = Components.topbar(key, document.getElementById("topbar-mount").dataset.actions || "", titleKey);
    // Nota: el <title> del documento ya se define en el <head> de cada pantalla; no se sobrescribe aquí.
  },

  badgeCitaEstado(estado) {
    const map = {
      pendiente: ["neutral", "Pendiente"],
      confirmada: ["success", "Confirmada"],
      en_espera_pago: ["warning", "Espera de pago"],
      cancelada: ["danger", "Cancelada"],
      completada: ["info", "Completada"],
      no_show: ["danger", "No-show"],
    };
    const [v, l] = map[estado] || ["neutral", estado];
    return `<span class="badge badge-${v}"><span class="dot"></span>${l}</span>`;
  },

  badgeClientaEstado(estado) {
    const map = {
      normal: ["neutral", "Normal"],
      vip: ["accent", "VIP"],
      lista_roja: ["danger", "Lista roja"],
      bloqueada: ["danger", "Bloqueada"],
    };
    const [v, l] = map[estado] || ["neutral", estado];
    return `<span class="badge badge-${v}">${estado === "vip" ? ICONS.star : ""}${l}</span>`;
  },

  badgeAnticipoEstado(estado) {
    const map = { pendiente: ["warning", "Pendiente"], pagado: ["success", "Pagado"], expirado: ["danger", "Expirado"], reembolsado: ["info", "Reembolsado"] };
    const [v, l] = map[estado] || ["neutral", estado];
    return `<span class="badge badge-${v}"><span class="dot"></span>${l}</span>`;
  },

  badgeTicketEstado(estado) {
    const map = { abierto: ["danger", "Abierto"], en_atencion: ["warning", "En atención"], resuelto: ["success", "Resuelto"] };
    const [v, l] = map[estado] || ["neutral", estado];
    return `<span class="badge badge-${v}"><span class="dot"></span>${l}</span>`;
  },

  badgeNotifEstado(estado) {
    const map = { enviada: ["success", "Enviada"], programada: ["info", "Programada"], fallida: ["danger", "Fallida"] };
    const [v, l] = map[estado] || ["neutral", estado];
    return `<span class="badge badge-${v}">${l}</span>`;
  },

  badgeEsperaEstado(estado) {
    const map = { en_espera: ["neutral", "En espera"], notificada: ["info", "Notificada"], expirada: ["danger", "Expirada"], convertida: ["success", "Convertida en cita"] };
    const [v, l] = map[estado] || ["neutral", estado];
    return `<span class="badge badge-${v}">${l}</span>`;
  },

  badgeGarantiaEstado(estado) {
    const map = { valida: ["success", "Válida"], vencida: ["danger", "Expirada"], no_encontrada: ["neutral", "No encontrada"], en_revision: ["warning", "Enviada a revisión"] };
    const [v, l] = map[estado] || ["neutral", estado];
    return `<span class="badge badge-${v}">${l}</span>`;
  },

  etiquetaChip(texto, onRemove) {
    return `<span class="badge badge-outline" style="gap:6px;">${texto}${onRemove ? `<span style="cursor:pointer;opacity:.6;" onclick="${onRemove}">${ICONS.x}</span>` : ""}</span>`;
  },

  motivoEscalamiento(m) {
    const map = { imagen: ["Imagen enviada", "image"], audio_complicado: ["Audio recibido", "mic"], queja: ["Queja", "alert"], palabra_prohibida: ["Palabra prohibida", "shield"] };
    const [l, icon] = map[m] || [m, "alert"];
    return `<span class="badge badge-outline">${ICONS[icon]}${l}</span>`;
  },

  emptyState({ icon = "inbox", title, desc, actionLabel, actionOnclick }) {
    return `
    <div class="empty-state animate-in">
      <div class="empty-icon">${ICONS[icon]}</div>
      <h3>${title}</h3>
      <p>${desc}</p>
      ${actionLabel ? `<button class="btn btn-primary" onclick="${actionOnclick || ""}">${ICONS.plus}${actionLabel}</button>` : ""}
    </div>`;
  },

  loadingRows(n = 4) {
    return Array.from({ length: n }).map(() => `
      <div class="card-body flex items-center gap-3" style="border-bottom:1px solid var(--border);">
        <div class="skel skel-avatar"></div>
        <div style="flex:1;">
          <div class="skel skel-text" style="width:35%;"></div>
          <div class="skel skel-text" style="width:60%;margin-bottom:0;"></div>
        </div>
      </div>`).join("");
  },

  timelineItem({ icon = "check", variant = "", title, meta, desc }) {
    return `
    <div class="timeline-item">
      <span class="timeline-dot ${variant}">${ICONS[icon]}</span>
      <div class="timeline-title">${title}</div>
      ${meta ? `<div class="timeline-meta">${meta}</div>` : ""}
      ${desc ? `<div class="timeline-desc">${desc}</div>` : ""}
    </div>`;
  },

  statTile({ label, value, delta, deltaUp, sub }) {
    return `
    <div class="card stat-tile">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      ${delta ? `<div class="stat-delta ${deltaUp ? "up" : "down"}">${deltaUp ? ICONS.arrowUp : ICONS.arrowDown}${delta}</div>` : ""}
      ${sub ? `<div class="stat-sub">${sub}</div>` : ""}
    </div>`;
  },

  clientaCell(clientaId) {
    const c = DB.cliente(clientaId);
    if (!c) return "";
    return `<div class="cell-flex">${Utils.avatarHTML(c.nombre, "sm")}
      <div>
        <div class="cell-primary">${c.nombre}</div>
        <div class="text-xs text-tertiary">${c.telefono}</div>
      </div>
    </div>`;
  },

  modal(id, { title, body, footer, size = "" }) {
    return `
    <div class="modal-overlay" id="${id}">
      <div class="modal ${size}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="icon-btn" onclick="App.closeModal('${id}')">${ICONS.x}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ""}
      </div>
    </div>`;
  },
};
