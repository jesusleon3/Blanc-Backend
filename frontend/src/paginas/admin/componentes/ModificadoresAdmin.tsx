import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ModificadorDiseno } from '../../../api/contrato';
import { adminApi } from '../../../api/admin';
import { Boton } from '../../../componentes/Boton';
import { Cargando } from '../../../componentes/Cargando';
import { Insignia } from '../../../componentes/Insignia';
import { AvisoDeError } from '../../../componentes/AvisoDeError';
import { Vacio } from '../../../componentes/Vacio';
import { centavosDesdePesos, pesos, pesosEditables } from '../../../componentes/etiquetas';

const CLASES_DE_CAMPO = 'mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto placeholder:text-texto-terciario';

/**
 * Modificadores de diseño y su vínculo con cada servicio (`FL-COT-01`).
 *
 * ## LO QUE HOY HACE UN MODIFICADOR, Y LO QUE TODAVÍA NO
 *
 * Un `ModificadorDiseno` guarda **minutos y precio adicionales** y se puede vincular a los
 * servicios que lo admiten. Eso es real y es lo que esta pantalla administra.
 *
 * Lo que **no** existe todavía es el cálculo compuesto: `AgendarCitaUseCase` construye la
 * cotización con `incluyeModificadores: false`, así que una cita agendada hoy cobra y ocupa la
 * duración **base** del servicio, sin sumar los modificadores vinculados. El motor de
 * combinaciones (`FL-COT-03`) está deliberadamente diferido en el backend.
 *
 * Por eso esta pantalla **dice que los minutos aún no se suman** en vez de insinuar lo contrario.
 * Una interfaz que presentara los modificadores como si ya afectaran al cobro haría que la Dueña
 * configurara precios confiando en una suma que nadie hace — y la diferencia la pagaría ella en
 * cada cita de diseño.
 */
