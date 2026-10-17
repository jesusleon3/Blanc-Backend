import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Cita } from '../../../api/contrato';
import { agendaApi } from '../../../api/agenda';
import { Boton } from '../../../componentes/Boton';
import { AvisoDeError } from '../../../componentes/AvisoDeError';
import { SelectorDeManicurista } from '../../../componentes/selectores';
import { fechaLocalDeHoy, instanteDesdeHoraLocal } from '../../../componentes/etiquetas';

/**
 * Agendar la reposición de un servicio bajo garantía (`P10`, `RN-GAR-01..06`).
 *
 * ## POR QUÉ NO ES UNA TRANSICIÓN DE LA CITA, Y POR QUÉ ESO SE VE EN LA PANTALLA
 *
 * Esta acción **no está en `ACCIONES_POR_ESTADO`** y no es un descuido. Las demás acciones mueven
 * la cita por su máquina de estados (`P3`); esta **crea una cita nueva** y deja la original
 * intacta en `completada`. Mezclarla con las transiciones habría invitado a pensar que la cita
 * original "pasa a garantía", y entonces el historial de la clienta perdería el hecho de que el
 * primer servicio se realizó y se cobró.
 *
 * ## LO QUE ESTE BOTÓN ES, EN TÉRMINOS DE LA REGLA
 *
 * `RN-GAR-03` exige **acción humana explícita**: no hay aprobación automática de garantías en
 * ninguna parte del sistema, y el bot no puede concederlas — cuando una clienta reclama, el filtro
 * determinista la escala a una persona. Pulsar este botón *es* esa decisión humana.
 *
 * Y `RN-GAR-04` dice que **no hay un beneficio fijo**: la Dueña decide caso por caso entre
 * reposición, descuento o producto. Lo que el sistema sabe agendar es la **reposición**, porque es
 * la única de las tres que ocupa una silla y un rato de trabajo. El aviso del formulario lo dice
 * para que nadie entienda que "garantía" significa automáticamente "repetir el servicio gratis".
 */
export function DialogoDeGarantia({
  cita,
  onCerrar,
  onCambio,
}: {
  cita: Cita;
  onCerrar: () => void;
  onCambio: () => Promise<void> | void;
}) {
  const [fecha, setFecha] = useState(fechaLocalDeHoy());
  const [hora, setHora] = useState('');
  const [manicuristaId, setManicuristaId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pendiente, setPendiente] = useState(false);

  /**
   * Los días de cobertura se **consultan**, no se escriben aquí.
   *
   * Salen de `DIAS_DE_GARANTIA` en el servidor (`RN-GAR-01`, 7 por defecto). Si la Dueña lo
   * cambiara y la pantalla dijera "7", la interfaz estaría prometiendo una cobertura distinta de
   * la que el backend va a hacer cumplir, y quien atiende el mostrador se enteraría por un `409`
   * delante de la clienta.
   */
  const cobertura = useQuery({
    queryKey: ['garantia-cobertura'],
    queryFn: () => agendaApi.coberturaDeGarantia(),
    staleTime: 60 * 60_000,
  });

  const enviar = async () => {
    setError(null);
    setPendiente(true);
    try {
      await agendaApi.agendarGarantia({
        citaGarantizadaId: cita.id,
        inicio: instanteDesdeHoraLocal(fecha, hora),
        ...(manicuristaId ? { manicuristaId } : {}),
        ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
      });
      await onCambio();
      onCerrar();
    } catch (fallo) {
      setError(fallo);
    } finally {
      setPendiente(false);
    }
  };

  return (
    <div className="rounded border border-borde-fuerte bg-fondo-apagado p-3">
      <p className="text-sm font-semibold text-texto">Reposición por garantía</p>
      <p className="mt-1 text-xs text-texto-secundario">
        Se agenda <strong>el mismo servicio</strong> de esta cita, sin costo.{' '}
        {cobertura.data ? <>La garantía cubre {cobertura.data.diasDeCobertura} días desde el servicio.</> : null}
      </p>

      {/* `RN-GAR-04`: el beneficio no es fijo. Decirlo aquí evita que "garantía" se convierta en
          "reposición" por costumbre de la interfaz, y recuerda quién decide las otras dos formas. */}
      <p className="mt-2 rounded border border-aviso/30 bg-aviso-suave px-2.5 py-2 text-[11px] text-aviso">
        Esto agenda una <strong>reposición</strong>. Si lo que se acordó con la clienta fue un descuento o un producto, eso lo
        decide la Dueña y no se registra aquí.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`garantia-fecha-${cita.id}`} className="block text-xs font-medium text-texto-secundario">
            Día
          </label>
          <input
            id={`garantia-fecha-${cita.id}`}
            type="date"
            value={fecha}
            onChange={(evento) => setFecha(evento.target.value)}
            className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
          />
        </div>
        <div>
          <label htmlFor={`garantia-hora-${cita.id}`} className="block text-xs font-medium text-texto-secundario">
            Hora
          </label>
          <input
            id={`garantia-hora-${cita.id}`}
            type="time"
            value={hora}
            onChange={(evento) => setHora(evento.target.value)}
            className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
          />
          {/* No se pide duración ni fin: los deriva el backend del servicio original (`DEC-033`). */}
        </div>
      </div>

      <div className="mt-3">
        <SelectorDeManicurista
          sucursalId={cita.sucursalId}
          valor={manicuristaId}
          onCambio={setManicuristaId}
          id={`garantia-manicurista-${cita.id}`}
        />
      </div>

      <div className="mt-3">
        <label htmlFor={`garantia-motivo-${cita.id}`} className="block text-xs font-medium text-texto-secundario">
          ¿Qué reportó la clienta?
        </label>
        <input
          id={`garantia-motivo-${cita.id}`}
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          placeholder="Se le despegaron dos uñas en tres días"
          className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto placeholder:text-texto-terciario"
        />
        {/* Va a la auditoría y es el único rastro de por qué se concedió. El backend lo acepta
            vacío; la interfaz lo pide porque quien revise esto en tres meses necesita saberlo. */}
        <p className="mt-1 text-[11px] text-texto-terciario">Queda registrado como el motivo por el que se concedió.</p>
      </div>

      <AvisoDeError error={error} className="mt-3" />

      <div className="mt-3 flex gap-2">
        <Boton cargando={pendiente} disabled={hora === '' || fecha === ''} onClick={() => void enviar()}>
          Agendar sin costo
        </Boton>
        <Boton variante="fantasma" onClick={onCerrar}>
          Volver
        </Boton>
      </div>
    </div>
  );
}
