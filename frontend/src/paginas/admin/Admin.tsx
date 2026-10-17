import { useSearchParams } from 'react-router-dom';
import { CatalogoAdmin } from './componentes/CatalogoAdmin';
import { ModificadoresAdmin } from './componentes/ModificadoresAdmin';
import { SucursalesYSillas } from './componentes/SucursalesYSillas';
import { PersonalAdmin } from './componentes/PersonalAdmin';

type Pestana = 'catalogo' | 'modificadores' | 'sucursales' | 'personal';

const PESTANAS: { valor: Pestana; texto: string }[] = [
  { valor: 'catalogo', texto: 'Catálogo y tiempos' },
  { valor: 'modificadores', texto: 'Modificadores de diseño' },
  { valor: 'sucursales', texto: 'Sucursales y sillas' },
  { valor: 'personal', texto: 'Personal' },
];

/**
 * Backoffice Administrativo.
 *
 * ## QUÉ SE CONFIGURA AQUÍ Y POR QUÉ ESTÁ SEPARADO DE LA OPERACIÓN
 *
 * Todo lo de esta pantalla son **parámetros de los que el resto del sistema deduce sus decisiones**:
 * cuánto dura un servicio (y por tanto cuándo termina una cita), cuánto cuesta (y por tanto cuánto
 * se cobra y cuánto es el 40 % del anticipo), cuántas sillas hay (y por tanto cuántas citas
 * simultáneas se venden) y quién atiende en cada sucursal.
 *
 * Esa es la diferencia con la Agenda: allí se trabaja *dentro* de las reglas; aquí se cambian los
 * números de los que las reglas salen. Un error aquí no da un mensaje de error — da citas que no
 * caben, cobros equivocados o huecos que no existen, y se descubre en el mostrador.
 *
 * Por eso vive en `ROLES_DE_ADMINISTRACION` y no en `ROLES_DE_OPERACION`: la Encargada opera el
 * día, pero los precios y la capacidad son de la Dueña. Como siempre (`ADR-027`, regla 1), esto
 * solo decide qué se dibuja: cada endpoint revalida su `@Roles` y responde `403` a quien navegue a
 * mano.
 */
export function Admin() {
  const [parametros, setParametros] = useSearchParams();
  const pestana = PESTANAS.find((candidata) => candidata.valor === parametros.get('vista'))?.valor ?? 'catalogo';

  const cambiar = (valor: Pestana) => {
    const siguiente = new URLSearchParams(parametros);
    siguiente.set('vista', valor);
    setParametros(siguiente, { replace: true });
  };

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-texto">Configuración</h1>
        <p className="mt-1 text-sm text-texto-secundario">
          Precios, duraciones, capacidad y personal. Lo que se cambia aquí afecta a cómo se agenda y se cobra.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-1 rounded bg-fondo-apagado p-0.5" role="tablist" aria-label="Secciones de configuración">
        {PESTANAS.map((candidata) => (
          <button
            key={candidata.valor}
            type="button"
            role="tab"
            aria-selected={pestana === candidata.valor}
            onClick={() => cambiar(candidata.valor)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              pestana === candidata.valor ? 'bg-fondo-elevado text-texto shadow-sm' : 'text-texto-secundario hover:text-texto'
            }`}
          >
            {candidata.texto}
          </button>
        ))}
      </div>

      {pestana === 'catalogo' ? <CatalogoAdmin /> : null}
      {pestana === 'modificadores' ? <ModificadoresAdmin /> : null}
      {pestana === 'sucursales' ? <SucursalesYSillas /> : null}
      {pestana === 'personal' ? <PersonalAdmin /> : null}
    </div>
  );
}
