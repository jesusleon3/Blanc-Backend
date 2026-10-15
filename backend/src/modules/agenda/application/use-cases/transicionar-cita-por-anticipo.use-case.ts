import { Inject, Injectable } from '@nestjs/common';
import { Cita } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { SILLA_REPOSITORY, SillaRepository } from '../../domain/ports/silla.repository';
import { MotorDisponibilidad } from '../../domain/services/motor-disponibilidad';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, DomainError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';

/**
 * Mueve una cita según lo que pase con su anticipo: `activar` (pago confirmado) y `expirar`
 * (nunca llegó la transferencia).
 *
 * Las dos transiciones viven juntas porque comparten precondición —la cita tiene que estar en
 * `en_espera_pago`— y porque las dos las dispara Anticipos a través del mismo puerto. Separarlas
 * habría duplicado esa comprobación.
 *
 * ## `activar`: `en_espera_pago` → `agendada`
 *
 * ## AQUÍ SE RESUELVE LA CARRERA DE `RN-ANT-03`
 *
 * Mientras el anticipo estuvo `pendiente`, la cita **no retenía nada**: `en_espera_pago` libera
 * silla y manicurista, y la Dueña fue explícita — *"Hasta que se dé el anticipo se agenda, si no
 * el espacio sigue libre"*. Así que entre que se pidió el anticipo y llegó la transferencia, otra
 * clienta pudo tomar el hueco, o incluso **otra clienta de lista roja pudo confirmar su pago
 * antes**. Dos citas en `en_espera_pago` pueden coexistir sobre la misma silla precisamente
 * porque ninguna ocupa.
 *
 * Este caso de uso es el instante en que eso se decide, en tres capas:
 *
 * 1. `MotorDisponibilidad` comprueba horario y capacidad efectiva (consultivo).
 * 2. Se busca una silla libre **y se reasigna si la suya ya está ocupada** — la clienta nunca
 *    eligió silla, así que moverla es invisible para ella y mejor que rechazar el pago.
 * 3. La restricción `EXCLUDE` de PostgreSQL es la **autoridad final**: si dos confirmaciones
 *    corren a la vez, una de las dos escribe y la otra recibe `SILLA_OCUPADA`.
 *
 * **Que falle con 409 no es un error del sistema**: es *"el primero en pagar se queda con el
 * cupo"* funcionando. Y como corre dentro de la transacción que confirma el pago, el anticipo
 * tampoco queda confirmado — no se registra dinero contra una cita que no se agendó.
 */
