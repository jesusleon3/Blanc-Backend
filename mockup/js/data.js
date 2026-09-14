/* ==========================================================================
   Blanc — Dataset simulado
   Todos los datos son ficticios y existen únicamente para fines visuales.
   Las entidades, atributos y enumeraciones se derivan de:
     docs/architecture/01-domain-discovery.md
   No representan datos reales de ningún cliente ni negocio.
   ========================================================================== */

const DB = (() => {
  function d(offsetDays, h, m) {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    dt.setHours(h, m, 0, 0);
    return dt;
  }

  /* ---------------- Sucursales y Personal (5.7) ---------------- */
  const sucursales = [
    { id: "suc-1", nombre: "Blanc Polanco", direccion: "Av. Presidente Masaryk 123, Polanco, CDMX", whatsapp: "+52 55 1234 5601", color: "#cf3f77", colorSoft: "#fce7ee" },
    { id: "suc-2", nombre: "Blanc Condesa", direccion: "Av. Michoacán 45, Condesa, CDMX", whatsapp: "+52 55 1234 5602", color: "#7c5cd6", colorSoft: "#eee9fb" },
    { id: "suc-3", nombre: "Blanc Santa Fe", direccion: "Vasco de Quiroga 3800, Santa Fe, CDMX", whatsapp: "+52 55 1234 5603", color: "#2b6ee0", colorSoft: "#e5eefc" },
  ];

  const horarioSemanal = {
    lunes: [["09:00", "13:00"], ["15:00", "19:00"]],
    martes: [["09:00", "13:00"], ["15:00", "19:00"]],
    miercoles: [["09:00", "13:00"], ["15:00", "19:00"]],
    jueves: [["09:00", "13:00"], ["15:00", "19:00"]],
    viernes: [["09:00", "13:00"], ["15:00", "19:00"]],
    sabado: [["09:00", "15:00"]],
    domingo: [],
  };

  const diasFestivos = [
    { fecha: "2026-09-16", motivo: "Día de la Independencia" },
    { fecha: "2026-12-25", motivo: "Navidad" },
  ];

  const manicuristas = [
    { id: "man-1", nombre: "Fernanda Ruiz", sucursalId: "suc-1", activa: true },
    { id: "man-2", nombre: "Itzel Domínguez", sucursalId: "suc-1", activa: true },
    { id: "man-3", nombre: "Renata Cabrera", sucursalId: "suc-1", activa: true },
    { id: "man-4", nombre: "Camila Torres", sucursalId: "suc-2", activa: true },
    { id: "man-5", nombre: "Ximena Flores", sucursalId: "suc-2", activa: true },
    { id: "man-6", nombre: "Mariana Ibarra", sucursalId: "suc-2", activa: false },
    { id: "man-7", nombre: "Paola Herrera", sucursalId: "suc-3", activa: true },
    { id: "man-8", nombre: "Daniela Cortés", sucursalId: "suc-3", activa: true },
  ];

  /* ---------------- Identidad y Accesos (5.8) ---------------- */
  const usuarios = [
    { id: "u-1", nombre: "Karla Espinoza", rol: "Super Admin", email: "karla@blanc.mx", sucursales: "todas" },
    { id: "u-2", nombre: "Diego Aranda", rol: "Administrador", email: "diego@blanc.mx", sucursales: "todas" },
    { id: "u-3", nombre: "Mariana Cid", rol: "Gerente", email: "mariana@blanc.mx", sucursales: "Blanc Polanco" },
    { id: "u-4", nombre: "Sofía Beltrán", rol: "Recepcionista", email: "sofia@blanc.mx", sucursales: "Blanc Condesa" },
    { id: "u-5", nombre: "Fernanda Ruiz", rol: "Manicurista", email: "fernanda@blanc.mx", sucursales: "Blanc Polanco" },
    { id: "u-6", nombre: "Héctor Villaseñor", rol: "Analista", email: "hector@blanc.mx", sucursales: "todas" },
    { id: "u-7", nombre: "Paulina Rosales", rol: "Solo lectura", email: "paulina@blanc.mx", sucursales: "todas" },
  ];

  /* ---------------- Catálogo y Cotización (5.2) ---------------- */
  const servicios = [
    { id: "srv-1", nombre: "Gelish", categoria: "Manos", tipo: "aplicacion", duracionBase: 45, precioBase: 350, activo: true },
    { id: "srv-2", nombre: "Retiro", categoria: "Manos", tipo: "retiro", duracionBase: 20, precioBase: 150, activo: true },
    { id: "srv-3", nombre: "Diseño", categoria: "Decorado", tipo: "aplicacion", duracionBase: 15, precioBase: 120, activo: true },
    { id: "srv-4", nombre: "Pedicure", categoria: "Pies", tipo: "aplicacion", duracionBase: 50, precioBase: 400, activo: true },
    { id: "srv-5", nombre: "Acrílico", categoria: "Manos", tipo: "aplicacion", duracionBase: 90, precioBase: 650, activo: true },
    { id: "srv-6", nombre: "Reparación", categoria: "Manos", tipo: "aplicacion", duracionBase: 15, precioBase: 100, activo: true },
    { id: "srv-7", nombre: "Nail Art", categoria: "Decorado", tipo: "aplicacion", duracionBase: 30, precioBase: 280, activo: true },
    /* Catálogo adicional (Sesión 02 de Domain Discovery, 02-domain-discovery-session-02.md,
       reglas Q1–Q3): nombres de servicio de aplicación tal como los usó la dueña en las
       tablas de tiempo por combinación. Precio propio ficticio (mismo criterio que el resto
       de este archivo) — la sesión 02 solo aportó duración, no precio, de estas combinaciones. */
    { id: "srv-8", nombre: "Gel", categoria: "Manos", tipo: "aplicacion", duracionBase: 60, precioBase: 350, activo: true },
    { id: "srv-9", nombre: "Rubber", categoria: "Manos", tipo: "aplicacion", duracionBase: 60, precioBase: 380, activo: true },
    { id: "srv-10", nombre: "Manicure", categoria: "Manos", tipo: "aplicacion", duracionBase: 60, precioBase: 250, activo: true },
    { id: "srv-11", nombre: "Extensiones", categoria: "Manos", tipo: "aplicacion", duracionBase: 90, precioBase: 550, activo: true },
    { id: "srv-12", nombre: "Baño de Acrílico", categoria: "Manos", tipo: "aplicacion", duracionBase: 120, precioBase: 500, activo: true },
  ];

  const modificadores = [
    { id: "mod-1", nombre: "Diseño sencillo", minutosAdicionales: 10, precioAdicional: 50 },
    { id: "mod-2", nombre: "Diseño complejo", minutosAdicionales: 30, precioAdicional: 150 },
    { id: "mod-3", nombre: "Piedras", minutosAdicionales: 15, precioAdicional: 80 },
    { id: "mod-4", nombre: "Diseño francés", minutosAdicionales: 10, precioAdicional: 60 },
  ];

  /* ---------------- Motor de duración por combinación ----------------
     Sesión 02 de Domain Discovery (docs/domain-discovery/02-domain-discovery-session-02.md,
     reglas Q1–Q3): la duración de un servicio compuesto NO es la suma de las duraciones
     individuales — es una tabla de combinaciones específicas entre método de retiro y
     servicio nuevo a aplicar (o entre servicios de aplicación combinados entre sí).
     Estas tablas se transcriben tal como las aportó la dueña, sin completar los huecos
     que ella misma dejó sin especificar (ver pregunta abierta #5 de esa sesión). */
  const retiroMetodos = ["Drill", "Acetona"];

  const tablaDuracionRetiro = [
    { retira: "Gel", metodo: "Drill", combinaCon: ["Acrílico"], minutos: 75 },
    { retira: "Gel", metodo: "Drill", combinaCon: ["Rubber"], minutos: 75 },
    { retira: "Gel", metodo: "Drill", combinaCon: ["Gel"], minutos: 75 },
    { retira: "Gel", metodo: "Acetona", combinaCon: ["Acrílico"], minutos: 60 },
    { retira: "Gel", metodo: "Acetona", combinaCon: ["Rubber"], minutos: 60 },
    { retira: "Gel", metodo: "Acetona", combinaCon: ["Gel"], minutos: 60 },
    { retira: "Gel", metodo: null, combinaCon: ["Rubber"], minutos: 60 },
    { retira: "Gel", metodo: null, combinaCon: ["Gel"], minutos: 60 },
    { retira: "Gel", metodo: null, combinaCon: ["Manicure"], minutos: 60 },
    { retira: "Acrílico", metodo: null, combinaCon: ["Rubber"], minutos: 120 },
    { retira: "Acrílico", metodo: null, combinaCon: ["Gel"], minutos: 120 },
    { retira: "Acrílico", metodo: null, combinaCon: ["Manicure"], minutos: 120 },
    { retira: "Rubber", metodo: null, combinaCon: ["Rubber"], minutos: 120 },
    { retira: "Rubber", metodo: null, combinaCon: ["Gel"], minutos: 120 },
    { retira: "Rubber", metodo: null, combinaCon: ["Manicure"], minutos: 120 },
    { retira: "Acrílico", metodo: null, combinaCon: ["Extensiones"], minutos: 180 },
    { retira: "Acrílico", metodo: null, combinaCon: ["Baño de Acrílico"], minutos: 180 },
    { retira: "Rubber", metodo: null, combinaCon: ["Extensiones"], minutos: 180 },
    { retira: "Rubber", metodo: null, combinaCon: ["Baño de Acrílico"], minutos: 180 },
    { retira: "Acrílico", metodo: null, combinaCon: ["Extensiones", "Manicure"], minutos: 180 },
    { retira: "Acrílico", metodo: null, combinaCon: ["Baño de Acrílico", "Manicure"], minutos: 180 },
    { retira: "Rubber", metodo: null, combinaCon: ["Extensiones", "Manicure"], minutos: 180 },
    { retira: "Rubber", metodo: null, combinaCon: ["Baño de Acrílico", "Extensiones"], minutos: 180 },
  ];

  const tablaDuracionAplicacion = [
    { combinacion: ["Gel"], minutos: 60 },
    { combinacion: ["Rubber"], minutos: 60 },
    { combinacion: ["Manicure"], minutos: 60 },
    { combinacion: ["Rubber", "Gel", "Manicure"], minutos: 60 },
    { combinacion: ["Extensiones", "Gel"], minutos: 120 },
    { combinacion: ["Baño de Acrílico"], minutos: 120 },
    { combinacion: ["Baño de Acrílico", "Gel", "Manicure"], minutos: 120 },
  ];

  function mismoConjunto(a, b) {
    if (a.length !== b.length) return false;
    const sa = [...a].sort(), sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
  }
  function buscarDuracionRetiro(retira, metodo, combinaCon) {
    return tablaDuracionRetiro.find(r => r.retira === retira && (r.metodo === metodo || r.metodo === null) && mismoConjunto(r.combinaCon, combinaCon));
  }
  function buscarDuracionAplicacion(listaServicios) {
    return tablaDuracionAplicacion.find(r => mismoConjunto(r.combinacion, listaServicios));
  }

  /* ---------------- Clientas / CRM (5.5) ---------------- */
  const clientas = [
    { id: "cli-1", nombre: "Andrea Sofía Ramírez Castillo", telefono: "+52 55 3311 9021", estado: "vip", sucursalFavorita: "suc-1", manicuristaFavorita: "man-1", cumpleanos: "14 mar", notas: "Prefiere tonos nude. Alérgica a acetona con aroma.", etiquetas: ["VIP", "Alergia"], stats: { ultimaVisita: d(-6, 12, 0), ticketPromedio: 780, serviciosFavoritos: ["Gelish", "Nail Art"], visitas: 21 } },
    { id: "cli-2", nombre: "Lucía Martínez Aguilar", telefono: "+52 55 2245 1187", estado: "lista_roja", sucursalFavorita: "suc-1", manicuristaFavorita: "man-2", cumpleanos: "2 nov", notas: "Ha cancelado 3 veces en el último mes con menos de 2h de aviso.", etiquetas: ["Cliente conflictiva"], stats: { ultimaVisita: d(-14, 17, 0), ticketPromedio: 420, serviciosFavoritos: ["Acrílico"], visitas: 8 } },
    { id: "cli-3", nombre: "Fernanda Gómez Ortiz", telefono: "+52 55 4478 2290", estado: "normal", sucursalFavorita: "suc-2", manicuristaFavorita: "man-4", cumpleanos: "22 jun", notas: "", etiquetas: ["Frecuente"], stats: { ultimaVisita: d(-3, 11, 0), ticketPromedio: 510, serviciosFavoritos: ["Gelish", "Pedicure"], visitas: 14 } },
    { id: "cli-4", nombre: "Regina Torres Medina", telefono: "+52 55 5567 3345", estado: "vip", sucursalFavorita: "suc-3", manicuristaFavorita: "man-7", cumpleanos: "9 ene", notas: "Cliente fundadora. Siempre pide cita de sábado.", etiquetas: ["VIP", "Influencer"], stats: { ultimaVisita: d(-1, 10, 0), ticketPromedio: 920, serviciosFavoritos: ["Acrílico", "Nail Art"], visitas: 34 } },
    { id: "cli-5", nombre: "Valentina Chávez Rojas", telefono: "+52 55 1298 4471", estado: "normal", sucursalFavorita: "suc-2", manicuristaFavorita: "man-5", cumpleanos: "30 ago", notas: "", stats: { ultimaVisita: d(-9, 16, 0), ticketPromedio: 380, serviciosFavoritos: ["Pedicure"], visitas: 6 } },
    { id: "cli-6", nombre: "Ximena Morales Peña", telefono: "+52 55 6623 7789", estado: "bloqueada", sucursalFavorita: "suc-1", manicuristaFavorita: null, cumpleanos: "17 may", notas: "Bloqueada por lenguaje ofensivo hacia el personal (12/05).", stats: { ultimaVisita: d(-60, 12, 0), ticketPromedio: 300, serviciosFavoritos: ["Retiro"], visitas: 3 } },
    { id: "cli-7", nombre: "Isabella Cruz Delgado", telefono: "+52 55 7734 5512", estado: "normal", sucursalFavorita: "suc-3", manicuristaFavorita: "man-8", cumpleanos: "5 dic", notas: "", stats: { ultimaVisita: d(-2, 13, 30), ticketPromedio: 460, serviciosFavoritos: ["Gelish"], visitas: 11 } },
    { id: "cli-8", nombre: "Renata Salazar Nava", telefono: "+52 55 8845 2201", estado: "lista_roja", sucursalFavorita: "suc-2", manicuristaFavorita: "man-4", cumpleanos: "19 feb", notas: "Segunda vez en lista roja. Requiere anticipo obligatorio.", stats: { ultimaVisita: d(-20, 11, 0), ticketPromedio: 350, serviciosFavoritos: ["Diseño"], visitas: 5 } },
    { id: "cli-9", nombre: "Daniela Ponce Herrera", telefono: "+52 55 9012 3345", estado: "normal", sucursalFavorita: "suc-1", manicuristaFavorita: "man-3", cumpleanos: "11 oct", notas: "", stats: { ultimaVisita: d(-5, 15, 0), ticketPromedio: 540, serviciosFavoritos: ["Acrílico", "Diseño"], visitas: 17 } },
    { id: "cli-10", nombre: "Paulina Sánchez Rivas", telefono: "+52 55 3356 7810", estado: "vip", sucursalFavorita: "suc-1", manicuristaFavorita: "man-1", cumpleanos: "27 jul", notas: "Recomienda el salón activamente, referida 4 clientas.", stats: { ultimaVisita: d(-4, 9, 30), ticketPromedio: 860, serviciosFavoritos: ["Gelish", "Pedicure", "Nail Art"], visitas: 28 } },
    { id: "cli-11", nombre: "Sofía Guerrero Campos", telefono: "+52 55 2287 6634", estado: "normal", sucursalFavorita: "suc-3", manicuristaFavorita: null, cumpleanos: "3 abr", notas: "", stats: { ultimaVisita: d(-11, 12, 0), ticketPromedio: 300, serviciosFavoritos: ["Retiro", "Reparación"], visitas: 4 } },
    { id: "cli-12", nombre: "Alejandra Núñez Ibarra", telefono: "+52 55 4409 1156", estado: "normal", sucursalFavorita: "suc-2", manicuristaFavorita: "man-5", cumpleanos: "8 sep", notas: "", stats: { ultimaVisita: d(-7, 17, 30), ticketPromedio: 470, serviciosFavoritos: ["Gelish"], visitas: 9 } },
    { id: "cli-13", nombre: "María José Hernández Luna", telefono: "+52 55 5521 8890", estado: "normal", sucursalFavorita: "suc-1", manicuristaFavorita: "man-2", cumpleanos: "15 dic", notas: "Primera visita hace 2 semanas, muy contenta con el servicio.", stats: { ultimaVisita: d(-13, 10, 0), ticketPromedio: 350, serviciosFavoritos: ["Gelish"], visitas: 1 } },
    { id: "cli-14", nombre: "Camila Reyes Vázquez", telefono: "+52 55 6612 4478", estado: "normal", sucursalFavorita: "suc-3", manicuristaFavorita: "man-7", cumpleanos: "21 jun", notas: "", stats: { ultimaVisita: d(-8, 14, 0), ticketPromedio: 610, serviciosFavoritos: ["Acrílico"], visitas: 12 } },
  ];

  function cliente(id) { return clientas.find((c) => c.id === id); }
  function manicurista(id) { return id ? manicuristas.find((m) => m.id === id) : null; }
  function sucursal(id) { return sucursales.find((s) => s.id === id); }

  /* ---------------- Agenda (5.1) — Citas ---------------- */
  // estado: pendiente | confirmada | en_espera_pago | cancelada | completada | no_show
  // (reprogramada no es un estado persistente — Modelo 2, mutación in-place; ver 01-domain-discovery.md)
  const citas = [
    { id: "cit-1001", sucursalId: "suc-1", clientaId: "cli-1", manicuristaId: "man-1", inicio: d(0, 10, 0), fin: d(0, 10, 45), estado: "confirmada", anticipoRequerido: false, composicion: { servicios: ["Gelish"], modificadores: ["Diseño sencillo"], duracionTotal: 55, precioTotal: 400 } },
    { id: "cit-1002", sucursalId: "suc-1", clientaId: "cli-13", manicuristaId: "man-2", inicio: d(0, 10, 30), fin: d(0, 11, 15), estado: "confirmada", anticipoRequerido: false, composicion: { servicios: ["Gelish"], modificadores: [], duracionTotal: 45, precioTotal: 350 } },
    { id: "cit-1003", sucursalId: "suc-1", clientaId: "cli-2", manicuristaId: null, inicio: d(0, 11, 0), fin: d(0, 12, 30), estado: "en_espera_pago", anticipoRequerido: true, anticipoPagado: false, composicion: { servicios: ["Acrílico"], modificadores: ["Diseño complejo"], duracionTotal: 120, precioTotal: 800 } },
    { id: "cit-1004", sucursalId: "suc-1", clientaId: "cli-9", manicuristaId: "man-3", inicio: d(0, 15, 30), fin: d(0, 16, 50), estado: "confirmada", anticipoRequerido: false, composicion: { servicios: ["Acrílico", "Diseño"], modificadores: ["Piedras"], duracionTotal: 135, precioTotal: 850 } },
    { id: "cit-1005", sucursalId: "suc-1", clientaId: "cli-10", manicuristaId: "man-1", inicio: d(0, 17, 0), fin: d(0, 18, 30), estado: "pendiente", anticipoRequerido: false, composicion: { servicios: ["Gelish", "Pedicure"], modificadores: ["Diseño francés"], duracionTotal: 105, precioTotal: 810 } },
    { id: "cit-1006", sucursalId: "suc-2", clientaId: "cli-3", manicuristaId: "man-4", inicio: d(0, 9, 30), fin: d(0, 10, 20), estado: "completada", anticipoRequerido: false, composicion: { servicios: ["Gelish"], modificadores: [], duracionTotal: 45, precioTotal: 350 } },
    { id: "cit-1007", sucursalId: "suc-2", clientaId: "cli-5", manicuristaId: "man-5", inicio: d(0, 11, 0), fin: d(0, 11, 50), estado: "completada", anticipoRequerido: false, composicion: { servicios: ["Pedicure"], modificadores: [], duracionTotal: 50, precioTotal: 400 } },
    { id: "cit-1008", sucursalId: "suc-2", clientaId: "cli-12", manicuristaId: null, inicio: d(0, 16, 0), fin: d(0, 16, 45), estado: "confirmada", anticipoRequerido: false, composicion: { servicios: ["Gelish"], modificadores: [], duracionTotal: 45, precioTotal: 350 } },
    { id: "cit-1009", sucursalId: "suc-3", clientaId: "cli-4", manicuristaId: "man-7", inicio: d(0, 9, 0), fin: d(0, 10, 40), estado: "confirmada", anticipoRequerido: false, composicion: { servicios: ["Acrílico", "Nail Art"], modificadores: ["Diseño complejo"], duracionTotal: 150, precioTotal: 1080 } },
    { id: "cit-1010", sucursalId: "suc-3", clientaId: "cli-14", manicuristaId: "man-8", inicio: d(0, 12, 0), fin: d(0, 13, 30), estado: "no_show", anticipoRequerido: false, composicion: { servicios: ["Acrílico"], modificadores: [], duracionTotal: 90, precioTotal: 650 } },
    { id: "cit-1011", sucursalId: "suc-3", clientaId: "cli-7", manicuristaId: "man-8", inicio: d(0, 17, 30), fin: d(0, 18, 15), estado: "confirmada", anticipoRequerido: false, composicion: { servicios: ["Gelish"], modificadores: [], duracionTotal: 45, precioTotal: 350 } },
    { id: "cit-1012", sucursalId: "suc-1", clientaId: "cli-1", manicuristaId: "man-1", inicio: d(1, 10, 0), fin: d(1, 10, 45), estado: "pendiente", anticipoRequerido: false, composicion: { servicios: ["Gelish"], modificadores: [], duracionTotal: 45, precioTotal: 350 } },
    { id: "cit-1013", sucursalId: "suc-1", clientaId: "cli-8", manicuristaId: "man-2", inicio: d(1, 12, 0), fin: d(1, 12, 30), estado: "en_espera_pago", anticipoRequerido: true, anticipoPagado: false, composicion: { servicios: ["Diseño"], modificadores: ["Diseño sencillo"], duracionTotal: 25, precioTotal: 170 } },
    { id: "cit-1014", sucursalId: "suc-2", clientaId: "cli-11", manicuristaId: null, inicio: d(2, 11, 0), fin: d(2, 11, 15), estado: "confirmada", anticipoRequerido: false, composicion: { servicios: ["Retiro"], modificadores: [], duracionTotal: 20, precioTotal: 150 } },
    { id: "cit-1015", sucursalId: "suc-1", clientaId: "cli-9", manicuristaId: "man-3", inicio: d(-1, 15, 0), fin: d(-1, 16, 20), estado: "completada", anticipoRequerido: false, composicion: { servicios: ["Acrílico"], modificadores: [], duracionTotal: 90, precioTotal: 650 } },
    { id: "cit-1016", sucursalId: "suc-1", clientaId: "cli-6", manicuristaId: "man-1", inicio: d(-3, 12, 0), fin: d(-3, 12, 45), estado: "cancelada", anticipoRequerido: false, composicion: { servicios: ["Gelish"], modificadores: [], duracionTotal: 45, precioTotal: 350 } },
    { id: "cit-1017", sucursalId: "suc-2", clientaId: "cli-5", manicuristaId: "man-5", inicio: d(-10, 11, 0), fin: d(-10, 11, 45), estado: "completada", anticipoRequerido: false, composicion: { servicios: ["Pedicure"], modificadores: [], duracionTotal: 45, precioTotal: 400 } },
  ];

  /* ---------------- Conversación (5.3) ---------------- */
  const conversaciones = [
    {
      id: "conv-1", clientaId: "cli-2", sucursalId: "suc-1", modo: "humano", estado: "activa",
      motivoEscalamiento: "queja",
      mensajes: [
        { de: "clienta", tipo: "texto", texto: "Hola, quiero agendar para mañana pero la última vez me cobraron mal", ts: d(0, 9, 2) },
        { de: "bot", tipo: "texto", texto: "Hola Lucía 👋 permíteme revisar tu historial un momento.", ts: d(0, 9, 2), ia: { intencion: "agendar_cita", sentimiento: "neutral", tokens: 210, costo: 0.004 } },
        { de: "clienta", tipo: "texto", texto: "Es que ya van 2 veces que cobran mal y ya me tienen hasta el gorro, esto es pésimo servicio", ts: d(0, 9, 4) },
        { de: "bot", tipo: "sistema", texto: "Palabra clave / sentimiento negativo detectado. Conversación escalada a un empleado.", ts: d(0, 9, 4), ia: { intencion: "queja", sentimiento: "negativo", tokens: 180, costo: 0.003 } },
        { de: "humano", tipo: "texto", texto: "Hola Lucía, soy Sofía del equipo de Blanc Condesa. Ya vi tu caso, una disculpa por la confusión con el cobro. Permíteme revisar el detalle.", ts: d(0, 9, 9), autor: "Sofía Beltrán" },
      ],
    },
    {
      id: "conv-2", clientaId: "cli-1", sucursalId: "suc-1", modo: "bot", estado: "activa",
      mensajes: [
        { de: "clienta", tipo: "texto", texto: "Buenas! Quiero gelish en las manos y dos uñas con diseño francés y una con piedras", ts: d(0, 8, 40) },
        { de: "bot", tipo: "texto", texto: "¡Claro! Gelish completo + diseño francés en 2 uñas + piedras en 1 uña. Te queda en 55 min y $400. ¿Tienes preferencia de sucursal y horario?", ts: d(0, 8, 41), ia: { intencion: "cotizar_servicio", sentimiento: "positivo", tokens: 340, costo: 0.006 } },
        { de: "clienta", tipo: "texto", texto: "Polanco, hoy en la tarde si se puede", ts: d(0, 8, 42) },
        { de: "bot", tipo: "texto", texto: "Tengo disponible hoy 10:00 am con Fernanda. ¿Te la aparto?", ts: d(0, 8, 43), ia: { intencion: "buscar_disponibilidad", sentimiento: "neutral", tokens: 190, costo: 0.003 } },
        { de: "clienta", tipo: "texto", texto: "Sí, perfecto", ts: d(0, 8, 44) },
        { de: "bot", tipo: "texto", texto: "Listo, quedaste confirmada hoy 10:00 am en Blanc Polanco con Fernanda 💅 Te enviaré un recordatorio antes de tu cita.", ts: d(0, 8, 44), ia: { intencion: "confirmar_cita", sentimiento: "positivo", tokens: 160, costo: 0.003 } },
      ],
    },
    {
      id: "conv-3", clientaId: "cli-4", sucursalId: "suc-3", modo: "bot", estado: "activa",
      mensajes: [
        { de: "clienta", tipo: "texto", texto: "Hola! Vi en Instagram un diseño con flores, ¿me pueden hacer algo parecido?", ts: d(0, 7, 15) },
        { de: "clienta", tipo: "imagen", texto: "[imagen de referencia enviada]", ts: d(0, 7, 15) },
        { de: "bot", tipo: "sistema", texto: "Imagen recibida — se anexa al perfil de la conversación para revisión del equipo.", ts: d(0, 7, 16), ia: { intencion: "consultar_diseño", sentimiento: "positivo", tokens: 90, costo: 0.001 } },
        { de: "bot", tipo: "texto", texto: "¡Qué bonito diseño! Con nuestro equipo en Santa Fe sí lo podemos lograr. Te recomiendo Acrílico + Nail Art. ¿Agendamos?", ts: d(0, 7, 18), ia: { intencion: "sugerir_servicio", sentimiento: "positivo", tokens: 210, costo: 0.004 } },
      ],
    },
    {
      id: "conv-4", clientaId: "cli-10", sucursalId: "suc-1", modo: "bot", estado: "activa",
      mensajes: [
        { de: "bot", tipo: "texto", texto: "¡Hola Paulina! Notamos que sueles pedir pedicure junto con tu gelish 💅 ¿te gustaría agregarlo a tu próxima cita?", ts: d(0, 8, 0), ia: { intencion: "venta_cruzada", sentimiento: "neutral", tokens: 140, costo: 0.002 } },
        { de: "clienta", tipo: "texto", texto: "Ay sí, buena idea, agrégalo", ts: d(0, 8, 5) },
        { de: "bot", tipo: "texto", texto: "Perfecto, agregado. Tu cita del jueves 17:00 ahora incluye Gelish + Pedicure por $810.", ts: d(0, 8, 6), ia: { intencion: "confirmar_cita", sentimiento: "positivo", tokens: 130, costo: 0.002 } },
      ],
    },
    {
      id: "conv-5", clientaId: "cli-8", sucursalId: "suc-2", modo: "humano", estado: "activa",
      motivoEscalamiento: "palabra_prohibida",
      mensajes: [
        { de: "clienta", tipo: "texto", texto: "Necesito cancelar mi cita de mañana", ts: d(0, 9, 30) },
        { de: "bot", tipo: "texto", texto: "Hola Renata, veo que tu cuenta está marcada para requerir confirmación de un empleado antes de cancelar. Ya notifiqué al equipo.", ts: d(0, 9, 30), ia: { intencion: "cancelar_cita", sentimiento: "neutral", tokens: 170, costo: 0.003 } },
        { de: "bot", tipo: "sistema", texto: "Conversación escalada — clienta en lista roja requiere aprobación manual de cancelación.", ts: d(0, 9, 31) },
      ],
    },
    {
      id: "conv-6", clientaId: "cli-7", sucursalId: "suc-3", modo: "bot", estado: "cerrada",
      mensajes: [
        { de: "clienta", tipo: "texto", texto: "Gracias, me encantó como quedaron", ts: d(-2, 14, 5) },
        { de: "bot", tipo: "texto", texto: "¡Qué gusto Isabella! Te esperamos pronto 💕", ts: d(-2, 14, 6), ia: { intencion: "agradecimiento", sentimiento: "positivo", tokens: 60, costo: 0.001 } },
      ],
    },
    {
      id: "conv-7", clientaId: "cli-6", sucursalId: "suc-1", modo: "humano", estado: "cerrada",
      motivoEscalamiento: "audio_complicado",
      mensajes: [
        { de: "clienta", tipo: "audio", texto: "[nota de voz — 0:38]", ts: d(-3, 11, 40) },
        { de: "bot", tipo: "sistema", texto: "Audio recibido. Por ahora el sistema no procesa audios — conversación escalada.", ts: d(-3, 11, 41) },
        { de: "humano", tipo: "texto", texto: "Hola Ximena, escuché tu nota de voz. Con gusto te ayudo, cuéntame qué necesitas por texto.", ts: d(-3, 11, 50), autor: "Sofía Beltrán" },
      ],
    },
    {
      id: "conv-8", clientaId: "cli-14", sucursalId: "suc-3", modo: "bot", estado: "activa",
      mensajes: [
        { de: "clienta", tipo: "texto", texto: "Buenas tardes, ¿tienen espacio para acrílico el sábado?", ts: d(0, 12, 0) },
        { de: "bot", tipo: "texto", texto: "¡Hola Camila! El sábado tenemos alta demanda, ahorita no hay espacio disponible en la mañana. ¿Te agrego a la lista de espera?", ts: d(0, 12, 1), ia: { intencion: "buscar_disponibilidad", sentimiento: "neutral", tokens: 150, costo: 0.003 } },
        { de: "clienta", tipo: "texto", texto: "Va, échame el paro", ts: d(0, 12, 2) },
      ],
    },
    {
      /* Sesión 02 de Domain Discovery, requisito C1: ante una respuesta ambigua a una
         pregunta compuesta, el bot re-pregunta para clarificar antes de considerar
         escalar a humano — no se escala directamente por esta causa. */
      id: "conv-9", clientaId: "cli-12", sucursalId: "suc-2", modo: "bot", estado: "activa",
      mensajes: [
        { de: "clienta", tipo: "texto", texto: "Hola, quiero cita para gelish y también pregunté si tenían descuento por cumpleaños", ts: d(0, 13, 0) },
        { de: "bot", tipo: "texto", texto: "¡Claro! Sobre tu cita: ¿qué día te acomoda? Y sobre el descuento de cumpleaños: ¿tu cumpleaños es esta semana?", ts: d(0, 13, 1), ia: { intencion: "cotizar_servicio", sentimiento: "neutral", tokens: 210, costo: 0.004 } },
        { de: "clienta", tipo: "texto", texto: "Sí", ts: d(0, 13, 3) },
        { de: "bot", tipo: "texto", texto: "¿Podrías confirmarme a cuál de las dos preguntas te refieres — el día de tu cita o si tu cumpleaños es esta semana? 😊", ts: d(0, 13, 3), ia: { intencion: "clarificar_ambiguedad", sentimiento: "neutral", tokens: 95, costo: 0.002 } },
      ],
    },
  ];

  /* ---------------- Escalamiento (5.4) ---------------- */
  const tickets = [
    { id: "tkt-1", conversacionId: "conv-1", motivo: "queja", empleadoAsignado: "Sofía Beltrán", estado: "en_atencion", creado: d(0, 9, 4) },
    { id: "tkt-2", conversacionId: "conv-5", motivo: "palabra_prohibida", empleadoAsignado: "Sofía Beltrán", estado: "abierto", creado: d(0, 9, 31) },
    { id: "tkt-3", conversacionId: "conv-3", motivo: "imagen", empleadoAsignado: "Mariana Cid", estado: "abierto", creado: d(0, 7, 16) },
    { id: "tkt-4", conversacionId: "conv-7", motivo: "audio_complicado", empleadoAsignado: "Sofía Beltrán", estado: "resuelto", creado: d(-3, 11, 41), cerrado: d(-3, 12, 10) },
    { id: "tkt-5", conversacionId: "conv-6", motivo: "queja", empleadoAsignado: "Mariana Cid", estado: "resuelto", creado: d(-9, 10, 0), cerrado: d(-9, 10, 40) },
  ];

  /* ---------------- Anticipos (5.6) ---------------- */
  const anticipos = [
    { id: "ant-1", citaId: "cit-1003", clientaId: "cli-2", monto: 200, estado: "pendiente", creado: d(0, 11, 5), expira: d(0, 13, 5) },
    { id: "ant-2", citaId: "cit-1013", clientaId: "cli-8", monto: 100, estado: "pendiente", creado: d(1, 8, 0), expira: d(1, 10, 0) },
    { id: "ant-3", citaId: "cit-1015", clientaId: "cli-9", monto: 150, estado: "pagado", creado: d(-2, 9, 0), pagado: d(-2, 9, 40) },
    { id: "ant-4", citaId: "cit-1016", clientaId: "cli-6", monto: 150, estado: "expirado", creado: d(-4, 8, 0), expira: d(-4, 10, 0) },
    { id: "ant-5", citaId: "cit-1010", clientaId: "cli-14", monto: 200, estado: "reembolsado", creado: d(-6, 8, 0), pagado: d(-6, 8, 20) },
  ];

  /* ---------------- Garantías (Sesión 02 de Domain Discovery, F3/N1) ----------------
     Dominio nuevo identificado en la sesión 02: garantía de 7 días sobre el producto
     aplicado. Se integra como tab dentro del perfil de la clienta (no como módulo de
     sidebar independiente), consistente con la revisión UX aprobada. Gobernanza de
     aprobación automática vs. humana sigue sin confirmar (pregunta abierta #2 de esa
     sesión) — por eso la única acción disponible aquí es "enviar a revisión", nunca
     una aprobación automática simulada. */
  const garantias = [
    { id: "gar-1", citaId: "cit-1015", clientaId: "cli-9", estado: "en_revision", reportado: "Se despegó una uña con diseño", creado: d(0, 9, 0) },
    { id: "gar-2", citaId: "cit-1017", clientaId: "cli-5", estado: "vencida", reportado: "Se maltrató el esmaltado", creado: d(-2, 10, 0) },
  ];

  /* ---------------- Lista de espera (5.1) ---------------- */
  const listaEspera = [
    { id: "esp-1", clientaId: "cli-14", sucursalId: "suc-3", servicioDeseado: "Acrílico", ventana: "Sábado 9:00–15:00", estado: "en_espera", creado: d(0, 12, 2), expira: d(3, 15, 0) },
    { id: "esp-2", clientaId: "cli-11", sucursalId: "suc-2", servicioDeseado: "Gelish + Nail Art", ventana: "Cualquier día esta semana", estado: "en_espera", creado: d(-1, 10, 0), expira: d(5, 19, 0) },
    { id: "esp-3", clientaId: "cli-5", sucursalId: "suc-2", servicioDeseado: "Pedicure", ventana: "Jueves tarde", estado: "notificada", creado: d(-2, 9, 0), expira: d(1, 19, 0) },
    { id: "esp-4", clientaId: "cli-12", sucursalId: "suc-2", servicioDeseado: "Retiro + Gelish", ventana: "Viernes mañana", estado: "expirada", creado: d(-6, 9, 0), expira: d(-1, 13, 0) },
  ];

  /* ---------------- Notificaciones (5.12) ---------------- */
  const notificaciones = [
    { id: "not-1", citaId: "cit-1005", clientaId: "cli-10", tipo: "recordatorio", canal: "WhatsApp", estado: "enviada", ts: d(-1, 17, 0) },
    { id: "not-2", citaId: "cit-1012", clientaId: "cli-1", tipo: "confirmación", canal: "WhatsApp", estado: "enviada", ts: d(0, 8, 45) },
    { id: "not-3", citaId: "cit-1014", clientaId: "cli-11", tipo: "recordatorio", canal: "WhatsApp", estado: "programada", ts: d(1, 11, 0) },
    { id: "not-4", citaId: "cit-1008", clientaId: "cli-12", tipo: "confirmación", canal: "WhatsApp", estado: "fallida", ts: d(0, 9, 0) },
    { id: "not-5", citaId: "cit-1009", clientaId: "cli-4", tipo: "recordatorio", canal: "WhatsApp", estado: "enviada", ts: d(-1, 9, 0) },
    { id: "not-6", citaId: "cit-1002", clientaId: "cli-13", tipo: "confirmación", canal: "WhatsApp", estado: "enviada", ts: d(0, 8, 20) },
    { id: "not-7", citaId: "cit-1013", clientaId: "cli-8", tipo: "confirmación", canal: "WhatsApp", estado: "programada", ts: d(1, 7, 0) },
  ];

  /* ---------------- Historial / Auditoría ---------------- */
  const auditoria = [
    { id: "aud-1", tipo: "decision_ia", sucursalId: "suc-1", ts: d(0, 9, 4), detalle: "Intención detectada: queja. Sentimiento: negativo. Disparó escalamiento automático.", meta: "Conversación #conv-1 · modelo gpt · 180 tokens · $0.003" },
    { id: "aud-2", tipo: "config", sucursalId: "suc-3", ts: d(-1, 16, 20), detalle: "Diego Aranda actualizó el horario de Blanc Santa Fe (sábado).", meta: "Configuración → Sucursales" },
    { id: "aud-3", tipo: "lista_roja", sucursalId: "suc-2", ts: d(-2, 12, 0), detalle: "Mariana Cid marcó a Renata Salazar Nava como lista roja tras 3 cancelaciones.", meta: "CRM → Clientas" },
    { id: "aud-4", tipo: "anticipo", sucursalId: "suc-1", ts: d(-2, 9, 40), detalle: "Anticipo de $150 pagado por Daniela Ponce Herrera para cit-1015.", meta: "Anticipos" },
    { id: "aud-5", tipo: "decision_ia", sucursalId: "suc-1", ts: d(0, 8, 41), detalle: "Cotización calculada automáticamente: Gelish + diseño francés (2 uñas) + piedras (1 uña) → 55 min, $400.", meta: "Conversación #conv-2 · modelo gpt · 340 tokens · $0.006" },
    { id: "aud-6", tipo: "config", sucursalId: "suc-2", ts: d(-5, 10, 0), detalle: "Karla Espinoza activó el modo mantenimiento para Blanc Condesa por 40 minutos (mantenimiento programado).", meta: "Configuración → Modo mantenimiento" },
    { id: "aud-7", tipo: "prompt", sucursalId: null, ts: d(-7, 15, 0), detalle: "Diego Aranda publicó la versión de prompt v14 desde sandbox a producción.", meta: "Configuración → Prompts del bot (aplica a todas las sucursales)" },
    { id: "aud-8", tipo: "escalamiento", sucursalId: "suc-2", ts: d(0, 9, 31), detalle: "Palabra prohibida detectada. Ticket tkt-2 creado y notificado a Sofía Beltrán.", meta: "Escalamientos" },
  ];

  /* ---------------- KPIs / Analítica (5.9) ---------------- */
  const kpis = {
    ventasHoy: 18420,
    ventasSemana: 96340,
    citasHoy: 16,
    citasCompletadasHoy: 11,
    cancelacionesSemana: 6,
    noShowSemana: 3,
    citasReprogramadasSemana: 4,
    clientesNuevosSemana: 9,
    clientesRecurrentesSemana: 41,
    conversacionesActivas: 8,
    tiempoRespuestaPromedio: "38 seg",
    tiempoPromedioServicio: "52 min",
    satisfaccion: 4.7,
    iaVsHumano: { ia: 82, humano: 18 },
    costoIAMes: 612.4,
    tokensConsumidosMes: 1284000,
    horasOcupadas: { total: 168, ocupadas: 121 },
    serviciosMasVendidos: [
      { nombre: "Gelish", valor: 132 },
      { nombre: "Acrílico", valor: 88 },
      { nombre: "Pedicure", valor: 74 },
      { nombre: "Nail Art", valor: 51 },
      { nombre: "Retiro", valor: 44 },
    ],
    ventasPorDia: [
      { label: "Lun", valor: 12400 },
      { label: "Mar", valor: 14100 },
      { label: "Mié", valor: 13200 },
      { label: "Jue", valor: 15800 },
      { label: "Vie", valor: 17900 },
      { label: "Sáb", valor: 22040 },
      { label: "Dom", valor: 0 },
    ],
    embudo: [
      { etapa: "Conversaciones iniciadas", valor: 214 },
      { etapa: "Cotización generada", valor: 168 },
      { etapa: "Horario propuesto", valor: 141 },
      { etapa: "Cita confirmada", valor: 119 },
      { etapa: "Cita completada", valor: 104 },
    ],
    sucursales: [
      { id: "suc-1", nombre: "Blanc Polanco", ventas: 38200, ocupacion: 78 },
      { id: "suc-2", nombre: "Blanc Condesa", ventas: 31900, ocupacion: 71 },
      { id: "suc-3", nombre: "Blanc Santa Fe", ventas: 26240, ocupacion: 64 },
    ],
    conversacionesMes: 214,
  };

  /* ---------------- Métricas derivadas por sucursal ----------------
     Recalcula los indicadores del Dashboard/Analytics a partir de las
     entidades reales (citas, conversaciones, clientas) filtradas por
     sucursal, en vez de usar el objeto `kpis` fijo sin relación con el
     filtro activo. `sucursalId` puede ser un id de sucursal o "todas". */
  function metrics(sucursalId) {
    const todas = !sucursalId || sucursalId === "todas";
    const citasSuc = todas ? citas : citas.filter((c) => c.sucursalId === sucursalId);
    const convSuc = todas ? conversaciones : conversaciones.filter((c) => c.sucursalId === sucursalId);
    const clientasSuc = todas ? clientas : clientas.filter((c) => c.sucursalFavorita === sucursalId);

    const hoy = new Date();
    const isToday = (dt) => new Date(dt).toDateString() === hoy.toDateString();
    const citasHoyList = citasSuc.filter((c) => isToday(c.inicio));
    const citasCompletadasHoy = citasHoyList.filter((c) => c.estado === "completada").length;
    const ventasHoy = citasHoyList
      .filter((c) => c.estado === "completada" || c.estado === "confirmada")
      .reduce((s, c) => s + c.composicion.precioTotal, 0);

    const ocho_dias_ms = 8 * 86400000;
    const enSemana = (dt) => Math.abs(hoy - new Date(dt)) < ocho_dias_ms;
    const citasSemana = citasSuc.filter((c) => enSemana(c.inicio));
    const cancelacionesSemana = citasSemana.filter((c) => c.estado === "cancelada").length;
    const noShowSemana = citasSemana.filter((c) => c.estado === "no_show").length;

    const conversacionesActivas = convSuc.filter((c) => c.estado === "activa").length;
    const iaCount = convSuc.filter((c) => c.modo === "bot").length;
    const humanoCount = convSuc.filter((c) => c.modo === "humano").length;
    const totalConv = iaCount + humanoCount;
    const iaVsHumano = totalConv ? { ia: Math.round((iaCount / totalConv) * 100), humano: Math.round((humanoCount / totalConv) * 100) } : { ia: 0, humano: 0 };

    const dowLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const ventasPorDiaMap = {};
    dowLabels.forEach((l) => (ventasPorDiaMap[l] = 0));
    citasSuc.forEach((c) => {
      if (c.estado === "completada" || c.estado === "confirmada") {
        ventasPorDiaMap[dowLabels[new Date(c.inicio).getDay()]] += c.composicion.precioTotal;
      }
    });
    const ventasPorDia = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => ({ label, valor: ventasPorDiaMap[label] }));

    const servConteo = {};
    citasSuc.forEach((c) => c.composicion.servicios.forEach((s) => { servConteo[s] = (servConteo[s] || 0) + 1; }));
    const serviciosMasVendidos = Object.entries(servConteo).sort((a, b) => b[1] - a[1]).map(([nombre, valor]) => ({ nombre, valor }));

    const citasShare = citas.length ? citasSuc.length / citas.length : 0;
    const convShare = conversaciones.length ? convSuc.length / conversaciones.length : 0;
    const clienteShare = clientas.length ? clientasSuc.length / clientas.length : 0;
    const round = (n) => Math.round(n);

    const horasSemanalesPorSucursal = Object.values(horarioSemanal).reduce((sum, rangos) => sum + rangos.reduce((s, [ini, fin]) => {
      const [ih, im] = ini.split(":").map(Number), [fh, fm] = fin.split(":").map(Number);
      return s + ((fh * 60 + fm) - (ih * 60 + im)) / 60;
    }, 0), 0);
    const horasTotales = round(horasSemanalesPorSucursal * (todas ? sucursales.length : 1));
    const horasOcupadas = Math.min(
      horasTotales,
      round(citasSemana.filter((c) => c.estado === "completada" || c.estado === "confirmada").reduce((s, c) => s + c.composicion.duracionTotal, 0) / 60)
    );

    return {
      ventasHoy, citasHoy: citasHoyList.length, citasCompletadasHoy,
      cancelacionesSemana, noShowSemana, conversacionesActivas, iaVsHumano,
      satisfaccion: kpis.satisfaccion,
      tiempoRespuestaPromedio: kpis.tiempoRespuestaPromedio,
      tiempoPromedioServicio: kpis.tiempoPromedioServicio,
      clientesNuevosSemana: Math.max(0, round(kpis.clientesNuevosSemana * (todas ? 1 : clienteShare))),
      clientesRecurrentesSemana: Math.max(0, round(kpis.clientesRecurrentesSemana * (todas ? 1 : clienteShare))),
      costoIAMes: +(kpis.costoIAMes * (todas ? 1 : convShare)).toFixed(1),
      tokensConsumidosMes: round(kpis.tokensConsumidosMes * (todas ? 1 : convShare)),
      conversacionesMes: Math.max(totalConv, round(kpis.conversacionesMes * (todas ? 1 : convShare))),
      ventasPorDia, serviciosMasVendidos,
      embudo: kpis.embudo.map((e) => ({ etapa: e.etapa, valor: todas ? e.valor : Math.max(totalConv ? 1 : 0, round(e.valor * citasShare)) })),
      horasOcupadas: { total: horasTotales, ocupadas: horasOcupadas },
      sucursales: kpis.sucursales,
    };
  }

  return {
    sucursales, horarioSemanal, diasFestivos, manicuristas, usuarios, servicios, modificadores,
    clientas, citas, conversaciones, tickets, anticipos, listaEspera, notificaciones, auditoria, kpis,
    garantias, retiroMetodos, tablaDuracionRetiro, tablaDuracionAplicacion,
    cliente, manicurista, sucursal, metrics, buscarDuracionRetiro, buscarDuracionAplicacion,
  };
})();
