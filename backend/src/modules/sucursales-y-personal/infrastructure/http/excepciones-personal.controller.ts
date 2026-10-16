import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import {
  ListarExcepcionesPersonalUseCase,
  RegistrarExcepcionPersonalUseCase,
  ResultadoExcepcion,
} from '../../application/use-cases/registrar-excepcion-personal.use-case';
import { ListarExcepcionesDto, RegistrarAusenciaDto, RegistrarCoberturaDto } from './dto/excepcion-personal.dto';

export const excepcionAJson = (excepcion: ResultadoExcepcion['excepcion']) => ({
  id: excepcion.id,
  manicuristaId: excepcion.manicuristaId,
  tipo: excepcion.tipo,
  sucursalId: excepcion.sucursalId,
  inicio: excepcion.rango.inicio.toISOString(),
  fin: excepcion.rango.fin.toISOString(),
  motivo: excepcion.motivo,
});

const aJson = ({ excepcion, citasAfectadas }: ResultadoExcepcion) => ({
  excepcion: excepcionAJson(excepcion),
  // Siempre presente, aunque esté vacía: que el cliente no tenga que adivinar si "no vino" el
  // campo significa "no hay daño" o "no se calculó".
  citasAfectadas,
});

/**
 * `/v1/sucursales-y-personal/excepciones` — ausencias y coberturas (`DEC-036`).
 *
 * Lo opera quien está en el salón: `GERENTE` (Encargada) además de la Dueña. Es un registro
 * **del día**, no configuración de catálogo — si solo pudiera capturarlo Administración, nadie lo
 * anotaría a las 8 de la mañana cuando alguien avisa que no viene, y el motor de disponibilidad
 * seguiría contando con una persona que no está.
 */
@Controller('v1/sucursales-y-personal/excepciones')
export class ExcepcionesPersonalController {
  constructor(
    private readonly registrarExcepcion: RegistrarExcepcionPersonalUseCase,
    private readonly listarExcepciones: ListarExcepcionesPersonalUseCase,
  ) {}

  /**
   * Las ausencias y coberturas que solapan un rango.
   *
   * **Sin esto, una excepción mal capturada era irreversible desde la interfaz**: para revocarla
   * hace falta su id, y el id solo existía en la respuesta del `POST` que la creó. `DEC-036` se
   * construyó con tres escrituras y ninguna lectura porque su único consumidor era el
   * `MotorDisponibilidad`, que va al repositorio directamente.
   */
  @Get()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async listar(@Query() query: ListarExcepcionesDto) {
    const excepciones = await this.listarExcepciones.ejecutar({
      rango: { inicio: new Date(query.inicio), fin: new Date(query.fin) },
      ...(query.sucursalId ? { sucursalId: query.sucursalId } : {}),
    });
    return { excepciones: excepciones.map(excepcionAJson) };
  }

  @Post('ausencias')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async ausencia(@Body() dto: RegistrarAusenciaDto, @CurrentUser() usuario: ClaimsUsuario) {
    const resultado = await this.registrarExcepcion.registrarAusencia(
      { manicuristaId: dto.manicuristaId, rango: { inicio: new Date(dto.inicio), fin: new Date(dto.fin) }, motivo: dto.motivo },
      usuario,
    );
    return aJson(resultado);
  }

  @Post('coberturas')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async cobertura(@Body() dto: RegistrarCoberturaDto, @CurrentUser() usuario: ClaimsUsuario) {
    const resultado = await this.registrarExcepcion.registrarCobertura(
      {
        manicuristaId: dto.manicuristaId,
        sucursalId: dto.sucursalId,
        rango: { inicio: new Date(dto.inicio), fin: new Date(dto.fin) },
        motivo: dto.motivo,
      },
      usuario,
    );
    return aJson(resultado);
  }

  /** Se capturó mal. La capacidad vuelve sola en cuanto desaparece el registro. */
  @Delete(':id')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(204)
  async revocar(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.registrarExcepcion.revocar({ excepcionId: id }, usuario);
  }
}
