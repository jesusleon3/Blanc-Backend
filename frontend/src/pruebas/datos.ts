import type {
  Anticipo,
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

export const cotizacion = (extra: Partial<CotizacionSnapshot> = {}): CotizacionSnapshot => ({
  precioBaseCentavos: 45000,
  totalCentavos: 45000,
  modificadores: [],
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
