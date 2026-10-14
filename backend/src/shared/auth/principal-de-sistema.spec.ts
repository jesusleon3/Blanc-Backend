import { Rol } from './rol';
import { OPERACIONES_PERMITIDAS_AL_BOT, ROLES_DE_PERSONA } from './principal-de-sistema';

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

  it('las operaciones del bot son TODAS de lectura (`DEC-040`/`DEC-042`)', () => {
    // Ninguna clienta cancela sola y la finalización no es automática. Un bot que escribiera en
    // la agenda sin intervención humana contradiría las dos decisiones.
    const verbosDeEscritura = ['agendar', 'cancelar', 'reprogramar', 'completar', 'confirmar', 'crear', 'eliminar'];

    for (const operacion of OPERACIONES_PERMITIDAS_AL_BOT) {
      expect(operacion).toMatch(/^[a-z-]+:consultar-/);
      for (const verbo of verbosDeEscritura) {
        expect(operacion).not.toContain(verbo);
      }
    }
  });

  it('la lista de operaciones del bot no está vacía: Fase 4 tiene un contrato que cumplir', () => {
    expect(OPERACIONES_PERMITIDAS_AL_BOT.length).toBeGreaterThan(0);
  });
});
