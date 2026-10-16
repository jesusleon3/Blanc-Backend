import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agendaApi } from '../../../api/agenda';
import { Boton } from '../../../componentes/Boton';
import { Insignia } from '../../../componentes/Insignia';
import { AvisoDeError } from '../../../componentes/AvisoDeError';
import { useServiciosActivos } from '../../../componentes/selectores';
import { instanteDesdeHoraLocal } from '../../../componentes/etiquetas';

/**
 * *"¿Cabe una clienta a esta hora?"* — consulta al `MotorDisponibilidad`.
 *
 * Existe para la conversación de mostrador y de teléfono: alguien pregunta por una hora y hay que
 * responder en segundos, sin agendar nada ni abrir el formulario.
 *
 * ## EL RANGO SE DERIVA DE LA DURACIÓN DEL SERVICIO
 *
 * No se pregunta "¿hay hueco a las 5?" sino "¿cabe **este servicio** a las 5?", y la diferencia es
 * real: a las 5 puede caber un retiro de 30 minutos y no un acrílico de dos horas. La duración
 * sale del catálogo, igual que la usa el backend para derivar el fin de la cita.
 */
export function ConsultaDeDisponibilidad({ sucursalId, fecha }: { sucursalId: string; fecha: string }) {
  const { data: servicios } = useServiciosActivos();
  const [servicioId, setServicioId] = useState('');
  const [hora, setHora] = useState('17:00');
  const [consulta, setConsulta] = useState<{ inicio: string; fin: string } | null>(null);

  const servicio = (servicios ?? []).find((candidato) => candidato.id === servicioId);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['disponibilidad', sucursalId, consulta?.inicio, consulta?.fin],
    queryFn: () => agendaApi.disponibilidad(sucursalId, consulta!.inicio, consulta!.fin),
    enabled: consulta !== null && sucursalId !== '',
    // Una respuesta de disponibilidad caduca en cuanto alguien agenda: no se cachea.
    staleTime: 0,
    gcTime: 0,
  });

  const preguntar = () => {
    if (!servicio) return;
    const inicio = instanteDesdeHoraLocal(fecha, hora);
    setConsulta({
      inicio,
      fin: new Date(new Date(inicio).getTime() + servicio.duracionBaseMinutos * 60_000).toISOString(),
    });
  };

  return (
    <div className="rounded-lg border border-borde bg-fondo-elevado p-4">
      <h2 className="text-sm font-semibold text-texto">¿Cabe una clienta?</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <label htmlFor="disp-servicio" className="block text-xs font-medium text-texto-secundario">
            {/* "Servicio a consultar" y no "Servicio": el formulario de alta tiene su propio campo
                "Servicio" en la misma pantalla, y dos campos con el mismo nombre accesible son
                indistinguibles para un lector de pantalla. */}
            Servicio a consultar
          </label>
          <select
            id="disp-servicio"
            value={servicioId}
            onChange={(evento) => {
              setServicioId(evento.target.value);
              setConsulta(null);
            }}
            className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
          >
            <option value="">Elige uno…</option>
            {(servicios ?? []).map((candidato) => (
              <option key={candidato.id} value={candidato.id}>
                {candidato.nombre} ({candidato.duracionBaseMinutos} min)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="disp-hora" className="block text-xs font-medium text-texto-secundario">
            Hora
          </label>
          <input
            id="disp-hora"
            type="time"
            value={hora}
            onChange={(evento) => {
              setHora(evento.target.value);
              setConsulta(null);
            }}
            className="mt-1 rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
          />
        </div>
        <Boton cargando={isFetching} disabled={!servicio} onClick={preguntar}>
          Consultar
        </Boton>
      </div>

      {isError ? <AvisoDeError error={error} className="mt-3" /> : null}

      {data && !isFetching ? (
        <div role="status" className="mt-3 rounded border border-borde bg-fondo-apagado p-3">
          <div className="flex items-center gap-2">
            <Insignia tono={data.hayLugar ? 'exito' : 'peligro'}>{data.hayLugar ? 'Sí cabe' : 'No cabe'}</Insignia>
            {data.motivo ? <span className="text-xs text-texto-secundario">{data.motivo}</span> : null}
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-texto-terciario">Sillas libres</dt>
              <dd className="font-medium text-texto">{data.sillasLibres}</dd>
            </div>
            <div>
              <dt className="text-texto-terciario">Manicuristas</dt>
              <dd className="font-medium text-texto">{data.manicuristasDisponibles}</dd>
            </div>
            <div>
              <dt className="text-texto-terciario">Capacidad</dt>
              <dd className="font-medium text-texto">{data.capacidad}</dd>
            </div>
          </dl>
          {/* `deficitDePersonal` sin acotar es lo que permite ver un sobrecupo real: hay sillas
              pero falta gente. Fue un defecto encontrado en Fase 2 — la versión acotada a 0 hacía
              que la clase `sobrecupo_en_sucursal` no se emitiera nunca. */}
          {data.deficitDePersonal > 0 ? (
            <p className="mt-2 text-xs text-aviso">
              Faltan {data.deficitDePersonal} manicurista{data.deficitDePersonal === 1 ? '' : 's'} para cubrir lo que ya está agendado a esa
              hora.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