@Injectable()
export class TransicionarCitaPorAnticipoUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(SILLA_REPOSITORY) private readonly sillaRepository: SillaRepository,
    private readonly motorDisponibilidad: MotorDisponibilidad,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
  ) {}

  /**
   * **No abre transacción propia a propósito.** La abre quien confirma el pago, y
   * `DrizzleUnitOfWork` se une a ella: así el anticipo y la cita se deciden juntos o no se
   * deciden.
   */
  async activar(input: { citaId: string }, actor: ClaimsUsuario): Promise<Cita> {
    const cita = await this.citaRepository.buscarPorId(input.citaId);
    if (!cita) throw new RecursoNoEncontradoError('Cita', input.citaId);

    if (cita.estado !== 'en_espera_pago') {
      throw new ConflictoDeNegocioError(
        'CITA_NO_ESTA_EN_ESPERA_DE_PAGO',
        `La cita está en "${cita.estado}", así que confirmar un anticipo no cambia nada en ella.`,
        { citaId: cita.id, estado: cita.estado },
      );
    }

    // La propia cita se excluye: está a punto de pasar a ocupar, y no debe chocar consigo misma.
    //
    // El error del motor se reescribe a propósito: su mensaje genérico ("no queda lugar") es
    // correcto para quien busca un horario, pero **aquí hay dinero de por medio**. Quien confirma
    // un pago necesita saber qué hacer con una transferencia que ya se hizo, y eso no se deduce
    // de "no queda lugar".
    try {
      await this.motorDisponibilidad.exigirDisponibilidad(cita.sucursalId, cita.rangoHorario, { excluirCitaId: cita.id });
    } catch (error) {
      if (error instanceof DomainError && error.code === 'HORARIO_NO_DISPONIBLE') throw this.huecoPerdido(cita);
      throw error;
    }

    const sillaId = await this.elegirSilla(cita);
    if (sillaId !== cita.sillaId) cita.reasignarSilla(sillaId);

    const estadoAnterior = cita.estado;
    cita.cambiarEstado('agendada');
    // La autoridad final: si otra confirmación ganó, esto lanza `SILLA_OCUPADA`.
    await this.citaRepository.guardar(cita);

    await this.auditoria.registrar({
      tipoAccion: 'agendamiento',
      actor: actor.sub,
      sucursalRelacionada: cita.sucursalId,
      entidadAfectadaTipo: 'cita',
      entidadAfectadaId: cita.id,
      detalle: {
        accion: 'activar_cita_por_anticipo',
        estadoAnterior,
        estadoNuevo: cita.estado,
        sillaId: cita.sillaId,
        // Si hubo que moverla de silla, queda registrado: es la huella de que la carrera estuvo
        // apretada y alguien más había tomado la suya.
        sillaReasignada: sillaId !== cita.sillaId,
      },
    });

    return cita;
  }

  /**
   * El anticipo expiró: `en_espera_pago` → `expirada`.
   *
   * **No revalida disponibilidad ni toca sillas**, y es correcto: la cita está dejando de existir,
   * no intentando ocupar. Pedirle capacidad a una cita que se va sería absurdo — y peor, podría
   * impedir limpiarla justo cuando la sucursal está llena, que es cuando más estorba.
   */
  async expirar(input: { citaId: string }, actor: ClaimsUsuario): Promise<Cita> {
    const cita = await this.citaRepository.buscarPorId(input.citaId);
    if (!cita) throw new RecursoNoEncontradoError('Cita', input.citaId);

    if (cita.estado !== 'en_espera_pago') {
      throw new ConflictoDeNegocioError(
        'CITA_NO_ESTA_EN_ESPERA_DE_PAGO',
        `La cita está en "${cita.estado}", así que expirar su anticipo no cambia nada en ella.`,
        { citaId: cita.id, estado: cita.estado },
      );
    }

    cita.cambiarEstado('expirada');
    await this.citaRepository.guardar(cita);

    await this.auditoria.registrar({
      tipoAccion: 'agendamiento',
      actor: actor.sub,
      sucursalRelacionada: cita.sucursalId,
      entidadAfectadaTipo: 'cita',
      entidadAfectadaId: cita.id,
      detalle: { accion: 'expirar_cita_por_anticipo', estadoAnterior: 'en_espera_pago', estadoNuevo: 'expirada' },
    });

    return cita;
  }

  /**
   * Su propia silla si sigue libre; cualquier otra libre si no.
   *
   * **Reasignar antes que rechazar**: la clienta nunca eligió silla (`DEC-031`), así que cambiarla
   * no le afecta en nada, y rechazar un pago ya transferido porque "su" silla se ocupó sería
   * absurdo cuando la de al lado está vacía.
   */
  private async elegirSilla(cita: Cita): Promise<string> {
    const activas = (await this.sillaRepository.listarPorSucursal(cita.sucursalId)).filter((silla) => silla.activa);
    const ocupadas = new Set(
      (await this.citaRepository.listarQueOcupanEnRango(cita.sucursalId, cita.rangoHorario))
        .filter((otra) => otra.id !== cita.id)
        .map((otra) => otra.sillaId),
    );

    if (!ocupadas.has(cita.sillaId) && activas.some((silla) => silla.id === cita.sillaId)) return cita.sillaId;

    const libre = activas.find((silla) => !ocupadas.has(silla.id));
    if (!libre) throw this.huecoPerdido(cita);
    return libre.id;
  }

  /**
   * El 409 de la carrera perdida, con instrucciones.
   *
   * El mensaje dice **qué hacer con el dinero**, que es la pregunta real de quien lo recibe: la
   * transferencia ya se hizo en el banco, el anticipo sigue `pendiente` porque la transacción se
   * deshizo, y no se devuelve (`RN-ANT-04`) — sigue siendo válido para la cita reprogramada.
   */
  private huecoPerdido(cita: Cita): DomainError {
    return new DomainError(
      'HORARIO_NO_DISPONIBLE',
      'Otra clienta tomó el último lugar de ese horario antes de que se confirmara este pago. ' +
        'El anticipo sigue pendiente y no se devuelve: reprograma la cita a un horario libre y vuelve a confirmarlo.',
      409,
      { citaId: cita.id, inicio: cita.rangoHorario.inicio.toISOString(), anticipoSigueValido: true },
    );
  }
}
