import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { conversacionesApi, type FiltrosDeBandeja } from '../../api/conversaciones';
import { sucursalesApi } from '../../api/sucursales';
import { Cargando } from '../../componentes/Cargando';
import { AvisoDeError } from '../../componentes/AvisoDeError';
import { Vacio } from '../../componentes/Vacio';
import { ListaDeConversaciones } from './ListaDeConversaciones';
import { Conversacion } from './Conversacion';

/** Cada 15 s. La lista refresca algo más lento que el hilo abierto, que es lo que se está mirando. */
const INTERVALO_DE_LA_LISTA_MS = 15_000;

type Pestana = 'escaladas' | 'bot';

/**
 * Las dos pestañas corresponden a **dos formas de trabajar**, no a un filtro cualquiera.
 *
 * - `escaladas` — `modo=humano`: la cola de trabajo real, lo que espera a una persona. Es la
 *   pestaña por defecto porque es la razón de que esta pantalla exista.
 * - `bot` — `modo=bot`: supervisión. Lo que el bot está atendiendo solo, para mirar por encima si
 *   lo está haciendo bien. **No se filtra por pendientes**: en modo bot, un mensaje sin responder
 *   dura segundos.
 */
const FILTROS_POR_PESTANA: Record<Pestana, Pick<FiltrosDeBandeja, 'modo'>> = {
  escaladas: { modo: 'humano' },
  bot: { modo: 'bot' },
};

export function Bandeja() {
  const [parametros, setParametros] = useSearchParams();
  // El enlace del contador del encabezado trae `?filtro=escaladas`, así que la pestaña vive en la
  // URL: hace que ese enlace aterrice donde debe y que la pantalla sea compartible.
  const pestana: Pestana = parametros.get('filtro') === 'bot' ? 'bot' : 'escaladas';
  const sucursalId = parametros.get('sucursal') ?? '';

  const [seleccionada, setSeleccionada] = useState<string | null>(null);

  const sucursales = useQuery({
    queryKey: ['sucursales'],
    queryFn: () => sucursalesApi.listar(),
    staleTime: 10 * 60_000,
  });

  const filtros: FiltrosDeBandeja = {
    ...FILTROS_POR_PESTANA[pestana],
    ...(sucursalId ? { sucursalId } : {}),
    limite: 50,
  };

  const bandeja = useQuery({
    // La clave incluye los filtros: sin ellos, cambiar de pestaña mostraría la lista anterior
    // mientras llega la nueva.
    queryKey: ['conversaciones', 'bandeja', filtros],
    queryFn: () => conversacionesApi.listar(filtros),
    refetchInterval: INTERVALO_DE_LA_LISTA_MS,
    refetchOnWindowFocus: true,
  });

  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(parametros);
    if (valor) siguiente.set(clave, valor);
    else siguiente.delete(clave);
    setParametros(siguiente, { replace: true });
    // Se deselecciona al cambiar de filtro: mantener abierta una conversación que ya no está en la
    // lista deja la pantalla en un estado incoherente.
    setSeleccionada(null);
  };

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-borde bg-fondo-elevado">
        <div className="border-b border-borde p-3">
          <div className="flex rounded bg-fondo-apagado p-0.5" role="tablist" aria-label="Filtro de conversaciones">
            {(
              [
                ['escaladas', 'Esperan a una persona'],
                ['bot', 'Las lleva el bot'],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={pestana === valor}
                onClick={() => cambiar('filtro', valor)}
                className={`flex-1 rounded px-2.5 py-1.5 text-xs font-medium transition ${
                  pestana === valor ? 'bg-fondo-elevado text-texto shadow-sm' : 'text-texto-secundario hover:text-texto'
                }`}
              >
                {texto}
              </button>
            ))}
          </div>

          <label htmlFor="sucursal" className="mt-3 block text-xs font-medium text-texto-secundario">
            Sucursal
          </label>
          <select
            id="sucursal"
            value={sucursalId}
            onChange={(evento) => cambiar('sucursal', evento.target.value)}
            className="mt-1 w-full rounded border border-borde bg-fondo px-2.5 py-1.5 text-xs text-texto"
          >
            <option value="">Todas</option>
            {(sucursales.data?.sucursales ?? []).map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {bandeja.isLoading ? (
            <Cargando mensaje="Cargando la bandeja…" />
          ) : bandeja.isError ? (
            <AvisoDeError error={bandeja.error} className="m-3" />
          ) : (
            <ListaDeConversaciones
              conversaciones={bandeja.data?.conversaciones ?? []}
              seleccionada={seleccionada}
              onSeleccionar={setSeleccionada}
            />
          )}
        </div>

        {bandeja.data?.hayMas ? (
          <p className="border-t border-borde px-3 py-2 text-[11px] text-texto-terciario">
            Hay más conversaciones. Filtra por sucursal para acotar.
          </p>
        ) : null}
      </section>

      <section className="min-h-0 overflow-hidden rounded-lg border border-borde bg-fondo-elevado">
        {seleccionada ? (
          // `key` fuerza el remontaje al cambiar de conversación: sin él, el texto a medio escribir
          // de una clienta aparecería en la caja de otra.
          <Conversacion key={seleccionada} id={seleccionada} />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <Vacio titulo="Elige una conversación" detalle="A la izquierda están las que esperan a una persona, ordenadas por lo más reciente." />
          </div>
        )}
      </section>
    </div>
  );
}
