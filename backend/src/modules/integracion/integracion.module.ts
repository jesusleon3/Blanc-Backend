import { Global, Module } from '@nestjs/common';
import { AgendaModule } from '../agenda/agenda.module';
import { SucursalesYPersonalModule } from '../sucursales-y-personal/sucursales-y-personal.module';
import { CONTEXTO_PERSONAL_PORT } from '../agenda/domain/ports/contexto-personal.port';
import { VERIFICAR_CITAS_FUTURAS_PORT } from '../sucursales-y-personal/domain/ports/verificar-citas-futuras.port';
import { ContextoPersonalAdapter } from './contexto-personal.adapter';
import { AgendaVerificarCitasFuturasAdapter } from './agenda-verificar-citas-futuras.adapter';
import { CONSULTA_AGENDA_PORT } from '../sucursales-y-personal/domain/ports/consulta-agenda.port';
import { ConsultaAgendaAdapter } from './consulta-agenda.adapter';
import { CatalogoYCotizacionModule } from '../catalogo-y-cotizacion/catalogo-y-cotizacion.module';
import { CONTEXTO_CATALOGO_PORT } from '../agenda/domain/ports/contexto-catalogo.port';
import { ContextoCatalogoAdapter } from './contexto-catalogo.adapter';
import { CrmYClientasModule } from '../crm-y-clientas/crm-y-clientas.module';
import { CONTEXTO_CLIENTA_PORT } from '../agenda/domain/ports/contexto-clienta.port';
import { ContextoClientaAdapter } from './contexto-clienta.adapter';
import { REGISTRO_DE_INCIDENTES_PORT } from '../agenda/domain/ports/registro-de-incidentes.port';
import { RegistroDeIncidentesAdapter } from './registro-de-incidentes.adapter';

/**
 * Punto único donde se cablean las dependencias **entre Bounded Contexts**.
 *
 * POR QUÉ EXISTE. Agenda y Sucursales y Personal se necesitan **en los dos sentidos**:
 *
 * - Personal necesita saber si una manicurista tiene **citas futuras** antes de darla de baja
 *   (`DEC-032`).
 * - Agenda necesita saber qué manicuristas están **operativas** para calcular capacidad
 *   (`DEC-035`/`DEC-036`).
 * - Agenda necesita saber si un **servicio** existe, está activo y cuánto dura, para no reservar
 *   un hueco del tamaño equivocado ni de un servicio dado de baja. Este sentido es de una sola
 *   dirección (Catálogo no pregunta nada a Agenda), pero el adaptador vive aquí igualmente: la
 *   regla es que ningún BC importe a otro, no que solo se aplique cuando hay ciclo.
 * - Agenda y **CRM / Clientas** se necesitan **en los dos sentidos**, igual que Personal:
 *   Agenda pregunta el estado de riesgo de la clienta antes de reservar (`RN-CRM-04`,
 *   `RN-ANT-01`), y le **empuja** los incidentes tardíos y los no-show (`RN-CRM-06`). Es el mismo
 *   ciclo potencial, resuelto con el mismo patrón — ver `P5` en `ARCHITECTURE_CLOSURE_PLAN.md`.
 *
 * Si cada módulo importara al otro habría un **ciclo de módulos**, que `madge` marcaría y que
 * NestJS solo resolvería con `forwardRef` — una solución que no quita el ciclo, lo esconde.
 *
 * Aquí **ninguno de los dos importa al otro**: cada uno declara el puerto que necesita y este
 * módulo provee ambos adaptadores. Es `@Global()` para que las implementaciones lleguen a los dos
 * sin que ellos tengan que importarlo — mismo mecanismo que ya usa `DatabaseModule`.
 *
 * REGLA PARA QUIEN AÑADA UNA DEPENDENCIA CRUZADA NUEVA: el puerto se define en el módulo que
 * **consume**, y el adaptador vive aquí. Nunca un `import` directo entre dos Bounded Contexts.
 */
@Global()
@Module({
  imports: [AgendaModule, SucursalesYPersonalModule, CatalogoYCotizacionModule, CrmYClientasModule],
  providers: [
    { provide: CONTEXTO_PERSONAL_PORT, useClass: ContextoPersonalAdapter },
    { provide: VERIFICAR_CITAS_FUTURAS_PORT, useClass: AgendaVerificarCitasFuturasAdapter },
    { provide: CONSULTA_AGENDA_PORT, useClass: ConsultaAgendaAdapter },
    { provide: CONTEXTO_CATALOGO_PORT, useClass: ContextoCatalogoAdapter },
    // Adaptadores REALES contra CRM desde Fase 3 Parte 1. Sustituyen a
    // `CrmNoConstruidoVerificarClientaAdapter`, que aceptaba cualquier uuid y no protegía nada.
    { provide: CONTEXTO_CLIENTA_PORT, useClass: ContextoClientaAdapter },
    { provide: REGISTRO_DE_INCIDENTES_PORT, useClass: RegistroDeIncidentesAdapter },
  ],
  exports: [
    CONTEXTO_PERSONAL_PORT,
    VERIFICAR_CITAS_FUTURAS_PORT,
    CONSULTA_AGENDA_PORT,
    CONTEXTO_CATALOGO_PORT,
    CONTEXTO_CLIENTA_PORT,
    REGISTRO_DE_INCIDENTES_PORT,
  ],
})
export class IntegracionModule {}
