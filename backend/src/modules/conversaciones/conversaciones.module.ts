import { Module } from '@nestjs/common';
import { CONVERSACION_REPOSITORY } from './domain/ports/conversacion.repository';
import { DrizzleConversacionRepository } from './infrastructure/persistence/drizzle-conversacion.repository';
import { PROVEEDOR_WHATSAPP_PORT } from './domain/ports/proveedor-whatsapp.port';
import { CloudApiAdapter } from './infrastructure/meta/cloud-api.adapter';
import { WhatsAppSoloLogAdapter } from './infrastructure/meta/whatsapp-solo-log.adapter';
import { VerificadorDeFirmaMeta } from './infrastructure/meta/verificador-de-firma';
import { TOKEN_VERIFICACION_META, WebhookMetaController } from './infrastructure/meta/webhook-meta.controller';
import { BandejaController } from './infrastructure/http/bandeja.controller';
import { ActualizarEstadoDeEntregaUseCase, RecibirMensajeUseCase } from './application/use-cases/recibir-mensaje.use-case';
import {
  CambiarModoConversacionUseCase,
  ConsultarBandejaUseCase,
  ConsultarHiloUseCase,
  EnviarMensajeManualUseCase,
  EnviarPlantillaUseCase,
  RegistrarNumeroDeSucursalUseCase,
} from './application/use-cases/bandeja.use-cases';

/**
 * Módulo del Bounded Context **Conversaciones / Mensajería** (`ADR-001`, `ADR-002`) — Fase 4
 * Parte 2.
 *
 * `CONTEXTO_CLIENTA_DE_CONVERSACION_PORT` **no se provee aquí**: lo provee `IntegracionModule`,
 * porque su adaptador necesita ver CRM. Este módulo declara el puerto en su dominio y nada más —
 * la regla que cerró `P5`.
 *
 * ## EL PROVEEDOR DE WHATSAPP SE ELIGE POR CONFIGURACIÓN, NO POR CÓDIGO
 *
 * Con `WHATSAPP_ACCESS_TOKEN` presente se usa el adaptador real de la Cloud API; sin él, el de
 * solo-log. **El valor por defecto es el que no envía nada**, y es deliberado: el trámite de alta
 * con Meta está pendiente, así que lo peligroso sería lo contrario — un despliegue intentando
 * hablar con Meta sin credenciales, o peor, enviando mensajes reales desde un entorno de prueba.
 *
 * El secreto se lee de entorno y **nunca** se escribe en el repositorio.
 */
@Module({
  controllers: [WebhookMetaController, BandejaController],
  providers: [
    { provide: CONVERSACION_REPOSITORY, useClass: DrizzleConversacionRepository },
    {
      provide: PROVEEDOR_WHATSAPP_PORT,
      useFactory: () => {
        const token = process.env.WHATSAPP_ACCESS_TOKEN;
        return token ? new CloudApiAdapter(token) : new WhatsAppSoloLogAdapter();
      },
    },
    {
      provide: VerificadorDeFirmaMeta,
      // Cadena vacía si falta el secreto: ninguna firma real coincidirá nunca con un HMAC
      // calculado sobre `''`, así que el webhook **falla cerrado**. Es lo correcto — un webhook sin
      // App Secret no puede distinguir a Meta de un tercero, y dejarlo pasar sería peor que
      // rechazarlo todo.
      useFactory: () => new VerificadorDeFirmaMeta(process.env.META_APP_SECRET ?? ''),
    },
    {
      provide: TOKEN_VERIFICACION_META,
      // Cadena vacía si falta: ningún reto real de Meta traerá `''`, así que el `GET` de
      // verificación **falla cerrado**. Aceptar un reto con token vacío permitiría que un tercero
      // registrase nuestra URL en su propia app de Meta.
      useFactory: () => process.env.META_VERIFY_TOKEN ?? '',
    },
    RecibirMensajeUseCase,
    ActualizarEstadoDeEntregaUseCase,
    ConsultarBandejaUseCase,
    ConsultarHiloUseCase,
    EnviarMensajeManualUseCase,
    EnviarPlantillaUseCase,
    CambiarModoConversacionUseCase,
    RegistrarNumeroDeSucursalUseCase,
  ],
  // Los exporta para que `IntegracionModule` construya los adaptadores de notificación que hoy
  // solo escriben en el log (recordatorios y lista de espera).
  exports: [CONVERSACION_REPOSITORY, PROVEEDOR_WHATSAPP_PORT, EnviarPlantillaUseCase],
})
export class ConversacionesModule {}
