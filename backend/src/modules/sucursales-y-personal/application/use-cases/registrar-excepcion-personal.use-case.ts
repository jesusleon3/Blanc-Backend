import { Inject, Injectable } from '@nestjs/common';
import { ExcepcionPersonal } from '../../domain/entities/excepcion-personal.entity';
import {
  EXCEPCION_PERSONAL_REPOSITORY,
  ExcepcionPersonalRepository,
} from '../../domain/ports/excepcion-personal.repository';
import { CONSULTA_AGENDA_PORT, CitaAfectada, ConsultaAgendaPort } from '../../domain/ports/consulta-agenda.port';
import { MANICURISTA_REPOSITORY, ManicuristaRepository } from '../../domain/ports/manicurista.repository';
import { SUCURSAL_REPOSITORY, SucursalRepository } from '../../domain/ports/sucursal.repository';
import { RangoHorario } from '../../../../database/schema';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface ResultadoExcepcion {
  excepcion: ExcepcionPersonal;
  /**
   * Citas que quedan comprometidas. **La excepción se registra igual**: en la vida real la
   * manicurista ya faltó, y negarse a anotarlo dejaría al sistema mintiendo sobre la capacidad.
   * Esta lista es para que la Encargada reasigne o reprograme de inmediato.
   */
  citasAfectadas: CitaAfectada[];
}

/**
 * Casos de uso de `DEC-036` — registrar ausencias y coberturas, y revocarlas si se capturaron mal.
 *
 * **Por qué nunca bloquean.** Sería tentador rechazar una ausencia cuando hay citas asignadas,
 * pero eso invertiría la realidad: la manicurista no falta porque el sistema se lo permita. Si el
 * sistema no deja anotarlo, el motor de disponibilidad sigue contando con alguien que no está y
 * **sigue vendiendo huecos imposibles** — exactamente lo que `DEC-035` existe para evitar. Se
 * registra siempre y se devuelve el daño para que una persona lo gestione.
 */
@Injectable()
export class RegistrarExcepcionPersonalUseCase {
  constructor(
    @Inject(EXCEPCION_PERSONAL_REPOSITORY) private readonly excepciones: ExcepcionPersonalRepository,
    @Inject(MANICURISTA_REPOSITORY) private readonly manicuristas: ManicuristaRepository,
    @Inject(SUCURSAL_REPOSITORY) private readonly sucursales: SucursalRepository,
    @Inject(CONSULTA_AGENDA_PORT) private readonly agenda: ConsultaAgendaPort,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async registrarAusencia(
    input: { manicuristaId: string; rango: RangoHorario; motivo?: string },
    actor: ClaimsUsuario,
  ): Promise<ResultadoExcepcion> {
    await this.exigirManicurista(input.manicuristaId);
    const excepcion = ExcepcionPersonal.ausencia(input);
    return this.persistir(excepcion, 'registrar_ausencia', actor);
  }

  async registrarCobertura(
    input: { manicuristaId: string; sucursalId: string; rango: RangoHorario; motivo?: string },
    actor: ClaimsUsuario,
  ): Promise<ResultadoExcepcion> {
    await this.exigirManicurista(input.manicuristaId);
    // El destino se valida aquí y no se deja a la clave foránea: sin esto, un `sucursalId` mal
    // escrito aborta la transacción con un error de PostgreSQL y el cliente recibe un 500 opaco
    // en lugar de un 404 que dice qué no existe.
    if (!(await this.sucursales.buscarPorId(input.sucursalId))) {
      throw new RecursoNoEncontradoError('Sucursal', input.sucursalId);
    }
    const excepcion = ExcepcionPersonal.cobertura(input);
    return this.persistir(excepcion, 'registrar_cobertura', actor);
  }

  /** Se capturó mal. No es una baja lógica: la excepción desaparece y la capacidad vuelve sola. */
  async revocar(input: { excepcionId: string }, actor: ClaimsUsuario): Promise<void> {
    const excepcion = await this.excepciones.buscarPorId(input.excepcionId);
    if (!excepcion) throw new RecursoNoEncontradoError('ExcepcionPersonal', input.excepcionId);

    await this.unitOfWork.ejecutar(async () => {
      await this.excepciones.eliminar(excepcion.id);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: excepcion.sucursalId ?? undefined,
        entidadAfectadaTipo: 'excepcion_personal',
        entidadAfectadaId: excepcion.id,
        detalle: {
          accion: 'revocar_excepcion',
          tipo: excepcion.tipo,
          manicuristaId: excepcion.manicuristaId,
          inicio: excepcion.rango.inicio.toISOString(),
        },
      });
    });
  }

  private async persistir(excepcion: ExcepcionPersonal, accion: string, actor: ClaimsUsuario): Promise<ResultadoExcepcion> {
    let citasAfectadas: CitaAfectada[] = [];

    await this.unitOfWork.ejecutar(async () => {
      await this.excepciones.guardar(excepcion);

      // Se consulta DESPUÉS de guardar y dentro de la misma transacción, para que el cálculo de
      // sobrecupo ya tenga en cuenta esta excepción. Preguntar antes daría la capacidad de un
      // mundo que acaba de dejar de existir.
      citasAfectadas = await this.agenda.citasAfectadasPorExcepcion(excepcion.manicuristaId, excepcion.rango);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        sucursalRelacionada: excepcion.sucursalId ?? undefined,
        entidadAfectadaTipo: 'excepcion_personal',
        entidadAfectadaId: excepcion.id,
        detalle: {
          accion,
          manicuristaId: excepcion.manicuristaId,
          inicio: excepcion.rango.inicio.toISOString(),
          fin: excepcion.rango.fin.toISOString(),
          // Queda en la auditoría: si después hay una queja, poder reconstruir que se avisó.
          citasAfectadas: citasAfectadas.length,
        },
      });
    });

    return { excepcion, citasAfectadas };
  }

  private async exigirManicurista(manicuristaId: string): Promise<void> {
    if (!(await this.manicuristas.buscarPorId(manicuristaId))) {
      throw new RecursoNoEncontradoError('Manicurista', manicuristaId);
    }
  }
}
