import { Inject, Injectable, Logger } from '@nestjs/common';
import { Conversacion } from '../../conversaciones/domain/entities/conversacion.entity';
import { CONVERSACION_REPOSITORY, ConversacionRepository } from '../../conversaciones/domain/ports/conversacion.repository';
import { ObtenerServiciosUseCase } from '../../catalogo-y-cotizacion/application/use-cases/obtener-servicios.use-case';
/**
 * El tipo de la entidad del catálogo. Legítimo aquí y **no** una violación de `P5`:
 * `modules/agente` es un **adaptador conductor**, no un Bounded Context — importa a los BC y
 * ninguno lo importa a él, que es lo que mantiene `madge --circular` en 0. Es el mismo permiso por
 * el que puede importar `ObtenerServiciosUseCase` cinco líneas arriba.
 */
import { Servicio } from '../../catalogo-y-cotizacion/domain/entities/servicio.entity';
import { ConsultarDisponibilidadUseCase } from '../../agenda/application/use-cases/consultar-disponibilidad.use-case';
import { AgendarCitaUseCase } from '../../agenda/application/use-cases/agendar-cita.use-case';
import { ConfirmarCitaUseCase } from '../../agenda/application/use-cases/confirmar-cita.use-case';
import {
  AceptarOfertaListaEsperaUseCase,
  InscribirEnListaEsperaUseCase,
} from '../../agenda/application/use-cases/lista-espera.use-cases';
import { CITA_REPOSITORY, CitaRepository } from '../../agenda/domain/ports/cita.repository';
import { LISTA_ESPERA_REPOSITORY, ListaEsperaRepository } from '../../agenda/domain/ports/lista-espera.repository';
import { CLIENTA_REPOSITORY, ClientaRepository } from '../../crm-y-clientas/domain/ports/clienta.repository';
import { ConsultarAnticiposUseCase } from '../../anticipos/application/use-cases/anticipos.use-cases';
import { MotivoDeEscalamiento } from '../../../database/schema';
import { Intencion } from '../domain/intencion';
import { resolverCombinacion } from '../domain/resolutor-de-combinaciones';
import { ClaimsUsuario, Rol } from '../../../shared/auth/rol';
import { DomainError } from '../../../shared/errors/domain-error';
import { ZONA_HORARIA_NEGOCIO } from '../../../shared/tiempo/zona-horaria-negocio';

export interface RespuestaDeHerramienta {
  texto: string;
  /** Si viene, el orquestador escala con este motivo en vez de responder. */
  escalar?: MotivoDeEscalamiento;
}

export interface ContextoDeConversacion {
  clientaId: string | null;
  /** Id de la cita en `pendiente_confirmacion`, si hay una. Cierra el ciclo del recordatorio. */
  citaPendienteDeConfirmar: string | null;
  /** Id de la solicitud de lista de espera con oferta abierta, si hay una. */
  ofertaAbierta: string | null;
}

/**
 * Las herramientas del bot: **todo lo que el bot sabe o hace sale de aquí**, no del modelo.
 *
 * Cada método envuelve **casos de uso reales** del backend. El bot no tiene ninguna otra forma de
 * obtener un precio, un horario o una cita, así que `RN-CONV-01` (*la IA interpreta, nunca
 * decide*) deja de depender de que el prompt se respete: depende de que no exista otro camino.
 *
 * **Toda herramienta que tope con una regla de negocio devuelve `escalar`, no un texto inventado.**
 * El bot no interpreta reglas: si la clienta está bloqueada, si no hay cupo, si hace falta
 * anticipo o si el servicio exige cotización manual, lo que devuelve es *"esto lo ve una persona"*.
 */
@Injectable()
export class HerramientasDelBot {
  private readonly logger = new Logger(HerramientasDelBot.name);

