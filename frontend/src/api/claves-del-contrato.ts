import type {
  Anticipo,
  ModificadorDiseno,
  Cita,
  ReporteDeAgenda,
  ReporteDeAnticipos,
  ReporteDeConversaciones,
  ResumenAnalitico,
  CotizacionSnapshot,
  Clienta,
  Conversacion,
  ExcepcionPersonal,
  Manicurista,
  PerfilUsuario,
  Servicio,
  SolicitudListaEspera,
  Silla,
  Sucursal,
} from './contrato';

/**
 * Las claves de cada tipo del contrato, **declaradas como dato ejecutable**.
 *
 * ## POR QUÉ ESTE ARCHIVO EXISTE (`P8`)
 *
 * Los tipos de `contrato.ts` son interfaces de TypeScript: **no existen en tiempo de ejecución**,
 * así que ninguna prueba puede compararlos con lo que el backend devuelve. Este archivo es el
 * puente, y la verificación tiene dos mitades que se cierran entre sí:
 *
 * 1. **`tsc` garantiza que estos arreglos coinciden EXACTAMENTE con las interfaces.** `satisfies`
 *    rechaza un nombre que no sea una clave real, y `ClavesCompletas` rechaza que falte alguna. No
 *    es una lista paralela que haya que recordar actualizar: si se añade un campo a `Cita` y no
 *    aquí, **el build falla**.
 * 2. **`contrato.spec.ts` compara estos arreglos con `contratos/api-v1.json`**, que el backend
 *    deriva de sus presenters reales.
 *
 * De 1 + 2 se sigue lo que importa: **las interfaces del frontend coinciden con lo que el backend
 * devuelve de verdad**, y un campo que desaparezca allí rompe el build aquí. Eso cierra la deuda
 * que `ADR-027` registró — *"los tipos del contrato están duplicados a mano… el riesgo es deriva
 * silenciosa"*.
 */

/**
 * Exige que el arreglo cubra **todas** las claves del tipo.
 *
 * El truco está en `[Exclude<keyof T, C[number]>] extends [never]`: si sobra alguna clave del tipo
 * sin listar, `Exclude` no es `never` y el tipo resultante es `never`, lo que hace fallar el
 * `satisfies`. Sin esto, un arreglo con la mitad de las claves pasaría — y el agujero estaría justo
 * en el campo nuevo que nadie añadió.
 */
type ClavesCompletas<T, C extends readonly (keyof T)[]> = [Exclude<keyof T, C[number]>] extends [never] ? C : never;

const completas = <T,>() => <const C extends readonly (keyof T)[]>(claves: ClavesCompletas<T, C>): readonly string[] =>
  claves as readonly string[];

/**
 * `Cita` tal como la recibe un rol de operación.
 *
 * Los campos que la `MANICURISTA` **no** recibe son opcionales en el tipo (`DEC-040`), así que
 * `keyof Cita` los incluye y aquí tienen que estar: este arreglo describe la forma completa.
 */
export const CLAVES_DE_CITA_OPERACION = completas<Cita>()([
  'id',
  'sucursalId',
  'sillaId',
  'manicuristaId',
  'servicioId',
  'inicio',
  'fin',
  'estado',
  'cotizacionSnapshot',
  'clientaNombre',
  'esGarantia',
  'citaGarantizadaId',
  'clientaId',
  'citaOrigenId',
  'numeroDeReprogramaciones',
  'enListaRoja',
]);

/**
 * `Cita` tal como la recibe la vista de iPad: **subconjunto estricto**.
 *
 * No se deriva del anterior con un `Omit` a propósito. Escribirla entera obliga a que añadir un
 * campo a `Cita` sea una decisión consciente sobre **en cuál de las dos formas entra**, que es
 * exactamente la pregunta que el presenter del backend plantea con su salida temprana.
 */
export const CLAVES_DE_CITA_IPAD: readonly string[] = [
  'id',
  'sucursalId',
  'sillaId',
  'manicuristaId',
  'servicioId',
  'inicio',
  'fin',
  'estado',
  'cotizacionSnapshot',
  'clientaNombre',
  // La Manicurista SÍ ve que es una garantía: tiene que saber que repone un trabajo antes de
  // empezar. No revela nada que `DEC-040` proteja.
  'esGarantia',
  'citaGarantizadaId',
];

export const CLAVES_DE_SILLA = completas<Silla>()(['id', 'sucursalId', 'nombre', 'activa']);

export const CLAVES_DE_SOLICITUD = completas<SolicitudListaEspera>()([
  'id',
  'sucursalId',
  'clientaId',
  'servicioId',
  'fecha',
  'estado',
  'notificadaEn',
  'expiraEn',
  'citaId',
  'creadoEn',
]);

export const CLAVES_DE_ANTICIPO = completas<Anticipo>()([
  'id',
  'citaId',
  'clientaId',
  'montoCentavos',
  'porcentajeAplicado',
  'estado',
  'referenciaPago',
  'confirmadoPor',
  'confirmadoEn',
  'creadoEn',
]);

