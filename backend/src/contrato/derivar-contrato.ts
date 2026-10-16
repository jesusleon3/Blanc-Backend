import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { ROLES_KEY } from '../shared/auth/roles.decorator';

/**
 * Deriva el contrato de la API **del código real**, no de una lista escrita a mano.
 *
 * ## QUÉ PROBLEMA RESUELVE (`P8`)
 *
 * `ADR-027` dejó registrada una deuda explícita: *"los tipos del contrato están duplicados a mano,
 * backend y frontend… el riesgo es deriva silenciosa"*. Y es silenciosa de verdad: si un presenter
 * del backend deja de devolver un campo, el frontend compila igual, las pruebas de ambos pasan
 * igual, y el síntoma aparece en producción como un dato que no se pinta.
 *
 * La cadena de verificación tiene tres eslabones y ninguno confía en la disciplina:
 *
 * 1. **Aquí** se deriva el contrato invocando los presenters y leyendo los metadatos de Nest.
 * 2. `contrato-de-api.spec.ts` lo compara contra un **archivo versionado** (`contratos/api-v1.json`).
 *    Cualquier cambio de ruta, de rol o de campo falla hasta que alguien regenera el archivo
 *    **deliberadamente** — y entonces el cambio queda en el diff de un commit, no inadvertido.
 * 3. El frontend lee **ese mismo archivo** y lo compara contra sus tipos (`contrato.spec.ts`).
 *
 * El resultado es que un campo que desaparezca del backend rompe el build del frontend.
 */

export type MetodoHttp = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RutaDelContrato {
  metodo: MetodoHttp;
  /** Ruta completa, con el prefijo del controlador. */
  ruta: string;
  /**
   * Roles declarados con `@Roles`. **`null` significa "sin decorador"**, que NO es lo mismo que
   * una lista vacía: sin decorador, `RolesGuard` deja pasar a cualquier autenticado. Distinguirlo
   * es el punto — una ruta nueva sin `@Roles` es el descuido de seguridad más fácil de cometer, y
   * así aparece en el diff del contrato.
   */
  roles: string[] | null;
}

const NOMBRE_DE_METODO: Partial<Record<RequestMethod, MetodoHttp>> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
};

/** Normaliza `v1/agenda` + `:id/cancelar` → `/v1/agenda/:id/cancelar`. */
function unir(base: string, sufijo: string): string {
  const partes = [base, sufijo].filter((parte) => parte !== '' && parte !== '/');
  return `/${partes.join('/')}`.replace(/\/+/g, '/');
}

/**
 * Lee las rutas de un controlador **de los metadatos de Nest**, no del enrutador de Express.
 *
 * Se eligió así porque los internos del enrutador de Express (`_router.stack`) no son API pública
 * y cambian entre versiones; `PATH_METADATA` y `METHOD_METADATA` son las constantes que Nest
 * expone y usa su propio explorador de rutas.
 */
export function rutasDeControlador(controlador: new (...args: never[]) => unknown): RutaDelContrato[] {
  const base = (Reflect.getMetadata(PATH_METADATA, controlador) as string | undefined) ?? '';
  const prototipo = controlador.prototype as Record<string, unknown>;

  return Object.getOwnPropertyNames(prototipo)
    .filter((nombre) => nombre !== 'constructor' && typeof prototipo[nombre] === 'function')
    .flatMap((nombre) => {
      const manejador = prototipo[nombre] as (...args: never[]) => unknown;
      const metodoCrudo = Reflect.getMetadata(METHOD_METADATA, manejador) as RequestMethod | undefined;
      if (metodoCrudo === undefined) return [];

      const metodo = NOMBRE_DE_METODO[metodoCrudo];
      if (!metodo) return [];

      const sufijo = (Reflect.getMetadata(PATH_METADATA, manejador) as string | undefined) ?? '';
      // El decorador puede estar en el método o en la clase; se mira el método primero porque el
      // proyecto exige declararlo por método (`@Roles` por clase no se usa).
      const rolesDelMetodo = Reflect.getMetadata(ROLES_KEY, manejador) as string[] | undefined;
      const rolesDeLaClase = Reflect.getMetadata(ROLES_KEY, controlador) as string[] | undefined;
      const roles = rolesDelMetodo ?? rolesDeLaClase ?? null;

      return [{ metodo, ruta: unir(base, sufijo), roles: roles ? [...roles].sort() : null }];
    });
}

/** Orden estable: el contrato se compara como texto, así que no puede depender del orden de carga. */
export function ordenarRutas(rutas: RutaDelContrato[]): RutaDelContrato[] {
  return [...rutas].sort((a, b) => (a.ruta === b.ruta ? a.metodo.localeCompare(b.metodo) : a.ruta.localeCompare(b.ruta)));
}

/**
 * Claves de un objeto de respuesta, **ordenadas y sin las que valen `undefined`**.
 *
 * Omitir las `undefined` no es un atajo: es exactamente lo que `JSON.stringify` hace al serializar,
 * así que esto refleja lo que el cliente **recibe de verdad**. La vista de iPad depende de ello —
 * `clientaId` y `enListaRoja` no le llegan, y el contrato tiene que decir eso y no "llegan vacíos".
 */
export function clavesDeRespuesta(objeto: Record<string, unknown>): string[] {
  return Object.keys(objeto)
    .filter((clave) => objeto[clave] !== undefined)
    .sort();
}
