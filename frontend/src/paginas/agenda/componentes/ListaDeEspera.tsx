import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Clienta, SolicitudListaEspera } from '../../../api/contrato';
import { listaEsperaApi } from '../../../api/lista-espera';
import { Boton } from '../../../componentes/Boton';
import { Cargando } from '../../../componentes/Cargando';
import { Insignia } from '../../../componentes/Insignia';
import { AvisoDeError } from '../../../componentes/AvisoDeError';
import { Vacio } from '../../../componentes/Vacio';
import { BuscadorDeClienta, SelectorDeManicurista, SelectorDeServicio, useServiciosActivos } from '../../../componentes/selectores';
import {
  ETIQUETA_DE_ESTADO_SOLICITUD,
  fechaYHoraLocal,
  instanteDesdeHoraLocal,
  minutosHasta,
} from '../../../componentes/etiquetas';

const TONO_POR_ESTADO = { en_espera: 'neutro', notificada: 'aviso', aceptada: 'exito', expirada: 'neutro', cancelada: 'neutro' } as const;

/**
 * La fila de espera de una sucursal y fecha (`DEC-039`).
 *
 * ## EL ORDEN ES FIFO Y SALE DE LA BASE
 *
 * El backend devuelve la fila en orden de llegada (`creado_en`), y por eso **no hay columna
 * `posicion`**: una posición almacenada se desincroniza en cuanto alguien cancela. Esta pantalla
 * la numera al pintar, que es lo único que necesita quien opera.
 *
 * ## LA OFERTA NO RETIENE EL LUGAR
 *
 * `RN-AGE-13`: mientras la clienta decide, otra puede tomar el hueco. Por eso aceptar en su nombre
 * **puede fallar con `409`** y por eso la cuenta atrás es prominente: no es decorativa, es el
 * tiempo real que queda antes de que el turno pase a la siguiente.
 */
