import { Global, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { createRemoteJWKSet } from 'jose';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthorizationGuard } from './authorization.guard';
import { RolesGuard } from './roles.guard';
import { resolverJwtSecret } from './jwt-secret';
import { resolverIssuerSupabase, resolverJwksUri, resolverSupabaseUrl } from './supabase-url';
import { PERMISOS_USUARIO_PORT, PermisosUsuarioPort } from './permisos-usuario.port';
import { IdentidadYAccesosModule } from '../../modules/identidad-y-accesos/identidad-y-accesos.module';

export const JWT_SECRET = 'JWT_SECRET';
export const SUPABASE_ISSUER = 'SUPABASE_ISSUER';
export const SUPABASE_JWKS = 'SUPABASE_JWKS';

/**
 * Módulo transversal de autenticación/autorización — compartido por todos los módulos de
 * negocio (ADR-010), no propio de ningún Bounded Context.
 *
 * ORDEN DE LOS GUARDS GLOBALES — no es cosmético, es un requisito funcional (`DEC-029`):
 *
 *   1. JwtAuthGuard        ¿quién eres?   verifica firma/issuer/exp, expone `sub`
 *   2. AuthorizationGuard  ¿qué puedes?   consulta PostgreSQL, escribe rol/sucursales
 *   3. RolesGuard          ¿te alcanza?   compara el rol contra @Roles(...)
 *
 * Los tres se declaran en ESTE array y en ESTE orden a propósito. Nest ejecuta los `APP_GUARD`
 * en el orden de registro dentro de un mismo módulo, pero los de `AppModule` corren ANTES que
 * los de sus módulos importados (verificado empíricamente, no asumido). Registrar
 * `AuthorizationGuard` en `app.module.ts` lo pondría antes de `JwtAuthGuard`, sin `sub` que
 * consultar. Mantenerlos juntos aquí es lo único que garantiza la secuencia.
 *
 * `IdentidadYAccesosModule` se importa porque es el dueño de los datos de autorización y provee
 * `PERMISOS_USUARIO_PORT`. La dependencia va en ese sentido y no al revés: este módulo define la
 * interfaz que necesita (`permisos-usuario.port.ts`) y el contexto de Identidad la satisface.
 */
@Global()
@Module({
  imports: [IdentidadYAccesosModule],
  providers: [
    { provide: JWT_SECRET, useValue: resolverJwtSecret() },
    { provide: SUPABASE_ISSUER, useValue: resolverIssuerSupabase(resolverSupabaseUrl()) },
    { provide: SUPABASE_JWKS, useValue: createRemoteJWKSet(resolverJwksUri(resolverSupabaseUrl())) },
    {
      provide: APP_GUARD,
      useFactory: (secret: string, reflector: Reflector, issuer: string, jwks: ReturnType<typeof createRemoteJWKSet>) =>
        new JwtAuthGuard(secret, reflector, issuer, jwks),
      inject: [JWT_SECRET, Reflector, SUPABASE_ISSUER, SUPABASE_JWKS],
    },
    {
      provide: APP_GUARD,
      useFactory: (permisos: PermisosUsuarioPort, reflector: Reflector) => new AuthorizationGuard(permisos, reflector),
      inject: [PERMISOS_USUARIO_PORT, Reflector],
    },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JWT_SECRET],
})
export class AuthModule {}
