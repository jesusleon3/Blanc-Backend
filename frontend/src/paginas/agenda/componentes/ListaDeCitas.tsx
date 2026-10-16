import { useQuery } from '@tanstack/react-query';
import type { Cita } from '../../../api/contrato';
import { catalogoApi } from '../../../api/catalogo';
import { personalApi } from '../../../api/personal';
import { Insignia } from '../../../componentes/Insignia';
import { Vacio } from '../../../componentes/Vacio';
import { ETIQUETA_DE_ESTADO_CITA, TONO_DE_ESTADO_CITA, horaLocal, pesos } from '../../../componentes/etiquetas';
import { AccionesDeCita } from './AccionesDeCita';

/**
 * La agenda del día.
 *
 * ## POR QUÉ RESUELVE NOMBRES DE SERVICIO Y DE MANICURISTA AQUÍ
 *
 * La cita trae `servicioId` y `manicuristaId`, no sus nombres: el presenter del backend no los
 * incluye y añadirlos obligaría a Agenda a importar Catálogo y Personal, que es exactamente lo que
 * `ADR-005`/`P5` prohíben. El cruce es trabajo del cliente, y se hace con **dos consultas
 * cacheadas** (el catálogo y el personal cambian en el alta, no durante un turno), no con una
 * consulta por fila.
 */
export function ListaDeCitas({ citas, sucursalId, onCambio }: { citas: Cita[]; sucursalId: string; onCambio: () => Promise<void> | void }) {
  const servicios = useQuery({ queryKey: ['servicios'], queryFn: () => catalogoApi.servicios(), staleTime: 10 * 60_000 });
  const manicuristas = useQuery({
    queryKey: ['manicuristas', sucursalId],
    queryFn: () => personalApi.manicuristas(sucursalId),
    enabled: Boolean(sucursalId),
    staleTime: 5 * 60_000,
  });

  const nombreDeServicio = (id: string) => servicios.data?.servicios.find((servicio) => servicio.id === id)?.nombre ?? 'Servicio';
  const nombreDeManicurista = (id: string) => manicuristas.data?.manicuristas.find((m) => m.id === id)?.nombre ?? 'Manicurista';

  if (citas.length === 0) {
    return <Vacio titulo="No hay citas en este día" detalle="Usa «Agendar cita o walk-in» para registrar una." />;
  }

  return (
    <ul className="space-y-3" aria-label="Citas del día">
      {citas.map((cita) => (
        <li key={cita.id} className="rounded-lg border border-borde bg-fondo-elevado p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-texto">
                {horaLocal(cita.inicio)} – {horaLocal(cita.fin)}
              </p>
              <p className="mt-0.5 text-sm text-texto">
                {cita.clientaNombre ?? 'Clienta'} · {nombreDeServicio(cita.servicioId)}
              </p>
              <p className="mt-1 text-xs text-texto-secundario">
                {cita.manicuristaId === null ? (
                  // `DEC-031`: una cita puede nacer con solo Silla Virtual. Decirlo así —y no
                  // dejarlo en blanco— es lo que convierte el hueco en una tarea del mostrador.
                  <span className="font-medium text-aviso">Sin asignar · por asignar al llegar</span>
                ) : (
                  <>Atiende {nombreDeManicurista(cita.manicuristaId)}</>
                )}
                {cita.sillaId ? <span className="text-texto-terciario"> · silla asignada</span> : null}
              </p>
            </div>

            <div className="ml-auto flex flex-col items-end gap-1.5">
              <Insignia tono={TONO_DE_ESTADO_CITA[cita.estado]}>{ETIQUETA_DE_ESTADO_CITA[cita.estado]}</Insignia>
              {cita.cotizacionSnapshot ? (
                <span className="text-sm font-medium text-texto">{pesos(cita.cotizacionSnapshot.totalCentavos)}</span>
              ) : null}
              {/* Indicadores discretos para recepción. `enListaRoja` solo llega a los roles de
                  operación: el presenter del backend no lo incluye para la Manicurista. */}
              {cita.enListaRoja ? <Insignia tono="aviso">Lista roja</Insignia> : null}
              {cita.estado === 'en_espera_pago' ? (
                <span className="text-[11px] text-aviso">El lugar NO está reservado hasta que pague</span>
              ) : null}
            </div>
          </div>

          <div className="mt-3 border-t border-borde pt-3">
            <AccionesDeCita cita={cita} onCambio={onCambio} />
          </div>
        </li>
      ))}
    </ul>
  );
}
