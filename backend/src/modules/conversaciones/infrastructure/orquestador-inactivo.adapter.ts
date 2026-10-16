import { Injectable } from '@nestjs/common';
import { OrquestadorDeBotPort, ResultadoDelTurno } from '../domain/ports/orquestador-de-bot.port';

/**
 * Adaptador inerte: **no hay bot**. No responde y no escala.
 *
 * Es el valor por defecto de `ConversacionesModule`, y no es un placeholder: es el estado en el
 * que estuvo el sistema durante toda la Parte 2 —canal, bandeja y handoff funcionando sin agente—
 * y el estado al que conviene poder volver quitando `AgenteModule` de `AppModule` si el bot se
 * comporta mal en producción. Que esa vuelta atrás sea quitar un módulo, y no revertir código, es
 * la razón de que el puerto exista.
 *
 * `AgenteModule` es `@Global()` y se registra después, así que su proveedor gana.
 */
@Injectable()
export class OrquestadorInactivoAdapter implements OrquestadorDeBotPort {
  async atenderTurno(): Promise<ResultadoDelTurno> {
    return { respondio: false, escalo: false };
  }
}
