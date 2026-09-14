import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Excluye explícitamente un endpoint de `JwtAuthGuard` (que es `APP_GUARD` global — ver
 * `auth.module.ts`). Sin este decorador, todo endpoint de todo módulo exige un JWT válido, sin
 * excepción — no hay otra forma de exponer un endpoint público en este sistema.
 *
 * Uso deliberadamente restringido: cada uso de `@Public()` es una decisión consciente, revisable
 * en el diff de PR, nunca un bypass implícito. No usar para "simplificar pruebas" ni para
 * endpoints que en realidad deberían exigir un rol — para eso existe `@Roles(...)` sobre un
 * endpoint ya autenticado, no `@Public()`.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
