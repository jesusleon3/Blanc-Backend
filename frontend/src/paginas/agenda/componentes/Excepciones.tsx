import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CitaAfectada, ResultadoDeExcepcion } from '../../../api/contrato';
import { personalApi } from '../../../api/personal';
import { Boton } from '../../../componentes/Boton';
import { Cargando } from '../../../componentes/Cargando';
import { Insignia } from '../../../componentes/Insignia';
import { AvisoDeError } from '../../../componentes/AvisoDeError';
import { Vacio } from '../../../componentes/Vacio';
import { SelectorDeManicurista, SelectorDeSucursal, useManicuristasDeSucursal } from '../../../componentes/selectores';
import {
  ETIQUETA_DE_AFECTACION,
  ETIQUETA_DE_TIPO_EXCEPCION,
  fechaYHoraLocal,
  horaLocal,
  instanteDesdeHoraLocal,
  rangoDelDia,
} from '../../../componentes/etiquetas';

/**
 * Ausencias y coberturas (`DEC-036`).
 *
 * ## POR QUÉ ESTO NUNCA BLOQUEA, Y POR QUÉ LA ALERTA ES EL ENTREGABLE
 *
 * Sería tentador rechazar una ausencia cuando hay citas asignadas, pero eso invertiría la
 * realidad: **la manicurista no falta porque el sistema se lo permita.** Si el sistema no deja
 * anotarlo, el motor de disponibilidad sigue contando con alguien que no está y **sigue vendiendo
 * huecos imposibles**.
 *
 * Así que se registra siempre y el backend devuelve `citasAfectadas`. **Esa lista es el producto
 * de esta pantalla**: es el momento en que la Encargada puede reasignar o reprogramar, y si se
 * mostrara discreta —o se perdiera al cerrar un diálogo— el daño se descubriría cuando la clienta
 * llegue y no haya quien la atienda.
 */
