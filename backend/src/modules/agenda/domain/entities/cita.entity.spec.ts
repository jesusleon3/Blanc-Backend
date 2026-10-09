import { Cita } from './cita.entity';
import { Silla } from './silla.entity';
import { DomainError } from '../../../../shared/errors/domain-error';

const BASE = {
  sucursalId: '11111111-1111-1111-1111-111111111111',
  sillaId: '22222222-2222-2222-2222-222222222222',
  clientaId: '33333333-3333-3333-3333-333333333333',
  servicioId: '44444444-4444-4444-4444-444444444444',
  rangoHorario: { inicio: new Date('2026-11-02T10:00:00Z'), fin: new Date('2026-11-02T11:00:00Z') },
};

describe('Cita — aggregate raíz de Agenda (Fase 2, alcance de datos)', () => {
  it('nace `agendada` y sin manicurista: "sin preferencia" es el caso normal, no un dato faltante', () => {
    const cita = Cita.crear(BASE);

    expect(cita.estado).toBe('agendada');
    expect(cita.manicuristaId).toBeNull();
    expect(cita.sillaId).toBe(BASE.sillaId);
  });

  describe('validación del rango', () => {
    it('rechaza un fin anterior al inicio', () => {
      const invertido = { inicio: new Date('2026-11-02T11:00:00Z'), fin: new Date('2026-11-02T10:00:00Z') };
      expect(() => Cita.crear({ ...BASE, rangoHorario: invertido })).toThrow(expect.objectContaining({ code: 'CITA_RANGO_INVALIDO' }));
    });

    it('rechaza un rango de duración cero', () => {
      const instante = new Date('2026-11-02T10:00:00Z');
      expect(() => Cita.crear({ ...BASE, rangoHorario: { inicio: instante, fin: instante } })).toThrow(DomainError);
    });

    it('rechaza una fecha inválida', () => {
      const roto = { inicio: new Date('no-es-fecha'), fin: new Date('2026-11-02T11:00:00Z') };
      expect(() => Cita.crear({ ...BASE, rangoHorario: roto })).toThrow(DomainError);
    });
  });

  describe('`ocupaHorario` — la lista de DEC-034', () => {
    it.each(['agendada', 'en_espera_pago', 'completada'] as const)('`%s` OCUPA el horario', (estado) => {
      const cita = Cita.crear(BASE);
      cita.cambiarEstado(estado);
      expect(cita.ocupaHorario).toBe(true);
    });

    it.each(['cancelada', 'expirada', 'reprogramada'] as const)('`%s` LIBERA el horario', (estado) => {
      const cita = Cita.crear(BASE);
      cita.cambiarEstado(estado);
      expect(cita.ocupaHorario).toBe(false);
    });
  });

  it('rechaza un estado que no existe', () => {
    const cita = Cita.crear(BASE);
    expect(() => cita.cambiarEstado('inventado' as never)).toThrow(expect.objectContaining({ code: 'CITA_ESTADO_INVALIDO' }));
  });

  it('asignarManicurista fija el id — la validación de solape la hace la base de datos, no esta clase', () => {
    const cita = Cita.crear(BASE);
    cita.asignarManicurista('55555555-5555-5555-5555-555555555555');

    // Deliberadamente NO comprueba disponibilidad: duplicar esa comprobación en memoria daría
    // una falsa sensación de seguridad y podría divergir de la restricción real.
    expect(cita.manicuristaId).toBe('55555555-5555-5555-5555-555555555555');
  });
});

describe('Silla — la capacidad de la sucursal son filas, no una constante', () => {
  it('nace activa', () => {
    expect(Silla.crear({ sucursalId: BASE.sucursalId, nombre: 'Lomas 1' }).activa).toBe(true);
  });

  it('normaliza el nombre y rechaza el vacío', () => {
    expect(Silla.crear({ sucursalId: BASE.sucursalId, nombre: '  Lomas 1  ' }).nombre).toBe('Lomas 1');
    expect(() => Silla.crear({ sucursalId: BASE.sucursalId, nombre: '   ' })).toThrow(
      expect.objectContaining({ code: 'SILLA_NOMBRE_REQUERIDO' }),
    );
  });

  it('se da de baja lógicamente: una silla retirada sobrevive en las citas históricas', () => {
    const silla = Silla.crear({ sucursalId: BASE.sucursalId, nombre: 'Lomas 1' });
    silla.desactivar();
    expect(silla.activa).toBe(false);
    silla.activar();
    expect(silla.activa).toBe(true);
  });
});
