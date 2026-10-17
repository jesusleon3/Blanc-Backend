import { useState } from 'react';
import type { Cita, EstadoCita, ResultadoDeCancelacion } from '../../../api/contrato';
import { agendaApi } from '../../../api/agenda';
import { ErrorDeApi } from '../../../api/cliente';
import { Boton } from '../../../componentes/Boton';
import { AvisoDeError } from '../../../componentes/AvisoDeError';
import { SelectorDeManicurista } from '../../../componentes/selectores';
import { fechaLocalDeHoy, instanteDesdeHoraLocal, pesosOSinCotizar } from '../../../componentes/etiquetas';
import { DialogoDeGarantia } from './AgendarGarantia';

/**
 * Qué transiciones ofrece cada estado. **Copiado de `TRANSICIONES_LEGALES` del backend.**
 *
 * Es una copia deliberada, igual que las uniones de literales del contrato: ofrecer un botón que
 * el backend va a rechazar con `409 TRANSICION_ILEGAL` es peor que no ofrecerlo, porque invita a
 * intentarlo. **La autoridad sigue siendo el backend** — esta tabla solo decide qué se dibuja
 * (`ADR-027`, regla 1), y si divergiera, el `409` sigue protegiendo el invariante.
 *
 * `completada → no_show` está incluido a propósito: es la corrección administrativa de `N-02`
 * (*"la clienta no llegó pero alguien marcó atendida por error"*), no un descuido.
 */
const ACCIONES_POR_ESTADO: Record<EstadoCita, readonly ('solicitar' | 'confirmar' | 'completar' | 'no_show' | 'cancelar' | 'reprogramar')[]> = {
  en_espera_pago: ['cancelar'],
  agendada: ['solicitar', 'confirmar', 'completar', 'no_show', 'cancelar', 'reprogramar'],
  pendiente_confirmacion: ['confirmar', 'completar', 'no_show', 'cancelar', 'reprogramar'],
  confirmada: ['completar', 'no_show', 'cancelar', 'reprogramar'],
  completada: ['no_show'],
  no_show: [],
  cancelada: [],
  reprogramada: [],
  expirada: [],
};

const TEXTO_DE_ACCION = {
  solicitar: 'Pedir confirmación',
  confirmar: 'Confirmar',
  completar: 'Marcar atendida',
  no_show: 'No llegó',
  cancelar: 'Cancelar',
  reprogramar: 'Reprogramar',
} as const;

type Dialogo = 'cancelar' | 'reprogramar' | 'asignar' | 'garantia' | null;

/**
 * ¿Se puede agendar una garantía sobre esta cita (`RN-GAR-01`/`RN-GAR-02`)?
 *
 * Las dos condiciones que el cliente **sí** puede comprobar sin consultar nada: la cita se
 * completó, y no es ella misma una garantía. La tercera —que la ventana de días siga abierta— la
 * decide el backend, que es el único que conoce `DIAS_DE_GARANTIA` y la hora real; se ofrece el
 * botón y el `409 GARANTIA_VENCIDA` explica cuántos días han pasado.
 *
 * **No se calcula la ventana aquí a propósito.** Hacerlo escondería el botón con el reloj del
 * navegador, y a quien atiende el mostrador le parecería que la función no existe en vez de leer
 * que la garantía venció y que una excepción la decide la Dueña.
 */
const admiteGarantia = (cita: Cita): boolean => cita.estado === 'completada' && !cita.esGarantia;

