import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ClaimsUsuario, Rol } from './rol';

function contextoConUsuario(usuario: ClaimsUsuario | undefined, rolesMeta: Rol[] | undefined): ExecutionContext {
  const request: Record<string, unknown> = { usuario };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
    __rolesMeta: rolesMeta,
  } as unknown as ExecutionContext;
}

describe('RolesGuard — ADR-010, nivel 1 de RBAC', () => {
  it('permite el acceso si el endpoint no exige ningún rol', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextoConUsuario({ sub: '1', rol: Rol.SOLO_LECTURA, sucursales: 'GLOBAL' }, undefined))).toBe(true);
  });

  it('rechaza si el usuario no tiene el rol exigido', () => {
    const reflector = { getAllAndOverride: () => [Rol.SUPER_ADMIN] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextoConUsuario({ sub: '1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' }, [Rol.SUPER_ADMIN]))).toThrow(
      ForbiddenException,
    );
  });

  it('permite el acceso si el usuario tiene uno de los roles exigidos', () => {
    const reflector = { getAllAndOverride: () => [Rol.SUPER_ADMIN, Rol.ADMINISTRADOR] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(
      guard.canActivate(contextoConUsuario({ sub: '1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' }, [Rol.SUPER_ADMIN, Rol.ADMINISTRADOR])),
    ).toBe(true);
  });

  it('RN-SUC-02: rechaza a un Administrador cuando el endpoint exige exclusivamente Super Admin', () => {
    const reflector = { getAllAndOverride: () => [Rol.SUPER_ADMIN] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(contextoConUsuario({ sub: '1', rol: Rol.ADMINISTRADOR, sucursales: 'GLOBAL' }, [Rol.SUPER_ADMIN]))).toThrow(
      ForbiddenException,
    );
  });
});
