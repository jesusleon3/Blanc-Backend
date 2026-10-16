import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import {
  ConfirmarPagoAnticipoUseCase,
  ConsultarAnticiposUseCase,
  ExpirarAnticipoUseCase,
  GenerarAnticipoUseCase,
} from '../../application/use-cases/anticipos.use-cases';
import {
  ANTICIPOS_POR_PAGINA_POR_DEFECTO,
  ConfirmarPagoDto,
  ExpirarAnticipoDto,
  GenerarAnticipoDto,
  ListarAnticiposDto,
} from './dto/anticipo.dto';
import { Anticipo } from '../../domain/entities/anticipo.entity';

export const anticipoAJson = (anticipo: Anticipo) => ({
  id: anticipo.id,
  citaId: anticipo.citaId,
  clientaId: anticipo.clientaId,
  montoCentavos: anticipo.montoCentavos,
  porcentajeAplicado: anticipo.porcentajeAplicado,
  estado: anticipo.estado,
  referenciaPago: anticipo.referenciaPago,
  confirmadoPor: anticipo.confirmadoPor,
  confirmadoEn: anticipo.confirmadoEn?.toISOString() ?? null,
  creadoEn: anticipo.creadoEn.toISOString(),
});

/**
 * `/v1/anticipos` — anticipos por transferencia manual (`RN-ANT-01` a `RN-ANT-04`).
 *
 * ## RBAC: LA `MANICURISTA` NO ENTRA, Y EL MOTIVO NO ES EL DINERO
 *
 * `SUPER_ADMIN`, `ADMINISTRADOR` y `GERENTE`. La `MANICURISTA` recibe `403` en **todas** las
 * rutas, y la razón es más fina que "no es asunto suyo": **saber que una clienta pagó anticipo es
 * saber que está en lista roja**. Solo las clientas de lista roja pagan anticipo (`RN-ANT-01`),
 * así que la existencia de un anticipo **revela el estado de riesgo por inferencia**. La Dueña fue
 * explícita en que la Manicurista no ve lista roja (`DEC-040`), y dejarle ver anticipos la haría
 * deducible — una fuga indirecta de exactamente el dato que se protege en el presenter de la
 * agenda.
 *
 * La `RECEPCIONISTA` tampoco, por coherencia con el resto de la plataforma.
 */
@Controller('v1/anticipos')
export class AnticiposController {
  constructor(
    private readonly generar: GenerarAnticipoUseCase,
    private readonly confirmar: ConfirmarPagoAnticipoUseCase,
    private readonly expirar: ExpirarAnticipoUseCase,
    private readonly consultar: ConsultarAnticiposUseCase,
  ) {}

  /**
   * Pantalla de conciliación: *"qué transferencias estoy esperando"* (`?estado=pendiente`) o
   * *"qué he cobrado"* (`?estado=pagado`).
   */
  @Get()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async listar(@Query() query: ListarAnticiposDto) {
    const limite = query.limite ?? ANTICIPOS_POR_PAGINA_POR_DEFECTO;
    const desplazamiento = query.desplazamiento ?? 0;
    const { anticipos, hayMas } = await this.consultar.listarPorEstado({ estado: query.estado, limite, desplazamiento });

    return { anticipos: anticipos.map(anticipoAJson), limite, desplazamiento, hayMas };
  }

  /** El anticipo de una cita concreta. 404 si esa cita no lleva anticipo. */
  @Get('de-cita/:citaId')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async deCita(@Param('citaId') citaId: string) {
    return anticipoAJson(await this.consultar.deCita({ citaId }));
  }

  /** Alta manual para servicios sin precio calculable (`DEC-033`). El resto se genera solo. */
  @Post()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async generarAnticipo(@Body() dto: GenerarAnticipoDto, @CurrentUser() usuario: ClaimsUsuario) {
    const anticipo = await this.generar.ejecutar(
      { citaId: dto.citaId, clientaId: dto.clientaId, baseCentavos: null, montoCentavos: dto.montoCentavos },
      usuario,
    );
    return anticipoAJson(anticipo);
  }

  /**
   * Una persona vio la transferencia. **Aquí se resuelve la carrera de `RN-ANT-03`**: la cita pasa
   * de `en_espera_pago` a `agendada` en la misma transacción, y si otra clienta tomó el último
   * hueco entretanto, responde `409 HORARIO_NO_DISPONIBLE` **sin** dejar el pago confirmado.
   */
  @Post(':id/confirmar-pago')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(200)
  async confirmarPago(@Param('id') id: string, @Body() dto: ConfirmarPagoDto, @CurrentUser() usuario: ClaimsUsuario) {
    const { anticipo } = await this.confirmar.ejecutar({ anticipoId: id, referenciaPago: dto.referenciaPago }, usuario);
    return anticipoAJson(anticipo);
  }

  /**
   * La transferencia nunca llegó: el anticipo queda `expirado` y la cita pasa a `expirada`.
   *
   * **Es explícito, no un temporizador**: Blanc no tiene planificador. Lo dispara la Encargada o
   * un job runner externo, igual que `avanzar-turno` de la Lista de Espera.
   */
  @Post(':id/expirar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(200)
  async expirarAnticipo(@Param('id') id: string, @Body() dto: ExpirarAnticipoDto, @CurrentUser() usuario: ClaimsUsuario) {
    return anticipoAJson(await this.expirar.ejecutar({ anticipoId: id, motivo: dto.motivo }, usuario));
  }
}
