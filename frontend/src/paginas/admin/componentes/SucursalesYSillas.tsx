import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../api/admin';
import { Boton } from '../../../componentes/Boton';
import { Cargando } from '../../../componentes/Cargando';
import { Insignia } from '../../../componentes/Insignia';
import { AvisoDeError } from '../../../componentes/AvisoDeError';
import { Vacio } from '../../../componentes/Vacio';
import { SelectorDeSucursal } from '../../../componentes/selectores';

/**
 * Sucursales y Sillas Virtuales.
 *
 * ## UNA SILLA NO ES MOBILIARIO: ES CAPACIDAD VENDIBLE
 *
 * `DEC-031`: el número de sillas activas de una sucursal **es** cuántas clientas pueden atenderse a
 * la vez, y el `MotorDisponibilidad` lo usa literalmente para decidir si cabe una cita más. Crear
 * una silla aumenta lo que el sistema está dispuesto a vender; darla de baja lo reduce.
 *
 * La clienta nunca elige silla ni ve que existan. Son una unidad de cupo, no una preferencia.
 *
 * ## POR QUÉ ÁLAMOS CON UNA SOLA SILLA NO ES UN ERROR DE CAPTURA
 *
 * Es su capacidad real, y el aviso de abajo existe porque una sucursal de una silla parece un
 * descuido y la tentación de "arreglarlo" añadiendo sillas sería vender dos citas simultáneas en
 * un local donde solo cabe una.
 *
 * El alta de sucursales no está aquí: dar de alta la cuarta sucursal implica horarios semanales por
 * bloques, descansos y días festivos, y se hace con el seed de arranque (`db:seed`), que es
 * idempotente y queda versionado. Un formulario de horarios en el panel sería una forma cómoda de
 * dejar una sucursal a medio configurar en producción.
 */
