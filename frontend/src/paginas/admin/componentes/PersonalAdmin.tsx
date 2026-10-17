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
 * Personal: alta, baja y en qué sucursales trabaja cada manicurista.
 *
 * ## LA BAJA PUEDE SER RECHAZADA, Y ESO ES LO IMPORTANTE DE ESTA PANTALLA
 *
 * `DesactivarManicuristaUseCase` responde `409 MANICURISTA_CON_CITAS_ACTIVAS` si tiene citas
 * futuras asignadas. Es una barrera deliberada: una baja silenciosa dejaría esas citas **sin nadie
 * que las atienda**, el motor de disponibilidad dejaría de contarla, y nadie se enteraría hasta
 * que la clienta llegara al salón. El `409` obliga a pasar antes por la Agenda a reasignar o
 * cancelar, que es exactamente el trabajo que hay que hacer.
 *
 * La pantalla **no intenta adivinar** si la baja va a poder hacerse. Podría contar las citas
 * futuras y esconder el botón, y sería peor: parecería que la función no existe en lugar de
 * explicar qué falta.
 *
 * ## UNA MANICURISTA NO ES UNA USUARIA
 *
 * Son dos cosas distintas y se administran por separado: aquí vive la **persona que atiende**, con
 * su asignación de sucursales, que es lo que el motor de disponibilidad necesita. El acceso al
 * sistema (rol, correo, contraseña) vive en Identidad y Accesos. Juntarlos obligaría a dar de alta
 * un usuario para cada manicurista aunque nunca vaya a entrar al panel.
 */
export function PersonalAdmin() {
  const cliente = useQueryClient();
  const [sucursalId, setSucursalId] = useState('');
  const [nombre, setNombre] = useState('');
  const [invalido, setInvalido] = useState<string | null>(null);

  /**
   * Dos consultas y no una: el **listado completo** (sin filtro) es el registro de personal, y el
   * **listado de la sucursal** responde *"¿quién trabaja aquí?"*. La segunda es la que se compara
   * para saber si alguien está asignada, porque el presenter de manicurista no devuelve sus
   * sucursales — y pedirlas sería cruzar dos contextos para pintar una fila.
   */
  const todas = useQuery({ queryKey: ['admin-manicuristas'], queryFn: () => adminApi.manicuristas() });
  const deLaSucursal = useQuery({
    queryKey: ['admin-manicuristas', sucursalId],
    queryFn: () => adminApi.manicuristas(sucursalId),
    enabled: sucursalId !== '',
  });

  const refrescar = async () => {
    await Promise.all([
      cliente.invalidateQueries({ queryKey: ['admin-manicuristas'] }),
      // La clave que usan los selectores de la Agenda y la lista de citas.
      cliente.invalidateQueries({ queryKey: ['manicuristas'] }),
      cliente.invalidateQueries({ queryKey: ['disponibilidad'] }),
    ]);
  };

  const crear = useMutation({ mutationFn: (texto: string) => adminApi.crearManicurista(texto) });
  const desactivar = useMutation({ mutationFn: (id: string) => adminApi.desactivarManicurista(id) });
  const asignacion = useMutation({
    mutationFn: ({ manicuristaId, asignar }: { manicuristaId: string; asignar: boolean }) =>
      asignar ? adminApi.asignarASucursal(manicuristaId, sucursalId) : adminApi.removerDeSucursal(manicuristaId, sucursalId),
  });

  const lista = todas.data?.manicuristas ?? [];
  const idsDeLaSucursal = new Set((deLaSucursal.data?.manicuristas ?? []).map((manicurista) => manicurista.id));

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-borde bg-fondo-elevado p-4">
        <h2 className="text-sm font-semibold text-texto">Dar de alta a una manicurista</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem]">
            <label htmlFor="manicurista-nombre" className="block text-xs font-medium text-texto-secundario">
              Nombre
            </label>
            <input
              id="manicurista-nombre"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              placeholder="Karla"
              className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto placeholder:text-texto-terciario"
            />
          </div>
          <Boton
            cargando={crear.isPending}
            onClick={async () => {
              setInvalido(null);
              if (nombre.trim() === '') {
                setInvalido('Escribe el nombre con el que la vas a reconocer en la agenda.');
                return;
              }
              await crear.mutateAsync(nombre.trim());
              setNombre('');
              await refrescar();
            }}
          >
            Dar de alta
          </Boton>
        </div>
        <p className="mt-2 text-xs text-texto-terciario">
          Darla de alta no le da acceso al sistema. Si va a usar el iPad, además hay que crearle un usuario con rol Manicurista.
        </p>
        {invalido ? (
          <p role="alert" className="mt-3 rounded border border-aviso/30 bg-aviso-suave px-3 py-2 text-xs text-aviso">
            {invalido}
          </p>
        ) : null}
        <AvisoDeError error={crear.error} className="mt-3" />
      </section>

      <section className="rounded-lg border border-borde bg-fondo-elevado p-4">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="text-sm font-semibold text-texto">Personal</h2>
          <div className="ml-auto min-w-[14rem]">
            <SelectorDeSucursal
              valor={sucursalId}
              onCambio={setSucursalId}
              id="personal-sucursal"
              etiqueta="Ver asignación en"
              incluirTodas
            />
          </div>
        </div>

        {todas.isLoading ? (
          <Cargando mensaje="Cargando el personal…" />
        ) : todas.isError ? (
          <AvisoDeError error={todas.error} className="mt-3" />
        ) : lista.length === 0 ? (
          <div className="mt-3">
            <Vacio titulo="Sin personal dado de alta" detalle="Sin manicuristas no se puede asignar ninguna cita." />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-borde" aria-label="Manicuristas">
            {lista.map((manicurista) => {
              const asignada = idsDeLaSucursal.has(manicurista.id);
              return (
                <li key={manicurista.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className={`text-sm ${manicurista.activa ? 'text-texto' : 'text-texto-terciario'}`}>{manicurista.nombre}</span>
                  <Insignia tono={manicurista.activa ? 'exito' : 'neutro'}>{manicurista.activa ? 'Activa' : 'Dada de baja'}</Insignia>
                  {sucursalId !== '' && asignada ? <Insignia tono="info">Trabaja aquí</Insignia> : null}

                  <div className="ml-auto flex gap-1.5">
                    {sucursalId !== '' && manicurista.activa ? (
                      <Boton
                        variante="secundario"
                        cargando={asignacion.isPending}
                        aria-label={`${asignada ? 'Quitar de la sucursal' : 'Asignar a la sucursal'} a ${manicurista.nombre}`}
                        onClick={async () => {
                          await asignacion.mutateAsync({ manicuristaId: manicurista.id, asignar: !asignada });
                          await Promise.all([refrescar(), cliente.invalidateQueries({ queryKey: ['admin-manicuristas', sucursalId] })]);
                        }}
                      >
                        {asignada ? 'Quitar de esta sucursal' : 'Asignar a esta sucursal'}
                      </Boton>
                    ) : null}

                    {manicurista.activa ? (
                      <Boton
                        variante="peligro"
                        cargando={desactivar.isPending}
                        aria-label={`Dar de baja a ${manicurista.nombre}`}
                        onClick={async () => {
                          try {
                            await desactivar.mutateAsync(manicurista.id);
                            await refrescar();
                          } catch {
                            // El error se muestra abajo con su explicación; aquí solo se evita que
                            // una promesa rechazada escape como fallo no gestionado.
                          }
                        }}
                      >
                        Dar de baja
                      </Boton>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <AvisoDeError error={desactivar.error ?? asignacion.error} className="mt-3" />
      </section>
    </div>
  );
}
