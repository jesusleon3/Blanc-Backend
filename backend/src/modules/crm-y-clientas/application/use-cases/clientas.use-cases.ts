import { Inject, Injectable } from '@nestjs/common';
import { Clienta, normalizarTelefono } from '../../domain/entities/clienta.entity';
import { CLIENTA_REPOSITORY, ClientaRepository, IncidenteRegistrado } from '../../domain/ports/clienta.repository';
import { TipoDeIncidente } from '../../../../database/schema';
import { AUDITORIA_PORT, AuditoriaPort } from '../../../../shared/auditoria/auditoria.port';
import { RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';
import { ClaimsUsuario } from '../../../../shared/auth/rol';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/persistence/unit-of-work.port';

/** Alta de clienta. El estado inicial es `normal` (`RN-CRM-02`). */
@Injectable()
export class RegistrarClientaUseCase {
  constructor(
    @Inject(CLIENTA_REPOSITORY) private readonly clientas: ClientaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: { nombre: string; telefono: string }, actor: ClaimsUsuario): Promise<Clienta> {
    const clienta = Clienta.registrar(input);

    await this.unitOfWork.ejecutar(async () => {
      await this.clientas.guardar(clienta);
      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'clienta',
        entidadAfectadaId: clienta.id,
        // `RN-AUD-01`: ni nombre ni teléfono en el detalle. Son PII, y la auditoría registra el
        // hecho, no el expediente — el `entidadAfectadaId` ya permite llegar al registro.
        detalle: { accion: 'registrar_clienta' },
      });
    });

    return clienta;
  }
}

/**
 * Búsqueda por teléfono. **Devuelve una lista.**
 *
 * Es el caso de mamá e hija: comparten el número de contacto y son dos clientas distintas. Quien
 * atiende elige. Devolver una sola obligaría a inventar un desempate y acertaría la mitad de las
 * veces — con el agravante de que el historial de incidentes equivocado es el que decide si se le
 * pide anticipo a alguien.
 */
@Injectable()
export class BuscarClientasPorTelefonoUseCase {
  constructor(@Inject(CLIENTA_REPOSITORY) private readonly clientas: ClientaRepository) {}

  ejecutar(input: { telefono: string }): Promise<Clienta[]> {
    // Se normaliza igual que al guardar, o un `442 123 4567` no encontraría al `4421234567`.
    return this.clientas.buscarPorTelefono(normalizarTelefono(input.telefono));
  }
}

/** Reencuentra a quien cambió de número: escribe desde uno nuevo y da su nombre y el viejo. */
@Injectable()
export class BuscarClientaPorTelefonoAnteriorUseCase {
  constructor(@Inject(CLIENTA_REPOSITORY) private readonly clientas: ClientaRepository) {}

  ejecutar(input: { nombre: string; telefonoAnterior: string }): Promise<Clienta[]> {
    return this.clientas.buscarPorNombreYTelefonoAnterior(input.nombre.trim(), normalizarTelefono(input.telefonoAnterior));
  }
}

export interface DetalleDeClienta {
  clienta: Clienta;
  incidentes: IncidenteRegistrado[];
}

/** Detalle con historial: es lo que la Dueña mira antes de decidir si marca a alguien. */
@Injectable()
export class ConsultarClientaUseCase {
  constructor(@Inject(CLIENTA_REPOSITORY) private readonly clientas: ClientaRepository) {}

  async ejecutar(input: { clientaId: string }): Promise<DetalleDeClienta> {
    const clienta = await this.clientas.buscarPorId(input.clientaId);
    if (!clienta) throw new RecursoNoEncontradoError('Clienta', input.clientaId);

    return { clienta, incidentes: await this.clientas.listarIncidentes(clienta.id) };
  }
}

@Injectable()
export class CambiarTelefonoClientaUseCase {
  constructor(
    @Inject(CLIENTA_REPOSITORY) private readonly clientas: ClientaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: { clientaId: string; nuevoTelefono: string }, actor: ClaimsUsuario): Promise<Clienta> {
    const clienta = await this.clientas.buscarPorId(input.clientaId);
    if (!clienta) throw new RecursoNoEncontradoError('Clienta', input.clientaId);

    clienta.cambiarTelefono(input.nuevoTelefono);

    await this.unitOfWork.ejecutar(async () => {
      await this.clientas.guardar(clienta);
      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'clienta',
        entidadAfectadaId: clienta.id,
        // Sin el número: cambiar de teléfono queda registrado, el teléfono no (`RN-AUD-01`).
        detalle: { accion: 'cambiar_telefono_clienta' },
      });
    });

    return clienta;
  }
}

export type AccionDeRiesgo = 'marcar_lista_roja' | 'marcar_bloqueada' | 'rehabilitar';

