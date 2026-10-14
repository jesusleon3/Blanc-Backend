import { Injectable, Logger } from '@nestjs/common';
import { VerificarClientaPort } from '../agenda/domain/ports/verificar-clienta.port';

/**
 * ⚠️ **ADAPTADOR PROVISIONAL QUE NO VALIDA NADA.** Acepta cualquier uuid como clienta existente.
 *
 * POR QUÉ EXISTE Y POR QUÉ SE LLAMA ASÍ. El Bounded Context de Clientas/CRM es de Fase 3. Sin
 * este adaptador, `VerificarClientaPort` no se podría inyectar y la costura no sería real — y una
 * costura que no se ejercita no se sabe si encaja. Con él, `AgendarCitaUseCase` ya llama al puerto
 * en producción, así que el día que exista CRM **solo cambia el proveedor en este módulo**.
 *
 * El nombre dice lo que hace a propósito. El precedente de este proyecto es
 * `SinAgendaVerificarCitasFuturasAdapter`, que respondía siempre `false` y durante un tiempo
 * **pareció** proteger la baja de manicuristas sin proteger nada. La lección no fue "no usar
 * adaptadores provisionales": fue que tienen que ser imposibles de confundir con el definitivo.
 *
 * Emite un aviso en el log la primera vez, para que no pase inadvertido en un arranque real.
 */
@Injectable()
export class CrmNoConstruidoVerificarClientaAdapter implements VerificarClientaPort {
  private static yaAdvirtio = false;
  private readonly logger = new Logger(CrmNoConstruidoVerificarClientaAdapter.name);

  async existe(_clientaId: string): Promise<boolean> {
    if (!CrmNoConstruidoVerificarClientaAdapter.yaAdvirtio) {
      CrmNoConstruidoVerificarClientaAdapter.yaAdvirtio = true;
      this.logger.warn(
        'La existencia de la clienta NO se está validando: el Bounded Context de Clientas/CRM es de Fase 3. ' +
          'Cualquier uuid con formato válido se acepta.',
      );
    }
    // Sin id no hay ni formato válido: es lo único que este adaptador puede afirmar con honestidad.
    return _clientaId.length > 0;
  }
}
