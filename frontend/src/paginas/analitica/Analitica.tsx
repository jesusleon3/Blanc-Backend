import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { MotivoDeEscalamiento, ResumenAnalitico } from '../../api/contrato';
import { analiticaApi } from '../../api/analitica';
import { Cargando } from '../../componentes/Cargando';
import { AvisoDeError } from '../../componentes/AvisoDeError';
import { Insignia } from '../../componentes/Insignia';
import { Vacio } from '../../componentes/Vacio';
import { SelectorDeSucursal, useManicuristasDeSucursal, useSucursales } from '../../componentes/selectores';
import {
  ETIQUETA_DE_ESTADO_CITA,
  ETIQUETA_DE_MOTIVO,
  SEVERIDAD_DE_MOTIVO,
  fechaLocalDeHoy,
  pesos,
} from '../../componentes/etiquetas';

/** Por defecto, los últimos 30 días: el periodo que la Dueña mira al revisar el mes. */
const DIAS_POR_DEFECTO = 30;

const fechaMenosDias = (dias: number): string => {
  const fecha = new Date(Date.now() - dias * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    fecha,
  );
};

/**
 * Analítica y Reportes (Fase 6) — pantalla ejecutiva.
 *
 * ## SOLO LA DUEÑA Y EL SUPER ADMIN LLEGAN AQUÍ
 *
 * La ruta está envuelta en `ExigeRol(ROLES_DE_ADMINISTRACION)` y el endpoint responde `403` a la
 * Encargada. El motivo decisivo es el **desglose por manicurista**: *"cuántas citas completó cada
 * una"* es una medida del trabajo de sus compañeras, y darla a quien no decide sobre su
 * contratación es una fuga de un dato sensible sin necesidad operativa. Nada de esta pantalla
 * sirve para atender el día.
 *
 * ## LAS ADVERTENCIAS NO SON LETRA PEQUEÑA
 *
 * Van arriba, antes de los números, porque **el ingreso es un estimado** y quien lo lee tiene que
 * saberlo *antes* de leerlo. Sale de lo cotizado al agendar, no de lo cobrado: no incluye extras,
 * propinas ni productos, que viven en el Excel que el salón sigue llevando en paralelo. Y las
 * advertencias las manda el backend en la respuesta, así que si mañana aparece una nueva, se
 * muestra sola.
 */
export function Analitica() {
  const [parametros, setParametros] = useSearchParams();
  const { data: sucursales } = useSucursales();

  const desde = parametros.get('desde') ?? fechaMenosDias(DIAS_POR_DEFECTO);
  const hasta = parametros.get('hasta') ?? fechaLocalDeHoy();
  const sucursalId = parametros.get('sucursal') ?? '';

  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(parametros);
    if (valor) siguiente.set(clave, valor);
    else siguiente.delete(clave);
    setParametros(siguiente, { replace: true });
  };

  // El rango se manda como instantes de pared: el backend compara contra marcas de tiempo, y un
  // `YYYY-MM-DD` interpretado como UTC desplazaría el día seis horas.
  const inicio = new Date(`${desde}T00:00:00-06:00`).toISOString();
  const fin = new Date(`${hasta}T23:59:59-06:00`).toISOString();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analitica', inicio, fin, sucursalId],
    queryFn: () => analiticaApi.resumen(inicio, fin, sucursalId || undefined),
    // Un reporte agregado no cambia de un segundo a otro, y la consulta es más cara que las demás.
    staleTime: 60_000,
  });

  const nombreDeSucursal = (id: string) => sucursales?.sucursales.find((sucursal) => sucursal.id === id)?.nombre ?? id;

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-texto">Analítica</h1>
        <p className="mt-1 text-sm text-texto-secundario">Resumen del periodo: citas, ingresos, lista de espera y desempeño del bot.</p>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-borde bg-fondo-elevado p-3">
        <div>
          <label htmlFor="desde" className="block text-xs font-medium text-texto-secundario">
            Desde
          </label>
          <input
            id="desde"
            type="date"
            value={desde}
            onChange={(evento) => cambiar('desde', evento.target.value)}
            className="mt-1 rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
          />
        </div>
        <div>
          <label htmlFor="hasta" className="block text-xs font-medium text-texto-secundario">
            Hasta
          </label>
          <input
            id="hasta"
            type="date"
            value={hasta}
            onChange={(evento) => cambiar('hasta', evento.target.value)}
            className="mt-1 rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
          />
        </div>
        <div className="min-w-[12rem]">
          <SelectorDeSucursal valor={sucursalId} onCambio={(valor) => cambiar('sucursal', valor)} incluirTodas etiqueta="Sucursal" />
        </div>
        {([30, 90, 365] as const).map((dias) => (
          <button
            key={dias}
            type="button"
            onClick={() => {
              const siguiente = new URLSearchParams(parametros);
              siguiente.set('desde', fechaMenosDias(dias));
              siguiente.set('hasta', fechaLocalDeHoy());
              setParametros(siguiente, { replace: true });
            }}
            className="rounded px-3 py-2 text-xs font-medium text-texto-secundario transition hover:bg-fondo-apagado hover:text-texto"
          >
            {dias === 365 ? 'Último año' : `Últimos ${dias} días`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Cargando mensaje="Calculando el resumen…" />
      ) : isError ? (
        <AvisoDeError error={error} />
      ) : !data ? (
        <Vacio titulo="Sin datos para este periodo" />
      ) : (
        <Resumen resumen={data} nombreDeSucursal={nombreDeSucursal} sucursalId={sucursalId} />
      )}
    </div>
  );
}

