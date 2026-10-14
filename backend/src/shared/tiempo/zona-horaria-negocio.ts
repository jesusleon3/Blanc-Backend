import { DiaSemana } from '../../modules/sucursales-y-personal/domain/value-objects/horario-semanal.vo';

/**
 * Zona horaria del negocio. El horario de una sucursal ("9:00 a 12:00") es **hora de pared**,
 * mientras que `tstzrange` guarda **instantes absolutos**. Sin fijar la zona no se puede comparar
 * una cosa con la otra — y el error no aparecería en pruebas, aparecería en producción desplazado
 * las horas que separan al servidor de Querétaro.
 *
 * México abolió el horario de verano en 2022, así que hoy es un desfase fijo; aun así se usa el
 * identificador IANA y no un `-06:00` escrito a mano, para que un cambio de política no obligue a
 * tocar código.
 *
 * **Vive en `shared/` y no en Agenda** porque no es una regla de Agenda: es un hecho de la
 * plataforma. Sucursales y Personal lo necesita para validar coberturas contra el horario, y
 * tomarlo de Agenda sería un `import` entre Bounded Contexts, que está prohibido.
 */
export const ZONA_HORARIA_NEGOCIO = 'America/Mexico_City';

/** `Intl` devuelve el nombre corto del día en inglés; esto lo traduce al vocabulario del VO. */
const DIAS_INGLES: Record<string, DiaSemana> = {
  Mon: 'lunes',
  Tue: 'martes',
  Wed: 'miercoles',
  Thu: 'jueves',
  Fri: 'viernes',
  Sat: 'sabado',
  Sun: 'domingo',
};

/** Día de la semana **en la zona del negocio**, no en la del servidor. */
export function diaDeLaSemana(instante: Date): DiaSemana {
  const corto = new Intl.DateTimeFormat('en-US', { timeZone: ZONA_HORARIA_NEGOCIO, weekday: 'short' }).format(instante);
  const dia = DIAS_INGLES[corto];
  if (!dia) throw new Error(`Día de la semana no reconocido: ${corto}`);
  return dia;
}

/** Minutos desde medianoche **en la zona del negocio**. */
export function minutosLocales(instante: Date): number {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA_HORARIA_NEGOCIO,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instante);
  return Number(partes.find((p) => p.type === 'hour')!.value) * 60 + Number(partes.find((p) => p.type === 'minute')!.value);
}

/** `"09:30"` → 570. Para comparar un bloque de horario con `minutosLocales`. */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}
