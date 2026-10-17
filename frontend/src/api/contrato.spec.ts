import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLAVES_DE_ANTICIPO,
  CLAVES_DE_INDICADORES,
  CLAVES_DE_REPORTE_DE_AGENDA,
  CLAVES_DE_REPORTE_DE_ANTICIPOS,
  CLAVES_DE_REPORTE_DE_CONVERSACIONES,
  CLAVES_DE_RESUMEN_ANALITICO,
  CLAVES_DE_COTIZACION,
  CLAVES_DE_COTIZACION_SERVICIO,
  CLAVES_DE_CITA_IPAD,
  CLAVES_DE_CITA_OPERACION,
  CLAVES_DE_CLIENTA,
  CLAVES_DE_CONVERSACION,
  CLAVES_DE_EXCEPCION,
  CLAVES_DE_MANICURISTA,
  CLAVES_DE_MODIFICADOR,
  CLAVES_DE_PERFIL,
  CLAVES_DE_SERVICIO,
  CLAVES_DE_SILLA,
  CLAVES_DE_SOLICITUD,
  CLAVES_DE_SUCURSAL,
} from './claves-del-contrato';

interface ContratoDeApi {
  rutas: { metodo: string; ruta: string; roles: string[] | null }[];
  respuestas: Record<string, string[]>;
}

/**
 * **El otro extremo del verificador de contrato (`P8`).**
 *
 * Lee `contratos/api-v1.json` —que el backend **deriva de sus presenters reales**— y lo compara
 * con los tipos de este proyecto. Cierra la deuda que `ADR-027` registró: *"los tipos del contrato
 * están duplicados a mano, backend y frontend… el riesgo es deriva silenciosa"*.
 *
 * Y era silenciosa de verdad: si un presenter dejara de devolver un campo, este frontend compilaba
 * igual, las dos suites pasaban igual, y el síntoma aparecía en producción como un dato que no se
 * pinta. Ahora **rompe el build de este proyecto**.
 *
 * La cadena completa, para que se vea por qué funciona:
 * 1. `tsc` garantiza que los arreglos de `claves-del-contrato.ts` coinciden exactamente con las
 *    interfaces de `contrato.ts` (`satisfies` + `ClavesCompletas`).
 * 2. Esta prueba garantiza que esos arreglos coinciden con el contrato del backend.
 * 3. Por tanto, las interfaces coinciden con lo que el backend devuelve de verdad.
 */
