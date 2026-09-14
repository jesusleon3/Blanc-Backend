import { Manicurista } from './manicurista.entity';
import { DomainError } from '../../../../shared/errors/domain-error';

describe('Manicurista (registro administrativo) — FL-SUC-03', () => {
  it('se crea activa por defecto', () => {
    const manicurista = Manicurista.crear({ nombre: 'Karla Espinoza' });
    expect(manicurista.activa).toBe(true);
  });

  it('rechaza un nombre vacío', () => {
    expect(() => Manicurista.crear({ nombre: '' })).toThrow(DomainError);
  });

  it('se puede desactivar y reactivar (baja/alta administrativa)', () => {
    const manicurista = Manicurista.crear({ nombre: 'Karla Espinoza' });
    manicurista.desactivar();
    expect(manicurista.activa).toBe(false);
    manicurista.activar();
    expect(manicurista.activa).toBe(true);
  });
});
