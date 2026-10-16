import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Anticipo, EstadoAnticipo } from '../../api/contrato';
import { anticiposApi } from '../../api/anticipos';
import { Boton } from '../../componentes/Boton';
import { Cargando } from '../../componentes/Cargando';
import { Insignia } from '../../componentes/Insignia';
import { AvisoDeError } from '../../componentes/AvisoDeError';
import { Vacio } from '../../componentes/Vacio';
import { ETIQUETA_DE_ESTADO_ANTICIPO, fechaYHoraLocal, haceCuanto, pesos } from '../../componentes/etiquetas';

const PESTANAS: { estado: EstadoAnticipo; texto: string }[] = [
  { estado: 'pendiente', texto: 'Esperando transferencia' },
  { estado: 'pagado', texto: 'Pagados' },
  { estado: 'expirado', texto: 'Expirados' },
];

const TONO_POR_ESTADO = { pendiente: 'aviso', pagado: 'exito', expirado: 'neutro', retenido: 'info' } as const;

/**
 * Conciliación manual de anticipos por transferencia (`RN-ANT-01` a `RN-ANT-04`).
 *
 * ## QUÉ TRABAJO REAL RESUELVE ESTA PANTALLA
 *
 * **No hay pasarela de pago.** La clienta de lista roja transfiere por su cuenta y manda el
 * comprobante por WhatsApp; alguien del salón mira el banco, ve el movimiento y lo registra. Esta
 * pantalla es ese registro: la lista de transferencias que se están esperando, con el monto que
 * debe coincidir.
 *
 * ## EL `409` AL CONFIRMAR NO ES UN ERROR DEL SISTEMA
 *
 * Confirmar el pago **activa la cita** en la misma transacción. Si otra clienta tomó el último
 * hueco mientras llegaba la transferencia, responde `409 HORARIO_NO_DISPONIBLE` y **el pago no
 * queda confirmado** — porque la oferta nunca retuvo el lugar (`RN-ANT-03`). Es un caso normal, y
 * el dinero ya está transferido: hay que hablar con la clienta. `AvisoDeError` lo explica con esas
 * palabras en lugar de mostrar *"Error 409"*.
 */
