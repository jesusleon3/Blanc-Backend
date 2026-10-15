import { ResolutorDeServicio, VERSION_SNAPSHOT_COTIZACION } from './resolutor-de-servicio';
import { crearContextoCatalogoFalso, servicioDePrueba } from '../../test-utils/contexto-catalogo-falso';

const INICIO = new Date('2026-12-07T10:00:00.000Z');
const resolutorCon = (...servicios: ReturnType<typeof servicioDePrueba>[]) =>
  new ResolutorDeServicio(crearContextoCatalogoFalso(servicios));

describe('ResolutorDeServicio — integridad del catálogo en Agenda', () => {
  describe('resolver', () => {
    it('devuelve el servicio activo', async () => {
      const servicio = servicioDePrueba();
      await expect(resolutorCon(servicio).resolver(servicio.id)).resolves.toMatchObject({ id: servicio.id, duracionMinutos: 60 });
    });

    it('404 si el servicio no existe: ya no se puede agendar un uuid inventado', async () => {
      await expect(resolutorCon().resolver('44444444-4444-4444-4444-444444444444')).rejects.toMatchObject({
        code: 'RECURSO_NO_ENCONTRADO',
        httpStatus: 404,
      });
    });

    it('409 SERVICIO_INACTIVO si está dado de baja, no 404', async () => {
      // La distinción importa: "no existe" manda a revisar el id; "está de baja" manda a hablar
      // con quien lo dio de baja.
      const servicio = servicioDePrueba({ activo: false });
      await expect(resolutorCon(servicio).resolver(servicio.id)).rejects.toMatchObject({
        code: 'SERVICIO_INACTIVO',
        httpStatus: 409,
      });
    });

    it('409 SERVICIO_SIN_DURACION si el catálogo tiene duración 0', async () => {
      // El catálogo lo permite; una cita de cero minutos produciría un rango vacío que la
      // restricción `EXCLUDE` no puede excluir — la silla quedaría libre durante su propia cita.
      const servicio = servicioDePrueba({ duracionMinutos: 0 });
      await expect(resolutorCon(servicio).resolver(servicio.id)).rejects.toMatchObject({
        code: 'SERVICIO_SIN_DURACION',
        httpStatus: 409,
      });
    });
  });

  describe('resolverParaMoverCita — vender no es lo mismo que mover algo ya vendido', () => {
    it('PERMITE MOVER una cita de un servicio descontinuado despues de la venta', async () => {
      // El fallo que esto corrige: la clienta de un servicio retirado solo podía CANCELAR. Y la
      // que había pagado anticipo quedaba atrapada entre un horario que ya no le servía y una
      // cancelación que puede costarle el anticipo, por una decisión tomada tras su compra.
      const servicio = servicioDePrueba({ activo: false });

      await expect(resolutorCon(servicio).resolverParaMoverCita(servicio.id)).resolves.toMatchObject({
        id: servicio.id,
        activo: false,
        duracionMinutos: 60,
      });
    });

    it('pero SIGUE exigiendo que exista: sin duración no se puede reservar nada', async () => {
      await expect(resolutorCon().resolverParaMoverCita('44444444-4444-4444-4444-444444444444')).rejects.toMatchObject({
        httpStatus: 404,
      });
    });

    it('y sigue exigiendo duración agendable aunque esté de baja', async () => {
      const servicio = servicioDePrueba({ activo: false, duracionMinutos: 0 });
      await expect(resolutorCon(servicio).resolverParaMoverCita(servicio.id)).rejects.toMatchObject({
        code: 'SERVICIO_SIN_DURACION',
      });
    });

    it('la asimetría es deliberada: `resolver` sí rechaza el servicio de baja', async () => {
      // Vender un servicio retirado no se abre; moverlo sí. Si esta prueba y la primera llegaran a
      // coincidir, la distinción se habría perdido.
      const servicio = servicioDePrueba({ activo: false });
      await expect(resolutorCon(servicio).resolver(servicio.id)).rejects.toMatchObject({ code: 'SERVICIO_INACTIVO' });
    });
  });

  describe('derivarRango — la duración la manda el catálogo', () => {
    it('deriva el fin a partir del inicio y la duración del catálogo', () => {
      const servicio = servicioDePrueba({ duracionMinutos: 90 });
      const rango = resolutorCon(servicio).derivarRango(INICIO, undefined, servicio);

      expect(rango.inicio).toEqual(INICIO);
      expect(rango.fin.toISOString()).toBe('2026-12-07T11:30:00.000Z');
    });

    it('acepta un fin que coincide al minuto', () => {
      const servicio = servicioDePrueba({ duracionMinutos: 60 });
      const rango = resolutorCon(servicio).derivarRango(INICIO, new Date('2026-12-07T11:00:00.000Z'), servicio);

      expect(rango.fin.toISOString()).toBe('2026-12-07T11:00:00.000Z');
    });

    it('409 SI EL CLIENTE PIDE MENOS TIEMPO DEL QUE DURA EL SERVICIO', async () => {
      // Antes esto se aceptaba: se podía reservar una hora para un servicio de dos y la silla
      // quedaba libre a mitad del trabajo, lista para venderse otra vez.
      const servicio = servicioDePrueba({ duracionMinutos: 120 });

      expect(() => resolutorCon(servicio).derivarRango(INICIO, new Date('2026-12-07T11:00:00.000Z'), servicio)).toThrow(
        expect.objectContaining({ code: 'DURACION_NO_COINCIDE_CON_SERVICIO', httpStatus: 409 }),
      );
    });

    it('409 si el cliente pide MÁS tiempo: bloquearía una silla que el salón podría vender', () => {
      const servicio = servicioDePrueba({ duracionMinutos: 60 });

      expect(() => resolutorCon(servicio).derivarRango(INICIO, new Date('2026-12-07T13:00:00.000Z'), servicio)).toThrow(
        expect.objectContaining({ code: 'DURACION_NO_COINCIDE_CON_SERVICIO' }),
      );
    });

    it('el error dice el fin esperado, para que el cliente pueda corregirse solo', () => {
      const servicio = servicioDePrueba({ duracionMinutos: 90 });

      expect(() => resolutorCon(servicio).derivarRango(INICIO, new Date('2026-12-07T11:00:00.000Z'), servicio)).toThrow(
        expect.objectContaining({
          details: expect.objectContaining({
            duracionDelCatalogoMinutos: 90,
            duracionSolicitadaMinutos: 60,
            finEsperado: '2026-12-07T11:30:00.000Z',
          }),
        }),
      );
    });

    it('400 ante una fecha de inicio inválida', () => {
      const servicio = servicioDePrueba();
      expect(() => resolutorCon(servicio).derivarRango(new Date('no es fecha'), undefined, servicio)).toThrow(
        expect.objectContaining({ code: 'CITA_RANGO_INVALIDO', httpStatus: 400 }),
      );
    });
  });

  describe('construirSnapshot — lo calcula el backend, nunca el cliente', () => {
    it('congela nombre, categoría, duración y precio oficiales del catálogo', () => {
      const servicio = servicioDePrueba({ nombre: 'Acrílico', precioCentavos: 78000 });
      const snapshot = resolutorCon(servicio).construirSnapshot(servicio, INICIO);

      expect(snapshot).toEqual({
        version: VERSION_SNAPSHOT_COTIZACION,
        congeladoEn: INICIO.toISOString(),
        servicio: { id: servicio.id, nombre: 'Acrílico', categoria: 'aplicacion', duracionMinutos: 60, precioCentavos: 78000 },
        totalCentavos: 78000,
        requiereCotizacionManual: false,
        incluyeModificadores: false,
      });
    });

    it('`DEC-033`: con cotización manual el total es `null`, NO un cero', () => {
      // Un cero diría "cuesta nada". `null` dice "nadie lo ha cotizado todavía", que es la verdad.
      const servicio = servicioDePrueba({ requiereCotizacionManual: true, precioCentavos: 45000 });
      const snapshot = resolutorCon(servicio).construirSnapshot(servicio);

      expect(snapshot.totalCentavos).toBeNull();
      expect(snapshot.requiereCotizacionManual).toBe(true);
      // El precio de referencia del catálogo sí se conserva: sirve a quien vaya a cotizar a mano.
      expect(snapshot.servicio.precioCentavos).toBe(45000);
    });

    it('declara explícitamente que NO incluye modificadores (`RN-COT-01`)', () => {
      // Sumar precios o duraciones de modificadores contradiría `RN-COT-01`, que exige una tabla
      // de combinaciones. El campo está para que nadie suponga que sí van incluidos.
      expect(resolutorCon().construirSnapshot(servicioDePrueba()).incluyeModificadores).toBe(false);
    });

    it('lleva `version`, para poder leer snapshots viejos cuando `FL-COT-03` cambie la forma', () => {
      expect(resolutorCon().construirSnapshot(servicioDePrueba()).version).toBe(1);
    });
  });
});
