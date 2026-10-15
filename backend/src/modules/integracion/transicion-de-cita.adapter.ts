import { Injectable } from '@nestjs/common';
import { TransicionDeCitaPort } from '../anticipos/domain/ports/transicion-de-cita.port';
import { TransicionarCitaPorAnticipoUseCase } from '../agenda/application/use-cases/transicionar-cita-por-anticipo.use-case';
import { ClaimsUsuario, Rol } from '../../shared/auth/rol';

/**
 * Lo que **Anticipos le pide a Agenda**: mover la cita cuando el dinero cambia de estado.
 *
 * Es el sentido que `P5` señalaba (`FL-ANT-01` → `FL-AGE-09`). No hay invocación directa entre
 * contextos: Anticipos declara el puerto, Agenda expone el caso de uso y este adaptador los une.
 *
 * **No traga ningún error, a diferencia de los otros adaptadores de salida.** Y es deliberado:
 * aquí el fallo *tiene que* propagar. Si la cita no se puede activar porque otra clienta tomó el
 * hueco, la confirmación del pago debe deshacerse por completo — es la carrera de `RN-ANT-03`
 * resolviéndose, no una avería que convenga registrar y seguir. Tragárselo dejaría un anticipo
 * `pagado` contra una cita que sigue en `en_espera_pago`.
 */
@Injectable()
export class TransicionDeCitaAdapter implements TransicionDeCitaPort {
  constructor(private readonly transicionar: TransicionarCitaPorAnticipoUseCase) {}

  async activarPorPagoConfirmado(citaId: string): Promise<void> {
    await this.transicionar.activar({ citaId }, this.actorDelSistema());
  }

  async expirarPorAnticipoNoPagado(citaId: string): Promise<void> {
    await this.transicionar.expirar({ citaId }, this.actorDelSistema());
  }

  private actorDelSistema(): ClaimsUsuario {
    return { sub: 'sistema:regla-de-anticipos', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL', manicuristaId: null };
  }
}