export function AccionesDeCita({ cita, onCambio }: { cita: Cita; onCambio: () => Promise<void> | void }) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [error, setError] = useState<unknown>(null);
  const [pendiente, setPendiente] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDeCancelacion | null>(null);

  const acciones = ACCIONES_POR_ESTADO[cita.estado];

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setError(null);
    setPendiente(true);
    try {
      await accion();
      await onCambio();
      setDialogo(null);
      return true;
    } catch (fallo) {
      setError(fallo);
      return false;
    } finally {
      setPendiente(false);
    }
  };

  const simples: Record<'solicitar' | 'confirmar' | 'completar' | 'no_show', () => Promise<unknown>> = {
    solicitar: () => agendaApi.solicitarConfirmacion(cita.id),
    confirmar: () => agendaApi.confirmar(cita.id),
    completar: () => agendaApi.completar(cita.id),
    no_show: () => agendaApi.marcarNoShow(cita.id),
  };

  if (resultado) {
    return <ResumenDeCancelacion resultado={resultado} onCerrar={() => setResultado(null)} />;
  }

  return (
    <div>
      {dialogo === null ? (
        <div className="flex flex-wrap gap-1.5">
          {/* Asignar manicurista va primero cuando falta: es la acción del momento en que la
              clienta llega y su cita solo tenía Silla Virtual (`DEC-031`). */}
          {cita.manicuristaId === null && acciones.length > 0 ? (
            <Boton onClick={() => setDialogo('asignar')}>Asignar manicurista</Boton>
          ) : null}

          {acciones.map((accion) =>
            accion === 'cancelar' || accion === 'reprogramar' ? (
              <Boton key={accion} variante={accion === 'cancelar' ? 'peligro' : 'secundario'} onClick={() => setDialogo(accion)}>
                {TEXTO_DE_ACCION[accion]}
              </Boton>
            ) : (
              <Boton
                key={accion}
                variante={accion === 'no_show' ? 'peligro' : 'secundario'}
                cargando={pendiente}
                onClick={() => void ejecutar(simples[accion])}
              >
                {TEXTO_DE_ACCION[accion]}
              </Boton>
            ),
          )}

          {admiteGarantia(cita) ? (
            <Boton variante="secundario" onClick={() => setDialogo('garantia')}>
              Agendar garantía
            </Boton>
          ) : null}

          {acciones.length === 0 && cita.manicuristaId !== null && !admiteGarantia(cita) ? (
            <p className="text-[11px] text-texto-terciario">Esta cita ya está cerrada: no admite más cambios.</p>
          ) : null}
        </div>
      ) : null}

      {dialogo === 'garantia' ? (
        <DialogoDeGarantia cita={cita} onCerrar={() => setDialogo(null)} onCambio={onCambio} />
      ) : null}

      {dialogo === 'asignar' ? (
        <DialogoDeAsignacion cita={cita} pendiente={pendiente} onCancelar={() => setDialogo(null)} onAsignar={(id) => ejecutar(() => agendaApi.asignarManicurista(cita.id, id))} />
      ) : null}

      {dialogo === 'cancelar' ? (
        <DialogoDeCancelacion
          cita={cita}
          pendiente={pendiente}
          error={error}
          onCancelar={() => {
            setDialogo(null);
            setError(null);
          }}
          onConfirmar={async (datos) => {
            setError(null);
            setPendiente(true);
            try {
              const respuesta = await agendaApi.cancelar(cita.id, datos);
              await onCambio();
              setDialogo(null);
              // El resumen se muestra SIEMPRE, aunque no haya daño: "no se generó incidente" es
              // información que quien canceló necesita para poder decírselo a la clienta.
              setResultado(respuesta);
            } catch (fallo) {
              setError(fallo);
            } finally {
              setPendiente(false);
            }
          }}
        />
      ) : null}

      {dialogo === 'reprogramar' ? (
        <DialogoDeReprogramacion
          cita={cita}
          pendiente={pendiente}
          onCancelar={() => {
            setDialogo(null);
            setError(null);
          }}
          onConfirmar={(datos) => ejecutar(() => agendaApi.reprogramar(cita.id, datos))}
        />
      ) : null}

      {dialogo !== 'cancelar' ? <AvisoDeError error={error} className="mt-2" /> : null}
    </div>
  );
}

function DialogoDeAsignacion({
  cita,
  pendiente,
  onCancelar,
  onAsignar,
}: {
  cita: Cita;
  pendiente: boolean;
  onCancelar: () => void;
  onAsignar: (manicuristaId: string) => Promise<boolean>;
}) {
  const [manicuristaId, setManicuristaId] = useState('');

  return (
    <div className="rounded border border-borde-fuerte bg-fondo-apagado p-3">
      <SelectorDeManicurista
        sucursalId={cita.sucursalId}
        valor={manicuristaId}
        onCambio={setManicuristaId}
        id={`asignar-${cita.id}`}
        etiqueta="¿Quién la atiende?"
      />
      {/* El selector solo ofrece manicuristas DE ESTA SUCURSAL. Aun así el backend revalida, y
          puede responder `409 MANICURISTA_OCUPADA` si ya tiene otra cita a esa hora. */}
      <div className="mt-3 flex gap-2">
        <Boton cargando={pendiente} disabled={manicuristaId === ''} onClick={() => void onAsignar(manicuristaId)}>
          Asignar
        </Boton>
        <Boton variante="fantasma" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </div>
  );
}

