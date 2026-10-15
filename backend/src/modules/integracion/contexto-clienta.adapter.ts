import { Inject, Injectable } from '@nestjs/common';
import { ContextoClienta, ContextoClientaPort } from '../agenda/domain/ports/contexto-clienta.port';
import { CLIENTA_REPOSITORY, ClientaRepository } from '../crm-y-clientas/domain/ports/clienta.repository';
import { Clienta } from '../crm-y-clientas/domain/entities/clienta.entity';

/**
 * Traduce lo que **Agenda** pregunta a lo que **CRM / Clientas** sabe.
 *
 * SUSTITUYE A `CrmNoConstruidoVerificarClientaAdapter`, el adaptador provisional que aceptaba
 * cualquier uuid. Desde aquí, `clientaId` **existe de verdad** o la reserva falla con 404: es la
 * integridad referencial que `ADR-005` impide pedirle a una clave foránea entre esquemas.
 *
 * Solo cruza la frontera `{ id, estadoDeRiesgo }`. **Ni nombre ni teléfono**, que son PII y que
 * Agenda no necesita para nada: lo único que decide es si reserva y en qué estado nace la cita.
 * Pasar la entidad completa habría metido datos personales en la respuesta de la agenda sin que
 * nadie lo pidiera.
 */
@Injectable()
export class ContextoClientaAdapter implements ContextoClientaPort {
  constructor(@Inject(CLIENTA_REPOSITORY) private readonly clientas: ClientaRepository) {}

  async obtener(clientaId: string): Promise<ContextoClienta | null> {
    const clienta = await this.clientas.buscarPorId(clientaId);
    return clienta ? this.aContexto(clienta) : null;
  }

  async obtenerVarias(clientaIds: string[]): Promise<Map<string, ContextoClienta>> {
    // Una sola consulta: pintar la agenda del día con el indicador de lista roja haría una
    // consulta por cita si esto no existiera.
    const encontradas = await this.clientas.buscarPorIds([...new Set(clientaIds)]);
    return new Map(encontradas.map((clienta) => [clienta.id, this.aContexto(clienta)]));
  }

  private aContexto(clienta: Clienta): ContextoClienta {
    return { id: clienta.id, estadoDeRiesgo: clienta.estadoDeRiesgo };
  }
}
