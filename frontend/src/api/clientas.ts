import { peticion } from './cliente';
import type { AccionDeRiesgo, Clienta, DetalleDeClienta } from './contrato';

const RUTA = '/v1/crm/clientas';

export const clientasApi = {
  /**
   * Búsqueda por teléfono. **Devuelve una lista, siempre.**
   *
   * Es el caso de mamá e hija: dos clientas distintas con el mismo número. El backend nunca elige
   * —elegir sería adivinar— y quien atiende decide a cuál se refiere la conversación. La interfaz
   * tiene que estar preparada para mostrar varias, no para asumir una.
   */
  buscarPorTelefono: (telefono: string) => peticion<{ clientas: Clienta[] }>(RUTA, { query: { telefono } }),

  detalle: (id: string) => peticion<DetalleDeClienta>(`${RUTA}/${id}`),

  /** **Solo `SUPER_ADMIN` / `ADMINISTRADOR`** (`DEC-042`). La Encargada recibe `403`. */
  cambiarEstadoDeRiesgo: (id: string, accion: AccionDeRiesgo, motivo?: string) =>
    peticion<Clienta>(`${RUTA}/${id}/estado-de-riesgo`, { metodo: 'POST', cuerpo: motivo ? { accion, motivo } : { accion } }),
};
