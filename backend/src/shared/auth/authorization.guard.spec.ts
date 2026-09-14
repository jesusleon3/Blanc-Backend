import { ExecutionContext, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationGuard } from './authorization.guard';
import { PermisosUsuario, PermisosUsuarioPort } from './permisos-usuario.port';
import { IdentidadAutenticada, Rol } from './rol';

const SUB = '0dd96720-c81d-4406-a2de-fe6bed0f4cd8';
const SUC_1 = '11111111-1111-1111-1111-111111111111';

/** Mismo patrón de doble de `Reflector` ya usado en `jwt-auth.guard.spec.ts`. */
function reflectorFalso(esPublico: boolean): Reflector {
  return { getAllAndOverride: () => (esPublico ? true : undefined) } as unknown as Reflector;
}

/** El contexto trae ya `request.identidad` tal como lo dejaría `JwtAuthGuard` (`DEC-029`):
 * solo `{ sub }`, nunca rol ni sucursales. */
function contextoConIdentidad(identidad?: Partial<IdentidadAutenticada>): ExecutionContext {
  const request: Record<string, unknown> = { headers: {}, identidad };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function puertoFalso(resultado: PermisosUsuario | null): jest.Mocked<PermisosUsuarioPort> {
  return { obtenerPermisosPorSupabaseUserId: jest.fn().mockResolvedValue(resultado) };
}

const puertoQueFalla = (): jest.Mocked<PermisosUsuarioPort> => ({
  obtenerPermisosPorSupabaseUserId: jest.fn().mockRejectedValue(new Error('connection terminated')),
});

describe('AuthorizationGuard — DEC-029 (C2: PostgreSQL como fuente de autorización)', () => {
  describe('éxito — enriquecimiento de la petición', () => {
    it('sobrescribe request.usuario con el rol y las sucursales leídos de la base de datos', async () => {
      const puerto = puertoFalso({ rol: Rol.GERENTE, activa: true, sucursales: [SUC_1] });
      const guard = new AuthorizationGuard(puerto, reflectorFalso(false));
      // `JwtAuthGuard` ya no propaga rol alguno: los permisos salen solo de la base de datos.
      const context = contextoConIdentidad({ sub: SUB });

      expect(await guard.canActivate(context)).toBe(true);

      expect(puerto.obtenerPermisosPorSupabaseUserId).toHaveBeenCalledWith(SUB);
      expect(context.switchToHttp().getRequest().usuario).toEqual({
        sub: SUB,
        rol: Rol.GERENTE,
        sucursales: [SUC_1],
      });
    });

    it('expone exactamente la forma que RolesGuard y los casos de uso ya esperan', async () => {
      const guard = new AuthorizationGuard(puertoFalso({ rol: Rol.ANALISTA, activa: true, sucursales: 'GLOBAL' }), reflectorFalso(false));
      const context = contextoConIdentidad({ sub: SUB });

      await guard.canActivate(context);

      const usuario = context.switchToHttp().getRequest().usuario;
      expect(Object.keys(usuario).sort()).toEqual(['rol', 'sub', 'sucursales']);
    });
  });

  describe('usuario no provisionado (FL-SEG-06 pendiente para esa cuenta)', () => {
    it('responde 403 USUARIO_NO_PROVISIONADO, no 401', async () => {
      const guard = new AuthorizationGuard(puertoFalso(null), reflectorFalso(false));

      await expect(guard.canActivate(contextoConIdentidad({ sub: SUB }))).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(contextoConIdentidad({ sub: SUB }))).rejects.toMatchObject({
        response: { error: { code: 'USUARIO_NO_PROVISIONADO' } },
      });
    });
  });

  describe('usuario inactivo (FL-SEG-05 con efecto real)', () => {
    it('responde 403 USUARIO_INACTIVO aunque el rol sea válido', async () => {
      const guard = new AuthorizationGuard(
        puertoFalso({ rol: Rol.ADMINISTRADOR, activa: false, sucursales: 'GLOBAL' }),
        reflectorFalso(false),
      );

      await expect(guard.canActivate(contextoConIdentidad({ sub: SUB }))).rejects.toMatchObject({
        response: { error: { code: 'USUARIO_INACTIVO' } },
      });
    });

    it('no deja rastro de permisos en la petición cuando deniega', async () => {
      const guard = new AuthorizationGuard(
        puertoFalso({ rol: Rol.ADMINISTRADOR, activa: false, sucursales: 'GLOBAL' }),
        reflectorFalso(false),
      );
      const context = contextoConIdentidad({ sub: SUB });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);

      expect(context.switchToHttp().getRequest().usuario).toBeUndefined();
    });
  });

  describe('fail-closed ante fallo de base de datos', () => {
    it('deniega con 503 AUTORIZACION_NO_DISPONIBLE — nunca deja pasar ni asume un rol', async () => {
      const guard = new AuthorizationGuard(puertoQueFalla(), reflectorFalso(false));
      const context = contextoConIdentidad({ sub: SUB });

      await expect(guard.canActivate(context)).rejects.toThrow(ServiceUnavailableException);
      await expect(guard.canActivate(contextoConIdentidad({ sub: SUB }))).rejects.toMatchObject({
        response: { error: { category: 'infrastructure', code: 'AUTORIZACION_NO_DISPONIBLE' } },
      });
      expect(context.switchToHttp().getRequest().usuario).toBeUndefined();
    });

    it('no filtra el detalle del fallo de infraestructura al cliente', async () => {
      const guard = new AuthorizationGuard(puertoQueFalla(), reflectorFalso(false));

      const error = await guard.canActivate(contextoConIdentidad({ sub: SUB })).catch((e: ServiceUnavailableException) => e);

      expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toContain('connection terminated');
    });
  });

  describe('@Public()', () => {
    it('deja pasar sin consultar la base de datos', async () => {
      const puerto = puertoFalso(null);
      const guard = new AuthorizationGuard(puerto, reflectorFalso(true));

      expect(await guard.canActivate(contextoConIdentidad())).toBe(true);
      expect(puerto.obtenerPermisosPorSupabaseUserId).not.toHaveBeenCalled();
    });
  });

  describe('defensa ante una cadena de guards mal ordenada', () => {
    it('falla cerrado si no hay identidad autenticada en la petición', async () => {
      const puerto = puertoFalso({ rol: Rol.SUPER_ADMIN, activa: true, sucursales: 'GLOBAL' });
      const guard = new AuthorizationGuard(puerto, reflectorFalso(false));

      await expect(guard.canActivate(contextoConIdentidad(undefined))).rejects.toMatchObject({
        response: { error: { code: 'IDENTIDAD_NO_RESUELTA' } },
      });
      expect(puerto.obtenerPermisosPorSupabaseUserId).not.toHaveBeenCalled();
    });
  });
});
