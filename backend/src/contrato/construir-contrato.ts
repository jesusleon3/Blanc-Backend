import { randomUUID } from 'node:crypto';
import { clavesDeRespuesta, ordenarRutas, rutasDeControlador, type RutaDelContrato } from './derivar-contrato';
import { Rol, type ClaimsUsuario } from '../shared/auth/rol';

// --- Controladores (todos los que `AppModule` registra) --------------------
import { CitasController } from '../modules/agenda/infrastructure/http/citas.controller';
import { SillasController } from '../modules/agenda/infrastructure/http/sillas.controller';
import { ListaEsperaController } from '../modules/agenda/infrastructure/http/lista-espera.controller';
import { AnticiposController } from '../modules/anticipos/infrastructure/http/anticipos.controller';
import { ServiciosController } from '../modules/catalogo-y-cotizacion/infrastructure/http/servicios.controller';
import { ModificadoresDisenoController } from '../modules/catalogo-y-cotizacion/infrastructure/http/modificadores-diseno.controller';
import { ClientasController } from '../modules/crm-y-clientas/infrastructure/http/clientas.controller';
import { WebhookMetaController } from '../modules/conversaciones/infrastructure/meta/webhook-meta.controller';
import { BandejaController } from '../modules/conversaciones/infrastructure/http/bandeja.controller';
import { UsuariosController } from '../modules/identidad-y-accesos/infrastructure/http/usuarios.controller';
import { SucursalesController } from '../modules/sucursales-y-personal/infrastructure/http/sucursales.controller';
import { ManicuristasController } from '../modules/sucursales-y-personal/infrastructure/http/manicuristas.controller';
import { MantenimientoController } from '../modules/sucursales-y-personal/infrastructure/http/mantenimiento.controller';
import { ExcepcionesPersonalController } from '../modules/sucursales-y-personal/infrastructure/http/excepciones-personal.controller';
import { PlanificadorController } from '../modules/planificador/infrastructure/http/planificador.controller';
import { AnaliticaController } from '../modules/analitica/infrastructure/http/analitica.controller';
import type { ResumenAnalitico } from '../modules/analitica/application/resumen-analitico.use-case';
import type { ReporteDeAgenda } from '../modules/agenda/application/use-cases/reporte-de-agenda.use-case';
import type { ReporteDeAnticipos } from '../modules/anticipos/application/use-cases/reporte-de-anticipos.use-case';
import type { ReporteDeConversaciones } from '../modules/conversaciones/application/use-cases/reporte-de-conversaciones.use-case';
import { HealthController } from '../shared/health/health.controller';

// --- Presenters (la forma real de cada respuesta) -------------------------
import { citaAJson } from '../modules/agenda/infrastructure/http/cita.presenter';
import { sillaAJson } from '../modules/agenda/infrastructure/http/sillas.controller';
import { solicitudAJson } from '../modules/agenda/infrastructure/http/lista-espera.controller';
import { anticipoAJson } from '../modules/anticipos/infrastructure/http/anticipos.controller';
import { clientaAJson } from '../modules/crm-y-clientas/infrastructure/http/clientas.controller';
import { conversacionAJson } from '../modules/conversaciones/infrastructure/http/bandeja.controller';
import { excepcionAJson } from '../modules/sucursales-y-personal/infrastructure/http/excepciones-personal.controller';
import { modificadorDisenoAJson, servicioAJson } from '../modules/catalogo-y-cotizacion/infrastructure/http/catalogo.presenter';
import { manicuristaAJson, sucursalAJson } from '../modules/sucursales-y-personal/infrastructure/http/sucursal.presenter';
import { usuarioAJson } from '../modules/identidad-y-accesos/infrastructure/http/usuario.presenter';

