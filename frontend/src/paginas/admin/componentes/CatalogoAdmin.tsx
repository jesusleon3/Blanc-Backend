import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Servicio } from '../../../api/contrato';
import { adminApi, type DatosDeServicio } from '../../../api/admin';
import { Boton } from '../../../componentes/Boton';
import { Cargando } from '../../../componentes/Cargando';
import { Insignia } from '../../../componentes/Insignia';
import { AvisoDeError } from '../../../componentes/AvisoDeError';
import { Vacio } from '../../../componentes/Vacio';
import { centavosDesdePesos, pesos, pesosEditables } from '../../../componentes/etiquetas';

const CLASES_DE_CAMPO = 'mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto placeholder:text-texto-terciario';

/**
 * Catálogo y tiempos.
 *
 * ## POR QUÉ ESTA PANTALLA ES LA MÁS DELICADA DEL PANEL
 *
 * `duracionBaseMinutos` **no es un dato informativo**: `AgendarCitaUseCase` deriva de él el fin de
 * cada cita (`DEC-033`), y de ahí salen el `tstzrange` y la `EXCLUDE USING gist` que impiden dos
 * citas en la misma silla. Si una duración queda corta, el sistema **vende huecos que no existen**
 * y nada falla en ninguna parte: las citas simplemente no caben, y se descubre en el mostrador con
 * dos clientas esperando. Si queda larga, se deja de vender capacidad real.
 *
 * Por eso los minutos se piden en un campo propio y visible en la tabla, no escondidos en un
 * detalle, y por eso la pantalla dice en voz alta qué consecuencia tiene cambiarlos.
 *
 * El precio va en **pesos** en el formulario y se convierte a centavos al enviar
 * (`centavosDesdePesos`): el contrato son centavos (`RN-COT-07`), pero pedirle centavos a quien
 * captura una lista de precios es pedir un error de dos ceros.
 */
