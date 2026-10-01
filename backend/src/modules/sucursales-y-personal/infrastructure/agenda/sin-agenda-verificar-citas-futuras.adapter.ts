import { Injectable } from '@nestjs/common';
import { VerificarCitasFuturasPort } from '../../domain/ports/verificar-citas-futuras.port';

/**
 * ⚠️ **SUSTITUTO TEMPORAL — NO ES UNA IMPLEMENTACIÓN.** ⚠️
 *
 * Responde **siempre `false`**: "esta manicurista no tiene citas futuras". Hoy eso es literalmente
 * cierto —el Bounded Context *Agenda* no existe, no hay ninguna tabla de citas y por tanto no puede
 * haber ninguna cita futura—, pero deja de serlo **en el instante en que Fase 2 cree la primera
 * cita**, y entonces este archivo convierte el bloqueo duro de `DEC-032` en un permiso silencioso.
 *
 * ### Qué hay que hacer en Fase 2
 *
 * Sustituir este proveedor en `sucursales-y-personal.module.ts` por un adaptador que consulte de
 * verdad a Agenda (vía un caso de uso expuesto por `AgendaModule`, nunca con un `JOIN` entre
 * esquemas — `ADR-005`). Esta clase debe **borrarse**, no quedarse como respaldo.
 *
 * ### Por qué `false` y no lanzar un error
 *
 * Lanzar haría imposible dar de baja a ninguna manicurista, rompiendo `FL-SUC-03`, que está
 * entregado y en uso. Entre dos males se elige el que mantiene el comportamiento actual intacto, y
 * se compensa dejando el riesgo registrado en tres sitios: aquí, en su propia prueba —que fija este
 * comportamiento a propósito, de modo que al llegar Agenda alguien tenga que cambiarla
 * conscientemente— y en `PROJECT_STATUS.md` §7 como `ACCEPTED_RISK`.
 */
@Injectable()
export class SinAgendaVerificarCitasFuturasAdapter implements VerificarCitasFuturasPort {
  async tieneCitasFuturas(_manicuristaId: string): Promise<boolean> {
    return false;
  }
}
