import { Module } from '@nestjs/common';
import { SILLA_REPOSITORY } from './domain/ports/silla.repository';
import { CITA_REPOSITORY } from './domain/ports/cita.repository';
import { DrizzleSillaRepository } from './infrastructure/persistence/drizzle-silla.repository';
import { DrizzleCitaRepository } from './infrastructure/persistence/drizzle-cita.repository';

/**
 * Módulo del Bounded Context **Agenda** (`ADR-001`, `ADR-002`) — kick-off de Fase 2.
 *
 * **Solo capa de datos.** Sin casos de uso, sin controladores, sin `MotorDisponibilidad`. Se
 * registra en `AppModule` para que el contenedor valide el cableado en el arranque, en vez de
 * descubrir un proveedor faltante cuando lleguen los casos de uso.
 *
 * **Exporta los puertos** porque *Sucursales y Personal* los necesitará para implementar
 * `VerificarCitasFuturasPort` (`DEC-032`), hoy cubierto por un sustituto temporal. Ese es el
 * primer consumidor previsto.
 */
@Module({
  providers: [
    { provide: SILLA_REPOSITORY, useClass: DrizzleSillaRepository },
    { provide: CITA_REPOSITORY, useClass: DrizzleCitaRepository },
  ],
  exports: [SILLA_REPOSITORY, CITA_REPOSITORY],
})
export class AgendaModule {}
