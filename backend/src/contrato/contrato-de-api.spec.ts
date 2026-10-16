import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { construirContrato, RUTA_DEL_CONTRATO } from './construir-contrato';

/**
 * **El verificador de contrato de la API (`P8`).**
 *
 * ## QUÉ AFIRMA, Y POR QUÉ NO BASTABA CON LAS PRUEBAS QUE YA HABÍA
 *
 * Los E2E de cada módulo verifican que *su* endpoint responde lo que *esa prueba* espera. Lo que
 * ninguno puede ver es **la deriva entre los dos proyectos**: `ADR-027` lo dejó registrado como
 * deuda explícita —*"los tipos del contrato están duplicados a mano… el riesgo es deriva
 * silenciosa"*— y es silenciosa de verdad. Si un presenter deja de devolver un campo, el frontend
 * compila igual, las dos suites pasan igual, y el síntoma aparece en producción como un dato que
 * no se pinta.
 *
 * Esta prueba compara el contrato **derivado del código** contra un archivo **versionado**. Si algo
 * cambia, falla hasta que alguien regenere el archivo con `npm run contrato:actualizar` — y
 * entonces el cambio aparece en el diff de un commit, revisable, en vez de inadvertido.
 *
 * ## POR QUÉ UN ARCHIVO VERSIONADO Y NO UN SNAPSHOT DE JEST
 *
 * Porque **el frontend lee el mismo archivo** (`frontend/src/api/contrato.spec.ts`). Un snapshot de
 * Jest vive en un formato propio dentro de `__snapshots__` y no serviría de fuente compartida. Al
 * ser JSON en una carpeta neutral, los dos proyectos lo leen sin depender uno del otro.
 */
describe('Contrato de la API `/v1` (`P8`)', () => {
  const contratoActual = construirContrato();
  const rutaAbsoluta = join(__dirname, '..', '..', '..', RUTA_DEL_CONTRATO);

  it('COINCIDE con el contrato versionado en `contratos/api-v1.json`', () => {
    if (!existsSync(rutaAbsoluta)) {
      mkdirSync(dirname(rutaAbsoluta), { recursive: true });
      writeFileSync(rutaAbsoluta, `${JSON.stringify(contratoActual, null, 2)}\n`);
      throw new Error(
        `No existía ${RUTA_DEL_CONTRATO}; se acaba de generar. Revísalo, confirma que es correcto y vuelve a correr la prueba.`,
      );
    }

    const versionado = JSON.parse(readFileSync(rutaAbsoluta, 'utf8')) as ReturnType<typeof construirContrato>;

    /**
     * Mensaje explícito en el fallo: quien lo vea probablemente acabe de cambiar un presenter sin
     * darse cuenta de que eso es un cambio de contrato. Decirle qué comando corre la regeneración
     * convierte un fallo desconcertante en una instrucción.
     */
    expect(versionado).toEqual(contratoActual);
  });

  it('TODA ruta declara sus roles, salvo las que están explícitamente exentas', () => {
    /**
     * **El descuido de seguridad más fácil de cometer en este proyecto.** Sin `@Roles`,
     * `RolesGuard` deja pasar a cualquier autenticado — una ruta nueva sin decorador no falla, no
     * avisa, y queda abierta a los 7 roles.
     *
     * Las exenciones son deliberadas y están enumeradas, así que añadir una exige editar esta
     * lista: un acto visible en el diff, no un olvido.
     */
    const EXENTAS: readonly string[] = [
      // Público por diseño: lo consulta Railway para el healthcheck, sin token.
      'GET /health',
      // Se autentica con el HMAC de Meta, no con JWT: es servidor-a-servidor (`@Public()`).
      'GET /v1/webhooks/meta',
      'POST /v1/webhooks/meta',
      // "¿Quién soy?" — restringirlo por rol sería circular: haría falta el rol para pedir el rol.
      'GET /v1/identidad-y-accesos/usuarios/yo',
      // Lecturas puras de configuración, disponibles a cualquier autenticado. El alcance por
      // sucursal del usuario sigue pendiente de decisión de negocio (Pregunta 11).
      'GET /v1/sucursales-y-personal/sucursales',
      'GET /v1/sucursales-y-personal/sucursales/:id',
      'GET /v1/sucursales-y-personal/manicuristas',
    ];

    const sinRoles = contratoActual.rutas
      .filter((ruta) => ruta.roles === null)
      .map((ruta) => `${ruta.metodo} ${ruta.ruta}`)
      .filter((firma) => !EXENTAS.includes(firma));

    expect(sinRoles).toEqual([]);
  });

  it('NINGUNA ruta de escritura es accesible a `MANICURISTA` ni a `SOLO_LECTURA`', () => {
    /**
     * `DEC-040`: la vista de iPad es de solo lectura. Y `SOLO_LECTURA` lo dice en el nombre.
     *
     * Es una comprobación transversal que ninguna prueba de módulo puede hacer: cada E2E verifica
     * su propio `403`, pero nadie verifica que **no exista ninguna** ruta de escritura abierta a
     * esos dos roles. Un `@Roles` mal copiado al añadir un endpoint pasaría inadvertido.
     */
    const escriturasAbiertas = contratoActual.rutas
      .filter((ruta) => ruta.metodo !== 'GET')
      .filter((ruta) => (ruta.roles ?? []).some((rol) => rol === 'MANICURISTA' || rol === 'SOLO_LECTURA'))
      .map((ruta) => `${ruta.metodo} ${ruta.ruta} → ${ruta.roles?.join(', ')}`);

    expect(escriturasAbiertas).toEqual([]);
  });

  it('la VISTA DE IPAD recibe menos campos que el mostrador, y no al revés', () => {
    /**
     * Comprueba la asimetría del presenter de `Cita` **desde el contrato**, no desde una petición:
     * la forma para `MANICURISTA` tiene que ser un **subconjunto estricto** de la de operación.
     *
     * Si algún día alguien añadiera un campo al objeto `base` del presenter sin pensarlo, ese
     * campo aparecería en las dos formas y esta prueba seguiría pasando — por eso además se exige
     * que `clientaId` y `enListaRoja` sigan fuera. Son los dos que `DEC-040` protege.
     */
    const operacion = contratoActual.respuestas['Cita (roles de operación)'];
    const ipad = contratoActual.respuestas['Cita (MANICURISTA / iPad)'];

    expect(operacion).toBeDefined();
    expect(ipad).toBeDefined();
    expect(ipad!.length).toBeLessThan(operacion!.length);
    for (const clave of ipad!) {
      expect(operacion).toContain(clave);
    }
    expect(ipad).not.toContain('clientaId');
    expect(ipad).not.toContain('enListaRoja');
    // Y sí el nombre: va a atender físicamente a esa persona (Fase 5 Parte 2).
    expect(ipad).toContain('clientaNombre');
  });
});
