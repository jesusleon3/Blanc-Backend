import { Module } from '@nestjs/common';
import { ServiciosController } from './infrastructure/http/servicios.controller';
import { ModificadoresDisenoController } from './infrastructure/http/modificadores-diseno.controller';
import { SERVICIO_REPOSITORY } from './domain/ports/servicio.repository';
import { MODIFICADOR_DISENO_REPOSITORY } from './domain/ports/modificador-diseno.repository';
import { DrizzleServicioRepository } from './infrastructure/persistence/drizzle-servicio.repository';
import { DrizzleModificadorDisenoRepository } from './infrastructure/persistence/drizzle-modificador-diseno.repository';
import { CrearServicioUseCase } from './application/use-cases/crear-servicio.use-case';
import { ObtenerServiciosUseCase } from './application/use-cases/obtener-servicios.use-case';
import { CrearModificadorDisenoUseCase } from './application/use-cases/crear-modificador-diseno.use-case';
import { ObtenerModificadoresDisenoUseCase } from './application/use-cases/obtener-modificadores-diseno.use-case';
import { ActualizarServicioUseCase } from './application/use-cases/actualizar-servicio.use-case';
import { DesactivarServicioUseCase } from './application/use-cases/desactivar-servicio.use-case';
import { ActualizarModificadorDisenoUseCase } from './application/use-cases/actualizar-modificador-diseno.use-case';
import { DesactivarModificadorDisenoUseCase } from './application/use-cases/desactivar-modificador-diseno.use-case';
import { VincularModificadorAServicioUseCase } from './application/use-cases/vincular-modificador-a-servicio.use-case';
import { DesvincularModificadorDeServicioUseCase } from './application/use-cases/desvincular-modificador-de-servicio.use-case';
import { ObtenerModificadoresDeServicioUseCase } from './application/use-cases/obtener-modificadores-de-servicio.use-case';

/**
 * Módulo NestJS del Bounded Context "Catálogo y Cotización" (ADR-001, ADR-002).
 *
 * Superficie HTTP: alta, listado, edición y baja lógica de servicios y modificadores de diseño
 * (`FL-COT-01` completo). El borrado físico no existe a propósito — ver `DesactivarServicioUseCase`.
 * Incluye la relación N:M `servicio_modificadores_aplicables` (vincular/desvincular/consultar).
 * Queda fuera únicamente el motor de cálculo (`FL-COT-02`/`FL-COT-03`).
 *
 * No exporta nada: ningún otro módulo consume el catálogo por ahora. Cuando Agenda lo necesite,
 * será vía casos de uso explícitos, nunca vía los repositorios (frontera del BC).
 */
@Module({
  controllers: [ServiciosController, ModificadoresDisenoController],
  providers: [
    { provide: SERVICIO_REPOSITORY, useClass: DrizzleServicioRepository },
    { provide: MODIFICADOR_DISENO_REPOSITORY, useClass: DrizzleModificadorDisenoRepository },
    CrearServicioUseCase,
    ObtenerServiciosUseCase,
    ActualizarServicioUseCase,
    DesactivarServicioUseCase,
    CrearModificadorDisenoUseCase,
    ObtenerModificadoresDisenoUseCase,
    ActualizarModificadorDisenoUseCase,
    DesactivarModificadorDisenoUseCase,
    VincularModificadorAServicioUseCase,
    DesvincularModificadorDeServicioUseCase,
    ObtenerModificadoresDeServicioUseCase,
  ],
})
export class CatalogoYCotizacionModule {}
