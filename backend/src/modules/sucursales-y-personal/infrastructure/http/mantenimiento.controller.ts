import { Controller, HttpCode, Post } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { ActivarModoMantenimientoUseCase } from '../../application/use-cases/activar-modo-mantenimiento.use-case';
import { DesactivarModoMantenimientoUseCase } from '../../application/use-cases/desactivar-modo-mantenimiento.use-case';

/** `/v1/sucursales-y-personal/mantenimiento` — RN-SUC-02, alcance global (todas las sucursales). */
@Controller('v1/sucursales-y-personal/mantenimiento')
export class MantenimientoController {
  constructor(
    private readonly activarMantenimiento: ActivarModoMantenimientoUseCase,
    private readonly desactivarMantenimiento: DesactivarModoMantenimientoUseCase,
  ) {}

  @Post('activar-global')
  @Roles(Rol.SUPER_ADMIN)
  @HttpCode(204)
  async activarGlobal(@CurrentUser() usuario: ClaimsUsuario) {
    await this.activarMantenimiento.ejecutar({}, usuario);
  }

  @Post('desactivar-global')
  @Roles(Rol.SUPER_ADMIN)
  @HttpCode(204)
  async desactivarGlobal(@CurrentUser() usuario: ClaimsUsuario) {
    await this.desactivarMantenimiento.ejecutar({}, usuario);
  }
}
