import { Inject, Injectable } from '@nestjs/common';
import { CONTEXTO_CATALOGO_PORT, ContextoCatalogoPort, ServicioAgendable } from '../ports/contexto-catalogo.port';
import { RangoHorario } from '../../../../database/schema';
import { ConflictoDeNegocioError, DomainError, RecursoNoEncontradoError } from '../../../../shared/errors/domain-error';

/** Versión del formato del snapshot. Ver `CotizacionSnapshot`. */
export const VERSION_SNAPSHOT_COTIZACION = 1;

/**
 * Cotización **congelada** en el momento de agendar (`04-data-model.md` §5.2, `RN-AGE-08`).
 *
 * ⚠️ **ES UNA ESTIMACIÓN, NO UNA FACTURA.** `PROJECT_STATUS.md` lo fija explícitamente: el
 * snapshot es lo que se *estimó al agendar*, no lo que se *hizo* ni lo que se *cobró*. Cualquier
 * cifra de ingresos que salga de aquí es una estimación.
 *
 * **Lo que deliberadamente NO incluye:** modificadores de diseño. Una `Cita` transporta hoy un
 * solo `servicioId` y ninguna composición por uña, así que no hay de dónde sacarlos. Sumar
 * duraciones o precios de modificadores sería además **contrario a `RN-COT-01`**, que establece
 * que la duración de un compuesto sale de una tabla de combinaciones específicas y *nunca* de
 * sumar las partes. Ese cálculo es del motor de cotización (`FL-COT-03`, pospuesto).
 *
 * `version` existe para que, cuando `FL-COT-03` amplíe la forma, los snapshots ya congelados
 * sigan siendo legibles sin adivinar su estructura.
 */
export interface CotizacionSnapshot {
  version: typeof VERSION_SNAPSHOT_COTIZACION;
  congeladoEn: string;
  servicio: {
    id: string;
    nombre: string;
    categoria: string;
    duracionMinutos: number;
    precioCentavos: number;
  };
  /**
   * `null` cuando el servicio exige cotización manual (`DEC-033`). **No es un cero ni un dato
   * que falte**: es la negativa explícita del sistema a inventar un precio que debe fijar una
   * persona. Quien lo consuma tiene que distinguir "todavía nadie lo cotizó" de "cuesta 0".
   */
  totalCentavos: number | null;
  requiereCotizacionManual: boolean;
  /** Siempre `false` por ahora — ver la nota de arriba. Explícito para que nadie lo suponga. */
  incluyeModificadores: false;
}

/**
 * Servicio de dominio que responde **"¿se puede agendar este servicio, y cuánto dura?"**.
 *
 * Existe para que `AgendarCitaUseCase` y `ReprogramarCitaUseCase` vean **exactamente lo mismo**.
 * Antes, reprogramar no revalidaba nada del catálogo: una cita de un servicio dado de baja se
 * podía mover indefinidamente.
 *
 * **La duración la manda el catálogo, no el cliente.** Es el cambio de fondo: hasta ahora el
 * `inicio` y el `fin` llegaban libres por HTTP, así que se podía reservar una hora para un
 * servicio de tres, o tres para uno de una. Ahora el `fin` se **deriva**, y si el cliente lo
 * envía tiene que coincidir.
 */
@Injectable()
export class ResolutorDeServicio {
  constructor(@Inject(CONTEXTO_CATALOGO_PORT) private readonly catalogo: ContextoCatalogoPort) {}

  /**
   * Lanza 404 si no existe y 409 si no tiene duración agendable. Con `exigirActivo` (el valor por
   * defecto), lanza además 409 si está dado de baja del catálogo.
   *
   * **`exigirActivo: false` existe para una sola razón de negocio** (ver `resolverParaMoverCita`):
   * dar de baja un servicio detiene las **ventas nuevas**, no anula las citas ya vendidas.
   */
  async resolver(servicioId: string, opciones: { exigirActivo?: boolean } = {}): Promise<ServicioAgendable> {
    const exigirActivo = opciones.exigirActivo ?? true;
    const servicio = await this.catalogo.buscarServicio(servicioId);
    if (!servicio) throw new RecursoNoEncontradoError('Servicio', servicioId);

    if (exigirActivo && !servicio.activo) {
      // 409 y no 404: el servicio existe, y distinguirlo importa — "no existe" manda a revisar el
      // id; "está de baja" manda a hablar con quien lo dio de baja.
      throw new ConflictoDeNegocioError('SERVICIO_INACTIVO', `El servicio "${servicio.nombre}" está dado de baja del catálogo.`, {
        servicioId,
      });
    }

    if (servicio.duracionMinutos <= 0) {
      // El catálogo admite duración 0 (`validarDuracionEnMinutos` solo rechaza negativos), pero
      // una cita de cero minutos produciría un rango vacío que PostgreSQL no puede excluir: la
      // silla quedaría "libre" durante la propia cita. Se corta aquí con un mensaje que apunta al
      // catálogo, que es donde está el dato mal capturado.
      throw new ConflictoDeNegocioError(
        'SERVICIO_SIN_DURACION',
        `El servicio "${servicio.nombre}" no tiene duración configurada en el catálogo, así que no se puede agendar.`,
        { servicioId, duracionMinutos: servicio.duracionMinutos },
      );
    }

    return servicio;
  }

