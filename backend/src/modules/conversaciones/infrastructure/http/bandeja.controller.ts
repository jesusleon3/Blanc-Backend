import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../../../shared/auth/roles.decorator';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import {
  CambiarModoConversacionUseCase,
  ConsultarBandejaUseCase,
  ContarEscaladasPendientesUseCase,
  ConsultarHiloUseCase,
  EnviarMensajeManualUseCase,
  EnviarPlantillaUseCase,
  RegistrarNumeroDeSucursalUseCase,
} from '../../application/use-cases/bandeja.use-cases';
import {
  ContarEscaladasDto,
  EnviarMensajeDto,
  EnviarPlantillaDto,
  EscalarDto,
  ListarBandejaDto,
  ListarMensajesDto,
  RegistrarNumeroDto,
} from './dto/bandeja.dto';
import { Conversacion } from '../../domain/entities/conversacion.entity';
import { PLANTILLAS_DE_WHATSAPP } from '../../domain/plantillas';

const conversacionAJson = (conversacion: Conversacion) => ({
  id: conversacion.id,
  sucursalId: conversacion.sucursalId,
  telefonoClienta: conversacion.telefonoClienta,
  clientaId: conversacion.clientaId,
  modo: conversacion.modo,
  motivoDeEscalamiento: conversacion.motivoDeEscalamiento,
  escaladaEn: conversacion.escaladaEn?.toISOString() ?? null,
  ultimaInteraccionEntranteEn: conversacion.ultimaInteraccionEntranteEn?.toISOString() ?? null,
  ultimoMensajeEn: conversacion.ultimoMensajeEn?.toISOString() ?? null,
  mensajesSinResponder: conversacion.mensajesSinResponder,
  creadoEn: conversacion.creadoEn.toISOString(),
});

/**
 * `/v1/conversaciones` — **Bandeja Compartida** (Shared Inbox).
 *
 * ## ESTO NO ES UNA COMODIDAD DEL PANEL: ES CONDICIÓN DE PUESTA EN MARCHA
 *
 * `DEC-043` lo cambió todo: dar de alta un número en la Cloud API **lo desconecta de la app de
 * WhatsApp Business**. El momento de migrar un número es exactamente el momento en que el celular
 * deja de poder responder, así que **ningún número puede migrarse antes de que esta bandeja esté
 * en producción y probada**. Si el orden se invierte, el salón se queda incomunicado.
 *
 * ## RBAC: `SUPER_ADMIN`, `ADMINISTRADOR` y `GERENTE`
 *
 * La `MANICURISTA` recibe `403` en **todas** las rutas. No es una omisión: un hilo de WhatsApp
 * contiene el teléfono de la clienta, lo que escribió y, por inferencia, su relación con el salón
 * — exactamente la clase de dato que su vista de iPad está construida para no transportar
 * (`DEC-040`). Y la `RECEPCIONISTA` tampoco, por coherencia con el resto de la plataforma.
 *
 * El alta de números (`POST /numeros`) es más estrecha todavía: solo Administración. Mapear un
 * `phone_number_id` a la sucursal equivocada **desviaría las conversaciones de una sucursal a
 * otra**, y es un trámite de configuración, no de turno.
 */
@Controller('v1/conversaciones')
export class BandejaController {
  constructor(
    private readonly consultarBandeja: ConsultarBandejaUseCase,
    private readonly consultarHilo: ConsultarHiloUseCase,
    private readonly enviarMensaje: EnviarMensajeManualUseCase,
    private readonly enviarPlantilla: EnviarPlantillaUseCase,
    private readonly cambiarModo: CambiarModoConversacionUseCase,
    private readonly registrarNumero: RegistrarNumeroDeSucursalUseCase,
    private readonly contarEscaladas: ContarEscaladasPendientesUseCase,
  ) {}

  /** La cola de trabajo. Filtros por sucursal, modo y pendientes de responder. */
  @Get()
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async listar(@Query() query: ListarBandejaDto) {
    const { conversaciones, hayMas } = await this.consultarBandeja.listar(query);
    return { conversaciones: conversaciones.map(conversacionAJson), hayMas };
  }

  /**
   * El hilo completo, **con el estado de la ventana de 24 h**.
   *
   * La ventana viaja en la respuesta a propósito: quien abre la conversación tiene que saber
   * **antes de escribir** si puede mandar texto libre o necesita plantilla. Descubrirlo al pulsar
   * enviar sería redactar un mensaje para que el sistema lo rechace.
   */
  /**
   * Contador de conversaciones escaladas y sin atender, para el badge del panel.
   *
   * **Declarado antes de `@Get(':id')` a propósito.** Nest resuelve las rutas en orden de
   * declaración: si `:id` fuera primero, capturaría `escaladas` como si fuera un UUID y esta ruta
   * nunca se alcanzaría. Moverla abajo la rompe en silencio, con un `400` de validación de UUID
   * que no parece un problema de orden de rutas.
   */
  /**
   * El catálogo de plantillas aprobadas, para el selector del panel.
   *
   * **Declarado antes de `@Get(':id')`**, por la misma razón que `escaladas/pendientes`: Nest
   * resuelve en orden de declaración y `:id` capturaría `plantillas` como si fuera un UUID.
   *
   * ⚠️ **El catálogo es provisional (`N-14` abierto).** Lo sirve el backend en lugar de dejar que
   * el frontend lo lleve escrito porque entonces habría dos listas y un día divergirían — y el
   * síntoma sería un envío rechazado por Meta sin causa visible.
   */
  @Get('plantillas')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  plantillasDisponibles() {
    return { plantillas: PLANTILLAS_DE_WHATSAPP, provisional: true, pendiente: 'N-14' };
  }

