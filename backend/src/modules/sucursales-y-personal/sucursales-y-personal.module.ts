import { Module } from '@nestjs/common';
import { SucursalesController } from './infrastructure/http/sucursales.controller';
import { ManicuristasController } from './infrastructure/http/manicuristas.controller';
import { MantenimientoController } from './infrastructure/http/mantenimiento.controller';
import { ExcepcionesPersonalController } from './infrastructure/http/excepciones-personal.controller';
import { SUCURSAL_REPOSITORY } from './domain/ports/sucursal.repository';
import { MANICURISTA_REPOSITORY } from './domain/ports/manicurista.repository';
import { EXCEPCION_PERSONAL_REPOSITORY } from './domain/ports/excepcion-personal.repository';
import { DrizzleExcepcionPersonalRepository } from './infrastructure/persistence/drizzle-excepcion-personal.repository';
import { DrizzleSucursalRepository } from './infrastructure/persistence/drizzle-sucursal.repository';
import { DrizzleManicuristaRepository } from './infrastructure/persistence/drizzle-manicurista.repository';
import { CrearSucursalUseCase } from './application/use-cases/crear-sucursal.use-case';
import { ActualizarConfiguracionSucursalUseCase } from './application/use-cases/actualizar-configuracion-sucursal.use-case';
import { ListarSucursalesUseCase } from './application/use-cases/listar-sucursales.use-case';
import { ConsultarSucursalUseCase } from './application/use-cases/consultar-sucursal.use-case';
import { AgregarDiaFestivoUseCase } from './application/use-cases/agregar-dia-festivo.use-case';
import { EliminarDiaFestivoUseCase } from './application/use-cases/eliminar-dia-festivo.use-case';
import { ActivarModoMantenimientoUseCase } from './application/use-cases/activar-modo-mantenimiento.use-case';
import { DesactivarModoMantenimientoUseCase } from './application/use-cases/desactivar-modo-mantenimiento.use-case';
import { CrearManicuristaUseCase } from './application/use-cases/crear-manicurista.use-case';
import { DesactivarManicuristaUseCase } from './application/use-cases/desactivar-manicurista.use-case';
import { ListarManicuristasUseCase } from './application/use-cases/listar-manicuristas.use-case';
import { AsignarManicuristaASucursalUseCase } from './application/use-cases/asignar-manicurista-a-sucursal.use-case';
import { RemoverManicuristaDeSucursalUseCase } from './application/use-cases/remover-manicurista-de-sucursal.use-case';
import { RegistrarExcepcionPersonalUseCase } from './application/use-cases/registrar-excepcion-personal.use-case';

/**
 * Módulo NestJS del Bounded Context "Sucursales y Personal" (ADR-001, ADR-002) — frontera
 * explícita: expone únicamente sus casos de uso vía HTTP, no expone sus repositorios ni su
 * esquema de persistencia a otros módulos.
 */
@Module({
  controllers: [SucursalesController, ManicuristasController, MantenimientoController, ExcepcionesPersonalController],
  providers: [
    { provide: SUCURSAL_REPOSITORY, useClass: DrizzleSucursalRepository },
    { provide: MANICURISTA_REPOSITORY, useClass: DrizzleManicuristaRepository },
    { provide: EXCEPCION_PERSONAL_REPOSITORY, useClass: DrizzleExcepcionPersonalRepository },
    CrearSucursalUseCase,
    ActualizarConfiguracionSucursalUseCase,
    ListarSucursalesUseCase,
    ConsultarSucursalUseCase,
    AgregarDiaFestivoUseCase,
    EliminarDiaFestivoUseCase,
    ActivarModoMantenimientoUseCase,
    DesactivarModoMantenimientoUseCase,
    CrearManicuristaUseCase,
    DesactivarManicuristaUseCase,
    ListarManicuristasUseCase,
    AsignarManicuristaASucursalUseCase,
    RemoverManicuristaDeSucursalUseCase,
    RegistrarExcepcionPersonalUseCase,
  ],
  // Los exporta para que `IntegracionModule` pueda construir los adaptadores entre contextos.
  exports: [MANICURISTA_REPOSITORY, SUCURSAL_REPOSITORY, EXCEPCION_PERSONAL_REPOSITORY],
})
export class SucursalesYPersonalModule {}
