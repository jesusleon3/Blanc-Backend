import { Module } from '@nestjs/common';
import { AnticiposController } from './infrastructure/http/anticipos.controller';
import { ANTICIPO_REPOSITORY } from './domain/ports/anticipo.repository';
import { DrizzleAnticipoRepository } from './infrastructure/persistence/drizzle-anticipo.repository';
import {
  ConfirmarPagoAnticipoUseCase,
  ConsultarAnticiposUseCase,
  ExpirarAnticipoUseCase,
  GenerarAnticipoUseCase,
  RetenerAnticipoUseCase,
} from './application/use-cases/anticipos.use-cases';

/**
 * Módulo del Bounded Context **Anticipos** (`ADR-001`, `ADR-002`) — cierre de Fase 3.
 *
 * `TRANSICION_DE_CITA_PORT` **no se provee aquí**: lo provee `IntegracionModule`, porque su
 * adaptador necesita ver Agenda. Este módulo declara el puerto en su dominio y nada más — es la
 * regla que cerró `P5`.
 *
 * Exporta los casos de uso que la integración necesita para construir el adaptador inverso
 * (Agenda → Anticipos).
 */
@Module({
  controllers: [AnticiposController],
  providers: [
    { provide: ANTICIPO_REPOSITORY, useClass: DrizzleAnticipoRepository },
    GenerarAnticipoUseCase,
    ConfirmarPagoAnticipoUseCase,
    ExpirarAnticipoUseCase,
    RetenerAnticipoUseCase,
    ConsultarAnticiposUseCase,
  ],
  exports: [
    ANTICIPO_REPOSITORY,
    GenerarAnticipoUseCase,
    RetenerAnticipoUseCase,
    ConsultarAnticiposUseCase,
    // Lo consume `PlanificadorModule` para el barrido de expiración (`ADR-025`).
    ExpirarAnticipoUseCase,
  ],
})
export class AnticiposModule {}
