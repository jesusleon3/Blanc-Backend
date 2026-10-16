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
import { ConsultarDisponibilidadUseCase } from './application/use-cases/consultar-disponibilidad.use-case';
import { ConsultarAgendaUseCase } from './application/use-cases/consultar-agenda.use-case';
import { GestionarSillasUseCase } from './application/use-cases/gestionar-sillas.use-case';
import { CitasController } from './infrastructure/http/citas.controller';
import { ListaEsperaController } from './infrastructure/http/lista-espera.controller';
import { LISTA_ESPERA_REPOSITORY } from './domain/ports/lista-espera.repository';
import { DrizzleListaEsperaRepository } from './infrastructure/persistence/drizzle-lista-espera.repository';
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
    /**
     * `NOTIFICADOR_RECORDATORIO_PORT` y `NOTIFICACION_LISTA_ESPERA_PORT` **NO se proveen aquí**:
     * los provee `IntegracionModule`, porque su adaptador necesita ver Conversaciones.
     *
     * ## ESTO FUE UN DEFECTO REAL, NO UNA PREFERENCIA DE ESTILO
     *
     * Hasta el cierre de Fase 4 este módulo proveía aquí los adaptadores de solo-log, y
     * `IntegracionModule` —que es `@Global`— pretendía sobrescribirlos con el que manda plantillas
     * de WhatsApp. **No funcionaba.** `@Global` solo hace que las exportaciones de un módulo estén
     * disponibles sin importarlo; **un proveedor local siempre gana sobre uno global**, así que
     * los casos de uso de este módulo seguían recibiendo el adaptador que no envía nada. Durante
     * la Parte 2 el canal de WhatsApp quedó construido y conectado, y ni un recordatorio ni una
     * oferta de hueco salieron nunca por él, con todas las pruebas en verde.
     *
     * La regla, ya sin excepciones: **si otro módulo tiene que proveer un puerto, este no declara
     * un valor por defecto para él.** Es la misma regla que cerró `P5`, y la vigila
     * `src/modules/integracion/sin-defaults-locales.spec.ts`.
     */
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
    // Los consume `AgenteModule` (Bot IA): son las herramientas con las que el bot obtiene
    // disponibilidad real y agenda citas reales. Exportar el caso de uso —y no un atajo al
    // repositorio— es lo que mantiene `RN-CONV-01` como propiedad estructural: el bot pasa por las
    // mismas validaciones que la Encargada.
    LISTA_ESPERA_REPOSITORY,
    ConsultarDisponibilidadUseCase,
    AgendarCitaUseCase,
    ConfirmarCitaUseCase,
    InscribirEnListaEsperaUseCase,
    AceptarOfertaListaEsperaUseCase,
  ],
})
export class AgendaModule {}
