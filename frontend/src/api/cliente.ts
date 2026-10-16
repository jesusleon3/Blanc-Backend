import type { CuerpoDeError } from './contrato';

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

/**
 * Error de la API con su **código de negocio** accesible.
 *
 * ## POR QUÉ NO BASTA EL CÓDIGO HTTP
 *
 * `ADR-013` exige errores semánticos *"para que el frontend pueda reaccionar distinto a 'no hay
 * disponibilidad' vs. 'clienta bloqueada' vs. 'error interno'"*. El caso que lo hace obligatorio
 * en esta entrega: al confirmar un anticipo, un `409 HORARIO_NO_DISPONIBLE` significa que **otra
 * clienta ganó el cupo mientras llegaba la transferencia** (`RN-ANT-03`) y hay que decirle a la
 * Encargada exactamente eso — no *"hubo un conflicto"*. Cualquier otro `409` es otra cosa.
 *
 * El texto del mensaje **no** se usa para ramificar: es para mostrar. Ramificar por texto se rompe
 * la primera vez que alguien mejora una redacción.
 */
export class ErrorDeApi extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    mensaje: string,
    readonly categoria: CuerpoDeError['error']['category'] = 'unexpected',
    readonly detalles?: Record<string, unknown>,
  ) {
    super(mensaje);
    this.name = 'ErrorDeApi';
  }

  /** `true` si el código coincide, para leer `if (error.es('HORARIO_NO_DISPONIBLE'))`. */
  es(codigo: string): boolean {
    return this.codigo === codigo;
  }
}

/** Devuelve el token actual. Lo inyecta la capa de sesión para no acoplar este módulo a Supabase. */
type ProveedorDeToken = () => string | null;

let obtenerToken: ProveedorDeToken = () => null;
let alPerderSesion: () => void = () => {};

/**
 * Conecta el cliente HTTP con la sesión.
 *
 * Se inyecta en vez de importar el cliente de Supabase aquí por dos razones: este módulo queda
 * probable sin montar Supabase, y el día que la autenticación cambie (`ADR-024` está pendiente de
 * verificación contra el proyecto real) solo cambia quien llama a esta función.
 */
export function configurarSesionDeApi(proveedor: ProveedorDeToken, onSesionPerdida: () => void): void {
  obtenerToken = proveedor;
  alPerderSesion = onSesionPerdida;
}

interface OpcionesDePeticion {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  cuerpo?: unknown;
  /** Parámetros de query. Los `undefined` se omiten; los `false` y `0` NO. */
  query?: Record<string, string | number | boolean | undefined>;
}

function construirUrl(ruta: string, query?: OpcionesDePeticion['query']): string {
  const url = `${BASE}${ruta}`;
  if (!query) return url;

  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(query)) {
    // `undefined` se omite; `false` y `0` son valores legítimos y sí viajan. Usar un `if (valor)`
    // aquí haría que `soloPendientes=false` y `desplazamiento=0` desaparecieran en silencio.
    if (valor !== undefined) parametros.set(clave, String(valor));
  }
  const cadena = parametros.toString();
  return cadena.length > 0 ? `${url}?${cadena}` : url;
}

/**
 * Una petición a la API de Blanc.
 *
 * **Toda llamada pasa por aquí.** Es lo que garantiza que el token, el formato de error y el
 * manejo del `401` sean uno solo y no se repitan por pantalla.
 */
export async function peticion<T>(ruta: string, opciones: OpcionesDePeticion = {}): Promise<T> {
  const token = obtenerToken();
  const cabeceras: Record<string, string> = { Accept: 'application/json' };
  if (token) cabeceras['Authorization'] = `Bearer ${token}`;
  if (opciones.cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';

  const respuesta = await fetch(construirUrl(ruta, opciones.query), {
    method: opciones.metodo ?? 'GET',
    headers: cabeceras,
    ...(opciones.cuerpo !== undefined ? { body: JSON.stringify(opciones.cuerpo) } : {}),
  });

  if (respuesta.status === 401) {
    /**
     * Sesión caída: se cierra en el cliente en vez de reintentar.
     *
     * El `401` del backend es de token inválido o expirado, y el refresco lo gestiona
     * `supabase-js` por su cuenta. Si aun así llega un `401`, insistir solo repetiría el fallo —
     * lo correcto es volver al login.
     */
    alPerderSesion();
    throw new ErrorDeApi(401, 'NO_AUTENTICADO', 'La sesión expiró. Vuelve a iniciar sesión.', 'domain');
  }

  if (respuesta.status === 204) return undefined as T;

  const texto = await respuesta.text();

  /**
   * El cuerpo se parsea **con tolerancia a fallos**, y eso importa en la rama de error.
   *
   * Un `JSON.parse` directo era un defecto real: un `502` de la plataforma o un proxy que
   * respondiera HTML hacían estallar el parseo con un `SyntaxError` opaco, y **se perdía el estado
   * HTTP** — lo único que queda para diagnosticar cuando el error no viene de la aplicación. Lo
   * destapó la prueba *"conserva el estado HTTP cuando el error NO tiene la forma de ADR-013"*.
   *
   * En la rama de éxito un cuerpo ilegible sigue siendo un fallo, y abajo se convierte en un error
   * con su estado, no en un `SyntaxError`.
   */
  let json: unknown = null;
  let parseoCorrecto = texto.length === 0;
  if (texto.length > 0) {
    try {
      json = JSON.parse(texto);
      parseoCorrecto = true;
    } catch {
      parseoCorrecto = false;
    }
  }

  if (!respuesta.ok) {
    const cuerpo = json as CuerpoDeError | null;
    if (cuerpo?.error) {
      throw new ErrorDeApi(respuesta.status, cuerpo.error.code, cuerpo.error.message, cuerpo.error.category, cuerpo.error.details);
    }
    // Respuesta de error sin la forma de `ADR-013`: no debería pasar, pero si pasa no se puede
    // perder el estado HTTP — es lo único que queda para diagnosticar.
    throw new ErrorDeApi(respuesta.status, 'RESPUESTA_INESPERADA', `El servidor respondió ${respuesta.status}.`);
  }

  if (!parseoCorrecto) {
    // Éxito con cuerpo ilegible. Se convierte en `ErrorDeApi` en vez de dejar escapar un
    // `SyntaxError`, para que las pantallas tengan un solo tipo de error que manejar.
    throw new ErrorDeApi(respuesta.status, 'RESPUESTA_ILEGIBLE', 'El servidor respondió algo que no se pudo interpretar.');
  }

  return json as T;
}
