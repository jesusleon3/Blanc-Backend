import { Inject, Injectable } from '@nestjs/common';
import { Cita } from '../../domain/entities/cita.entity';
import { CITA_REPOSITORY, CitaRepository } from '../../domain/ports/cita.repository';
import { RangoHorario } from '../../../../database/schema';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CONTEXTO_CLIENTA_PORT, ContextoClientaPort } from '../../domain/ports/contexto-clienta.port';
import { DomainError } from '../../../../shared/errors/domain-error';

/** Tope de días por consulta. Duplicado a propósito del DTO: ver la nota de `ejecutar`. */
export const MAXIMO_DIAS_DE_CONSULTA = 31;
export const CITAS_POR_PAGINA_POR_DEFECTO = 100;
export const MAXIMO_CITAS_POR_PAGINA = 200;

export interface ConsultarAgendaInput {
  sucursalId: string;
  rangoHorario: RangoHorario;
  limite?: number;
  desplazamiento?: number;
}

export interface PaginaDeAgenda {
  citas: Cita[];
  /**
   * `clientaId` → `true` si está en lista roja. **Vacío para una `MANICURISTA`**, y no por
   * filtrar la salida después: para ella no se consulta en absoluto.
   */
  enListaRojaPorClienta: Map<string, boolean>;
  limite: number;
  desplazamiento: number;
  /**
   * `true` si **podría** haber más citas: se pidió una fila extra y vino. No es un total — contar
   * exigiría una segunda consulta que nadie necesita para pintar la agenda del día.
   */
  hayMas: boolean;
}

/**
 * Lectura de la agenda de una sucursal en un rango, **paginada y acotada**.
 *
 * **El filtrado de la vista de iPad vive aquí, no en el controlador.** Si una `MANICURISTA`
 * pregunta, solo salen sus citas — y el id por el que se filtra sale de **sus permisos resueltos
 * contra PostgreSQL** (`P9`), nunca de la petición. Tomarlo de la query dejaría que cualquiera
 * leyera la agenda ajena cambiando un uuid.
 *
 * Que esté en el caso de uso y no en el controlador importa: el día que esta agenda se consulte
 * desde otro adaptador (el bot, un job, una consola), el filtro viaja con ella — y con él el
 * tope de rango, que de otro modo cada adaptador tendría que recordar aplicar.
 */
@Injectable()
export class ConsultarAgendaUseCase {
  constructor(
    @Inject(CITA_REPOSITORY) private readonly citaRepository: CitaRepository,
    @Inject(CONTEXTO_CLIENTA_PORT) private readonly clientas: ContextoClientaPort,
  ) {}

  async ejecutar(input: ConsultarAgendaInput, actor: ClaimsUsuario): Promise<PaginaDeAgenda> {
    const { inicio, fin } = input.rangoHorario;

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      throw new DomainError('RANGO_INVALIDO', 'El rango de consulta contiene una fecha inválida.', 400);
    }
    if (fin.getTime() <= inicio.getTime()) {
      throw new DomainError('RANGO_INVALIDO', 'El fin del rango de consulta debe ser posterior al inicio.', 400);
    }

    // El tope se comprueba aquí y no solo en el DTO: el DTO protege la ruta HTTP, pero esta regla
    // es del caso de uso y tiene que valer también para el bot y para cualquier job futuro. Son
    // dos defensas del mismo límite, no una duplicación por descuido.
    const dias = (fin.getTime() - inicio.getTime()) / 86_400_000;
    if (dias > MAXIMO_DIAS_DE_CONSULTA) {
      throw new DomainError(
        'RANGO_DE_CONSULTA_DEMASIADO_AMPLIO',
        `Una consulta de agenda no puede abarcar más de ${MAXIMO_DIAS_DE_CONSULTA} días; se pidieron ${Math.ceil(dias)}.`,
        400,
        { maximoDias: MAXIMO_DIAS_DE_CONSULTA, diasSolicitados: Math.ceil(dias) },
      );
    }

    const limite = Math.min(input.limite ?? CITAS_POR_PAGINA_POR_DEFECTO, MAXIMO_CITAS_POR_PAGINA);
    const desplazamiento = input.desplazamiento ?? 0;

    const manicuristaId = this.filtroDeManicurista(actor);
    if (manicuristaId === 'SIN_ACCESO') {
      return { citas: [], limite, desplazamiento, hayMas: false, enListaRojaPorClienta: new Map() };
    }

    // Se pide una fila de más para saber si hay página siguiente sin tener que contar el total.
    const filas = await this.citaRepository.listarParaConsulta(input.sucursalId, input.rangoHorario, {
      manicuristaId,
      limite: limite + 1,
      desplazamiento,
    });

    const citas = filas.slice(0, limite);

    return {
      citas,
      limite,
      desplazamiento,
      hayMas: filas.length > limite,
      enListaRojaPorClienta: await this.resolverListaRoja(citas, actor),
    };
  }

  /**
   * Indicador de lista roja para quien atiende el mostrador (`RN-CRM-03`/`RN-ANT-01`).
   *
   * **Para una `MANICURISTA` no se consulta CRM en absoluto.** La diferencia con consultarlo y
   * luego no enviarlo no es sutil: si el dato nunca entra en el proceso, no puede filtrarse por
   * un descuido de un presenter futuro, por un log, ni por un mensaje de error. La Dueña fue
   * explícita — *"no lista roja"* (`DEC-040`).
   *
   * Una sola consulta para toda la página, no una por cita.
   */
  private async resolverListaRoja(citas: Cita[], actor: ClaimsUsuario): Promise<Map<string, boolean>> {
    if (actor.rol === Rol.MANICURISTA || citas.length === 0) return new Map();

    const contextos = await this.clientas.obtenerVarias(citas.map((cita) => cita.clientaId));
    return new Map([...contextos.values()].map((contexto) => [contexto.id, contexto.estadoDeRiesgo === 'lista_roja']));
  }

  /**
   * `undefined` = sin filtro (ve toda la sucursal). Un id = solo las suyas.
   * `'SIN_ACCESO'` = no ve nada.
   */
  private filtroDeManicurista(actor: ClaimsUsuario): string | undefined | 'SIN_ACCESO' {
    if (actor.rol !== Rol.MANICURISTA) return undefined;

    // Una usuaria con rol MANICURISTA sin `manicuristaId` vinculado (`P9`) no puede ver NADA. Es
    // el lado seguro del error: devolver todo sería exponer la agenda completa por un dato mal
    // capturado en el alta del usuario.
    return actor.manicuristaId ?? 'SIN_ACCESO';
  }
}