export function Anticipos() {
  const [estado, setEstado] = useState<EstadoAnticipo>('pendiente');
  const cliente = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['anticipos', estado],
    queryFn: () => anticiposApi.listar(estado),
  });

  const refrescar = () => cliente.invalidateQueries({ queryKey: ['anticipos'] });

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-texto">Anticipos</h1>
        <p className="mt-1 text-sm text-texto-secundario">
          Transferencias que se están esperando para activar una cita. Se concilian a mano: no hay pasarela de pago.
        </p>
      </header>

      <div className="mb-4 flex gap-1 rounded bg-fondo-apagado p-0.5" role="tablist" aria-label="Estado del anticipo">
        {PESTANAS.map((pestana) => (
          <button
            key={pestana.estado}
            type="button"
            role="tab"
            aria-selected={estado === pestana.estado}
            onClick={() => setEstado(pestana.estado)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              estado === pestana.estado ? 'bg-fondo-elevado text-texto shadow-sm' : 'text-texto-secundario hover:text-texto'
            }`}
          >
            {pestana.texto}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Cargando mensaje="Cargando anticipos…" />
      ) : isError ? (
        <AvisoDeError error={error} />
      ) : (data?.anticipos ?? []).length === 0 ? (
        <Vacio
          titulo={estado === 'pendiente' ? 'No hay transferencias pendientes' : 'Nada aquí'}
          {...(estado === 'pendiente'
            ? { detalle: 'Cuando una clienta de lista roja agende, su anticipo aparecerá en esta lista.' }
            : {})}
        />
      ) : (
        <ul className="space-y-3">
          {(data?.anticipos ?? []).map((anticipo) => (
            <FilaDeAnticipo key={anticipo.id} anticipo={anticipo} onCambio={refrescar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilaDeAnticipo({ anticipo, onCambio }: { anticipo: Anticipo; onCambio: () => Promise<void> | void }) {
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [confirmandoExpirar, setConfirmandoExpirar] = useState(false);

  const confirmar = useMutation({ mutationFn: () => anticiposApi.confirmarPago(anticipo.id, referencia.trim()) });
  const expirar = useMutation({ mutationFn: () => anticiposApi.expirar(anticipo.id, 'La transferencia nunca llegó.') });

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setError(null);
    try {
      await accion();
      await onCambio();
    } catch (fallo) {
      setError(fallo);
    }
  };

  const pendiente = anticipo.estado === 'pendiente';

  return (
    <li className="rounded-lg border border-borde bg-fondo-elevado p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-texto">{pesos(anticipo.montoCentavos)}</p>
          <p className="mt-0.5 text-xs text-texto-secundario">
            {anticipo.porcentajeAplicado}% del servicio · generado {haceCuanto(anticipo.creadoEn)}
          </p>
          {/* Los ids se muestran porque son el único vínculo con la cita y la clienta mientras la
              Agenda Operativa (Parte 2) no exista. En monoespaciado para poder copiarlos. */}
          <p className="mt-1.5 font-mono text-[11px] text-texto-terciario">cita {anticipo.citaId}</p>
          <p className="font-mono text-[11px] text-texto-terciario">clienta {anticipo.clientaId}</p>
        </div>

        <div className="ml-auto text-right">
          <Insignia tono={TONO_POR_ESTADO[anticipo.estado]}>{ETIQUETA_DE_ESTADO_ANTICIPO[anticipo.estado]}</Insignia>
          {anticipo.confirmadoEn ? (
            <p className="mt-1.5 text-[11px] text-texto-terciario">Confirmado {fechaYHoraLocal(anticipo.confirmadoEn)}</p>
          ) : null}
          {anticipo.referenciaPago ? (
            <p className="font-mono text-[11px] text-texto-terciario">ref. {anticipo.referenciaPago}</p>
          ) : null}
        </div>
      </div>

      {pendiente ? (
        <div className="mt-4 border-t border-borde pt-4">
          <label htmlFor={`referencia-${anticipo.id}`} className="block text-xs font-medium text-texto-secundario">
            Referencia del comprobante
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input
              id={`referencia-${anticipo.id}`}
              value={referencia}
              onChange={(evento) => setReferencia(evento.target.value)}
              placeholder="Folio o referencia de la transferencia"
              className="min-w-0 flex-1 rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto placeholder:text-texto-terciario"
            />
            <Boton
              cargando={confirmar.isPending}
              // La referencia es obligatoria y no se deja enviar vacía: es el único rastro de
              // **qué movimiento del banco** corresponde a esta cita. Sin ella, una aclaración
              // posterior no tiene por dónde empezar.
              disabled={referencia.trim().length === 0}
              onClick={() => void ejecutar(() => confirmar.mutateAsync())}
            >
              Confirmar pago
            </Boton>
          </div>

          <div className="mt-3">
            {confirmandoExpirar ? (
              <div className="flex flex-wrap items-center gap-2 rounded border border-peligro/30 bg-peligro-suave px-3 py-2.5">
                <p className="text-xs text-peligro">
                  Al expirar, la cita se libera y la clienta la pierde. <strong>No hay devolución automática</strong>.
                </p>
                <div className="ml-auto flex gap-2">
                  <Boton variante="fantasma" onClick={() => setConfirmandoExpirar(false)}>
                    Cancelar
                  </Boton>
                  <Boton variante="peligro" cargando={expirar.isPending} onClick={() => void ejecutar(() => expirar.mutateAsync())}>
                    Sí, expirar
                  </Boton>
                </div>
              </div>
            ) : (
              /* Dos pasos a propósito: expirar libera la cita y la clienta la pierde. Es
                 destructivo y no tiene vuelta, así que no puede quedar a un clic de distancia. */
              <Boton variante="fantasma" onClick={() => setConfirmandoExpirar(true)}>
                La transferencia nunca llegó
              </Boton>
            )}
          </div>

          <AvisoDeError error={error} className="mt-3" />
        </div>
      ) : (
        <AvisoDeError error={error} className="mt-3" />
      )}
    </li>
  );
}
