import { SetMetadata } from '@nestjs/common';
import { Rol } from './rol';

export const ROLES_KEY = 'roles';

/** Nivel 1 de RBAC (ADR-010): autorización gruesa por rol/endpoint, vía middleware. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
