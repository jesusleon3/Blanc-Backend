import { Inject, Injectable } from '@nestjs/common';
import { CITA_REPOSITORY, CitaRepository } from '../ports/cita.repository';
import { SILLA_REPOSITORY, SillaRepository } from '../ports/silla.repository';
import { CONTEXTO_PERSONAL_PORT, ContextoPersonalPort } from '../ports/contexto-personal.port';
import { RangoHorario } from '../../../../database/schema';
import { DomainError } from '../../../../shared/errors/domain-error';
import { BloqueHorario, DiaSemana } from '../../../sucursales-y-personal/domain/value-objects/horario-semanal.vo';

/**
 * Zona horaria del negocio. El horario de una sucursal ("9:00 a 12:00") es **hora de pared**,
 * mientras que `tstzrange` guarda **instantes absolutos**. Sin fijar la zona no se puede comparar
 * una cosa con la otra — y el error no aparecería en pruebas, aparecería en producción desplazado
 * las horas que separan al servidor de Querétaro.
 *
 * México abolió el horario de verano en 2022, así que hoy es un desfase fijo; aun así se usa el
 * identificador IANA y no un `-06:00` escrito a mano, para que un cambio de política no obligue a
 * tocar código.
 */
export const ZONA_HORARIA_NEGOCIO = 'America/Mexico_City';

export interface CapacidadEfectiva {
  sillasLibres: number;
  manicuristasDisponibles: number;
  /** `MIN(sillasLibres, manicuristasDisponibles)` — `DEC-035`. */
  capacidad: number;
}

/**
 * Servicio de dominio que responde **"¿cabe una cita aquí?"** (`DEC-035`, `RN-AGE-10`, `RN-AGE-12`).
 *
 * Es un servicio y no un caso de uso: no orquesta transacciones ni escribe. Lo consumen por igual
 * `AgendarCitaUseCase`, `ReprogramarCitaUseCase` y la consulta del bot, de modo que los tres ven
 * exactamente lo mismo.
 *
 * ⚠️ **ESTA COMPROBACIÓN ES CONSULTIVA, NO UN INVARIANTE** (`DEC-035`). Entre que responde y la
 * cita se inserta, otra reserva puede colarse: ambas pasan y toman sillas distintas. La autoridad
 * final sobre los recursos físicos es la restricción `EXCLUDE` en PostgreSQL. Esto evita *ofrecer*
 * huecos imposibles; no garantiza que nadie se adelante. Cerrar esa ventana exigiría bloqueo
 * pesimista sobre la sucursal entera, que serializaría todas sus reservas — precio que `DEC-035`
 * decidió no pagar, dejando el desajuste a recepción.
 */