  /**
   * Resuelve el servicio de una cita **que ya existe**, sin exigir que siga activo.
   *
   * POR QUÉ SE SEPARÓ DE `resolver`. Exigir `activo` al reprogramar dejaba a las clientas de un
   * servicio descontinuado **sin poder mover su cita: solo cancelarla**. Y la que había pagado un
   * anticipo quedaba atrapada entre un horario que ya no le servía y una cancelación que puede
   * costarle el anticipo — por una decisión de catálogo tomada *después* de su compra.
   *
   * La distinción correcta es entre **vender** y **mover algo ya vendido**:
   * - `AgendarCitaUseCase` usa `resolver()` y sigue exigiendo `activo`: no se abren ventas nuevas
   *   de un servicio retirado.
   * - `ReprogramarCitaUseCase` usa este método: la cita ya se vendió, su `cotizacion_snapshot`
   *   sigue siendo inmutable (`RN-AGE-08`) y lo único que cambia es la hora.
   *
   * **Lo que sí se sigue validando** es que el servicio **exista** y tenga duración: es de donde
   * sale el tamaño del nuevo hueco. Si alguien borrara la fila del catálogo —hoy nada lo hace, la
   * baja es lógica— la reprogramación fallaría con 404, y eso es correcto: sin duración no se
   * puede reservar nada.
   */
  resolverParaMoverCita(servicioId: string): Promise<ServicioAgendable> {
    return this.resolver(servicioId, { exigirActivo: false });
  }

  /**
   * Rango definitivo de la cita.
   *
   * Si no llega `fin`, se **deriva** de `inicio + duración del catálogo`. Si llega, tiene que
   * coincidir al minuto. Las dos ramas existen porque la primera es la correcta (una sola fuente
   * de verdad) y la segunda es la que impide que un cliente antiguo, que sigue mandando `fin`,
   * reserve un hueco de otro tamaño sin que nadie lo note.
   */
  derivarRango(inicio: Date, finSolicitado: Date | undefined, servicio: ServicioAgendable): RangoHorario {
    if (Number.isNaN(inicio.getTime())) {
      throw new DomainError('CITA_RANGO_INVALIDO', 'El inicio de la cita no es una fecha válida.', 400);
    }

    const fin = new Date(inicio.getTime() + servicio.duracionMinutos * 60_000);

    if (finSolicitado !== undefined) {
      if (Number.isNaN(finSolicitado.getTime())) {
        throw new DomainError('CITA_RANGO_INVALIDO', 'El fin de la cita no es una fecha válida.', 400);
      }
      if (finSolicitado.getTime() !== fin.getTime()) {
        const minutosSolicitados = Math.round((finSolicitado.getTime() - inicio.getTime()) / 60_000);
        throw new ConflictoDeNegocioError(
          'DURACION_NO_COINCIDE_CON_SERVICIO',
          `El servicio "${servicio.nombre}" dura ${servicio.duracionMinutos} minutos y se solicitaron ${minutosSolicitados}.`,
          {
            servicioId: servicio.id,
            duracionDelCatalogoMinutos: servicio.duracionMinutos,
            duracionSolicitadaMinutos: minutosSolicitados,
            finEsperado: fin.toISOString(),
          },
        );
      }
    }

    return { inicio, fin };
  }

  /**
   * Congela la cotización. **La construye el backend desde el catálogo oficial, nunca el cliente**
   * — el mismo principio que ya rige para OpenAI: el dominio es la única autoridad sobre precios.
   */
  construirSnapshot(servicio: ServicioAgendable, congeladoEn = new Date()): CotizacionSnapshot {
    return {
      version: VERSION_SNAPSHOT_COTIZACION,
      congeladoEn: congeladoEn.toISOString(),
      servicio: {
        id: servicio.id,
        nombre: servicio.nombre,
        categoria: servicio.categoria,
        duracionMinutos: servicio.duracionMinutos,
        precioCentavos: servicio.precioCentavos,
      },
      // `DEC-033`: si el precio lo fija una persona, aquí no se escribe un número.
      totalCentavos: servicio.requiereCotizacionManual ? null : servicio.precioCentavos,
      requiereCotizacionManual: servicio.requiereCotizacionManual,
      incluyeModificadores: false,
    };
  }
}
