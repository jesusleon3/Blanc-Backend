import { Usuario } from './usuario.entity';
import { DomainError } from '../../../../shared/errors/domain-error';
import { Rol } from '../../../../shared/auth/rol';

describe('Usuario — FL-SEG-01/03', () => {
  it('crea un usuario con email/nombre recortados', () => {
    const usuario = Usuario.crear({ email: '  ana@blanc.mx  ', nombre: '  Ana  ', rol: Rol.RECEPCIONISTA });
    expect(usuario.email).toBe('ana@blanc.mx');
    expect(usuario.nombre).toBe('Ana');
    expect(usuario.rol).toBe(Rol.RECEPCIONISTA);
    expect(usuario.id).toBeDefined();
  });

  it('rechaza un email vacío', () => {
    expect(() => Usuario.crear({ email: '   ', nombre: 'Ana', rol: Rol.RECEPCIONISTA })).toThrow(DomainError);
  });

  it('rechaza un nombre vacío', () => {
    expect(() => Usuario.crear({ email: 'ana@blanc.mx', nombre: '  ', rol: Rol.RECEPCIONISTA })).toThrow(DomainError);
  });

  it('actualizarDatos solo cambia los campos provistos', () => {
    const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
    usuario.actualizarDatos({ nombre: 'Ana María' });
    expect(usuario.nombre).toBe('Ana María');
    expect(usuario.email).toBe('ana@blanc.mx');
  });

  it('actualizarDatos rechaza un email vacío', () => {
    const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
    expect(() => usuario.actualizarDatos({ email: '   ' })).toThrow(DomainError);
  });

  it('cambiarRol aplica el nuevo rol', () => {
    const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
    usuario.cambiarRol(Rol.GERENTE);
    expect(usuario.rol).toBe(Rol.GERENTE);
  });

  it('reconstruir devuelve una entidad con los mismos datos', () => {
    const usuario = Usuario.reconstruir({ id: 'id-1', email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.ADMINISTRADOR, activa: true });
    expect(usuario.id).toBe('id-1');
    expect(usuario.rol).toBe(Rol.ADMINISTRADOR);
  });
});
