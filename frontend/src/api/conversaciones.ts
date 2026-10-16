import { peticion } from './cliente';
import type {
  CatalogoDePlantillas,
  Conversacion,
  EscaladasPendientes,
  HiloDeConversacion,
  ModoConversacion,
  MotivoDeEscalamiento,
  PaginaDeBandeja,
} from './contrato';

const RUTA = '/v1/conversaciones';

export interface FiltrosDeBandeja {
  sucursalId?: string;
  modo?: ModoConversacion;
  soloPendientes?: boolean;
  limite?: number;
  desplazamiento?: number;
}

export const conversacionesApi = {
  listar: (filtros: FiltrosDeBandeja = {}) => peticion<PaginaDeBandeja>(RUTA, { query: { ...filtros } }),

  hilo: (id: string, limite = 100) => peticion<HiloDeConversacion>(`${RUTA}/${id}`, { query: { limite } }),

  escaladasPendientes: (sucursalId?: string) =>
    peticion<EscaladasPendientes>(`${RUTA}/escaladas/pendientes`, { query: { sucursalId } }),

  plantillas: () => peticion<CatalogoDePlantillas>(`${RUTA}/plantillas`),

  /** Texto libre. **Solo con la ventana abierta**; el backend responde `409` si no lo está. */
  responder: (id: string, texto: string) =>
    peticion<{ conversacion: Conversacion; wamid: string }>(`${RUTA}/${id}/mensajes`, { metodo: 'POST', cuerpo: { texto } }),

  /** Plantilla aprobada: la única vía con la ventana cerrada, y válida también si está abierta. */
  enviarPlantilla: (id: string, plantilla: string, parametros: string[]) =>
    peticion<{ conversacion: Conversacion; wamid: string }>(`${RUTA}/${id}/plantilla`, {
      metodo: 'POST',
      cuerpo: { plantilla, parametros },
    }),

  /**
   * Tomar la conversación (`bot` → `humano`).
   *
   * La ruta se llama `escalar` y no `modo` porque **el cambio de modo no es simétrico**: entrar
   * exige un motivo y salir no. Un único `PUT /modo` ocultaría esa asimetría y dejaría que alguien
   * mandara `modo: 'humano'` sin motivo, que el `CHECK` de la base rechaza.
   */
  tomar: (id: string, motivo: MotivoDeEscalamiento) =>
    peticion<Conversacion>(`${RUTA}/${id}/escalar`, { metodo: 'POST', cuerpo: { motivo } }),

  /** Devolver al bot (`RN-ESC-03`: **la única salida del modo `humano`**, y es explícita). */
  devolverAlBot: (id: string) => peticion<Conversacion>(`${RUTA}/${id}/devolver-al-bot`, { metodo: 'POST' }),
};
