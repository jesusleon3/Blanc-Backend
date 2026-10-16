import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Cita } from '../../api/contrato';
import { agendaApi } from '../../api/agenda';
import { catalogoApi } from '../../api/catalogo';
import { sucursalesApi } from '../../api/sucursales';
import { useSesion } from '../../auth/sesion';
import { Boton } from '../../componentes/Boton';
import { Cargando } from '../../componentes/Cargando';
import { AvisoDeError } from '../../componentes/AvisoDeError';
import { Vacio } from '../../componentes/Vacio';
import { ETIQUETA_DE_ESTADO_CITA, fechaLocalDeHoy, horaLocal, pesos, pesosOSinCotizar, rangoDelDia } from '../../componentes/etiquetas';

/**
 * Vista de iPad de la Manicurista — **solo lectura, y aislada por construcción**.
 *
 * ## TRES GARANTÍAS, Y NINGUNA DEPENDE DE ESTE ARCHIVO
 *
 * 1. **Solo sus citas.** El filtro lo aplica `ConsultarAgendaUseCase` con el `manicuristaId`
 *    resuelto de **sus permisos contra PostgreSQL** (`P9`), nunca de la petición. Esta pantalla
 *    manda la misma consulta que el panel y recibe menos filas; no filtra nada.
 * 2. **Sin datos de lista roja ni anticipos.** El presenter del backend sale antes de añadirlos, y
 *    `ConsultarAgendaUseCase` **ni consulta CRM** para ella — *"si el dato nunca entra en el
 *    proceso, no puede filtrarse por un descuido de un presenter futuro"* (`DEC-040`). El nombre
 *    de la clienta sí llega, por un método del puerto cuyo `Map<string, string>` no puede
 *    transportar otra cosa.
 * 3. **Cero mutaciones.** No hay un solo botón de acción, y eso no es una omisión visual: los
 *    endpoints de cancelar, completar y `no_show` responden `403` a su rol. Si alguien añadiera un
 *    botón aquí, no funcionaría.
 *
 * ## POR QUÉ NO MONTA `Layout`
 *
 * Ese marco lleva los enlaces a Bandeja, Anticipos y Clientas, y el contador de conversaciones
 * escaladas. **Nada de eso puede aparecer en el iPad**: el contador revelaría actividad de
 * clientas, y los tres enlaces darían `403` en cada petición. Es un árbol de rutas separado
 * (`App.tsx`), así que el aislamiento es estructural y no depende de ningún condicional de rol.
 *
 * ## DISEÑO PARA TABLET
 *
 * Tipografía grande, filas altas y una sola columna. Se lee de reojo con las manos ocupadas, a
 * medio metro: una tabla de escritorio reducida sería ilegible en ese contexto.
 */
