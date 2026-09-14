import { DiaFestivo } from './dia-festivo.entity';
import { DomainError } from '../../../../shared/errors/domain-error';

describe('DiaFestivo (entidad hija de Sucursal)', () => {
  it('se crea con una fecha válida', () => {
    const diaFestivo = DiaFestivo.crear({ sucursalId: 'sucursal-1', fecha: '2026-12-25', descripcion: 'Navidad' });
    expect(diaFestivo.fecha).toBe('2026-12-25');
  });

  it('rechaza una fecha con formato inválido', () => {
    expect(() => DiaFestivo.crear({ sucursalId: 'sucursal-1', fecha: '25/12/2026' })).toThrow(DomainError);
  });
});
