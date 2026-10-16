import type { Conversacion } from '../../api/contrato';
import { Insignia } from '../../componentes/Insignia';
import { ETIQUETA_DE_MOTIVO, SEVERIDAD_DE_MOTIVO, haceCuanto } from '../../componentes/etiquetas';
import { Vacio } from '../../componentes/Vacio';

const TONO_POR_SEVERIDAD = { alta: 'peligro', media: 'aviso', neutra: 'neutro' } as const;

/**
 * La cola de trabajo.
 *
 * ## EL ORDEN Y LA PRIORIDAD VISUAL NO SON DECORACIÓN
 *
 * El backend ya devuelve las conversaciones por `ultimo_mensaje_en` descendente, que es el orden
 * de una cola de trabajo. Lo que esta lista añade es **por qué** cada una espera: el motivo del
 * escalamiento con su severidad, y cuántos mensajes llevan sin responder.
 *
 * Tres motivos van en rojo —clienta bloqueada, queja, pide cancelar— porque son los que cuestan
 * dinero o relación si se quedan esperando. *"El bot no entendió"* va neutro **a propósito**: es el
 * caso más frecuente, y pintarlo de rojo haría que el rojo dejara de significar algo.
 */
export function ListaDeConversaciones({
  conversaciones,
  seleccionada,
  onSeleccionar,
}: {
  conversaciones: Conversacion[];
  seleccionada: string | null;
  onSeleccionar: (id: string) => void;
}) {
  if (conversaciones.length === 0) {
    return <Vacio titulo="No hay conversaciones con este filtro" detalle="Prueba a quitar el filtro de sucursal o cambiar de pestaña." />;
  }

  return (
    <ul className="divide-y divide-borde" aria-label="Conversaciones">
      {conversaciones.map((conversacion) => {
        const activa = conversacion.id === seleccionada;
        const pendientes = conversacion.mensajesSinResponder;

        return (
          <li key={conversacion.id}>
            <button
              type="button"
              onClick={() => onSeleccionar(conversacion.id)}
              aria-current={activa ? 'true' : undefined}
              className={`w-full px-4 py-3 text-left transition ${activa ? 'bg-acento-50' : 'hover:bg-fondo-apagado'}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium text-texto">{conversacion.telefonoClienta}</span>
                {pendientes > 0 ? (
                  <span
                    className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-peligro px-1.5 text-[11px] font-semibold text-white"
                    aria-label={`${pendientes} mensaje${pendientes === 1 ? '' : 's'} sin responder`}
                  >
                    {pendientes}
                  </span>
                ) : (
                  <span className="ml-auto text-[11px] text-texto-terciario">
                    {conversacion.ultimoMensajeEn ? haceCuanto(conversacion.ultimoMensajeEn) : ''}
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {conversacion.modo === 'humano' && conversacion.motivoDeEscalamiento ? (
                  <Insignia tono={TONO_POR_SEVERIDAD[SEVERIDAD_DE_MOTIVO[conversacion.motivoDeEscalamiento]]}>
                    {ETIQUETA_DE_MOTIVO[conversacion.motivoDeEscalamiento]}
                  </Insignia>
                ) : (
                  <Insignia tono="info">La lleva el bot</Insignia>
                )}
                {conversacion.clientaId === null ? <Insignia tono="neutro">Sin identificar</Insignia> : null}
              </div>

              {pendientes > 0 && conversacion.ultimoMensajeEn ? (
                <p className="mt-1.5 text-[11px] text-texto-terciario">Último mensaje {haceCuanto(conversacion.ultimoMensajeEn)}</p>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