  constructor(
    @Inject(CONVERSACION_REPOSITORY) private readonly conversaciones: ConversacionRepository,
    @Inject(CITA_REPOSITORY) private readonly citas: CitaRepository,
    @Inject(LISTA_ESPERA_REPOSITORY) private readonly listaEspera: ListaEsperaRepository,
    @Inject(CLIENTA_REPOSITORY) private readonly clientas: ClientaRepository,
    private readonly servicios: ObtenerServiciosUseCase,
    private readonly disponibilidad: ConsultarDisponibilidadUseCase,
    private readonly agendar: AgendarCitaUseCase,
    private readonly confirmar: ConfirmarCitaUseCase,
    private readonly inscribirEnFila: InscribirEnListaEsperaUseCase,
    private readonly aceptarOfertaUseCase: AceptarOfertaListaEsperaUseCase,
    private readonly anticipos: ConsultarAnticiposUseCase,
  ) {}

  /**
   * Contexto que cambia el significado de la respuesta de la clienta.
   *
   * Un "sí" a secas significa cosas distintas si hay un recordatorio esperando confirmación o una
   * oferta de hueco abierta. Resolverlo aquí —con datos— y no en el modelo es lo que impide que el
   * bot confirme una cita que no existe.
   */
  async contextoDe(conversacion: Conversacion): Promise<ContextoDeConversacion> {
    const clientaId = conversacion.clientaId ?? (await this.identificarClienta(conversacion));

    return {
      clientaId,
      citaPendienteDeConfirmar: clientaId ? await this.citaPendienteDe(clientaId, conversacion.sucursalId) : null,
      ofertaAbierta: clientaId ? await this.ofertaAbiertaDe(clientaId, conversacion.sucursalId) : null,
    };
  }

  /**
   * Identifica a la clienta por su teléfono. **No la registra.**
   *
   * Y no por falta de ganas: con **dos** clientas en el mismo teléfono (mamá e hija) no se puede
   * elegir, y registrar una tercera "por si acaso" ensuciaría el CRM con duplicados cuyo historial
   * de incidentes quedaría partido. Si no se puede identificar, el bot no agenda — escala, y una
   * persona pregunta para quién es la cita.
   */
  private async identificarClienta(conversacion: Conversacion): Promise<string | null> {
    const candidatas = await this.clientas.buscarPorTelefono(conversacion.telefonoClienta);
    return candidatas.length === 1 ? candidatas[0].id : null;
  }

  /**
   * La cita que espera confirmación, **por consulta acotada**.
   *
   * La primera versión barría un rango de 30 días y filtraba en memoria. Lo que la destapó fue una
   * prueba con una cita a cinco meses: el "sí" de la clienta no confirmaba nada y el bot escalaba
   * sin motivo aparente. Ver `buscarPendienteDeConfirmacionDeClienta`.
   */
  private async citaPendienteDe(clientaId: string, sucursalId: string): Promise<string | null> {
    const cita = await this.citas.buscarPendienteDeConfirmacionDeClienta(sucursalId, clientaId);
    return cita?.id ?? null;
  }

  /**
   * La oferta de hueco abierta, **en cualquier fecha**.
   *
   * La primera versión miraba solo la fila de *hoy*, y eso fallaba en el caso normal: se cancela
   * una cita del jueves y el hueco se ofrece el martes. La clienta contestaba "sí lo quiero" y el
   * bot no encontraba ninguna oferta.
   */
  private async ofertaAbiertaDe(clientaId: string, sucursalId: string): Promise<string | null> {
    const solicitud = await this.listaEspera.buscarOfertaAbiertaDeClienta(sucursalId, clientaId);
    return solicitud?.id ?? null;
  }

  /**
   * Catálogo real: nombres y **precios base del Catálogo**, nunca del modelo.
   *
   * Los de cotización manual (`DEC-033`) se marcan explícitamente como "precio a confirmar": dar
   * su precio base como si fuera el final sería exactamente el número inventado que `RN-COT-01`
   * prohíbe. `null` si no hay catálogo, y entonces el orquestador escala.
   */
  async textoDeServicios(): Promise<string | null> {
    const servicios = (await this.servicios.ejecutar()).filter((servicio) => servicio.activo);
    if (servicios.length === 0) return null;

    const lineas = servicios.slice(0, 10).map((servicio) => {
      const precio = (servicio.precioBaseCentavos / 100).toFixed(2);
      return servicio.requiereCotizacionManual
        ? `• ${servicio.nombre}: desde $${precio} (precio exacto a confirmar con una encargada)`
        : `• ${servicio.nombre}: $${precio} · ${servicio.duracionBaseMinutos} min`;
    });

    return `Estos son nuestros servicios:\n${lineas.join('\n')}\n¿Cuál te interesa y para qué día?`;
  }

