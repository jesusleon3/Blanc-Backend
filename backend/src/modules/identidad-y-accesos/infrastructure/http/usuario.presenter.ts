import { Usuario } from '../../domain/entities/usuario.entity';

/** Traduce la entidad de dominio a la forma expuesta por la API — nunca al revés. */
export function usuarioAJson(usuario: Usuario) {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    activa: usuario.activa,
  };
}
