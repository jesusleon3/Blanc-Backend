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
};

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
