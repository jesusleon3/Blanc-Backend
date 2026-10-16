import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './shared/auth/auth.module';
import { AuditoriaModule } from './shared/auditoria/auditoria.module';
import { SucursalesYPersonalModule } from './modules/sucursales-y-personal/sucursales-y-personal.module';
import { IdentidadYAccesosModule } from './modules/identidad-y-accesos/identidad-y-accesos.module';
import { CatalogoYCotizacionModule } from './modules/catalogo-y-cotizacion/catalogo-y-cotizacion.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { CrmYClientasModule } from './modules/crm-y-clientas/crm-y-clientas.module';
import { AnticiposModule } from './modules/anticipos/anticipos.module';
import { IntegracionModule } from './modules/integracion/integracion.module';
import { ConversacionesModule } from './modules/conversaciones/conversaciones.module';
import { PlanificadorModule } from './modules/planificador/planificador.module';
import { AgenteModule } from './modules/agente/agente.module';
import { HealthController } from './shared/health/health.controller';

/**
 * Modular Monolith (ADR-001) — un solo desplegable, módulos con frontera estricta.
 * Cableados hasta ahora: `SucursalesYPersonalModule`, `IdentidadYAccesosModule` (alcance mínimo
 * FL-SEG-01/03), `CatalogoYCotizacionModule` (FL-COT-01), `AgendaModule` (Fase 2, con API HTTP),
 * `CrmYClientasModule` y `AnticiposModule` (Fase 3) e `IntegracionModule` (dependencias entre BC) `ConversacionesModule` (Fase 4), `PlanificadorModule` (`ADR-025`) y `AgenteModule` (Bot IA) — arranque parcial controlado,
 * IMPLEMENTATION_MASTER_PLAN.md, Enmienda 2026-08-04.
 *
 * `app.module.spec.ts` comprueba que este grafo resuelve de verdad: el build no lo garantiza.
 */
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AuditoriaModule,
    SucursalesYPersonalModule,
    IdentidadYAccesosModule,
    CatalogoYCotizacionModule,
    AgendaModule,
    CrmYClientasModule,
    AnticiposModule,
    ConversacionesModule,
    IntegracionModule,
    PlanificadorModule,
    // **Después de `ConversacionesModule` a propósito**: `AgenteModule` es `@Global` y sobrescribe
    // `ORQUESTADOR_DE_BOT_PORT`, que allí apunta al adaptador inactivo. Quitar esta línea apaga el
    // bot y deja el canal atendido solo por personas — el rollback completo es esta línea.
    AgenteModule,
  ],
  // `HealthController` se declara aquí, no en un módulo propio: no tiene providers, no tiene
  // dependencias y no pertenece a ningún Bounded Context — es infraestructura de despliegue.
  controllers: [HealthController],
})
export class AppModule {}
