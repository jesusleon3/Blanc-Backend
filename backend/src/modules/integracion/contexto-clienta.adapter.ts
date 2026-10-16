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
 * Por la frontera cruza `{ id, estadoDeRiesgo }` **y nada más** para decidir reservas: lo único
 * que Agenda decide es si reserva y en qué estado nace la cita. Pasar la entidad completa habría
 * metido datos personales en la respuesta de la agenda sin que nadie lo pidiera.
 *
 * `obtenerNombres` es la **única** vía por la que el nombre cruza, y devuelve un
 * `Map<string, string>` donde no cabe nada más — ni teléfono, ni estado de riesgo. Ver la nota
 * extensa del puerto: esa forma es lo que permite resolver nombres para la vista de iPad **sin**
 * traer el estado de riesgo a su petición.
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

  async obtenerNombres(clientaIds: string[]): Promise<Map<string, string>> {
    if (clientaIds.length === 0) return new Map();

    const encontradas = await this.clientas.buscarPorIds([...new Set(clientaIds)]);
    // Solo el nombre. El teléfono y el estado de riesgo se quedan aquí, en CRM.
    return new Map(encontradas.map((clienta) => [clienta.id, clienta.nombre]));
  }

  private aContexto(clienta: Clienta): ContextoClienta {
    return { id: clienta.id, estadoDeRiesgo: clienta.estadoDeRiesgo };
  }
}