describe('Contrato compartido con el backend (`P8`)', () => {
  const contrato = JSON.parse(
    // Carpeta neutral en la raíz del repositorio: ninguno de los dos proyectos depende del otro.
    readFileSync(join(__dirname, '..', '..', '..', 'contratos', 'api-v1.json'), 'utf8'),
  ) as ContratoDeApi;

  const comparar = (nombre: string, declaradas: readonly string[]) => {
    const delBackend = contrato.respuestas[nombre];
    expect(delBackend, `El contrato no tiene la forma "${nombre}". ¿Se renombró en el backend?`).toBeDefined();
    expect([...declaradas].sort()).toEqual([...delBackend!].sort());
  };

  it.each([
    ['Cita (roles de operación)', CLAVES_DE_CITA_OPERACION],
    ['Cita (MANICURISTA / iPad)', CLAVES_DE_CITA_IPAD],
    ['Silla', CLAVES_DE_SILLA],
    ['SolicitudListaEspera', CLAVES_DE_SOLICITUD],
    ['Anticipo', CLAVES_DE_ANTICIPO],
    ['Clienta', CLAVES_DE_CLIENTA],
    ['Conversacion', CLAVES_DE_CONVERSACION],
    ['ExcepcionPersonal', CLAVES_DE_EXCEPCION],
    ['Servicio', CLAVES_DE_SERVICIO],
    ['Manicurista', CLAVES_DE_MANICURISTA],
    // Backoffice (Parte 2): el panel lee y edita modificadores de diseño.
    ['ModificadorDiseno', CLAVES_DE_MODIFICADOR],
    // Formas ANIDADAS. Su ausencia dejó pasar un defecto que llegó hasta la pantalla: ver la nota
    // de `CLAVES_DE_COTIZACION`.
    ['CotizacionSnapshot (anidado en Cita)', CLAVES_DE_COTIZACION],
    ['CotizacionSnapshot.servicio', CLAVES_DE_COTIZACION_SERVICIO],
    // Analítica (Fase 6), incluidas sus cuatro formas anidadas.
    ['ResumenAnalitico', CLAVES_DE_RESUMEN_ANALITICO],
    ['ResumenAnalitico.citas', CLAVES_DE_REPORTE_DE_AGENDA],
    ['ResumenAnalitico.anticipos', CLAVES_DE_REPORTE_DE_ANTICIPOS],
    ['ResumenAnalitico.conversaciones', CLAVES_DE_REPORTE_DE_CONVERSACIONES],
    ['ResumenAnalitico.indicadores', CLAVES_DE_INDICADORES],
  ] as const)('los campos de `%s` coinciden EXACTAMENTE con los del backend', (nombre, declaradas) => {
    comparar(nombre, declaradas);
  });

  it('`Sucursal` es un SUBCONJUNTO declarado: cada campo que usamos existe en el backend', () => {
    /**
     * El único caso de subconjunto a propósito. El presenter del backend devuelve además
     * `numeroWhatsappAlias`, `horarioSemanal` y `descansos`, que ninguna pantalla de este frontend
     * pinta. Tiparlos obligaría a mantener código muerto.
     *
     * Lo que sí importa verificar —y esta prueba hace— es la dirección peligrosa: que **no usemos
     * un campo que el backend no manda**.
     */
    const delBackend = contrato.respuestas['Sucursal']!;
    for (const clave of CLAVES_DE_SUCURSAL) {
      expect(delBackend, `El frontend usa \`Sucursal.${clave}\`, que el backend ya no devuelve.`).toContain(clave);
    }
  });

  it('`PerfilUsuario` coincide con lo que devuelve `GET /usuarios/yo`', () => {
    /**
     * `PerfilUsuario` **no sale de un presenter**: el controlador construye el objeto literal a
     * partir de los claims ya resueltos, así que no hay nada que invocar para derivar su forma y
     * el contrato del backend no lo incluye.
     *
     * Se fija aquí contra la lista literal de lo que `GET /yo` devuelve. Es la única forma de este
     * archivo que no está encadenada al backend, y conviene saberlo: si alguien añade un campo a
     * esa respuesta, esta prueba no lo detecta. El endpoint tiene su propio E2E en el backend
     * (`usuarios.e2e.spec.ts`) que sí compara la respuesta completa con `toEqual`.
     */
    expect([...CLAVES_DE_PERFIL].sort()).toEqual(['manicuristaId', 'rol', 'sub', 'sucursales']);
  });

  describe('las rutas que este frontend consume EXISTEN en el backend', () => {
    /**
     * La otra mitad de la deriva: un endpoint renombrado o retirado. Los módulos de `api/` llevan
     * las rutas escritas como cadenas, así que un cambio en el backend no rompe nada aquí — se
     * descubre con un `404` en producción.
     *
     * Las rutas con parámetro se normalizan a `:id` para poder compararlas con el contrato, que es
     * como Nest las declara.
     */
    const RUTAS_QUE_USAMOS: readonly [string, string][] = [
      ['GET', '/v1/identidad-y-accesos/usuarios/yo'],
      ['GET', '/v1/sucursales-y-personal/sucursales'],
      ['GET', '/v1/sucursales-y-personal/manicuristas'],
      ['GET', '/v1/sucursales-y-personal/excepciones'],
      ['POST', '/v1/sucursales-y-personal/excepciones/ausencias'],
      ['POST', '/v1/sucursales-y-personal/excepciones/coberturas'],
      ['DELETE', '/v1/sucursales-y-personal/excepciones/:id'],
      ['GET', '/v1/catalogo-y-cotizacion/servicios'],
      // Backoffice administrativo (Parte 2).
      ['GET', '/v1/catalogo-y-cotizacion/servicios/categorias'],
      ['POST', '/v1/catalogo-y-cotizacion/servicios'],
      ['PATCH', '/v1/catalogo-y-cotizacion/servicios/:id'],
      ['POST', '/v1/catalogo-y-cotizacion/servicios/:id/desactivar'],
      ['GET', '/v1/catalogo-y-cotizacion/servicios/:id/modificadores'],
      ['POST', '/v1/catalogo-y-cotizacion/servicios/:id/modificadores/:modificadorId'],
      ['DELETE', '/v1/catalogo-y-cotizacion/servicios/:id/modificadores/:modificadorId'],
      ['GET', '/v1/catalogo-y-cotizacion/modificadores-diseno'],
      ['POST', '/v1/catalogo-y-cotizacion/modificadores-diseno'],
      ['PATCH', '/v1/catalogo-y-cotizacion/modificadores-diseno/:id'],
      ['POST', '/v1/catalogo-y-cotizacion/modificadores-diseno/:id/desactivar'],
      ['POST', '/v1/agenda/sillas'],
      ['POST', '/v1/agenda/sillas/:id/desactivar'],
      ['POST', '/v1/sucursales-y-personal/manicuristas'],
      ['POST', '/v1/sucursales-y-personal/manicuristas/:id/desactivar'],
      ['POST', '/v1/sucursales-y-personal/manicuristas/:id/sucursales/:sucursalId'],
      ['DELETE', '/v1/sucursales-y-personal/manicuristas/:id/sucursales/:sucursalId'],
      // Garantías (`P10`).
      ['POST', '/v1/agenda/citas/garantias'],
      ['GET', '/v1/agenda/citas/garantias/cobertura'],
      ['GET', '/v1/agenda/citas'],
      ['POST', '/v1/agenda/citas'],
      ['POST', '/v1/agenda/citas/:id/manicurista'],
      ['POST', '/v1/agenda/citas/:id/solicitar-confirmacion'],
      ['POST', '/v1/agenda/citas/:id/confirmar'],
      ['POST', '/v1/agenda/citas/:id/completar'],
      ['POST', '/v1/agenda/citas/:id/no-show'],
      ['POST', '/v1/agenda/citas/:id/cancelar'],
      ['POST', '/v1/agenda/citas/:id/reprogramar'],
      ['GET', '/v1/agenda/disponibilidad'],
      ['GET', '/v1/agenda/sillas'],
      ['GET', '/v1/agenda/lista-espera'],
      ['POST', '/v1/agenda/lista-espera'],
      ['POST', '/v1/agenda/lista-espera/:id/aceptar'],
      ['POST', '/v1/agenda/lista-espera/avanzar-turno'],
      ['DELETE', '/v1/agenda/lista-espera/:id'],
      ['GET', '/v1/crm/clientas'],
      ['GET', '/v1/crm/clientas/:id'],
      ['POST', '/v1/crm/clientas/:id/estado-de-riesgo'],
      ['GET', '/v1/analitica/resumen'],
      ['GET', '/v1/anticipos'],
      ['POST', '/v1/anticipos/:id/confirmar-pago'],
      ['POST', '/v1/anticipos/:id/expirar'],
      ['GET', '/v1/conversaciones'],
      ['GET', '/v1/conversaciones/:id'],
      ['GET', '/v1/conversaciones/plantillas'],
      ['GET', '/v1/conversaciones/escaladas/pendientes'],
      ['POST', '/v1/conversaciones/:id/mensajes'],
      ['POST', '/v1/conversaciones/:id/plantilla'],
      ['POST', '/v1/conversaciones/:id/escalar'],
      ['POST', '/v1/conversaciones/:id/devolver-al-bot'],
    ];

    it.each(RUTAS_QUE_USAMOS)('%s %s', (metodo, ruta) => {
      const existe = contrato.rutas.some((candidata) => candidata.metodo === metodo && candidata.ruta === ruta);
      expect(existe, `El frontend llama a \`${metodo} ${ruta}\`, que no existe en el contrato del backend.`).toBe(true);
    });
  });

  it('NINGUNA ruta que consumimos está abierta sin `@Roles` salvo las exentas conocidas', () => {
    // Coherencia con el lado del backend: si una ruta de negocio perdiera su decorador, el panel
    // seguiría funcionando y la restricción desaparecería en silencio.
    const EXENTAS = [
      '/v1/identidad-y-accesos/usuarios/yo',
      '/v1/sucursales-y-personal/sucursales',
      '/v1/sucursales-y-personal/sucursales/:id',
      '/v1/sucursales-y-personal/manicuristas',
    ];

    const abiertas = contrato.rutas
      .filter((ruta) => ruta.ruta.startsWith('/v1/') && ruta.roles === null)
      .map((ruta) => ruta.ruta)
      .filter((ruta) => !EXENTAS.includes(ruta) && !ruta.startsWith('/v1/webhooks/'));

    expect(abiertas).toEqual([]);
  });
});
