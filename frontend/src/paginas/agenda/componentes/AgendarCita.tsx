import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Clienta } from '../../../api/contrato';
import { agendaApi } from '../../../api/agenda';
import { Boton } from '../../../componentes/Boton';
import { AvisoDeError } from '../../../componentes/AvisoDeError';
import { BuscadorDeClienta, SelectorDeManicurista, SelectorDeServicio } from '../../../componentes/selectores';
import { fechaLocalDeHoy, horaLocal, instanteDesdeHoraLocal } from '../../../componentes/etiquetas';

/**
 * Alta de cita **y de walk-in**: un walk-in es una cita creada en el momento (`DEC-037`), no un
 * tipo distinto de registro. Por eso hay un solo formulario y un botón que pone la hora actual.
 *
 * ## LO QUE ESTE FORMULARIO NO PIDE, Y ES DELIBERADO
 *
 * - **No pide la hora de fin.** La deriva el backend de la duración del servicio en el Catálogo.
 *   Pedirla aquí dejaría que alguien vendiera 30 minutos de un servicio de 90.
 * - **No pide silla.** Las sillas son virtuales (`DEC-031`): las elige el motor de disponibilidad,
 *   y la clienta nunca eligió silla ni en el salón real.
 * - **No pide precio.** Lo congela el backend en `cotizacionSnapshot` al agendar.
 *
 * Las tres ausencias son la regla 2 de `ADR-027`: ningún dato de negocio se calcula en el cliente.
 */
export function AgendarCita({
  sucursalId,
  /**
   * **El día que se está viendo**, no hoy.
   *
   * Fue un defecto real que una prueba destapó: el formulario arrancaba en `fechaLocalDeHoy()`, así
   * que mirando la agenda del 8 de marzo y pulsando «Agendar» la cita se creaba **para hoy**. Nada
   * avisaba: la cita simplemente no aparecía en la lista que se estaba mirando. En un mostrador eso
   * son citas perdidas en días equivocados.
   */
  fechaVisible,
  onAgendada,
}: {
  sucursalId: string;
  fechaVisible: string;
  onAgendada: () => Promise<void> | void;
}) {
  const [clienta, setClienta] = useState<Clienta | null>(null);
  const [servicioId, setServicioId] = useState('');
  const [fecha, setFecha] = useState(fechaVisible);
  const [hora, setHora] = useState('10:00');
  const [manicuristaId, setManicuristaId] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [exito, setExito] = useState<string | null>(null);

  const agendar = useMutation({
    mutationFn: () =>
      agendaApi.agendar({
        sucursalId,
        servicioId,
        clientaId: clienta!.id,
        inicio: instanteDesdeHoraLocal(fecha, hora),
        ...(manicuristaId ? { manicuristaId } : {}),
      }),
  });

  const completo = clienta !== null && servicioId !== '' && fecha !== '' && hora !== '' && sucursalId !== '';

  const enviar = async () => {
    setError(null);
    setExito(null);
    try {
      const cita = await agendar.mutateAsync();
      await onAgendada();
      setExito(
        cita.estado === 'en_espera_pago'
          ? `Cita registrada a las ${horaLocal(cita.inicio)}, EN ESPERA DE ANTICIPO: el lugar no queda reservado hasta que pague.`
          : `Cita agendada a las ${horaLocal(cita.inicio)}.`,
      );
      // Se limpia la clienta y el servicio, no la fecha: en mostrador se agendan varias seguidas
      // para el mismo día.
      setClienta(null);
      setServicioId('');
      setManicuristaId('');
    } catch (fallo) {
      setError(fallo);
    }
  };

  /** Walk-in: ahora mismo, redondeado al minuto. */
  const ponerAhora = () => {
    const ahora = new Date();
    setFecha(fechaLocalDeHoy(ahora));
    setHora(
      new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false }).format(ahora),
    );
  };

  return (
    <div className="rounded-lg border border-borde bg-fondo-elevado p-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-sm font-semibold text-texto">Agendar cita o walk-in</h2>
        <Boton variante="fantasma" className="ml-auto" onClick={ponerAhora}>
          Walk-in (ahora)
        </Boton>
      </div>

      <div className="mt-4 space-y-4">
        <BuscadorDeClienta seleccionada={clienta} onSeleccionar={setClienta} />
        <SelectorDeServicio valor={servicioId} onCambio={setServicioId} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="nueva-fecha" className="block text-xs font-medium text-texto-secundario">
              Fecha
            </label>
            <input
              id="nueva-fecha"
              type="date"
              value={fecha}
              onChange={(evento) => setFecha(evento.target.value)}
              className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
            />
          </div>
          <div>
            <label htmlFor="nueva-hora" className="block text-xs font-medium text-texto-secundario">
              Hora de inicio
            </label>
            <input
              id="nueva-hora"
              type="time"
              value={hora}
              onChange={(evento) => setHora(evento.target.value)}
              className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
            />
          </div>
          <SelectorDeManicurista sucursalId={sucursalId} valor={manicuristaId} onCambio={setManicuristaId} id="nueva-manicurista" />
        </div>

        <p className="text-[11px] text-texto-terciario">
          La hora de fin, la silla y el precio los calcula el sistema según el servicio: no se eligen aquí.
        </p>

        <AvisoDeError error={error} />
        {exito ? (
          <p role="status" className="rounded border border-exito/30 bg-exito-suave px-3 py-2.5 text-sm text-exito">
            {exito}
          </p>
        ) : null}

        <Boton cargando={agendar.isPending} disabled={!completo} onClick={() => void enviar()}>
          Agendar
        </Boton>
      </div>
    </div>
  );
}
