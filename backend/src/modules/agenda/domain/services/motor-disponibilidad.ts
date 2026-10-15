import { Inject, Injectable } from '@nestjs/common';
import { CITA_REPOSITORY, CitaRepository } from '../ports/cita.repository';
import { SILLA_REPOSITORY, SillaRepository } from '../ports/silla.repository';
import { CONTEXTO_PERSONAL_PORT, ContextoPersonalPort } from '../ports/contexto-personal.port';
import { RangoHorario } from '../../../../database/schema';
import { DomainError } from '../../../../shared/errors/domain-error';
import { BloqueHorario } from '../../../sucursales-y-personal/domain/value-objects/horario-semanal.vo';
import { aMinutos, diaDeLaSemana, minutosLocales } from '../../../../shared/tiempo/zona-horaria-negocio';

/**
 * Se reexportan desde `shared/tiempo` para no romper a quien ya los importaba de aquí.
 *
 * **Se movieron** porque Sucursales y Personal también necesita comparar hora de pared contra
 * horario de sucursal (al validar una cobertura), y tomarlos de Agenda habría sido un `import`
 * entre Bounded Contexts. No son una regla de Agenda: son un hecho de la plataforma.
 */
export { ZONA_HORARIA_NEGOCIO, diaDeLaSemana, minutosLocales } from '../../../../shared/tiempo/zona-horaria-negocio';

export interface CapacidadEfectiva {
  sillasLibres: number;
  manicuristasDisponibles: number;
  /** `MIN(sillasLibres, manicuristasDisponibles)` — `DEC-035`. Nunca negativo. */
  capacidad: number;
  /**
   * Cuántas citas que ya ocupan el horario se quedarían **sin manos** (`0` si alcanza para todas).
   *
   * POR QUÉ ES UN CAMPO APARTE. `capacidad` responde "¿cabe una más?" y para eso se recorta a `0`:
   * no hay diferencia práctica entre "justo lleno" y "pasado de rosca" cuando lo que se pregunta
   * es si se puede vender otra cita. Pero esa diferencia es **toda la pregunta** al registrar una
   * ausencia: lo que la Encargada necesita saber es si el personal que queda ya no alcanza para
   * las citas que **ya están vendidas**. Recortado a cero, ese aviso no existiría.
   */
  deficitDePersonal: number;
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

    // Sobrecupo: citas ya vendidas que ocupan este horario frente al personal que realmente está.
    // Se mide contra el total de citas que ocupan, con nombre o sin él, porque una manicurista
    // ausente sigue teniendo sus citas en el libro — simplemente ya no está para atenderlas.
    const deficitDePersonal = Math.max(0, citasQueOcupan.length - operativas.length);

    return {
      sillasLibres,
      manicuristasDisponibles,
      capacidad: Math.min(sillasLibres, manicuristasDisponibles),
      deficitDePersonal,
    };
  }

  /**
   * **¿Cabe un servicio de `duracionMinutos` empezando en `inicio`?** Responde `true`/`false` en
   * vez de lanzar.
   *
   * Lo usa la Lista de Espera, y existe por una razón concreta: **el hueco que deja una cita
   * cancelada no es el hueco real disponible**. Si se cancela la de 10:00–11:00 pero la de
   * 11:00–12:00 sigue en pie, un servicio de dos horas **no cabe**, aunque "se liberó una hora a
   * las 10". Comparar duraciones contra el rango de la cita liberada daría la respuesta
   * equivocada; preguntarle al motor por el rango completo que ocuparía el servicio da la
   * correcta, porque el solape con la cita siguiente deja la capacidad en cero.
   *
   * No lanza porque aquí "no cabe" no es un error: es el resultado que hace pasar a la siguiente
   * candidata de la fila.
   */
  async cabeUnServicio(
    sucursalId: string,
    inicio: Date,
    duracionMinutos: number,
    opciones: { excluirCitaId?: string } = {},
  ): Promise<boolean> {
    if (duracionMinutos <= 0) return false;

    const rango = { inicio, fin: new Date(inicio.getTime() + duracionMinutos * 60_000) };
    try {
      await this.exigirDisponibilidad(sucursalId, rango, opciones);
      return true;
    } catch (error) {
      // Solo se traga los errores de dominio (sin horario, cerrada, fuera de bloque, sin lugar).
      // Un fallo de base de datos tiene que seguir propagándose: tratarlo como "no cabe" haría
      // que la fila avanzara en silencio sobre una avería.
      if (error instanceof DomainError) return false;
      throw error;
    }
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
