import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { CrearModificadorDisenoUseCase } from '../../application/use-cases/crear-modificador-diseno.use-case';
import { ObtenerModificadoresDisenoUseCase } from '../../application/use-cases/obtener-modificadores-diseno.use-case';
import { ActualizarModificadorDisenoUseCase } from '../../application/use-cases/actualizar-modificador-diseno.use-case';
import { DesactivarModificadorDisenoUseCase } from '../../application/use-cases/desactivar-modificador-diseno.use-case';
import { CrearModificadorDisenoDto } from './dto/crear-modificador-diseno.dto';
import { ActualizarModificadorDisenoDto } from './dto/actualizar-modificador-diseno.dto';
import { modificadorDisenoAJson } from './catalogo.presenter';

/**
 * `/v1/catalogo-y-cotizacion/modificadores-diseno` — `FL-COT-01`.
 *
 * Recurso **de primer nivel**, no anidado bajo `/servicios/:id/modificadores`: `ModificadorDiseno`
 * es un aggregate raíz independiente y reutilizable entre servicios (01-domain-discovery.md §5.2).
 *
 * Mismo RBAC mixto por método que `ServiciosController` — ver su nota.
 */
@Controller('v1/catalogo-y-cotizacion/modificadores-diseno')
export class ModificadoresDisenoController {
  constructor(
    private readonly crearModificador: CrearModificadorDisenoUseCase,
    private readonly obtenerModificadores: ObtenerModificadoresDisenoUseCase,
    private readonly actualizarModificador: ActualizarModificadorDisenoUseCase,
    private readonly desactivarModificador: DesactivarModificadorDisenoUseCase,
  ) {}

  @Get()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE, Rol.RECEPCIONISTA)
  async listar() {
    const modificadores = await this.obtenerModificadores.ejecutar();
    return { modificadoresDiseno: modificadores.map(modificadorDisenoAJson) };
  }

  @Post()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  async crear(@Body() dto: CrearModificadorDisenoDto, @CurrentUser() usuario: ClaimsUsuario) {
    const modificador = await this.crearModificador.ejecutar(dto, usuario);
    return modificadorDisenoAJson(modificador);
  }

  @Patch(':id')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  async actualizar(@Param('id') id: string, @Body() dto: ActualizarModificadorDisenoDto, @CurrentUser() usuario: ClaimsUsuario) {
    const modificador = await this.actualizarModificador.ejecutar({ modificadorId: id, ...dto }, usuario);
    return modificadorDisenoAJson(modificador);
  }

  @Post(':id/desactivar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(204)
  async desactivar(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.desactivarModificador.ejecutar({ modificadorId: id }, usuario);
  }
}
