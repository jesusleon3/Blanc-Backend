import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { CrearManicuristaUseCase } from '../../application/use-cases/crear-manicurista.use-case';
import { DesactivarManicuristaUseCase } from '../../application/use-cases/desactivar-manicurista.use-case';
import { ListarManicuristasUseCase } from '../../application/use-cases/listar-manicuristas.use-case';
import { AsignarManicuristaASucursalUseCase } from '../../application/use-cases/asignar-manicurista-a-sucursal.use-case';
import { RemoverManicuristaDeSucursalUseCase } from '../../application/use-cases/remover-manicurista-de-sucursal.use-case';
import { CrearManicuristaDto } from './dto/crear-manicurista.dto';
import { manicuristaAJson } from './sucursal.presenter';

/** `/v1/sucursales-y-personal/manicuristas` — FL-SUC-03 (registro administrativo). */
@Controller('v1/sucursales-y-personal/manicuristas')
export class ManicuristasController {
  constructor(
    private readonly crearManicurista: CrearManicuristaUseCase,
    private readonly desactivarManicurista: DesactivarManicuristaUseCase,
    private readonly listarManicuristas: ListarManicuristasUseCase,
    private readonly asignarASucursal: AsignarManicuristaASucursalUseCase,
    private readonly removerDeSucursal: RemoverManicuristaDeSucursalUseCase,
  ) {}

  @Get()
  async listar() {
    const manicuristas = await this.listarManicuristas.ejecutar();
    return { manicuristas: manicuristas.map(manicuristaAJson) };
  }

  @Post()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  async crear(@Body() dto: CrearManicuristaDto, @CurrentUser() usuario: ClaimsUsuario) {
    const manicurista = await this.crearManicurista.ejecutar(dto, usuario);
    return manicuristaAJson(manicurista);
  }

  @Post(':id/desactivar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(204)
  async desactivar(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.desactivarManicurista.ejecutar({ id }, usuario);
  }

  @Post(':id/sucursales/:sucursalId')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(204)
  async asignar(@Param('id') id: string, @Param('sucursalId') sucursalId: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.asignarASucursal.ejecutar({ manicuristaId: id, sucursalId }, usuario);
  }

  @Delete(':id/sucursales/:sucursalId')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(204)
  async remover(@Param('id') id: string, @Param('sucursalId') sucursalId: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.removerDeSucursal.ejecutar({ manicuristaId: id, sucursalId }, usuario);
  }
}