export function MiAgenda() {
  const { correo, perfil, cerrarSesion } = useSesion();
  const [fecha, setFecha] = useState(fechaLocalDeHoy());

  const sucursales = useQuery({ queryKey: ['sucursales'], queryFn: () => sucursalesApi.listar(), staleTime: 10 * 60_000 });
  const servicios = useQuery({ queryKey: ['servicios'], queryFn: () => catalogoApi.servicios(), staleTime: 10 * 60_000 });

  /**
   * La consulta exige `sucursalId`, así que se pide **una por sucursal** y se juntan.
   *
   * La alternativa —preguntarle a la manicurista en qué sucursal está— falla en el caso de una
   * cobertura inter-sucursal (`DEC-036`): ese día trabaja en otra, y tendría que saber cambiar el
   * selector para ver sus propias citas. El backend ya le devuelve solo las suyas en cada
   * sucursal, así que unirlas es correcto y es lo que ella espera: *"mi día"*.
   */
  const listaDeSucursales = sucursales.data?.sucursales ?? [];
  const rango = rangoDelDia(fecha);

  const agenda = useQuery({
    queryKey: ['mi-agenda', fecha, listaDeSucursales.map((s) => s.id).join(',')],
    queryFn: async () => {
      const paginas = await Promise.all(
        listaDeSucursales.map((sucursal) => agendaApi.listar({ sucursalId: sucursal.id, ...rango, limite: 200 })),
      );
      return paginas
        .flatMap((pagina) => pagina.citas)
        .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
    },
    enabled: listaDeSucursales.length > 0,
    // Refresca al volver a la tablet: si la Encargada le asigna una cita a media mañana, aparece.
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const nombreDeServicio = (id: string) => servicios.data?.servicios.find((servicio) => servicio.id === id)?.nombre ?? 'Servicio';

  return (
    <div className="min-h-screen bg-fondo-tenue">
      <header className="flex h-20 items-center gap-4 border-b border-borde bg-fondo-elevado px-6">
        <span className="text-xl font-semibold tracking-tight text-texto">
          Blanc<span className="text-acentuado">.</span>
        </span>
        <h1 className="text-base font-medium text-texto-secundario">Mi agenda</h1>
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden text-sm text-texto-terciario sm:block">{correo}</span>
          <Boton variante="fantasma" onClick={() => void cerrarSesion()}>
            Salir
          </Boton>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label htmlFor="mi-fecha" className="text-base font-medium text-texto">
            Día
          </label>
          <input
            id="mi-fecha"
            type="date"
            value={fecha}
            onChange={(evento) => setFecha(evento.target.value)}
            // Controles grandes: se toca con el dedo, no con un ratón.
            className="rounded-lg border border-borde bg-fondo px-4 py-3 text-base text-texto"
          />
          <button
            type="button"
            onClick={() => setFecha(fechaLocalDeHoy())}
            className="rounded-lg px-4 py-3 text-base font-medium text-texto-secundario transition hover:bg-fondo-apagado hover:text-texto"
          >
            Hoy
          </button>
        </div>

        {perfil?.manicuristaId === null ? (
          /**
           * Rol `MANICURISTA` sin vínculo de personal (`P9`). El backend devuelve **cero citas**
           * —el lado seguro del error— y sin este aviso la pantalla parecería decir *"hoy no
           * tienes nada"*, que es una mentira con consecuencias: se iría a casa.
           */
          <div role="alert" className="rounded-lg border border-aviso/30 bg-aviso-suave p-5 text-sm text-aviso">
            Tu cuenta todavía no está vinculada a tu ficha de personal, así que no se pueden mostrar tus citas. Avísale a la Encargada —no
            es que no tengas trabajo hoy.
          </div>
        ) : agenda.isLoading || sucursales.isLoading ? (
          <Cargando mensaje="Cargando tu día…" />
        ) : agenda.isError ? (
          <AvisoDeError error={agenda.error} />
        ) : (agenda.data ?? []).length === 0 ? (
          <Vacio titulo="No tienes citas este día" />
        ) : (
          <ol className="space-y-4" aria-label="Mis citas">
            {(agenda.data ?? []).map((cita) => (
              <TarjetaDeCita key={cita.id} cita={cita} nombreDeServicio={nombreDeServicio} />
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}

/** Una cita, en grande. Horario, clienta, servicio y desglose de precio. */
function TarjetaDeCita({ cita, nombreDeServicio }: { cita: Cita; nombreDeServicio: (id: string) => string }) {
  const snapshot = cita.cotizacionSnapshot;

  return (
    <li className="rounded-xl border border-borde bg-fondo-elevado p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="text-2xl font-semibold tabular-nums text-texto">{horaLocal(cita.inicio)}</p>
        <p className="text-base text-texto-secundario">a {horaLocal(cita.fin)}</p>
        <span className="ml-auto rounded-full bg-fondo-apagado px-3 py-1 text-sm font-medium text-texto-secundario">
          {ETIQUETA_DE_ESTADO_CITA[cita.estado]}
        </span>
      </div>

      <p className="mt-3 text-lg font-medium text-texto">{cita.clientaNombre ?? 'Clienta'}</p>
      <p className="text-base text-texto-secundario">{nombreDeServicio(cita.servicioId)}</p>

      {snapshot ? (
        <div className="mt-4 border-t border-borde pt-3">
          {/* La Dueña lo confirmó explícitamente: *"ve precios"*. Se muestra el precio del servicio
              y el total congelado, que es todo lo que el snapshot tiene hoy: los modificadores no
              entran en el total mientras `FL-COT-03` siga pospuesto (`incluyeModificadores:
              false`), así que un desglose por modificador sería inventado. */}
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-texto-secundario">{snapshot.servicio.nombre}</dt>
              <dd className="tabular-nums text-texto">{pesos(snapshot.servicio.precioCentavos)}</dd>
            </div>
            <div className="flex justify-between border-t border-borde pt-1 font-semibold">
              <dt className="text-texto">Total</dt>
              {/* `null` NO es cero: es cotización manual pendiente (`DEC-033`). Mostrarlo como
                  $0.00 era un defecto real — un precio falso que alguien podría decirle a la
                  clienta. */}
              <dd className="tabular-nums text-texto">{pesosOSinCotizar(snapshot.totalCentavos)}</dd>
            </div>
          </dl>
          {snapshot.requiereCotizacionManual ? (
            <p className="mt-2 text-xs text-aviso">El precio final lo fija una encargada: este servicio se cotiza a mano.</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
