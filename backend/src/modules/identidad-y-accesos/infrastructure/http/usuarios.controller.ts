import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { CrearUsuarioUseCase } from '../../application/use-cases/crear-usuario.use-case';
import { EditarUsuarioCambiarRolUseCase } from '../../application/use-cases/editar-usuario-cambiar-rol.use-case';
import { AsignarUsuarioASucursalUseCase } from '../../application/use-cases/asignar-usuario-a-sucursal.use-case';
import { RemoverUsuarioDeSucursalUseCase } from '../../application/use-cases/remover-usuario-de-sucursal.use-case';
import { DesactivarUsuarioUseCase } from '../../application/use-cases/desactivar-usuario.use-case';
import { ProvisionarUsuarioUseCase } from '../../application/use-cases/provisionar-usuario.use-case';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { EditarUsuarioDto } from './dto/editar-usuario.dto';
import { usuarioAJson } from './usuario.presenter';

/**
 * `/v1/identidad-y-accesos/usuarios` — FL-SEG-01/03/04/05, alcance mínimo. Alta, edición,
 * asignación/remoción de sucursal y desactivación del registro administrativo. Sin `GET`
 * (`POST`/`PATCH` ya devuelven el recurso completo; asignar/remover/desactivar son `204`, mismo
 * patrón que `manicuristas.controller.ts`). Sin Supabase (`FL-SEG-06`), sin MFA (`FL-SEG-07`),
 * sin reactivar (fuera de alcance de `FL-SEG-05`, ver `decision-flows-catalogo-diseno.md`).
 */
@Controller('v1/identidad-y-accesos/usuarios')
export class UsuariosController {
  constructor(
    private readonly crearUsuario: CrearUsuarioUseCase,
    private readonly editarUsuario: EditarUsuarioCambiarRolUseCase,
    private readonly asignarASucursal: AsignarUsuarioASucursalUseCase,
    private readonly removerDeSucursal: RemoverUsuarioDeSucursalUseCase,
    private readonly desactivarUsuario: DesactivarUsuarioUseCase,
    private readonly provisionarUsuario: ProvisionarUsuarioUseCase,
  ) {}

  @Post()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  async crear(@Body() dto: CrearUsuarioDto, @CurrentUser() usuario: ClaimsUsuario) {
    const creado = await this.crearUsuario.ejecutar(dto, usuario);
    return usuarioAJson(creado);
  }

  @Patch(':id')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  async editar(@Param('id') id: string, @Body() dto: EditarUsuarioDto, @CurrentUser() usuario: ClaimsUsuario) {
    const editado = await this.editarUsuario.ejecutar({ usuarioId: id, ...dto }, usuario);
    return usuarioAJson(editado);
  }

  @Post(':id/sucursales/:sucursalId')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(204)
  async asignar(@Param('id') id: string, @Param('sucursalId') sucursalId: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.asignarASucursal.ejecutar({ usuarioId: id, sucursalId }, usuario);
  }

  @Delete(':id/sucursales/:sucursalId')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(204)
  async remover(@Param('id') id: string, @Param('sucursalId') sucursalId: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.removerDeSucursal.ejecutar({ usuarioId: id, sucursalId }, usuario);
  }

  @Post(':id/desactivar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(204)
  async desactivar(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.desactivarUsuario.ejecutar({ usuarioId: id }, usuario);
  }

  /**
   * `FL-SEG-06` — provisiona la cuenta de acceso del usuario en el proveedor de identidad.
   * `204` sin cuerpo, igual que las demás mutaciones sin recurso que devolver. Idempotente: si ya
   * estaba provisionado responde `204` sin efectos (`DEC-028`).
   */
  @Post(':id/provisionar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(204)
  async provisionar(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.provisionarUsuario.ejecutar({ usuarioId: id }, usuario);
  }
}
