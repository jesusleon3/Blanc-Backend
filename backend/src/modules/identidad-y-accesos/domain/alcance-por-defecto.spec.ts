import { resolverAlcanceSucursales } from './alcance-por-defecto';
import { Rol } from '../../../shared/auth/rol';

const SUC_1 = '11111111-1111-1111-1111-111111111111';

describe('resolverAlcanceSucursales — única función que decide el claim `sucursales`', () => {
  describe('RN-SEG-03 (regla APROBADA, 2026-08-03)', () => {
    it.each([Rol.ANALISTA, Rol.SOLO_LECTURA])('%s recibe alcance GLOBAL aunque no tenga filas asignadas', (rol) => {
      expect(resolverAlcanceSucursales(rol, [])).toBe('GLOBAL');
    });

    it('Analista recibe GLOBAL incluso teniendo filas: la regla no depende de las asignaciones', () => {
      expect(resolverAlcanceSucursales(Rol.ANALISTA, [SUC_1])).toBe('GLOBAL');
    });
  });

  describe('Super Admin', () => {
    it('recibe GLOBAL por definición de rol (RN-SEG-01)', () => {
      expect(resolverAlcanceSucursales(Rol.SUPER_ADMIN, [])).toBe('GLOBAL');
    });
  });

  describe('resto de roles — asunción temporal, Pregunta 11 sin responder', () => {
    it.each([Rol.ADMINISTRADOR, Rol.GERENTE, Rol.RECEPCIONISTA, Rol.MANICURISTA])(
      '%s con filas asignadas recibe exactamente esas sucursales',
      (rol) => {
        expect(resolverAlcanceSucursales(rol, [SUC_1])).toEqual([SUC_1]);
      },
    );

    it.each([Rol.ADMINISTRADOR, Rol.GERENTE, Rol.RECEPCIONISTA, Rol.MANICURISTA])(
      '%s SIN filas recibe arreglo vacío = sin acceso (ASUNCIÓN TEMPORAL, no regla confirmada)',
      (rol) => {
        // Este comportamiento NO está confirmado por la Dueña. Es la opción (b) de la Pregunta 11
        // (`OWNER_DECISION_LOG.md`), adoptada como asunción conservadora. Si la respuesta fuera la
        // opción (a), este test debe cambiar junto con `resolverAlcanceSucursales` — y deberían
        // ser los dos únicos archivos afectados (`IDENTIDAD_PRE_ARRANQUE.md` §4).
        expect(resolverAlcanceSucursales(rol, [])).toEqual([]);
      },
    );
  });
});
