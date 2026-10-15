import { Module } from '@nestjs/common';
import { ClientasController } from './infrastructure/http/clientas.controller';
import { CLIENTA_REPOSITORY } from './domain/ports/clienta.repository';
import { DrizzleClientaRepository } from './infrastructure/persistence/drizzle-clienta.repository';
import {
  BuscarClientaPorTelefonoAnteriorUseCase,
  BuscarClientasPorTelefonoUseCase,
  CambiarEstadoDeRiesgoUseCase,
  CambiarTelefonoClientaUseCase,
  ConsultarClientaUseCase,
  RegistrarCancelacionOrdinariaUseCase,
  RegistrarClientaUseCase,
  RegistrarIncidenteClientaUseCase,
} from './application/use-cases/clientas.use-cases';

/**
 * Módulo del Bounded Context **CRM / Clientas** (`ADR-001`, `ADR-002`) — kick-off de Fase 3.
 *
 * Exporta los dos casos de uso que `IntegracionModule` necesita para construir los adaptadores
 * hacia Agenda, y el repositorio para el adaptador de contexto. **Agenda no importa este módulo**:
 * el adaptador vive en la integración (`ADR-005`, sin ciclos).
 */
@Module({
  controllers: [ClientasController],
  providers: [
    { provide: CLIENTA_REPOSITORY, useClass: DrizzleClientaRepository },
    RegistrarClientaUseCase,
    BuscarClientasPorTelefonoUseCase,
    BuscarClientaPorTelefonoAnteriorUseCase,
    ConsultarClientaUseCase,
    CambiarTelefonoClientaUseCase,
    CambiarEstadoDeRiesgoUseCase,
    RegistrarIncidenteClientaUseCase,
    RegistrarCancelacionOrdinariaUseCase,
  ],
  exports: [CLIENTA_REPOSITORY, RegistrarIncidenteClientaUseCase, RegistrarCancelacionOrdinariaUseCase],
})
export class CrmYClientasModule {}