  @Get('escaladas/pendientes')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async escaladasPendientes(@Query() query: ContarEscaladasDto) {
    const resumen = await this.contarEscaladas.ejecutar({ sucursalId: query.sucursalId });
    return {
      total: resumen.total,
      porSucursal: resumen.porSucursal,
      masAntiguaEn: resumen.masAntiguaEn?.toISOString() ?? null,
    };
  }

  @Get(':id')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  async hilo(@Param('id') id: string, @Query() query: ListarMensajesDto) {
    const { conversacion, mensajes, estadoDeVentana } = await this.consultarHilo.ejecutar({
      conversacionId: id,
      limite: query.limite,
      desplazamiento: query.desplazamiento,
    });

    return {
      conversacion: conversacionAJson(conversacion),
      estadoDeVentana,
      ventanaAbierta: estadoDeVentana === 'abierta',
      mensajes: mensajes.map((mensaje) => ({
        id: mensaje.id,
        wamid: mensaje.wamid,
        direccion: mensaje.direccion,
        emisor: mensaje.emisor,
        tipo: mensaje.tipo,
        contenido: mensaje.contenido,
        estadoEntrega: mensaje.estadoEntrega,
        errorDeEnvio: mensaje.errorDeEnvio,
        ocurridoEn: mensaje.ocurridoEn.toISOString(),
      })),
    };
  }

  /**
   * Responder como humano. **Toma la conversación automáticamente** (modo `humano`).
   *
   * Responde `409 VENTANA_24H_CERRADA` si pasaron más de 24 horas desde el último mensaje de la
   * clienta: entonces hay que usar `POST /:id/plantilla`.
   */
  @Post(':id/mensajes')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(201)
  async responder(@Param('id') id: string, @Body() dto: EnviarMensajeDto, @CurrentUser() usuario: ClaimsUsuario) {
    const { conversacion, wamid } = await this.enviarMensaje.ejecutar({ conversacionId: id, texto: dto.texto }, usuario);
    return { conversacion: conversacionAJson(conversacion), wamid };
  }

  /** Plantilla aprobada: la única vía con la ventana cerrada, y válida también si está abierta. */
  @Post(':id/plantilla')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(201)
  async plantilla(@Param('id') id: string, @Body() dto: EnviarPlantillaDto, @CurrentUser() usuario: ClaimsUsuario) {
    const { conversacion, wamid } = await this.enviarPlantilla.ejecutar(
      { conversacionId: id, plantilla: dto.plantilla, idioma: dto.idioma, parametros: dto.parametros, comoHumano: true },
      usuario,
    );
    return { conversacion: conversacionAJson(conversacion), wamid };
  }

  @Post(':id/escalar')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(200)
  async escalar(@Param('id') id: string, @Body() dto: EscalarDto, @CurrentUser() usuario: ClaimsUsuario) {
    return conversacionAJson(await this.cambiarModo.escalar({ conversacionId: id, motivo: dto.motivo }, usuario));
  }

  /**
   * Devuelve el control al bot. **Es la única salida del modo `humano`** (`RN-ESC-03`).
   *
   * No hay ninguna vía automática: ni por inactividad, ni por tiempo. Una clienta que pidió hablar
   * con alguien y recibe de nuevo al bot a los diez minutos concluye que nadie la escuchó.
   */
  @Post(':id/devolver-al-bot')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR, Rol.GERENTE)
  @HttpCode(200)
  async devolverAlBot(@Param('id') id: string, @CurrentUser() usuario: ClaimsUsuario) {
    return conversacionAJson(await this.cambiarModo.devolverAlBot({ conversacionId: id }, usuario));
  }

  /**
   * Mapea un `phone_number_id` de Meta a una sucursal. **Sin este alta, los webhooks de ese número
   * se descartan** — es el primer paso de la migración de cada número.
   */
  @Post('numeros')
  @Roles(Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)
  @HttpCode(201)
  async numero(@Body() dto: RegistrarNumeroDto, @CurrentUser() usuario: ClaimsUsuario) {
    await this.registrarNumero.ejecutar(dto, usuario);
    return { phoneNumberId: dto.phoneNumberId, sucursalId: dto.sucursalId };
  }
}
