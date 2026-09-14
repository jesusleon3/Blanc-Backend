import { Injectable } from '@nestjs/common';
import { CuentaExternaCreada, IdentidadExternaPort } from '../../domain/ports/identidad-externa.port';
import { ConflictoDeNegocioError, DomainError } from '../../../../shared/errors/domain-error';

/**
 * Adaptador de `IdentidadExternaPort` contra la Admin API de Supabase (`FL-SEG-06`, `DEC-028`).
 *
 * Usa `fetch` nativo del runtime — deliberadamente sin `@supabase/supabase-js`: la única
 * operación que este flujo necesita es un `POST` a un endpoint REST, y añadir un SDK completo
 * para eso sería infraestructura injustificada (`IMPLEMENTATION_MASTER_PLAN.md`, principio 1).
 *
 * `createUser` **sin contraseña** (`DEC-028`): se envía únicamente el email. Tampoco se envía
 * `email_confirm` — esa opción quedó explícitamente sin decidir en `DEC-028` y elegirla aquí, de
 * forma implícita, sería tomar una decisión que nadie tomó.
 *
 * La Service Role Key solo viaja en los encabezados de la petición: nunca se registra, nunca se
 * incluye en mensajes de error, nunca sale de este archivo.
 */
@Injectable()
export class SupabaseAdminIdentidadExternaAdapter implements IdentidadExternaPort {
  constructor(
    private readonly supabaseUrl: string,
    private readonly serviceRoleKey: string,
  ) {}

  async crearCuenta(input: { email: string }): Promise<CuentaExternaCreada> {
    const respuesta = await this.peticion(input.email);
    const cuerpo: unknown = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      throw this.traducirError(respuesta.status, cuerpo);
    }

    const id = this.extraerId(cuerpo);
    if (!id) {
      // El contrato oficial garantiza `id` en una respuesta 200 de `POST /admin/users`, pero la
      // respuesta llega sin validar: confiar ciegamente escribiría `undefined` en
      // `supabase_user_id` sin que TypeScript lo advirtiera.
      throw new DomainError(
        'PROVISION_SUPABASE_RESPUESTA_INVALIDA',
        'Supabase creó la cuenta pero no devolvió un identificador utilizable.',
        502,
      );
    }

    return { id };
  }

  private async peticion(email: string): Promise<Response> {
    try {
      return await fetch(`${this.supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
        },
        body: JSON.stringify({ email }),
      });
    } catch (error) {
      // Fallo de red/DNS/timeout: no se creó nada en Supabase, el reintento es seguro.
      throw new DomainError(
        'PROVISION_SUPABASE_NO_DISPONIBLE',
        'No se pudo contactar al proveedor de identidad.',
        502,
        { causa: error instanceof Error ? error.name : 'desconocida' },
      );
    }
  }

  /**
   * Traduce el rechazo de Supabase a un error de dominio.
   *
   * El caso "el email ya tiene cuenta" se distingue explícitamente porque **no es un fallo del
   * sistema, es un estado de negocio**: significa que existe una cuenta preexistente que este
   * flujo no sabe adoptar. `DEC-028` dejó la política de adopción como `PENDING`, así que aquí se
   * propaga un conflicto claro y se detiene — nunca se intenta vincular a ciegas.
   */
  private traducirError(status: number, cuerpo: unknown): DomainError {
    const codigoSupabase = this.extraerCodigo(cuerpo);

    if (codigoSupabase === 'email_exists' || codigoSupabase === 'user_already_exists' || status === 422) {
      return new ConflictoDeNegocioError(
        'IDENTIDAD_EXTERNA_YA_EXISTE',
        'Ya existe una cuenta de acceso con ese email en el proveedor de identidad. La adopción de cuentas preexistentes no está implementada (DEC-028).',
        { codigoProveedor: codigoSupabase ?? null },
      );
    }

    return new DomainError('PROVISION_SUPABASE_FALLIDA', 'El proveedor de identidad rechazó la creación de la cuenta.', 502, {
      estadoProveedor: status,
      codigoProveedor: codigoSupabase ?? null,
    });
  }

  private extraerId(cuerpo: unknown): string | null {
    if (typeof cuerpo !== 'object' || cuerpo === null) return null;
    // La Admin API devuelve el objeto de usuario en la raíz; algunos clientes lo envuelven en
    // `user`. Se aceptan ambas formas, igual que hace el SDK oficial.
    const raiz = cuerpo as Record<string, unknown>;
    const usuario = (typeof raiz.user === 'object' && raiz.user !== null ? raiz.user : raiz) as Record<string, unknown>;
    return typeof usuario.id === 'string' && usuario.id.trim() !== '' ? usuario.id : null;
  }

  private extraerCodigo(cuerpo: unknown): string | null {
    if (typeof cuerpo !== 'object' || cuerpo === null) return null;
    const raiz = cuerpo as Record<string, unknown>;
    // Supabase Auth usa `error_code` en unas respuestas y `code` en otras.
    const codigo = raiz.error_code ?? raiz.code;
    return typeof codigo === 'string' ? codigo : null;
  }
}
