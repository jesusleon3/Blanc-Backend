import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccionDeRiesgo, Clienta, EstadoDeRiesgo, TipoDeIncidente } from '../../api/contrato';
import { clientasApi } from '../../api/clientas';
import { useSesion } from '../../auth/sesion';
import { esDeAdministracion } from '../../auth/roles';
import { Boton } from '../../componentes/Boton';
import { Cargando } from '../../componentes/Cargando';
import { Insignia } from '../../componentes/Insignia';
import { AvisoDeError } from '../../componentes/AvisoDeError';
import { Vacio } from '../../componentes/Vacio';
import { ETIQUETA_DE_RIESGO, fechaYHoraLocal } from '../../componentes/etiquetas';

const TONO_POR_RIESGO: Record<EstadoDeRiesgo, 'neutro' | 'aviso' | 'peligro'> = {
  normal: 'neutro',
  lista_roja: 'aviso',
  bloqueada: 'peligro',
};

const ETIQUETA_DE_INCIDENTE: Record<TipoDeIncidente, string> = {
  no_show: 'No llegó',
  cancelacion_tardia: 'Canceló tarde',
  cancelacion_ordinaria: 'Canceló con tiempo',
};

/**
 * CRM de clientas.
 *
 * ## LA BÚSQUEDA DEVUELVE VARIAS, Y HAY QUE MOSTRARLAS TODAS
 *
 * Un teléfono puede corresponder a **dos clientas distintas**: mamá e hija comparten número. El
 * backend nunca elige una —elegir sería adivinar, y la elección equivocada ataría el historial de
 * incidentes a la persona errónea, de la que además depende si se le pide anticipo— así que esta
 * pantalla presenta la lista y quien atiende decide.
 *
 * Es también la razón de que `RN-CRM-01` (*el teléfono es la clave única de una clienta*) quedara
 * superada en Fase 3.
 */