  /** Disponibilidad real del `MotorDisponibilidad` en la sucursal de la conversación. */
  async textoDeDisponibilidad(sucursalId: string, intencion: Intencion): Promise<RespuestaDeHerramienta> {
    const rango = this.rangoDe(intencion);
    if (!rango) {
      return { texto: '', escalar: 'fuera_de_alcance' };
    }

    const resultado = await this.disponibilidad.ejecutar({ sucursalId, rangoHorario: rango });

    if (!resultado.hayLugar) {
      // No se improvisa una alternativa: el bot ofrece la lista de espera, que es la respuesta
      // que el negocio tiene para esto (`DEC-039`).
      return {
        texto: `A esa hora no tengo lugar. Si quieres, te anoto en la lista de espera para ese día y te aviso si se libera algo.`,
      };
    }

    return { texto: `Sí tengo lugar a esa hora. ¿Te la agendo?` };
  }

  /**
   * Agenda de verdad, con `AgendarCitaUseCase`.
   *
   * Todas las reglas se aplican porque **es el mismo caso de uso que usa el mostrador**: valida el
   * servicio contra Catálogo, deriva la duración, comprueba capacidad, respeta el horario de la
   * sucursal y, si la clienta está en lista roja, **la cita nace en `en_espera_pago` con su
   * anticipo del 40% generado** (`RN-ANT-01`). El bot no reimplementa nada de eso.
   */
  async intentarAgendar(conversacion: Conversacion, intencion: Intencion, textoDeLaClienta = ''): Promise<RespuestaDeHerramienta> {
    const contexto = await this.contextoDe(conversacion);
    if (!contexto.clientaId) {
      // Sin identificar —o con dos clientas en el teléfono— no se agenda: ver `identificarClienta`.
      return { texto: '', escalar: 'solicitud_humana' };
    }

    const servicio = await this.resolverServicio(textoDeLaClienta);
    // `null` puede venir de dos sitios y los dos escalan, pero por motivos distintos: la matriz
    // pidió escalar (diseño complejo) o no se reconoció nada. El primero lo resuelve
    // `resolverServicio` devolviendo el motivo; aquí solo queda el segundo.
    if (servicio === null) return { texto: '', escalar: 'fuera_de_alcance' };
    if ('escalar' in servicio) return { texto: '', escalar: servicio.escalar };
    if (servicio.requiereCotizacionManual) {
      // `DEC-033`: el precio lo fija una persona, así que la cita también.
      return { texto: '', escalar: 'cotizacion_compleja' };
    }

    const rango = this.rangoDe(intencion);
    if (!rango) return { texto: '', escalar: 'fuera_de_alcance' };

    try {
      const cita = await this.agendar.ejecutar(
        { sucursalId: conversacion.sucursalId, servicioId: servicio.id, clientaId: contexto.clientaId, inicio: rango.inicio },
        this.actorDelSistema(),
      );

      if (cita.estado === 'en_espera_pago') {
        const anticipo = await this.anticipos.buscarDeCita(cita.id);
        const monto = anticipo ? (anticipo.montoCentavos / 100).toFixed(2) : null;
        /**
         * Lista roja: la cita **no queda en firme** hasta que una persona valide el comprobante
         * (`RN-ANT-01`, `RN-ANT-03`). El bot da las instrucciones y **escala**, porque validar una
         * transferencia es exactamente lo que no puede hacer: no tiene acceso al banco.
         */
        return {
          texto: monto
            ? `Para dejar tu cita en firme necesitamos un anticipo de $${monto}. Una encargada te manda los datos de transferencia y valida tu comprobante por aquí.`
            : 'Para dejar tu cita en firme necesitamos un anticipo. Una encargada te da los datos por aquí.',
          escalar: 'intervencion_manual',
        };
      }

      return { texto: `Listo, te agendé ${servicio.nombre} el ${this.fechaLegible(rango.inicio)} a las ${this.horaLegible(rango.inicio)}.` };
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;

      // Clienta bloqueada, sin cupo, fuera de horario… **ninguna la resuelve el bot**: son reglas
      // de negocio, y su trabajo es pasarlas a una persona con el motivo correcto.
      if (error.code === 'CLIENTA_BLOQUEADA') return { texto: '', escalar: 'clienta_bloqueada' };
      if (error.code === 'HORARIO_NO_DISPONIBLE' || error.code === 'SILLA_OCUPADA') {
        return await this.ofrecerListaDeEspera(conversacion, contexto.clientaId, servicio.id, intencion);
      }

      this.logger.warn(`Agendar desde el bot falló con ${error.code}; se escala.`);
      return { texto: '', escalar: 'fuera_de_alcance' };
    }
  }

