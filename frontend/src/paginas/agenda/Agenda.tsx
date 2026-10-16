import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { agendaApi } from '../../api/agenda';
import { Cargando } from '../../componentes/Cargando';
import { AvisoDeError } from '../../componentes/AvisoDeError';
import { SelectorDeSucursal, useSucursales } from '../../componentes/selectores';
import { fechaLocalDeHoy, rangoDelDia } from '../../componentes/etiquetas';
import { ListaDeCitas } from './componentes/ListaDeCitas';
import { AgendarCita } from './componentes/AgendarCita';
import { ConsultaDeDisponibilidad } from './componentes/ConsultaDeDisponibilidad';
import { Excepciones } from './componentes/Excepciones';
import { ListaDeEspera } from './componentes/ListaDeEspera';

type Pestana = 'dia' | 'personal' | 'espera';

const PESTANAS: { valor: Pestana; texto: string }[] = [
  { valor: 'dia', texto: 'Agenda del día' },
  { valor: 'personal', texto: 'Ausencias y coberturas' },
  { valor: 'espera', texto: 'Lista de espera' },
];

/**
 * Agenda Operativa de Mostrador.
 *
 * ## LA SUCURSAL Y LA FECHA VIVEN EN LA URL
 *
 * Y no en estado local, por dos razones prácticas: la pantalla es **compartible** (la Encargada
 * puede mandar un enlace a un día concreto) y **sobrevive a un refresco**, que a mitad de turno con
 * una clienta esperando no es un detalle menor.
 *
 * ## POR QUÉ UNA SOLA PANTALLA CON TRES PESTAÑAS
 *
 * Porque las tres comparten el contexto —esta sucursal, este día— y porque el trabajo salta entre
 * ellas constantemente: se registra una ausencia, aparecen citas comprometidas, y hay que volver a
 * la agenda a reasignarlas. Separarlas en rutas distintas obligaría a reelegir sucursal y fecha en
 * cada salto.
 */
export function Agenda() {
  const [parametros, setParametros] = useSearchParams();
  const cliente = useQueryClient();
  const { data: sucursales } = useSucursales();

  const pestana = (PESTANAS.find((p) => p.valor === parametros.get('vista'))?.valor ?? 'dia') as Pestana;
  const fecha = parametros.get('fecha') ?? fechaLocalDeHoy();
  // Sin sucursal en la URL se usa la primera disponible: abrir la agenda y tener que elegir
  // sucursal antes de ver nada es un paso de más cuando hay una sola en la práctica diaria.
  const sucursalId = parametros.get('sucursal') ?? sucursales?.sucursales[0]?.id ?? '';

  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(parametros);
    if (valor) siguiente.set(clave, valor);
    else siguiente.delete(clave);
    setParametros(siguiente, { replace: true });
  };

  const rango = rangoDelDia(fecha);
  const claveDeAgenda = ['agenda', sucursalId, fecha] as const;

  const agenda = useQuery({
    queryKey: claveDeAgenda,
    queryFn: () => agendaApi.listar({ sucursalId, ...rango, limite: 200 }),
    enabled: sucursalId !== '',
  });

  /**
   * Tras cualquier acción se invalida la agenda **y la disponibilidad**: agendar, cancelar o
   * asignar cambia la capacidad, y una respuesta de disponibilidad cacheada mentiría justo después
   * de la operación que la invalidó.
   */
  const refrescar = async () => {
    await Promise.all([
      cliente.invalidateQueries({ queryKey: ['agenda'] }),
      cliente.invalidateQueries({ queryKey: ['disponibilidad'] }),
    ]);
  };

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-texto">Agenda</h1>
        <p className="mt-1 text-sm text-texto-secundario">Mostrador: agendar, asignar al llegar, cancelar y reprogramar.</p>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-borde bg-fondo-elevado p-3">
        <div className="min-w-[12rem]">
          <SelectorDeSucursal valor={sucursalId} onCambio={(valor) => cambiar('sucursal', valor)} />
        </div>
        <div>
          <label htmlFor="agenda-fecha" className="block text-xs font-medium text-texto-secundario">
            Día
          </label>
          <input
            id="agenda-fecha"
            type="date"
            value={fecha}
            onChange={(evento) => cambiar('fecha', evento.target.value)}
            className="mt-1 rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
          />
        </div>
        <button
          type="button"
          onClick={() => cambiar('fecha', fechaLocalDeHoy())}
          className="rounded px-3 py-2 text-xs font-medium text-texto-secundario transition hover:bg-fondo-apagado hover:text-texto"
        >
          Hoy
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded bg-fondo-apagado p-0.5" role="tablist" aria-label="Vistas de la agenda">
        {PESTANAS.map((candidata) => (
          <button
            key={candidata.valor}
            type="button"
            role="tab"
            aria-selected={pestana === candidata.valor}
            onClick={() => cambiar('vista', candidata.valor)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              pestana === candidata.valor ? 'bg-fondo-elevado text-texto shadow-sm' : 'text-texto-secundario hover:text-texto'
            }`}
          >
            {candidata.texto}
          </button>
        ))}
      </div>

      {sucursalId === '' ? (
        <p className="rounded border border-borde bg-fondo-apagado px-3 py-2.5 text-sm text-texto-secundario">
          Elige una sucursal para ver su agenda.
        </p>
      ) : pestana === 'dia' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <section>
            {agenda.isLoading ? (
              <Cargando mensaje="Cargando la agenda…" />
            ) : agenda.isError ? (
              <AvisoDeError error={agenda.error} />
            ) : (
              <>
                <ListaDeCitas citas={agenda.data?.citas ?? []} sucursalId={sucursalId} onCambio={refrescar} />
                {agenda.data?.hayMas ? (
                  <p className="mt-3 text-xs text-texto-terciario">Hay más citas de las que caben en una página.</p>
                ) : null}
              </>
            )}
          </section>
          <aside className="space-y-4">
            {/* `key` con la fecha: al cambiar de día el formulario se reinicia con ese día, en vez de
                conservar el anterior. Es lo que quien opera espera — «estoy viendo este día, agendo
                para este día». */}
            <AgendarCita key={fecha} sucursalId={sucursalId} fechaVisible={fecha} onAgendada={refrescar} />
            <ConsultaDeDisponibilidad sucursalId={sucursalId} fecha={fecha} />
          </aside>
        </div>
      ) : pestana === 'personal' ? (
        <Excepciones sucursalId={sucursalId} fecha={fecha} />
      ) : (
        <ListaDeEspera sucursalId={sucursalId} fecha={fecha} />
      )}
    </div>
  );
}
