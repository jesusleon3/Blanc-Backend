import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './shared/auth/auth.module';
import { AuditoriaModule } from './shared/auditoria/auditoria.module';
import { SucursalesYPersonalModule } from './modules/sucursales-y-personal/sucursales-y-personal.module';
import { IdentidadYAccesosModule } from './modules/identidad-y-accesos/identidad-y-accesos.module';
import { CatalogoYCotizacionModule } from './modules/catalogo-y-cotizacion/catalogo-y-cotizacion.module';
import { HealthController } from './shared/health/health.controller';

/**
 * Modular Monolith (ADR-001) — un solo desplegable, módulos con frontera estricta.
 * `SucursalesYPersonalModule`, `IdentidadYAccesosModule` (alcance mínimo FL-SEG-01/03) y
 * `CatalogoYCotizacionModule` (FL-COT-01, alta y listado de catálogo) están cableados hasta ahora
 * (arranque parcial controlado, IMPLEMENTATION_MASTER_PLAN.md, Enmienda 2026-08-04).
 */
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AuditoriaModule,
    SucursalesYPersonalModule,
    IdentidadYAccesosModule,
    CatalogoYCotizacionModule,
  ],
  // `HealthController` se declara aquí, no en un módulo propio: no tiene providers, no tiene
  // dependencias y no pertenece a ningún Bounded Context — es infraestructura de despliegue.
  controllers: [HealthController],
})
export class AppModule {}
