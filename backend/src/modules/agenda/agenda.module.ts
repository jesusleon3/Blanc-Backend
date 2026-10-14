import { Module } from '@nestjs/common';
import { SILLA_REPOSITORY } from './domain/ports/silla.repository';
import { CITA_REPOSITORY } from './domain/ports/cita.repository';
import { DrizzleSillaRepository } from './infrastructure/persistence/drizzle-silla.repository';
import { DrizzleCitaRepository } from './infrastructure/persistence/drizzle-cita.repository';
import { AgendarCitaUseCase } from './application/use-cases/agendar-cita.use-case';
import { AsignarManicuristaEnSucursalUseCase } from './application/use-cases/asignar-manicurista-en-sucursal.use-case';
import { SolicitarConfirmacionCitaUseCase } from './application/use-cases/solicitar-confirmacion-cita.use-case';
import { ConfirmarCitaUseCase } from './application/use-cases/confirmar-cita.use-case';
import { CancelarCitaUseCase } from './application/use-cases/cancelar-cita.use-case';
import { ReprogramarCitaUseCase } from './application/use-cases/reprogramar-cita.use-case';
import { MarcarNoShowUseCase } from './application/use-cases/marcar-no-show.use-case';
import { CompletarCitaUseCase } from './application/use-cases/completar-cita.use-case';

/**
 * Módulo del Bounded Context **Agenda** (`ADR-001`, `ADR-002`) — kick-off de Fase 2.
 *
 * **Sin controladores todavía** y sin `MotorDisponibilidad`. Incluye la reserva sobre Silla Virtual, la
 * asignación en mostrador y el ciclo de vida completo de la cita (`P3` cerrado). Se registra
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
    SolicitarConfirmacionCitaUseCase,
    ConfirmarCitaUseCase,
    CancelarCitaUseCase,
    ReprogramarCitaUseCase,
    MarcarNoShowUseCase,
    CompletarCitaUseCase,
  ],
  exports: [SILLA_REPOSITORY, CITA_REPOSITORY],
})
export class AgendaModule {}
