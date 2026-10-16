import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import {
  BuscarClientaPorTelefonoAnteriorUseCase,
  BuscarClientasPorTelefonoUseCase,
  CambiarEstadoDeRiesgoUseCase,
  CambiarTelefonoClientaUseCase,
  ConsultarClientaUseCase,
  RegistrarClientaUseCase,
} from '../../application/use-cases/clientas.use-cases';
import {
  BuscarPorTelefonoAnteriorDto,
  BuscarPorTelefonoDto,
  CambiarEstadoDeRiesgoDto,
  CambiarTelefonoDto,
  RegistrarClientaDto,
} from './dto/clienta.dto';
import { Clienta } from '../../domain/entities/clienta.entity';

export const clientaAJson = (clienta: Clienta) => ({
  id: clienta.id,
  nombre: clienta.nombre,
  telefono: clienta.telefono,
  telefonoAnterior: clienta.telefonoAnterior,
  estadoDeRiesgo: clienta.estadoDeRiesgo,
  sugeridaListaRoja: clienta.sugeridaListaRoja,
  cancelacionesOrdinarias: clienta.cancelacionesOrdinarias,
  creadoEn: clienta.creadoEn.toISOString(),
});

/**
 * `/v1/crm/clientas` — Bounded Context de CRM / Clientas.
 *
 * ## RBAC: DOS NIVELES, Y LA FRONTERA ESTÁ EN LA LISTA ROJA
 *
 * - **Operación diaria** (alta, búsqueda, consulta, cambio de teléfono): `SUPER_ADMIN`,
 *   `ADMINISTRADOR` y `GERENTE`. La Encargada es quien atiende el teléfono y da de alta a quien
 *   llama; sin este acceso, nadie podría agendar para una clienta nueva.
 * - **Estado de riesgo** (`lista_roja` / `bloqueada` / rehabilitar): **solo `SUPER_ADMIN` y
 *   `ADMINISTRADOR`** (`DEC-042`). Es una decisión con impacto económico directo sobre la clienta
 *   —le exige anticipo o le impide agendar— y la Dueña se la reservó.
 *
 * **La `MANICURISTA` no entra en ninguna ruta de este controlador.** No es una omisión: la Dueña
 * fue explícita en que no ve lista roja (`DEC-040`), y aquí todo es información de clientas. Su
 * vista de iPad ya está construida para no transportar `clientaId` siquiera.
 *
 * La `RECEPCIONISTA` tampoco, por coherencia con el resto de la plataforma, donde no agenda ni
 * cancela.
 */
@Controller('v1/crm/clientas')
export class ClientasController {
  constructor(
    private readonly registrar: RegistrarClientaUseCase,
    private readonly buscarPorTelefono: BuscarClientasPorTelefonoUseCase,
    private readonly buscarPorTelefonoAnterior: BuscarClientaPorTelefonoAnteriorUseCase,
    private readonly consultar: ConsultarClientaUseCase,
    private readonly cambiarTelefono: CambiarTelefonoClientaUseCase,
    private readonly cambiarEstadoDeRiesgo: CambiarEstadoDeRiesgoUseCase,
  ) {}

  /**
   * Búsqueda por teléfono. **Devuelve una lista**, siempre.
   *
   * Es el caso de mamá e hija: dos clientas distintas con el mismo número de contacto. Quien
   * atiende elige a cuál se refiere la conversación.
   */
  @Get()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async buscar(@Query() query: BuscarPorTelefonoDto) {
    const clientas = await this.buscarPorTelefono.ejecutar(query);
    return { clientas: clientas.map(clientaAJson) };
  }

  /** Reencuentra a quien cambió de número, por nombre + su teléfono anterior. */
  @Get('por-telefono-anterior')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async porTelefonoAnterior(@Query() query: BuscarPorTelefonoAnteriorDto) {
    const clientas = await this.buscarPorTelefonoAnterior.ejecutar(query);
    return { clientas: clientas.map(clientaAJson) };
  }

  /** Detalle con historial de incidentes: lo que la Dueña mira antes de decidir si marca. */
  @Get(':id')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async detalle(@Param('id') id: string) {
    const { clienta, incidentes } = await this.consultar.ejecutar({ clientaId: id });
    return {
      clienta: clientaAJson(clienta),
      incidentes: incidentes.map((incidente) => ({
        id: incidente.id,
        citaId: incidente.citaId,
        tipo: incidente.tipo,
        ocurridoEn: incidente.ocurridoEn.toISOString(),
        minutosDeAntelacion: incidente.minutosDeAntelacion,
      })),
    };
  }

  @Post()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async registrarClienta(@Body() dto: RegistrarClientaDto, @CurrentUser() usuario: ClaimsUsuario) {
    return clientaAJson(await this.registrar.ejecutar(dto, usuario));
  }

  @Post(':id/telefono')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(200)
  async telefono(@Param('id') id: string, @Body() dto: CambiarTelefonoDto, @CurrentUser() usuario: ClaimsUsuario) {
    return clientaAJson(await this.cambiarTelefono.ejecutar({ clientaId: id, nuevoTelefono: dto.nuevoTelefono }, usuario));
  }

  /**
   * Marcar o retirar `lista_roja` / `bloqueada`. **Exclusivo de la Dueña** (`DEC-042`).
   *
   * El `@Roles` de este método es deliberadamente **más estrecho** que el de la clase: la
   * `GERENTE` opera el CRM todos los días pero no decide quién paga anticipo. Es la única
   * asimetría de permisos dentro de este controlador, y es la razón de que el decorador vaya por
   * método.
   */
  @Post(':id/estado-de-riesgo')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(200)
  async estadoDeRiesgo(@Param('id') id: string, @Body() dto: CambiarEstadoDeRiesgoDto, @CurrentUser() usuario: ClaimsUsuario) {
    return clientaAJson(await this.cambiarEstadoDeRiesgo.ejecutar({ clientaId: id, accion: dto.accion, motivo: dto.motivo }, usuario));
  }
}
