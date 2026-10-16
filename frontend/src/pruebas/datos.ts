import type {
  Anticipo,
  ResumenAnalitico,
  Cita,
  CitaAfectada,
  CotizacionSnapshot,
  ExcepcionPersonal,
  Manicurista,
  Servicio,
  SolicitudListaEspera,
  Sucursal,
  Clienta,
  Conversacion,
  DetalleDeClienta,
  EscaladasPendientes,
  HiloDeConversacion,
  Incidente,
  Mensaje,
  PerfilUsuario,
  Rol,
} from '../api/contrato';

/**
 * Datos de prueba con la **forma exacta** de los *presenters* del backend.
 *
 * Están escritos campo por campo y no generados: si el backend añade o quita un campo, estos
 * objetos dejan de compilar contra los tipos del contrato, y es la señal que se quiere mientras
 * `P8` siga abierto.
 */

export const SUCURSAL_LOMAS = '11111111-1111-4111-8111-111111111111';
export const SUCURSAL_ZIBATA = '22222222-2222-4222-8222-222222222222';

export const perfil = (rol: Rol, extra: Partial<PerfilUsuario> = {}): PerfilUsuario => ({
  sub: `sub-${rol}`,
  rol,
  sucursales: 'GLOBAL',
  manicuristaId: rol === 'MANICURISTA' ? '44444444-4444-4444-8444-444444444444' : null,
  ...extra,
});

export const conversacion = (extra: Partial<Conversacion> = {}): Conversacion => ({
  id: 'conv-1',
  sucursalId: SUCURSAL_LOMAS,
  telefonoClienta: '4421112233',
  clientaId: 'clienta-1',
  modo: 'humano',
  motivoDeEscalamiento: 'cancelacion_solicitada',
  escaladaEn: '2026-10-16T16:00:00.000Z',
  ultimaInteraccionEntranteEn: '2026-10-16T16:00:00.000Z',
  ultimoMensajeEn: '2026-10-16T16:00:00.000Z',
  mensajesSinResponder: 2,
  creadoEn: '2026-10-01T16:00:00.000Z',
  ...extra,
});

export const mensaje = (extra: Partial<Mensaje> = {}): Mensaje => ({
  id: 'msg-1',
  wamid: 'wamid.AAA',
  direccion: 'entrante',
  emisor: 'clienta',
  tipo: 'texto',
  contenido: 'Hola, necesito cancelar mi cita',
  estadoEntrega: 'entregado',
  errorDeEnvio: null,
  ocurridoEn: '2026-10-16T16:00:00.000Z',
  ...extra,
});

export const hilo = (extra: Partial<HiloDeConversacion> = {}): HiloDeConversacion => ({
  conversacion: conversacion(),
  estadoDeVentana: 'abierta',
  ventanaAbierta: true,
  mensajes: [mensaje()],
  ...extra,
});

export const escaladas = (extra: Partial<EscaladasPendientes> = {}): EscaladasPendientes => ({
  total: 3,
  porSucursal: [{ sucursalId: SUCURSAL_LOMAS, total: 3 }],
  masAntiguaEn: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  ...extra,
});

export const anticipo = (extra: Partial<Anticipo> = {}): Anticipo => ({
  id: 'ant-1',
  citaId: 'cita-1',
  clientaId: 'clienta-1',
  montoCentavos: 18000,
  porcentajeAplicado: 40,
  estado: 'pendiente',
  referenciaPago: null,
  confirmadoPor: null,
  confirmadoEn: null,
  creadoEn: '2026-10-16T14:00:00.000Z',
  ...extra,
});

export const clienta = (extra: Partial<Clienta> = {}): Clienta => ({
  id: 'clienta-1',
  nombre: 'Andrea Ramírez',
  telefono: '4421112233',
  telefonoAnterior: null,
  estadoDeRiesgo: 'normal',
  sugeridaListaRoja: false,
  cancelacionesOrdinarias: 0,
  creadoEn: '2026-09-01T16:00:00.000Z',
  ...extra,
});

