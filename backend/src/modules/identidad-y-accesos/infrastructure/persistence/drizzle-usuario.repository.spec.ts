import { crearBaseDeDatosDePrueba } from '../../../../database/test-utils/postgres-de-prueba';
import { DrizzleUsuarioRepository } from './drizzle-usuario.repository';
import { Usuario } from '../../domain/entities/usuario.entity';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';
import { Rol } from '../../../../shared/auth/rol';

// `sucursal_id` es una columna `uuid` real (sin FK cruzada, ADR-005) — PostgreSQL valida el
// formato al castear, a diferencia de una columna `text`. Se usan UUIDs fijos, no strings
// arbitrarios.
const SUC_1 = '11111111-1111-1111-1111-111111111111';
const SUC_2 = '22222222-2222-2222-2222-222222222222';
const SUC_INEXISTENTE = '99999999-9999-9999-9999-999999999999';

/** Integración contra PostgreSQL real (Testcontainers) — no un mock del repositorio. */
describe('DrizzleUsuarioRepository (integración) — FL-SEG-01/03/04/05', () => {
  it('buscarPorId devuelve null si no existe', async () => {
    const repo = new DrizzleUsuarioRepository(await crearBaseDeDatosDePrueba());
    expect(await repo.buscarPorId('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('guarda y recupera un usuario por id y por email, activo por defecto', async () => {
    const repo = new DrizzleUsuarioRepository(await crearBaseDeDatosDePrueba());
    const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
    await repo.guardar(usuario);

    const porId = await repo.buscarPorId(usuario.id);
    expect(porId?.email).toBe('ana@blanc.mx');
    expect(porId?.activa).toBe(true);

    const porEmail = await repo.buscarPorEmail('ana@blanc.mx');
    expect(porEmail?.id).toBe(usuario.id);
  });

  it('persiste la desactivación (FL-SEG-05)', async () => {
    const repo = new DrizzleUsuarioRepository(await crearBaseDeDatosDePrueba());
    const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
    await repo.guardar(usuario);

    usuario.desactivar();
    await repo.guardar(usuario);

    const recargado = await repo.buscarPorId(usuario.id);
    expect(recargado?.activa).toBe(false);
  });

  it('guardar sobre un id existente actualiza (upsert), no duplica', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const repo = new DrizzleUsuarioRepository(db);
    const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
    await repo.guardar(usuario);

    usuario.cambiarRol(Rol.GERENTE);
    await repo.guardar(usuario);

    const recargado = await repo.buscarPorId(usuario.id);
    expect(recargado?.rol).toBe(Rol.GERENTE);
  });

  it('la restricción UNIQUE de email se traduce a ConflictoDeNegocioError (409), no un error crudo de Postgres', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const repo = new DrizzleUsuarioRepository(db);
    await repo.guardar(Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA }));

    const intento = repo.guardar(Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Otra Ana', rol: Rol.GERENTE }));
    await expect(intento).rejects.toThrow(ConflictoDeNegocioError);
    await expect(intento).rejects.toMatchObject({ code: 'USUARIO_EMAIL_DUPLICADO', httpStatus: 409 });
  });

  it('asignarASucursal inserta el par usuario-sucursal', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const repo = new DrizzleUsuarioRepository(db);
    const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
    await repo.guardar(usuario);

    await expect(repo.asignarASucursal(usuario.id, SUC_1)).resolves.toBeUndefined();
  });

  it('la restricción UNIQUE(usuario_id, sucursal_id) se traduce a ConflictoDeNegocioError (409)', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const repo = new DrizzleUsuarioRepository(db);
    const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
    await repo.guardar(usuario);
    await repo.asignarASucursal(usuario.id, SUC_1);

    const intento = repo.asignarASucursal(usuario.id, SUC_1);
    await expect(intento).rejects.toThrow(ConflictoDeNegocioError);
    await expect(intento).rejects.toMatchObject({ code: 'USUARIO_YA_ASIGNADO', httpStatus: 409 });
  });

  it('removerDeSucursal sobre un par inexistente no falla (no-op, mismo precedente que Manicuristas)', async () => {
    const repo = new DrizzleUsuarioRepository(await crearBaseDeDatosDePrueba());
    await expect(repo.removerDeSucursal('00000000-0000-0000-0000-000000000000', SUC_INEXISTENTE)).resolves.toBeUndefined();
  });

  it('removerDeSucursal elimina solo el par indicado', async () => {
    const db = await crearBaseDeDatosDePrueba();
    const repo = new DrizzleUsuarioRepository(db);
    const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
    await repo.guardar(usuario);
    await repo.asignarASucursal(usuario.id, SUC_1);
    await repo.asignarASucursal(usuario.id, SUC_2);

    await repo.removerDeSucursal(usuario.id, SUC_1);

    // Sin endpoint de consulta en este alcance — se verifica indirectamente: remover el par
    // restante y luego reasignarlo no debe chocar con una fila que debiera haberse borrado.
    await expect(repo.asignarASucursal(usuario.id, SUC_1)).resolves.toBeUndefined();
    await expect(repo.asignarASucursal(usuario.id, SUC_2)).rejects.toThrow(ConflictoDeNegocioError);
  });

  describe('vincularCuentaExterna — FL-SEG-06, guardia de concurrencia (DEC-028)', () => {
    const CUENTA_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const CUENTA_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    it('un usuario recién creado nace sin vínculo', async () => {
      const repo = new DrizzleUsuarioRepository(await crearBaseDeDatosDePrueba());
      const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
      await repo.guardar(usuario);

      expect((await repo.buscarPorId(usuario.id))?.supabaseUserId).toBeNull();
      expect((await repo.buscarPorId(usuario.id))?.estaProvisionado).toBe(false);
    });

    it('vincula cuando `supabase_user_id` es NULL y el vínculo queda persistido', async () => {
      const repo = new DrizzleUsuarioRepository(await crearBaseDeDatosDePrueba());
      const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
      await repo.guardar(usuario);

      await expect(repo.vincularCuentaExterna(usuario.id, CUENTA_A)).resolves.toBe(true);

      const recuperado = await repo.buscarPorId(usuario.id);
      expect(recuperado?.supabaseUserId).toBe(CUENTA_A);
      expect(recuperado?.estaProvisionado).toBe(true);
    });

    it('la guardia impide sobrescribir un vínculo existente: devuelve false y NO machaca el valor', async () => {
      const repo = new DrizzleUsuarioRepository(await crearBaseDeDatosDePrueba());
      const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
      await repo.guardar(usuario);
      await repo.vincularCuentaExterna(usuario.id, CUENTA_A);

      // Simula la ejecución que pierde la carrera: llega con otra cuenta recién creada.
      await expect(repo.vincularCuentaExterna(usuario.id, CUENTA_B)).resolves.toBe(false);

      expect((await repo.buscarPorId(usuario.id))?.supabaseUserId).toBe(CUENTA_A);
    });

    it('devuelve false si el usuario no existe, sin lanzar', async () => {
      const repo = new DrizzleUsuarioRepository(await crearBaseDeDatosDePrueba());
      await expect(repo.vincularCuentaExterna('00000000-0000-0000-0000-000000000000', CUENTA_A)).resolves.toBe(false);
    });

    it('obtenerPermisosPorSupabaseUserId devuelve null si ninguna fila referencia esa cuenta', async () => {
      const repo = new DrizzleUsuarioRepository(await crearBaseDeDatosDePrueba());
      await expect(repo.obtenerPermisosPorSupabaseUserId(CUENTA_A)).resolves.toBeNull();
    });

    it('obtenerPermisosPorSupabaseUserId devuelve rol, activa y las sucursales asignadas', async () => {
      const repo = new DrizzleUsuarioRepository(await crearBaseDeDatosDePrueba());
      const usuario = Usuario.crear({ email: 'gera@blanc.mx', nombre: 'Gera', rol: Rol.GERENTE });
      await repo.guardar(usuario);
      await repo.vincularCuentaExterna(usuario.id, CUENTA_A);
      await repo.asignarASucursal(usuario.id, SUC_1);
      await repo.asignarASucursal(usuario.id, SUC_2);

      const permisos = await repo.obtenerPermisosPorSupabaseUserId(CUENTA_A);

      expect(permisos?.rol).toBe(Rol.GERENTE);
      expect(permisos?.activa).toBe(true);
      expect([...(permisos?.sucursales as string[])].sort()).toEqual([SUC_1, SUC_2].sort());
    });

    it('refleja la desactivación en la lectura de autorización (FL-SEG-05 con efecto real)', async () => {
      const repo = new DrizzleUsuarioRepository(await crearBaseDeDatosDePrueba());
      const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
      await repo.guardar(usuario);
      await repo.vincularCuentaExterna(usuario.id, CUENTA_A);

      usuario.desactivar();
      await repo.guardar(usuario);

      expect((await repo.obtenerPermisosPorSupabaseUserId(CUENTA_A))?.activa).toBe(false);
    });

    it('aplica RN-SEG-03: Analista sin filas asignadas obtiene alcance GLOBAL', async () => {
      const repo = new DrizzleUsuarioRepository(await crearBaseDeDatosDePrueba());
      const usuario = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.ANALISTA });
      await repo.guardar(usuario);
      await repo.vincularCuentaExterna(usuario.id, CUENTA_A);

      expect((await repo.obtenerPermisosPorSupabaseUserId(CUENTA_A))?.sucursales).toBe('GLOBAL');
    });

    it('varios usuarios sin provisionar coexisten pese al índice UNIQUE (NULL no colisiona)', async () => {
      const repo = new DrizzleUsuarioRepository(await crearBaseDeDatosDePrueba());
      const uno = Usuario.crear({ email: 'ana@blanc.mx', nombre: 'Ana', rol: Rol.RECEPCIONISTA });
      const dos = Usuario.crear({ email: 'bea@blanc.mx', nombre: 'Bea', rol: Rol.GERENTE });

      await repo.guardar(uno);
      await expect(repo.guardar(dos)).resolves.toBeUndefined();

      expect((await repo.buscarPorId(uno.id))?.supabaseUserId).toBeNull();
      expect((await repo.buscarPorId(dos.id))?.supabaseUserId).toBeNull();
    });
  });
});
