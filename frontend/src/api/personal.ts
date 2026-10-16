import { peticion } from './cliente';
import type { ExcepcionPersonal, Manicurista, ResultadoDeExcepcion } from './contrato';

const EXCEPCIONES = '/v1/sucursales-y-personal/excepciones';

export const personalApi = {
  /** `sucursalId` responde *"¿quién trabaja aquí?"* — la lista correcta para asignar. */
  manicuristas: (sucursalId?: string) =>
    peticion<{ manicuristas: Manicurista[] }>('/v1/sucursales-y-personal/manicuristas', { query: { sucursalId } }),

  /**
   * Ausencias y coberturas que solapan el rango.
   *
   * Con `sucursalId` **incluye las ausencias de las manicuristas de esa sucursal**, no solo las
   * coberturas con ese destino: una ausencia no lleva sucursal, y filtrarla por ese campo la
   * haría desaparecer justo cuando es el dato que importa.
   */
  excepciones: (rango: { inicio: string; fin: string; sucursalId?: string }) =>
    peticion<{ excepciones: ExcepcionPersonal[] }>(EXCEPCIONES, { query: { ...rango } }),

  /**
   * Registrar una ausencia. **Nunca falla por haber citas comprometidas**: en la vida real la
   * manicurista ya faltó, y negarse a anotarlo dejaría al motor de disponibilidad vendiendo
   * huecos imposibles. Devuelve `citasAfectadas` para que una persona las gestione.
   */
  registrarAusencia: (datos: { manicuristaId: string; inicio: string; fin: string; motivo?: string }) =>
    peticion<ResultadoDeExcepcion>(`${EXCEPCIONES}/ausencias`, { metodo: 'POST', cuerpo: datos }),

  /** Cobertura inter-sucursal. `sucursalId` es el **destino** y es obligatorio. */
  registrarCobertura: (datos: { manicuristaId: string; sucursalId: string; inicio: string; fin: string; motivo?: string }) =>
    peticion<ResultadoDeExcepcion>(`${EXCEPCIONES}/coberturas`, { metodo: 'POST', cuerpo: datos }),

  /** Se capturó mal. La capacidad vuelve sola en cuanto desaparece el registro. */
  revocar: (id: string) => peticion<void>(`${EXCEPCIONES}/${id}`, { metodo: 'DELETE' }),
};
