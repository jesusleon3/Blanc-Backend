import { Cita } from '../../domain/entities/cita.entity';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';

/**
 * Traduce una `Cita` a la forma expuesta por la API, **según quién pregunta**.
 *
 * La vista de la **Manicurista (iPad)** es distinta, y no por comodidad:
 *
 * - **SÍ ve precios** (`cotizacionSnapshot`): la Dueña lo confirmó explícitamente — *"ve precios"*.
 * - **NUNCA ve nada de lista roja**, también literal: *"no lista roja"*. Hoy la cita no transporta
 *   ese dato, pero el día que el Bounded Context de CRM exista **va a ser tentador adjuntarlo** a
 *   la respuesta de la agenda. Por eso esta función existe ya con dos formas separadas: el filtro
 *   tiene que estar escrito antes de que haya algo que filtrar, o se colará sin que nadie lo note.
 * - **No ve `clientaId`**: no lo necesita para trabajar, y es el identificador por el que se
 *   consultaría el historial y la clasificación de la clienta.
 */
export function citaAJson(cita: Cita, actor: ClaimsUsuario) {
  const base = {
    id: cita.id,
    sucursalId: cita.sucursalId,
    sillaId: cita.sillaId,
    manicuristaId: cita.manicuristaId,
    servicioId: cita.servicioId,
    inicio: cita.rangoHorario.inicio.toISOString(),
    fin: cita.rangoHorario.fin.toISOString(),
    estado: cita.estado,
    cotizacionSnapshot: cita.cotizacionSnapshot,
  };

  if (actor.rol === Rol.MANICURISTA) return base;

  return {
    ...base,
    clientaId: cita.clientaId,
    citaOrigenId: cita.citaOrigenId,
    numeroDeReprogramaciones: cita.numeroDeReprogramaciones,
  };
}
