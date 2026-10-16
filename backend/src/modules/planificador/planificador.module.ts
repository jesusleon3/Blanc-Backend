import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AgendaModule } from '../agenda/agenda.module';
import { ConversacionesModule } from '../conversaciones/conversaciones.module';
import { AnticiposModule } from '../anticipos/anticipos.module';
import { PlanificadorService } from './application/planificador.service';
import { BarridoDeAnticiposUseCase } from './application/barrido-de-anticipos.use-case';
import { PlanificadorController } from './infrastructure/http/planificador.controller';
import { CerrojoDeBarrido } from '../../shared/persistence/advisory-lock';

/**
 * Planificador operativo (`ADR-025`) — los cuatro barridos temporales.
 *
 * ## POR QUÉ ESTE MÓDULO *SÍ* IMPORTA DOS BOUNDED CONTEXTS
 *
 * Parece violar la regla que cerró `P5` (*ningún BC importa a otro*), y no la viola: **el
 * planificador no es un Bounded Context**. Es un **adaptador conductor** —de la misma familia que
 * un controlador HTTP— cuya función es precisamente orquestar. Un controlador puede llamar a los
 * casos de uso de su contexto; este llama a los de varios, porque un barrido temporal no pertenece
 * a ninguno.
 *
 * La distinción frente a `IntegracionModule` es la dirección: aquel aloja adaptadores
 * **conducidos** (un BC pregunta y otro responde, sin que ninguno conozca al otro); este es quien
 * **conduce**, y no introduce ninguna dependencia entre los contextos que invoca. `madge` lo
 * confirma: sigue en 0 ciclos.
 *
 * `ScheduleModule.forRoot()` se registra **aquí y no en `AppModule`**: así el planificador es una
 * pieza que se quita entera quitando este módulo, sin dejar infraestructura de cron huérfana.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    AgendaModule,
    AnticiposModule,
    // Para el quinto barrido, el de retención (`ADR-029`): `PurgarMensajesUseCase` vive en
    // Conversaciones porque los mensajes son suyos. El Planificador solo lo dispara.
    ConversacionesModule,
  ],
  controllers: [PlanificadorController],
  providers: [CerrojoDeBarrido, PlanificadorService, BarridoDeAnticiposUseCase],
  exports: [PlanificadorService],
})
export class PlanificadorModule {}