export function Excepciones({ sucursalId, fecha }: { sucursalId: string; fecha: string }) {
  const cliente = useQueryClient();
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoDeExcepcion | null>(null);

  const rango = rangoDelDia(fecha);
  const clave = ['excepciones', sucursalId, fecha] as const;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: clave,
    queryFn: () => personalApi.excepciones({ ...rango, ...(sucursalId ? { sucursalId } : {}) }),
    enabled: fecha !== '',
  });

  const manicuristas = useManicuristasDeSucursal(sucursalId);
  const nombreDe = (id: string) => (manicuristas.data ?? []).find((m) => m.id === id)?.nombre ?? 'Manicurista';

  const refrescar = async () => {
    await Promise.all([
      cliente.invalidateQueries({ queryKey: clave }),
      // La agenda y la disponibilidad cambian: una ausencia resta capacidad.
      cliente.invalidateQueries({ queryKey: ['agenda'] }),
      cliente.invalidateQueries({ queryKey: ['disponibilidad'] }),
    ]);
  };

  // `mutate` + `onSuccess`: un `await mutateAsync()` en el `onClick` deja un rechazo sin gestionar
  // cuando la revocación falla, porque React descarta la promesa del manejador.
  const revocar = useMutation({ mutationFn: (id: string) => personalApi.revocar(id), onSuccess: refrescar });

  return (
    <div className="space-y-4">
      <RegistrarExcepcion
        sucursalId={sucursalId}
        fecha={fecha}
        onRegistrada={async (resultado) => {
          setUltimoResultado(resultado);
          await refrescar();
        }}
      />

      {ultimoResultado ? (
        <AlertaDeCitasAfectadas resultado={ultimoResultado} nombreDe={nombreDe} onCerrar={() => setUltimoResultado(null)} />
      ) : null}

      <div className="rounded-lg border border-borde bg-fondo-elevado p-4">
        <h2 className="text-sm font-semibold text-texto">Registradas para este día</h2>

        {isLoading ? (
          <Cargando mensaje="Cargando…" />
        ) : isError ? (
          <AvisoDeError error={error} className="mt-3" />
        ) : (data?.excepciones ?? []).length === 0 ? (
          <div className="mt-3">
            <Vacio titulo="Ninguna ausencia ni cobertura" detalle="Todo el personal está donde le toca." />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-borde" aria-label="Excepciones registradas">
            {(data?.excepciones ?? []).map((excepcion) => (
              <li key={excepcion.id} className="flex flex-wrap items-center gap-3 py-3">
                <Insignia tono={excepcion.tipo === 'ausencia' ? 'peligro' : 'info'}>
                  {ETIQUETA_DE_TIPO_EXCEPCION[excepcion.tipo]}
                </Insignia>
                <div className="min-w-0">
                  <p className="text-sm text-texto">{nombreDe(excepcion.manicuristaId)}</p>
                  <p className="text-xs text-texto-secundario">
                    {horaLocal(excepcion.inicio)} – {horaLocal(excepcion.fin)}
                    {excepcion.motivo ? ` · ${excepcion.motivo}` : ''}
                  </p>
                </div>
                <Boton
                  variante="fantasma"
                  className="ml-auto"
                  cargando={revocar.isPending}
                  onClick={() => revocar.mutate(excepcion.id)}
                >
                  {/* Revocar no es "deshacer una falta": es corregir una captura equivocada. La
                      capacidad vuelve sola en cuanto desaparece el registro. */}
                  Se capturó mal
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RegistrarExcepcion({
  sucursalId,
  fecha,
  onRegistrada,
}: {
  sucursalId: string;
  fecha: string;
  onRegistrada: (resultado: ResultadoDeExcepcion) => Promise<void> | void;
}) {
  const [tipo, setTipo] = useState<'ausencia' | 'cobertura'>('ausencia');
  const [manicuristaId, setManicuristaId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [diaCompleto, setDiaCompleto] = useState(true);
  const [desde, setDesde] = useState('14:00');
  const [hasta, setHasta] = useState('20:00');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<unknown>(null);

  const registrar = useMutation({
    mutationFn: () => {
      /**
       * Día completo frente a salida anticipada. **Es la distinción que pidió `DEC-036`**: no es lo
       * mismo *"hoy no viene"* que *"se va a las 2"*, y el segundo caso es el frecuente. Un día
       * completo es `00:00–23:59` de pared, no un `inicio` sin `fin`: el backend trabaja con rangos.
       */
      const rango = diaCompleto ? rangoDelDia(fecha) : { inicio: instanteDesdeHoraLocal(fecha, desde), fin: instanteDesdeHoraLocal(fecha, hasta) };
      const base = { manicuristaId, ...rango, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) };

      return tipo === 'ausencia' ? personalApi.registrarAusencia(base) : personalApi.registrarCobertura({ ...base, sucursalId: destinoId });
    },
  });

  const completo = manicuristaId !== '' && (tipo === 'ausencia' || destinoId !== '');

  return (
    <div className="rounded-lg border border-borde bg-fondo-elevado p-4">
      <h2 className="text-sm font-semibold text-texto">Registrar ausencia o cobertura</h2>

      <div className="mt-3 flex gap-1 rounded bg-fondo-apagado p-0.5" role="tablist" aria-label="Tipo de excepción">
        {(
          [
            ['ausencia', 'Ausencia'],
            ['cobertura', 'Cobertura en otra sucursal'],
          ] as const
        ).map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={tipo === valor}
            onClick={() => setTipo(valor)}
            className={`flex-1 rounded px-2.5 py-1.5 text-xs font-medium transition ${
              tipo === valor ? 'bg-fondo-elevado text-texto shadow-sm' : 'text-texto-secundario hover:text-texto'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <SelectorDeManicurista
          sucursalId={sucursalId}
          valor={manicuristaId}
          onCambio={setManicuristaId}
          id="exc-manicurista"
          etiqueta="¿Quién?"
        />

        {tipo === 'cobertura' ? (
          <SelectorDeSucursal valor={destinoId} onCambio={setDestinoId} id="exc-destino" etiqueta="¿A qué sucursal va?" />
        ) : null}

        <label className="flex items-center gap-2 text-sm text-texto">
          <input type="checkbox" checked={diaCompleto} onChange={(evento) => setDiaCompleto(evento.target.checked)} />
          Todo el día
        </label>

        {!diaCompleto ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="exc-desde" className="block text-xs font-medium text-texto-secundario">
                Desde
              </label>
              <input
                id="exc-desde"
                type="time"
                value={desde}
                onChange={(evento) => setDesde(evento.target.value)}
                className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
              />
            </div>
            <div>
              <label htmlFor="exc-hasta" className="block text-xs font-medium text-texto-secundario">
                Hasta
              </label>
              <input
                id="exc-hasta"
                type="time"
                value={hasta}
                onChange={(evento) => setHasta(evento.target.value)}
                className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
              />
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="exc-motivo" className="block text-xs font-medium text-texto-secundario">
            Motivo (opcional)
          </label>
          <input
            id="exc-motivo"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
          />
        </div>

        <AvisoDeError error={error} />

        <Boton
          cargando={registrar.isPending}
          disabled={!completo}
          onClick={async () => {
            setError(null);
            try {
              await onRegistrada(await registrar.mutateAsync());
              setManicuristaId('');
              setMotivo('');
            } catch (fallo) {
              setError(fallo);
            }
          }}
        >
          Registrar
        </Boton>
      </div>
    </div>
  );
}

/**
 * La alerta de citas comprometidas. **Es el producto de esta pantalla**, no un acuse de recibo.
 *
 * Se muestra destacada y **no se cierra sola**: la Encargada tiene que poder actuar sobre ella, y
 * un aviso que desaparece a los tres segundos haría que el daño se descubriera cuando la clienta
 * llegue.
 *
 * Cubre las dos clases que el backend distingue:
 * - `cita_asignada` — esa manicurista tenía esta cita. Hay que reasignarla o reprogramarla.
 * - `sobrecupo_en_sucursal` — nadie la tenía asignada, pero **la sucursal se queda sin suficiente
 *   personal** para lo que ya está vendido. `deficitDePersonal` dice cuánta gente falta.
 */
function AlertaDeCitasAfectadas({
  resultado,
  nombreDe,
  onCerrar,
}: {
  resultado: ResultadoDeExcepcion;
  nombreDe: (id: string) => string;
  onCerrar: () => void;
}) {
  const { excepcion, citasAfectadas } = resultado;

  if (citasAfectadas.length === 0) {
    return (
      <div role="status" className="rounded-lg border border-exito/30 bg-exito-suave p-4">
        <p className="text-sm font-medium text-exito">
          {ETIQUETA_DE_TIPO_EXCEPCION[excepcion.tipo]} registrada. Ninguna cita queda comprometida.
        </p>
        <Boton variante="fantasma" className="mt-2" onClick={onCerrar}>
          Entendido
        </Boton>
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-lg border-2 border-peligro bg-peligro-suave p-4">
      <h2 className="text-base font-semibold text-peligro">
        {citasAfectadas.length} cita{citasAfectadas.length === 1 ? '' : 's'} queda{citasAfectadas.length === 1 ? '' : 'n'} comprometida
        {citasAfectadas.length === 1 ? '' : 's'}
      </h2>
      <p className="mt-1 text-xs text-texto">
        La {ETIQUETA_DE_TIPO_EXCEPCION[excepcion.tipo].toLowerCase()} <strong>sí quedó registrada</strong> — el sistema no puede fingir que
        hay personal que no está. Pero estas citas necesitan que alguien las reasigne o las reprograme <strong>ahora</strong>.
      </p>

      <ul className="mt-3 space-y-2" aria-label="Citas comprometidas">
        {citasAfectadas.map((afectada) => (
          <FilaAfectada key={`${afectada.citaId}-${afectada.clase}`} afectada={afectada} nombreDe={nombreDe} />
        ))}
      </ul>

      <Boton variante="secundario" className="mt-3" onClick={onCerrar}>
        Ya las gestioné
      </Boton>
    </div>
  );
}

function FilaAfectada({ afectada, nombreDe }: { afectada: CitaAfectada; nombreDe: (id: string) => string }) {
  return (
    <li className="rounded border border-peligro/30 bg-fondo-elevado px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Insignia tono={afectada.clase === 'cita_asignada' ? 'peligro' : 'aviso'}>{ETIQUETA_DE_AFECTACION[afectada.clase]}</Insignia>
        <span className="text-xs font-medium text-texto">{fechaYHoraLocal(afectada.inicio)}</span>
        {afectada.manicuristaId ? <span className="text-xs text-texto-secundario">· {nombreDe(afectada.manicuristaId)}</span> : null}
      </div>
      {afectada.deficitDePersonal !== undefined && afectada.deficitDePersonal > 0 ? (
        <p className="mt-1 text-[11px] text-aviso">
          Faltan {afectada.deficitDePersonal} manicurista{afectada.deficitDePersonal === 1 ? '' : 's'} a esa hora.
        </p>
      ) : null}
      <p className="mt-1 font-mono text-[11px] text-texto-terciario">cita {afectada.citaId}</p>
    </li>
  );
}
