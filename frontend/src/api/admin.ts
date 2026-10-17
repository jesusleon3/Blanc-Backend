import { peticion } from './cliente';
import type { ModificadorDiseno, Servicio, Silla, Manicurista, Sucursal } from './contrato';

const SERVICIOS = '/v1/catalogo-y-cotizacion/servicios';
const MODIFICADORES = '/v1/catalogo-y-cotizacion/modificadores-diseno';
const MANICURISTAS = '/v1/sucursales-y-personal/manicuristas';

export interface DatosDeServicio {
  nombre: string;
  categoria: string;
  /**
   * **La que `AgendarCitaUseCase` usa para derivar el fin de la cita.** Si está mal, el sistema
   * vende huecos del tamaño equivocado y nada falla: las citas simplemente no caben.
   */
  duracionBaseMinutos: number;
  precioBaseCentavos: number;
  requiereCotizacionManual?: boolean;
}

/**
 * API del Backoffice administrativo.
 *
 * Todo lo de aquí es **configuración**, no operación: precios, duraciones y capacidad vendible. El
 * backend lo restringe a `SUPER_ADMIN`/`ADMINISTRADOR` salvo las lecturas, que la Encargada necesita
 * para operar la agenda.
 */
export const adminApi = {
  // --- Catálogo ---
  /** Catálogo **completo**: activos e inactivos. El Backoffice los gestiona todos. */
  servicios: () => peticion<{ servicios: Servicio[] }>(SERVICIOS),

  /**
   * Categorías **en uso**, derivadas del catálogo.
   *
   * No hay tabla de categorías: `categoria` es texto en `Servicio`. Esto existe para que nadie
   * teclee `Manos` en un servicio y `manos` en el siguiente y acaben siendo dos.
   */
  categorias: () => peticion<{ categorias: string[] }>(`${SERVICIOS}/categorias`),

  crearServicio: (datos: DatosDeServicio) => peticion<Servicio>(SERVICIOS, { metodo: 'POST', cuerpo: datos }),

  /** Parcial: solo lo que se manda cambia. */
  editarServicio: (id: string, datos: Partial<DatosDeServicio>) =>
    peticion<Servicio>(`${SERVICIOS}/${id}`, { metodo: 'PATCH', cuerpo: datos }),

  /**
   * Baja del catálogo. **No borra**: un servicio dado de baja deja de venderse, pero las citas que
   * ya lo usaron siguen siendo legibles — su `cotizacionSnapshot` congeló nombre y precio.
   */
  desactivarServicio: (id: string) => peticion<void>(`${SERVICIOS}/${id}/desactivar`, { metodo: 'POST' }),

  /**
   * **La clave es `modificadoresDiseno`, no `modificadores`.** Es la que devuelve
   * `ModificadoresDisenoController.listar()`; escribir la otra daría `undefined` en silencio y una
   * tabla vacía sin ningún error.
   */
  modificadores: () => peticion<{ modificadoresDiseno: ModificadorDiseno[] }>(MODIFICADORES),

  crearModificador: (datos: { nombre: string; minutosAdicionales: number; precioAdicionalCentavos: number; requiereCotizacionManual?: boolean }) =>
    peticion<ModificadorDiseno>(MODIFICADORES, { metodo: 'POST', cuerpo: datos }),

  editarModificador: (
    id: string,
    datos: Partial<{ nombre: string; minutosAdicionales: number; precioAdicionalCentavos: number; requiereCotizacionManual: boolean }>,
  ) => peticion<ModificadorDiseno>(`${MODIFICADORES}/${id}`, { metodo: 'PATCH', cuerpo: datos }),

  desactivarModificador: (id: string) => peticion<void>(`${MODIFICADORES}/${id}/desactivar`, { metodo: 'POST' }),

  /** Los modificadores vinculados a un servicio: **entidades completas**, no ids. */
  modificadoresDeServicio: (servicioId: string) =>
    peticion<{ modificadoresDiseno: ModificadorDiseno[] }>(`${SERVICIOS}/${servicioId}/modificadores`),

  vincularModificador: (servicioId: string, modificadorId: string) =>
    peticion<void>(`${SERVICIOS}/${servicioId}/modificadores/${modificadorId}`, { metodo: 'POST' }),

  desvincularModificador: (servicioId: string, modificadorId: string) =>
    peticion<void>(`${SERVICIOS}/${servicioId}/modificadores/${modificadorId}`, { metodo: 'DELETE' }),

  // --- Sucursales y sillas ---
  sucursales: () => peticion<{ sucursales: Sucursal[] }>('/v1/sucursales-y-personal/sucursales'),

  /** Sillas de una sucursal: activas **e inactivas**. */
  sillas: (sucursalId: string) => peticion<{ sillas: Silla[] }>('/v1/agenda/sillas', { query: { sucursalId } }),

  /**
   * Crear una silla **aumenta la capacidad vendible** de la sucursal (`DEC-031`): el número de
   * filas *es* la capacidad. No es una preferencia visual.
   */
  crearSilla: (sucursalId: string, nombre: string) =>
    peticion<Silla>('/v1/agenda/sillas', { metodo: 'POST', cuerpo: { sucursalId, nombre } }),

  /**
   * Baja de una silla: **reduce la capacidad**. Para una estación en reparación.
   *
   * A diferencia de las demás bajas del proyecto, esta responde `200` con la silla — así lo
   * declara `SillasController`. No se uniformó desde aquí: el contrato es el del backend.
   */
  desactivarSilla: (id: string) => peticion<Silla>(`/v1/agenda/sillas/${id}/desactivar`, { metodo: 'POST' }),

  // --- Personal ---
  manicuristas: (sucursalId?: string) => peticion<{ manicuristas: Manicurista[] }>(MANICURISTAS, { query: { sucursalId } }),

  crearManicurista: (nombre: string) => peticion<Manicurista>(MANICURISTAS, { metodo: 'POST', cuerpo: { nombre } }),

  /**
   * Baja de una manicurista. **Puede responder `409 MANICURISTA_CON_CITAS_ACTIVAS`**: tiene citas
   * futuras asignadas, y darla de baja las dejaría sin quien las atienda sin que nadie se enterara
   * hasta que la clienta llegue.
   */
  desactivarManicurista: (id: string) => peticion<void>(`${MANICURISTAS}/${id}/desactivar`, { metodo: 'POST' }),

  asignarASucursal: (manicuristaId: string, sucursalId: string) =>
    peticion<void>(`${MANICURISTAS}/${manicuristaId}/sucursales/${sucursalId}`, { metodo: 'POST' }),

  removerDeSucursal: (manicuristaId: string, sucursalId: string) =>
    peticion<void>(`${MANICURISTAS}/${manicuristaId}/sucursales/${sucursalId}`, { metodo: 'DELETE' }),
};
