import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { RegistrarExcepcionPersonalUseCase, ResultadoExcepcion } from '../../application/use-cases/registrar-excepcion-personal.use-case';
import { RegistrarAusenciaDto, RegistrarCoberturaDto } from './dto/excepcion-personal.dto';

const aJson = ({ excepcion, citasAfectadas }: ResultadoExcepcion) => ({
  excepcion: {
    id: excepcion.id,
    manicuristaId: excepcion.manicuristaId,
    tipo: excepcion.tipo,
    sucursalId: excepcion.sucursalId,
    inicio: excepcion.rango.inicio.toISOString(),
    fin: excepcion.rango.fin.toISOString(),
    motivo: excepcion.motivo,
  },
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
  constructor(private readonly registrarExcepcion: RegistrarExcepcionPersonalUseCase) {}

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
