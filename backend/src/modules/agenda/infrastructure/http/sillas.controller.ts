import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { GestionarSillasUseCase } from '../../application/use-cases/gestionar-sillas.use-case';
import { ConsultarDisponibilidadUseCase } from '../../application/use-cases/consultar-disponibilidad.use-case';
import { CrearSillaDto } from './dto/agendar-cita.dto';
import { Silla } from '../../domain/entities/silla.entity';

const sillaAJson = (silla: Silla) => ({
  id: silla.id,
  sucursalId: silla.sucursalId,
  nombre: silla.nombre,
  activa: silla.activa,
});

/**
 * `/v1/agenda/sillas` y `/v1/agenda/disponibilidad`.
 *
 * Las sillas son **configuración de capacidad**, no un recurso de operación diaria: solo
 * `SUPER_ADMIN` y `ADMINISTRADOR` las tocan. La `GERENTE` (Encargada) opera la agenda del día pero
 * no redefine cuántas estaciones tiene el local.
 *
 * La **consulta de disponibilidad** sí es de lectura amplia: la necesitarán la Encargada para
 * atender el teléfono y, más adelante, el bot.
 */
@Controller('v1/agenda')
export class SillasController {
  constructor(
    private readonly gestionarSillas: GestionarSillasUseCase,
    private readonly consultarDisponibilidad: ConsultarDisponibilidadUseCase,
  ) {}

  @Get('sillas')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async listar(@Query('sucursalId') sucursalId: string) {
    return { sillas: (await this.gestionarSillas.listar(sucursalId)).map(sillaAJson) };
  }

  @Post('sillas')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  async crear(@Body() dto: CrearSillaDto, @CurrentUser() usuario: ClaimsUsuario) {
    return sillaAJson(await this.gestionarSillas.crear(dto, usuario));
  }

  @Post('sillas/:id/desactivar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(200)
  async desactivar(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    return sillaAJson(await this.gestionarSillas.desactivar({ sillaId: id }, usuario));
  }

  @Get('disponibilidad')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async disponibilidad(@Query('sucursalId') sucursalId: string, @Query('inicio') inicio: string, @Query('fin') fin: string) {
    return this.consultarDisponibilidad.ejecutar({
      sucursalId,
      rangoHorario: { inicio: new Date(inicio), fin: new Date(fin) },
    });
  }
}
