import { Cita } from '../../domain/entities/cita.entity';
import { CitaRepository } from '../../domain/ports/cita.repository';
import { AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';
import { EstadoCita } from '../../../../database/schema';

/**
 * Mecánica compartida por los casos de uso que solo mueven el estado de una cita.
 *
 * **No valida la transición**: eso lo hace `Cita.cambiarEstado()`, que es la única autoridad
 * (`TRANSICIONES_LEGALES`). Si cada caso de uso repitiera la regla, acabarían divergiendo. Aquí
 * solo se resuelve lo repetitivo: buscar, mover, persistir y auditar dentro de una transacción.
 */
export async function aplicarTransicion(
  deps: { citaRepository: CitaRepository; auditoria: AuditoriaPort; unitOfWork: UnitOfWork },
  entrada: { citaId: string; nuevoEstado: EstadoCita; accion: string; actor: ClaimsUsuario; detalleExtra?: Record<string, unknown> },
): Promise<Cita> {
  const cita = await deps.citaRepository.buscarPorId(entrada.citaId);
  if (!cita) throw new RecursoNoEncontradoError('Cita', entrada.citaId);

  const estadoAnterior = cita.estado;
  cita.cambiarEstado(entrada.nuevoEstado);

  await deps.unitOfWork.ejecutar(async () => {
    await deps.citaRepository.guardar(cita);

    await deps.auditoria.registrar({
      tipoAccion: 'agendamiento',
      actor: entrada.actor.sub,
      sucursalRelacionada: cita.sucursalId,
      entidadAfectadaTipo: 'cita',
      entidadAfectadaId: cita.id,
      // El estado anterior se guarda siempre: reconstruir "cómo llegó aquí" es la pregunta que
      // alguien hará cuando una cita acabe donde no esperaba.
      detalle: { accion: entrada.accion, estadoAnterior, estadoNuevo: entrada.nuevoEstado, ...entrada.detalleExtra },
    });
  });

  return cita;
}
