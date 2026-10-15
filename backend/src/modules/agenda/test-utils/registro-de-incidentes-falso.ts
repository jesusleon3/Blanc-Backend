import { RegistroDeIncidentesPort } from '../domain/ports/registro-de-incidentes.port';

/**
 * Doble de `RegistroDeIncidentesPort` con espías de Jest.
 *
 * Las pruebas del **ciclo de vida de la cita** lo usan para no tener que montar CRM entero para
 * comprobar que `confirmada → completada` funciona. Las que sí van sobre `RN-CRM-06` usan el
 * adaptador real contra PostgreSQL (`agenda-crm.spec.ts`).
 */
export function crearRegistroDeIncidentesFalso(): jest.Mocked<RegistroDeIncidentesPort> {
  return {
    registrarIncidente: jest.fn().mockResolvedValue(undefined),
    registrarCancelacionOrdinaria: jest.fn().mockResolvedValue(undefined),
  };
}
