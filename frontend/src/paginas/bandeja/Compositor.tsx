import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EstadoDeVentana } from '../../api/contrato';
import { conversacionesApi } from '../../api/conversaciones';
import { Boton } from '../../componentes/Boton';
import { EXPLICACION_DE_VENTANA } from '../../componentes/etiquetas';

/**
 * Lo que se puede escribir, según la ventana de 24 horas de Meta (`N-14`).
 *
 * ## LA REGLA LA DECIDE EL BACKEND, AQUÍ SOLO SE OBEDECE
 *
 * `estadoDeVentana` **viene en la respuesta** de `GET /v1/conversaciones/:id`. Este componente no
 * lo calcula a partir de `ultimaInteraccionEntranteEn`, y es la regla 2 de `ADR-027`: hay una sola
 * autoridad sobre las reglas de negocio. Si se calculara aquí, bastaría un reloj desfasado o un
 * cambio de la ventana por parte de Meta para que la interfaz y el backend discreparan — y el
 * síntoma sería una caja de texto habilitada cuyo envío se rechaza.
 *
 * ## POR QUÉ SE BLOQUEA EN LUGAR DE DEJAR INTENTARLO
 *
 * El backend lo rechazaría igual con `409 VENTANA_24H_CERRADA`. Bloquearlo antes evita que alguien
 * **redacte un mensaje para que el sistema lo tire**: con una clienta esperando, perder lo escrito
 * es peor que no haber podido escribir. Y la explicación va completa junto a la caja, no en un
 * *tooltip*: la primera vez que esto ocurre, la pregunta es *"¿por qué no puedo escribirle?"*.
 */
export function Compositor({
  conversacionId,
  estadoDeVentana,
  enviandoTexto,
  enviandoPlantilla,
  onEnviarTexto,
  onEnviarPlantilla,
}: {
  conversacionId: string;
  estadoDeVentana: EstadoDeVentana;
  enviandoTexto: boolean;
  enviandoPlantilla: boolean;
  /** Resuelve a `true` si se envió. `false` conserva lo escrito para reintentarlo. */
  onEnviarTexto: (texto: string) => Promise<boolean>;
  onEnviarPlantilla: (plantilla: string, parametros: string[]) => Promise<boolean>;
}) {
  const abierta = estadoDeVentana === 'abierta';

  return (
    <div className="border-t border-borde bg-fondo-elevado p-4">
      {abierta ? (
        <CajaDeTexto enviando={enviandoTexto} onEnviar={onEnviarTexto} />
      ) : (
        <SelectorDePlantilla
          key={conversacionId}
          estadoDeVentana={estadoDeVentana}
          enviando={enviandoPlantilla}
          onEnviar={onEnviarPlantilla}
        />
      )}
    </div>
  );
}

function CajaDeTexto({ enviando, onEnviar }: { enviando: boolean; onEnviar: (texto: string) => Promise<boolean> }) {
  const [texto, setTexto] = useState('');

  const enviar = async () => {
    const limpio = texto.trim();
    if (limpio.length === 0) return;
    // Se limpia **solo si el envío salió bien**: con una clienta esperando, perder lo escrito es
    // peor que el propio fallo.
    if (await onEnviar(limpio)) setTexto('');
  };

  return (
    <div>
      <label htmlFor="respuesta" className="sr-only">
        Responder a la clienta
      </label>
      <textarea
        id="respuesta"
        rows={3}
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        onKeyDown={(evento) => {
          // Enter envía, Shift+Enter hace salto de línea: es lo que cualquiera espera de un chat.
          if (evento.key === 'Enter' && !evento.shiftKey) {
            evento.preventDefault();
            void enviar();
          }
        }}
        placeholder="Escribe tu respuesta…"
        className="w-full resize-none rounded border border-borde bg-fondo px-3 py-2.5 text-sm text-texto placeholder:text-texto-terciario"
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[11px] text-texto-terciario">
          Al responder, la conversación pasa a <strong className="font-medium">modo humano</strong>: el bot deja de contestar.
        </p>
        <Boton onClick={() => void enviar()} cargando={enviando} disabled={texto.trim().length === 0}>
          Enviar
        </Boton>
      </div>
    </div>
  );
}

function SelectorDePlantilla({
  estadoDeVentana,
  enviando,
  onEnviar,
}: {
  estadoDeVentana: EstadoDeVentana;
  enviando: boolean;
  onEnviar: (plantilla: string, parametros: string[]) => Promise<boolean>;
}) {
  const { data } = useQuery({
    queryKey: ['conversaciones', 'plantillas'],
    queryFn: () => conversacionesApi.plantillas(),
    // El catálogo cambia cuando Meta aprueba una plantilla nueva, es decir casi nunca.
    staleTime: 10 * 60_000,
  });

  const [elegida, setElegida] = useState<string>('');
  const [valores, setValores] = useState<string[]>([]);

  const plantilla = data?.plantillas.find((candidata) => candidata.nombre === elegida);
  const completa = plantilla ? plantilla.parametros.every((_, indice) => (valores[indice] ?? '').trim().length > 0) : false;

  return (
    <div>
      {/* El bloqueo y su motivo, juntos. Ver la nota de la cabecera. */}
      <div className="rounded border border-aviso/30 bg-aviso-suave px-3.5 py-3">
        <p className="text-sm font-medium text-aviso">No puedes enviar texto libre</p>
        <p className="mt-1 text-xs leading-relaxed text-aviso/90">{EXPLICACION_DE_VENTANA[estadoDeVentana]}</p>
      </div>

      <div className="mt-3">
        <label htmlFor="plantilla" className="block text-sm font-medium text-texto">
          Plantilla aprobada
        </label>
        <select
          id="plantilla"
          value={elegida}
          onChange={(evento) => {
            setElegida(evento.target.value);
            // Los valores se reinician al cambiar de plantilla: conservarlos dejaría el parámetro
            // de una plantilla en el hueco de otra, y Meta lo entregaría sin quejarse.
            setValores([]);
          }}
          className="mt-1.5 w-full rounded border border-borde bg-fondo px-3 py-2.5 text-sm text-texto"
        >
          <option value="">Elige una…</option>
          {(data?.plantillas ?? []).map((candidata) => (
            <option key={candidata.nombre} value={candidata.nombre}>
              {candidata.nombre}
            </option>
          ))}
        </select>

        {plantilla ? (
          <>
            <p className="mt-2 text-xs text-texto-secundario">{plantilla.descripcion}</p>
            {plantilla.parametros.map((descripcion, indice) => (
              <div key={descripcion} className="mt-2.5">
                <label htmlFor={`parametro-${indice}`} className="block text-xs font-medium text-texto-secundario">
                  {descripcion}
                </label>
                <input
                  id={`parametro-${indice}`}
                  value={valores[indice] ?? ''}
                  onChange={(evento) => {
                    const siguiente = [...valores];
                    siguiente[indice] = evento.target.value;
                    setValores(siguiente);
                  }}
                  className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
                />
              </div>
            ))}
          </>
        ) : null}

        {data?.provisional ? (
          <p className="mt-3 text-[11px] text-texto-terciario">
            Estos nombres son provisionales: el inventario de plantillas ({data.pendiente}) todavía no está aprobado por Meta.
          </p>
        ) : null}

        <Boton
          onClick={() => {
            if (!plantilla) return;
            void onEnviar(
              plantilla.nombre,
              plantilla.parametros.map((_, indice) => (valores[indice] ?? '').trim()),
            );
          }}
          cargando={enviando}
          disabled={!completa}
          className="mt-3 w-full"
        >
          Enviar plantilla
        </Boton>
      </div>
    </div>
  );
}