export function CatalogoAdmin() {
  const cliente = useQueryClient();
  const [editando, setEditando] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const servicios = useQuery({ queryKey: ['admin-servicios'], queryFn: () => adminApi.servicios() });
  const categorias = useQuery({ queryKey: ['admin-categorias'], queryFn: () => adminApi.categorias(), staleTime: 5 * 60_000 });

  /**
   * Tras cualquier cambio se invalida **también `['servicios']`**, la clave que usan los selectores
   * de la Agenda. Sin eso, el mostrador seguiría ofreciendo la duración vieja desde la caché
   * mientras el backend ya aplica la nueva — y la cita se agendaría con un fin distinto del que la
   * pantalla mostró.
   */
  const refrescar = async () => {
    await Promise.all([
      cliente.invalidateQueries({ queryKey: ['admin-servicios'] }),
      cliente.invalidateQueries({ queryKey: ['admin-categorias'] }),
      cliente.invalidateQueries({ queryKey: ['servicios'] }),
    ]);
  };

  /**
   * **`mutate` + `onSuccess`, nunca `await mutateAsync()` en el `onClick`.**
   *
   * React descarta la promesa que devuelve un manejador de evento, así que un `mutateAsync` que
   * rechace —y rechaza en cada `409`— deja un rechazo sin gestionar. El error se vería igual
   * (`useMutation` lo guarda y `AvisoDeError` lo pinta), pero con un informador de errores
   * conectado cada conflicto legítimo se reportaría como un fallo del programa. Con `mutate` no hay
   * promesa que descartar, y el refresco va donde corresponde: al éxito.
   */
  const desactivar = useMutation({ mutationFn: (id: string) => adminApi.desactivarServicio(id), onSuccess: refrescar });

  const lista = servicios.data?.servicios ?? [];

  return (
    <div className="space-y-4">
      {/* Lo que la orden de trabajo pide dejar escrito aquí: estos números son LOS de la Dueña y se
          editan sin programar nada. Es la diferencia entre un catálogo que se mantiene y uno que
          envejece esperando un despliegue. */}
      <div className="rounded-lg border border-info/30 bg-info-suave px-4 py-3 text-xs text-info">
        <p className="font-semibold">Estos tiempos son los oficiales, y se editan desde aquí.</p>
        <p className="mt-1">
          Cada renglón lleva la duración exacta que la Dueña definió, en bloques de <strong>60, 120 o 180 minutos</strong>, y los
          tiempos de una combinación <strong>no son la suma de sus partes</strong>: «rubber + gel + manicure» es una hora, no tres.
          Puedes cambiar la duración y el precio de cualquier renglón <strong>sin tocar código ni esperar un despliegue</strong>, y
          el bot y el mostrador lo respetan desde la siguiente cita.
        </p>
        <p className="mt-1">
          Los <strong>precios siguen siendo provisionales</strong>: hay que confirmarlos antes de cobrar. Los tiempos ya están
          confirmados.
        </p>
      </div>

      <section className="rounded-lg border border-borde bg-fondo-elevado p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-sm font-semibold text-texto">Servicios</h2>
            <p className="mt-0.5 text-xs text-texto-secundario">
              Los minutos de cada servicio son los que la agenda usa para calcular cuándo termina una cita.
            </p>
          </div>
          <Boton className="ml-auto" onClick={() => setCreando((valor) => !valor)}>
            {creando ? 'Cerrar' : 'Nuevo servicio'}
          </Boton>
        </div>

        {creando ? (
          <div className="mt-4">
            <FormularioDeServicio
              categorias={categorias.data?.categorias ?? []}
              onGuardar={async (datos) => {
                await adminApi.crearServicio(datos as DatosDeServicio);
                await refrescar();
                setCreando(false);
              }}
              onCancelar={() => setCreando(false)}
            />
          </div>
        ) : null}
      </section>

      {servicios.isLoading ? (
        <Cargando mensaje="Cargando el catálogo…" />
      ) : servicios.isError ? (
        <AvisoDeError error={servicios.error} />
      ) : lista.length === 0 ? (
        <Vacio
          titulo="El catálogo está vacío"
          detalle="Sin servicios no se puede agendar nada: la agenda necesita la duración de cada uno."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-borde bg-fondo-elevado">
          <table className="w-full text-sm" aria-label="Servicios del catálogo">
            <thead>
              <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-terciario">
                <th className="px-4 py-2.5 font-medium">Servicio</th>
                <th className="px-4 py-2.5 font-medium">Categoría</th>
                <th className="px-4 py-2.5 font-medium">Duración</th>
                <th className="px-4 py-2.5 font-medium">Precio</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {lista.map((servicio) => (
                <Fragment key={servicio.id}>
                  <tr className={servicio.activo ? '' : 'opacity-60'}>
                    <td className="px-4 py-3 font-medium text-texto">{servicio.nombre}</td>
                    <td className="px-4 py-3 text-texto-secundario">{servicio.categoria}</td>
                    <td className="px-4 py-3 text-texto">{servicio.duracionBaseMinutos} min</td>
                    <td className="px-4 py-3 text-texto">
                      {servicio.requiereCotizacionManual ? (
                        <span className="text-texto-secundario">
                          {pesos(servicio.precioBaseCentavos)} <span className="text-[11px]">· base, se cotiza a mano</span>
                        </span>
                      ) : (
                        pesos(servicio.precioBaseCentavos)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Insignia tono={servicio.activo ? 'exito' : 'neutro'}>{servicio.activo ? 'A la venta' : 'Dado de baja'}</Insignia>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Boton
                          variante="secundario"
                          onClick={() => setEditando(editando === servicio.id ? null : servicio.id)}
                          aria-label={`Editar ${servicio.nombre}`}
                        >
                          Editar
                        </Boton>
                        {servicio.activo ? (
                          <Boton
                            variante="fantasma"
                            cargando={desactivar.isPending}
                            aria-label={`Dar de baja ${servicio.nombre}`}
                            onClick={() => desactivar.mutate(servicio.id)}
                          >
                            Dar de baja
                          </Boton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {editando === servicio.id ? (
                    <tr>
                      <td colSpan={6} className="bg-fondo-apagado px-4 py-4">
                        <FormularioDeServicio
                          servicio={servicio}
                          categorias={categorias.data?.categorias ?? []}
                          onGuardar={async (datos) => {
                            await adminApi.editarServicio(servicio.id, datos);
                            await refrescar();
                            setEditando(null);
                          }}
                          onCancelar={() => setEditando(null)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AvisoDeError error={desactivar.error} />

      {/* Dar de baja no borra: las citas pasadas conservan nombre y precio en su
          `cotizacionSnapshot`, así que siguen siendo legibles. Decirlo evita el miedo a tocar. */}
      <p className="text-xs text-texto-terciario">
        Dar de baja un servicio solo lo quita de la venta. Las citas que ya lo usaron conservan el precio con el que se cobraron.
      </p>
    </div>
  );
}

/**
 * Alta y edición con el **mismo formulario**.
 *
 * En la edición manda solo los campos que cambiaron (`PATCH` parcial): reenviar el precio sin
 * haberlo tocado lo reescribiría con el valor redondeado del campo, y un servicio con un importe
 * que no es múltiplo de un centavo —hoy no debería existir, pero el día que exista— se alteraría
 * sin que nadie lo pidiera.
 */
export function FormularioDeServicio({
  servicio,
  categorias,
  onGuardar,
  onCancelar,
}: {
  servicio?: Servicio;
  categorias: readonly string[];
  onGuardar: (datos: Partial<DatosDeServicio>) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(servicio?.nombre ?? '');
  const [categoria, setCategoria] = useState(servicio?.categoria ?? '');
  const [minutos, setMinutos] = useState(servicio ? String(servicio.duracionBaseMinutos) : '');
  const [precio, setPrecio] = useState(servicio ? pesosEditables(servicio.precioBaseCentavos) : '');
  const [manual, setManual] = useState(servicio?.requiereCotizacionManual ?? false);
  const [error, setError] = useState<unknown>(null);
  const [invalido, setInvalido] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  const idBase = servicio ? `servicio-${servicio.id}` : 'servicio-nuevo';
  const esEdicion = servicio !== undefined;

  const enviar = async () => {
    setError(null);
    setInvalido(null);

    const centavos = centavosDesdePesos(precio);
    const duracion = Number(minutos.trim());

    if (nombre.trim() === '') return setInvalido('El servicio necesita un nombre.');
    if (categoria.trim() === '') return setInvalido('Elige o escribe una categoría.');
    if (!Number.isInteger(duracion) || duracion <= 0) {
      return setInvalido('La duración tiene que ser un número entero de minutos mayor que cero: de ella sale la hora en que termina la cita.');
    }
    if (centavos === null) return setInvalido('El precio tiene que ser un importe en pesos, por ejemplo 450 o 450.50.');

    /**
     * En la edición solo viajan los campos **modificados**. En el alta viajan todos, porque el DTO
     * los exige. Son dos formas distintas de la misma intención y por eso el tipo es `Partial`.
     */
    const datos: Partial<DatosDeServicio> = esEdicion
      ? {
          ...(nombre.trim() !== servicio.nombre ? { nombre: nombre.trim() } : {}),
          ...(categoria.trim() !== servicio.categoria ? { categoria: categoria.trim() } : {}),
          ...(duracion !== servicio.duracionBaseMinutos ? { duracionBaseMinutos: duracion } : {}),
          ...(centavos !== servicio.precioBaseCentavos ? { precioBaseCentavos: centavos } : {}),
          ...(manual !== servicio.requiereCotizacionManual ? { requiereCotizacionManual: manual } : {}),
        }
      : {
          nombre: nombre.trim(),
          categoria: categoria.trim(),
          duracionBaseMinutos: duracion,
          precioBaseCentavos: centavos,
          requiereCotizacionManual: manual,
        };

    setPendiente(true);
    try {
      await onGuardar(datos);
    } catch (fallo) {
      setError(fallo);
    } finally {
      setPendiente(false);
    }
    return undefined;
  };

  return (
    <div>
      <p className="text-sm font-semibold text-texto">{esEdicion ? `Editar ${servicio.nombre}` : 'Nuevo servicio'}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor={`${idBase}-nombre`} className="block text-xs font-medium text-texto-secundario">
            Nombre
          </label>
          <input id={`${idBase}-nombre`} value={nombre} onChange={(e) => setNombre(e.target.value)} className={CLASES_DE_CAMPO} />
        </div>

        <div>
          <label htmlFor={`${idBase}-categoria`} className="block text-xs font-medium text-texto-secundario">
            Categoría
          </label>
          {/* `datalist` y no un `select`: las categorías se derivan de los servicios existentes
              (no hay tabla), así que hay que poder escribir una nueva. La lista evita que `Manos`
              y `manos` acaben siendo dos categorías distintas. */}
          <input
            id={`${idBase}-categoria`}
            list={`${idBase}-categorias`}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className={CLASES_DE_CAMPO}
            placeholder="Manos, Pies, Decorado…"
          />
          <datalist id={`${idBase}-categorias`}>
            {categorias.map((nombreDeCategoria) => (
              <option key={nombreDeCategoria} value={nombreDeCategoria} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor={`${idBase}-minutos`} className="block text-xs font-medium text-texto-secundario">
            Duración en minutos
          </label>
          <input
            id={`${idBase}-minutos`}
            type="number"
            min={1}
            step={5}
            value={minutos}
            onChange={(e) => setMinutos(e.target.value)}
            className={CLASES_DE_CAMPO}
          />
          <p className="mt-1 text-[11px] text-texto-terciario">
            De aquí sale la hora en que termina la cita. Los bloques oficiales son 60, 120 y 180 minutos.
          </p>
        </div>

        <div>
          <label htmlFor={`${idBase}-precio`} className="block text-xs font-medium text-texto-secundario">
            Precio en pesos
          </label>
          <input
            id={`${idBase}-precio`}
            type="text"
            inputMode="decimal"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className={CLASES_DE_CAMPO}
            placeholder="450"
          />
        </div>
      </div>

      <label className="mt-3 flex items-start gap-2 text-xs text-texto-secundario">
        <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="mt-0.5" />
        <span>
          <strong className="text-texto">El precio lo fija una persona</strong> (diseños especiales). El bot no cotizará este
          servicio: lo escalará para que alguien dé el precio (DEC-033).
        </span>
      </label>

      {invalido ? (
        <p role="alert" className="mt-3 rounded border border-aviso/30 bg-aviso-suave px-3 py-2 text-xs text-aviso">
          {invalido}
        </p>
      ) : null}
      <AvisoDeError error={error} className="mt-3" />

      <div className="mt-3 flex gap-2">
        <Boton cargando={pendiente} onClick={() => void enviar()}>
          {esEdicion ? 'Guardar cambios' : 'Crear servicio'}
        </Boton>
        <Boton variante="fantasma" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </div>
  );
}
