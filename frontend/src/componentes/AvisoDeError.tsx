import { ErrorDeApi } from '../api/cliente';

/**
 * Traduce un error a algo que quien opera pueda usar.
 *
 * ## EL CASO QUE JUSTIFICA ESTE COMPONENTE
 *
 * `409 HORARIO_NO_DISPONIBLE` al confirmar un anticipo **no es un error del sistema**: significa
 * que otra clienta tomó el último hueco mientras llegaba la transferencia (`RN-ANT-03`). El pago
 * **no quedó confirmado** y hay que decidir qué hacer con ese dinero — que es una conversación con
 * la clienta, no un botón. Mostrar *"Error 409: Conflict"* dejaría a la Encargada sin saber qué
 * pasó ni qué hacer, y el dinero ya está transferido.
 *
 * `ADR-013` existe precisamente para esto: errores con código de negocio para que el cliente
 * pueda reaccionar distinto. Ramificar por el **texto** del mensaje se rompería la primera vez que
 * alguien mejore una redacción; se ramifica por `code`.
 */
const EXPLICACIONES: Record<string, string> = {
  HORARIO_NO_DISPONIBLE:
    'Otra clienta tomó ese lugar mientras llegaba la transferencia. El anticipo NO quedó confirmado y la cita sigue sin activarse: hay que hablar con la clienta para reagendar o devolverle el dinero.',
  SILLA_OCUPADA: 'Ya no hay lugar a esa hora en la sucursal. El anticipo no se confirmó.',
  VENTANA_24H_CERRADA: 'Pasaron más de 24 horas desde el último mensaje de la clienta. Para escribirle hay que usar una plantilla aprobada.',
  CLIENTA_BLOQUEADA: 'Esta clienta está bloqueada y no puede agendar.',
  SUCURSAL_SIN_NUMERO_DE_WHATSAPP: 'Esta sucursal todavía no tiene número de WhatsApp dado de alta, así que no se puede enviar nada.',
  ANTICIPO_NO_PENDIENTE: 'Ese anticipo ya no está esperando pago: alguien lo confirmó o lo expiró antes.',
  NO_AUTENTICADO: 'La sesión expiró. Vuelve a iniciar sesión.',
  /**
   * Baja de personal con citas futuras. **Se amplía el mensaje del dominio, no se repite**: el del
   * backend dice qué hacer ("reasígnalas o cancélalas"), y aquí se añade la consecuencia de no
   * hacerlo, que es el motivo por el que la baja se bloquea en vez de avisar y seguir.
   */
  MANICURISTA_CON_CITAS_ACTIVAS:
    'Esta manicurista tiene citas futuras asignadas. Darla de baja las dejaría sin nadie que las atienda y nadie se enteraría hasta que la clienta llegara: primero reasígnalas o cancélalas en la Agenda.',
};

/**
 * Códigos cuyo mensaje del backend se muestra **tal cual**, y la razón de que estén listados.
 *
 * Los cuatro errores de garantía (`GARANTIA_VENCIDA`, `GARANTIA_SOBRE_CITA_NO_COMPLETADA`,
 * `GARANTIA_YA_OTORGADA`, `GARANTIA_SOBRE_UNA_GARANTIA`) traen **datos reales en el texto** —
 * cuántos días cubre la garantía, cuántos han pasado, en qué estado está la cita— que una
 * explicación fija de este archivo no podría incluir. Copiarlos aquí con otras palabras los
 * empobrecería y además divergiría del dominio en la primera edición.
 *
 * Esta lista no es código: es la nota de por qué no hay entradas para ellos arriba.
 */


export function AvisoDeError({ error, className = '' }: { error: unknown; className?: string }) {
  if (!error) return null;

  const esDeApi = error instanceof ErrorDeApi;
  const codigo = esDeApi ? error.codigo : null;
  const explicacion = codigo ? EXPLICACIONES[codigo] : undefined;
  const mensaje = explicacion ?? (error instanceof Error ? error.message : 'Ocurrió un error inesperado.');

  // `403` se nombra aparte: es la señal de que la interfaz mostró algo que el backend no permite, y
  // quien opera necesita saber que no es un fallo suyo.
  const esPermisos = esDeApi && error.estado === 403;

  return (
    <div role="alert" className={`rounded border border-peligro/30 bg-peligro-suave px-3.5 py-3 text-sm text-peligro ${className}`}>
      <p className="font-medium">{esPermisos ? 'No tienes permiso para hacer esto.' : mensaje}</p>
      {esPermisos ? <p className="mt-1 text-xs opacity-80">Si crees que deberías poder, pídeselo a la Dueña.</p> : null}
      {codigo && !explicacion && !esPermisos ? <p className="mt-1 font-mono text-xs opacity-70">{codigo}</p> : null}
    </div>
  );
}
