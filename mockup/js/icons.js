/* ==========================================================================
   Blanc — Set de iconos (SVG en línea, sin dependencias externas)
   Estilo trazo simple, 24x24, stroke=currentColor
   ========================================================================== */

const ICONS = {
  base: (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`,
};

ICONS.home = ICONS.base(`<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4h4v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"/>`);
ICONS.calendar = ICONS.base(`<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>`);
ICONS.chat = ICONS.base(`<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"/>`);
ICONS.users = ICONS.base(`<circle cx="9" cy="8" r="3.2"/><path d="M2.7 19.5c.8-3.4 3.2-5.2 6.3-5.2s5.5 1.8 6.3 5.2"/><circle cx="17.2" cy="8.5" r="2.6"/><path d="M15.7 14.5c2.4.4 4.1 2 4.7 5"/>`);
ICONS.alert = ICONS.base(`<path d="M10.6 4.4 2.9 18a1.6 1.6 0 0 0 1.4 2.4h15.4a1.6 1.6 0 0 0 1.4-2.4L13.4 4.4a1.6 1.6 0 0 0-2.8 0Z"/><path d="M12 10v4.2M12 17.3h.01"/>`);
ICONS.dollar = ICONS.base(`<path d="M12 2.5v19M17 6.8c0-1.8-2.2-2.8-5-2.8s-5 1.2-5 3.1c0 4 10 2 10 6.2 0 1.9-2.2 3.1-5 3.1s-5-1-5-2.8"/>`);
ICONS.clock = ICONS.base(`<circle cx="12" cy="12" r="8.8"/><path d="M12 7.2V12l3.2 2"/>`);
ICONS.settings = ICONS.base(`<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .35 1.9l.06.06a2 2 0 1 1-2.9 2.9l-.06-.06a1.7 1.7 0 0 0-1.9-.35 1.7 1.7 0 0 0-1 1.6V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.35l-.06.06a2 2 0 1 1-2.9-2.9l.06-.06a1.7 1.7 0 0 0 .35-1.9 1.7 1.7 0 0 0-1.6-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.35-1.9l-.06-.06a2 2 0 1 1 2.9-2.9l.06.06a1.7 1.7 0 0 0 1.9.35H10a1.7 1.7 0 0 0 1-1.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.35l.06-.06a2 2 0 1 1 2.9 2.9l-.06.06a1.7 1.7 0 0 0-.35 1.9V10c.3.5.9 1 1.6 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z"/>`);
ICONS.bell = ICONS.base(`<path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.4 5.4 2 6.5H4c.6-1.1 2-2.5 2-6.5Z"/><path d="M10 19.5a2 2 0 0 0 4 0"/>`);
ICONS.history = ICONS.base(`<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v4.5H8M12 7.5V12l3 2"/>`);
ICONS.chart = ICONS.base(`<path d="M4 20V10M11 20V4M18 20v-7"/><path d="M3 20h18"/>`);
ICONS.list = ICONS.base(`<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>`);
ICONS.user = ICONS.base(`<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1-4 3.6-6 7.5-6s6.5 2 7.5 6"/>`);
ICONS.search = ICONS.base(`<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.3-4.3"/>`);
ICONS.plus = ICONS.base(`<path d="M12 5v14M5 12h14"/>`);
ICONS.chevronDown = ICONS.base(`<path d="m6 9 6 6 6-6"/>`);
ICONS.chevronRight = ICONS.base(`<path d="m9 6 6 6-6 6"/>`);
ICONS.chevronLeft = ICONS.base(`<path d="m15 6-6 6 6 6"/>`);
ICONS.x = ICONS.base(`<path d="M18 6 6 18M6 6l12 12"/>`);
ICONS.check = ICONS.base(`<path d="m5 13 4 4 10-10"/>`);
ICONS.checkCircle = ICONS.base(`<circle cx="12" cy="12" r="9"/><path d="m8.5 12.3 2.4 2.4 4.6-5.4"/>`);
ICONS.moreH = ICONS.base(`<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>`);
ICONS.filter = ICONS.base(`<path d="M4 5h16M7 12h10M10.5 19h3"/>`);
ICONS.download = ICONS.base(`<path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M4 19.5h16"/>`);
ICONS.edit = ICONS.base(`<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m13.5 8 3 3"/>`);
ICONS.trash = ICONS.base(`<path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0-.7 12.1a1.5 1.5 0 0 1-1.5 1.4H8.2a1.5 1.5 0 0 1-1.5-1.4L6 7"/>`);
ICONS.external = ICONS.base(`<path d="M9.5 14.5 20 4M13 4h7v7"/><path d="M19 13.5V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V7.5A1.5 1.5 0 0 1 6 6h5.5"/>`);
ICONS.moon = ICONS.base(`<path d="M20 14.2A8.5 8.5 0 1 1 10.3 4a7 7 0 0 0 9.7 10.2Z"/>`);
ICONS.sun = ICONS.base(`<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>`);
ICONS.menu = ICONS.base(`<path d="M4 7h16M4 12h16M4 17h16"/>`);
ICONS.logout = ICONS.base(`<path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3"/><path d="M15.5 16.5 20 12l-4.5-4.5M9.5 12H20"/>`);
ICONS.image = ICONS.base(`<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m5 18 5-5 3 3 3.5-4L20 16"/>`);
ICONS.mic = ICONS.base(`<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>`);
ICONS.messageCircle = ICONS.base(`<path d="M20.5 12a8.5 8.5 0 1 1-3.7-7"/><path d="M20.5 4 12 12.5"/>`);
ICONS.arrowUp = ICONS.base(`<path d="M12 19V5M6 11l6-6 6 6"/>`);
ICONS.arrowDown = ICONS.base(`<path d="M12 5v14M6 13l6 6 6-6"/>`);
ICONS.star = ICONS.base(`<path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.1 1.4-6.3-4.8-4.3 6.4-.6Z"/>`);
ICONS.shield = ICONS.base(`<path d="M12 3.5 19 6v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-2.5Z"/>`);
ICONS.creditCard = ICONS.base(`<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M6.5 15h4"/>`);
ICONS.inbox = ICONS.base(`<path d="M4 12.5h4.2l1.3 2.5h4.9l1.3-2.5H20"/><path d="M5.8 6h12.4L20 12.5v6A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-6L5.8 6Z"/>`);
ICONS.building = ICONS.base(`<rect x="4" y="3.5" width="10" height="17" rx="1"/><path d="M8 8h2M8 12h2M8 16h2M14 10h6v10h-6"/>`);
ICONS.zap = ICONS.base(`<path d="M12.5 3 5 13.5h5.5L11 21l7.5-10.5H13L12.5 3Z"/>`);
ICONS.sparkle = ICONS.base(`<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>`);
ICONS.link = ICONS.base(`<path d="M9.5 14.5 14.5 9.5"/><path d="M11 6.5 13 4.6a3.5 3.5 0 1 1 5 5L16 11.5M13 17.5l-1.9 1.9a3.5 3.5 0 1 1-5-5L8 12.5"/>`);
ICONS.scissors = ICONS.base(`<circle cx="6.5" cy="6.5" r="2.3"/><circle cx="6.5" cy="17.5" r="2.3"/><path d="M8.3 8.1 20 19.5M20 4.5 8.2 15.9"/>`);
ICONS.slidersH = ICONS.base(`<path d="M4 7h9M17 7h3M4 17h3M9 17h11"/><circle cx="15" cy="7" r="2"/><circle cx="7" cy="17" r="2"/>`);
ICONS.eyeOff = ICONS.base(`<path d="M3.5 3.5l17 17"/><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c5 0 8.5 3.5 10 7-0.6 1.4-1.6 2.9-2.9 4.1M6.9 6.9C4.7 8.3 3 10.3 2 12c1.5 3.5 5 7 10 7 1.3 0 2.5-.2 3.6-.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>`);
ICONS.wallet = ICONS.base(`<path d="M3.5 7.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-9Z"/><path d="M15.5 12.5h3v3h-3a1.5 1.5 0 0 1 0-3Z"/>`);
