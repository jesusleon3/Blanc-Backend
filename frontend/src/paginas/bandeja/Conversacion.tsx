import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EmisorMensaje, Mensaje, MotivoDeEscalamiento } from '../../api/contrato';
import { conversacionesApi } from '../../api/conversaciones';
import { Boton } from '../../componentes/Boton';
import { Cargando } from '../../componentes/Cargando';
import { Insignia } from '../../componentes/Insignia';
import { AvisoDeError } from '../../componentes/AvisoDeError';
import { Compositor } from './Compositor';
import { clave as claveDelContador } from '../../componentes/ContadorDeEscaladas';
import {
  ETIQUETA_DE_EMISOR,
  ETIQUETA_DE_MOTIVO,
  ETIQUETA_DE_VENTANA,
  fechaYHoraLocal,
  horaLocal,
} from '../../componentes/etiquetas';

/** Cada 10 s: el hilo abierto es lo que se está mirando, así que refresca más rápido que la lista. */
const INTERVALO_DEL_HILO_MS = 10_000;

/**
 * Estilo por emisor. **Distinguir quién habló es requisito, no estética.**
 *
 * Son cuatro emisores y los cuatro significan cosas distintas para quien atiende: lo que dijo la
 * clienta, lo que contestó el bot, lo que escribió una persona del equipo y lo que salió solo
 * (recordatorio, oferta de hueco). Confundir un mensaje del bot con uno de una compañera lleva a
 * responder dos veces o a no responder.
 */
const ESTILO_POR_EMISOR: Record<EmisorMensaje, { burbuja: string; alineacion: string; tono: 'neutro' | 'info' | 'acento' }> = {
  clienta: { burbuja: 'bg-fondo-apagado text-texto', alineacion: 'items-start', tono: 'neutro' },
  bot: { burbuja: 'bg-info-suave text-texto', alineacion: 'items-end', tono: 'info' },
  humano: { burbuja: 'bg-acento-600 text-white', alineacion: 'items-end', tono: 'acento' },
  sistema: { burbuja: 'bg-fondo-apagado text-texto-secundario border border-dashed border-borde-fuerte', alineacion: 'items-end', tono: 'neutro' },
};

/** El motivo con el que una persona toma una conversación que llevaba el bot. */
const MOTIVO_AL_TOMAR: MotivoDeEscalamiento = 'intervencion_manual';