  /** Si no hay cupo, se ofrece la fila (`DEC-039`) en vez de improvisar otro horario. */
  private async ofrecerListaDeEspera(
    conversacion: Conversacion,
    clientaId: string,
    servicioId: string,
    intencion: Intencion,
  ): Promise<RespuestaDeHerramienta> {
    const fecha = intencion.fecha;
    if (!fecha) return { texto: '', escalar: 'fuera_de_alcance' };

    try {
      await this.inscribirEnFila.ejecutar(
        { sucursalId: conversacion.sucursalId, clientaId, servicioId, fecha },
        this.actorDelSistema(),
      );
      return { texto: 'Ese horario ya está tomado. Te anoté en la lista de espera para ese día y te aviso si se libera algo.' };
    } catch (error) {
      if (error instanceof DomainError && error.code === 'LISTA_ESPERA_DUPLICADA') {
        return { texto: 'Ya estabas en la lista de espera para ese día. Te aviso en cuanto se libere algo.' };
      }
      return { texto: '', escalar: 'fuera_de_alcance' };
    }
  }

  /** Cierre del ciclo del recordatorio: `pendiente_confirmacion` → `confirmada`. */
  async confirmarCita(citaId: string): Promise<void> {
    await this.confirmar.ejecutar({ citaId }, this.actorDelSistema());
  }

  /**
   * Cierre del ciclo de la Lista de Espera: la clienta acepta dentro de su ventana.
   *
   * La hora la decide `AceptarOfertaListaEsperaUseCase` a partir del hueco que se le ofreció, y
   * **puede fallar con 409** si alguien tomó el lugar mientras contestaba (`RN-AGE-13`): la oferta
   * nunca retuvo nada. Ese caso escala, porque explicárselo bien a la clienta es trabajo de una
   * persona.
   */
  async aceptarOferta(solicitudId: string): Promise<RespuestaDeHerramienta> {
    const solicitud = await this.listaEspera.buscarPorId(solicitudId);
    if (!solicitud?.huecoInicio) return { texto: '', escalar: 'fuera_de_alcance' };

    try {
      await this.aceptarOfertaUseCase.ejecutar({ solicitudId, inicio: solicitud.huecoInicio }, this.actorDelSistema());
      return { texto: `¡Listo! Te agendé el ${this.fechaLegible(solicitud.huecoInicio)} a las ${this.horaLegible(solicitud.huecoInicio)}.` };
    } catch (error) {
      if (error instanceof DomainError) return { texto: '', escalar: 'intervencion_manual' };
      throw error;
    }
  }