export function SucursalesYSillas() {
  const cliente = useQueryClient();
  const [sucursalId, setSucursalId] = useState('');
  const [nombre, setNombre] = useState('');
  const [invalido, setInvalido] = useState<string | null>(null);

  const sucursales = useQuery({ queryKey: ['sucursales'], queryFn: () => adminApi.sucursales(), staleTime: 10 * 60_000 });
  const elegida = (sucursales.data?.sucursales ?? []).find((sucursal) => sucursal.id === sucursalId);

  const sillas = useQuery({
    queryKey: ['admin-sillas', sucursalId],
    queryFn: () => adminApi.sillas(sucursalId),
    enabled: sucursalId !== '',
  });

  /**
   * Al cambiar la capacidad se invalida **también la disponibilidad**: una respuesta cacheada de
   * `MotorDisponibilidad` calculada con el número de sillas anterior diría que cabe una cita que ya
   * no cabe, y el mostrador lo descubriría con un `409` al agendar.
   */
  const refrescar = async () => {
    await Promise.all([
      cliente.invalidateQueries({ queryKey: ['admin-sillas', sucursalId] }),
      cliente.invalidateQueries({ queryKey: ['disponibilidad'] }),
    ]);
  };

  const crear = useMutation({ mutationFn: (texto: string) => adminApi.crearSilla(sucursalId, texto) });
  const desactivar = useMutation({ mutationFn: (id: string) => adminApi.desactivarSilla(id) });

  const lista = sillas.data?.sillas ?? [];
  const activas = lista.filter((silla) => silla.activa);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-borde bg-fondo-elevado p-4">
        <h2 className="text-sm font-semibold text-texto">Sucursales</h2>
        {sucursales.isLoading ? (
          <Cargando mensaje="Cargando…" />
        ) : sucursales.isError ? (
          <AvisoDeError error={sucursales.error} className="mt-3" />
        ) : (
          <ul className="mt-3 divide-y divide-borde" aria-label="Sucursales">
            {(sucursales.data?.sucursales ?? []).map((sucursal) => (
              <li key={sucursal.id} className="flex items-center gap-3 py-2.5">
                <span className="text-sm text-texto">{sucursal.nombre}</span>
                {sucursal.enMantenimiento ? <Insignia tono="aviso">En mantenimiento</Insignia> : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-texto-terciario">
          Los horarios, descansos y días festivos de cada sucursal se cargan con el arranque del sistema, no desde aquí: una
          sucursal a medio configurar vendería huecos a horas en las que está cerrada.
        </p>
      </section>

      <section className="rounded-lg border border-borde bg-fondo-elevado p-4">
        <h2 className="text-sm font-semibold text-texto">Sillas Virtuales</h2>
        <p className="mt-0.5 text-xs text-texto-secundario">
          Cuántas clientas pueden atenderse <strong>a la vez</strong> en la sucursal. La agenda no venderá más citas simultáneas
          que sillas activas.
        </p>

        <div className="mt-3 max-w-sm">
          <SelectorDeSucursal valor={sucursalId} onCambio={setSucursalId} id="sillas-sucursal" />
        </div>

        {sucursalId === '' ? (
          <p className="mt-3 text-sm text-texto-secundario">Elige una sucursal para ver y editar sus sillas.</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-texto">
              <strong>{activas.length}</strong> {activas.length === 1 ? 'silla activa' : 'sillas activas'}
              {elegida ? ` en ${elegida.nombre}` : ''}.
            </p>
            {activas.length === 1 ? (
              <p className="mt-2 rounded border border-info/30 bg-info-suave px-3 py-2 text-xs text-info">
                Una sola silla puede ser correcto: hay sucursales de una estación. No añadas sillas que no existan en el local —
                la agenda vendería dos citas a la misma hora donde solo cabe una.
              </p>
            ) : null}

            {sillas.isLoading ? (
              <Cargando mensaje="Cargando…" />
            ) : sillas.isError ? (
              <AvisoDeError error={sillas.error} className="mt-3" />
            ) : lista.length === 0 ? (
              <div className="mt-3">
                <Vacio titulo="Sin sillas" detalle="Sin sillas activas esta sucursal no puede recibir ninguna cita." />
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-borde" aria-label="Sillas de la sucursal">
                {lista.map((silla) => (
                  <li key={silla.id} className="flex items-center gap-3 py-2.5">
                    <span className={`text-sm ${silla.activa ? 'text-texto' : 'text-texto-terciario line-through'}`}>{silla.nombre}</span>
                    <Insignia tono={silla.activa ? 'exito' : 'neutro'}>{silla.activa ? 'Activa' : 'Fuera de servicio'}</Insignia>
                    {silla.activa ? (
                      <Boton
                        variante="fantasma"
                        className="ml-auto"
                        cargando={desactivar.isPending}
                        aria-label={`Dar de baja ${silla.nombre}`}
                        onClick={async () => {
                          await desactivar.mutateAsync(silla.id);
                          await refrescar();
                        }}
                      >
                        Quitar de servicio
                      </Boton>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-borde pt-4">
              <div className="min-w-[14rem]">
                <label htmlFor="silla-nombre" className="block text-xs font-medium text-texto-secundario">
                  Nombre de la silla
                </label>
                <input
                  id="silla-nombre"
                  value={nombre}
                  onChange={(evento) => setNombre(evento.target.value)}
                  placeholder="Estación 3"
                  className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto placeholder:text-texto-terciario"
                />
              </div>
              <Boton
                cargando={crear.isPending}
                onClick={async () => {
                  setInvalido(null);
                  if (nombre.trim() === '') {
                    setInvalido('La silla necesita un nombre para poder reconocerla en la agenda.');
                    return;
                  }
                  await crear.mutateAsync(nombre.trim());
                  setNombre('');
                  await refrescar();
                }}
              >
                Añadir silla
              </Boton>
              <p className="text-[11px] text-texto-terciario">Añadir una silla aumenta cuántas citas simultáneas se venden.</p>
            </div>

            {invalido ? (
              <p role="alert" className="mt-3 rounded border border-aviso/30 bg-aviso-suave px-3 py-2 text-xs text-aviso">
                {invalido}
              </p>
            ) : null}
            <AvisoDeError error={crear.error ?? desactivar.error} className="mt-3" />
          </>
        )}
      </section>
    </div>
  );
}
