import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
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
 * asignación/remoción de sucursal y desactivación del registro administrativo. Sin `GET` de
 * listado o detalle (`POST`/`PATCH` ya devuelven el recurso completo; asignar/remover/desactivar
 * son `204`, mismo patrón que `manicuristas.controller.ts`) — el único `GET` es `/yo`, que no
 * consulta el registro administrativo sino los permisos ya resueltos de quien pregunta. Sin Supabase (`FL-SEG-06`), sin MFA (`FL-SEG-07`),
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

  /**
   * `GET /yo` — **quién soy**: rol, alcance de sucursales y vínculo de manicurista.
   *
   * ## POR QUÉ ESTO TIENE QUE EXISTIR PARA QUE HAYA UN FRONTEND
   *
   * El panel web necesita saber el rol de quien entró **antes** de pintar nada: la Manicurista va
   * a `/mi-agenda` y no debe ver ni un enlace a la Bandeja o a Clientas, y los botones de lista
   * roja solo existen para la Dueña. Sin este endpoint, el frontend tendría que **adivinar el rol
   * desde el JWT**, y eso es exactamente lo que no puede hacer: `DEC-029` establece que el rol y
   * el alcance **no viajan en el token**, se resuelven contra PostgreSQL, porque su fuente de
   * verdad es Blanc y no Supabase.
   *
   * ## NO ES UNA PUERTA DE AUTORIZACIÓN, ES UNA PUERTA DE PRESENTACIÓN
   *
   * Lo que devuelve sirve para **decidir qué se dibuja**, nunca para decidir qué se permite. Cada
   * endpoint revalida su propio `@Roles` con los permisos resueltos en el servidor, así que un
   * cliente que mintiera sobre su rol —o que simplemente navegara a una ruta que no le toca—
   * recibiría `403` igual. Ocultar un botón es una cortesía; la autorización está en el backend.
   *
   * **Sin `@Roles`** a propósito: cualquiera autenticado puede preguntar quién es. Restringirlo
   * por rol sería circular — haría falta conocer el rol para poder preguntar por el rol.
   */
  @Get('yo')
  async yo(@CurrentUser() usuario: ClaimsUsuario) {
    return {
      sub: usuario.sub,
      rol: usuario.rol,
      sucursales: usuario.sucursales,
      manicuristaId: usuario.manicuristaId,
    };
  }

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
