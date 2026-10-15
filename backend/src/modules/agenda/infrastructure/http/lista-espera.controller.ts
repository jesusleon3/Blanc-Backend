import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import {
  AceptarOfertaListaEsperaUseCase,
  AvanzarTurnoListaEsperaUseCase,
  CancelarSolicitudListaEsperaUseCase,
  ConsultarListaEsperaUseCase,
  InscribirEnListaEsperaUseCase,
} from '../../application/use-cases/lista-espera.use-cases';
import { AceptarOfertaDto, AvanzarTurnoDto, ConsultarListaEsperaDto, InscribirEnListaEsperaDto } from './dto/lista-espera.dto';
import { SolicitudListaEspera } from '../../domain/entities/solicitud-lista-espera.entity';
import { citaAJson } from './cita.presenter';

const solicitudAJson = (solicitud: SolicitudListaEspera) => ({
  id: solicitud.id,
  sucursalId: solicitud.sucursalId,
  clientaId: solicitud.clientaId,
  servicioId: solicitud.servicioId,
  fecha: solicitud.fecha,
  estado: solicitud.estado,
  notificadaEn: solicitud.notificadaEn?.toISOString() ?? null,
  expiraEn: solicitud.expiraEn?.toISOString() ?? null,
  citaId: solicitud.citaId,
  creadoEn: solicitud.creadoEn.toISOString(),
});

/**
 * `/v1/agenda/lista-espera` — demanda que no cupo (`DEC-039`).
 *
 * **RBAC: `Super Admin`, `Administrador` y `Gerente`.** La `MANICURISTA` queda fuera por completo,
 * incluso de la lectura: la fila contiene `clientaId` de personas que no son sus clientas, y su
 * vista de iPad no transporta datos de clientas por diseño (`DEC-040`). La `RECEPCIONISTA`
 * tampoco, por coherencia con el resto de la API de Agenda, donde no agenda ni cancela.
 *
 * ⚠️ **HOY NINGÚN AVISO SALE DEL SISTEMA.** El canal de WhatsApp es de Fase 4 (`DEC-043`). La
 * oferta se registra con su ventana corriendo, y **la Encargada avisa a mano** mirando
 * `GET /v1/agenda/lista-espera`. Ese `GET` no es una comodidad: es hoy la única forma de saber a
 * quién hay que llamar.
 */
@Controller('v1/agenda/lista-espera')
export class ListaEsperaController {
  constructor(
    private readonly inscribir: InscribirEnListaEsperaUseCase,
    private readonly consultar: ConsultarListaEsperaUseCase,
    private readonly aceptar: AceptarOfertaListaEsperaUseCase,
    private readonly avanzarTurno: AvanzarTurnoListaEsperaUseCase,
    private readonly cancelar: CancelarSolicitudListaEsperaUseCase,
  ) {}

  /** La fila viva de una sucursal en una fecha, **en orden de llegada**. */
  @Get()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async listar(@Query() query: ConsultarListaEsperaDto) {
    const fila = await this.consultar.ejecutar(query);
    return { solicitudes: fila.map(solicitudAJson) };
  }

  @Post()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async inscribirSolicitud(@Body() dto: InscribirEnListaEsperaDto, @CurrentUser() usuario: ClaimsUsuario) {
    return solicitudAJson(await this.inscribir.ejecutar(dto, usuario));
  }

  /** Acepta la oferta y **agenda la cita de verdad**, validando disponibilidad en ese instante. */
  @Post(':id/aceptar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(201)
  async aceptarOferta(@Param('id') id: string, @Body() dto: AceptarOfertaDto, @CurrentUser() usuario: ClaimsUsuario) {
    const { solicitud, cita } = await this.aceptar.ejecutar(
      { solicitudId: id, inicio: new Date(dto.inicio), manicuristaId: dto.manicuristaId ?? null },
      usuario,
    );
    return { solicitud: solicitudAJson(solicitud), cita: citaAJson(cita, usuario) };
  }

  /**
   * Cierra los turnos vencidos y pasa el hueco a la siguiente de la fila.
   *
   * **Es el sustituto explícito del planificador que Blanc no tiene todavía.** Lo dispara la
   * Encargada, o un job runner externo llamándolo cada pocos minutos. Cuando exista un
   * planificador (decisión de arquitectura con su propia ADR), solo cambia quién llama: ni el
   * caso de uso ni este endpoint se reescriben.
   */
  @Post('avanzar-turno')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(200)
  async avanzar(@Body() dto: AvanzarTurnoDto, @CurrentUser() usuario: ClaimsUsuario) {
    const { expiradas, nuevasOfertas } = await this.avanzarTurno.ejecutar({ minutosDeVentana: dto.minutosDeVentana }, usuario);
    return { expiradas: expiradas.map(solicitudAJson), nuevasOfertas: nuevasOfertas.map(solicitudAJson) };
  }

  @Delete(':id')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(204)
  async cancelarSolicitud(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    await this.cancelar.ejecutar({ solicitudId: id }, usuario);
  }
}
