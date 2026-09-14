import { ClaimsUsuario, puedeAsignarRol, Rol, tieneAlcanceSucursal } from './rol';

function claims(overrides: Partial<ClaimsUsuario>): ClaimsUsuario {
  return { sub: 'user-1', rol: Rol.ADMINISTRADOR, sucursales: [], ...overrides };
}

describe('tieneAlcanceSucursal — ADR-010, 05-api-design.md §6', () => {
  it('Super Admin siempre tiene alcance, sin importar el claim de sucursales', () => {
    expect(tieneAlcanceSucursal(claims({ rol: Rol.SUPER_ADMIN, sucursales: [] }), 'sucursal-1')).toBe(true);
  });

  it('alcance GLOBAL da acceso a cualquier sucursal (RN-SEG-03, Analista/Solo lectura)', () => {
    expect(tieneAlcanceSucursal(claims({ rol: Rol.ANALISTA, sucursales: 'GLOBAL' }), 'sucursal-cualquiera')).toBe(true);
  });

  it('con lista explícita, solo da acceso a las sucursales incluidas', () => {
    const usuario = claims({ sucursales: ['sucursal-1', 'sucursal-2'] });
    expect(tieneAlcanceSucursal(usuario, 'sucursal-1')).toBe(true);
    expect(tieneAlcanceSucursal(usuario, 'sucursal-3')).toBe(false);
  });

  it('lista vacía no da acceso a ninguna sucursal (comportamiento por defecto para roles sin Pregunta 11 resuelta)', () => {
    expect(tieneAlcanceSucursal(claims({ sucursales: [] }), 'sucursal-1')).toBe(false);
  });
});

describe('puedeAsignarRol — FL-SEG-01/03, pre-arranque de Identidad 2026-08-22', () => {
  it('nadie puede cambiar su propio rol, ni siquiera Super Admin', () => {
    expect(puedeAsignarRol(claims({ rol: Rol.SUPER_ADMIN }), true, Rol.SUPER_ADMIN, Rol.ADMINISTRADOR)).toBe(false);
    expect(puedeAsignarRol(claims({ rol: Rol.ADMINISTRADOR }), true, Rol.ADMINISTRADOR, Rol.ADMINISTRADOR)).toBe(false);
  });

  it('solo un Super Admin puede asignar el rol Super Admin', () => {
    expect(puedeAsignarRol(claims({ rol: Rol.ADMINISTRADOR }), false, null, Rol.SUPER_ADMIN)).toBe(false);
    expect(puedeAsignarRol(claims({ rol: Rol.SUPER_ADMIN }), false, null, Rol.SUPER_ADMIN)).toBe(true);
  });

  it('un actor no-Super-Admin no puede cambiar el rol de un usuario que hoy es Super Admin', () => {
    expect(puedeAsignarRol(claims({ rol: Rol.ADMINISTRADOR }), false, Rol.SUPER_ADMIN, Rol.RECEPCIONISTA)).toBe(false);
    expect(puedeAsignarRol(claims({ rol: Rol.SUPER_ADMIN }), false, Rol.SUPER_ADMIN, Rol.RECEPCIONISTA)).toBe(true);
  });

  it('un Administrador puede asignar cualquier rol no crítico a otro usuario', () => {
    expect(puedeAsignarRol(claims({ rol: Rol.ADMINISTRADOR }), false, null, Rol.RECEPCIONISTA)).toBe(true);
    expect(puedeAsignarRol(claims({ rol: Rol.ADMINISTRADOR }), false, Rol.GERENTE, Rol.MANICURISTA)).toBe(true);
  });
});
