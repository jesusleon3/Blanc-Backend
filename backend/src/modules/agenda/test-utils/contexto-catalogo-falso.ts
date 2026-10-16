import { ContextoCatalogoPort, ServicioAgendable } from '../domain/ports/contexto-catalogo.port';
import { ContextoClienta, ContextoClientaPort } from '../domain/ports/contexto-clienta.port';

/** Servicio de catálogo por defecto: activo, 60 minutos, $450.00. */
export function servicioDePrueba(sobreescribir: Partial<ServicioAgendable> = {}): ServicioAgendable {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    nombre: 'Gelish',
    categoria: 'aplicacion',
    duracionMinutos: 60,
    precioCentavos: 45000,
    activo: true,
    requiereCotizacionManual: false,
    ...sobreescribir,
  };
}

/**
 * Doble de `ContextoCatalogoPort`.
 *
 * Por defecto responde con **un solo servicio** y devuelve `null` para cualquier otro id: así una
 * prueba que pase un id distinto por descuido falla con `RECURSO_NO_ENCONTRADO` en vez de pasar
 * por casualidad.
 */
export function crearContextoCatalogoFalso(servicios: ServicioAgendable[] = [servicioDePrueba()]): ContextoCatalogoPort {
  const porId = new Map(servicios.map((servicio) => [servicio.id, servicio]));
  return { buscarServicio: async (id) => porId.get(id) ?? null };
}

/**
 * Doble de `ContextoClientaPort`. Por defecto **cualquier** clienta existe y está en `normal`.
 *
 * Ese valor por defecto es deliberado: las pruebas que no van sobre CRM —reserva, sillas, ciclo de
 * vida— deben seguir aislando lo suyo. Las que sí van sobre el estado de riesgo pasan
 * `estadoDeRiesgo` explícitamente.
 */
export function crearContextoClientaFalso(
  opciones: { existe?: boolean; estadoDeRiesgo?: ContextoClienta['estadoDeRiesgo']; nombres?: Record<string, string> } = {},
): ContextoClientaPort {
  const existe = opciones.existe ?? true;
  const estadoDeRiesgo = opciones.estadoDeRiesgo ?? 'normal';
  const contexto = (id: string): ContextoClienta => ({ id, estadoDeRiesgo });

  return {
    obtener: async (id) => (existe ? contexto(id) : null),
    obtenerVarias: async (ids) => new Map(existe ? ids.map((id) => [id, contexto(id)]) : []),
    // Por defecto NO devuelve nombres: las pruebas que no van sobre eso no deben verse afectadas,
    // y una que afirme algo sobre el nombre tiene que pasarlo explícitamente.
    obtenerNombres: async (ids) =>
      new Map(ids.filter((id) => opciones.nombres?.[id] !== undefined).map((id) => [id, opciones.nombres![id]!])),
  };
}

/**
 * Catálogo con **un servicio por duración**, para las pruebas que ejercitan rangos de distinto
 * tamaño.
 *
 * Existe porque el fin de la cita ya no lo decide quien llama: lo deriva la duración del
 * catálogo. Una prueba que quiera reservar dos horas necesita, por tanto, un servicio de dos
 * horas — y expresarlo así es más honesto que dejar que el caller invente el rango, que es
 * precisamente lo que esta integración vino a impedir.
 */
export function crearCatalogoPorDuraciones(duracionesEnMinutos: number[]) {
  const porDuracion = new Map<number, ServicioAgendable>(
    duracionesEnMinutos.map((minutos) => [
      minutos,
      servicioDePrueba({
        // Id derivado de la duración: legible en los mensajes de error de una prueba que falle.
        id: `d${String(minutos).padStart(7, '0')}-0000-4000-8000-000000000000`,
        nombre: `Servicio de ${minutos} min`,
        duracionMinutos: minutos,
      }),
    ]),
  );

  return {
    port: crearContextoCatalogoFalso([...porDuracion.values()]),
    /** Id del servicio que dura exactamente ese rango. Lanza si la prueba pidió una no registrada. */
    idPara(minutos: number): string {
      const servicio = porDuracion.get(minutos);
      if (!servicio) {
        throw new Error(`El catálogo de prueba no tiene un servicio de ${minutos} min; añádelo a crearCatalogoPorDuraciones.`);
      }
      return servicio.id;
    },
  };
}
