/* ==========================================================================
   Blanc — Utilidades (mockup visual, sin lógica de negocio real)
   ========================================================================== */

const Utils = (() => {
  const AVATAR_HUES = [340, 265, 210, 175, 25, 45, 300];

  function initials(nombre) {
    return nombre
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
  }

  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
    return Math.abs(h);
  }

  function avatarStyle(nombre) {
    const hue = AVATAR_HUES[hashStr(nombre) % AVATAR_HUES.length];
    return `background: linear-gradient(135deg, hsl(${hue} 70% 62%), hsl(${hue} 55% 40%));`;
  }

  function avatarHTML(nombre, size = "md") {
    return `<span class="avatar avatar-${size}" style="${avatarStyle(nombre)}">${initials(nombre)}</span>`;
  }

  function money(n) {
    return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  }

  function moneyCompact(n) {
    if (!n) return "$0";
    if (n >= 1000) return `$${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return money(n);
  }

  function dateLabel(d) {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  }

  function dateTimeLabel(d) {
    const date = d instanceof Date ? d : new Date(d);
    return `${date.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} · ${date.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })}`;
  }

  function timeLabel(d) {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
  }

  function relativeTime(d) {
    const date = d instanceof Date ? d : new Date(d);
    const diffMs = Date.now() - date.getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "justo ahora";
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `hace ${hrs} h`;
    const days = Math.round(hrs / 24);
    return `hace ${days} d`;
  }

  function qs(sel, ctx = document) { return ctx.querySelector(sel); }
  function qsa(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

  function param(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  const DIAS_LABEL = { lunes: "Lunes", martes: "Martes", miercoles: "Miércoles", jueves: "Jueves", viernes: "Viernes", sabado: "Sábado", domingo: "Domingo" };
  function diaLabel(key) { return DIAS_LABEL[key] || key; }

  return { initials, avatarStyle, avatarHTML, money, moneyCompact, dateLabel, dateTimeLabel, timeLabel, relativeTime, qs, qsa, param, hashStr, diaLabel };
})();
