import { Inject, Injectable } from '@nestjs/common';
import {
  ClientaDeConversacion,
  ContextoClientaDeConversacionPort,
} from '../conversaciones/domain/ports/contexto-clienta-de-conversacion.port';
import { CLIENTA_REPOSITORY, ClientaRepository } from '../crm-y-clientas/domain/ports/clienta.repository';

/**
 * Lo que **Conversaciones pregunta a CRM**: quién escribe desde este teléfono.
 *
 * Devuelve **una lista**, porque un teléfono puede corresponder a dos clientas (mamá e hija,
 * `RN-CRM-01` corregido en Fase 3). Quien decide a cuál se refiere el mensaje es quien atiende, no
 * este adaptador.
 *
 * Solo cruza `{ id, estadoDeRiesgo }`: **ni nombre ni teléfono**. El teléfono ya lo tiene quien
 * pregunta, y el nombre no lo necesita para decidir si el bot debe callarse.
 */
@Injectable()
export class ContextoClientaDeConversacionAdapter implements ContextoClientaDeConversacionPort {
  constructor(@Inject(CLIENTA_REPOSITORY) private readonly clientas: ClientaRepository) {}

  async buscarPorTelefono(telefono: string): Promise<ClientaDeConversacion[]> {
    const encontradas = await this.clientas.buscarPorTelefono(telefono);
    return encontradas.map((clienta) => ({ id: clienta.id, estadoDeRiesgo: clienta.estadoDeRiesgo }));
  }
}
