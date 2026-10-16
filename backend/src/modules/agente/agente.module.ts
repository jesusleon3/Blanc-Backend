import { Global, Logger, Module } from '@nestjs/common';
import { AgendaModule } from '../agenda/agenda.module';
import { CatalogoYCotizacionModule } from '../catalogo-y-cotizacion/catalogo-y-cotizacion.module';
import { CrmYClientasModule } from '../crm-y-clientas/crm-y-clientas.module';
import { AnticiposModule } from '../anticipos/anticipos.module';
import { ConversacionesModule } from '../conversaciones/conversaciones.module';
import { ORQUESTADOR_DE_BOT_PORT } from '../conversaciones/domain/ports/orquestador-de-bot.port';
import { OrquestadorInactivoAdapter } from '../conversaciones/infrastructure/orquestador-inactivo.adapter';
import { AGENTE_CONVERSACIONAL_PORT } from './domain/agente-conversacional.port';
import { PRESUPUESTO_DE_IA_PORT } from './domain/presupuesto-de-ia.port';
import { PresupuestoDeIaEnPostgres, TOPE_DIARIO_POR_DEFECTO } from './infrastructure/presupuesto-de-ia.adapter';
import { DATABASE_CONNECTION, type Database } from '../../database/connection';
import { AgenteDeterministicoAdapter } from './infrastructure/llm/agente-deterministico.adapter';
import { MODELO_POR_DEFECTO, OpenAiAgenteAdapter } from './infrastructure/llm/openai.adapter';
import { OrquestadorDeBotUseCase } from './application/orquestador-de-bot.use-case';
import { HerramientasDelBot } from './application/herramientas-del-bot';

/**
 * Módulo del **Agente Conversacional (Bot IA)** — cierre de Fase 4.
 *
 * ## POR QUÉ ES UN MÓDULO APARTE Y NO PARTE DE `Conversaciones`
 *
 * No es un Bounded Context: es un **adaptador conductor**, igual que `PlanificadorModule`. Lo que
 * decide no es dominio propio —el dominio vive en Agenda, Catálogo, CRM y Anticipos—, sino *cuándo
 * invocar a quién*. Separarlo compra tres cosas concretas:
 *
 * 1. **`Conversaciones` funciona sin él.** El canal de WhatsApp, la Bandeja Compartida y el handoff
 *    no dependen del bot: `ConversacionesModule` provee `OrquestadorInactivoAdapter` por defecto y
 *    este módulo lo sobrescribe. **Quitar esta línea de `AppModule` es el plan de rollback
 *    completo** — el canal sigue operando, atendido por personas.
 * 2. **El bot puede consumir varios BC sin que `Conversaciones` los conozca.** Si las herramientas
 *    vivieran dentro de `Conversaciones`, ese BC tendría que importar Agenda, Catálogo, CRM y
 *    Anticipos, y dejaría de ser un BC para volverse el centro del monolito.
 * 3. **La frontera de la IA queda en un solo directorio.** Todo lo que toca un modelo de lenguaje
 *    está en `modules/agente/`. Auditar `RN-CONV-01` es leer esta carpeta, no buscar por el árbol.
 *
 * ## `@Global`, Y POR QUÉ `Conversaciones` NO DECLARA UN VALOR POR DEFECTO
 *
 * Es `@Global` por la misma razón que `IntegracionModule`: provee un puerto que declara otro BC, y
 * si `Conversaciones` tuviera que importar este módulo para recibirlo, aparecería el ciclo que
 * `madge --circular` prohíbe (`P5`).
 *
 * La primera versión dejaba el adaptador inerte como valor por defecto **dentro** de
 * `ConversacionesModule`, confiando en que este módulo lo sobrescribiría al registrarse después.
 * **`@Global` no sobrescribe: un proveedor local gana siempre.** El bot quedaba inerte con todo en
 * verde, y lo destapó `bot.e2e.spec.ts` montando el grafo completo. Hoy `Conversaciones` declara
 * el puerto y no lo provee, igual que hace con `CONTEXTO_CLIENTA_DE_CONVERSACION_PORT`, y
 * `sin-defaults-locales.spec.ts` impide que vuelva a aparecer un defecto de esta familia.
 *
 * ## EL INTÉRPRETE SE ELIGE POR ENTORNO, Y EL DEFECTO NO ES OPENAI
 *
 * Sin `OPENAI_API_KEY` se usa `AgenteDeterministicoAdapter`. No es una degradación: es un modo de
 * operación válido en el que el bot atiende lo trivial y escala el resto. Así, un despliegue sin
 * credenciales —o con OpenAI deliberadamente apagado— **no deja el canal sin bot ni intenta hablar
 * con un servicio para el que no hay contrato**.
 *
 * ## `BOT_ACTIVO=false` ES EL PLAN DE ROLLBACK
 *
 * Con esa variable el puerto recibe `OrquestadorInactivoAdapter` y **el bot no contesta a nadie**:
 * el canal, la Bandeja y el handoff siguen funcionando, atendidos por personas. Es el mismo
 * mecanismo que `PLANIFICADOR_ACTIVO` (`ADR-025`) y por la misma razón: la vuelta atrás tiene que
 * ser un cambio de configuración, verificable y reversible en un despliegue, no un cambio de
 * código.
 */
