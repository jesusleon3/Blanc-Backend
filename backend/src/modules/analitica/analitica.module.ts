import { Module } from '@nestjs/common';
import { AgendaModule } from '../agenda/agenda.module';
import { AnticiposModule } from '../anticipos/anticipos.module';
import { ConversacionesModule } from '../conversaciones/conversaciones.module';
import { ResumenAnaliticoUseCase } from './application/resumen-analitico.use-case';
import { AnaliticaController } from './infrastructure/http/analitica.controller';

/**
 * Módulo de **Analítica y Reportes** (Fase 6).
 *
 * ## ADAPTADOR CONDUCTOR, NO UN BOUNDED CONTEXT
 *
 * Igual que `PlanificadorModule` y `AgenteModule`: **no tiene dominio propio, ni entidades, ni
 * esquema, ni una sola consulta SQL**. Lo que hace es preguntar a los tres Bounded Contexts que
 * tienen los datos y combinar las respuestas en memoria.
 *
 * Esa es la respuesta a cómo se cruzan los datos sin romper `ADR-005`: **no se cruzan en SQL.**
 * Cada contexto agrega su propio esquema con su propio caso de uso, y aquí se compone. Un módulo
 * de analítica con SQL propio sobre `agenda` + `anticipos` + `conversaciones` sería el `JOIN` entre
 * esquemas que la decisión prohíbe, y rompería el día que uno de esos contextos se extraiga.
 *
 * Importa los módulos de los BC y **ninguno lo importa a él**, así que `madge --circular` sigue
 * en 0 sin necesidad de puertos ni de `IntegracionModule`: la dirección de la dependencia es la
 * permitida.
 */
@Module({
  imports: [AgendaModule, AnticiposModule, ConversacionesModule],
  controllers: [AnaliticaController],
  providers: [ResumenAnaliticoUseCase],
})
export class AnaliticaModule {}
