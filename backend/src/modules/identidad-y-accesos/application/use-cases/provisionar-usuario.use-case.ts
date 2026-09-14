import { Inject, Injectable } from '@nestjs/common';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../domain/ports/usuario.repository';
import { IDENTIDAD_EXTERNA_PORT, IdentidadExternaPort } from '../../domain/ports/identidad-externa.port';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { ConflictoDeNegocioError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

export interface ProvisionarUsuarioInput {
  usuarioId: string;
}

/**
 * Caso de uso — `FL-SEG-06`, alcance "Solo Provisionar" (`DEC-025`), mecanismo `createUser` sin
 * contraseña (`DEC-028`).
 *
 * QUÉ HACE: crea la cuenta de acceso en el proveedor externo para un usuario de Blanc **que ya
 * existe**, y persiste el identificador devuelto como `usuarios.supabase_user_id`. Eso es todo:
 * "provisionar" termina ahí.
 *
 * QUÉ NO HACE, deliberadamente: no crea el registro administrativo (eso es `FL-SEG-01`), no
 * establece credenciales, no envía invitación, no habilita el login, no adopta cuentas
 * preexistentes (`DEC-028` dejó esa política `PENDING`), no sincroniza en sentido inverso.
 * Un usuario provisionado **no queda por ello autenticable ni autorizado** — son tres estados
 * distintos, ver `BLANC_MASTER_CONTEXT.txt` III.15.
 *
 * FRONTERA TRANSACCIONAL (regla crítica): la llamada de red al proveedor ocurre **fuera** de
 * `unitOfWork.ejecutar()`. `UnitOfWork` solo protege atomicidad dentro de PostgreSQL; una
 * petición HTTP dentro de la transacción no sería reversible por ella y, peor, mantendría una
 * transacción y sus locks abiertos durante toda la latencia de un sistema externo. La
 * transacción envuelve únicamente las dos escrituras locales (vínculo + auditoría).
 *
 * SIN ATOMICIDAD CROSS-SYSTEM: entre crear la cuenta y persistir el vínculo existe una ventana
 * en la que un fallo deja una cuenta huérfana en el proveedor. Está asumido y documentado
 * (`IDENTIDAD_PRE_ARRANQUE.md` §2, escenario 1); no se simula un rollback que no existe.
 */
@Injectable()
export class ProvisionarUsuarioUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarioRepository: UsuarioRepository,
    @Inject(IDENTIDAD_EXTERNA_PORT) private readonly identidadExterna: IdentidadExternaPort,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: ProvisionarUsuarioInput, actor: ClaimsUsuario): Promise<void> {
    const usuario = await this.usuarioRepository.buscarPorId(input.usuarioId);
    if (!usuario) throw new RecursoNoEncontradoError('Usuario', input.usuarioId);

    // Idempotente: ya provisionado — no-op exitoso, sin llamar al proveedor ni auditar. Mismo
    // criterio que `DesactivarUsuarioUseCase` ante un usuario ya desactivado (`DEC-013`).
    if (usuario.estaProvisionado) return;

    // --- Frontera: lo que sigue sale de PostgreSQL y no es reversible por la transacción. ---
    const cuenta = await this.identidadExterna.crearCuenta({ email: usuario.email });

    await this.unitOfWork.ejecutar(async () => {
      const vinculado = await this.usuarioRepository.vincularCuentaExterna(usuario.id, cuenta.id);

      if (!vinculado) {
        // Otra ejecución simultánea ganó la carrera y ya dejó un vínculo. No se machaca: se
        // aborta. La cuenta que esta ejecución acaba de crear queda huérfana en el proveedor —
        // consecuencia inevitable de no tener atomicidad cross-system, y su reconciliación
        // depende de la política de adopción, `PENDING` (`DEC-028`).
        throw new ConflictoDeNegocioError(
          'USUARIO_YA_PROVISIONADO',
          'Otra operación provisionó a este usuario simultáneamente. No se modificó el vínculo existente.',
          { usuarioId: usuario.id },
        );
      }

      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'usuario',
        entidadAfectadaId: usuario.id,
        // RN-AUD-01 + minimización de datos personales: nunca el email aquí, ni el identificador
        // de la cuenta externa. El log de auditoría tiene retención indefinida; el email se
        // resuelve consultando `usuarios` cuando haga falta.
        detalle: { accion: 'provisionar_usuario' },
      });
    });
  }
}
