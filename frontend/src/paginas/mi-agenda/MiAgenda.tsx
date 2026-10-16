import { useSesion } from '../../auth/sesion';
import { Boton } from '../../componentes/Boton';
import { Vacio } from '../../componentes/Vacio';

/**
 * Vista de iPad de la Manicurista — **Fase 5 Parte 2**.
 *
 * Es el destino de `rutaInicialDe('MANICURISTA')`, así que la ruta tiene que existir desde ya: sin
 * ella, una manicurista que entrase acabaría en un 404 o —peor— en el panel de operación.
 *
 * ## POR QUÉ ESTA PANTALLA NO COMPARTE EL LAYOUT
 *
 * No monta `Layout`, y es deliberado: ese marco lleva los enlaces a Bandeja, Anticipos y Clientas,
 * y el contador de conversaciones escaladas. **Nada de eso debe aparecer en el iPad** (`DEC-040`):
 * el contador revelaría actividad de clientas, y los tres enlaces darían `403` en cada petición.
 * Que sea un árbol de rutas separado hace que no haya ningún `if` de rol del que depender.
 */
export function MiAgenda() {
  const { correo, cerrarSesion } = useSesion();

  return (
    <div className="min-h-screen bg-fondo-tenue">
      <header className="flex h-16 items-center gap-4 border-b border-borde bg-fondo-elevado px-5">
        <span className="text-lg font-semibold tracking-tight text-texto">
          Blanc<span className="text-acentuado">.</span>
        </span>
        <h1 className="text-sm font-medium text-texto-secundario">Mi agenda</h1>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-xs text-texto-terciario sm:block">{correo}</span>
          <Boton variante="fantasma" onClick={() => void cerrarSesion()}>
            Salir
          </Boton>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Vacio
          titulo="Tu agenda llega en la siguiente entrega"
          detalle="La vista de iPad es la Parte 2 de la Fase 5. El backend ya filtra tus citas por tu vínculo de personal y no transporta datos de las clientas."
        />
      </main>
    </div>
  );
}
