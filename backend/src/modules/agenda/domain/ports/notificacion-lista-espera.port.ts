import { SolicitudListaEspera } from '../entities/solicitud-lista-espera.entity';

export const NOTIFICACION_LISTA_ESPERA_PORT = 'NOTIFICACION_LISTA_ESPERA_PORT';

export interface HuecoOfrecido {
  inicio: Date;
  fin: Date;
}

/**
 * Puerto de **salida** para avisar a la clienta de que se liberó un hueco (`DEC-039`).
 *
 * POR QUÉ ES UN PUERTO Y NO UNA LLAMADA DIRECTA. El aviso viaja por WhatsApp, y el canal es de
 * Fase 4 (`DEC-043`, Cloud API, pendiente del trámite con Meta). Con el puerto, toda la lógica de
 * la fila —FIFO, encaje del servicio en el hueco, ventana, expiración— se construye y se prueba
 * **hoy y completa**, y en Fase 4 solo se sustituye el adaptador.
 *
 * ⚠️ **HOY NO SALE NINGÚN MENSAJE.** El adaptador registra en el log y nada más, así que la
 * Encargada tiene que avisar a mano mirando la fila. Está dicho en el nombre de la clase
 * (`ListaEsperaSoloLogAdapter`) para que no se confunda con el definitivo — misma lección que
 * `SinAgendaVerificarCitasFuturasAdapter`, que durante un tiempo pareció proteger algo.
 *
 * **Se invoca FUERA de la transacción**, nunca dentro: enviar un mensaje es una llamada de red, y
 * una transacción abierta esperando a un tercero mantiene bloqueos sobre la agenda. Además un
 * envío no se puede deshacer con un `ROLLBACK`: si la transacción fallara después, la clienta ya
 * tendría el aviso de un hueco que no se le reservó.
 */
export interface NotificacionListaEsperaPort {
  ofertaDeHueco(solicitud: SolicitudListaEspera, hueco: HuecoOfrecido): Promise<void>;
}
