import { Vacio } from '../../componentes/Vacio';

/**
 * Marcador de la Agenda Operativa de mostrador — **Fase 5 Parte 2**.
 *
 * La ruta existe ya para que el enlace del encabezado no lleve a un 404 y para fijar su sitio en el
 * mapa de navegación. Lo que falta es la pantalla, no el backend: Agenda, Sillas, Lista de Espera y
 * Excepciones de Personal están construidos, probados y con su API HTTP.
 */
export function AgendaPendiente() {
  return (
    <div>
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-texto">Agenda</h1>
        <p className="mt-1 text-sm text-texto-secundario">Agenda operativa de mostrador.</p>
      </header>
      <Vacio
        titulo="Esta pantalla llega en la siguiente entrega"
        detalle="La Agenda Operativa (sillas, walk-ins, asignación de manicurista, cancelar y reprogramar, ausencias y coberturas, y lista de espera) es la Parte 2 de la Fase 5. El backend ya está construido y probado."
      />
    </div>
  );
}