@Injectable()
export class MotorDisponibilidad {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(SILLA_REPOSITORY) private readonly sillaRepository: SillaRepository,
    @Inject(CONTEXTO_PERSONAL_PORT) private readonly contextoPersonal: ContextoPersonalPort,
  ) {}

  /** Lanza si el rango viola el horario de la sucursal o si no queda capacidad efectiva. */
  async exigirDisponibilidad(sucursalId: string, rango: RangoHorario, opciones: { excluirCitaId?: string } = {}): Promise<void> {
    await this.exigirHorarioValido(sucursalId, rango);

    // Antes de hablar de capacidad: si la sucursal no tiene NINGUNA silla activa, el problema no
    // es que esté llena, es que está mal configurada. Decir "no hay lugar" mandaría a buscar otro
    // horario cuando ninguno va a funcionar.
    const sillasActivas = (await this.sillaRepository.listarPorSucursal(sucursalId)).filter((silla) => silla.activa);
    if (sillasActivas.length === 0) {
      throw new DomainError('SUCURSAL_SIN_SILLAS', 'La sucursal no tiene ninguna silla activa configurada.', 409, { sucursalId });
    }

    const capacidad = await this.calcularCapacidad(sucursalId, rango, opciones);
    if (capacidad.capacidad <= 0) {
      throw new DomainError(
        'HORARIO_NO_DISPONIBLE',
        capacidad.sillasLibres > 0
          ? 'No hay manicuristas disponibles para ese horario, aunque queden sillas libres.'
          : 'No queda lugar en la sucursal para ese horario.',
        409,
        { sucursalId, inicio: rango.inicio.toISOString(), ...capacidad },
      );
    }
  }

  /**
   * `MIN(sillas_libres, manicuristas_disponibles)`.
   *
   * El caso que esto existe para atrapar: 3 sillas libres pero solo 2 manicuristas trabajando hoy.
   * Sin el cruce, la tercera cita se aceptaría y una clienta se quedaría sin quién la atienda —
   * la silla está vacía, pero no hay manos.
   */
  async calcularCapacidad(
    sucursalId: string,
    rango: RangoHorario,
    opciones: { excluirCitaId?: string } = {},
  ): Promise<CapacidadEfectiva> {
    const sillasActivas = (await this.sillaRepository.listarPorSucursal(sucursalId)).filter((silla) => silla.activa);
    const citasQueOcupan = (await this.citaRepository.listarQueOcupanEnRango(sucursalId, rango)).filter(
      (cita) => cita.id !== opciones.excluirCitaId,
    );

    const sillasOcupadas = new Set(citasQueOcupan.map((cita) => cita.sillaId));
    const sillasLibres = sillasActivas.filter((silla) => !sillasOcupadas.has(silla.id)).length;

    const operativas = await this.contextoPersonal.manicuristasOperativasEn(sucursalId, rango);

    // Toda cita que ocupa consume a UNA persona, tenga nombre o no: las nombradas descuentan a esa
    // manicurista concreta; las que están sin asignar descuentan "alguien", porque la Encargada
    // tendrá que poner a alguien cuando la clienta llegue. Ignorar las segundas haría que el motor
    // ofreciera más huecos de los que hay manos para atender, que es justo lo que `DEC-035` evita.
    const nombradasComprometidas = new Set(
      citasQueOcupan.map((cita) => cita.manicuristaId).filter((id): id is string => id !== null),
    );
    const sinAsignar = citasQueOcupan.filter((cita) => cita.manicuristaId === null).length;

    const manicuristasDisponibles = Math.max(0, operativas.filter((id) => !nombradasComprometidas.has(id)).length - sinAsignar);

    return { sillasLibres, manicuristasDisponibles, capacidad: Math.min(sillasLibres, manicuristasDisponibles) };
  }

  /** `RN-AGE-10` y `RN-AGE-12`: dentro de un bloque del día, sin cruzar el corte, y no en domingo. */
  async exigirHorarioValido(sucursalId: string, rango: RangoHorario): Promise<void> {
    const horario = await this.contextoPersonal.horarioSemanalDe(sucursalId);
    if (!horario) {
      throw new DomainError('SUCURSAL_SIN_HORARIO', 'La sucursal no tiene horario configurado.', 409, { sucursalId });
    }

    const dia = diaDeLaSemana(rango.inicio);
    // Se mira el último instante *incluido* (el rango es `[inicio, fin)`): una cita que termina a
    // medianoche en punto no invade el día siguiente.
    if (dia !== diaDeLaSemana(new Date(rango.fin.getTime() - 1))) {
      throw new DomainError('CITA_CRUZA_DIAS', 'Una cita no puede abarcar dos días.', 409, { sucursalId });
    }

    const bloques = horario[dia] ?? [];
    if (bloques.length === 0) {
      // `RN-AGE-12` (domingo cerrado) NO vive en código: es un día con cero bloques en la
      // configuración de la sucursal. Si mañana abren en domingo, basta con configurarlo.
      throw new DomainError('SUCURSAL_CERRADA_ESE_DIA', `La sucursal no abre en ${dia}.`, 409, { sucursalId, dia });
    }

    const inicioMin = minutosLocales(rango.inicio);
    const finMin = minutosLocales(rango.fin);

    // La cita debe caber ENTERA dentro de UN bloque. Caber "entre dos" es exactamente lo que
    // `RN-AGE-10` prohíbe: una cita de 2 horas a las 11:00 cruzaría el corte de las 12:00.
    const cabe = bloques.some((bloque: BloqueHorario) => inicioMin >= aMinutos(bloque.horaInicio) && finMin <= aMinutos(bloque.horaFin));
    if (!cabe) {
      throw new DomainError(
        'FUERA_DEL_HORARIO_DE_SUCURSAL',
        'El horario solicitado queda fuera del horario de la sucursal o cruza el corte entre bloques.',
        409,
        { sucursalId, dia, bloques: bloques.map((b: BloqueHorario) => `${b.horaInicio}-${b.horaFin}`) },
      );
    }
  }
}

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

function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}
