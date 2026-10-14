import { ContextoPersonalPort } from '../domain/ports/contexto-personal.port';
import { HorarioSemanalData, DIAS_SEMANA } from '../../sucursales-y-personal/domain/value-objects/horario-semanal.vo';

/** Horario abierto 24/7, los siete días. */
export function horarioAbiertoSiempre(): HorarioSemanalData {
  return Object.fromEntries(DIAS_SEMANA.map((dia) => [dia, [{ horaInicio: '00:00', horaFin: '23:59' }]])) as HorarioSemanalData;
}

/** Horario real de Blanc: 9-12 y 15-18 entre semana, 9-15 el sábado, **domingo cerrado**. */
export function horarioRealDeBlanc(): HorarioSemanalData {
  const entreSemana = [
    { horaInicio: '09:00', horaFin: '12:00' },
    { horaInicio: '15:00', horaFin: '18:00' },
  ];
  return {
    lunes: entreSemana,
    martes: entreSemana,
    miercoles: entreSemana,
    jueves: entreSemana,
    viernes: entreSemana,
    sabado: [{ horaInicio: '09:00', horaFin: '15:00' }],
    domingo: [], // `RN-AGE-12` — no es una regla en código, es configuración.
  };
}

/**
 * Doble de `ContextoPersonalPort` para pruebas.
 *
 * **Por defecto abre 24/7 y devuelve 99 manicuristas**, a propósito: las pruebas que no van sobre
 * disponibilidad —reserva, ciclo de vida, transiciones— deben seguir aislando lo suyo y no empezar
 * a fallar por el horario. Las que sí van sobre `MotorDisponibilidad` pasan valores explícitos.
 */
export function crearContextoPersonalFalso(opciones: { horario?: HorarioSemanalData | null; manicuristas?: string[] } = {}): ContextoPersonalPort {
  const manicuristas = opciones.manicuristas ?? Array.from({ length: 99 }, (_, i) => `manicurista-ficticia-${i}`);
  const horario = opciones.horario === undefined ? horarioAbiertoSiempre() : opciones.horario;

  return {
    horarioSemanalDe: async () => horario,
    manicuristasOperativasEn: async () => manicuristas,
  };
}
