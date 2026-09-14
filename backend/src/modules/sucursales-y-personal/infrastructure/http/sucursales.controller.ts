import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { CrearSucursalUseCase } from '../../application/use-cases/crear-sucursal.use-case';
import { ActualizarConfiguracionSucursalUseCase } from '../../application/use-cases/actualizar-configuracion-sucursal.use-case';
import { ListarSucursalesUseCase } from '../../application/use-cases/listar-sucursales.use-case';
import { ConsultarSucursalUseCase } from '../../application/use-cases/consultar-sucursal.use-case';
import { AgregarDiaFestivoUseCase } from '../../application/use-cases/agregar-dia-festivo.use-case';
import { EliminarDiaFestivoUseCase } from '../../application/use-cases/eliminar-dia-festivo.use-case';
import { ActivarModoMantenimientoUseCase } from '../../application/use-cases/activar-modo-mantenimiento.use-case';
import { DesactivarModoMantenimientoUseCase } from '../../application/use-cases/desactivar-modo-mantenimiento.use-case';
import { CrearSucursalDto } from './dto/crear-sucursal.dto';
import { ActualizarSucursalDto } from './dto/actualizar-sucursal.dto';
import { AgregarDiaFestivoDto } from './dto/agregar-dia-festivo.dto';
import { sucursalAJson, diaFestivoAJson } from './sucursal.presenter';

/**
 * `/v1/sucursales-y-personal/sucursales` — FL-SUC-01, FL-SUC-02 (05-api-design.md §1/§10).
 * Permisos por endpoint (functional-scope.md §2): Super Admin y Administrador escriben;
 * cualquier rol autenticado lee.
 */
@Controller('v1/sucursales-y-personal/sucursales')
export class SucursalesController {
  constructor(
    private readonly crearSucursal: CrearSucursalUseCase,
    private readonly actualizarConfiguracion: ActualizarConfiguracionSucursalUseCase,
    private readonly listarSucursales: ListarSucursalesUseCase,
    private readonly consultarSucursal: ConsultarSucursalUseCase,
    private readonly agregarDiaFestivo: AgregarDiaFestivoUseCase,
    private readonly eliminarDiaFestivo: EliminarDiaFestivoUseCase,
    private readonly activarMantenimiento: ActivarModoMantenimientoUseCase,
    private readonly desactivarMantenimiento: DesactivarModoMantenimientoUseCase,
  ) {}

  @Get()
  async listar() {
    const sucursales = await this.listarSucursales.ejecutar();
    return { sucursales: sucursales.map(sucursalAJson) };
  }

  @Get(':id')
  async consultar(@Param('id') id: string) {
    const { sucursal, diasFestivos } = await this.consultarSucursal.ejecutar(id);
    return { ...sucursalAJson(sucursal), diasFestivos: diasFestivos.map(diaFestivoAJson) };
  }

  @Post()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  async crear(@Body() dto: CrearSucursalDto, @CurrentUser() usuario: ClaimsUsuario) {
    const sucursal = await this.crearSucursal.ejecutar(dto, usuario);
    return sucursalAJson(sucursal);
  }

  @Patch(':id')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  async actualizar(@Param('id') id: string, @Body() dto: ActualizarSucursalDto, @CurrentUser() usuario: ClaimsUsuario) {
    const sucursal = await this.actualizarConfiguracion.ejecutar({ sucursalId: id, ...dto }, usuario);
    return sucursalAJson(sucursal);
  }

  @Post(':id/dias-festivos')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  async agregarFestivo(@Param('id') id: string, @Body() dto: AgregarDiaFestivoDto, @CurrentUser() usuario: ClaimsUsuario) {
    const diaFestivo = await this.agregarDiaFestivo.ejecutar({ sucursalId: id, ...dto }, usuario);
    return diaFestivoAJson(diaFestivo);
  }

  @Delete('dias-festivos/:diaFestivoId')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(204)
  async eliminarFestivo(@Param('diaFestivoId') diaFestivoId: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.eliminarDiaFestivo.ejecutar({ id: diaFestivoId }, usuario);
  }

  /** RN-SUC-02: precondición explícita de la regla — Rol Super Admin, sin excepción. */
  @Post(':id/activar-mantenimiento')
  @Roles(Rol.SUPER_ADMIN)
  @HttpCode(204)
  async activarMantenimientoSucursal(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.activarMantenimiento.ejecutar({ sucursalId: id }, usuario);
  }

  @Post(':id/desactivar-mantenimiento')
  @Roles(Rol.SUPER_ADMIN)
  @HttpCode(204)
  async desactivarMantenimientoSucursal(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.desactivarMantenimiento.ejecutar({ sucursalId: id }, usuario);
  }
}
