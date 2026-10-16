import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { conversacionesApi } from '../api/conversaciones';
import { haceCuanto } from './etiquetas';

/** Cada 20 s. Ver la nota de abajo sobre por qué este número y no uno más agresivo. */
export const INTERVALO_DE_SONDEO_MS = 20_000;

export const clave = ['conversaciones', 'escaladas-pendientes'] as const;

/**
 * El contador de conversaciones escaladas sin atender.
 *
 * ## ESTO ES `DEC-046`: EL AVISO AL PERSONAL DEL MVP
 *
 * La Dueña lo pidió así: *"avisar de algo nuevo sin que haya que estar mirando la pantalla"*. Con
 * la Cloud API dejó de ser una comodidad — **al migrar un número, el celular deja de recibir
 * notificaciones de WhatsApp**, así que la única forma de enterarse de que una clienta escribió es
 * que la plataforma lo diga.
 *
 * ⚠️ **Esto no cumple literalmente lo que pidió**, y conviene no fingir lo contrario: sigue
 * exigiendo tener el panel abierto. Lo que sí resuelve es no tener que **leer conversación por
 * conversación** para saber si algo espera. El canal externo (correo, push, WhatsApp a un número
 * interno) sigue pendiente de decisión de negocio; `NotificadorEscalamientoPort` ya está en su
 * sitio en el backend para cuando se elija.
 *
 * ## POR QUÉ MUESTRA LA ANTIGÜEDAD Y NO SOLO EL NÚMERO
 *
 * Porque *cuántas* esperan importa menos que *cuánto llevan esperando*. Tres conversaciones de
 * hace dos minutos son una mañana normal; una de hace dos horas es un fallo de atención. Un
 * número a secas no distingue esos dos casos.
 *
 * ## POR QUÉ 20 SEGUNDOS
 *
 * Es una conversación de WhatsApp, no una alarma: unos segundos de latencia no cambian nada
 * operativo, y un sondeo de 2 s multiplicaría las peticiones por diez sin que nadie lo note.
 * `refetchOnWindowFocus` cubre el caso real que importa — volver al panel tras atender a alguien
 * en el mostrador refresca al instante, sin esperar el siguiente intervalo.
 */
export function ContadorDeEscaladas() {
  const { data, isError } = useQuery({
    queryKey: clave,
    queryFn: () => conversacionesApi.escaladasPendientes(),
    refetchInterval: INTERVALO_DE_SONDEO_MS,
    refetchOnWindowFocus: true,
  });

  // Mientras no hay dato no se pinta nada: un "0" que luego salta a "3" se lee como si acabaran de
  // llegar tres, y no es verdad. Un fallo tampoco se pinta — ver la nota de abajo.
  if (isError || !data) return null;

  const hay = data.total > 0;

  return (
    <Link
      to="/bandeja?filtro=escaladas"
      className={`group flex items-center gap-2.5 rounded-lg border px-3 py-1.5 transition ${
        hay ? 'border-peligro/30 bg-peligro-suave hover:border-peligro/60' : 'border-borde bg-fondo-elevado hover:bg-fondo-apagado'
      }`}
      // El `aria-label` lleva la frase completa: el número a secas no dice nada leído en voz alta.
      aria-label={
        hay
          ? `${data.total} ${
              // "conversación" → "conversaciones": el plural PIERDE la tilde. Concatenar "es"
              // producía «conversaciónes», que es una falta de ortografía y además la leería mal
              // un lector de pantalla. Las dos formas van escritas enteras.
              data.total === 1 ? 'conversación' : 'conversaciones'
            } esperando a una persona${data.masAntiguaEn ? `, la más antigua ${haceCuanto(data.masAntiguaEn)}` : ''}`
          : 'Ninguna conversación esperando'
      }
    >
      <span
        className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
          hay ? 'bg-peligro text-white' : 'bg-fondo-apagado text-texto-terciario'
        }`}
        // El número ya va en el `aria-label` del enlace; repetirlo lo diría dos veces.
        aria-hidden="true"
      >
        {data.total}
      </span>
      <span className="hidden flex-col leading-tight sm:flex">
        <span className={`text-xs font-medium ${hay ? 'text-peligro' : 'text-texto-secundario'}`}>
          {hay ? 'Esperan a una persona' : 'Todo atendido'}
        </span>
        {hay && data.masAntiguaEn ? (
          <span className="text-[11px] text-texto-terciario">La más antigua, {haceCuanto(data.masAntiguaEn)}</span>
        ) : null}
      </span>
    </Link>
  );
}
