import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { CrearServicioUseCase } from '../../application/use-cases/crear-servicio.use-case';
import { ObtenerServiciosUseCase } from '../../application/use-cases/obtener-servicios.use-case';
import { ActualizarServicioUseCase } from '../../application/use-cases/actualizar-servicio.use-case';
import { DesactivarServicioUseCase } from '../../application/use-cases/desactivar-servicio.use-case';
import { VincularModificadorAServicioUseCase } from '../../application/use-cases/vincular-modificador-a-servicio.use-case';
import { DesvincularModificadorDeServicioUseCase } from '../../application/use-cases/desvincular-modificador-de-servicio.use-case';
import { ObtenerModificadoresDeServicioUseCase } from '../../application/use-cases/obtener-modificadores-de-servicio.use-case';
import { CrearServicioDto } from './dto/crear-servicio.dto';
import { ActualizarServicioDto } from './dto/actualizar-servicio.dto';
import { modificadorDisenoAJson, servicioAJson } from './catalogo.presenter';

/**
 * `/v1/catalogo-y-cotizacion/servicios` — `FL-COT-01`.
 *
 * RBAC MIXTO, declarado **por método** (antes era por clase): leer el catálogo y administrarlo son
 * dos permisos distintos. Recepción y Gerencia necesitan leerlo para cotizar (`FL-COT-03`); solo
 * Administración puede alterar precios y duraciones, de los que salen los cobros reales.
 *
 * Al no haber ya un `@Roles` de clase que sirva de red, **toda ruta nueva debe declarar el suyo**:
 * sin decorador, `RolesGuard` la deja pasar a cualquier autenticado.
 */
@Controller('v1/catalogo-y-cotizacion/servicios')
export class ServiciosController {
  constructor(
    private readonly crearServicio: CrearServicioUseCase,
    private readonly obtenerServicios: ObtenerServiciosUseCase,
    private readonly actualizarServicio: ActualizarServicioUseCase,
    private readonly desactivarServicio: DesactivarServicioUseCase,
    private readonly vincularModificadorAServicio: VincularModificadorAServicioUseCase,
    private readonly desvincularModificadorDeServicio: DesvincularModificadorDeServicioUseCase,
    private readonly obtenerModificadoresDeServicio: ObtenerModificadoresDeServicioUseCase,
  ) {}

  /** Lectura ampliada: devuelve el catálogo completo, activos e inactivos. */
  @Get()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE, Rol.RECEPCIONISTA)
  async listar() {
    const servicios = await this.obtenerServicios.ejecutar();
    return { servicios: servicios.map(servicioAJson) };
  }

  @Post()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  async crear(@Body() dto: CrearServicioDto, @CurrentUser() usuario: ClaimsUsuario) {
    const servicio = await this.crearServicio.ejecutar(dto, usuario);
    return servicioAJson(servicio);
  }

  @Patch(':id')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  async actualizar(@Param('id') id: string, @Body() dto: ActualizarServicioDto, @CurrentUser() usuario: ClaimsUsuario) {
    const servicio = await this.actualizarServicio.ejecutar({ servicioId: id, ...dto }, usuario);
    return servicioAJson(servicio);
  }

  /** `204` sin cuerpo, igual que las demás bajas del proyecto. Idempotente. */
  @Post(':id/desactivar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(204)
  async desactivar(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.desactivarServicio.ejecutar({ servicioId: id }, usuario);
  }

  /**
   * Modificadores habilitados para este servicio. Sub-recurso anidado porque **la relación sí es
   * del servicio**, a diferencia del modificador en sí, que es un aggregate independiente y por eso
   * vive en `/modificadores-diseno` de primer nivel.
   *
   * Lectura ampliada igual que `GET /`: es justo lo que Recepción necesita para cotizar.
   */
  @Get(':id/modificadores')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE, Rol.RECEPCIONISTA)
  async listarModificadores(@Param('id') id: string) {
    const modificadores = await this.obtenerModificadoresDeServicio.ejecutar({ servicioId: id });
    return { modificadoresDiseno: modificadores.map(modificadorDisenoAJson) };
  }

  @Post(':id/modificadores/:modificadorId')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(204)
  async vincularModificador(
    @Param('id') id: string,
    @Param('modificadorId') modificadorId: string,
    @CurrentUser() usuario: ClaimsUsuario,
  ) {
    await this.vincularModificadorAServicio.ejecutar({ servicioId: id, modificadorId }, usuario);
  }

  @Delete(':id/modificadores/:modificadorId')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(204)
  async desvincularModificador(
    @Param('id') id: string,
    @Param('modificadorId') modificadorId: string,
    @CurrentUser() usuario: ClaimsUsuario,
  ) {
    await this.desvincularModificadorDeServicio.ejecutar({ servicioId: id, modificadorId }, usuario);
  }
}
