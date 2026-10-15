import { Cita } from '../entities/cita.entity';

export const NOTIFICADOR_RECORDATORIO_PORT = 'NOTIFICADOR_RECORDATORIO_PORT';

/**
 * Puerto de **salida** para el recordatorio de 24 h (`RN-NOT-02`, `RN-CONV-11`).
 *
 * ⚠️ **HOY NO SALE NINGÚN MENSAJE.** El canal es la Cloud API de Meta (`DEC-043`, Fase 4 Parte 2)
 * y todavía no existe; el adaptador actual solo deja constancia en el log. Está en el nombre de la
 * clase (`RecordatorioSoloLogAdapter`) a propósito, por la misma lección que
 * `SinAgendaVerificarCitasFuturasAdapter` y `ListaEsperaSoloLogAdapter`: un adaptador provisional
 * tiene que ser imposible de confundir con el definitivo.
 *
 * **La cita ya pasó a `pendiente_confirmacion` cuando esto se invoca.** El orden importa: la
 * transición ocurre dentro de la transacción y el envío **fuera**, porque un mensaje enviado no se
 * deshace con un `ROLLBACK`. Si el envío falla, la cita se queda en `pendiente_confirmacion` y el
 * barrido no la volverá a recoger — es el lado seguro del error: `RN-CONV-11` dice que la
 * confirmación requiere respuesta, y repetir el aviso cada cinco minutos sería peor que no
 * haberlo enviado.
 */
export interface NotificadorRecordatorioPort {
  recordatorioDeCita(cita: Cita): Promise<void>;
}
