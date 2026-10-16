import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { sucursalesApi } from '../api/sucursales';
import { catalogoApi } from '../api/catalogo';
import { personalApi } from '../api/personal';
import { clientasApi } from '../api/clientas';
import type { Clienta } from '../api/contrato';
import { Boton } from './Boton';
import { Insignia } from './Insignia';
import { pesos } from './etiquetas';

/**
 * Selectores poblados con **datos reales del backend**. Cero UUIDs escritos a mano.
 *
 * ## POR QUÉ ESTO ES UN REQUISITO Y NO UNA COMODIDAD
 *
 * Hasta esta entrega, ejercitar la Agenda exigía copiar y pegar identificadores. En un mostrador
 * eso es inviable, pero el problema de fondo es otro: **un uuid tecleado o pegado mal no da un
 * error claro**. Un `servicioId` equivocado da `404`, un `manicuristaId` de otra sucursal da
 * `409`, y quien opera no tiene forma de saber que el dato estaba mal en vez de la operación.
 *
 * `staleTime` largo en los tres primeros: sucursales, servicios y manicuristas cambian en el alta
 * de personal o de catálogo, no durante un turno.
 */

const CLASES_DE_CAMPO = 'mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto';

export function useSucursales() {
  return useQuery({
    queryKey: ['sucursales'],
    queryFn: () => sucursalesApi.listar(),
    staleTime: 10 * 60_000,
  });
}

export function useServiciosActivos() {
  return useQuery({
    queryKey: ['servicios'],
    queryFn: () => catalogoApi.servicios(),
    staleTime: 10 * 60_000,
    // **Solo los activos**: ofrecer un servicio dado de baja garantiza un
    // `409 SERVICIO_INACTIVO`. El catálogo completo se queda para la pantalla de administración.
    select: (datos) => datos.servicios.filter((servicio) => servicio.activo),
  });
}

export function useManicuristasDeSucursal(sucursalId: string | undefined) {
  return useQuery({
    queryKey: ['manicuristas', sucursalId ?? 'todas'],
    queryFn: () => personalApi.manicuristas(sucursalId),
    enabled: Boolean(sucursalId),
    staleTime: 5 * 60_000,
    select: (datos) => datos.manicuristas.filter((manicurista) => manicurista.activa),
  });
}

