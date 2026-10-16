import { DIAS_SEMANA, type BloqueHorario, type HorarioSemanalData } from '../../modules/sucursales-y-personal/domain/value-objects/horario-semanal.vo';

/**
 * Los datos reales de operación de Blanc. **Esto es la Client Specification** del modelo de
 * plataforma (`ADR-023`): nada de este archivo es lógica, todo es configuración de este cliente.
 *
 * ## DE DÓNDE SALE CADA DATO, Y POR QUÉ IMPORTA DECIRLO
 *
 * No se inventó ninguno. El horario sale de la respuesta literal de la Dueña en
 * `DISCOVERY_CHECKLIST.md` 1.3 y el número de sillas de `PROJECT_STATUS.md` (`DEC-031`,
 * 2026-09-30). **El horario semanal es el dato que más fácil se captura mal y del que depende todo
 * el motor de disponibilidad**: si un bloque está mal, el sistema vende huecos a horas en las que
 * el salón está cerrado, y nada falla — simplemente aparecen citas imposibles.
 */

/**
 * Horario partido de lunes a viernes: **9:00–12:00 y 15:00–18:00**.
 *
 * Son dos bloques, no uno de 9 a 18 con una pausa implícita. La Dueña fue explícita y la
 * consecuencia es concreta: *"no se puede agendar una cita de 2 horas a las 11am porque después de
 * las 12 no se trabaja"*. El motor respeta el fin del bloque, no solo su inicio.
 */
const LUNES_A_VIERNES: BloqueHorario[] = [
  { horaInicio: '09:00', horaFin: '12:00' },
  { horaInicio: '15:00', horaFin: '18:00' },
];

/** Sábado: un solo bloque de 9:00 a 15:00. */
const SABADO: BloqueHorario[] = [{ horaInicio: '09:00', horaFin: '15:00' }];

/**
 * **Domingo cerrado — `RN-AGE-12`.** Lista vacía, no un bloque de cero minutos.
 *
 * Y una precisión que el seed no puede expresar pero conviene no perder: la Dueña aclaró que en
 * domingo **sí se responden mensajes**, solo no se agendan citas. Eso no es horario de sucursal —
 * el canal de WhatsApp no consulta el horario para recibir— así que la lista vacía es correcta y
 * completa aquí.
 */
const DOMINGO: BloqueHorario[] = [];

export const HORARIO_DE_BLANC: HorarioSemanalData = Object.fromEntries(
  DIAS_SEMANA.map((dia) => [dia, dia === 'domingo' ? DOMINGO : dia === 'sabado' ? SABADO : LUNES_A_VIERNES]),
) as HorarioSemanalData;

export interface SucursalASembrar {
  nombre: string;
  /** Cuántas Sillas Virtuales. **Es la capacidad vendible de la sucursal** (`DEC-031`). */
  sillas: number;
  /**
   * Nombre de la variable de entorno con su `phone_number_id` de Meta.
   *
   * Va por entorno y no en este archivo porque **el alta de cada número en Meta es un trámite, no
   * un despliegue**: los tres se migran en momentos distintos (`GO_LIVE_RUNBOOK.md`), y una
   * sucursal sin número dado de alta debe poder existir y operar desde el mostrador.
   */
  variableDePhoneNumberId: string;
}

/**
 * Las tres sucursales. **Álamos tiene UNA silla**, y no es un caso de prueba:
 *
 * `DEC-031` dice que *"recepción reasigna la manicurista al llegar la clienta"*, y al preguntar
 * quién hace eso en un local de una sola silla apareció el dato que cerró el hueco: **no hay
 * recepcionistas, hay una Encargada en cada sucursal**. El rol `Recepcionista` existe en el modelo
 * y hoy no corresponde a ninguna persona real.
 */
export const SUCURSALES_DE_BLANC: readonly SucursalASembrar[] = [
  { nombre: 'Zibatá', sillas: 5, variableDePhoneNumberId: 'PHONE_NUMBER_ID_ZIBATA' },
  { nombre: 'Lomas', sillas: 3, variableDePhoneNumberId: 'PHONE_NUMBER_ID_LOMAS' },
  { nombre: 'Álamos', sillas: 1, variableDePhoneNumberId: 'PHONE_NUMBER_ID_ALAMOS' },
];

/**
 * Nombre de una silla. `Zibatá 1`, `Zibatá 2`…
 *
 * **Es la clave de idempotencia**, y de ahí que sea una función y no texto escrito a mano en cada
 * sitio: el seed decide si una silla ya existe comparando este nombre, así que las dos
 * generaciones —la del seed y la de la comprobación— tienen que ser literalmente la misma.
 */
export const nombreDeSilla = (sucursal: string, indice: number): string => `${sucursal} ${indice}`;
