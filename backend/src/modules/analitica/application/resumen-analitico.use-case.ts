import { Injectable } from '@nestjs/common';
import { RangoHorario } from '../../../database/schema';
import { ReporteDeAgendaUseCase, type ReporteDeAgenda } from '../../agenda/application/use-cases/reporte-de-agenda.use-case';
import { ReporteDeAnticiposUseCase, type ReporteDeAnticipos } from '../../anticipos/application/use-cases/reporte-de-anticipos.use-case';
import {
  ReporteDeConversacionesUseCase,
  type ReporteDeConversaciones,
} from '../../conversaciones/application/use-cases/reporte-de-conversaciones.use-case';

export interface ResumenAnalitico {
  rango: { desde: string; hasta: string };
  sucursalId: string | null;
  citas: ReporteDeAgenda;
  anticipos: ReporteDeAnticipos;
  conversaciones: ReporteDeConversaciones;
  indicadores: {
    /** `no_show / (completada + no_show)` en porcentaje. `null` si no hubo citas atendibles. */
    tasaDeNoShow: number | null;
    /** `aceptadas / notificadas` en porcentaje: cuántas ofertas se convirtieron en cita. */
    efectividadDeListaDeEspera: number | null;
    porcentajeResueltoPorElBot: number | null;
    /** Lo cotizado en citas completadas **más** lo cobrado en anticipos. */
    ingresoTotalEstimadoCentavos: number;
  };
  /**
   * Advertencias que **viajan en la respuesta**, no en la documentación.
   *
   * Quien lee un número tiene que poder saber qué no incluye, en el mismo sitio donde lo lee.
   */
  advertencias: string[];
}

/**
 * ⚠️ **El ingreso es un ESTIMADO, y el contrato lo dice en dos sitios.**
 *
 * Sale de `cotizacion_snapshot.totalCentavos`, que es **lo que se cotizó al agendar**, no lo que se
 * cobró. No incluye extras, propinas, descuentos de mostrador ni productos — eso vive en el Excel
 * que el salón sigue llevando en paralelo, y es un riesgo aceptado del proyecto.
 *
 * Además excluye las citas completadas de servicios con **cotización manual** (`DEC-033`), cuyo
 * total es `null` porque nadie lo fijó en la plataforma. Esas aparecen contadas aparte en
 * `completadasSinCotizar`: si ese número es alto, el ingreso estimado se queda corto y conviene
 * saber cuánto.
 */
export const ADVERTENCIA_DE_INGRESO =
  'El ingreso es un ESTIMADO: sale de lo cotizado al agendar, no de lo cobrado. No incluye extras, propinas, descuentos de mostrador ni productos, que viven en el registro paralelo de Excel.';

export const ADVERTENCIA_DE_ANTICIPOS_GLOBALES =
  'Los anticipos se reportan GLOBALES, sin filtro de sucursal: la tabla de anticipos no guarda la sucursal (es un dato de la cita, en otro esquema) y cruzarlos exigiría un JOIN entre esquemas que ADR-005 prohíbe.';

/**
 * Compone el resumen analítico a partir de **los reportes de cada Bounded Context**.
 *
 * ## CÓMO SE CRUZAN LOS DATOS SIN ROMPER `ADR-005`
 *
 * No se cruzan en SQL. **Este módulo no tiene una sola consulta propia.**
 *
 * `ADR-005` prohíbe que un contexto haga `JOIN` contra las tablas de otro, y `CLAUDE.md` lo dice
 * literal: *"si necesita ese dato, lo pide a través del caso de uso público de ese contexto"*. Un
 * `modules/analitica` con SQL cruzando `agenda`, `anticipos` y `conversaciones` sería exactamente
 * el `JOIN` entre esquemas que la decisión existe para impedir — y el día que uno de esos
 * contextos se extraiga a su propio servicio, el reporte dejaría de compilar.
 *
 * Así que **cada contexto agrega lo suyo** (`ReporteDeAgendaUseCase`, `ReporteDeAnticiposUseCase`,
 * `ReporteDeConversacionesUseCase`, cada uno tocando únicamente su esquema) y aquí se componen en
 * memoria. Las tres consultas van en paralelo, así que el coste es el de la más lenta.
 *
 * ## ES UN ADAPTADOR CONDUCTOR, NO UN BOUNDED CONTEXT
 *
 * Igual que `PlanificadorModule` y `AgenteModule`: no tiene dominio propio, ni entidades, ni
 * tablas. Lo que decide es *a quién preguntar y cómo combinar las respuestas*. Por eso importa los
 * módulos de los BC y ninguno lo importa a él — `madge --circular` sigue en 0.
 *
 * ## EL PRECIO DE ESTE DISEÑO, DICHO SIN ADORNOS
 *
 * No se puede filtrar anticipos por sucursal, porque la sucursal es un dato de la cita. Un `JOIN`
 * lo daría gratis. La alternativa habría sido traer los ids de cita de Agenda y pasarlos a
 * Anticipos en un `IN`, que con un año de datos son miles de uuids por consulta. Se eligió
 * **reportarlos globales y decirlo en la respuesta** antes que fingir un desglose mal calculado.
 */