// --- Entidades, para alimentar a los presenters --------------------------
import { Cita } from '../modules/agenda/domain/entities/cita.entity';
import { Silla } from '../modules/agenda/domain/entities/silla.entity';
import { SolicitudListaEspera } from '../modules/agenda/domain/entities/solicitud-lista-espera.entity';
import { Anticipo } from '../modules/anticipos/domain/entities/anticipo.entity';
import { Clienta } from '../modules/crm-y-clientas/domain/entities/clienta.entity';
import { Conversacion } from '../modules/conversaciones/domain/entities/conversacion.entity';
import { ExcepcionPersonal } from '../modules/sucursales-y-personal/domain/entities/excepcion-personal.entity';
import { Servicio } from '../modules/catalogo-y-cotizacion/domain/entities/servicio.entity';
import { ModificadorDiseno } from '../modules/catalogo-y-cotizacion/domain/entities/modificador-diseno.entity';
import { Sucursal } from '../modules/sucursales-y-personal/domain/entities/sucursal.entity';
import { Manicurista } from '../modules/sucursales-y-personal/domain/entities/manicurista.entity';
import { Usuario } from '../modules/identidad-y-accesos/domain/entities/usuario.entity';
import { horarioAbiertoSiempre } from '../modules/agenda/test-utils/contexto-personal-falso';
import { ResolutorDeServicio } from '../modules/agenda/domain/services/resolutor-de-servicio';

/** Ruta del contrato versionado, **relativa a la raíz del repositorio**: los dos proyectos la leen. */
export const RUTA_DEL_CONTRATO = 'contratos/api-v1.json';

export interface ContratoDeApi {
  /** Para que el archivo diga qué es y de dónde salió, sin tener que buscarlo. */
  descripcion: string;
  version: string;
  rutas: RutaDelContrato[];
  /** Nombre legible de la forma → claves que el cliente recibe de verdad. */
  respuestas: Record<string, string[]>;
}

const CONTROLADORES = [
  HealthController,
  SucursalesController,
  ManicuristasController,
  MantenimientoController,
  ExcepcionesPersonalController,
  UsuariosController,
  ServiciosController,
  ModificadoresDisenoController,
  CitasController,
  SillasController,
  ListaEsperaController,
  ClientasController,
  AnticiposController,
  WebhookMetaController,
  BandejaController,
  PlanificadorController,
  AnaliticaController,
] as const;

const UUID = randomUUID();
const AHORA = new Date('2027-03-08T17:00:00.000Z');
const DESPUES = new Date('2027-03-08T18:00:00.000Z');

const actor = (rol: Rol): ClaimsUsuario => ({ sub: 'contrato', rol, sucursales: 'GLOBAL', manicuristaId: UUID });

/**
 * Construye el contrato **invocando el código real**: los presenters de verdad sobre entidades de
 * verdad, y los metadatos que Nest usa para enrutar.
 *
 * ## POR QUÉ SE INVOCAN LOS PRESENTERS Y NO SE LISTAN LOS CAMPOS A MANO
 *
 * Porque una lista a mano se actualiza cuando alguien se acuerda, y el objetivo es justo lo
 * contrario: que **no haga falta acordarse**. Si un presenter deja de devolver un campo, aquí
 * desaparece solo, el contrato versionado deja de coincidir y la prueba falla.
 *
 * Las dos formas de `Cita` se derivan pasando dos actores distintos al mismo presenter, que es
 * exactamente lo que hace el controlador en producción.
 */
