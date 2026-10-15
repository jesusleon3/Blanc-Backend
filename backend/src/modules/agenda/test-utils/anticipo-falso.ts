import { AnticipoPort, EstadoDeAnticipoDeCita } from '../domain/ports/anticipo.port';

/**
 * Doble de `AnticipoPort` con espías de Jest.
 *
 * Por defecto responde `'ninguno'`, que es el caso de la inmensa mayoría de las citas: solo las
 * de clientas en lista roja llevan anticipo (`RN-ANT-01`). Ese valor por defecto mantiene
 * aisladas las pruebas de reserva, sillas y ciclo de vida, que no van sobre dinero.
 *
 * Las que sí van sobre anticipos usan los casos de uso y adaptadores **reales** contra PostgreSQL
 * (`agenda-anticipos.spec.ts`).
 */
export function crearAnticipoFalso(estado: EstadoDeAnticipoDeCita = 'ninguno'): jest.Mocked<AnticipoPort> {
  return {
    estadoDe: jest.fn().mockResolvedValue(estado),
    generarParaCita: jest.fn().mockResolvedValue(true),
    retenerPorCitaTerminada: jest.fn().mockResolvedValue(undefined),
  };
}