export const incidente = (extra: Partial<Incidente> = {}): Incidente => ({
  id: 'inc-1',
  citaId: 'cita-9',
  tipo: 'no_show',
  ocurridoEn: '2026-10-01T16:00:00.000Z',
  minutosDeAntelacion: null,
  ...extra,
});

export const detalleDeClienta = (extra: Partial<DetalleDeClienta> = {}): DetalleDeClienta => ({
  clienta: clienta(),
  incidentes: [incidente()],
  ...extra,
});

// ---------------------------------------------------------------------------
// Agenda y personal (Fase 5 Parte 2)
// ---------------------------------------------------------------------------

export const SERVICIO_GELISH = '55555555-5555-4555-8555-555555555555';
export const MANICURISTA_ANA = '66666666-6666-4666-8666-666666666666';
export const MANICURISTA_BEA = '77777777-7777-4777-8777-777777777777';

export const sucursal = (extra: Partial<Sucursal> = {}): Sucursal => ({
  id: SUCURSAL_LOMAS,
  nombre: 'Lomas',
  enMantenimiento: false,
  ...extra,
});

export const servicio = (extra: Partial<Servicio> = {}): Servicio => ({
  id: SERVICIO_GELISH,
  nombre: 'Gelish manos',
  categoria: 'manos',
  duracionBaseMinutos: 60,
  precioBaseCentavos: 45000,
  activo: true,
  requiereCotizacionManual: false,
  ...extra,
});

export const manicurista = (extra: Partial<Manicurista> = {}): Manicurista => ({
  id: MANICURISTA_ANA,
  nombre: 'Ana',
  activa: true,
  ...extra,
});

/** Con la forma REAL del snapshot del backend (`ResolutorDeServicio.construirSnapshot`). */
export const cotizacion = (extra: Partial<CotizacionSnapshot> = {}): CotizacionSnapshot => ({
  version: 1,
  congeladoEn: '2027-03-01T16:00:00.000Z',
  servicio: {
    id: SERVICIO_GELISH,
    nombre: 'Gelish manos',
    categoria: 'manos',
    duracionMinutos: 60,
    precioCentavos: 45000,
  },
  totalCentavos: 45000,
  requiereCotizacionManual: false,
  incluyeModificadores: false,
  ...extra,
});

/**
 * Cita con la forma del presenter **para un rol de operación**. Para simular la vista de iPad hay
 * que construirla con `citaDeManicurista`, que omite los campos que el backend no le envía.
 */
export const cita = (extra: Partial<Cita> = {}): Cita => ({
  id: 'cita-1',
  sucursalId: SUCURSAL_LOMAS,
  sillaId: 'silla-1',
  manicuristaId: MANICURISTA_ANA,
  servicioId: SERVICIO_GELISH,
  inicio: '2027-03-08T17:00:00.000Z',
  fin: '2027-03-08T18:00:00.000Z',
  estado: 'agendada',
  cotizacionSnapshot: cotizacion(),
  clientaNombre: 'Andrea Ramírez',
  clientaId: 'clienta-1',
  citaOrigenId: null,
  numeroDeReprogramaciones: 0,
  enListaRoja: false,
  ...extra,
});

/**
 * Cita **tal como la recibe una `MANICURISTA`**: sin `clientaId`, sin `enListaRoja`, sin
 * `citaOrigenId` ni `numeroDeReprogramaciones`.
 *
 * Existe para que las pruebas de la vista de iPad usen la forma real de la respuesta y no una
 * versión conveniente: si se les pasara una `cita()` completa, estarían probando contra datos que
 * el backend nunca envía a ese rol.
 */
export const citaDeManicurista = (extra: Partial<Cita> = {}): Cita => {
  const completa = cita(extra);
  return {
    id: completa.id,
    sucursalId: completa.sucursalId,
    sillaId: completa.sillaId,
    manicuristaId: completa.manicuristaId,
    servicioId: completa.servicioId,
    inicio: completa.inicio,
    fin: completa.fin,
    estado: completa.estado,
    cotizacionSnapshot: completa.cotizacionSnapshot,
    ...(completa.clientaNombre !== undefined ? { clientaNombre: completa.clientaNombre } : {}),
  };
};