export function construirContrato(): ContratoDeApi {
  /**
   * El snapshot de cotización, **construido por el servicio de dominio real**.
   *
   * ## POR QUÉ ESTA FORMA ANIDADA ENTRÓ AL CONTRATO (2026-10-16)
   *
   * La primera versión del verificador comparaba **solo las claves de primer nivel**, y eso dejó
   * pasar un defecto real: el frontend declaraba `cotizacionSnapshot` con `precioBaseCentavos`, un
   * `totalCentavos` no nulo y un arreglo de `modificadores`, **ninguno de los cuales existe**.
   * `cotizacionSnapshot` coincidía como clave, así que la prueba pasaba — mientras la vista de
   * iPad mostraba `NaN` y, peor, **$0.00 para un servicio de cotización manual**, que es un precio
   * falso en pantalla.
   *
   * Lo destapó el cruce de datos de Analítica al ir a sumar ingresos, no el contrato. Por eso las
   * formas anidadas que el cliente lee **tienen que estar aquí**.
   */
  const snapshot = new ResolutorDeServicio({
    buscarServicio: async () => null,
  }).construirSnapshot(
    { id: UUID, nombre: 'Contrato', categoria: 'manos', duracionMinutos: 60, precioCentavos: 10000, activo: true, requiereCotizacionManual: false },
    AHORA,
  );

  const cita = Cita.crear({
    sucursalId: UUID,
    sillaId: UUID,
    clientaId: UUID,
    servicioId: UUID,
    rangoHorario: { inicio: AHORA, fin: DESPUES },
    manicuristaId: UUID,
  });

  const clienta = Clienta.registrar({ nombre: 'Contrato', telefono: '4420000000' });
  const conversacion = Conversacion.abrir({ sucursalId: UUID, telefonoClienta: '4420000000' });
  const servicio = Servicio.crear({ nombre: 'Contrato', categoria: 'manos', duracionBaseMinutos: 60, precioBaseCentavos: 10000 });
  /**
   * `ModificadorDiseno` entra al contrato al construirse el Backoffice (Parte 2).
   *
   * No estaba antes porque ninguna pantalla lo leía. Ahora sí, y su forma es **justo la clase de
   * campo que se escribe de memoria mal**: el frontend declaró primero `minutosExtra` y
   * `precioExtraCentavos` —que no existen— y `tsc` lo aceptaba porque nadie comparaba contra el
   * presenter real. Con esto, inventarse un nombre rompe la prueba de contrato del frontend.
   */
  const modificador = ModificadorDiseno.crear({ nombre: 'Contrato', minutosAdicionales: 15, precioAdicionalCentavos: 5000 });
  const sucursal = Sucursal.crear({ nombre: 'Contrato', horarioSemanal: horarioAbiertoSiempre() });
  const manicurista = Manicurista.crear({ nombre: 'Contrato' });
  const usuario = Usuario.crear({ email: 'contrato@blanc.mx', nombre: 'Contrato', rol: Rol.GERENTE });
  const silla = Silla.crear({ sucursalId: UUID, nombre: 'Contrato 1' });
  const solicitud = SolicitudListaEspera.inscribir({ sucursalId: UUID, clientaId: UUID, servicioId: UUID, fecha: '2027-03-08' });
  const anticipo = Anticipo.generar({ citaId: UUID, clientaId: UUID, baseCentavos: 10000 });
  const excepcion = ExcepcionPersonal.ausencia({ manicuristaId: UUID, rango: { inicio: AHORA, fin: DESPUES } });

  return {
    descripcion:
      'Contrato de la API /v1 de Blanc, DERIVADO DEL CÓDIGO por `src/contrato/construir-contrato.ts`. No se edita a mano: se regenera con `npm run contrato:actualizar` cuando un cambio de ruta, de rol o de campo es intencionado. Lo verifican `backend/src/contrato/contrato-de-api.spec.ts` y `frontend/src/api/contrato.spec.ts`.',
    version: 'v1',
    rutas: ordenarRutas(CONTROLADORES.flatMap((controlador) => rutasDeControlador(controlador))),
    respuestas: {
      // Las dos formas del mismo presenter, con los dos actores reales. La asimetría de `DEC-040`
      // queda registrada en el contrato, no solo en una prueba.
      'Cita (roles de operación)': clavesDeRespuesta(
        citaAJson(cita, actor(Rol.GERENTE), { enListaRoja: false, clientaNombre: 'Contrato' }),
      ),
      'Cita (MANICURISTA / iPad)': clavesDeRespuesta(citaAJson(cita, actor(Rol.MANICURISTA), { clientaNombre: 'Contrato' })),
      Silla: clavesDeRespuesta(sillaAJson(silla)),
      SolicitudListaEspera: clavesDeRespuesta(solicitudAJson(solicitud)),
      Anticipo: clavesDeRespuesta(anticipoAJson(anticipo)),
      Clienta: clavesDeRespuesta(clientaAJson(clienta)),
      Conversacion: clavesDeRespuesta(conversacionAJson(conversacion)),
      ExcepcionPersonal: clavesDeRespuesta(excepcionAJson(excepcion)),
      Servicio: clavesDeRespuesta(servicioAJson(servicio)),
      ModificadorDiseno: clavesDeRespuesta(modificadorDisenoAJson(modificador)),
      Sucursal: clavesDeRespuesta(sucursalAJson(sucursal)),
      Manicurista: clavesDeRespuesta(manicuristaAJson(manicurista)),
      Usuario: clavesDeRespuesta(usuarioAJson(usuario)),
      // Formas ANIDADAS que el cliente lee. Ver la nota de `snapshot` arriba: su ausencia dejó
      // pasar un defecto que llegó hasta la pantalla.
      'CotizacionSnapshot (anidado en Cita)': clavesDeRespuesta(snapshot as unknown as Record<string, unknown>),
      'CotizacionSnapshot.servicio': clavesDeRespuesta(snapshot.servicio as unknown as Record<string, unknown>),
      // Analítica (Fase 6). Las formas se derivan de los TIPOS de los reportes, no de ejecutar las
      // consultas: estas respuestas son agregados y no hay entidad que pasarles.
      ...formasDeAnalitica(),
    },
  };
}

