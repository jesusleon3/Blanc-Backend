import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { IdentidadAutenticada } from './rol';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * `aud` que Supabase Auth emite en los access token de sesión. Valor cerrado en `DEC-027`,
 * confirmado empíricamente contra DOS JWT reales del proyecto (emisión inicial y renovación),
 * no tomado de documentación pública.
 *
 * Es una constante y no un parámetro inyectado —a diferencia de `issuerEsperado`, que sí varía
 * por proyecto— porque no depende del despliegue: es parte del formato de token de Supabase. Si
 * algún día cambiara, este es el único punto a tocar.
 */
export const AUDIENCE_SUPABASE = 'authenticated';

/**
 * Primer guard de la cadena (`auth.module.ts`). **Solo autentica**: responde "quién eres" y nada
 * más (`DEC-029`).
 *
 * Verifica exactamente seis cosas, todas criptográficas o temporales:
 *   1. que el token venga como `Bearer` en el encabezado `Authorization`
 *   2. que su algoritmo sea uno de los dos permitidos, elegido por el header — nunca por el payload
 *   3. que la firma sea válida (ES256 vía JWKS remoto / HS256 legacy vía secreto compartido)
 *   4. que el `issuer` sea el esperado, y que `exp`/`nbf` estén vigentes
 *   5. que el `audience` sea exactamente el de Supabase Auth (`DEC-027`)
 *   6. que traiga un `sub` utilizable
 *
 * `issuer` y `audience` se delegan a las opciones nativas de cada librería de verificación, no se
 * comprueban a mano tras decodificar: así la validación ocurre dentro del mismo paso que verifica
 * la firma, sin ventana entre "el token es auténtico" y "el token es para nosotros".
 *
 * QUÉ YA NO HACE, y por qué (refactor de `DEC-029`, 2026-09-14): antes exigía también los claims
 * `rol` y `sucursales`, devolviendo `401` si faltaban. Eso mezclaba autenticación con
 * autorización y, sobre todo, era incorrecto contra la realidad: **un JWT legítimo emitido por
 * Supabase no trae esos claims**, y aun así es un token perfectamente válido. Rechazarlo con
 * `401` afirmaba algo falso —que la autenticación había fallado— cuando lo que faltaba era
 * información de negocio. Hoy esos datos los resuelve `AuthorizationGuard` leyendo PostgreSQL,
 * la fuente de verdad (`DEC-024`), y la ausencia de permisos se responde con `403`, que es lo
 * que semánticamente corresponde.
 *
 * Deja en `request.identidad` únicamente `{ sub }`. No escribe `request.usuario`: ese campo lo
 * llena el guard siguiente, con datos verificados contra la base de datos. La separación es
 * deliberada — impide que cualquier consumidor confunda "lo que el token dice" con "lo que la
 * persona puede hacer".
 *
 * Es `APP_GUARD` global: todo endpoint exige JWT válido salvo los marcados `@Public()`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtSecretLegacy: string,
    private readonly reflector: Reflector,
    private readonly issuerEsperado: string,
    private readonly resolverClaveJwks: JWTVerifyGetKey,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (esPublico) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        error: {
          category: 'domain',
          code: 'TOKEN_AUSENTE',
          message: 'Se requiere un token de autenticación.',
        },
      });
    }

    const token = authHeader.slice('Bearer '.length);
    const payload = await this.verificarFirma(token);

    if (typeof payload.sub !== 'string' || payload.sub.trim() === '') {
      throw new UnauthorizedException({
        error: { category: 'domain', code: 'TOKEN_SIN_SUJETO', message: 'El token no contiene un sujeto (sub) válido.' },
      });
    }

    const identidad: IdentidadAutenticada = { sub: payload.sub };
    request.identidad = identidad;
    return true;
  }

  /**
   * Selecciona la rama de verificación por el `alg` declarado en el header del JWT (sin verificar
   * nada todavía — solo se lee el header, la firma se valida a continuación con la clave que
   * corresponde exactamente a ese algoritmo, nunca con una clave de otro tipo). Un algoritmo
   * distinto de `HS256`/`ES256` se rechaza sin intentar ninguna verificación.
   */
  private async verificarFirma(token: string): Promise<Record<string, unknown>> {
    const decodificado = jwt.decode(token, { complete: true });
    if (!decodificado || typeof decodificado.payload === 'string') {
      throw this.tokenInvalido();
    }

    const alg = decodificado.header.alg;

    if (alg === 'HS256') {
      try {
        return jwt.verify(token, this.jwtSecretLegacy, {
          algorithms: ['HS256'],
          issuer: this.issuerEsperado,
          audience: AUDIENCE_SUPABASE,
        }) as jwt.JwtPayload;
      } catch {
        throw this.tokenInvalido();
      }
    }

    if (alg === 'ES256') {
      try {
        const { payload } = await jwtVerify(token, this.resolverClaveJwks, {
          algorithms: ['ES256'],
          issuer: this.issuerEsperado,
          audience: AUDIENCE_SUPABASE,
        });
        return payload;
      } catch {
        throw this.tokenInvalido();
      }
    }

    throw new UnauthorizedException({
      error: {
        category: 'domain',
        code: 'TOKEN_ALGORITMO_NO_PERMITIDO',
        message: 'El algoritmo de firma del token no está permitido.',
      },
    });
  }

  private tokenInvalido(): UnauthorizedException {
    return new UnauthorizedException({
      error: { category: 'domain', code: 'TOKEN_INVALIDO', message: 'El token es inválido o expiró.' },
    });
  }
}
