import { Module } from '@nestjs/common';
import { SILLA_REPOSITORY } from './domain/ports/silla.repository';
import { CITA_REPOSITORY } from './domain/ports/cita.repository';
import { DrizzleSillaRepository } from './infrastructure/persistence/drizzle-silla.repository';
import { DrizzleCitaRepository } from './infrastructure/persistence/drizzle-cita.repository';
import { AgendarCitaUseCase } from './application/use-cases/agendar-cita.use-case';
import { AsignarManicuristaEnSucursalUseCase } from './application/use-cases/asignar-manicurista-en-sucursal.use-case';

/**
 * Módulo del Bounded Context **Agenda** (`ADR-001`, `ADR-002`) — kick-off de Fase 2.
 *
 * **Sin controladores todavía** y sin `MotorDisponibilidad`. Incluye los dos primeros casos de
 * uso: reservar una cita sobre una Silla Virtual y asignar manicurista en mostrador. Se registra
 * en `AppModule` para que el contenedor valide el cableado en el arranque.
 *
 * **Exporta los puertos** porque *Sucursales y Personal* los necesitará para implementar
 * `VerificarCitasFuturasPort` (`DEC-032`), hoy cubierto por un sustituto temporal. Ese es el
 * primer consumidor previsto.
 */
@Module({
  providers: [
    { provide: SILLA_REPOSITORY, useClass: DrizzleSillaRepository },
    { provide: CITA_REPOSITORY, useClass: DrizzleCitaRepository },
    AgendarCitaUseCase,
    AsignarManicuristaEnSucursalUseCase,
  ],
  exports: [SILLA_REPOSITORY, CITA_REPOSITORY],
})
export class AgendaModule {}
