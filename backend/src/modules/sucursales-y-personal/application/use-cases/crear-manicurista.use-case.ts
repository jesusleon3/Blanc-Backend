import { Inject, Injectable } from '@nestjs/common';
import { Manicurista } from '../../domain/entities/manicurista.entity';
import { MANICURISTA_REPOSITORY, ManicuristaRepository } from '../../domain/ports/manicurista.repository';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface CrearManicuristaInput {
  nombre: string;
}

/** Caso de uso — FL-SUC-03 (Gestionar Personal — Alta, RN-SUC-01 categoría "personal"). */
@Injectable()
export class CrearManicuristaUseCase {
  constructor(
    @Inject(MANICURISTA_REPOSITORY) private readonly manicuristaRepository: ManicuristaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: CrearManicuristaInput, actor: ClaimsUsuario): Promise<Manicurista> {
    const manicurista = Manicurista.crear(input);

    await this.unitOfWork.ejecutar(async () => {
      await this.manicuristaRepository.guardar(manicurista);

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'manicurista',
        entidadAfectadaId: manicurista.id,
        detalle: { accion: 'alta_manicurista', nombre: manicurista.nombre },
      });
    });

    return manicurista;
  }
}
