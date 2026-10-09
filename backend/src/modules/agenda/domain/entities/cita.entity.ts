import { randomUUID } from 'crypto';
import { DomainError } from '../../../../shared/errors/domain-error';
import { ESTADOS_CITA, ESTADOS_QUE_LIBERAN_HORARIO, EstadoCita, RangoHorario } from '../../../../database/schema/agenda.schema';

export interface CitaProps {
  id: string;
  sucursalId: string;
  sillaId: string;
  manicuristaId: string | null;
  clientaId: string;
  servicioId: string;
  rangoHorario: RangoHorario;
  estado: EstadoCita;
}

/**
 * `Cita` — aggregate raíz de la Agenda.
 *
 * **ALCANCE DE ESTE INCREMENTO:** es deliberadamente anémica. La orden de trabajo del kick-off de
 * Fase 2 cubre esquema, migraciones y repositorios base — **no** casos de uso. Las transiciones de
 * estado (confirmar, cancelar, reprogramar, no-show) y las validaciones de negocio (horario de la
 * sucursal, corte de mediodía `RN-AGE-10`, duración según catálogo) **no se implementan aquí** y
 * son el siguiente incremento. Esta clase existe para que los repositorios tengan algo que mapear,
 * no para modelar todavía el ciclo de vida completo.
 *
 * **Lo que sí garantiza:** que un rango sea coherente, que el estado pertenezca a la lista válida,
 * y que `silla_id` nunca sea nulo — el invariante del patrón de Sillas Virtuales.
 */
export class Cita {
  private constructor(private props: CitaProps) {}

  static crear(input: {
    sucursalId: string;
    sillaId: string;
    clientaId: string;
    servicioId: string;
    rangoHorario: RangoHorario;
    manicuristaId?: string | null;
    estado?: EstadoCita;
  }): Cita {
    validarRango(input.rangoHorario);

    return new Cita({
      id: randomUUID(),
      sucursalId: input.sucursalId,
      sillaId: input.sillaId,
      // `null` = sin preferencia de manicurista. La Encargada la asigna cuando la clienta llega
      // (`DEC-031` §2.4). NO es un dato que falte: es una decisión aplazada a propósito.
      manicuristaId: input.manicuristaId ?? null,
      clientaId: input.clientaId,
      servicioId: input.servicioId,
      rangoHorario: input.rangoHorario,
      estado: input.estado ?? 'agendada',
    });
  }

  static reconstruir(props: CitaProps): Cita {
    return new Cita(props);
  }

  /**
   * Asignación de manicurista en mostrador (`DEC-031` §2.4).
   *
   * Aquí **no** se comprueba si esa manicurista ya está ocupada: lo garantiza la restricción
   * `citas_manicurista_sin_solapamiento` en la base de datos, que es no evadible. Duplicar la
   * comprobación en memoria daría una falsa sensación de seguridad y podría divergir.
   */
  asignarManicurista(manicuristaId: string): void {
    this.props.manicuristaId = manicuristaId;
  }

  cambiarEstado(estado: EstadoCita): void {
    if (!ESTADOS_CITA.includes(estado)) {
      throw new DomainError('CITA_ESTADO_INVALIDO', `"${estado}" no es un estado de cita válido.`, 400, { estado });
    }
    // Las transiciones LEGALES entre estados (qué puede pasar a qué) son la máquina de estados
    // de `P3`, todavía sin cerrar. Aquí solo se valida que el valor exista.
    this.props.estado = estado;
  }

  /** ¿Esta cita ocupa su horario? (`DEC-034`) — liberan `cancelada`, `expirada` y `reprogramada`. */
  get ocupaHorario(): boolean {
    return !(ESTADOS_QUE_LIBERAN_HORARIO as readonly string[]).includes(this.props.estado);
  }

  get id(): string {
    return this.props.id;
  }
  get sucursalId(): string {
    return this.props.sucursalId;
  }
  get sillaId(): string {
    return this.props.sillaId;
  }
  get manicuristaId(): string | null {
    return this.props.manicuristaId;
  }
  get clientaId(): string {
    return this.props.clientaId;
  }
  get servicioId(): string {
    return this.props.servicioId;
  }
  get rangoHorario(): RangoHorario {
    return this.props.rangoHorario;
  }
  get estado(): EstadoCita {
    return this.props.estado;
  }
}

function validarRango(rango: RangoHorario): void {
  if (Number.isNaN(rango.inicio.getTime()) || Number.isNaN(rango.fin.getTime())) {
    throw new DomainError('CITA_RANGO_INVALIDO', 'El rango horario contiene una fecha inválida.', 400);
  }
  if (rango.fin.getTime() <= rango.inicio.getTime()) {
    throw new DomainError('CITA_RANGO_INVALIDO', 'El fin de la cita debe ser posterior a su inicio.', 400, {
      inicio: rango.inicio.toISOString(),
      fin: rango.fin.toISOString(),
    });
  }
}
