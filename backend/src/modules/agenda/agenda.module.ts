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
import { MotorDisponibilidad } from './domain/services/motor-disponibilidad';
import { ResolutorDeServicio } from './domain/services/resolutor-de-servicio';
import { TransicionarCitaPorAnticipoUseCase } from './application/use-cases/transicionar-cita-por-anticipo.use-case';
import { CerrarCitasTerminadasUseCase, SolicitarRecordatoriosUseCase } from './application/use-cases/barridos-de-agenda.use-cases';
import { NOTIFICADOR_RECORDATORIO_PORT } from './domain/ports/notificador-recordatorio.port';
import { RecordatorioSoloLogAdapter } from './infrastructure/notificacion/recordatorio-solo-log.adapter';
import { ConsultarDisponibilidadUseCase } from './application/use-cases/consultar-disponibilidad.use-case';
import { ConsultarAgendaUseCase } from './application/use-cases/consultar-agenda.use-case';
import { GestionarSillasUseCase } from './application/use-cases/gestionar-sillas.use-case';
import { CitasController } from './infrastructure/http/citas.controller';
import { ListaEsperaController } from './infrastructure/http/lista-espera.controller';
import { LISTA_ESPERA_REPOSITORY } from './domain/ports/lista-espera.repository';
import { DrizzleListaEsperaRepository } from './infrastructure/persistence/drizzle-lista-espera.repository';
import { NOTIFICACION_LISTA_ESPERA_PORT } from './domain/ports/notificacion-lista-espera.port';
import { ListaEsperaSoloLogAdapter } from './infrastructure/notificacion/lista-espera-solo-log.adapter';
import {
  AceptarOfertaListaEsperaUseCase,
  AvanzarTurnoListaEsperaUseCase,
  CancelarSolicitudListaEsperaUseCase,
  ConsultarListaEsperaUseCase,
  InscribirEnListaEsperaUseCase,
  ProcesarListaEsperaUseCase,
} from './application/use-cases/lista-espera.use-cases';
import { SillasController } from './infrastructure/http/sillas.controller';

/**
 * Módulo del Bounded Context **Agenda** (`ADR-001`, `ADR-002`) — kick-off de Fase 2.
 *
 * Incluye la reserva sobre Silla Virtual, la asignación en mostrador, el ciclo de vida completo de
 * la cita (`P3` cerrado), el `MotorDisponibilidad` (`DEC-035`) y la API HTTP.
 *
 * **Exporta los puertos** porque *Sucursales y Personal* los necesitará para implementar
 * `VerificarCitasFuturasPort` (`DEC-032`), hoy cubierto por un sustituto temporal. Ese es el
 * primer consumidor previsto.
 */
@Module({
  controllers: [CitasController, SillasController, ListaEsperaController],
  providers: [
    { provide: SILLA_REPOSITORY, useClass: DrizzleSillaRepository },
    { provide: CITA_REPOSITORY, useClass: DrizzleCitaRepository },
    { provide: LISTA_ESPERA_REPOSITORY, useClass: DrizzleListaEsperaRepository },
    // Provisional y a la vista: NO envía mensajes. Fase 4 sustituye solo este proveedor.
    { provide: NOTIFICACION_LISTA_ESPERA_PORT, useClass: ListaEsperaSoloLogAdapter },
    // Provisional y a la vista: NO envía mensajes. Fase 4 Parte 2 sustituye solo este proveedor.
    { provide: NOTIFICADOR_RECORDATORIO_PORT, useClass: RecordatorioSoloLogAdapter },
    AgendarCitaUseCase,
    AsignarManicuristaEnSucursalUseCase,
    SolicitarConfirmacionCitaUseCase,
    ConfirmarCitaUseCase,
    CancelarCitaUseCase,
    ReprogramarCitaUseCase,
    MarcarNoShowUseCase,
    CompletarCitaUseCase,
    MotorDisponibilidad,
    ResolutorDeServicio,
    ConsultarDisponibilidadUseCase,
    ConsultarAgendaUseCase,
    GestionarSillasUseCase,
    InscribirEnListaEsperaUseCase,
    ProcesarListaEsperaUseCase,
    AvanzarTurnoListaEsperaUseCase,
    AceptarOfertaListaEsperaUseCase,
    CancelarSolicitudListaEsperaUseCase,
    ConsultarListaEsperaUseCase,
    TransicionarCitaPorAnticipoUseCase,
    CerrarCitasTerminadasUseCase,
    SolicitarRecordatoriosUseCase,
  ],
  exports: [
    SILLA_REPOSITORY,
    CITA_REPOSITORY,
    MotorDisponibilidad,
    TransicionarCitaPorAnticipoUseCase,
    // Los consume `PlanificadorModule`, que es un adaptador conductor y no un Bounded Context.
    AvanzarTurnoListaEsperaUseCase,
    CerrarCitasTerminadasUseCase,
    SolicitarRecordatoriosUseCase,
  ],
})
export class AgendaModule {}
