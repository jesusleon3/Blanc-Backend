import { Cita } from '../../domain/entities/cita.entity';
import { ClaimsUsuario, Rol } from '../../../../shared/auth/rol';

/**
 * Traduce una `Cita` a la forma expuesta por la API, **según quién pregunta**.
 *
 * La vista de la **Manicurista (iPad)** es distinta, y no por comodidad:
 *
 * - **SÍ ve precios** (`cotizacionSnapshot`): la Dueña lo confirmó explícitamente — *"ve precios"*.
 * - **NUNCA ve nada de lista roja**, también literal: *"no lista roja"*. **Ese día ya llegó**: CRM
 *   existe desde Fase 3 y `ConsultarAgendaUseCase` resuelve el indicador para los demás roles.
 *   Que esta función se escribiera con dos formas separadas *antes* de que hubiera algo que
 *   filtrar es lo que hace que añadirlo ahora sea seguro: `enListaRoja` entra en el objeto que la
 *   `MANICURISTA` no recibe, no en el `base` que sí recibe.
 * - **No ve `clientaId`**: no lo necesita para trabajar, y es el identificador por el que se
 *   consultaría el historial y la clasificación de la clienta.
 * - **SÍ ve `clientaNombre`** (añadido en Fase 5 Parte 2, para la vista de iPad). Va a atender
 *   físicamente a esa persona: saber a quién recibe es parte de su trabajo, y ocultárselo no
 *   protege nada. Lo que `DEC-040` protege es la **clasificación de riesgo**, no la identidad.
 *   El nombre llega por `ContextoClientaPort.obtenerNombres`, cuyo `Map<string, string>` **no
 *   puede** transportar el estado de riesgo — así la garantía no depende de que este presenter
 *   filtre bien, sino de que el dato no exista en la petición.
 */
export function citaAJson(
  cita: Cita,
  actor: ClaimsUsuario,
  datosDeClienta: { enListaRoja?: boolean; clientaNombre?: string } = {},
) {
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
    // `undefined` si no se resolvió (p. ej. la respuesta de agendar, que devuelve una cita suelta),
    // que es distinto de "esta clienta no tiene nombre".
    clientaNombre: datosDeClienta.clientaNombre,
  };

  // La salida temprana es la barrera: todo lo que se añada debajo es, por construcción, invisible
  // para el iPad. Añadir un campo al objeto `base` de arriba sí exigiría pensar.
  if (actor.rol === Rol.MANICURISTA) return base;

  return {
    ...base,
    clientaId: cita.clientaId,
    citaOrigenId: cita.citaOrigenId,
    numeroDeReprogramaciones: cita.numeroDeReprogramaciones,
    /**
     * `RN-CRM-03`/`RN-ANT-01` — para quien atiende el mostrador: esta clienta exige anticipo.
     *
     * `undefined` cuando no se resolvió (una cita suelta, no la agenda del día), que es distinto
     * de `false`. No se normaliza a `false` a propósito: decirle a la Encargada "no está en lista
     * roja" cuando en realidad no se consultó sería peor que no decirle nada.
     */
    enListaRoja: datosDeClienta.enListaRoja,
  };
}
