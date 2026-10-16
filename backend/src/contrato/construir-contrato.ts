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
import { HealthController } from '../shared/health/health.controller';

// --- Presenters (la forma real de cada respuesta) -------------------------
import { citaAJson } from '../modules/agenda/infrastructure/http/cita.presenter';
import { sillaAJson } from '../modules/agenda/infrastructure/http/sillas.controller';
import { solicitudAJson } from '../modules/agenda/infrastructure/http/lista-espera.controller';
import { anticipoAJson } from '../modules/anticipos/infrastructure/http/anticipos.controller';
import { clientaAJson } from '../modules/crm-y-clientas/infrastructure/http/clientas.controller';
import { conversacionAJson } from '../modules/conversaciones/infrastructure/http/bandeja.controller';
import { excepcionAJson } from '../modules/sucursales-y-personal/infrastructure/http/excepciones-personal.controller';
import { servicioAJson } from '../modules/catalogo-y-cotizacion/infrastructure/http/catalogo.presenter';
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
import { Sucursal } from '../modules/sucursales-y-personal/domain/entities/sucursal.entity';
import { Manicurista } from '../modules/sucursales-y-personal/domain/entities/manicurista.entity';
import { Usuario } from '../modules/identidad-y-accesos/domain/entities/usuario.entity';
import { horarioAbiertoSiempre } from '../modules/agenda/test-utils/contexto-personal-falso';

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
      Sucursal: clavesDeRespuesta(sucursalAJson(sucursal)),
      Manicurista: clavesDeRespuesta(manicuristaAJson(manicurista)),
      Usuario: clavesDeRespuesta(usuarioAJson(usuario)),
    },
  };
}