/**
 * Formas de la respuesta de Analítica.
 *
 * Se declaran a partir de objetos **tipados**: `satisfies` obliga a que las claves coincidan
 * exactamente con las interfaces de los reportes, así que si un reporte gana un campo y nadie lo
 * añade aquí, **el build del backend falla**. Es el mismo mecanismo que usa el frontend en
 * `claves-del-contrato.ts`, por la misma razón: los agregados no tienen entidad que invocar, así
 * que no se pueden derivar ejecutando un presenter.
 */
function formasDeAnalitica(): Record<string, string[]> {
  const resumen = {
    rango: 0,
    sucursalId: 0,
    citas: 0,
    anticipos: 0,
    conversaciones: 0,
    indicadores: 0,
    advertencias: 0,
  } satisfies Record<keyof ResumenAnalitico, number>;

  const agenda = {
    porEstado: 0,
    total: 0,
    cancelacionesTardias: 0,
    atendidasPorSucursal: 0,
    atendidasPorManicurista: 0,
    ingresoEstimadoCentavos: 0,
    completadasSinCotizar: 0,
    listaDeEspera: 0,
  } satisfies Record<keyof ReporteDeAgenda, number>;

  const anticipos = { porEstado: 0, cobradoCentavos: 0 } satisfies Record<keyof ReporteDeAnticipos, number>;

  const conversaciones = {
    activas: 0,
    soloBot: 0,
    conIntervencionHumana: 0,
    porcentajeResueltoPorElBot: 0,
    escalamientosPorMotivo: 0,
  } satisfies Record<keyof ReporteDeConversaciones, number>;

  const indicadores = {
    tasaDeNoShow: 0,
    efectividadDeListaDeEspera: 0,
    porcentajeResueltoPorElBot: 0,
    ingresoTotalEstimadoCentavos: 0,
  } satisfies Record<keyof ResumenAnalitico['indicadores'], number>;

  return {
    ResumenAnalitico: clavesDeRespuesta(resumen),
    'ResumenAnalitico.citas': clavesDeRespuesta(agenda),
    'ResumenAnalitico.anticipos': clavesDeRespuesta(anticipos),
    'ResumenAnalitico.conversaciones': clavesDeRespuesta(conversaciones),
    'ResumenAnalitico.indicadores': clavesDeRespuesta(indicadores),
  };
}