export function Conversacion({ id }: { id: string }) {
  const cliente = useQueryClient();
  const [errorDeAccion, setErrorDeAccion] = useState<unknown>(null);

  const claveDelHilo = ['conversaciones', 'hilo', id] as const;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: claveDelHilo,
    queryFn: () => conversacionesApi.hilo(id),
    refetchInterval: INTERVALO_DEL_HILO_MS,
  });

  /**
   * Tras cualquier acción se invalidan **tres** consultas, y las tres son necesarias:
   * el hilo (el mensaje nuevo), la lista (cambia el modo y el contador de pendientes) y el
   * contador global del encabezado. Olvidar la tercera dejaría el badge mintiendo hasta el
   * siguiente sondeo, justo después de la acción que lo cambió.
   */
  const refrescarTodo = async () => {
    await Promise.all([
      cliente.invalidateQueries({ queryKey: claveDelHilo }),
      cliente.invalidateQueries({ queryKey: ['conversaciones', 'bandeja'] }),
      cliente.invalidateQueries({ queryKey: claveDelContador }),
    ]);
  };

  const conAviso = <T,>(accion: () => Promise<T>) => async () => {
    setErrorDeAccion(null);
    try {
      await accion();
      await refrescarTodo();
    } catch (fallo) {
      setErrorDeAccion(fallo);
      throw fallo;
    }
  };

  const responder = useMutation({ mutationFn: (texto: string) => conversacionesApi.responder(id, texto) });
  const enviarPlantilla = useMutation({
    mutationFn: ({ plantilla, parametros }: { plantilla: string; parametros: string[] }) =>
      conversacionesApi.enviarPlantilla(id, plantilla, parametros),
  });
  const tomar = useMutation({ mutationFn: () => conversacionesApi.tomar(id, MOTIVO_AL_TOMAR) });
  const devolver = useMutation({ mutationFn: () => conversacionesApi.devolverAlBot(id) });

  if (isLoading) return <Cargando mensaje="Cargando la conversación…" />;
  if (isError || !data) return <AvisoDeError error={error} className="m-4" />;

  const { conversacion, estadoDeVentana, mensajes } = data;
  const laLlevaElBot = conversacion.modo === 'bot';

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-borde bg-fondo-elevado px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-texto">{conversacion.telefonoClienta}</h2>

          {laLlevaElBot ? (
            <Insignia tono="info">La lleva el bot</Insignia>
          ) : (
            <Insignia tono="acento">
              Modo humano{conversacion.motivoDeEscalamiento ? ` · ${ETIQUETA_DE_MOTIVO[conversacion.motivoDeEscalamiento]}` : ''}
            </Insignia>
          )}

          <Insignia tono={estadoDeVentana === 'abierta' ? 'exito' : 'aviso'}>{ETIQUETA_DE_VENTANA[estadoDeVentana]}</Insignia>

          <div className="ml-auto flex gap-2">
            {laLlevaElBot ? (
              <Boton variante="secundario" cargando={tomar.isPending} onClick={conAviso(() => tomar.mutateAsync())}>
                Tomar conversación
              </Boton>
            ) : (
              /**
               * `RN-ESC-03`: **devolver al bot es la ÚNICA salida del modo humano, y es explícita.**
               * No hay vía automática de vuelta, y esa ausencia es la regla: una clienta que pidió
               * hablar con alguien y recibe de nuevo al bot a los diez minutos concluye, con razón,
               * que nadie la escuchó. Por eso este botón existe y no hay un temporizador.
               */
              <Boton variante="secundario" cargando={devolver.isPending} onClick={conAviso(() => devolver.mutateAsync())}>
                Devolver al bot
              </Boton>
            )}
          </div>
        </div>

        {conversacion.mensajesSinResponder > 0 ? (
          <p className="mt-2 text-xs text-peligro">
            {conversacion.mensajesSinResponder} mensaje{conversacion.mensajesSinResponder === 1 ? '' : 's'} sin responder
            {conversacion.escaladaEn ? ` · escalada el ${fechaYHoraLocal(conversacion.escaladaEn)}` : ''}
          </p>
        ) : null}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-fondo-tenue p-4">
        {mensajes.length === 0 ? (
          <p className="text-center text-xs text-texto-terciario">Sin mensajes todavía.</p>
        ) : (
          mensajes.map((mensaje) => <Burbuja key={mensaje.id} mensaje={mensaje} />)
        )}
      </div>

      {errorDeAccion ? <AvisoDeError error={errorDeAccion} className="mx-4 mb-2" /> : null}

      <Compositor
        conversacionId={id}
        estadoDeVentana={estadoDeVentana}
        enviandoTexto={responder.isPending}
        enviandoPlantilla={enviarPlantilla.isPending}
        onEnviarTexto={async (texto) => {
          await conAviso(() => responder.mutateAsync(texto))();
        }}
        onEnviarPlantilla={async (plantilla, parametros) => {
          await conAviso(() => enviarPlantilla.mutateAsync({ plantilla, parametros }))();
        }}
      />
    </div>
  );
}

function Burbuja({ mensaje }: { mensaje: Mensaje }) {
  const estilo = ESTILO_POR_EMISOR[mensaje.emisor];

  return (
    <div className={`flex flex-col gap-1 ${estilo.alineacion}`}>
      <div className={`max-w-[75%] rounded-lg px-3.5 py-2.5 text-sm shadow-sm ${estilo.burbuja}`}>
        {mensaje.contenido ?? (
          // Audio, imagen o documento: el backend los guarda sin contenido (`RN-CONV-06`). Decirlo
          // explícitamente evita que parezca un mensaje vacío o un fallo de carga.
          <span className="italic opacity-80">
            {mensaje.tipo === 'no_soportado' ? 'La clienta mandó un audio o un archivo (el bot no puede leerlo)' : 'Sin contenido'}
          </span>
        )}
      </div>
      <p className="px-1 text-[11px] text-texto-terciario">
        {ETIQUETA_DE_EMISOR[mensaje.emisor]} · {horaLocal(mensaje.ocurridoEn)}
        {mensaje.estadoEntrega === 'fallido' ? <span className="ml-1 font-medium text-peligro">· no se entregó</span> : null}
      </p>
    </div>
  );
}
