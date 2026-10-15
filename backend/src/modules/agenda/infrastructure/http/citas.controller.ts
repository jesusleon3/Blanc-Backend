import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { AgendarCitaUseCase } from '../../application/use-cases/agendar-cita.use-case';
import { AsignarManicuristaEnSucursalUseCase } from '../../application/use-cases/asignar-manicurista-en-sucursal.use-case';
import { SolicitarConfirmacionCitaUseCase } from '../../application/use-cases/solicitar-confirmacion-cita.use-case';
import { ConfirmarCitaUseCase } from '../../application/use-cases/confirmar-cita.use-case';
import { CancelarCitaUseCase } from '../../application/use-cases/cancelar-cita.use-case';
import { ReprogramarCitaUseCase } from '../../application/use-cases/reprogramar-cita.use-case';
import { MarcarNoShowUseCase } from '../../application/use-cases/marcar-no-show.use-case';
import { CompletarCitaUseCase } from '../../application/use-cases/completar-cita.use-case';
import { ConsultarAgendaUseCase } from '../../application/use-cases/consultar-agenda.use-case';
import { AgendarCitaDto, AsignarManicuristaDto, CancelarCitaDto, ConsultarAgendaDto, ReprogramarCitaDto } from './dto/agendar-cita.dto';
import { citaAJson } from './cita.presenter';

/**
 * `/v1/agenda/citas` — ciclo de vida de la cita.
 *
 * **RBAC, con una asimetría deliberada.** Todas las mutaciones exigen `SUPER_ADMIN`,
 * `ADMINISTRADOR` (Dueña) o `GERENTE` (Encargada, `DEC-039`). `MANICURISTA` **solo lee, y solo
 * lo suyo**: la Dueña fue explícita en que el iPad sirve para "ver agenda y anotar los servicios
 * prestados", y que la manicurista **no marca llegada ni finalización** (`DEC-040`).
 *
 * **Códigos de respuesta.** Solo `POST /citas` y `POST /:id/reprogramar` devuelven `201`, porque
 * son los únicos que hacen nacer una cita. Las demás son transiciones de estado sobre algo que ya
 * existe y devuelven `200`: un `201 Created` ahí le diría al cliente que se creó un recurso nuevo
 * y que debería buscarlo en otra URL.
 *
 * El `@Roles` va **por método**, no por clase: aquí conviven dos permisos muy distintos y una red
 * de clase los aplanaría. El precio es que **toda ruta nueva debe declarar el suyo** — sin
 * decorador, `RolesGuard` la deja pasar a cualquier autenticado.
 */
@Controller('v1/agenda/citas')
export class CitasController {
  constructor(
    private readonly agendarCita: AgendarCitaUseCase,
    private readonly asignarManicurista: AsignarManicuristaEnSucursalUseCase,
    private readonly solicitarConfirmacion: SolicitarConfirmacionCitaUseCase,
    private readonly confirmarCita: ConfirmarCitaUseCase,
    private readonly cancelarCita: CancelarCitaUseCase,
    private readonly reprogramarCita: ReprogramarCitaUseCase,
    private readonly marcarNoShow: MarcarNoShowUseCase,
    private readonly completarCita: CompletarCitaUseCase,
    private readonly consultarAgenda: ConsultarAgendaUseCase,
  ) {}

  /**
   * Agenda del día. **Una `MANICURISTA` solo ve sus propias citas**, y el filtro NO se toma de la
   * query: se toma de `manicuristaId` resuelto en sus permisos (`P9`). Aceptarlo por parámetro
   * dejaría que cualquiera leyera la agenda ajena cambiando un uuid.
   */
  @Get()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE, Rol.MANICURISTA)
  async listar(@Query() query: ConsultarAgendaDto, @CurrentUser() usuario: ClaimsUsuario) {
    const pagina = await this.consultarAgenda.ejecutar(
      {
        sucursalId: query.sucursalId,
        rangoHorario: { inicio: new Date(query.inicio), fin: new Date(query.fin) },
        limite: query.limite,
        desplazamiento: query.desplazamiento,
      },
      usuario,
    );

    return {
      citas: pagina.citas.map((cita) =>
        citaAJson(cita, usuario, { enListaRoja: pagina.enListaRojaPorClienta.get(cita.clientaId) }),
      ),
      limite: pagina.limite,
      desplazamiento: pagina.desplazamiento,
      hayMas: pagina.hayMas,
    };
  }

  /** Alta normal y **walk-in**: un walk-in es una cita creada en el momento (`DEC-037`). */
  @Post()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async agendar(@Body() dto: AgendarCitaDto, @CurrentUser() usuario: ClaimsUsuario) {
    const cita = await this.agendarCita.ejecutar(
      {
        sucursalId: dto.sucursalId,
        servicioId: dto.servicioId,
        clientaId: dto.clientaId,
        inicio: new Date(dto.inicio),
        // Si no llega, el backend lo deriva de la duración del catálogo.
        fin: dto.fin === undefined ? undefined : new Date(dto.fin),
        manicuristaId: dto.manicuristaId ?? null,
      },
      usuario,
    );
    return citaAJson(cita, usuario);
  }

  @Post(':id/manicurista')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(200)
  async asignar(@Param('id') id: string, @Body() dto: AsignarManicuristaDto, @CurrentUser() usuario: ClaimsUsuario) {
    const cita = await this.asignarManicurista.ejecutar({ citaId: id, manicuristaId: dto.manicuristaId }, usuario);
    return citaAJson(cita, usuario);
  }

  @Post(':id/solicitar-confirmacion')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(200)
  async solicitar(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    return citaAJson(await this.solicitarConfirmacion.ejecutar({ citaId: id }, usuario), usuario);
  }

  @Post(':id/confirmar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(200)
  async confirmar(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    return citaAJson(await this.confirmarCita.ejecutar({ citaId: id }, usuario), usuario);
  }

  /** Devuelve `incidenteTardio` (`RN-CRM-06`). **No marca lista roja**: eso es solo de la Dueña. */
  @Post(':id/cancelar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(200)
  async cancelar(@Param('id') id: string, @Body() dto: CancelarCitaDto, @CurrentUser() usuario: ClaimsUsuario) {
    const { cita, incidenteTardio } = await this.cancelarCita.ejecutar({ citaId: id, motivo: dto.motivo }, usuario);
    return { cita: citaAJson(cita, usuario), incidenteTardio };
  }

  @Post(':id/reprogramar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async reprogramar(@Param('id') id: string, @Body() dto: ReprogramarCitaDto, @CurrentUser() usuario: ClaimsUsuario) {
    const { original, nueva } = await this.reprogramarCita.ejecutar(
      {
        citaId: id,
        nuevoInicio: new Date(dto.inicio),
        nuevoFin: dto.fin === undefined ? undefined : new Date(dto.fin),
        manicuristaId: dto.manicuristaId ?? null,
      },
      usuario,
    );
    return { original: citaAJson(original, usuario), nueva: citaAJson(nueva, usuario) };
  }

  @Post(':id/no-show')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(200)
  async noShow(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    return citaAJson(await this.marcarNoShow.ejecutar({ citaId: id }, usuario), usuario);
  }

  @Post(':id/completar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(200)
  async completar(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    return citaAJson(await this.completarCita.ejecutar({ citaId: id }, usuario), usuario);
  }
}