export const citaAfectada = (extra: Partial<CitaAfectada> = {}): CitaAfectada => ({
  citaId: 'cita-1',
  clase: 'cita_asignada',
  inicio: '2027-03-08T17:00:00.000Z',
  fin: '2027-03-08T18:00:00.000Z',
  manicuristaId: MANICURISTA_ANA,
  ...extra,
});

export const excepcion = (extra: Partial<ExcepcionPersonal> = {}): ExcepcionPersonal => ({
  id: 'exc-1',
  manicuristaId: MANICURISTA_ANA,
  tipo: 'ausencia',
  sucursalId: null,
  inicio: '2027-03-08T06:00:00.000Z',
  fin: '2027-03-09T05:59:59.000Z',
  motivo: 'Cita médica',
  ...extra,
});

export const solicitud = (extra: Partial<SolicitudListaEspera> = {}): SolicitudListaEspera => ({
  id: 'sol-1',
  sucursalId: SUCURSAL_LOMAS,
  clientaId: 'clienta-1',
  servicioId: SERVICIO_GELISH,
  fecha: '2027-03-08',
  estado: 'en_espera',
  notificadaEn: null,
  expiraEn: null,
  citaId: null,
  creadoEn: '2027-03-01T16:00:00.000Z',
  ...extra,
});

// ---------------------------------------------------------------------------
// Analítica (Fase 6)
// ---------------------------------------------------------------------------

/** Con la forma exacta de `GET /v1/analitica/resumen`. */
export const resumenAnalitico = (extra: Partial<ResumenAnalitico> = {}): ResumenAnalitico => ({
  rango: { desde: '2027-03-01T06:00:00.000Z', hasta: '2027-03-31T05:59:59.000Z' },
  sucursalId: null,
  citas: {
    porEstado: {
      en_espera_pago: 1,
      agendada: 4,
      pendiente_confirmacion: 0,
      confirmada: 2,
      completada: 40,
      no_show: 5,
      cancelada: 8,
      reprogramada: 3,
      expirada: 1,
    },
    total: 64,
    cancelacionesTardias: 3,
    atendidasPorSucursal: [
      { sucursalId: SUCURSAL_LOMAS, completadas: 25, noShow: 3 },
      { sucursalId: SUCURSAL_ZIBATA, completadas: 15, noShow: 2 },
    ],
    atendidasPorManicurista: [
      { manicuristaId: MANICURISTA_ANA, completadas: 22 },
      { manicuristaId: null, completadas: 18 },
    ],
    ingresoEstimadoCentavos: 1_800_000,
    completadasSinCotizar: 2,
    listaDeEspera: { inscritas: 12, notificadas: 8, aceptadas: 5, expiradas: 3 },
  },
  anticipos: {
    porEstado: {
      pendiente: { cantidad: 2, centavos: 36000 },
      pagado: { cantidad: 6, centavos: 108000 },
      retenido: { cantidad: 1, centavos: 18000 },
      expirado: { cantidad: 1, centavos: 18000 },
    },
    cobradoCentavos: 126000,
  },
  conversaciones: {
    activas: 50,
    soloBot: 42,
    conIntervencionHumana: 8,
    porcentajeResueltoPorElBot: 84,
    escalamientosPorMotivo: {
      clienta_bloqueada: 0,
      solicitud_humana: 2,
      queja_o_reclamo: 1,
      cotizacion_compleja: 3,
      cancelacion_solicitada: 2,
      intervencion_manual: 0,
      baja_confianza_ia: 0,
      fuera_de_alcance: 0,
      medio_no_soportado: 0,
    },
  },
  indicadores: {
    tasaDeNoShow: 11.1,
    efectividadDeListaDeEspera: 62.5,
    porcentajeResueltoPorElBot: 84,
    ingresoTotalEstimadoCentavos: 1_926_000,
  },
  advertencias: [
    'El ingreso es un ESTIMADO: sale de lo cotizado al agendar, no de lo cobrado. No incluye extras, propinas, descuentos de mostrador ni productos, que viven en el registro paralelo de Excel.',
  ],
  ...extra,
});
