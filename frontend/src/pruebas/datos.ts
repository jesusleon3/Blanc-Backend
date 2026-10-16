import type {
  Anticipo,
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
