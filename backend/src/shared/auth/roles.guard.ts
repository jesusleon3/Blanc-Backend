import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';
import { Rol } from './rol';

/**
 * Nivel 1 de RBAC (ADR-010): rechazo grueso por rol/endpoint, antes de llegar al caso de uso.
 * El caso de uso de dominio vuelve a validar (nivel 2, defensa en profundidad) — este guard
 * nunca es la única barrera.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!rolesRequeridos || rolesRequeridos.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const usuario = request.usuario;

    if (!usuario || !rolesRequeridos.includes(usuario.rol)) {
      throw new ForbiddenException({
        error: {
          category: 'domain',
          code: 'ROL_SIN_PERMISO',
          message: 'Tu rol no tiene permiso para esta acción.',
        },
      });
    }

    return true;
  }
}