/**
 * Cambia el estado de riesgo. **Exclusivo de la Dueña** (`DEC-042`), impuesto por `@Roles` en el
 * controlador.
 *
 * POR QUÉ ES UN SOLO CASO DE USO Y NO TRES. Las tres acciones comparten precondición (la clienta
 * existe), efecto colateral (apagar la sugerencia) y obligación de auditoría. Tres casos de uso
 * habrían repetido eso tres veces, con el riesgo de que el día que cambie la obligación de
 * auditoría solo se actualicen dos.
 *
 * `RN-CRM-07` — **no retroactivo**: marcar lista roja no toca las citas ya confirmadas. Aquí se
 * ve en lo que este caso de uso **no hace**: no busca citas, no las revisa y no habla con Agenda.
 * El estado se consulta al agendar, y lo ya agendado se queda como está.
 */
@Injectable()
export class CambiarEstadoDeRiesgoUseCase {
  constructor(
    @Inject(CLIENTA_REPOSITORY) private readonly clientas: ClientaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: { clientaId: string; accion: AccionDeRiesgo; motivo?: string }, actor: ClaimsUsuario): Promise<Clienta> {
    const clienta = await this.clientas.buscarPorId(input.clientaId);
    if (!clienta) throw new RecursoNoEncontradoError('Clienta', input.clientaId);

    const estadoAnterior = clienta.estadoDeRiesgo;
    const veniaSugerida = clienta.sugeridaListaRoja;

    if (input.accion === 'marcar_lista_roja') clienta.marcarListaRoja();
    else if (input.accion === 'marcar_bloqueada') clienta.marcarBloqueada();
    else clienta.rehabilitar();

    await this.unitOfWork.ejecutar(async () => {
      await this.clientas.guardar(clienta);
      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'clienta',
        entidadAfectadaId: clienta.id,
        detalle: {
          accion: input.accion,
          estadoAnterior,
          estadoNuevo: clienta.estadoDeRiesgo,
          // Si venía sugerida por el sistema o fue decisión propia de la Dueña. Es la diferencia
          // entre "atendió una alerta" y "lo decidió ella", y en una reclamación importa.
          veniaSugeridaPorElSistema: veniaSugerida,
          motivo: input.motivo,
        },
      });
    });

    return clienta;
  }
}

/**
 * Registra un incidente y **enciende la sugerencia** (`RN-CRM-06`). Lo invoca `IntegracionModule`
 * desde Agenda al cancelar tarde, reagendar tarde o marcar un `no_show`.
 *
 * ⚠️ **NUNCA cambia `estadoDeRiesgo`.** `RN-CRM-05`: *"el sistema solo sugiere, nunca decide por
 * sí mismo"*. Si este caso de uso marcara lista roja, la facultad exclusiva de la Dueña
 * (`DEC-042`) dejaría de existir en la práctica aunque siguiera escrita en el endpoint.
 */
@Injectable()
export class RegistrarIncidenteClientaUseCase {
  constructor(
    @Inject(CLIENTA_REPOSITORY) private readonly clientas: ClientaRepository,
    @Inject(AUDITORIA_PORT) private readonly auditoria: AuditoriaPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(
    input: { clientaId: string; citaId: string; tipo: TipoDeIncidente; ocurridoEn: Date; minutosDeAntelacion: number },
    actor: ClaimsUsuario,
  ): Promise<Clienta> {
    const clienta = await this.clientas.buscarPorId(input.clientaId);
    if (!clienta) throw new RecursoNoEncontradoError('Clienta', input.clientaId);

    clienta.registrarIncidente(input.tipo);

    await this.unitOfWork.ejecutar(async () => {
      await this.clientas.registrarIncidente(input);
      await this.clientas.guardar(clienta);
      await this.auditoria.registrar({
        tipoAccion: 'cambio_configuracion',
        actor: actor.sub,
        entidadAfectadaTipo: 'clienta',
        entidadAfectadaId: clienta.id,
        detalle: {
          accion: 'registrar_incidente_clienta',
          tipo: input.tipo,
          citaId: input.citaId,
          minutosDeAntelacion: input.minutosDeAntelacion,
          sugeridaListaRoja: clienta.sugeridaListaRoja,
        },
      });
    });

    return clienta;
  }
}

/**
 * Cancelación **ordinaria** (más de 60 minutos de antelación): incrementa el contador y **no
 * sugiere nada**.
 *
 * Ver la nota de `Clienta.registrarCancelacionOrdinaria`: `RN-CRM-06` descartó expresamente el
 * umbral acumulado, así que este contador es contexto para la Dueña, no un disparador.
 */
@Injectable()
export class RegistrarCancelacionOrdinariaUseCase {
  constructor(
    @Inject(CLIENTA_REPOSITORY) private readonly clientas: ClientaRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async ejecutar(input: { clientaId: string }): Promise<Clienta | null> {
    const clienta = await this.clientas.buscarPorId(input.clientaId);
    // `null` y no 404: una cancelación no debe fallar porque la clienta no esté en CRM. El dato
    // que se pierde es un contador de contexto, no una regla.
    if (!clienta) return null;

    clienta.registrarCancelacionOrdinaria();
    await this.unitOfWork.ejecutar(async () => {
      await this.clientas.guardar(clienta);
    });

    return clienta;
  }
}