@Global()
@Module({
  imports: [ConversacionesModule, AgendaModule, CatalogoYCotizacionModule, CrmYClientasModule, AnticiposModule],
  providers: [
    HerramientasDelBot,
    {
      /**
       * **El cortacircuitos de gasto de IA (`F-07`).**
       *
       * `OPENAI_MAX_LLAMADAS_DIA` lo configura; sin la variable, el tope por defecto **existe y es
       * finito**. Un valor por defecto ilimitado dejaría sin protección justo a quien no la
       * configure, que es quien más la necesita. `0` apaga el modelo por completo.
       *
       * Un valor no numérico se trata como "no configurado" en vez de como `NaN`: un typo en la
       * variable no debe desactivar el tope en silencio.
       */
      provide: PRESUPUESTO_DE_IA_PORT,
      useFactory: (db: Database) => {
        const crudo = process.env.OPENAI_MAX_LLAMADAS_DIA;
        const configurado = crudo === undefined || crudo.trim() === '' ? null : Number(crudo);
        const tope = configurado !== null && Number.isInteger(configurado) && configurado >= 0 ? configurado : TOPE_DIARIO_POR_DEFECTO;

        if (configurado !== null && tope !== configurado) {
          new Logger('AgenteModule').warn(
            `OPENAI_MAX_LLAMADAS_DIA="${crudo}" no es un entero >= 0; se usa el tope por defecto (${TOPE_DIARIO_POR_DEFECTO}).`,
          );
        }
        return new PresupuestoDeIaEnPostgres(db, tope);
      },
      inject: [DATABASE_CONNECTION],
    },
    {
      provide: AGENTE_CONVERSACIONAL_PORT,
      useFactory: () => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          // Un log al arranque, porque la diferencia es visible para la Dueña: el bot entenderá
          // menos. Que sea explícito evita el diagnóstico de "el bot escala todo y no sé por qué".
          new Logger('AgenteModule').log('Sin OPENAI_API_KEY: el intérprete determinista atiende el canal y escala lo demás.');
          return new AgenteDeterministicoAdapter();
        }
        return new OpenAiAgenteAdapter(apiKey, process.env.OPENAI_MODELO ?? MODELO_POR_DEFECTO);
      },
    },
    OrquestadorDeBotUseCase,
    OrquestadorInactivoAdapter,
    {
      provide: ORQUESTADOR_DE_BOT_PORT,
      // `useFactory` con las dos instancias inyectadas, y no `useExisting`: así `BOT_ACTIVO=false`
      // deja el puerto apuntando al adaptador inerte sin tocar una línea de código.
      useFactory: (real: OrquestadorDeBotUseCase, inerte: OrquestadorInactivoAdapter) => {
        if (process.env.BOT_ACTIVO === 'false') {
          new Logger('AgenteModule').warn('BOT_ACTIVO=false: el bot NO responderá. El canal queda atendido solo por personas.');
          return inerte;
        }
        return real;
      },
      inject: [OrquestadorDeBotUseCase, OrquestadorInactivoAdapter],
    },
  ],
  exports: [ORQUESTADOR_DE_BOT_PORT, AGENTE_CONVERSACIONAL_PORT, PRESUPUESTO_DE_IA_PORT, HerramientasDelBot, OrquestadorDeBotUseCase],
})
export class AgenteModule {}