export const CLAVES_DE_CLIENTA = completas<Clienta>()([
  'id',
  'nombre',
  'telefono',
  'telefonoAnterior',
  'estadoDeRiesgo',
  'sugeridaListaRoja',
  'cancelacionesOrdinarias',
  'creadoEn',
]);

export const CLAVES_DE_CONVERSACION = completas<Conversacion>()([
  'id',
  'sucursalId',
  'telefonoClienta',
  'clientaId',
  'modo',
  'motivoDeEscalamiento',
  'escaladaEn',
  'ultimaInteraccionEntranteEn',
  'ultimoMensajeEn',
  'mensajesSinResponder',
  'creadoEn',
]);

export const CLAVES_DE_EXCEPCION = completas<ExcepcionPersonal>()([
  'id',
  'manicuristaId',
  'tipo',
  'sucursalId',
  'inicio',
  'fin',
  'motivo',
]);

export const CLAVES_DE_SERVICIO = completas<Servicio>()([
  'id',
  'nombre',
  'categoria',
  'duracionBaseMinutos',
  'precioBaseCentavos',
  'activo',
  'requiereCotizacionManual',
]);

export const CLAVES_DE_MANICURISTA = completas<Manicurista>()(['id', 'nombre', 'activa']);

export const CLAVES_DE_PERFIL = completas<PerfilUsuario>()(['sub', 'rol', 'sucursales', 'manicuristaId']);

/**
 * `Sucursal` es el **único caso declarado como subconjunto a propósito**.
 *
 * El presenter del backend devuelve más campos (`numeroWhatsappAlias`, `horarioSemanal`,
 * `descansos`) que este frontend no usa. Pedirle a `tsc` que exija completitud obligaría a
 * declarar tipos para datos que ninguna pantalla pinta, y eso es peor: código muerto que hay que
 * mantener. Lo que sí se verifica es que **cada clave declarada exista en el backend**.
 */
export const CLAVES_DE_SUCURSAL = completas<Sucursal>()(['id', 'nombre', 'enMantenimiento']);

/**
 * Formas **anidadas**, y la razón de que existan es un defecto real.
 *
 * El verificador comparaba solo las claves de primer nivel, así que `cotizacionSnapshot` coincidía
 * como nombre mientras su **contenido** estaba equivocado: el tipo declaraba `precioBaseCentavos`,
 * un `totalCentavos` no nulo y un arreglo de `modificadores`, ninguno de los cuales existe en el
 * backend. La vista de iPad mostraba `NaN` y —peor— **$0.00 para un servicio de cotización
 * manual**, que es un precio falso en pantalla.
 *
 * Toda forma anidada que una pantalla lea debe declararse aquí.
 */
export const CLAVES_DE_COTIZACION = completas<CotizacionSnapshot>()([
  'version',
  'congeladoEn',
  'servicio',
  'totalCentavos',
  'requiereCotizacionManual',
  'incluyeModificadores',
]);

export const CLAVES_DE_COTIZACION_SERVICIO = completas<CotizacionSnapshot['servicio']>()([
  'id',
  'nombre',
  'categoria',
  'duracionMinutos',
  'precioCentavos',
]);

// ---------------------------------------------------------------------------
// Analítica (Fase 6)
// ---------------------------------------------------------------------------

export const CLAVES_DE_RESUMEN_ANALITICO = completas<ResumenAnalitico>()([
  'rango',
  'sucursalId',
  'citas',
  'anticipos',
  'conversaciones',
  'indicadores',
  'advertencias',
]);

export const CLAVES_DE_REPORTE_DE_AGENDA = completas<ReporteDeAgenda>()([
  'porEstado',
  'total',
  'cancelacionesTardias',
  'atendidasPorSucursal',
  'atendidasPorManicurista',
  'ingresoEstimadoCentavos',
  'completadasSinCotizar',
  'garantiasCompletadas',
  'listaDeEspera',
]);

export const CLAVES_DE_REPORTE_DE_ANTICIPOS = completas<ReporteDeAnticipos>()(['porEstado', 'cobradoCentavos']);

export const CLAVES_DE_REPORTE_DE_CONVERSACIONES = completas<ReporteDeConversaciones>()([
  'activas',
  'soloBot',
  'conIntervencionHumana',
  'porcentajeResueltoPorElBot',
  'escalamientosPorMotivo',
]);

export const CLAVES_DE_INDICADORES = completas<ResumenAnalitico['indicadores']>()([
  'tasaDeNoShow',
  'efectividadDeListaDeEspera',
  'porcentajeResueltoPorElBot',
  'ingresoTotalEstimadoCentavos',
]);

export const CLAVES_DE_MODIFICADOR = completas<ModificadorDiseno>()([
  'id',
  'nombre',
  'minutosAdicionales',
  'precioAdicionalCentavos',
  'activo',
  'requiereCotizacionManual',
]);