export function ModificadoresAdmin() {
  const cliente = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  const modificadores = useQuery({ queryKey: ['admin-modificadores'], queryFn: () => adminApi.modificadores() });
  const servicios = useQuery({ queryKey: ['admin-servicios'], queryFn: () => adminApi.servicios() });

  const refrescar = () => cliente.invalidateQueries({ queryKey: ['admin-modificadores'] });
  // `mutate` + `onSuccess`: ver la nota de `CatalogoAdmin`. Un `await mutateAsync()` en el
  // `onClick` deja un rechazo sin gestionar en cada `409`.
  const desactivar = useMutation({ mutationFn: (id: string) => adminApi.desactivarModificador(id), onSuccess: refrescar });

  const lista = modificadores.data?.modificadoresDiseno ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-aviso/30 bg-aviso-suave px-4 py-3 text-xs text-aviso">
        <p className="font-semibold">Los modificadores todavía no se suman solos a la cita.</p>
        <p className="mt-1">
          Hoy una cita cobra y ocupa la duración <strong>base</strong> del servicio. Estos minutos y precios quedan configurados y
          sirven de referencia para cotizar a mano, pero el cálculo automático de combinaciones (FL-COT-03) no está construido.
          Cuando un diseño lleve tiempo extra, hay que agendarlo con un servicio cuya duración ya lo contemple o reservar el hueco
          a mano.
        </p>
      </div>

      <section className="rounded-lg border border-borde bg-fondo-elevado p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-sm font-semibold text-texto">Modificadores de diseño</h2>
            <p className="mt-0.5 text-xs text-texto-secundario">Decoraciones y extras que se reutilizan entre servicios.</p>
          </div>
          <Boton className="ml-auto" onClick={() => setCreando((valor) => !valor)}>
            {creando ? 'Cerrar' : 'Nuevo modificador'}
          </Boton>
        </div>

        {creando ? (
          <div className="mt-4">
            <FormularioDeModificador
              onGuardar={async (datos) => {
                await adminApi.crearModificador({
                  nombre: datos.nombre ?? '',
                  minutosAdicionales: datos.minutosAdicionales ?? 0,
                  precioAdicionalCentavos: datos.precioAdicionalCentavos ?? 0,
                  ...(datos.requiereCotizacionManual !== undefined ? { requiereCotizacionManual: datos.requiereCotizacionManual } : {}),
                });
                await refrescar();
                setCreando(false);
              }}
              onCancelar={() => setCreando(false)}
            />
          </div>
        ) : null}
      </section>

      {modificadores.isLoading ? (
        <Cargando mensaje="Cargando…" />
      ) : modificadores.isError ? (
        <AvisoDeError error={modificadores.error} />
      ) : lista.length === 0 ? (
        <Vacio titulo="Sin modificadores" detalle="Se usan para decoraciones y extras que se repiten entre servicios." />
      ) : (
        <ul className="space-y-3" aria-label="Modificadores de diseño">
          {lista.map((modificador) => (
            <li key={modificador.id} className={`rounded-lg border border-borde bg-fondo-elevado p-4 ${modificador.activo ? '' : 'opacity-60'}`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-texto">{modificador.nombre}</p>
                  <p className="mt-0.5 text-xs text-texto-secundario">
                    +{modificador.minutosAdicionales} min · +{pesos(modificador.precioAdicionalCentavos)}
                    {modificador.requiereCotizacionManual ? ' · el precio lo fija una persona' : ''}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <Insignia tono={modificador.activo ? 'exito' : 'neutro'}>{modificador.activo ? 'Activo' : 'Dado de baja'}</Insignia>
                  <Boton
                    variante="secundario"
                    aria-label={`Editar ${modificador.nombre}`}
                    onClick={() => setEditando(editando === modificador.id ? null : modificador.id)}
                  >
                    Editar
                  </Boton>
                  {modificador.activo ? (
                    <Boton
                      variante="fantasma"
                      aria-label={`Dar de baja ${modificador.nombre}`}
                      cargando={desactivar.isPending}
                      onClick={() => desactivar.mutate(modificador.id)}
                    >
                      Dar de baja
                    </Boton>
                  ) : null}
                </div>
              </div>

              {editando === modificador.id ? (
                <div className="mt-4 border-t border-borde pt-4">
                  <FormularioDeModificador
                    modificador={modificador}
                    onGuardar={async (datos) => {
                      await adminApi.editarModificador(modificador.id, datos);
                      await refrescar();
                      setEditando(null);
                    }}
                    onCancelar={() => setEditando(null)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <AvisoDeError error={desactivar.error} />

      <VinculosPorServicio
        servicios={(servicios.data?.servicios ?? []).filter((servicio) => servicio.activo)}
        modificadores={lista.filter((modificador) => modificador.activo)}
      />
    </div>
  );
}

type DatosDeModificador = {
  nombre?: string;
  minutosAdicionales?: number;
  precioAdicionalCentavos?: number;
  requiereCotizacionManual?: boolean;
};

function FormularioDeModificador({
  modificador,
  onGuardar,
  onCancelar,
}: {
  modificador?: ModificadorDiseno;
  onGuardar: (datos: DatosDeModificador) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(modificador?.nombre ?? '');
  const [minutos, setMinutos] = useState(modificador ? String(modificador.minutosAdicionales) : '0');
  const [precio, setPrecio] = useState(modificador ? pesosEditables(modificador.precioAdicionalCentavos) : '');
  const [manual, setManual] = useState(modificador?.requiereCotizacionManual ?? false);
  const [invalido, setInvalido] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pendiente, setPendiente] = useState(false);

  const idBase = modificador ? `modificador-${modificador.id}` : 'modificador-nuevo';

  const enviar = async () => {
    setError(null);
    setInvalido(null);

    const centavos = centavosDesdePesos(precio);
    const adicionales = Number(minutos.trim());

    if (nombre.trim() === '') return setInvalido('El modificador necesita un nombre.');
    // `@Min(0)` en el DTO: cero es legítimo (una decoración que no alarga el trabajo), negativo no.
    if (!Number.isInteger(adicionales) || adicionales < 0) return setInvalido('Los minutos adicionales tienen que ser un entero de 0 o más.');
    if (centavos === null) return setInvalido('El precio adicional tiene que ser un importe en pesos; escribe 0 si no cuesta más.');

    setPendiente(true);
    try {
      await onGuardar({
        nombre: nombre.trim(),
        minutosAdicionales: adicionales,
        precioAdicionalCentavos: centavos,
        requiereCotizacionManual: manual,
      });
    } catch (fallo) {
      setError(fallo);
    } finally {
      setPendiente(false);
    }
    return undefined;
  };

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`${idBase}-nombre`} className="block text-xs font-medium text-texto-secundario">
            Nombre
          </label>
          <input id={`${idBase}-nombre`} value={nombre} onChange={(e) => setNombre(e.target.value)} className={CLASES_DE_CAMPO} />
        </div>
        <div>
          <label htmlFor={`${idBase}-minutos`} className="block text-xs font-medium text-texto-secundario">
            Minutos adicionales
          </label>
          <input
            id={`${idBase}-minutos`}
            type="number"
            min={0}
            step={5}
            value={minutos}
            onChange={(e) => setMinutos(e.target.value)}
            className={CLASES_DE_CAMPO}
          />
        </div>
        <div>
          <label htmlFor={`${idBase}-precio`} className="block text-xs font-medium text-texto-secundario">
            Precio adicional en pesos
          </label>
          <input
            id={`${idBase}-precio`}
            type="text"
            inputMode="decimal"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className={CLASES_DE_CAMPO}
            placeholder="80"
          />
        </div>
      </div>

      <label className="mt-3 flex items-start gap-2 text-xs text-texto-secundario">
        <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="mt-0.5" />
        <span>El precio lo fija una persona (DEC-033).</span>
      </label>

      {invalido ? (
        <p role="alert" className="mt-3 rounded border border-aviso/30 bg-aviso-suave px-3 py-2 text-xs text-aviso">
          {invalido}
        </p>
      ) : null}
      <AvisoDeError error={error} className="mt-3" />

      <div className="mt-3 flex gap-2">
        <Boton cargando={pendiente} onClick={() => void enviar()}>
          {modificador ? 'Guardar cambios' : 'Crear modificador'}
        </Boton>
        <Boton variante="fantasma" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </div>
  );
}

/**
 * Qué modificadores admite cada servicio.
 *
 * Se elige **un servicio a la vez** y no se pinta una matriz de todos contra todos: la relación se
 * consulta por servicio (`GET /servicios/:id/modificadores`) y una matriz exigiría una petición por
 * fila. Con doce servicios funcionaría; con el catálogo real de un salón, no.
 */
function VinculosPorServicio({
  servicios,
  modificadores,
}: {
  servicios: readonly { id: string; nombre: string }[];
  modificadores: readonly ModificadorDiseno[];
}) {
  const cliente = useQueryClient();
  const [servicioId, setServicioId] = useState('');

  const vinculados = useQuery({
    queryKey: ['admin-vinculos', servicioId],
    queryFn: () => adminApi.modificadoresDeServicio(servicioId),
    enabled: servicioId !== '',
  });

  const cambiar = useMutation({
    mutationFn: ({ modificadorId, vincular }: { modificadorId: string; vincular: boolean }) =>
      vincular ? adminApi.vincularModificador(servicioId, modificadorId) : adminApi.desvincularModificador(servicioId, modificadorId),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['admin-vinculos', servicioId] }),
  });

  const idsVinculados = new Set((vinculados.data?.modificadoresDiseno ?? []).map((modificador) => modificador.id));

  return (
    <section className="rounded-lg border border-borde bg-fondo-elevado p-4">
      <h2 className="text-sm font-semibold text-texto">Qué modificadores admite cada servicio</h2>

      <div className="mt-3 max-w-sm">
        <label htmlFor="vinculos-servicio" className="block text-xs font-medium text-texto-secundario">
          Servicio
        </label>
        <select
          id="vinculos-servicio"
          value={servicioId}
          onChange={(evento) => setServicioId(evento.target.value)}
          className={CLASES_DE_CAMPO}
        >
          <option value="">Elige uno…</option>
          {servicios.map((servicio) => (
            <option key={servicio.id} value={servicio.id}>
              {servicio.nombre}
            </option>
          ))}
        </select>
      </div>

      {servicioId === '' ? null : vinculados.isLoading ? (
        <Cargando mensaje="Cargando…" />
      ) : vinculados.isError ? (
        <AvisoDeError error={vinculados.error} className="mt-3" />
      ) : modificadores.length === 0 ? (
        <p className="mt-3 text-xs text-texto-terciario">No hay modificadores activos que vincular.</p>
      ) : (
        <ul className="mt-3 divide-y divide-borde">
          {modificadores.map((modificador) => {
            const estaVinculado = idsVinculados.has(modificador.id);
            return (
              <li key={modificador.id} className="flex items-center gap-3 py-2.5">
                <span className="text-sm text-texto">{modificador.nombre}</span>
                <span className="text-xs text-texto-terciario">
                  +{modificador.minutosAdicionales} min · +{pesos(modificador.precioAdicionalCentavos)}
                </span>
                <Boton
                  variante={estaVinculado ? 'fantasma' : 'secundario'}
                  className="ml-auto"
                  cargando={cambiar.isPending}
                  aria-label={`${estaVinculado ? 'Quitar' : 'Permitir'} ${modificador.nombre}`}
                  onClick={() => cambiar.mutate({ modificadorId: modificador.id, vincular: !estaVinculado })}
                >
                  {estaVinculado ? 'Quitar' : 'Permitir'}
                </Boton>
              </li>
            );
          })}
        </ul>
      )}

      <AvisoDeError error={cambiar.error} className="mt-3" />
    </section>
  );
}