  /** Resuelve el servicio mencionado contra el catálogo real, por coincidencia de nombre. */
  /**
   * Qué servicio del catálogo corresponde a lo que pidió la clienta.
   *
   * ## SOLO LA MATRIZ. SE QUITÓ EL RESPALDO POR NOMBRE, Y ESO ES UNA CORRECCIÓN
   *
   * Hasta esta entrega había un segundo camino: buscar en el catálogo un servicio cuyo nombre
   * contuviera la palabra que la clienta dijo. Con el catálogo oficial, **ese camino es el
   * peligroso**, y una prueba lo demostró: *"extensiones con rubber"* es una combinación que la
   * matriz **no junta** —y por tanto cuya duración nadie conoce—, pero la palabra `extensiones`
   * aparece dentro de `Retiro de acrílico o rubber + extensiones o baño de acrílico`. El respaldo
   * encontraba **una** coincidencia y agendaba **tres horas** para una clienta que había pedido
   * dos servicios de una.
   *
   * Que en el catálogo completo haya cinco filas con la palabra `extensiones` —y que por tanto el
   * respaldo devolviera `null` por ambigüedad— no es una protección: es una casualidad del número
   * de filas. Dar de baja tres de ellas la haría desaparecer.
   *
   * Así que si la matriz no reconoce la combinación, **el turno escala**. Una persona pregunta y
   * decide, que es lo que `RN-COT-01` exige cuando no hay fila: *"la duración de un compuesto sale
   * de una tabla de combinaciones específicas y nunca de sumar las partes"* — y tampoco de parecerse
   * al nombre de otra.
   *
   * **La matriz devuelve un nombre, no una duración.** La duración sale de la fila del catálogo en
   * PostgreSQL, editable desde el Backoffice sin tocar código: si la Dueña decide que las
   * extensiones pasan a 150 minutos, el bot lo respeta sin desplegar nada.
   */
  private async resolverServicio(textoDeLaClienta: string): Promise<Servicio | { escalar: 'cotizacion_compleja' } | null> {
    const deLaMatriz = resolverCombinacion(textoDeLaClienta);
    if (deLaMatriz === null) return null;
    if ('escalar' in deLaMatriz) return deLaMatriz;

    const activos = (await this.servicios.ejecutar()).filter((servicio) => servicio.activo);
    const fila = activos.find((servicio) => servicio.nombre === deLaMatriz.servicio);

    if (!fila) {
      /**
       * La matriz nombró una fila que el catálogo no ofrece: alguien la dio de baja, o la renombró
       * desde el Backoffice.
       *
       * Se escala en vez de buscar la más parecida, y se **avisa en el log** porque es un desajuste
       * de configuración que nadie vería de otra forma: la clienta recibiría un escalamiento
       * correcto y el bot parecería simplemente torpe. El aviso dice qué fila falta.
       *
       * ⚠️ El vínculo entre la matriz y el catálogo es **por nombre**, y los nombres se editan desde
       * `/admin`. Renombrar una fila oficial deja al bot sin poder resolver esa combinación.
       * Resolverlo de raíz pediría una clave estable en `servicios`, que hoy no existe; mientras no
       * exista, este aviso es lo que lo hace diagnosticable.
       */
      this.logger.warn(
        `La matriz de combinaciones resolvió a «${deLaMatriz.servicio}», que no está activo en el catálogo. ` +
          'El turno escala. Revisa si la fila se dio de baja o se renombró desde el Backoffice.',
      );
      return null;
    }

    return fila;
  }

  /** Rango a partir de la fecha y hora que el modelo extrajo. `null` si no hay suficiente. */
  private rangoDe(intencion: Intencion): { inicio: Date; fin: Date } | null {
    if (!intencion.fecha || !intencion.hora) return null;

    /**
     * La fecha y la hora que dice la clienta son **hora de pared de Querétaro**, no UTC.
     *
     * Interpretarlas como UTC desplazaría toda cita seis horas — el error silencioso más probable
     * de todo este módulo. `-06:00` es el desfase fijo de México desde que abolió el horario de
     * verano en 2022; `ZONA_HORARIA_NEGOCIO` es la referencia canónica si eso cambia.
     */
    const inicio = new Date(`${intencion.fecha}T${intencion.hora}:00-06:00`);
    if (Number.isNaN(inicio.getTime())) return null;

    // El fin es orientativo para la consulta de disponibilidad; al agendar lo deriva el catálogo.
    return { inicio, fin: new Date(inicio.getTime() + 3_600_000) };
  }

  private fechaLegible(instante: Date): string {
    return new Intl.DateTimeFormat('es-MX', { timeZone: ZONA_HORARIA_NEGOCIO, day: 'numeric', month: 'long' }).format(instante);
  }

  private horaLegible(instante: Date): string {
    return new Intl.DateTimeFormat('es-MX', { timeZone: ZONA_HORARIA_NEGOCIO, hour: '2-digit', minute: '2-digit', hour12: true }).format(
      instante,
    );
  }

  /** Mismo criterio que los demás actores de sistema (`DEC-044`). */
  private actorDelSistema(): ClaimsUsuario {
    return { sub: 'sistema:bot-conversacional', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL', manicuristaId: null };
  }
}