@Injectable()
export class ResumenAnaliticoUseCase {
  constructor(
    private readonly reporteDeAgenda: ReporteDeAgendaUseCase,
    private readonly reporteDeAnticipos: ReporteDeAnticiposUseCase,
    private readonly reporteDeConversaciones: ReporteDeConversacionesUseCase,
  ) {}

  async ejecutar(input: { rango: RangoHorario; sucursalId?: string }): Promise<ResumenAnalitico> {
    const filtro = input.sucursalId ? { rango: input.rango, sucursalId: input.sucursalId } : { rango: input.rango };

    // En paralelo: son tres consultas independientes contra tres esquemas distintos. El rango lo
    // valida cada una por su cuenta, porque cada una es invocable sola.
    const [citas, anticipos, conversaciones] = await Promise.all([
      this.reporteDeAgenda.ejecutar(filtro),
      this.reporteDeAnticipos.ejecutar({ rango: input.rango }),
      this.reporteDeConversaciones.ejecutar(filtro),
    ]);

    const atendibles = citas.porEstado.completada + citas.porEstado.no_show;

    const advertencias = [ADVERTENCIA_DE_INGRESO];
    if (input.sucursalId) advertencias.push(ADVERTENCIA_DE_ANTICIPOS_GLOBALES);
    if (citas.completadasSinCotizar > 0) {
      advertencias.push(
        `${citas.completadasSinCotizar} cita(s) completada(s) no tienen precio en la plataforma (servicios de cotización manual), así que NO están sumadas en el ingreso estimado.`,
      );
    }
    /**
     * Las reposiciones de garantía se **nombran** en vez de excluirse.
     *
     * Ocuparon una silla y hubo trabajo, así que para ocupación cuentan; pero entran en
     * `porEstado.completada` y en el desglose por manicurista aportando `$0`, y sin decirlo el
     * promedio por cita baja sin explicación — y rehacer un trabajo mal hecho **sube** la cifra de
     * quien lo rehízo. La advertencia viaja en la respuesta por la misma razón que la del ingreso:
     * quien lee el número tiene que ver el matiz en el mismo sitio.
     */
    if (citas.garantiasCompletadas > 0) {
      advertencias.push(
        `${citas.garantiasCompletadas} de las citas completadas fueron reposiciones por garantía: ocuparon silla y tiempo, pero su ingreso es $0. Cuentan en la ocupación y en el desglose por manicurista.`,
      );
    }

    return {
      rango: { desde: input.rango.inicio.toISOString(), hasta: input.rango.fin.toISOString() },
      sucursalId: input.sucursalId ?? null,
      citas,
      anticipos,
      conversaciones,
      indicadores: {
        /**
         * El denominador es `completada + no_show`, **no el total de citas**.
         *
         * Las canceladas no entran: una cita cancelada con tiempo no es un `no_show`, y meterla en
         * el denominador diluiría la tasa justo en los periodos con muchas cancelaciones — que es
         * cuando el indicador tiene que notarse. Tampoco entran las activas: todavía no se sabe.
         */
        tasaDeNoShow: atendibles === 0 ? null : redondear((citas.porEstado.no_show / atendibles) * 100),
        efectividadDeListaDeEspera:
          citas.listaDeEspera.notificadas === 0
            ? null
            : redondear((citas.listaDeEspera.aceptadas / citas.listaDeEspera.notificadas) * 100),
        porcentajeResueltoPorElBot: conversaciones.porcentajeResueltoPorElBot,
        ingresoTotalEstimadoCentavos: citas.ingresoEstimadoCentavos + anticipos.cobradoCentavos,
      },
      advertencias,
    };
  }
}

/** Un decimal. Más precisión en un porcentaje de negocio es ruido. */
const redondear = (valor: number): number => Math.round(valor * 10) / 10;