/**
 * Cancelar, con la **confirmación consciente** de `RN-CRM-03`/`RN-ANT-04`.
 *
 * ## POR QUÉ NO SE MANDA `confirmacionDeEmpleado: true` DESDE EL PRINCIPIO
 *
 * Sería más corto y sería un error. El backend responde `409 CANCELACION_REQUIERE_CONFIRMACION`
 * cuando la clienta está en lista roja o hay anticipo pagado, y **ese rechazo es el que dispara
 * esta advertencia**. Enviar la confirmación por adelantado convertiría una barrera deliberada en
 * un trámite invisible: alguien cancelaría la cita de una clienta que pagó, sin enterarse de que
 * su dinero no se devuelve, y la clienta lo descubriría después.
 *
 * El flujo es: cancelar → `409` → se explica qué implica → la persona decide → reintento con la
 * confirmación.
 */
function DialogoDeCancelacion({
  cita,
  pendiente,
  error,
  onCancelar,
  onConfirmar,
}: {
  cita: Cita;
  pendiente: boolean;
  error: unknown;
  onCancelar: () => void;
  onConfirmar: (datos: { motivo?: string; confirmacionDeEmpleado?: boolean }) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');

  // El `409` del backend es lo que decide si hay que advertir, no una deducción del cliente.
  const exigeConfirmacion = error instanceof ErrorDeApi && error.es('CANCELACION_REQUIERE_CONFIRMACION');

  return (
    <div className="rounded border border-peligro/30 bg-peligro-suave p-3">
      <label htmlFor={`motivo-${cita.id}`} className="block text-xs font-medium text-peligro">
        Motivo de la cancelación
      </label>
      <input
        id={`motivo-${cita.id}`}
        value={motivo}
        onChange={(evento) => setMotivo(evento.target.value)}
        placeholder="Qué dijo la clienta"
        className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto placeholder:text-texto-terciario"
      />

      {exigeConfirmacion ? (
        <div className="mt-3 rounded border border-peligro bg-fondo-elevado p-3">
          <p className="text-sm font-semibold text-peligro">Esta cancelación tiene consecuencias para la clienta</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-texto">
            <li>
              Si pagó anticipo, <strong>queda retenido y no se reembolsa</strong> (RN-ANT-04).
            </li>
            <li>Si es a menos de 60 minutos del inicio, se registra como incidente en su historial (RN-CRM-06).</li>
          </ul>
          <p className="mt-2 text-xs text-texto-secundario">Confírmalo solo si se lo vas a explicar a la clienta.</p>
          <div className="mt-3 flex gap-2">
            <Boton
              variante="peligro"
              cargando={pendiente}
              onClick={() => void onConfirmar({ ...(motivo.trim() ? { motivo: motivo.trim() } : {}), confirmacionDeEmpleado: true })}
            >
              Sí, cancelar de todas formas
            </Boton>
            <Boton variante="fantasma" onClick={onCancelar}>
              No cancelar
            </Boton>
          </div>
        </div>
      ) : (
        <>
          <AvisoDeError error={error} className="mt-3" />
          <div className="mt-3 flex gap-2">
            <Boton variante="peligro" cargando={pendiente} onClick={() => void onConfirmar(motivo.trim() ? { motivo: motivo.trim() } : {})}>
              Cancelar la cita
            </Boton>
            <Boton variante="fantasma" onClick={onCancelar}>
              Volver
            </Boton>
          </div>
        </>
      )}
    </div>
  );
}

/** Qué pasó al cancelar. Se muestra siempre: "no hubo incidente" también es información. */
function ResumenDeCancelacion({ resultado, onCerrar }: { resultado: ResultadoDeCancelacion; onCerrar: () => void }) {
  const hueco = resultado.listaEspera;

  return (
    <div role="status" className="rounded border border-borde-fuerte bg-fondo-apagado p-3">
      <p className="text-sm font-medium text-texto">Cita cancelada</p>
      <ul className="mt-2 space-y-1 text-xs text-texto-secundario">
        <li>
          {resultado.incidenteTardio
            ? '⚠️ Canceló con menos de 60 minutos: queda registrado como incidente en su historial.'
            : 'Canceló con tiempo: no se registró incidente.'}
        </li>
        {resultado.anticipoRetenido ? (
          <li className="font-medium text-peligro">⚠️ Su anticipo queda retenido y no se reembolsa. Hay que decírselo.</li>
        ) : null}
        {hueco === null ? (
          <li>La lista de espera no se pudo procesar ahora; el planificador la recogerá en el siguiente barrido.</li>
        ) : hueco.huecoPerdidoCortoPlazo ? (
          <li className="text-aviso">
            El hueco se liberó a menos de 30 minutos, así que <strong>no se avisó a nadie</strong> de la lista de espera. Si puedes
            llenarlo a mano, es capacidad que se recupera.
          </li>
        ) : hueco.ofrecidaA ? (
          <li className="text-exito">Se le ofreció el hueco a alguien de la lista de espera. Revisa la pestaña de Lista de espera.</li>
        ) : (
          <li>No había nadie en la lista de espera para ese hueco.</li>
        )}
        {hueco && hueco.descartadasPorNoCaber > 0 ? (
          <li>
            {hueco.descartadasPorNoCaber} de la fila se saltaron porque su servicio no cabía en el hueco.
          </li>
        ) : null}
      </ul>
      <Boton variante="secundario" className="mt-3" onClick={onCerrar}>
        Entendido
      </Boton>
    </div>
  );
}

/** Reprogramar. Los errores de negocio los explica `AvisoDeError` por su código. */
function DialogoDeReprogramacion({
  cita,
  pendiente,
  onCancelar,
  onConfirmar,
}: {
  cita: Cita;
  pendiente: boolean;
  onCancelar: () => void;
  onConfirmar: (datos: { inicio: string; manicuristaId?: string; confirmacionDeEmpleado?: boolean }) => Promise<boolean>;
}) {
  const [fecha, setFecha] = useState(fechaLocalDeHoy());
  const [hora, setHora] = useState('10:00');
  const [manicuristaId, setManicuristaId] = useState('');

  return (
    <div className="rounded border border-borde-fuerte bg-fondo-apagado p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`fecha-${cita.id}`} className="block text-xs font-medium text-texto-secundario">
            Nueva fecha
          </label>
          <input
            id={`fecha-${cita.id}`}
            type="date"
            value={fecha}
            onChange={(evento) => setFecha(evento.target.value)}
            className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
          />
        </div>
        <div>
          <label htmlFor={`hora-${cita.id}`} className="block text-xs font-medium text-texto-secundario">
            Nueva hora
          </label>
          <input
            id={`hora-${cita.id}`}
            type="time"
            value={hora}
            onChange={(evento) => setHora(evento.target.value)}
            className="mt-1 w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-texto"
          />
        </div>
        <SelectorDeManicurista sucursalId={cita.sucursalId} valor={manicuristaId} onCambio={setManicuristaId} id={`repro-mani-${cita.id}`} />
      </div>

      {/* El tope de 3 (`DEC-042`) se avisa ANTES de intentarlo cuando ya se sabe: el dato viene en
          la cita. El backend igualmente lo rechaza, pero gastar el intento no aporta nada. */}
      {cita.numeroDeReprogramaciones !== undefined && cita.numeroDeReprogramaciones >= 3 ? (
        <p className="mt-2 text-xs text-peligro">
          Esta cita ya se reprogramó {cita.numeroDeReprogramaciones} veces: el límite es 3 (DEC-042). El sistema la rechazará.
        </p>
      ) : cita.numeroDeReprogramaciones !== undefined && cita.numeroDeReprogramaciones > 0 ? (
        <p className="mt-2 text-xs text-texto-terciario">Reprogramada {cita.numeroDeReprogramaciones} de 3 veces permitidas.</p>
      ) : null}

      {cita.cotizacionSnapshot ? (
        <p className="mt-2 text-[11px] text-texto-terciario">
          El precio ({pesosOSinCotizar(cita.cotizacionSnapshot.totalCentavos)}) se conserva: reprogramar no recotiza.
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Boton
          cargando={pendiente}
          onClick={() =>
            void onConfirmar({
              inicio: instanteDesdeHoraLocal(fecha, hora),
              ...(manicuristaId ? { manicuristaId } : {}),
              // La ventana de 48 h con anticipo pagado (`RN-ANT-04`) también exige confirmación
              // consciente. Aquí se manda porque quien reprograma ya eligió fecha y hora nuevas:
              // la advertencia de que el anticipo se pierde pertenece a cancelar, no a mover.
              confirmacionDeEmpleado: true,
            })
          }
        >
          Reprogramar
        </Boton>
        <Boton variante="fantasma" onClick={onCancelar}>
          Volver
        </Boton>
      </div>
    </div>
  );
}