function Resumen({
  resumen,
  nombreDeSucursal,
  sucursalId,
}: {
  resumen: ResumenAnalitico;
  nombreDeSucursal: (id: string) => string;
  sucursalId: string;
}) {
  const { citas, anticipos, conversaciones, indicadores } = resumen;

  return (
    <div className="space-y-5">
      {/* Antes de los números, no después: el ingreso es un estimado y hay que saberlo primero. */}
      <section role="note" aria-label="Advertencias del reporte" className="rounded-lg border border-aviso/30 bg-aviso-suave p-4">
        <h2 className="text-sm font-semibold text-aviso">Antes de leer estos números</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-aviso/90">
          {resumen.advertencias.map((advertencia) => (
            <li key={advertencia}>{advertencia}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores principales">
        <Kpi titulo="Citas atendidas" valor={String(citas.porEstado.completada)} detalle={`de ${citas.total} en el periodo`} />
        <Kpi
          titulo="Tasa de no-show"
          valor={indicadores.tasaDeNoShow === null ? '—' : `${indicadores.tasaDeNoShow}%`}
          detalle={
            indicadores.tasaDeNoShow === null
              ? 'Sin citas atendibles en el periodo'
              : `${citas.porEstado.no_show} de ${citas.porEstado.completada + citas.porEstado.no_show} atendibles`
          }
          tono={indicadores.tasaDeNoShow !== null && indicadores.tasaDeNoShow > 15 ? 'peligro' : 'neutro'}
        />
        <Kpi
          titulo="Resolución autónoma del bot"
          valor={indicadores.porcentajeResueltoPorElBot === null ? '—' : `${indicadores.porcentajeResueltoPorElBot}%`}
          detalle={
            indicadores.porcentajeResueltoPorElBot === null
              ? 'Sin conversaciones en el periodo'
              : `${conversaciones.soloBot} de ${conversaciones.activas} sin intervención humana`
          }
          tono={indicadores.porcentajeResueltoPorElBot !== null && indicadores.porcentajeResueltoPorElBot >= 80 ? 'exito' : 'neutro'}
        />
        <Kpi
          titulo="Ingreso estimado"
          valor={pesos(indicadores.ingresoTotalEstimadoCentavos)}
          detalle={`${pesos(citas.ingresoEstimadoCentavos)} en servicios + ${pesos(anticipos.cobradoCentavos)} en anticipos`}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta titulo="Embudo de citas">
          <dl className="divide-y divide-borde text-sm">
            {(Object.entries(citas.porEstado) as [keyof typeof citas.porEstado, number][])
              .filter(([, total]) => total > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([estado, total]) => (
                <div key={estado} className="flex justify-between py-2">
                  <dt className="text-texto-secundario">{ETIQUETA_DE_ESTADO_CITA[estado]}</dt>
                  <dd className="font-medium tabular-nums text-texto">{total}</dd>
                </div>
              ))}
            {citas.total === 0 ? <p className="py-2 text-xs text-texto-terciario">Ninguna cita en el periodo.</p> : null}
          </dl>
          {citas.cancelacionesTardias > 0 ? (
            <p className="mt-3 text-xs text-aviso">
              {/* "cancelación" → "cancelaciones": el plural PIERDE la tilde. Concatenar "es" daba
                  «cancelaciónes», el mismo defecto de ortografía que ya apareció en el contador de
                  la Bandeja y en Clientas. Las dos formas van escritas enteras, y el texto en una
                  sola cadena para que una prueba pueda encontrarlo. */}
              {`${citas.cancelacionesTardias} ${
                citas.cancelacionesTardias === 1 ? 'cancelación' : 'cancelaciones'
              } con menos de 60 minutos de aviso: quedan como incidente en el historial de la clienta.`}
            </p>
          ) : null}
        </Tarjeta>

        <Tarjeta titulo="Anticipos">
          <dl className="divide-y divide-borde text-sm">
            {(Object.entries(anticipos.porEstado) as [keyof typeof anticipos.porEstado, { cantidad: number; centavos: number }][]).map(
              ([estado, dato]) => (
                <div key={estado} className="flex items-baseline justify-between py-2">
                  <dt className="text-texto-secundario">
                    {ETIQUETA_DE_ESTADO_ANTICIPO_CORTO[estado]}
                    <span className="ml-1.5 text-xs text-texto-terciario">({dato.cantidad})</span>
                  </dt>
                  <dd className="font-medium tabular-nums text-texto">{pesos(dato.centavos)}</dd>
                </div>
              ),
            )}
          </dl>
          <p className="mt-3 text-xs text-texto-secundario">
            <strong>{pesos(anticipos.cobradoCentavos)}</strong> es dinero del salón: los retenidos por cancelación o no-show{' '}
            <strong>no se reembolsan</strong>.
          </p>
          {sucursalId ? (
            <p className="mt-2 text-xs text-texto-terciario">Los anticipos no se filtran por sucursal — ver las advertencias de arriba.</p>
          ) : null}
        </Tarjeta>

        <Tarjeta titulo="Atendidas por sucursal">
          {citas.atendidasPorSucursal.length === 0 ? (
            <p className="text-xs text-texto-terciario">Sin citas atendidas en el periodo.</p>
          ) : (
            <ul className="divide-y divide-borde text-sm" aria-label="Atendidas por sucursal">
              {citas.atendidasPorSucursal.map((fila) => (
                <li key={fila.sucursalId} className="flex items-baseline justify-between py-2">
                  <span className="text-texto">{nombreDeSucursal(fila.sucursalId)}</span>
                  <span className="tabular-nums text-texto-secundario">
                    <strong className="text-texto">{fila.completadas}</strong> atendidas
                    {fila.noShow > 0 ? <span className="ml-2 text-peligro">{fila.noShow} no llegaron</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <PorManicurista filas={citas.atendidasPorManicurista} sucursalId={sucursalId} />

        <Tarjeta titulo="Lista de espera">
          <dl className="divide-y divide-borde text-sm">
            {(
              [
                ['Se anotaron', citas.listaDeEspera.inscritas],
                ['Se les ofreció un hueco', citas.listaDeEspera.notificadas],
                ['Aceptaron y se agendó', citas.listaDeEspera.aceptadas],
                ['Se les pasó el turno', citas.listaDeEspera.expiradas],
              ] as const
            ).map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex justify-between py-2">
                <dt className="text-texto-secundario">{etiqueta}</dt>
                <dd className="font-medium tabular-nums text-texto">{valor}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-texto-secundario">
            Efectividad:{' '}
            <strong>
              {indicadores.efectividadDeListaDeEspera === null ? '—' : `${indicadores.efectividadDeListaDeEspera}%`}
            </strong>{' '}
            de las ofertas se convirtieron en cita.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Por qué el bot pasó conversaciones a una persona">
          <MotivosDeEscalamiento motivos={conversaciones.escalamientosPorMotivo} />
          <p className="mt-3 text-xs text-texto-terciario">
            {/* Es la nota que evita una lectura equivocada del indicador: el porcentaje se mide por
                los mensajes, no por el modo actual, porque devolver al bot borra el motivo. */}
            «Sin intervención humana» se mide por los mensajes del periodo: una conversación que
            alguien atendió y devolvió al bot cuenta como atendida a mano, aunque hoy la lleve el bot.
          </p>
        </Tarjeta>
      </div>
    </div>
  );
}

const ETIQUETA_DE_ESTADO_ANTICIPO_CORTO = {
  pendiente: 'Esperando transferencia',
  pagado: 'Pagados',
  retenido: 'Retenidos (no se devuelven)',
  expirado: 'Expirados',
} as const;

function PorManicurista({
  filas,
  sucursalId,
}: {
  filas: { manicuristaId: string | null; completadas: number }[];
  sucursalId: string;
}) {
  const { data } = useManicuristasDeSucursal(sucursalId || undefined);
  const nombre = (id: string) => (data ?? []).find((manicurista) => manicurista.id === id)?.nombre ?? id;

  return (
    <Tarjeta titulo="Atendidas por manicurista">
      {filas.length === 0 ? (
        <p className="text-xs text-texto-terciario">Sin citas atendidas en el periodo.</p>
      ) : (
        <ul className="divide-y divide-borde text-sm" aria-label="Atendidas por manicurista">
          {filas.map((fila) => (
            <li key={fila.manicuristaId ?? 'sin-asignar'} className="flex items-baseline justify-between py-2">
              <span className={fila.manicuristaId === null ? 'text-texto-secundario' : 'text-texto'}>
                {/* `null` no es un hueco de datos: significa que la cita se completó sin que nadie
                    quedara registrado como quien atendió (`DEC-031`). */}
                {fila.manicuristaId === null ? 'Sin manicurista registrada' : nombre(fila.manicuristaId)}
              </span>
              <span className="font-medium tabular-nums text-texto">{fila.completadas}</span>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

function MotivosDeEscalamiento({ motivos }: { motivos: Record<MotivoDeEscalamiento, number> }) {
  const conEscalamientos = (Object.entries(motivos) as [MotivoDeEscalamiento, number][])
    .filter(([, total]) => total > 0)
    .sort(([, a], [, b]) => b - a);

  if (conEscalamientos.length === 0) {
    return <p className="text-xs text-texto-terciario">Ninguna conversación se escaló en el periodo.</p>;
  }

  const total = conEscalamientos.reduce((suma, [, valor]) => suma + valor, 0);

  return (
    <ul className="space-y-2" aria-label="Motivos de escalamiento">
      {conEscalamientos.map(([motivo, cantidad]) => (
        <li key={motivo} className="flex items-center gap-2">
          <Insignia tono={SEVERIDAD_DE_MOTIVO[motivo] === 'alta' ? 'peligro' : SEVERIDAD_DE_MOTIVO[motivo] === 'media' ? 'aviso' : 'neutro'}>
            {ETIQUETA_DE_MOTIVO[motivo]}
          </Insignia>
          <span className="ml-auto text-sm font-medium tabular-nums text-texto">{cantidad}</span>
          <span className="w-12 text-right text-xs text-texto-terciario">{Math.round((cantidad / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

function Kpi({
  titulo,
  valor,
  detalle,
  tono = 'neutro',
}: {
  titulo: string;
  valor: string;
  detalle: string;
  tono?: 'neutro' | 'exito' | 'peligro';
}) {
  const color = tono === 'exito' ? 'text-exito' : tono === 'peligro' ? 'text-peligro' : 'text-texto';

  return (
    <div className="rounded-lg border border-borde bg-fondo-elevado p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-texto-terciario">{titulo}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${color}`}>{valor}</p>
      <p className="mt-1 text-xs text-texto-secundario">{detalle}</p>
    </div>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-borde bg-fondo-elevado p-4">
      <h2 className="mb-2 text-sm font-semibold text-texto">{titulo}</h2>
      {children}
    </section>
  );
}
