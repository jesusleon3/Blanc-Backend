import { Global, Module } from '@nestjs/common';
import { AgendaModule } from '../agenda/agenda.module';
import { SucursalesYPersonalModule } from '../sucursales-y-personal/sucursales-y-personal.module';
import { CONTEXTO_PERSONAL_PORT } from '../agenda/domain/ports/contexto-personal.port';
import { VERIFICAR_CITAS_FUTURAS_PORT } from '../sucursales-y-personal/domain/ports/verificar-citas-futuras.port';
import { ContextoPersonalAdapter } from './contexto-personal.adapter';
import { AgendaVerificarCitasFuturasAdapter } from './agenda-verificar-citas-futuras.adapter';

/**
 * Punto único donde se cablean las dependencias **entre Bounded Contexts**.
 *
 * POR QUÉ EXISTE. Agenda y Sucursales y Personal se necesitan **en los dos sentidos**:
 *
 * - Personal necesita saber si una manicurista tiene **citas futuras** antes de darla de baja
 *   (`DEC-032`).
 * - Agenda necesita saber qué manicuristas están **operativas** para calcular capacidad
 *   (`DEC-035`/`DEC-036`).
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
  imports: [AgendaModule, SucursalesYPersonalModule],
  providers: [
    { provide: CONTEXTO_PERSONAL_PORT, useClass: ContextoPersonalAdapter },
    { provide: VERIFICAR_CITAS_FUTURAS_PORT, useClass: AgendaVerificarCitasFuturasAdapter },
  ],
  exports: [CONTEXTO_PERSONAL_PORT, VERIFICAR_CITAS_FUTURAS_PORT],
})
export class IntegracionModule {}