export function SelectorDeSucursal({
  valor,
  onCambio,
  id = 'sucursal',
  etiqueta = 'Sucursal',
  incluirTodas = false,
}: {
  valor: string;
  onCambio: (valor: string) => void;
  id?: string;
  etiqueta?: string;
  incluirTodas?: boolean;
}) {
  const { data } = useSucursales();

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-texto-secundario">
        {etiqueta}
      </label>
      <select id={id} value={valor} onChange={(evento) => onCambio(evento.target.value)} className={CLASES_DE_CAMPO}>
        {incluirTodas ? <option value="">Todas</option> : <option value="">Elige una…</option>}
        {(data?.sucursales ?? []).map((sucursal) => (
          <option key={sucursal.id} value={sucursal.id}>
            {sucursal.nombre}
            {sucursal.enMantenimiento ? ' (en mantenimiento)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SelectorDeServicio({ valor, onCambio, id = 'servicio' }: { valor: string; onCambio: (valor: string) => void; id?: string }) {
  const { data } = useServiciosActivos();
  const elegido = (data ?? []).find((servicio) => servicio.id === valor);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-texto-secundario">
        Servicio
      </label>
      <select id={id} value={valor} onChange={(evento) => onCambio(evento.target.value)} className={CLASES_DE_CAMPO}>
        <option value="">Elige uno…</option>
        {(data ?? []).map((servicio) => (
          <option key={servicio.id} value={servicio.id}>
            {servicio.nombre} · {servicio.duracionBaseMinutos} min · {pesos(servicio.precioBaseCentavos)}
          </option>
        ))}
      </select>
      {elegido ? (
        <p className="mt-1 text-[11px] text-texto-terciario">
          {/* La duración se muestra porque **el backend deriva el fin de la cita de ella**, y quien
              agenda necesita saber cuánto ocupa antes de elegir la hora. */}
          Ocupa {elegido.duracionBaseMinutos} minutos.
          {elegido.requiereCotizacionManual ? ' El precio final lo fija una persona (cotización manual).' : ''}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Manicurista **de la sucursal seleccionada**, y opcional.
 *
 * Opcional porque `DEC-031` lo exige: una cita puede nacer con solo Silla Virtual asignada y
 * decidirse quién atiende **cuando la clienta llega**. Forzar la elección aquí obligaría a adivinar
 * a las 9 de la mañana quién estará libre a las 5 de la tarde.
 */
export function SelectorDeManicurista({
  sucursalId,
  valor,
  onCambio,
  id = 'manicurista',
  etiqueta = 'Manicurista (opcional)',
}: {
  sucursalId: string | undefined;
  valor: string;
  onCambio: (valor: string) => void;
  id?: string;
  etiqueta?: string;
}) {
  const { data } = useManicuristasDeSucursal(sucursalId);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-texto-secundario">
        {etiqueta}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(evento) => onCambio(evento.target.value)}
        disabled={!sucursalId}
        className={`${CLASES_DE_CAMPO} disabled:opacity-60`}
      >
        <option value="">Por asignar al llegar</option>
        {(data ?? []).map((manicurista) => (
          <option key={manicurista.id} value={manicurista.id}>
            {manicurista.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Buscador de clienta por teléfono. **Presenta la lista, siempre.**
 *
 * Mamá e hija comparten número y el backend nunca elige por nosotros: elegir sería adivinar, y la
 * equivocada decide si se pide anticipo. Quien atiende escoge.
 */
export function BuscadorDeClienta({
  seleccionada,
  onSeleccionar,
}: {
  seleccionada: Clienta | null;
  onSeleccionar: (clienta: Clienta | null) => void;
}) {
  const [telefono, setTelefono] = useState('');
  const [buscado, setBuscado] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: ['clientas', 'por-telefono', buscado],
    queryFn: () => clientasApi.buscarPorTelefono(buscado),
    enabled: buscado.length > 0,
  });

  if (seleccionada) {
    return (
      <div>
        <span className="block text-xs font-medium text-texto-secundario">Clienta</span>
        <div className="mt-1 flex items-center gap-2 rounded border border-acento-200 bg-acento-50 px-3 py-2">
          <span className="text-sm font-medium text-texto">{seleccionada.nombre}</span>
          <span className="text-xs text-texto-secundario">{seleccionada.telefono}</span>
          {seleccionada.estadoDeRiesgo === 'lista_roja' ? <Insignia tono="aviso">Lista roja</Insignia> : null}
          {seleccionada.estadoDeRiesgo === 'bloqueada' ? <Insignia tono="peligro">Bloqueada</Insignia> : null}
          <Boton variante="fantasma" className="ml-auto" onClick={() => onSeleccionar(null)}>
            Cambiar
          </Boton>
        </div>
        {seleccionada.estadoDeRiesgo === 'lista_roja' ? (
          <p className="mt-1 text-[11px] text-aviso">
            La cita nacerá <strong>en espera de pago</strong>: hace falta un anticipo del 40 % para activarla (RN-ANT-01).
          </p>
        ) : null}
        {seleccionada.estadoDeRiesgo === 'bloqueada' ? (
          <p className="mt-1 text-[11px] text-peligro">Esta clienta está bloqueada: el sistema no permitirá agendar (RN-CRM-04).</p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="clienta-telefono" className="block text-xs font-medium text-texto-secundario">
        Clienta (busca por teléfono)
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="clienta-telefono"
          inputMode="tel"
          value={telefono}
          onChange={(evento) => setTelefono(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') {
              evento.preventDefault();
              setBuscado(telefono.trim());
            }
          }}
          placeholder="10 dígitos"
          className="min-w-0 flex-1 rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto placeholder:text-texto-terciario"
        />
        <Boton variante="secundario" cargando={isFetching} disabled={telefono.trim().length === 0} onClick={() => setBuscado(telefono.trim())}>
          Buscar
        </Boton>
      </div>

      {buscado.length > 0 && !isFetching ? (
        (data?.clientas ?? []).length === 0 ? (
          <p className="mt-2 text-[11px] text-texto-terciario">Ninguna clienta con ese teléfono. Dala de alta primero en Clientas.</p>
        ) : (
          <ul className="mt-2 space-y-1" aria-label="Clientas encontradas">
            {(data?.clientas ?? []).map((clienta) => (
              <li key={clienta.id}>
                <button
                  type="button"
                  onClick={() => onSeleccionar(clienta)}
                  className="w-full rounded border border-borde bg-fondo-elevado px-3 py-2 text-left text-sm transition hover:bg-fondo-apagado"
                >
                  <span className="font-medium text-texto">{clienta.nombre}</span>
                  {clienta.estadoDeRiesgo !== 'normal' ? (
                    <span className="ml-2 text-xs text-aviso">({clienta.estadoDeRiesgo === 'lista_roja' ? 'lista roja' : 'bloqueada'})</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
