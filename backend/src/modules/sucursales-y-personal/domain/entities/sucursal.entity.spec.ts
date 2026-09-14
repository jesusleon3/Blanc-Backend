import { Sucursal } from './sucursal.entity';
import { DomainError } from '../../../../shared/errors/domain-error';

const HORARIO = {
  lunes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  martes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  miercoles: [{ horaInicio: '09:00', horaFin: '18:00' }],
  jueves: [{ horaInicio: '09:00', horaFin: '18:00' }],
  viernes: [{ horaInicio: '09:00', horaFin: '18:00' }],
  sabado: [{ horaInicio: '09:00', horaFin: '15:00' }],
  domingo: [],
};

describe('Sucursal (aggregate raíz) — RN-SUC-01, RN-SUC-02', () => {
  it('se crea con un id generado y sin estar en mantenimiento', () => {
    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    expect(sucursal.id).toBeDefined();
    expect(sucursal.enMantenimiento).toBe(false);
  });

  it('rechaza un nombre vacío', () => {
    expect(() => Sucursal.crear({ nombre: '   ', horarioSemanal: HORARIO })).toThrow(DomainError);
  });

  it('recorta espacios del nombre', () => {
    const sucursal = Sucursal.crear({ nombre: '  Blanc Condesa  ', horarioSemanal: HORARIO });
    expect(sucursal.nombre).toBe('Blanc Condesa');
  });

  it('RN-SUC-01: la configuración vive scoped en la propia sucursal, sin afectar otras instancias', () => {
    const a = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    const b = Sucursal.crear({ nombre: 'Blanc Condesa', horarioSemanal: HORARIO });
    a.actualizarConfiguracion({ numeroWhatsappAlias: 'alias-a' });
    expect(b.numeroWhatsappAlias).toBeNull();
  });

  it('RN-SUC-02: activar/desactivar mantenimiento es reversible y no altera el resto de la configuración', () => {
    const sucursal = Sucursal.crear({ nombre: 'Blanc Santa Fe', horarioSemanal: HORARIO });
    sucursal.activarMantenimiento();
    expect(sucursal.enMantenimiento).toBe(true);
    expect(sucursal.nombre).toBe('Blanc Santa Fe');

    sucursal.desactivarMantenimiento();
    expect(sucursal.enMantenimiento).toBe(false);
  });

  it('actualizarConfiguracion solo cambia los campos provistos', () => {
    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO, numeroWhatsappAlias: 'original' });
    sucursal.actualizarConfiguracion({ nombre: 'Blanc Polanco Norte' });
    expect(sucursal.nombre).toBe('Blanc Polanco Norte');
    expect(sucursal.numeroWhatsappAlias).toBe('original');
  });

  it('actualizarConfiguracion rechaza vaciar el nombre', () => {
    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO });
    expect(() => sucursal.actualizarConfiguracion({ nombre: '' })).toThrow(DomainError);
  });

  it('descansos se persiste como dato opaco, sin validación de forma (ver reporte de cierre del módulo)', () => {
    const sucursal = Sucursal.crear({ nombre: 'Blanc Polanco', horarioSemanal: HORARIO, descansos: { cualquierCosa: true } });
    expect(sucursal.descansos).toEqual({ cualquierCosa: true });
  });
});
