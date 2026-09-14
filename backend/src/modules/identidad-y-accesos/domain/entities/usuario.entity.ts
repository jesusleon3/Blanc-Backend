import { randomUUID } from 'crypto';
import { DomainError } from '../../../../shared/errors/domain-error';
import { Rol } from '../../../../shared/auth/rol';

export interface UsuarioProps {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activa: boolean;
  /**
   * Vínculo con la cuenta de Supabase Auth (`DEC-021`). `null` = usuario todavía no provisionado,
   * que es el estado normal de todo usuario recién creado por `FL-SEG-01` — no un error.
   * Opcional en la interfaz para no obligar a declararlo donde no importa; se normaliza a `null`.
   */
  supabaseUserId?: string | null;
}

/**
 * `Usuario` — aggregate raíz del registro administrativo interno (01-domain-discovery.md §5.8).
 * Alcance explícito de este incremento (FL-SEG-01/03): solo el registro de Blanc — no crea, no
 * referencia ni sincroniza ninguna cuenta de Supabase Auth. Esa integración es `FL-SEG-06`,
 * deliberadamente fuera de esta entidad (ver `ADR-024`, ver reporte de cierre de esta iteración).
 */
export class Usuario {
  private constructor(private props: UsuarioProps) {}

  static crear(input: { email: string; nombre: string; rol: Rol }): Usuario {
    const email = input.email.trim();
    const nombre = input.nombre.trim();
    if (email.length === 0) {
      throw new DomainError('USUARIO_EMAIL_REQUERIDO', 'El email del usuario no puede estar vacío.', 400);
    }
    if (nombre.length === 0) {
      throw new DomainError('USUARIO_NOMBRE_REQUERIDO', 'El nombre del usuario no puede estar vacío.', 400);
    }
    return new Usuario({ id: randomUUID(), email, nombre, rol: input.rol, activa: true });
  }

  static reconstruir(props: UsuarioProps): Usuario {
    return new Usuario(props);
  }

  actualizarDatos(input: { email?: string; nombre?: string }): void {
    if (input.email !== undefined) {
      const email = input.email.trim();
      if (email.length === 0) {
        throw new DomainError('USUARIO_EMAIL_REQUERIDO', 'El email del usuario no puede estar vacío.', 400);
      }
      this.props.email = email;
    }
    if (input.nombre !== undefined) {
      const nombre = input.nombre.trim();
      if (nombre.length === 0) {
        throw new DomainError('USUARIO_NOMBRE_REQUERIDO', 'El nombre del usuario no puede estar vacío.', 400);
      }
      this.props.nombre = nombre;
    }
  }

  /** La autorización de quién puede asignar qué rol vive fuera de la entidad (`puedeAsignarRol`,
   * `shared/auth/rol.ts`) — este método solo aplica el cambio ya autorizado por el caso de uso. */
  cambiarRol(nuevoRol: Rol): void {
    this.props.rol = nuevoRol;
  }

  /**
   * FL-SEG-05, alcance mínimo. Revoca únicamente el registro administrativo de Blanc — no tiene
   * efecto sobre sesiones/tokens ya emitidos (`FL-SEG-06`, fuera de esta entidad). La
   * autorización de quién puede desactivar a quién (auto-desactivación, jerarquía de Super
   * Admin) vive en el caso de uso, no aquí — mismo criterio que `cambiarRol`.
   */
  desactivar(): void {
    this.props.activa = false;
  }

  get id(): string {
    return this.props.id;
  }
  get email(): string {
    return this.props.email;
  }
  get nombre(): string {
    return this.props.nombre;
  }
  get rol(): Rol {
    return this.props.rol;
  }
  get activa(): boolean {
    return this.props.activa;
  }
  /** `null` mientras el usuario no haya sido provisionado en Supabase (`FL-SEG-06`). */
  get supabaseUserId(): string | null {
    return this.props.supabaseUserId ?? null;
  }
  /** `true` si ya tiene cuenta de acceso vinculada — marcador de completitud de `FL-SEG-06`
   * (`DEC-028`: no existe una columna de estado aparte, este es el único marcador). */
  get estaProvisionado(): boolean {
    return this.supabaseUserId !== null;
  }
}
