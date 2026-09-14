import { Inject, Injectable } from '@nestjs/common';
import { SERVICIO_REPOSITORY, ServicioRepository } from '../../domain/ports/servicio.repository';
import { MODIFICADOR_DISENO_REPOSITORY, ModificadorDisenoRepository } from '../../domain/ports/modificador-diseno.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface VincularModificadorAServicioInput {
  servicioId: string;
  modificadorId: string;
}

/**
 * Caso de uso — `FL-COT-01` (habilitar un modificador de diseño para un servicio).
 *
 * POR QUÉ EXISTE ESTA RELACIÓN: el Domain Discovery dice que un `Servicio` "incluye referencia a
 * modificadores aplicables" — **no** es cierto que cualquier modificador aplique a cualquier
 * servicio. Sin esta tabla de unión, esa restricción de negocio se perdería y el motor de
 * cotización (`FL-COT-03`) podría ofrecer combinaciones que el salón no realiza.
 *
 * VALIDACIONES, EN ORDEN Y POR SEPARADO:
 * 1. Existencia de cada lado → `404 RECURSO_NO_ENCONTRADO`, nombrando cuál de los dos falta.
 * 2. Ambos **activos** → `409`. Habilitar un modificador dado de baja, o habilitarlo en un
 *    servicio dado de baja, crearía una oferta que el catálogo ya retiró.
 * 3. Vínculo no duplicado → `409 MODIFICADOR_YA_VINCULADO`. Se comprueba aquí **y** en el
 *    adaptador (que traduce el `23505`), porque entre esta comprobación y el `INSERT` cabe una
 *    condición de carrera (TOCTOU): el pre-chequeo da el error legible, el constraint lo garantiza.
 */
@Injectable()
export class VincularModificadorAServicioUseCase {
  constructor(
    @Inject(SERVICIO_REPOSITORY) private readonly servicioRepository: ServicioRepository,
    @Inject(MODIFICADOR_DISENO_REPOSITORY) private readonly modificadorRepository: ModificadorDisenoRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: VincularModificadorAServicioInput, actor: ClaimsUsuario): Promise<void> {
    const servicio = await this.servicioRepository.buscarPorId(input.servicioId);
    if (!servicio) throw new RecursoNoEncontradoError('Servicio', input.servicioId);

    const modificador = await this.modificadorRepository.buscarPorId(input.modificadorId);
    if (!modificador) throw new RecursoNoEncontradoError('ModificadorDiseno', input.modificadorId);

    if (!servicio.activo) {
      throw new ConflictoDeNegocioError('SERVICIO_INACTIVO', 'No se puede modificar el catálogo de un servicio dado de baja.', {
        servicioId: servicio.id,
      });
    }
    if (!modificador.activo) {
      throw new ConflictoDeNegocioError('MODIFICADOR_INACTIVO', 'No se puede vincular un modificador dado de baja.', {
        modificadorId: modificador.id,
      });
    }

    const yaVinculado = await this.servicioRepository.estaModificadorVinculado(input.servicioId, input.modificadorId);
    if (yaVinculado) {
      throw new ConflictoDeNegocioError('MODIFICADOR_YA_VINCULADO', 'El modificador ya está vinculado a este servicio.', { ...input });
    }

    await this.unitOfWork.ejecutar(async () => {
      await this.servicioRepository.vincularModificador(input.servicioId, input.modificadorId);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'servicio_modificador',
        entidadAfectadaId: servicio.id,
        detalle: { accion: 'vincular_modificador_a_servicio', modificadorId: modificador.id },
      });
    });
  }
}
