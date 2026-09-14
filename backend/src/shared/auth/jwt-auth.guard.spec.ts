import * as crypto from 'crypto';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Rol } from './rol';

const SECRETO = 'secreto-de-prueba';
const ISSUER = 'https://issuer-de-prueba.example/auth/v1';
/** `DEC-027`: el guard exige este `aud`. Todo token válido de prueba debe llevarlo. */
const AUD = 'authenticated';

/** Mismo patrón de doble de `Reflector` ya usado en `roles.guard.spec.ts` — sin depender de
 * que `reflect-metadata` esté cargado en el runtime de prueba. */
function reflectorFalso(esPublico: boolean): Reflector {
  return { getAllAndOverride: () => (esPublico ? true : undefined) } as unknown as Reflector;
}

function contextoConHeader(authorization?: string): ExecutionContext {
  const request: Record<string, unknown> = { headers: authorization ? { authorization } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

/** Firma un JWT HS256 con `iss` = `ISSUER` por defecto — cada test que necesite un `iss` distinto lo sobreescribe. */
function tokenHs256(payload: Record<string, unknown>, opciones: jwt.SignOptions = {}): string {
  return jwt.sign({ iss: ISSUER, aud: AUD, ...payload }, SECRETO, opciones);
}

/** Resolver de clave JWKS "nunca debe llamarse" — usado en pruebas que solo ejercitan la rama HS256. */
const jwksNuncaLlamado: JWTVerifyGetKey = async () => {
  throw new Error('resolverClaveJwks no debería invocarse verificando un token HS256');
};

/**
 * Altera la firma de un JWT garantizando que cambien sus **bytes** decodificados.
 *
 * No basta con cambiar el último carácter de la firma en base64url: ese carácter transporta bits
 * no significativos (una firma ES256 son 64 bytes = 86 caracteres; una HS256, 32 bytes = 43), así
 * que una cadena distinta puede decodificar a los mismos bytes y el token seguiría siendo
 * criptográficamente válido — el guard lo aceptaría, correctamente, y el test fallaría de forma
 * no determinista (defecto real detectado el 2026-09-13, ~20% de las ejecuciones).
 *
 * Se decodifica la firma, se invierte un bit del primer byte y se vuelve a codificar: el cambio de
 * bytes es seguro y determinista, independientemente del contenido de la firma.
 */
function manipularFirma(token: string): string {
  const [header, payload, firmaBase64] = token.split('.');
  const firma = Buffer.from(firmaBase64, 'base64url');
  firma[0] ^= 0x01;
  return `${header}.${payload}.${firma.toString('base64url')}`;
}

/**
 * `JwtAuthGuard` SOLO autentica (`DEC-029`, refactor 2026-09-14). Ya no exige `rol` ni
 * `sucursales`: esos claims no llegan en un JWT real de Supabase y su ausencia no es un fallo de
 * autenticación. El guard escribe `request.identidad = { sub }`; `request.usuario` lo llena
 * después `AuthorizationGuard` con datos de PostgreSQL.
 */
describe('JwtAuthGuard — autenticación pura (ADR-010, DEC-026, DEC-029)', () => {
  describe('rama HS256 (legacy, JWT_SECRET)', () => {
    const guard = new JwtAuthGuard(SECRETO, reflectorFalso(false), ISSUER, jwksNuncaLlamado);

    it('rechaza una request sin encabezado Authorization', async () => {
      await expect(guard.canActivate(contextoConHeader())).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza un token con firma inválida', async () => {
      const tokenAjeno = jwt.sign({ iss: ISSUER, aud: AUD, sub: '1' }, 'otro-secreto');
      await expect(guard.canActivate(contextoConHeader(`Bearer ${tokenAjeno}`))).rejects.toThrow(UnauthorizedException);
    });

    it('[1] acepta un token HS256 válido y expone la identidad autenticada', async () => {
      const token = tokenHs256({ sub: 'user-1' });
      const context = contextoConHeader(`Bearer ${token}`);

      expect(await guard.canActivate(context)).toBe(true);
      expect(context.switchToHttp().getRequest().identidad).toEqual({ sub: 'user-1' });
    });

    it('[2] rechaza un token HS256 expirado', async () => {
      const token = tokenHs256({ sub: '1' }, { expiresIn: -1 });
      await expect(guard.canActivate(contextoConHeader(`Bearer ${token}`))).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza un token HS256 con issuer incorrecto', async () => {
      const token = jwt.sign({ iss: 'https://issuer-ajeno.example', aud: AUD, sub: '1' }, SECRETO);
      await expect(guard.canActivate(contextoConHeader(`Bearer ${token}`))).rejects.toThrow(UnauthorizedException);
    });

    it('[10] rechaza un token HS256 manipulado (firma alterada)', async () => {
      const token = tokenHs256({ sub: '1' });
      const manipulado = manipularFirma(token);
      await expect(guard.canActivate(contextoConHeader(`Bearer ${manipulado}`))).rejects.toThrow(UnauthorizedException);
    });

    it('[8] rechaza un token firmado con un algoritmo HMAC distinto de HS256 (HS384)', async () => {
      const token = jwt.sign({ iss: ISSUER, aud: AUD, sub: '1' }, SECRETO, { algorithm: 'HS384' });
      await expect(guard.canActivate(contextoConHeader(`Bearer ${token}`))).rejects.toThrow(UnauthorizedException);
    });

    describe('claims de negocio — ya NO son asunto de este guard (DEC-029)', () => {
      it('acepta un token SIN rol ni sucursales: es la forma real de un JWT de Supabase', async () => {
        // Antes del refactor esto devolvía 401 TOKEN_SIN_ROL_VALIDO — el 401 observado en las
        // pruebas de integración reales contra el proyecto Supabase. Hoy autentica correctamente.
        const token = tokenHs256({ sub: 'user-supabase' });
        const context = contextoConHeader(`Bearer ${token}`);

        expect(await guard.canActivate(context)).toBe(true);
        expect(context.switchToHttp().getRequest().identidad).toEqual({ sub: 'user-supabase' });
      });

      it('acepta un token con un rol inventado sin validarlo — y NO lo propaga', async () => {
        const token = tokenHs256({ sub: 'user-1', rol: 'ROL_QUE_NO_EXISTE', sucursales: 42 });
        const context = contextoConHeader(`Bearer ${token}`);

        expect(await guard.canActivate(context)).toBe(true);

        const peticion = context.switchToHttp().getRequest();
        // Clave: lo que el token diga sobre permisos es irrelevante y no llega a `usuario`.
        // `AuthorizationGuard` resolverá los permisos reales contra PostgreSQL (`DEC-024`).
        expect(peticion.identidad).toEqual({ sub: 'user-1' });
        expect(peticion.usuario).toBeUndefined();
      });

      it('acepta un token con rol y sucursales válidos pero tampoco los propaga', async () => {
        const token = tokenHs256({ sub: 'user-2', rol: Rol.SUPER_ADMIN, sucursales: 'GLOBAL' });
        const context = contextoConHeader(`Bearer ${token}`);

        await guard.canActivate(context);

        const peticion = context.switchToHttp().getRequest();
        expect(peticion.identidad).toEqual({ sub: 'user-2' });
        expect(peticion.usuario).toBeUndefined();
      });
    });

    describe('audience — DEC-027, valor confirmado empíricamente contra JWT reales', () => {
      it('rechaza un token con audience incorrecto pese a tener firma e issuer válidos', async () => {
        const token = jwt.sign({ iss: ISSUER, aud: 'web', sub: 'user-1' }, SECRETO);
        await expect(guard.canActivate(contextoConHeader(`Bearer ${token}`))).rejects.toThrow(UnauthorizedException);
      });

      it('rechaza un token SIN claim audience', async () => {
        const token = jwt.sign({ iss: ISSUER, sub: 'user-1' }, SECRETO);
        await expect(guard.canActivate(contextoConHeader(`Bearer ${token}`))).rejects.toThrow(UnauthorizedException);
      });

      it('rechaza un token de otro proyecto Supabase aunque su audience sí sea "authenticated"', async () => {
        // `aud` correcto pero `iss` ajeno: ambas comprobaciones son necesarias, ninguna sustituye
        // a la otra. Este es el escenario de un token legítimo... de otro sistema.
        const token = jwt.sign({ iss: 'https://otro-proyecto.supabase.co/auth/v1', aud: AUD, sub: 'user-1' }, SECRETO);
        await expect(guard.canActivate(contextoConHeader(`Bearer ${token}`))).rejects.toThrow(UnauthorizedException);
      });

      it('acepta el token cuando audience e issuer son ambos correctos', async () => {
        const context = contextoConHeader(`Bearer ${tokenHs256({ sub: 'user-1' })}`);
        expect(await guard.canActivate(context)).toBe(true);
      });
    });

    describe('sujeto (sub) — único claim que este guard sigue exigiendo', () => {
      it('rechaza un token sin el claim sub', async () => {
        const token = jwt.sign({ iss: ISSUER, aud: AUD }, SECRETO);
        await expect(guard.canActivate(contextoConHeader(`Bearer ${token}`))).rejects.toThrow(UnauthorizedException);
      });

      it('rechaza un token con sub vacío', async () => {
        const token = tokenHs256({ sub: '   ' });
        await expect(guard.canActivate(contextoConHeader(`Bearer ${token}`))).rejects.toMatchObject({
          response: { error: { code: 'TOKEN_SIN_SUJETO' } },
        });
      });
    });

    describe('@Public() — BLOCKER #2, pre-arranque de Identidad', () => {
      it('un endpoint marcado @Public() no requiere JWT (ni siquiera el encabezado Authorization)', async () => {
        const guardConEndpointPublico = new JwtAuthGuard(SECRETO, reflectorFalso(true), ISSUER, jwksNuncaLlamado);
        expect(await guardConEndpointPublico.canActivate(contextoConHeader())).toBe(true);
      });

      it('un endpoint NO marcado @Public() sigue exigiendo JWT (comportamiento por defecto sin cambios)', async () => {
        const guardSinEndpointPublico = new JwtAuthGuard(SECRETO, reflectorFalso(false), ISSUER, jwksNuncaLlamado);
        await expect(guardSinEndpointPublico.canActivate(contextoConHeader())).rejects.toThrow(UnauthorizedException);
      });
    });
  });

  describe('rama ES256 (JWKS, DEC-001/DEC-026 — proyecto real de Supabase)', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const KID = 'kid-de-prueba-1';

    function tokenEs256(payload: Record<string, unknown>, opciones: jwt.SignOptions = {}): string {
      return jwt.sign({ iss: ISSUER, aud: AUD, ...payload }, privateKey, { algorithm: 'ES256', keyid: KID, ...opciones });
    }

    /** Stub — ignora `kid`/header, siempre devuelve la única clave pública de esta suite. Evita
     * cualquier llamada de red; el comportamiento real de resolución por `kid`/refresco de JWKS
     * se prueba por separado, contra un servidor HTTP real (ver describe siguiente). */
    const resolverClaveDePrueba: JWTVerifyGetKey = async () => publicKey;

    const guard = new JwtAuthGuard(SECRETO, reflectorFalso(false), ISSUER, resolverClaveDePrueba);

    it('[3][6] acepta un token ES256 válido con kid conocido y expone la identidad', async () => {
      const token = tokenEs256({ sub: 'user-3' });
      const context = contextoConHeader(`Bearer ${token}`);

      expect(await guard.canActivate(context)).toBe(true);
      expect(context.switchToHttp().getRequest().identidad).toEqual({ sub: 'user-3' });
    });

    it('acepta un token ES256 sin claims de negocio — la forma real de Supabase', async () => {
      const token = tokenEs256({ sub: 'user-supabase' });
      const context = contextoConHeader(`Bearer ${token}`);

      expect(await guard.canActivate(context)).toBe(true);
      expect(context.switchToHttp().getRequest().usuario).toBeUndefined();
    });

    describe('audience — misma exigencia en la rama ES256 (DEC-027)', () => {
      it('rechaza un token ES256 con audience incorrecto', async () => {
        const token = jwt.sign({ iss: ISSUER, aud: 'web', sub: 'user-1' }, privateKey, { algorithm: 'ES256', keyid: KID });
        await expect(guard.canActivate(contextoConHeader(`Bearer ${token}`))).rejects.toThrow(UnauthorizedException);
      });

      it('rechaza un token ES256 sin claim audience', async () => {
        const token = jwt.sign({ iss: ISSUER, sub: 'user-1' }, privateKey, { algorithm: 'ES256', keyid: KID });
        await expect(guard.canActivate(contextoConHeader(`Bearer ${token}`))).rejects.toThrow(UnauthorizedException);
      });
    });

    it('[4] rechaza un token ES256 expirado', async () => {
      const token = tokenEs256({ sub: '1' }, { expiresIn: -1 });
      await expect(guard.canActivate(contextoConHeader(`Bearer ${token}`))).rejects.toThrow(UnauthorizedException);
    });

    it('[5] rechaza un token ES256 con issuer incorrecto', async () => {
      const token = jwt.sign({ iss: 'https://issuer-ajeno.example', aud: AUD, sub: '1' }, privateKey, {
        algorithm: 'ES256',
        keyid: KID,
      });
      await expect(guard.canActivate(contextoConHeader(`Bearer ${token}`))).rejects.toThrow(UnauthorizedException);
    });

    it('[9] rechaza un token ES256 manipulado (firma alterada)', async () => {
      const token = tokenEs256({ sub: '1' });
      const manipulado = manipularFirma(token);
      await expect(guard.canActivate(contextoConHeader(`Bearer ${manipulado}`))).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza un token ES256 firmado con una clave EC distinta a la que resuelve el JWKS', async () => {
      const otraClave = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const token = jwt.sign({ iss: ISSUER, aud: AUD, sub: '1' }, otraClave.privateKey, {
        algorithm: 'ES256',
        keyid: KID,
      });
      await expect(guard.canActivate(contextoConHeader(`Bearer ${token}`))).rejects.toThrow(UnauthorizedException);
    });

    describe('confusión de algoritmo — no debe existir posibilidad de fallback inseguro', () => {
      it('un token ES256 nunca se verifica contra el secreto HS256 aunque coincidan sub/rol', async () => {
        // Si existiera un fallback "si ES256 falla, probar HS256", esta clave publica EC (PEM,
        // dato público) reutilizada como secreto HMAC sería exactamente el ataque de confusión de
        // algoritmo clásico. El guard debe rechazarlo por completo, nunca "recuperarse" probando
        // la otra rama.
        const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
        const tokenMalicioso = jwt.sign({ iss: ISSUER, aud: AUD, sub: 'atacante' }, publicKeyPem, {
          algorithm: 'HS256',
        });
        await expect(guard.canActivate(contextoConHeader(`Bearer ${tokenMalicioso}`))).rejects.toThrow(UnauthorizedException);
      });
    });
  });

  describe('[7] resolución real por kid y refresco de JWKS ante kid desconocido (jose, servidor HTTP local)', () => {
    const claveA = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const claveB = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const KID_A = 'kid-a';
    const KID_B = 'kid-b';

    let server: http.Server;
    let jwksUrl: URL;
    let solicitudesRecibidas = 0;
    /** Simula la rotación real de Supabase: el JWKS publicado cambia entre llamadas, igual que
     * cuando Supabase agrega una clave `CURRENT` nueva sin retirar la `PREVIOUSLY USED`. */
    let clavesPublicadas: 'solo-A' | 'A-y-B' = 'solo-A';

    beforeAll(async () => {
      server = http.createServer((_req, res) => {
        solicitudesRecibidas += 1;
        const keys = [jwkDe(claveA.publicKey, KID_A)];
        if (clavesPublicadas === 'A-y-B') keys.push(jwkDe(claveB.publicKey, KID_B));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ keys }));
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address() as AddressInfo;
      jwksUrl = new URL(`http://127.0.0.1:${port}/jwks.json`);
    });

    afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

    function jwkDe(publicKey: crypto.KeyObject, kid: string) {
      return { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'ES256' };
    }

    it('verifica un token firmado con la clave ya publicada (kid conocido), sin refrescar de más', async () => {
      const jwks = createRemoteJWKSet(jwksUrl);
      const guard = new JwtAuthGuard(SECRETO, reflectorFalso(false), ISSUER, jwks);
      const token = jwt.sign({ iss: ISSUER, aud: AUD, sub: 'user-a' }, claveA.privateKey, {
        algorithm: 'ES256',
        keyid: KID_A,
      });

      expect(await guard.canActivate(contextoConHeader(`Bearer ${token}`))).toBe(true);
      expect(solicitudesRecibidas).toBeGreaterThanOrEqual(1);
    });

    it('ante un kid desconocido en el cache, jose refresca el JWKS automáticamente y encuentra la clave nueva', async () => {
      solicitudesRecibidas = 0;
      clavesPublicadas = 'solo-A';
      // `cooldownDuration: 0` SOLO en este test — el default real de `jose` (30s) protege contra
      // refresco abusivo (verificado empíricamente: sin este override, un `kid` desconocido
      // dentro de la ventana de cooldown NO dispara un refetch, lanza `JWKSNoMatchingKey` de
      // inmediato — comportamiento correcto y deseado en producción, pero incompatible con
      // esperar 30s reales en un test unitario). En `auth.module.ts` se usa siempre el default.
      const jwks = createRemoteJWKSet(jwksUrl, { cooldownDuration: 0 });
      const guard = new JwtAuthGuard(SECRETO, reflectorFalso(false), ISSUER, jwks);

      const tokenA = jwt.sign({ iss: ISSUER, aud: AUD, sub: 'user-a' }, claveA.privateKey, {
        algorithm: 'ES256',
        keyid: KID_A,
      });
      expect(await guard.canActivate(contextoConHeader(`Bearer ${tokenA}`))).toBe(true);
      const solicitudesTrasPrimeraLlamada = solicitudesRecibidas;

      // Rotación real: Supabase agrega una clave CURRENT nueva (kid B) sin retirar la anterior.
      clavesPublicadas = 'A-y-B';
      const tokenB = jwt.sign({ iss: ISSUER, aud: AUD, sub: 'user-b' }, claveB.privateKey, {
        algorithm: 'ES256',
        keyid: KID_B,
      });

      // El cache de `jose` todavía no conoce KID_B — debe refrescar automáticamente contra el
      // servidor real y encontrarla, sin que este guard implemente ninguna lógica de refresco.
      expect(await guard.canActivate(contextoConHeader(`Bearer ${tokenB}`))).toBe(true);
      expect(solicitudesRecibidas).toBeGreaterThan(solicitudesTrasPrimeraLlamada);
    });
  });
});
