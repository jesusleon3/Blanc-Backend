import { CanActivate, ExecutionContext, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ClaimsUsuario } from './rol';
import { IS_PUBLIC_KEY } from './public.decorator';
import { PermisosUsuarioPort } from './permisos-usuario.port';

/**
 * Capa de autorización de `DEC-029` (C2) — segundo guard de la cadena, entre `JwtAuthGuard` y
 * `RolesGuard`.
 *
 * RESPONSABILIDAD: traducir la identidad autenticada (`sub`) en los permisos REALES de Blanc,
 * leídos de PostgreSQL —la fuente de verdad según `DEC-024`— en cada petición. No verifica
 * firmas ni algoritmos (eso es `JwtAuthGuard`) y no decide si un rol basta para un endpoint
 * (eso es `RolesGuard`): solo responde "qué puede hacer hoy esta persona".
 *
 * POR QUÉ CONSULTAR EN CADA PETICIÓN: los permisos incrustados en un JWT envejecen. Con
 * `access token expiry = 3600s`, un cambio de rol o una desactivación tardaban hasta una hora en
 * surtir efecto, y quien no refrescaba conservaba los permisos viejos la ventana completa
 * (riesgo R1 / `FL-SEG-05`). Leer la verdad elimina esa ventana.
 *
 * LÍMITE QUE DEBE ENUNCIARSE SIN AMBIGÜEDAD: esto **no revoca criptográficamente** el JWT. El
 * token sigue siendo válido y verificable hasta su expiración; lo que se logra es que Blanc deje
 * de concederle autorización. La revocación real de sesión depende de Supabase
 * (`admin.signOut`/`ban_duration`), fuera de este guard.
 *
 * FAIL-CLOSED: ante un fallo de base de datos se deniega el acceso. Nunca se asume un rol por
 * defecto, nunca se deja pasar "por si acaso", y el error se reporta como indisponibilidad
 * (`503`), no como `401` ni `403`: no es una decisión de permisos, es infraestructura caída.
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly permisos: PermisosUsuarioPort,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (esPublico) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const autenticado = request.identidad;

    if (!autenticado?.sub) {
      // Sin identidad autenticada no hay nada que autorizar. En la cadena real esto es
      // inalcanzable —`JwtAuthGuard` ya habría rechazado la petición—, pero el guard no depende
      // de ese supuesto: si alguien reordena la cadena, falla cerrado en vez de dejar pasar.
      throw new ForbiddenException({
        error: { category: 'domain', code: 'IDENTIDAD_NO_RESUELTA', message: 'No hay una identidad autenticada que autorizar.' },
      });
    }

    const permisos = await this.consultar(autenticado.sub);

    if (!permisos) {
      // Autenticado correctamente, pero ninguna fila de Blanc lo referencia: la cuenta existe en
      // Supabase y no está provisionada (`FL-SEG-06`). Es 403, no 401: el token es impecable y
      // volver a autenticarse no cambiaría nada.
      throw new ForbiddenException({
        error: {
          category: 'domain',
          code: 'USUARIO_NO_PROVISIONADO',
          message: 'Tu cuenta de acceso no está vinculada a un usuario de Blanc.',
        },
      });
    }

    if (!permisos.activa) {
      // `FL-SEG-05` con efecto real: la desactivación surte efecto en esta misma petición.
      throw new ForbiddenException({
        error: { category: 'domain', code: 'USUARIO_INACTIVO', message: 'Tu usuario está desactivado.' },
      });
    }

    const claims: ClaimsUsuario = {
      sub: autenticado.sub,
      rol: permisos.rol,
      sucursales: permisos.sucursales,
    };

    // Se sobrescribe deliberadamente: lo que venga en el token no es autoridad sobre rol ni
    // sucursales (`DEC-024`). `RolesGuard` y los casos de uso leen esta forma sin cambio alguno.
    request.usuario = claims;
    return true;
  }

  private async consultar(sub: string) {
    try {
      return await this.permisos.obtenerPermisosPorSupabaseUserId(sub);
    } catch {
      // Fail-closed. El detalle del fallo no se expone al cliente; el filtro de excepciones y el
      // correlation id permiten rastrearlo.
      throw new ServiceUnavailableException({
        error: {
          category: 'infrastructure',
          code: 'AUTORIZACION_NO_DISPONIBLE',
          message: 'No se pudo verificar tus permisos en este momento.',
        },
      });
    }
  }
}