export function Clientas() {
  const { perfil } = useSesion();
  const puedeMarcar = esDeAdministracion(perfil?.rol);

  const [telefono, setTelefono] = useState('');
  const [buscado, setBuscado] = useState('');
  const [seleccionada, setSeleccionada] = useState<string | null>(null);

  const busqueda = useQuery({
    queryKey: ['clientas', 'por-telefono', buscado],
    queryFn: () => clientasApi.buscarPorTelefono(buscado),
    // Solo busca cuando hay algo que buscar: sin esto, la pantalla pediría al montarse con cadena
    // vacía y el backend respondería un 400 de validación.
    enabled: buscado.length > 0,
  });

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-texto">Clientas</h1>
        <p className="mt-1 text-sm text-texto-secundario">
          Búsqueda por teléfono. Si dos clientas comparten número (mamá e hija), aparecen las dos.
        </p>
      </header>

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          setBuscado(telefono.trim());
          setSeleccionada(null);
        }}
        className="mb-5 flex flex-wrap gap-2"
      >
        <label htmlFor="telefono" className="sr-only">
          Teléfono
        </label>
        <input
          id="telefono"
          inputMode="tel"
          value={telefono}
          onChange={(evento) => setTelefono(evento.target.value)}
          placeholder="Teléfono (10 dígitos)"
          className="min-w-0 flex-1 rounded border border-borde bg-fondo px-3 py-2.5 text-sm text-texto placeholder:text-texto-terciario sm:max-w-xs"
        />
        <Boton type="submit" disabled={telefono.trim().length === 0}>
          Buscar
        </Boton>
      </form>

      {!puedeMarcar ? (
        <p className="mb-4 rounded border border-borde bg-fondo-apagado px-3 py-2.5 text-xs text-texto-secundario">
          Marcar o retirar lista roja lo decide la Dueña (<code className="font-mono">DEC-042</code>). Aquí puedes consultar el historial.
        </p>
      ) : null}

      {buscado.length === 0 ? (
        <Vacio titulo="Busca una clienta por su teléfono" />
      ) : busqueda.isLoading ? (
        <Cargando mensaje="Buscando…" />
      ) : busqueda.isError ? (
        <AvisoDeError error={busqueda.error} />
      ) : (busqueda.data?.clientas ?? []).length === 0 ? (
        <Vacio titulo="Ninguna clienta con ese teléfono" detalle="Revisa el número, o dala de alta desde la Agenda." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <ul className="space-y-2">
            {(busqueda.data?.clientas ?? []).map((clienta) => (
              <li key={clienta.id}>
                <button
                  type="button"
                  onClick={() => setSeleccionada(clienta.id)}
                  aria-current={seleccionada === clienta.id ? 'true' : undefined}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    seleccionada === clienta.id ? 'border-acento-300 bg-acento-50' : 'border-borde bg-fondo-elevado hover:bg-fondo-apagado'
                  }`}
                >
                  <p className="text-sm font-medium text-texto">{clienta.nombre}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Insignia tono={TONO_POR_RIESGO[clienta.estadoDeRiesgo]}>{ETIQUETA_DE_RIESGO[clienta.estadoDeRiesgo]}</Insignia>
                    {/* `RN-CRM-06`: la sugerencia es automática; **el estado solo lo cambia una
                        persona**. Son dos datos distintos a propósito — fusionarlos sería la
                        asignación automática que `RN-CRM-05` prohíbe. */}
                    {clienta.sugeridaListaRoja && clienta.estadoDeRiesgo === 'normal' ? (
                      <Insignia tono="aviso">Sugerida para lista roja</Insignia>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div>
            {seleccionada ? (
              <DetalleDeClienta key={seleccionada} id={seleccionada} puedeMarcar={puedeMarcar} />
            ) : (
              <Vacio titulo="Elige una clienta para ver su historial" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetalleDeClienta({ id, puedeMarcar }: { id: string; puedeMarcar: boolean }) {
  const cliente = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [accionPorConfirmar, setAccionPorConfirmar] = useState<AccionDeRiesgo | null>(null);

  const { data, isLoading, isError, error: errorDeCarga } = useQuery({
    queryKey: ['clientas', 'detalle', id],
    queryFn: () => clientasApi.detalle(id),
  });

  const cambiar = useMutation({
    mutationFn: (accion: AccionDeRiesgo) => clientasApi.cambiarEstadoDeRiesgo(id, accion),
  });

  const ejecutar = async (accion: AccionDeRiesgo) => {
    setError(null);
    try {
      await cambiar.mutateAsync(accion);
      await Promise.all([
        cliente.invalidateQueries({ queryKey: ['clientas', 'detalle', id] }),
        // La lista también: el badge de riesgo de la tarjeta quedaría obsoleto.
        cliente.invalidateQueries({ queryKey: ['clientas', 'por-telefono'] }),
      ]);
      setAccionPorConfirmar(null);
    } catch (fallo) {
      setError(fallo);
    }
  };

  if (isLoading) return <Cargando mensaje="Cargando el historial…" />;
  if (isError || !data) return <AvisoDeError error={errorDeCarga} />;

  const { clienta, incidentes } = data;

  return (
    <div className="rounded-lg border border-borde bg-fondo-elevado p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h2 className="text-base font-semibold text-texto">{clienta.nombre}</h2>
          <p className="mt-0.5 text-sm text-texto-secundario">{clienta.telefono}</p>
          {clienta.telefonoAnterior ? (
            <p className="text-xs text-texto-terciario">Antes: {clienta.telefonoAnterior}</p>
          ) : null}
        </div>
        <div className="ml-auto text-right">
          <Insignia tono={TONO_POR_RIESGO[clienta.estadoDeRiesgo]}>{ETIQUETA_DE_RIESGO[clienta.estadoDeRiesgo]}</Insignia>
          <p className="mt-1.5 text-[11px] text-texto-terciario">
            {/* "cancelación" → "cancelaciones": el plural pierde la tilde, así que las dos formas van
                escritas enteras en vez de concatenar un sufijo. */}
            {clienta.cancelacionesOrdinarias} {clienta.cancelacionesOrdinarias === 1 ? 'cancelación' : 'cancelaciones'} con tiempo
          </p>
        </div>
      </div>

      {clienta.sugeridaListaRoja && clienta.estadoDeRiesgo === 'normal' ? (
        <p className="mt-4 rounded border border-aviso/30 bg-aviso-suave px-3 py-2.5 text-xs text-aviso">
          El sistema <strong>sugiere</strong> lista roja por su historial. La decisión es tuya: no se aplica sola.
        </p>
      ) : null}

      <AccionesDeRiesgo
        clienta={clienta}
        puedeMarcar={puedeMarcar}
        pendiente={cambiar.isPending}
        accionPorConfirmar={accionPorConfirmar}
        onPedirConfirmacion={setAccionPorConfirmar}
        onEjecutar={(accion) => void ejecutar(accion)}
      />

      <AvisoDeError error={error} className="mt-3" />

      <h3 className="mt-6 text-sm font-medium text-texto">Historial de incidentes</h3>
      {incidentes.length === 0 ? (
        <p className="mt-2 text-xs text-texto-terciario">Ninguno. Esta clienta no ha faltado ni cancelado tarde.</p>
      ) : (
        <ul className="mt-2 divide-y divide-borde">
          {incidentes.map((incidente) => (
            <li key={incidente.id} className="flex flex-wrap items-baseline gap-2 py-2">
              <Insignia tono={incidente.tipo === 'cancelacion_ordinaria' ? 'neutro' : 'peligro'}>
                {ETIQUETA_DE_INCIDENTE[incidente.tipo]}
              </Insignia>
              <span className="text-xs text-texto-secundario">{fechaYHoraLocal(incidente.ocurridoEn)}</span>
              {incidente.minutosDeAntelacion !== null ? (
                <span className="text-xs text-texto-terciario">· avisó {incidente.minutosDeAntelacion} min antes</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Los botones de riesgo. **Solo para `SUPER_ADMIN` / `ADMINISTRADOR`** (`DEC-042`).
 *
 * A la Encargada no se le muestran deshabilitados sino que no se muestran: un botón gris invita a
 * preguntar por qué no funciona. El aviso de la pantalla ya explica de quién es la decisión.
 *
 * Y recordatorio de `ADR-027`: esto decide **qué se dibuja**. El `@Roles` del endpoint
 * `POST /:id/estado-de-riesgo` ya responde `403` a la Encargada, así que la restricción real está
 * en el backend aunque alguien edite este archivo.
 */
function AccionesDeRiesgo({
  clienta,
  puedeMarcar,
  pendiente,
  accionPorConfirmar,
  onPedirConfirmacion,
  onEjecutar,
}: {
  clienta: Clienta;
  puedeMarcar: boolean;
  pendiente: boolean;
  accionPorConfirmar: AccionDeRiesgo | null;
  onPedirConfirmacion: (accion: AccionDeRiesgo | null) => void;
  onEjecutar: (accion: AccionDeRiesgo) => void;
}) {
  if (!puedeMarcar) return null;

  const TEXTOS: Record<AccionDeRiesgo, { boton: string; confirmacion: string; variante: 'peligro' | 'secundario' }> = {
    marcar_lista_roja: {
      boton: 'Marcar lista roja',
      confirmacion: 'A partir de ahora se le pedirá un anticipo del 40 % para agendar.',
      variante: 'peligro',
    },
    marcar_bloqueada: {
      boton: 'Bloquear',
      confirmacion: 'No podrá agendar de ninguna forma, ni por WhatsApp ni desde el mostrador.',
      variante: 'peligro',
    },
    rehabilitar: {
      boton: 'Rehabilitar',
      confirmacion: 'Volverá a agendar con normalidad, sin anticipo.',
      variante: 'secundario',
    },
  };

  const disponibles: AccionDeRiesgo[] =
    clienta.estadoDeRiesgo === 'normal'
      ? ['marcar_lista_roja', 'marcar_bloqueada']
      : clienta.estadoDeRiesgo === 'lista_roja'
        ? ['marcar_bloqueada', 'rehabilitar']
        : ['rehabilitar'];

  if (accionPorConfirmar) {
    const texto = TEXTOS[accionPorConfirmar];
    return (
      <div className="mt-4 rounded border border-borde-fuerte bg-fondo-apagado px-3.5 py-3">
        <p className="text-xs text-texto">{texto.confirmacion}</p>
        <div className="mt-3 flex gap-2">
          <Boton variante={texto.variante} cargando={pendiente} onClick={() => onEjecutar(accionPorConfirmar)}>
            Confirmar
          </Boton>
          <Boton variante="fantasma" onClick={() => onPedirConfirmacion(null)}>
            Cancelar
          </Boton>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {disponibles.map((accion) => (
        <Boton key={accion} variante={TEXTOS[accion].variante} onClick={() => onPedirConfirmacion(accion)}>
          {TEXTOS[accion].boton}
        </Boton>
      ))}
    </div>
  );
}
