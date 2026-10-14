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
import { ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { aMinutos, diaDeLaSemana, minutosLocales } from '../../../../shared/tiempo/zona-horaria-negocio';
import { BloqueHorario } from '../../domain/value-objects/horario-semanal.vo';
import { Sucursal } from '../../domain/entities/sucursal.entity';
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
    const destino = await this.sucursales.buscarPorId(input.sucursalId);
    if (!destino) {
      throw new RecursoNoEncontradoError('Sucursal', input.sucursalId);
    }
    this.exigirDestinoAbiertoEnElRango(destino, input.rango);

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

  /**
   * El destino tiene que estar **abierto en algún momento del rango** de la cobertura.
   *
   * POR QUÉ IMPORTA Y NO ES COSMÉTICO. Una cobertura es un **movimiento**: resta capacidad en la
   * sucursal base y la suma en el destino. Si el destino está cerrado en todo el rango, la resta
   * sí ocurre y la suma no sirve de nada — la manicurista desaparece de su sucursal para ir a un
   * local cerrado. El caso típico no es exótico: capturar la cobertura en domingo, o dentro del
   * corte de mediodía.
   *
   * Se exige solape con **algún** bloque, no que quepa entera en uno: una cobertura de todo el
   * lunes es legítima y cruza el corte de las 12:00 por definición. Lo que se rechaza es que no
   * toque ningún bloque en ningún día del rango.
   */
  private exigirDestinoAbiertoEnElRango(destino: Sucursal, rango: RangoHorario): void {
    const horario = destino.horarioSemanal.toJSON();

    // Se recorre día a día desde el inicio. El tope de 90 días de `ExcepcionPersonal` acota el
    // bucle: sin él, un rango mal teclado haría iterar siglos.
    for (let dia = new Date(rango.inicio); dia < rango.fin; dia = new Date(dia.getTime() + 86_400_000)) {
      const bloques: BloqueHorario[] = horario[diaDeLaSemana(dia)] ?? [];
      if (bloques.length === 0) continue;

      // Minutos de pared que el rango cubre DENTRO de este día concreto.
      const inicioDelDia = Math.max(0, dia.getTime() === rango.inicio.getTime() ? minutosLocales(rango.inicio) : 0);
      const siguienteDia = new Date(dia.getTime() + 86_400_000);
      const finDelDia = rango.fin < siguienteDia ? minutosLocales(rango.fin) : 24 * 60;

      const solapa = bloques.some((bloque) => inicioDelDia < aMinutos(bloque.horaFin) && finDelDia > aMinutos(bloque.horaInicio));
      if (solapa) return;
    }

    throw new ConflictoDeNegocioError(
      'SUCURSAL_DESTINO_CERRADA_EN_EL_RANGO',
      `La sucursal "${destino.nombre}" está cerrada durante todo el rango de la cobertura, así que nadie se beneficiaría del movimiento.`,
      { sucursalId: destino.id, inicio: rango.inicio.toISOString(), fin: rango.fin.toISOString() },
    );
  }

  private async exigirManicurista(manicuristaId: string): Promise<void> {
    if (!(await this.manicuristas.buscarPorId(manicuristaId))) {
      throw new RecursoNoEncontradoError('Manicurista', manicuristaId);
    }
  }
}
