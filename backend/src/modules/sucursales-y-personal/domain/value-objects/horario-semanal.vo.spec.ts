import { HorarioSemanal, HorarioSemanalData } from './horario-semanal.vo';
import { DomainError } from '../../../../shared/errors/domain-error';

function horarioBase(overrides: Partial<HorarioSemanalData> = {}): HorarioSemanalData {
  return {
    lunes: [{ horaInicio: '09:00', horaFin: '18:00' }],
    martes: [{ horaInicio: '09:00', horaFin: '18:00' }],
    miercoles: [{ horaInicio: '09:00', horaFin: '18:00' }],
    jueves: [{ horaInicio: '09:00', horaFin: '18:00' }],
    viernes: [{ horaInicio: '09:00', horaFin: '18:00' }],
    sabado: [{ horaInicio: '09:00', horaFin: '15:00' }],
    domingo: [],
    ...overrides,
  };
}

describe('HorarioSemanal (Value Object) — RN-AGE-10, RN-AGE-12', () => {
  it('se crea válidamente con bloques discontinuos por día', () => {
    const horario = HorarioSemanal.crear(
      horarioBase({ lunes: [{ horaInicio: '09:00', horaFin: '12:00' }, { horaInicio: '15:00', horaFin: '18:00' }] }),
    );
    expect(horario.estaAbiertoEl('lunes')).toBe(true);
  });

  it('un día con arreglo vacío se considera cerrado (RN-AGE-12, domingo por defecto en Blanc)', () => {
    const horario = HorarioSemanal.crear(horarioBase({ domingo: [] }));
    expect(horario.estaAbiertoEl('domingo')).toBe(false);
  });

  it('no fuerza que domingo esté cerrado — es un dato, no una regla del Value Object', () => {
    const horario = HorarioSemanal.crear(horarioBase({ domingo: [{ horaInicio: '10:00', horaFin: '14:00' }] }));
    expect(horario.estaAbiertoEl('domingo')).toBe(true);
  });

  it('rechaza un día faltante en el objeto', () => {
    const incompleto = horarioBase();
    delete (incompleto as Partial<HorarioSemanalData>).jueves;
    expect(() => HorarioSemanal.crear(incompleto as HorarioSemanalData)).toThrow(DomainError);
  });

  it('rechaza un formato de hora inválido', () => {
    expect(() => HorarioSemanal.crear(horarioBase({ lunes: [{ horaInicio: '9:00', horaFin: '18:00' }] }))).toThrow(
      /horario inválido/,
    );
  });

  it('rechaza un bloque con hora de inicio igual o después de la hora de fin', () => {
    expect(() => HorarioSemanal.crear(horarioBase({ lunes: [{ horaInicio: '18:00', horaFin: '09:00' }] }))).toThrow(
      /igual o después/,
    );
  });

  it('rechaza bloques superpuestos dentro del mismo día', () => {
    expect(() =>
      HorarioSemanal.crear(
        horarioBase({
          lunes: [
            { horaInicio: '09:00', horaFin: '13:00' },
            { horaInicio: '12:00', horaFin: '18:00' },
          ],
        }),
      ),
    ).toThrow(/superpon/);
  });

  it('acepta el horario partido con corte de mediodía (caso real de Blanc, DISCOVERY_CHECKLIST 1.3)', () => {
    const horario = HorarioSemanal.crear(
      horarioBase({
        lunes: [
          { horaInicio: '09:00', horaFin: '12:00' },
          { horaInicio: '15:00', horaFin: '18:00' },
        ],
      }),
    );
    expect(horario.toJSON().lunes).toHaveLength(2);
  });
});
