import { esInstanteIso } from './es-instante-iso.decorator';

/**
 * ## ESTA PRUEBA EXISTE POR UN DEFECTO REAL (auditoría 2026-10-17)
 *
 * Todos los campos de instante de la API usaban `@IsISO8601({ strict: true })`, que **acepta una
 * fecha sin hora**. El efecto no era un error: era un desplazamiento silencioso de seis horas, que
 * en la agenda de un día significaba perder las citas de la tarde y en Analítica correr el mes
 * entero. Los casos de abajo son exactamente los que antes pasaban.
 */
describe('`esInstanteIso` — un instante lleva hora Y zona', () => {
  describe('ACEPTA', () => {
    it.each([
      ['UTC con milisegundos (lo que produce `toISOString`)', '2027-03-08T17:00:00.000Z'],
      ['UTC sin milisegundos', '2027-03-08T17:00:00Z'],
      ['UTC sin segundos', '2027-03-08T17:00Z'],
      ['hora de pared de Querétaro con su desfase', '2027-03-08T11:00:00-06:00'],
      ['desfase positivo', '2027-03-08T23:00:00+02:00'],
    ])('%s', (_caso, valor) => {
      expect(esInstanteIso(valor)).toBe(true);
    });
  });

  describe('RECHAZA', () => {
    it.each([
      // El caso central: `new Date('2027-03-08')` son las 18:00 del día 7 en Querétaro.
      ['una fecha de pared sin hora', '2027-03-08'],
      // `new Date` lo resolvería en la zona DEL PROCESO, que en Railway es UTC.
      ['hora sin zona', '2027-03-08T11:00:00'],
      ['hora sin zona ni segundos', '2027-03-08T11:00'],
      ['desfase sin dos puntos', '2027-03-08T11:00:00-0600'],
      ['una fecha que no existe', '2027-02-30T11:00:00Z'],
      ['texto cualquiera', 'mañana a las once'],
      ['vacío', ''],
      ['un número', 1_772_000_000_000],
      ['nulo', null],
      ['ausente', undefined],
    ])('%s', (_caso, valor) => {
      expect(esInstanteIso(valor)).toBe(false);
    });
  });

  it('una fecha de pared NO se convierte en instante por añadirle una zona del cliente', () => {
    // Deja constancia de la razón de fondo: `YYYY-MM-DD` y un instante son dos tipos distintos del
    // dominio, y la lista de espera usa el primero con su propio validador (`@Matches`).
    expect(esInstanteIso('2027-03-08')).toBe(false);
    expect(esInstanteIso('2027-03-08T00:00:00-06:00')).toBe(true);
  });
});
