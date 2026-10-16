import { Rol } from './rol';
import {
  ESCRITURAS_AUTORIZADAS_AL_BOT,
  OPERACIONES_PERMITIDAS_AL_BOT,
  OPERACIONES_PROHIBIDAS_AL_BOT,
  ROLES_DE_PERSONA,
} from './principal-de-sistema';

/**
 * Guardia del **catálogo cerrado de roles** (`RN-SEG-01`, `ADR-024`) y de la decisión de RBAC
 * sobre el Bot.
 *
 * Es el mismo criterio que el detector de deriva de las restricciones de `agenda.citas`: una
 * regla que solo vive en un comentario no falla el build. "El catálogo de 7 roles es cerrado"
 * llevaba dos documentos y un `enum` sin nada que lo sostuviera.
 */
describe('Catálogo cerrado de roles y principal de sistema (deuda 6 de §16)', () => {
  it('EL ENUM `Rol` SIGUE TENIENDO EXACTAMENTE LOS 7 ROLES DE `RN-SEG-01`', () => {
    // Si esta prueba falla, alguien añadió un rol. No es necesariamente un error — pero exige una
    // ADR nueva que modifique `RN-SEG-01` y `ADR-024`, no un valor más en el enum.
    expect(Object.values(Rol).sort()).toEqual([...ROLES_DE_PERSONA].sort());
    expect(Object.values(Rol)).toHaveLength(7);
  });

  it('NO EXISTE UN ROL PARA EL BOT: es un principal de sistema, no una persona', () => {
    // La opción obvia —`Rol.BOT`— habría contradicho `ADR-024` en silencio y habría obligado a
    // cada `@Roles(...)` existente a preguntarse si incluye al bot.
    expect(Object.values(Rol as Record<string, string>)).not.toContain('BOT');
    expect(Object.keys(Rol)).not.toContain('BOT');
  });

  it('TODA operación que no sea `consultar-*` está declarada como escritura autorizada', () => {
    /**
     * **Enmienda 1 de `DEC-044` (2026-10-16):** el bot ya ejecuta escrituras acotadas del flujo
     * conversacional. La prueba original exigía que **todas** fueran de lectura; ahora exige algo
     * más útil: que ninguna escritura se cuele sin declararse.
     *
     * Sin esto, la única defensa sería la convención de nombrar `consultar-*` a las lecturas, y
     * una operación mal nombrada pasaría inadvertida. Añadir una escritura tiene que costar dos
     * ediciones deliberadas, no una.
     */
    for (const operacion of OPERACIONES_PERMITIDAS_AL_BOT) {
      const esLectura = /^[a-z-]+:consultar-/.test(operacion);
      if (!esLectura) {
        expect(ESCRITURAS_AUTORIZADAS_AL_BOT).toContain(operacion);
      }
    }
  });

  it('CANCELAR Y REPROGRAMAR SIGUEN PROHIBIDOS, y lo verifica una lista negra (`DEC-040`)', () => {
    /**
     * `DEC-040`: **ninguna clienta cancela sola.** La Enmienda 1 movió el criterio de "el bot no
     * escribe" a "el bot no decide lo que una persona tiene que mirar", pero **no movió este
     * límite**. Reprogramar además exige evaluar la ventana de 48 h con anticipo pagado
     * (`RN-ANT-04`) y el tope de 3 reprogramaciones (`DEC-042`) — reglas, y el bot no evalúa
     * reglas.
     *
     * Es una lista negra y no solo una ausencia porque **la ausencia ya falló una vez**: la lista
     * original se declaraba "toda de lectura" y eso se sostenía en una convención de nombres.
     */
    for (const operacion of OPERACIONES_PERMITIDAS_AL_BOT) {
      for (const prohibido of OPERACIONES_PROHIBIDAS_AL_BOT) {
        expect(operacion).not.toContain(prohibido);
      }
    }
  });

  it('las escrituras declaradas EXISTEN en la lista de operaciones permitidas', () => {
    // La otra mitad: una escritura declarada pero no permitida sería una autorización fantasma.
    for (const escritura of ESCRITURAS_AUTORIZADAS_AL_BOT) {
      expect(OPERACIONES_PERMITIDAS_AL_BOT).toContain(escritura);
    }
  });

  it('la lista de operaciones del bot no está vacía: Fase 4 tiene un contrato que cumplir', () => {
    expect(OPERACIONES_PERMITIDAS_AL_BOT.length).toBeGreaterThan(0);
  });
});