export function ListaDeEspera({ sucursalId, fecha }: { sucursalId: string; fecha: string }) {
  const cliente = useQueryClient();
  const clave = ['lista-espera', sucursalId, fecha] as const;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: clave,
    queryFn: () => listaEsperaApi.listar(sucursalId, fecha),
    enabled: sucursalId !== '' && fecha !== '',
    // La ventana de una oferta vence en una hora: refrescar cada minuto mantiene la cuenta atrás
    // honesta sin convertir esto en un sondeo agresivo.
    refetchInterval: 60_000,
  });

  const refrescar = async () => {
    await Promise.all([
      cliente.invalidateQueries({ queryKey: clave }),
      // Aceptar una oferta **agenda una cita de verdad**: la agenda del día cambia.
      cliente.invalidateQueries({ queryKey: ['agenda'] }),
    ]);
  };

  /**
   * `mutate` + `onSuccess`: un `await mutateAsync()` en el `onClick` deja un rechazo sin gestionar
   * cuando el barrido falla, porque React descarta la promesa del manejador. El resumen se compone
   * con el resultado que `onSuccess` recibe, que es el mismo dato.
   */
  const avanzar = useMutation({
    mutationFn: () => listaEsperaApi.avanzarTurno(),
    onSuccess: async (resultado) => {
      await refrescar();
      setResumenDeAvance(
        `${resultado.expiradas.length} turno${resultado.expiradas.length === 1 ? '' : 's'} vencido${
          resultado.expiradas.length === 1 ? '' : 's'
        }, ${resultado.nuevasOfertas.length} oferta${resultado.nuevasOfertas.length === 1 ? '' : 's'} nueva${
          resultado.nuevasOfertas.length === 1 ? '' : 's'
        }.`,
      );
    },
  });
  const [resumenDeAvance, setResumenDeAvance] = useState<string | null>(null);

  const fila = data?.solicitudes ?? [];
  const activas = fila.filter((solicitud) => solicitud.estado === 'en_espera' || solicitud.estado === 'notificada');

  return (
    <div className="space-y-4">
      <InscribirEnFila sucursalId={sucursalId} fecha={fecha} onInscrita={refrescar} />

      <div className="rounded-lg border border-borde bg-fondo-elevado p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-sm font-semibold text-texto">Fila de este día</h2>
          <Boton
            variante="fantasma"
            className="ml-auto"
            cargando={avanzar.isPending}
            onClick={() => avanzar.mutate()}
          >
            {/* El planificador ya lo hace cada pocos minutos (`ADR-025`). Este botón existe para
                cuando la Encargada no quiere esperar al siguiente barrido. */}
            Avanzar turno ahora
          </Boton>
        </div>

        {resumenDeAvance ? (
          <p role="status" className="mt-2 rounded border border-borde bg-fondo-apagado px-3 py-2 text-xs text-texto-secundario">
            {resumenDeAvance}
          </p>
        ) : null}

        {isLoading ? (
          <Cargando mensaje="Cargando la fila…" />
        ) : isError ? (
          <AvisoDeError error={error} className="mt-3" />
        ) : activas.length === 0 ? (
          <div className="mt-3">
            <Vacio titulo="Nadie en espera para este día" detalle="Se inscribe a una clienta cuando pide una hora que no hay." />
          </div>
        ) : (
          <ol className="mt-3 divide-y divide-borde" aria-label="Fila de espera">
            {activas.map((solicitud, indice) => (
              <FilaDeSolicitud key={solicitud.id} solicitud={solicitud} posicion={indice + 1} onCambio={refrescar} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function FilaDeSolicitud({
  solicitud,
  posicion,
  onCambio,
}: {
  solicitud: SolicitudListaEspera;
  posicion: number;
  onCambio: () => Promise<void> | void;
}) {
  const { data: servicios } = useServiciosActivos();
  const [aceptando, setAceptando] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const aceptar = useMutation({
    mutationFn: ({ inicio, manicuristaId }: { inicio: string; manicuristaId?: string }) =>
      listaEsperaApi.aceptar(solicitud.id, inicio, manicuristaId),
  });
  const cancelar = useMutation({ mutationFn: () => listaEsperaApi.cancelar(solicitud.id) });

  const servicio = (servicios ?? []).find((candidato) => candidato.id === solicitud.servicioId);
  const minutos = solicitud.expiraEn === null ? null : minutosHasta(solicitud.expiraEn);

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fondo-apagado text-xs font-semibold text-texto-secundario">
          {posicion}
        </span>
        <Insignia tono={TONO_POR_ESTADO[solicitud.estado]}>{ETIQUETA_DE_ESTADO_SOLICITUD[solicitud.estado]}</Insignia>
        <span className="text-sm text-texto">{servicio?.nombre ?? 'Servicio'}</span>
        <span className="font-mono text-[11px] text-texto-terciario">clienta {solicitud.clientaId}</span>
      </div>

      {solicitud.estado === 'notificada' && solicitud.expiraEn !== null ? (
        <p className={`mt-1.5 text-xs font-medium ${minutos !== null && minutos <= 10 ? 'text-peligro' : 'text-aviso'}`}>
          {minutos === null || minutos <= 0
            ? 'Su turno ya venció: avanza el turno para pasar el hueco a la siguiente.'
            : `Le quedan ${minutos} min para responder (vence ${fechaYHoraLocal(solicitud.expiraEn)}).`}
          {/* `RN-AGE-13`: mientras decide, otra puede tomar el hueco. Decirlo evita que quien
              opera prometa el lugar por teléfono. */}
          <span className="font-normal text-texto-terciario"> El lugar no está reservado mientras decide.</span>
        </p>
      ) : null}

      <div className="mt-2">
        {aceptando ? (
          <FormularioDeAceptacion
            solicitud={solicitud}
            pendiente={aceptar.isPending}
            onCancelar={() => {
              setAceptando(false);
              setError(null);
            }}
            onAceptar={async (datos) => {
              setError(null);
              try {
                await aceptar.mutateAsync(datos);
                await onCambio();
                setAceptando(false);
              } catch (fallo) {
                setError(fallo);
              }
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <Boton onClick={() => setAceptando(true)}>Aceptó: agendar</Boton>
            <Boton
              variante="fantasma"
              cargando={cancelar.isPending}
              onClick={async () => {
                await cancelar.mutateAsync();
                await onCambio();
              }}
            >
              Quitar de la fila
            </Boton>
          </div>
        )}
      </div>

      <AvisoDeError error={error} className="mt-2" />
    </li>
  );
}

/**
 * Hora a la que se le agenda al aceptar.
 *
 * Se pide **explícitamente** y no se deduce del hueco ofrecido: desde la interfaz no se sabe cuál
 * fue el hueco —el backend lo guarda, pero no viaja en la solicitud— y, sobre todo, en una llamada
 * real la clienta puede aceptar *otra* hora del mismo día. Dejar que quien atiende la escriba es
 * lo que hace útil este botón en el mostrador.
 */
function FormularioDeAceptacion({
  solicitud,
  pendiente,
  onCancelar,
  onAceptar,
}: {
  solicitud: SolicitudListaEspera;
  pendiente: boolean;
  onCancelar: () => void;
  onAceptar: (datos: { inicio: string; manicuristaId?: string }) => Promise<void>;
}) {
  const [hora, setHora] = useState('10:00');
  const [manicuristaId, setManicuristaId] = useState('');

  return (
    <div className="rounded border border-borde-fuerte bg-fondo-apagado p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`acepta-hora-${solicitud.id}`} className="block text-xs font-medium text-texto-secundario">
            ¿A qué hora se le agenda?
          </label>
          <input
            id={`acepta-hora-${solicitud.id}`}
            type="time"
            value={hora}
            onChange={(evento) => setHora(evento.target.value)}
            className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
          />
        </div>
        <SelectorDeManicurista
          sucursalId={solicitud.sucursalId}
          valor={manicuristaId}
          onCambio={setManicuristaId}
          id={`acepta-mani-${solicitud.id}`}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Boton
          cargando={pendiente}
          onClick={() =>
            void onAceptar({
              inicio: instanteDesdeHoraLocal(solicitud.fecha, hora),
              ...(manicuristaId ? { manicuristaId } : {}),
            })
          }
        >
          Agendar
        </Boton>
        <Boton variante="fantasma" onClick={onCancelar}>
          Volver
        </Boton>
      </div>
    </div>
  );
}

function InscribirEnFila({
  sucursalId,
  fecha,
  onInscrita,
}: {
  sucursalId: string;
  fecha: string;
  onInscrita: () => Promise<void> | void;
}) {
  const [clienta, setClienta] = useState<Clienta | null>(null);
  const [servicioId, setServicioId] = useState('');
  const [error, setError] = useState<unknown>(null);

  const inscribir = useMutation({
    mutationFn: () => listaEsperaApi.inscribir({ sucursalId, clientaId: clienta!.id, servicioId, fecha }),
  });

  return (
    <div className="rounded-lg border border-borde bg-fondo-elevado p-4">
      <h2 className="text-sm font-semibold text-texto">Anotar en la lista de espera</h2>
      <p className="mt-1 text-xs text-texto-secundario">
        Para cuando una clienta pide una hora que no hay. Se le avisa si se libera algo ese día.
      </p>

      <div className="mt-4 space-y-3">
        <BuscadorDeClienta seleccionada={clienta} onSeleccionar={setClienta} />
        <SelectorDeServicio valor={servicioId} onCambio={setServicioId} id="espera-servicio" />
        <AvisoDeError error={error} />
        <Boton
          cargando={inscribir.isPending}
          disabled={clienta === null || servicioId === '' || sucursalId === ''}
          onClick={async () => {
            setError(null);
            try {
              await inscribir.mutateAsync();
              await onInscrita();
              setClienta(null);
              setServicioId('');
            } catch (fallo) {
              setError(fallo);
            }
          }}
        >
          Anotar
        </Boton>
      </div>
    </div>
  );
}
